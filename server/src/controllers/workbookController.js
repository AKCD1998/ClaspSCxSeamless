const workbookService = require('../services/workbookService');

async function processWorkbooks(req, res) {
  const payload = await workbookService.processWorkbooks({
    files: req.files || [],
    formatterMode: req.body && req.body.formatterMode,
    previewWorkbookId: req.body && (req.body.previewWorkbookId || req.body.previewSpreadsheetId),
    batchId: req.body && req.body.batchId,
    batchFileCount: req.body && req.body.batchFileCount,
  });

  res.status(payload.failures.length && !payload.successes.length ? 400 : 200).json(payload);
}

module.exports = { processWorkbooks };
