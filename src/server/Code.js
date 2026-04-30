function doGet(e) {
  return SXRoutes.doGet(e);
}

function include(filename) {
  return SXRoutes.include(filename);
}

function processWorkbookUpload(formObject) {
  return SXWorkbookPipeline.processFormObject(formObject);
}

function processWorkbookPayload(payload) {
  return SXWorkbookPipeline.processPayloadObject(payload);
}

function discardPreviewSpreadsheet(previewSpreadsheetId) {
  return SXWorkbookPipeline.discardPreviewSpreadsheet(previewSpreadsheetId);
}

function initProcessingRegistry() {
  return SXProcessingRegistryService.initProcessingRegistry();
}

function createProcessingRecord(record) {
  return SXProcessingRegistryService.createProcessingRecord(record);
}

function updateProcessingRecord(id, patch) {
  return SXProcessingRegistryService.updateProcessingRecord(id, patch);
}

function findProcessingRecordByFilename(filename) {
  return SXProcessingRegistryService.findProcessingRecordByFilename(filename);
}

function parsePreviewFilename(filename) {
  return SXProcessingRegistryService.parsePreviewFilename(filename);
}

function fetchProcessingHistory(filters) {
  return SXProcessingRegistryService.listProcessingRecords(filters || {});
}

function markProcessingHistoryPrinted(id) {
  return {
    ok: true,
    message: 'Marked as printed.',
    record: SXProcessingRegistryService.markPrinted(id)
  };
}

function markProcessingHistoryUnprinted(id) {
  return {
    ok: true,
    message: 'Marked as unprinted.',
    record: SXProcessingRegistryService.markUnprinted(id)
  };
}

function listProcessingRecords(filters) {
  return SXProcessingRegistryService.listProcessingRecords(filters || {});
}

function markPrinted(id, printedBy) {
  return SXProcessingRegistryService.markPrinted(id, printedBy);
}

function markUnprinted(id) {
  return SXProcessingRegistryService.markUnprinted(id);
}
