const processingRecordService = require('../services/processingRecordService');

async function createProcessingRecord(req, res) {
  const record = await processingRecordService.createProcessingRecord(req.body || {});
  res.status(201).json({ record });
}

async function listProcessingRecords(req, res) {
  const records = await processingRecordService.listProcessingRecords(req.query || {});
  res.json({ records });
}

async function updateProcessingRecord(req, res) {
  const record = await processingRecordService.updateProcessingRecord(req.params.id, req.body || {});
  res.json({ record });
}

async function upsertProcessingRecordFromPreview(req, res) {
  const payload = await processingRecordService.upsertProcessingRecordFromPreview(req.body || {});
  res.json(payload);
}

async function markPrinted(req, res) {
  const payload = await processingRecordService.markPrinted(
    req.params.id,
    req.body && req.body.printedBy,
  );
  res.json(payload);
}

async function markUnprinted(req, res) {
  const payload = await processingRecordService.markUnprinted(req.params.id);
  res.json(payload);
}

module.exports = {
  createProcessingRecord,
  listProcessingRecords,
  markPrinted,
  markUnprinted,
  updateProcessingRecord,
  upsertProcessingRecordFromPreview,
};
