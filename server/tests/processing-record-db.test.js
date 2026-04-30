const assert = require('node:assert/strict');
const test = require('node:test');

const testDatabaseUrl = process.env.TEST_DATABASE_URL || '';

test(
  'processing_records can save and retrieve migrated-style history rows',
  { skip: testDatabaseUrl ? false : 'Set TEST_DATABASE_URL to run database write/read parity test.' },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl;

    const repository = require('../src/db/repositories/processingRecordRepository');
    const { closePool } = require('../src/db/pool');
    const uniqueName = `test-preview-${Date.now()}.xlsx`;

    const created = await repository.createProcessingRecord({
      reportDate: '20260430',
      reportType: 'individual',
      filename: uniqueName,
      driveFileId: `test-drive-${Date.now()}`,
      driveFileUrl: 'https://example.test/generated-file',
      sourceUploadName: 'source.xlsx',
      branchCodes: '001, 003',
      metadata: { testRun: true },
    });
    const records = await repository.listProcessingRecords({ filename: uniqueName, limit: 1 });

    assert.equal(records.length, 1);
    assert.equal(records[0].id, created.id);
    assert.equal(records[0].filename, uniqueName);
    assert.equal(records[0].branchCodes, '001, 003');

    await closePool();
  },
);
