const processingRecordRepository = require('../db/repositories/processingRecordRepository');
const { normalizeString } = require('../utils/validators');

async function listProcessingRecords(filters = {}) {
  return processingRecordRepository.listProcessingRecords(filters);
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
  listProcessingRecords,
  markPrinted,
  markUnprinted,
};
