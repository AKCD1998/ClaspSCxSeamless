var SXPreviewService = {
  attachProcessedSheet: function(sourceSpreadsheet, sheet, options, logger) {
    var previewSpreadsheet = options.previewSpreadsheetId
      ? this.openPreviewSpreadsheet_(options.previewSpreadsheetId)
      : this.createPreviewSpreadsheet_(options.formatterMode, options.batchFileCount, logger);
    var copiedSheet = sheet.copyTo(previewSpreadsheet);
    var sourceLabel = this.buildSourceLabel_(options.originalFilename, options.outputFilename);
    var nextName = this.buildUniqueSheetName_(previewSpreadsheet, sourceLabel);

    copiedSheet.setName(nextName);
    previewSpreadsheet.setActiveSheet(copiedSheet);
    previewSpreadsheet.moveActiveSheet(previewSpreadsheet.getNumSheets());
    this.removeDefaultSheetIfNeeded_(previewSpreadsheet, copiedSheet);
    SpreadsheetApp.flush();
    var previewFile = DriveApp.getFileById(previewSpreadsheet.getId());
    var sheetNames = this.getSheetNames_(previewSpreadsheet);

    return {
      spreadsheetId: previewSpreadsheet.getId(),
      spreadsheetUrl: previewSpreadsheet.getUrl(),
      previewFilename: previewFile.getName(),
      sheetId: copiedSheet.getSheetId(),
      sheetName: copiedSheet.getName(),
      sheetNames: sheetNames,
      previewLabel: nextName
    };
  },

  discardPreviewSpreadsheet: function(previewSpreadsheetId, logger) {
    if (!previewSpreadsheetId) {
      return;
    }

    SXCleanup.trashFileById(previewSpreadsheetId, logger);
  },

  openPreviewSpreadsheet_: function(previewSpreadsheetId) {
    return SpreadsheetApp.openById(previewSpreadsheetId);
  },

  createPreviewSpreadsheet_: function(formatterMode, batchFileCount, logger) {
    var folder = SXCleanup.getPreviewArchiveFolder();
    var modeLabel = formatterMode || 'preview';
    var batchModeLabel = this.resolveBatchModeLabel_(batchFileCount);
    var title =
      'Preview-' +
      modeLabel +
      '-' +
      batchModeLabel +
      '-' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    var spreadsheet = SpreadsheetApp.create(title);
    var file = DriveApp.getFileById(spreadsheet.getId());

    // Processing-history sync accepts both the legacy pattern and the current batch-aware pattern:
    // Preview-(summary|individual)-YYYYMMDD-HHMMSS
    // Preview-(summary|individual)-(single|multi)-YYYYMMDD-HHMMSS
    spreadsheet.setSpreadsheetLocale(SXConfig.PREVIEW_SPREADSHEET_LOCALE);
    spreadsheet.setSpreadsheetTimeZone(SXConfig.PREVIEW_SPREADSHEET_TIME_ZONE);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    SXLogger.info(logger, 'preview spreadsheet id', spreadsheet.getId());
    SXLogger.info(logger, 'preview batch mode', batchModeLabel);

    return spreadsheet;
  },

  resolveBatchModeLabel_: function(batchFileCount) {
    return Number(batchFileCount) > 1 ? 'multi' : 'single';
  },

  buildSourceLabel_: function(originalFilename, outputFilename) {
    var preferred = SXNormalize.sanitizeBaseName(outputFilename || originalFilename || 'preview');
    var compact = preferred.replace(/-/g, ' ').trim();

    if (!compact) {
      compact = 'preview';
    }

    return compact.slice(0, 80);
  },

  buildUniqueSheetName_: function(spreadsheet, baseName) {
    var safeBase = String(baseName || 'preview').slice(0, 80);
    var candidate = safeBase;
    var counter = 2;

    while (this.sheetNameExists_(spreadsheet, candidate)) {
      var suffix = ' (' + counter + ')';
      candidate = safeBase.slice(0, Math.max(1, 99 - suffix.length)) + suffix;
      counter += 1;
    }

    return candidate;
  },

  sheetNameExists_: function(spreadsheet, name) {
    var sheets = spreadsheet.getSheets();

    for (var index = 0; index < sheets.length; index += 1) {
      if (sheets[index].getName() === name) {
        return true;
      }
    }

    return false;
  },

  getSheetNames_: function(spreadsheet) {
    var sheets = spreadsheet.getSheets();
    var names = [];

    for (var index = 0; index < sheets.length; index += 1) {
      names.push(sheets[index].getName());
    }

    return names;
  },

  removeDefaultSheetIfNeeded_: function(spreadsheet, preservedSheet) {
    var sheets = spreadsheet.getSheets();
    if (sheets.length !== 2) {
      return;
    }

    for (var index = 0; index < sheets.length; index += 1) {
      var currentSheet = sheets[index];
      if (currentSheet.getSheetId() === preservedSheet.getSheetId()) {
        continue;
      }

      if (currentSheet.getName() === 'Sheet1' && currentSheet.getLastRow() === 0 && currentSheet.getLastColumn() === 0) {
        spreadsheet.deleteSheet(currentSheet);
        return;
      }
    }
  }
};
