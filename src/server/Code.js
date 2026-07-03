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
  return SXProcessingRegistryGateway.initProcessingRegistry();
}

function createProcessingRecord(record) {
  return SXProcessingRegistryGateway.createProcessingRecord(record);
}

function updateProcessingRecord(id, patch) {
  return SXProcessingRegistryGateway.updateProcessingRecord(id, patch);
}

function findProcessingRecordByFilename(filename) {
  return SXProcessingRegistryGateway.findProcessingRecordByFilename(filename);
}

function parsePreviewFilename(filename) {
  return SXProcessingRegistryGateway.parsePreviewFilename(filename);
}

function fetchProcessingHistory(filters) {
  return SXProcessingRegistryGateway.listProcessingRecords(filters || {});
}

function markProcessingHistoryPrinted(id) {
  return {
    ok: true,
    message: 'Marked as printed.',
    record: SXProcessingRegistryGateway.markPrinted(id)
  };
}

function markProcessingHistoryUnprinted(id) {
  return {
    ok: true,
    message: 'Marked as unprinted.',
    record: SXProcessingRegistryGateway.markUnprinted(id)
  };
}

function listProcessingRecords(filters) {
  return SXProcessingRegistryGateway.listProcessingRecords(filters || {});
}

function markPrinted(id, printedBy) {
  return SXProcessingRegistryGateway.markPrinted(id, printedBy);
}

function markUnprinted(id) {
  return SXProcessingRegistryGateway.markUnprinted(id);
}

function exportLegacyProcessingRegistryForSupabaseImport() {
  return SXProcessingRegistryService.exportForSupabaseImport();
}
