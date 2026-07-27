const assert = require('node:assert/strict');
const test = require('node:test');

const testDatabaseUrl = process.env.TEST_DATABASE_URL || '';

if (testDatabaseUrl) {
  process.env.SC_OFFICIAL_SUPABASE_DATABASE_URL = testDatabaseUrl;
  process.env.DATABASE_URL = testDatabaseUrl;
}
process.env.INTERNAL_API_TOKEN = 'test-agent-token';

const { createApp } = require('../src/app');
const { closePool } = require('../src/db/pool');

let server;
let baseUrl;

function listen(app) {
  return new Promise((resolve) => {
    const startedServer = app.listen(0, '127.0.0.1', () => {
      const address = startedServer.address();
      resolve({
        server: startedServer,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function closeServer(startedServer) {
  return new Promise((resolve, reject) => {
    startedServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test.before(async () => {
  const started = await listen(createApp());
  server = started.server;
  baseUrl = started.baseUrl;
});

test.after(async () => {
  if (server) {
    await closeServer(server);
  }
  await closePool().catch(() => {});
});

test('GET /api/agent/print-queue rejects requests without a bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/agent/print-queue`);
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, 'UNAUTHORIZED');
});

test(
  'GET /api/agent/print-queue returns an empty queue when nothing needs printing',
  { skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run this test against a real database.' },
  async () => {
    const response = await fetch(`${baseUrl}/api/agent/print-queue`, {
      headers: { Authorization: 'Bearer test-agent-token' },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.queue, []);
  },
);

test(
  'full reprint cycle via real endpoints: a completed agent job must not leave the record stuck in the queue (regression)',
  { skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run this test against a real database.' },
  async () => {
    const processingRecordRepository = require('../src/db/repositories/processingRecordRepository');
    const printJobRepository = require('../src/db/repositories/printJobRepository');
    const { query } = require('../src/db/pool');
    const { tables } = require('../src/db/identifiers');

    const record = await processingRecordRepository.createProcessingRecord({
      reportDate: '20260430',
      reportType: 'individual',
      filename: `test-full-reprint-cycle-${Date.now()}.xlsx`,
      sourceUploadName: 'source.xlsx',
      printed: true,
      printedAt: new Date().toISOString(),
      printedBy: 'auto-print-agent',
    });
    const firstJob = await printJobRepository.createPrintJob({
      processingRecordId: record.id,
      agentHost: '000-HQ',
      printerName: 'Brother MFC-T4500DW',
      documentUploadedAt: record.uploadedAt,
    });
    await printJobRepository.updatePrintJob(firstJob.id, { status: 'completed', completedAt: new Date().toISOString() });

    try {
      // 1. Admin requests a reprint via the real endpoint.
      const requestResponse = await fetch(
        `${baseUrl}/api/app/processing-records/${record.id}/request-print`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestedBy: 'front-desk', reason: 'document_lost' }),
        },
      );
      assert.equal(requestResponse.status, 200);

      // 2. Agent polls and sees it queued for reprint. Check only for our own record — other
      // test files can run concurrently against the same database and leave their own
      // transient queued rows in the shared queue, so asserting the total queue length here
      // would be flaky (this was flagged and confirmed in review).
      const queueBefore = await fetch(`${baseUrl}/api/agent/print-queue`, {
        headers: { Authorization: 'Bearer test-agent-token' },
      }).then((res) => res.json());
      const ourEntryBefore = queueBefore.queue.find((doc) => doc.processingRecordId === record.id);
      assert.ok(ourEntryBefore, 'our record must appear in the queue after request-print');

      // 3. Agent creates its job via the real endpoint — this must CLAIM the admin's row,
      // not insert a separate one (the fix for the persistent-queue defect).
      const createResponse = await fetch(`${baseUrl}/api/agent/print-jobs`, {
        method: 'POST',
        headers: { Authorization: 'Bearer test-agent-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processingRecordId: record.id,
          agentHost: '000-HQ',
          printerName: 'Brother MFC-T4500DW',
        }),
      });
      const createPayload = await createResponse.json();
      assert.equal(createResponse.status, 201);

      const jobCountRow = await query(
        `SELECT count(*)::int AS count FROM ${tables.printJobs} WHERE processing_record_id = $1`,
        [record.id],
      );
      assert.equal(jobCountRow.rows[0].count, 2, 'must still be exactly 2 rows total (baseline + reprint), not 3');

      // 4. Agent completes it via the real endpoint.
      const completeResponse = await fetch(
        `${baseUrl}/api/agent/print-jobs/${createPayload.job.id}/complete`,
        {
          method: 'POST',
          headers: { Authorization: 'Bearer test-agent-token', 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      assert.equal(completeResponse.status, 200);

      // 5. THE REGRESSION CHECK: the record must NOT show up in the queue again.
      const queueAfter = await fetch(`${baseUrl}/api/agent/print-queue`, {
        headers: { Authorization: 'Bearer test-agent-token' },
      }).then((res) => res.json());
      assert.equal(
        queueAfter.queue.some((doc) => doc.processingRecordId === record.id),
        false,
        'record must not reappear in the print queue after its reprint job completed',
      );
    } finally {
      await query(`DELETE FROM ${tables.printJobs} WHERE processing_record_id = $1`, [record.id]);
      await query(`DELETE FROM ${tables.processingRecords} WHERE id = $1`, [record.id]);
    }
  },
);

test(
  'two truly concurrent POST /api/agent/print-jobs for the same record: exactly one caller wins, the other gets 409 (regression)',
  { skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run this test against a real database.' },
  async () => {
    // Reproduces what an independent reviewer found in two stages:
    // 1. Originally, firing two concurrent create-job requests for a record with one unclaimed
    //    queued row produced TWO separate print_jobs rows (one claim, one fallback-create).
    // 2. After fixing (1) with an advisory lock + "reuse existing active job" fallback, BOTH
    //    concurrent callers still received HTTP 201 with the identical job — indistinguishable
    //    from success to a print-agent, which has no ownership check of its own and would have
    //    proceeded to download and physically print the document twice even though the database
    //    only ever held one row. The fix asserted here is that only ONE caller may receive 201;
    //    every other concurrent caller must receive an explicit 409 so its print-agent stops
    //    without printing.
    const processingRecordRepository = require('../src/db/repositories/processingRecordRepository');
    const printJobRepository = require('../src/db/repositories/printJobRepository');
    const { query } = require('../src/db/pool');
    const { tables } = require('../src/db/identifiers');

    const record = await processingRecordRepository.createProcessingRecord({
      reportDate: '20260430',
      reportType: 'individual',
      filename: `test-concurrent-claim-${Date.now()}.xlsx`,
      sourceUploadName: 'source.xlsx',
    });
    // One unclaimed queued row, like an admin's request-print would create.
    const adminQueuedJob = await printJobRepository.createPrintJob({
      processingRecordId: record.id,
      requestedBy: 'front-desk',
      reprintReason: 'document_lost',
      documentUploadedAt: record.uploadedAt,
    });

    try {
      const createJobRequest = async (agentHost) => {
        const response = await fetch(`${baseUrl}/api/agent/print-jobs`, {
          method: 'POST',
          headers: { Authorization: 'Bearer test-agent-token', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            processingRecordId: record.id,
            agentHost,
            printerName: 'Brother MFC-T4500DW',
          }),
        });
        return { status: response.status, payload: await response.json() };
      };

      const [resultA, resultB] = await Promise.all([
        createJobRequest('agent-A'),
        createJobRequest('agent-B'),
      ]);

      const results = [resultA, resultB];
      const winners = results.filter((result) => result.status === 201);
      const losers = results.filter((result) => result.status === 409);

      assert.equal(winners.length, 1, 'exactly one concurrent caller must receive 201 (the winner)');
      assert.equal(losers.length, 1, 'exactly one concurrent caller must receive 409 (the loser, must not print)');
      assert.equal(winners[0].payload.job.id, adminQueuedJob.id);
      assert.equal(losers[0].payload.error.code, 'CONFLICT');

      const jobCountRow = await query(
        `SELECT count(*)::int AS count FROM ${tables.printJobs} WHERE processing_record_id = $1`,
        [record.id],
      );
      assert.equal(jobCountRow.rows[0].count, 1, 'exactly one job row must exist, not two');
    } finally {
      await query(`DELETE FROM ${tables.printJobs} WHERE processing_record_id = $1`, [record.id]);
      await query(`DELETE FROM ${tables.processingRecords} WHERE id = $1`, [record.id]);
    }
  },
);
