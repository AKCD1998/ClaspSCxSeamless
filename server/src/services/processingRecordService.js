const processingRecordRepository = require('../db/repositories/processingRecordRepository');
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

module.exports = {
  createProcessingRecord,
  listProcessingRecords,
  markPrinted,
  markUnprinted,
  updateProcessingRecord,
  upsertProcessingRecordFromPreview,
};
