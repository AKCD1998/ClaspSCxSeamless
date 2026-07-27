const assert = require('node:assert/strict');
const test = require('node:test');

const testDatabaseUrl = process.env.TEST_DATABASE_URL || '';

if (testDatabaseUrl) {
  process.env.SC_OFFICIAL_SUPABASE_DATABASE_URL = testDatabaseUrl;
  process.env.DATABASE_URL = testDatabaseUrl;
}

const { createApp } = require('../src/app');
const { closePool, query } = require('../src/db/pool');

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

test('POST /api/app/processing-records/:id/request-print returns 404 for an unknown record', async () => {
  const response = await fetch(
    `${baseUrl}/api/app/processing-records/00000000-0000-0000-0000-000000000000/request-print`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.error.code, 'NOT_FOUND');
});

test(
  'POST /api/app/processing-records/:id/request-print marks unprinted and queues a print job',
  { skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run this test against a real database.' },
  async () => {
    const processingRecordRepository = require('../src/db/repositories/processingRecordRepository');
    const printJobRepository = require('../src/db/repositories/printJobRepository');
    const { tables } = require('../src/db/identifiers');
    const uniqueName = `test-request-print-${Date.now()}.xlsx`;

    const record = await processingRecordRepository.createProcessingRecord({
      reportDate: '20260430',
      reportType: 'individual',
      filename: uniqueName,
      sourceUploadName: 'source.xlsx',
      printed: true,
      printedAt: new Date().toISOString(),
      printedBy: 'previous-run',
    });

    try {
      const previousJob = await printJobRepository.createPrintJob({
        processingRecordId: record.id,
        agentHost: '000-HQ',
        printerName: 'Brother MFC-T4500DW',
        documentUploadedAt: record.uploadedAt,
      });
      await printJobRepository.updatePrintJob(previousJob.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });

      const response = await fetch(
        `${baseUrl}/api/app/processing-records/${record.id}/request-print`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestedBy: 'front-desk', reason: 'document_lost' }),
        },
      );
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.ok, true);
      assert.equal(payload.record.printed, false);
      assert.equal(payload.record.lastAction, 'print_requested');
      assert.equal(payload.job.status, 'queued');
      assert.equal(payload.job.requestedBy, 'front-desk');
      assert.equal(payload.job.reprintReason, 'document_lost');
      assert.equal(payload.job.isReprint, true);
      assert.equal(payload.job.attemptNo, 2);
    } finally {
      await query(`DELETE FROM ${tables.printJobs} WHERE processing_record_id = $1`, [record.id]);
      await query(`DELETE FROM ${tables.processingRecords} WHERE id = $1`, [record.id]);
    }
  },
);
