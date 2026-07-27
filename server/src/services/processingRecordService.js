const processingRecordRepository = require('../db/repositories/processingRecordRepository');
const printJobRepository = require('../db/repositories/printJobRepository');
const { getClient } = require('../db/pool');
const { normalizeString } = require('../utils/validators');

async function createProcessingRecord(record = {}) {
  return processingRecordRepository.createProcessingRecord(record);
}

async function updateProcessingRecord(id, patch = {}) {
  return processingRecordRepository.updateProcessingRecord(id, patch);
}

async function listProcessingRecords(filters = {}) {
  return processingRecordRepository.listProcessingRecords(filters);
}

async function upsertProcessingRecordFromPreview(options = {}) {
  return processingRecordRepository.upsertProcessingRecordFromPreview(options);
}

async function markPrinted(id, printedBy = '') {
  const record = await processingRecordRepository.markPrinted(id, normalizeString(printedBy));

  return {
    ok: true,
    message: 'Marked as printed.',
    record,
  };
}

async function markUnprinted(id) {
  const record = await processingRecordRepository.markUnprinted(id);

  return {
    ok: true,
    message: 'Marked as unprinted.',
    record,
  };
}

async function requestPrint(id, options = {}) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const record = await processingRecordRepository.updateProcessingRecord(
      id,
      {
        printed: false,
        lastAction: 'print_requested',
      },
      client,
    );

    const job = await printJobRepository.createPrintJob(
      {
        processingRecordId: record.id,
        generatedFileId: (record.metadata && record.metadata.outputFileId) || null,
        requestedBy: normalizeString(options.requestedBy),
        reprintReason: normalizeString(options.reason),
        documentUploadedAt: record.uploadedAt,
      },
      client,
    );

    await client.query('COMMIT');

    return {
      ok: true,
      message: job.isReprint ? 'Reprint requested.' : 'Print requested.',
      record,
      job,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createProcessingRecord,
  listProcessingRecords,
  markPrinted,
  markUnprinted,
  requestPrint,
  updateProcessingRecord,
  upsertProcessingRecordFromPreview,
};
