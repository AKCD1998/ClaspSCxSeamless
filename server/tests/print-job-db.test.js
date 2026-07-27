const assert = require('node:assert/strict');
const test = require('node:test');

const testDatabaseUrl = process.env.TEST_DATABASE_URL || '';

test(
  'print_jobs tracks attempt_no and is_reprint across a print then a reprint',
  { skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run database write/read parity test.' },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;

    const processingRecordRepository = require('../src/db/repositories/processingRecordRepository');
    const printJobRepository = require('../src/db/repositories/printJobRepository');
    const uniqueName = `test-print-job-${Date.now()}.xlsx`;

    const record = await processingRecordRepository.createProcessingRecord({
      reportDate: '20260430',
      reportType: 'individual',
      filename: uniqueName,
      sourceUploadName: 'source.xlsx',
      metadata: { testRun: true },
    });

    const firstJob = await printJobRepository.createPrintJob({
      processingRecordId: record.id,
      agentHost: '000-HQ',
      printerName: 'Brother MFC-T4500DW',
      documentUploadedAt: record.uploadedAt,
    });

    assert.equal(firstJob.attemptNo, 1);
    assert.equal(firstJob.isReprint, false);
    assert.equal(firstJob.status, 'queued');

    const active = await printJobRepository.listActivePrintJobs(record.id);
    assert.equal(active.length, 1);
    assert.equal(active[0].id, firstJob.id);

    const completedJob = await printJobRepository.updatePrintJob(firstJob.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    assert.equal(completedJob.status, 'completed');

    const secondJob = await printJobRepository.createPrintJob({
      processingRecordId: record.id,
      agentHost: '000-HQ',
      printerName: 'Brother MFC-T4500DW',
      requestedBy: 'reprint-tester',
      reprintReason: 'document_lost',
      documentUploadedAt: record.uploadedAt,
    });

    assert.equal(secondJob.attemptNo, 2);
    assert.equal(secondJob.isReprint, true);
    assert.equal(secondJob.reprintReason, 'document_lost');

    const fetched = await printJobRepository.getPrintJobById(secondJob.id);
    assert.equal(fetched.id, secondJob.id);
  },
);

test(
  'requeueStaleJobs clears agent_host so the record can be picked up again, including a job stuck at queued',
  { skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run database write/read parity test.' },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;

    const processingRecordRepository = require('../src/db/repositories/processingRecordRepository');
    const printJobRepository = require('../src/db/repositories/printJobRepository');
    const { query } = require('../src/db/pool');
    const { tables } = require('../src/db/identifiers');

    const stuckDownloading = await processingRecordRepository.createProcessingRecord({
      reportDate: '20260430',
      reportType: 'individual',
      filename: `test-stale-downloading-${Date.now()}.xlsx`,
      sourceUploadName: 'source.xlsx',
    });
    const stuckQueued = await processingRecordRepository.createProcessingRecord({
      reportDate: '20260430',
      reportType: 'individual',
      filename: `test-stale-queued-${Date.now()}.xlsx`,
      sourceUploadName: 'source.xlsx',
    });

    const downloadingJob = await printJobRepository.createPrintJob({
      processingRecordId: stuckDownloading.id,
      agentHost: '000-HQ',
      printerName: 'Brother MFC-T4500DW',
      documentUploadedAt: stuckDownloading.uploadedAt,
    });
    await printJobRepository.updatePrintJob(downloadingJob.id, { status: 'downloading' });

    const queuedButClaimedJob = await printJobRepository.createPrintJob({
      processingRecordId: stuckQueued.id,
      agentHost: '000-HQ',
      printerName: 'Brother MFC-T4500DW',
      documentUploadedAt: stuckQueued.uploadedAt,
    });

    // Simulate the agent dying 31 minutes ago, before either job could progress further.
    // The trg_print_jobs_updated_at trigger stamps updated_at=now() on every UPDATE, so it
    // has to be disabled for this one backdating statement, then re-enabled immediately.
    await query(`ALTER TABLE ${tables.printJobs} DISABLE TRIGGER trg_print_jobs_updated_at`);
    try {
      await query(`UPDATE ${tables.printJobs} SET updated_at = now() - interval '31 minutes' WHERE id = ANY($1)`, [
        [downloadingJob.id, queuedButClaimedJob.id],
      ]);
    } finally {
      await query(`ALTER TABLE ${tables.printJobs} ENABLE TRIGGER trg_print_jobs_updated_at`);
    }

    const requeued = await printJobRepository.requeueStaleJobs();
    const requeuedIds = requeued.map((job) => job.id).sort();
    assert.deepEqual(requeuedIds, [downloadingJob.id, queuedButClaimedJob.id].sort());

    const refetchedDownloading = await printJobRepository.getPrintJobById(downloadingJob.id);
    assert.equal(refetchedDownloading.status, 'queued');
    assert.equal(refetchedDownloading.agentHost, '');

    const refetchedQueued = await printJobRepository.getPrintJobById(queuedButClaimedJob.id);
    assert.equal(refetchedQueued.status, 'queued');
    assert.equal(refetchedQueued.agentHost, '');

    const candidates = await printJobRepository.listPrintQueueCandidates(null);
    const candidateIds = candidates.map((row) => row.id);
    assert.ok(candidateIds.includes(stuckDownloading.id));
    assert.ok(candidateIds.includes(stuckQueued.id));

    await query(`DELETE FROM ${tables.printJobs} WHERE processing_record_id = ANY($1)`, [
      [stuckDownloading.id, stuckQueued.id],
    ]);
    await query(`DELETE FROM ${tables.processingRecords} WHERE id = ANY($1)`, [
      [stuckDownloading.id, stuckQueued.id],
    ]);
  },
);

test(
  'claimQueuedJob reuses an existing unclaimed queued row instead of leaving it orphaned (regression for the persistent-queue defect)',
  { skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run database write/read parity test.' },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;

    const processingRecordRepository = require('../src/db/repositories/processingRecordRepository');
    const printJobRepository = require('../src/db/repositories/printJobRepository');
    const { query, closePool } = require('../src/db/pool');
    const { tables } = require('../src/db/identifiers');

    const record = await processingRecordRepository.createProcessingRecord({
      reportDate: '20260430',
      reportType: 'individual',
      filename: `test-claim-queued-${Date.now()}.xlsx`,
      sourceUploadName: 'source.xlsx',
      printed: true,
      printedAt: new Date().toISOString(),
      printedBy: 'auto-print-agent',
    });

    // Baseline: one prior completed print, so the next request is a reprint.
    const firstJob = await printJobRepository.createPrintJob({
      processingRecordId: record.id,
      agentHost: '000-HQ',
      printerName: 'Brother MFC-T4500DW',
      documentUploadedAt: record.uploadedAt,
    });
    await printJobRepository.updatePrintJob(firstJob.id, { status: 'completed', completedAt: new Date().toISOString() });

    // Admin requests a reprint — this creates an unclaimed `queued` row (agent_host = null),
    // exactly like processingRecordService.requestPrint does.
    const adminQueuedJob = await printJobRepository.createPrintJob({
      processingRecordId: record.id,
      requestedBy: 'front-desk',
      reprintReason: 'document_lost',
      documentUploadedAt: record.uploadedAt,
    });
    assert.equal(adminQueuedJob.status, 'queued');
    assert.equal(adminQueuedJob.agentHost, '');

    // Agent claims it instead of inserting a third row.
    const claimed = await printJobRepository.claimQueuedJob(record.id, {
      agentHost: '000-HQ',
      printerName: 'Brother MFC-T4500DW',
    });
    assert.ok(claimed);
    assert.equal(claimed.id, adminQueuedJob.id, 'must reuse the admin-created row, not create a new one');
    assert.equal(claimed.agentHost, '000-HQ');

    // No unclaimed queued row remains, so a second claim attempt finds nothing.
    const secondClaimAttempt = await printJobRepository.claimQueuedJob(record.id, {
      agentHost: '000-HQ',
      printerName: 'Brother MFC-T4500DW',
    });
    assert.equal(secondClaimAttempt, null);

    // Agent completes the claimed job...
    await printJobRepository.updatePrintJob(claimed.id, { status: 'completed', completedAt: new Date().toISOString() });
    await processingRecordRepository.markPrinted(record.id, 'auto-print-agent');

    // ...and the record must NOT reappear in the print queue afterward (the actual defect).
    const candidatesAfter = await printJobRepository.listPrintQueueCandidates(null);
    const candidateIds = candidatesAfter.map((row) => row.id);
    assert.ok(!candidateIds.includes(record.id), 'record must not reappear in queue after its claimed job completed');

    await query(`DELETE FROM ${tables.printJobs} WHERE processing_record_id = $1`, [record.id]);
    await query(`DELETE FROM ${tables.processingRecords} WHERE id = $1`, [record.id]);

    await closePool();
  },
);
