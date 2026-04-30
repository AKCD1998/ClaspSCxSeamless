const processingRecordService = require('../services/processingRecordService');

async function listProcessingRecords(req, res) {
  const records = await processingRecordService.listProcessingRecords(req.query || {});
  res.json({ records });
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
  listProcessingRecords,
  markPrinted,
  markUnprinted,
};
