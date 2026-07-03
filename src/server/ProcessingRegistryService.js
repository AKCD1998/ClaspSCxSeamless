var SXProcessingRegistryService = {
  HEADERS: [
    'id',
    'reportDate',
    'reportType',
    'filename',
    'driveFileId',
    'driveFileUrl',
    'uploadedAt',
    'uploadedBy',
    'printed',
    'printedAt',
    'printedBy',
    'sourceUploadName',
    'notes',
    'createdAt',
    'updatedAt',
    'lastAction',
    'branchCodes'
  ],

  initProcessingRegistry: function() {
    return this.withRegistryLock_(function() {
      var registry = this.ensureRegistryReady_();
      var result = {
        spreadsheetId: registry.spreadsheet.getId(),
        spreadsheetUrl: registry.spreadsheet.getUrl(),
        sheetName: registry.sheet.getName(),
        headers: this.HEADERS.slice()
      };

      this.logInfo_('registry initialized', result);

      return result;
    });
  },

  createProcessingRecord: function(record) {
    var self = this;

    return this.withRegistryLock_(function() {
      var registry = self.ensureRegistryReady_();
      var nextRecord = self.buildCreateRecord_(
        self.assignDefaultLastAction_(record || {}, 'created')
      );
      var rowNumber = Math.max(registry.sheet.getLastRow(), 1) + 1;

      registry.sheet
        .getRange(rowNumber, 1, 1, self.HEADERS.length)
        .setValues([self.recordToRow_(nextRecord)]);

      self.logRecordMutation_('record created', nextRecord);

      return self.cloneRecord_(nextRecord);
    });
  },

  updateProcessingRecord: function(id, patch) {
    var self = this;
    var recordId = this.normalizeRequiredString_(id, 'Processing record id is required.');
    var safePatch = this.assignDefaultLastAction_(patch || {}, 'updated');

    return this.withRegistryLock_(function() {
      var registry = self.ensureRegistryReady_();
      var table = self.readSheetRecords_(registry.sheet);
      var match = self.findRecordEntryById_(table.entries, recordId);

      if (!match) {
        throw new Error('Processing record not found for id: ' + recordId);
      }

      var updatedRecord = self.applyPatchToRecord_(match.record, safePatch);

      registry.sheet
        .getRange(match.rowNumber, 1, 1, self.HEADERS.length)
        .setValues([self.recordToRow_(updatedRecord)]);

      self.logRecordMutation_('record updated', updatedRecord);

      return self.cloneRecord_(updatedRecord);
    });
  },

  findProcessingRecordByFilename: function(filename) {
    var normalizedFilename = this.normalizeRequiredString_(filename, 'Filename is required.');
    var records = this.listProcessingRecords({
      filename: normalizedFilename
    });

    return records.length ? records[0] : null;
  },

  listProcessingRecords: function(filters) {
    var self = this;

    return this.withRegistryLock_(function() {
      var registry = self.ensureRegistryReady_();
      var entries = self.readSheetRecords_(registry.sheet).entries;

      self.backfillBranchCodes_(registry.sheet, entries);

      var filtered = self.applyFilters_(entries, filters || {});

      filtered.sort(function(left, right) {
        var rightSortValue = String(right.record.uploadedAt || right.record.updatedAt || right.record.createdAt || '');
        var leftSortValue = String(left.record.uploadedAt || left.record.updatedAt || left.record.createdAt || '');

        return rightSortValue.localeCompare(leftSortValue);
      });

      return filtered.map(function(entry) {
        return entry.record;
      });
    });
  },

  parsePreviewFilename: function(filename) {
    var normalizedFilename = this.normalizeString_(filename);
    var match = normalizedFilename.match(
      /^Preview-(summary|individual)(?:-(single|multi))?-(\d{8})-(\d{6})$/
    );

    return {
      isPreviewFile: !!match,
      reportType: match ? match[1] : null,
      batchMode: match ? match[2] || 'legacy' : null,
      reportDate: match ? match[3] : null,
      timestamp: match ? match[4] : null
    };
  },

  // Exact filename matches are updated in place. Files with the same reportDate/reportType
  // but different preview filenames stay as separate rows for audit traceability.
  upsertProcessingRecordFromPreview: function(options) {
    var self = this;
    var filename = this.normalizeRequiredString_(
      options && options.filename,
      'Preview filename is required.'
    );
    var parsed = this.parsePreviewFilename(filename);

    if (!parsed.isPreviewFile) {
      this.logWarn_('preview filename parse failed', {
        filename: filename,
        parsed: parsed
      });

      return {
        ok: false,
        action: 'skipped',
        reason: 'preview_filename_mismatch',
        filename: filename,
        parsed: parsed,
        record: null
      };
    }

    var driveFileId = this.normalizeRequiredString_(
      options && options.driveFileId,
      'Preview driveFileId is required.'
    );
    var driveFileUrl =
      this.normalizeString_(options && options.driveFileUrl) || this.buildSpreadsheetUrl_(driveFileId);
    var uploadedAt = this.getNowIso_();
    var uploadedBy = this.normalizeString_(options && options.uploadedBy) || this.getCurrentActor_();
    var sourceUploadName = this.normalizeString_(options && options.sourceUploadName);
    var notes = this.normalizeString_(options && options.notes);
    var branchCodes = this.resolveBranchCodesForRecordOptions_(options || {}, driveFileId);

    return this.withRegistryLock_(function() {
      var registry = self.ensureRegistryReady_();
      var table = self.readSheetRecords_(registry.sheet);
      var existingEntry = self.findRecordEntryByFilename_(table.entries, filename);
      var resultRecord;

      if (existingEntry) {
        var patch = {
          reportDate: parsed.reportDate,
          reportType: parsed.reportType,
          filename: filename,
          driveFileId: driveFileId,
          driveFileUrl: driveFileUrl,
          uploadedAt: uploadedAt,
          lastAction: 'uploaded_updated'
        };

        if (uploadedBy) {
          patch.uploadedBy = uploadedBy;
        }

        if (sourceUploadName) {
          patch.sourceUploadName = sourceUploadName;
        }

        if (notes) {
          patch.notes = notes;
        }

        if (branchCodes) {
          patch.branchCodes = branchCodes;
        }

        resultRecord = self.applyPatchToRecord_(existingEntry.record, patch);
        registry.sheet
          .getRange(existingEntry.rowNumber, 1, 1, self.HEADERS.length)
          .setValues([self.recordToRow_(resultRecord)]);

        self.logRecordMutation_('record updated from preview upload', resultRecord);

        return {
          ok: true,
          action: 'updated',
          reason: '',
          filename: filename,
          parsed: parsed,
          record: self.cloneRecord_(resultRecord)
        };
      }

      resultRecord = self.buildCreateRecord_({
        reportDate: parsed.reportDate,
        reportType: parsed.reportType,
        filename: filename,
        driveFileId: driveFileId,
        driveFileUrl: driveFileUrl,
        uploadedAt: uploadedAt,
        uploadedBy: uploadedBy,
        printed: false,
        sourceUploadName: sourceUploadName,
        notes: notes,
        branchCodes: branchCodes,
        lastAction: 'uploaded_created'
      });
      var rowNumber = Math.max(registry.sheet.getLastRow(), 1) + 1;

      registry.sheet
        .getRange(rowNumber, 1, 1, self.HEADERS.length)
        .setValues([self.recordToRow_(resultRecord)]);

      self.logRecordMutation_('record created from preview upload', resultRecord);

      return {
        ok: true,
        action: 'created',
        reason: '',
        filename: filename,
        parsed: parsed,
        record: self.cloneRecord_(resultRecord)
      };
    });
  },

  markPrinted: function(id, printedBy) {
    var record = this.updateProcessingRecord(id, {
      printed: true,
      printedAt: this.getNowIso_(),
      printedBy: this.normalizeString_(printedBy) || this.getCurrentActor_(),
      lastAction: 'marked_printed'
    });

    this.logRecordMutation_('print status changed', record);

    return record;
  },

  markUnprinted: function(id) {
    var record = this.updateProcessingRecord(id, {
      printed: false,
      printedAt: '',
      printedBy: '',
      lastAction: 'marked_unprinted'
    });

    this.logRecordMutation_('print status changed', record);

    return record;
  },

  exportForSupabaseImport: function() {
    var self = this;

    return this.withRegistryLock_(function() {
      var registry = self.ensureRegistryReady_();
      var table = self.readSheetRecords_(registry.sheet);
      var rows = table.entries.map(function(entry) {
        var record = self.cloneRecord_(entry.record);

        record.__rowNumber = entry.rowNumber;
        return record;
      });

      return {
        spreadsheetId: registry.spreadsheet.getId(),
        spreadsheetUrl: registry.spreadsheet.getUrl(),
        sheetName: registry.sheet.getName(),
        headers: self.HEADERS.slice(),
        rowCount: rows.length,
        exportedAt: self.getNowIso_(),
        rows: rows
      };
    });
  },

  withRegistryLock_: function(callback) {
    var lock = LockService.getScriptLock();

    lock.waitLock(30000);
    try {
      return callback.call(this);
    } finally {
      lock.releaseLock();
    }
  },

  ensureRegistryReady_: function() {
    var spreadsheet = this.resolveRegistrySpreadsheet_();
    var sheet = this.getOrCreateRegistrySheet_(spreadsheet);

    this.ensureHeaders_(sheet);

    return {
      spreadsheet: spreadsheet,
      sheet: sheet
    };
  },

  resolveRegistrySpreadsheet_: function() {
    var configuredId = this.normalizeString_(SXConfig.PROCESSING_REGISTRY_SPREADSHEET_ID);
    if (configuredId) {
      this.setStoredRegistrySpreadsheetId_(configuredId);
      return SpreadsheetApp.openById(configuredId);
    }

    var storedId = this.getStoredRegistrySpreadsheetId_();
    if (storedId) {
      try {
        return SpreadsheetApp.openById(storedId);
      } catch (error) {
        this.clearStoredRegistrySpreadsheetId_();
      }
    }

    return this.createRegistrySpreadsheet_();
  },

  createRegistrySpreadsheet_: function() {
    var spreadsheet = SpreadsheetApp.create(SXConfig.PROCESSING_REGISTRY_TITLE);
    var defaultSheet = spreadsheet.getSheets()[0];

    defaultSheet.setName(SXConfig.PROCESSING_REGISTRY_SHEET_NAME);
    this.ensureHeaders_(defaultSheet);
    this.tryMoveRegistryFileToArchiveFolder_(spreadsheet.getId());
    this.setStoredRegistrySpreadsheetId_(spreadsheet.getId());
    this.logInfo_('registry spreadsheet created', {
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      sheetName: defaultSheet.getName()
    });

    return spreadsheet;
  },

  tryMoveRegistryFileToArchiveFolder_: function(spreadsheetId) {
    try {
      var folder = SXCleanup.getPreviewArchiveFolder();
      var file = DriveApp.getFileById(spreadsheetId);

      folder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    } catch (error) {
      console.warn(
        '[SXProcessingRegistry] registry file relocation skipped: ' +
          (error && error.message ? error.message : error)
      );
    }
  },

  getOrCreateRegistrySheet_: function(spreadsheet) {
    var sheetName = SXConfig.PROCESSING_REGISTRY_SHEET_NAME;
    var sheet = spreadsheet.getSheetByName(sheetName);

    if (sheet) {
      return sheet;
    }

    sheet = spreadsheet.insertSheet(sheetName);
    this.ensureHeaders_(sheet);

    return sheet;
  },

  ensureHeaders_: function(sheet) {
    var headerRange = sheet.getRange(1, 1, 1, this.HEADERS.length);
    var currentHeaders = headerRange.getValues()[0];
    var hasAnyHeader = currentHeaders.some(function(value) {
      return String(value || '').trim() !== '';
    });

    if (!hasAnyHeader) {
      headerRange.setValues([this.HEADERS.slice()]);
      sheet.setFrozenRows(1);
      this.logInfo_('registry headers initialized', {
        sheetName: sheet.getName(),
        headerCount: this.HEADERS.length
      });
      return;
    }

    var requiresHeaderMigration = false;

    for (var index = 0; index < this.HEADERS.length; index += 1) {
      var currentHeader = String(currentHeaders[index] || '').trim();

      if (!currentHeader) {
        requiresHeaderMigration = true;
        continue;
      }

      if (currentHeader !== this.HEADERS[index]) {
        throw new Error(
          'Processing registry headers do not match the expected schema in sheet "' +
            sheet.getName() +
            '".'
        );
      }
    }

    if (requiresHeaderMigration) {
      headerRange.setValues([this.HEADERS.slice()]);
      sheet.setFrozenRows(1);
      this.logInfo_('registry headers migrated', {
        sheetName: sheet.getName(),
        headerCount: this.HEADERS.length
      });
    }
  },

  readSheetRecords_: function(sheet) {
    var lastRow = sheet.getLastRow();
    var entries = [];

    if (lastRow < 2) {
      return {
        entries: entries
      };
    }

    var values = sheet.getRange(2, 1, lastRow - 1, this.HEADERS.length).getValues();
    for (var index = 0; index < values.length; index += 1) {
      if (this.isEmptyRow_(values[index])) {
        continue;
      }

      entries.push({
        rowNumber: index + 2,
        record: this.rowToRecord_(values[index])
      });
    }

    return {
      entries: entries
    };
  },

  rowToRecord_: function(row) {
    var record = {};

    for (var index = 0; index < this.HEADERS.length; index += 1) {
      record[this.HEADERS[index]] = row[index];
    }

    return {
      id: this.normalizeString_(record.id),
      reportDate: this.normalizeReportDate_(record.reportDate),
      reportType: this.normalizeReportType_(record.reportType),
      filename: this.normalizeString_(record.filename),
      driveFileId: this.normalizeString_(record.driveFileId),
      driveFileUrl: this.normalizeString_(record.driveFileUrl),
      uploadedAt: this.normalizeIsoString_(record.uploadedAt),
      uploadedBy: this.normalizeString_(record.uploadedBy),
      printed: this.normalizeBooleanValue_(record.printed),
      printedAt: this.normalizeIsoString_(record.printedAt),
      printedBy: this.normalizeString_(record.printedBy),
      sourceUploadName: this.normalizeString_(record.sourceUploadName),
      notes: this.normalizeString_(record.notes),
      createdAt: this.normalizeIsoString_(record.createdAt),
      updatedAt: this.normalizeIsoString_(record.updatedAt),
      lastAction: this.normalizeLastAction_(record.lastAction),
      branchCodes: this.normalizeBranchCodes_(record.branchCodes)
    };
  },

  recordToRow_: function(record) {
    return [
      record.id,
      record.reportDate,
      record.reportType,
      record.filename,
      record.driveFileId,
      record.driveFileUrl,
      record.uploadedAt,
      record.uploadedBy,
      !!record.printed,
      record.printedAt,
      record.printedBy,
      record.sourceUploadName,
      record.notes,
      record.createdAt,
      record.updatedAt,
      record.lastAction,
      record.branchCodes
    ];
  },

  buildCreateRecord_: function(record) {
    var nowIso = this.getNowIso_();
    var reportDate = this.coerceReportDate_(
      record.reportDate,
      record.filename,
      record.sourceUploadName
    );
    var reportType = this.normalizeReportType_(record.reportType);
    var driveFileId = this.normalizeRequiredString_(
      record.driveFileId,
      'Processing record driveFileId is required.'
    );
    var createdRecord = {
      id: this.normalizeString_(record.id) || Utilities.getUuid(),
      reportDate: reportDate,
      reportType: reportType,
      filename: this.normalizeRequiredString_(
        record.filename,
        'Processing record filename is required.'
      ),
      driveFileId: driveFileId,
      driveFileUrl: this.normalizeString_(record.driveFileUrl) || this.buildDriveFileUrl_(driveFileId),
      uploadedAt: this.normalizeIsoString_(record.uploadedAt) || nowIso,
      uploadedBy: this.normalizeString_(record.uploadedBy) || this.getCurrentActor_(),
      printed: this.normalizeBooleanValue_(record.printed),
      printedAt: '',
      printedBy: '',
      sourceUploadName: this.normalizeString_(record.sourceUploadName),
      notes: this.normalizeString_(record.notes),
      createdAt: this.normalizeIsoString_(record.createdAt) || nowIso,
      updatedAt: this.normalizeIsoString_(record.updatedAt) || nowIso,
      lastAction: this.normalizeLastAction_(record.lastAction) || 'created',
      branchCodes: this.normalizeBranchCodes_(record.branchCodes || record.branchCode)
    };

    if (!reportType) {
      throw new Error('Processing record reportType must be "summary" or "individual".');
    }

    if (createdRecord.printed) {
      createdRecord.printedAt = this.normalizeIsoString_(record.printedAt) || nowIso;
      createdRecord.printedBy = this.normalizeString_(record.printedBy) || createdRecord.uploadedBy;
    }

    return createdRecord;
  },

  applyPatchToRecord_: function(existingRecord, patch) {
    if (!patch || typeof patch !== 'object') {
      throw new Error('Processing record patch must be an object.');
    }

    var nextRecord = this.cloneRecord_(existingRecord);
    var nowIso = this.getNowIso_();

    if (Object.prototype.hasOwnProperty.call(patch, 'reportType')) {
      nextRecord.reportType = this.normalizeReportType_(patch.reportType);
      if (!nextRecord.reportType) {
        throw new Error('Processing record reportType must be "summary" or "individual".');
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'filename')) {
      nextRecord.filename = this.normalizeRequiredString_(
        patch.filename,
        'Processing record filename is required.'
      );
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'driveFileId')) {
      nextRecord.driveFileId = this.normalizeRequiredString_(
        patch.driveFileId,
        'Processing record driveFileId is required.'
      );
      if (!Object.prototype.hasOwnProperty.call(patch, 'driveFileUrl')) {
        nextRecord.driveFileUrl = this.buildDriveFileUrl_(nextRecord.driveFileId);
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'driveFileUrl')) {
      nextRecord.driveFileUrl =
        this.normalizeString_(patch.driveFileUrl) || this.buildDriveFileUrl_(nextRecord.driveFileId);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'uploadedAt')) {
      nextRecord.uploadedAt = this.normalizeIsoString_(patch.uploadedAt) || '';
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'uploadedBy')) {
      nextRecord.uploadedBy = this.normalizeString_(patch.uploadedBy);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'printed')) {
      nextRecord.printed = this.normalizeBooleanValue_(patch.printed);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'printedAt')) {
      nextRecord.printedAt = this.normalizeIsoString_(patch.printedAt) || '';
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'printedBy')) {
      nextRecord.printedBy = this.normalizeString_(patch.printedBy);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'sourceUploadName')) {
      nextRecord.sourceUploadName = this.normalizeString_(patch.sourceUploadName);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'reportDate')) {
      nextRecord.reportDate = this.coerceReportDate_(
        patch.reportDate,
        nextRecord.filename,
        nextRecord.sourceUploadName
      );
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'notes')) {
      nextRecord.notes = this.normalizeString_(patch.notes);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'branchCodes')) {
      nextRecord.branchCodes = this.normalizeBranchCodes_(patch.branchCodes);
    } else if (Object.prototype.hasOwnProperty.call(patch, 'branchCode')) {
      nextRecord.branchCodes = this.normalizeBranchCodes_(patch.branchCode);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'lastAction')) {
      nextRecord.lastAction = this.normalizeLastAction_(patch.lastAction) || nextRecord.lastAction;
    }

    nextRecord.updatedAt = nowIso;
    nextRecord.lastAction = nextRecord.lastAction || 'updated';

    return nextRecord;
  },

  applyFilters_: function(entries, filters) {
    var normalizedFilters = this.normalizeFilters_(filters);

    return entries.filter(function(entry) {
      var record = entry.record;

      if (normalizedFilters.id && record.id !== normalizedFilters.id) {
        return false;
      }

      if (normalizedFilters.filename && record.filename !== normalizedFilters.filename) {
        return false;
      }

      if (normalizedFilters.reportType && record.reportType !== normalizedFilters.reportType) {
        return false;
      }

      if (normalizedFilters.reportDate && record.reportDate !== normalizedFilters.reportDate) {
        return false;
      }

      if (normalizedFilters.driveFileId && record.driveFileId !== normalizedFilters.driveFileId) {
        return false;
      }

      if (normalizedFilters.printed !== null && record.printed !== normalizedFilters.printed) {
        return false;
      }

      return true;
    }).slice(0, normalizedFilters.limit || entries.length);
  },

  normalizeFilters_: function(filters) {
    var normalized = {
      id: this.normalizeString_(filters.id),
      filename: this.normalizeString_(filters.filename),
      reportType: this.normalizeReportType_(filters.reportType),
      reportDate: this.normalizeReportDate_(filters.reportDate),
      driveFileId: this.normalizeString_(filters.driveFileId),
      printed: this.normalizeOptionalBoolean_(filters.printed),
      limit: 0
    };
    var limit = Number(filters.limit) || 0;

    if (limit > 0) {
      normalized.limit = Math.floor(limit);
    }

    return normalized;
  },

  findRecordEntryById_: function(entries, id) {
    for (var index = 0; index < entries.length; index += 1) {
      if (entries[index].record.id === id) {
        return entries[index];
      }
    }

    return null;
  },

  findRecordEntryByFilename_: function(entries, filename) {
    for (var index = entries.length - 1; index >= 0; index -= 1) {
      if (entries[index].record.filename === filename) {
        return entries[index];
      }
    }

    return null;
  },

  cloneRecord_: function(record) {
    return {
      id: record.id,
      reportDate: record.reportDate,
      reportType: record.reportType,
      filename: record.filename,
      driveFileId: record.driveFileId,
      driveFileUrl: record.driveFileUrl,
      uploadedAt: record.uploadedAt,
      uploadedBy: record.uploadedBy,
      printed: !!record.printed,
      printedAt: record.printedAt,
      printedBy: record.printedBy,
      sourceUploadName: record.sourceUploadName,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastAction: record.lastAction,
      branchCodes: record.branchCodes
    };
  },

  assignDefaultLastAction_: function(source, defaultAction) {
    var nextSource = {};
    var key;

    for (key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        nextSource[key] = source[key];
      }
    }

    if (!this.normalizeLastAction_(nextSource.lastAction)) {
      nextSource.lastAction = defaultAction;
    }

    return nextSource;
  },

  isEmptyRow_: function(row) {
    for (var index = 0; index < row.length; index += 1) {
      if (String(row[index] || '').trim() !== '') {
        return false;
      }
    }

    return true;
  },

  backfillBranchCodes_: function(sheet, entries) {
    for (var index = 0; index < entries.length; index += 1) {
      var entry = entries[index];
      var record = entry.record;

      if (record.branchCodes || !record.driveFileId) {
        continue;
      }

      var branchCodes = this.collectBranchCodesFromSpreadsheet_(record.driveFileId);
      if (!branchCodes) {
        continue;
      }

      var updatedRecord = this.applyPatchToRecord_(record, {
        branchCodes: branchCodes
      });

      sheet
        .getRange(entry.rowNumber, 1, 1, this.HEADERS.length)
        .setValues([this.recordToRow_(updatedRecord)]);

      entry.record = updatedRecord;
      this.logRecordMutation_('record branch metadata backfilled', updatedRecord);
    }
  },

  resolveBranchCodesForRecordOptions_: function(options, driveFileId) {
    var branchCodes = this.extractBranchCodesFromWorksheetNames_(
      this.normalizeWorksheetNamesOption_(
        options.worksheetNames || options.sheetNames || options.worksheetName || options.sheetName
      )
    );

    if (branchCodes) {
      return branchCodes;
    }

    branchCodes = this.normalizeBranchCodes_(options.branchCodes || options.branchCode);
    if (branchCodes) {
      return branchCodes;
    }

    return this.collectBranchCodesFromSpreadsheet_(driveFileId);
  },

  collectBranchCodesFromSpreadsheet_: function(spreadsheetId) {
    var normalizedSpreadsheetId = this.normalizeString_(spreadsheetId);
    if (!normalizedSpreadsheetId) {
      return '';
    }

    try {
      var spreadsheet = SpreadsheetApp.openById(normalizedSpreadsheetId);
      var sheets = spreadsheet.getSheets();
      var worksheetNames = [];

      for (var index = 0; index < sheets.length; index += 1) {
        worksheetNames.push(sheets[index].getName());
      }

      return this.extractBranchCodesFromWorksheetNames_(worksheetNames);
    } catch (error) {
      this.logWarn_('branch metadata read skipped', {
        spreadsheetId: normalizedSpreadsheetId,
        message: error && error.message ? error.message : String(error)
      });
    }

    return '';
  },

  normalizeWorksheetNamesOption_: function(value) {
    if (value === null || typeof value === 'undefined') {
      return [];
    }

    if (Array.isArray(value)) {
      return value.slice();
    }

    return [value];
  },

  extractBranchCodesFromWorksheetNames_: function(worksheetNames) {
    var branchCodes = [];

    for (var index = 0; index < worksheetNames.length; index += 1) {
      var branchCode = this.extractBranchCodeFromWorksheetName_(worksheetNames[index]);
      if (branchCode) {
        branchCodes.push(branchCode);
      }
    }

    return this.normalizeBranchCodes_(branchCodes);
  },

  extractBranchCodeFromWorksheetName_: function(worksheetName) {
    var text = this.normalizeString_(worksheetName);
    if (!text) {
      return '';
    }

    var normalizedText = text
      .replace(/\.[^.]+$/, '')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    var numericTokens = normalizedText.match(/\d+/g) || [];

    if (
      numericTokens.length >= 2 &&
      /^\d{8}$/.test(numericTokens[0]) &&
      /^\d{3}$/.test(numericTokens[1])
    ) {
      return numericTokens[1];
    }

    if (
      numericTokens.length >= 4 &&
      /^\d{4}$/.test(numericTokens[0]) &&
      /^(0[1-9]|1[0-2])$/.test(numericTokens[1]) &&
      /^(0[1-9]|[12]\d|3[01])$/.test(numericTokens[2]) &&
      /^\d{3}$/.test(numericTokens[3])
    ) {
      return numericTokens[3];
    }

    for (var index = 0; index < numericTokens.length; index += 1) {
      if (/^\d{3}$/.test(numericTokens[index])) {
        return numericTokens[index];
      }
    }

    return '';
  },

  coerceReportDate_: function(reportDate, filename, sourceUploadName) {
    var normalized = this.normalizeReportDate_(reportDate);

    if (normalized) {
      return normalized;
    }

    normalized = this.extractReportDateFromText_(filename);
    if (normalized) {
      return normalized;
    }

    normalized = this.extractReportDateFromText_(sourceUploadName);
    if (normalized) {
      return normalized;
    }

    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  },

  extractReportDateFromText_: function(value) {
    var text = this.normalizeString_(value);
    var dashedMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);

    if (dashedMatch) {
      return dashedMatch[1] + dashedMatch[2] + dashedMatch[3];
    }

    var compactMatch = text.match(/(?:^|[^0-9])(\d{8})(?:[^0-9]|$)/);

    return compactMatch ? compactMatch[1] : '';
  },

  normalizeRequiredString_: function(value, message) {
    var normalized = this.normalizeString_(value);

    if (!normalized) {
      throw new Error(message);
    }

    return normalized;
  },

  normalizeString_: function(value) {
    if (value === null || typeof value === 'undefined') {
      return '';
    }

    return String(value).trim();
  },

  normalizeBranchCodes_: function(value) {
    var rawValues = [];
    var branchCodeMap = {};
    var branchCodes = [];

    if (value === null || typeof value === 'undefined') {
      return '';
    }

    if (Array.isArray(value)) {
      for (var valueIndex = 0; valueIndex < value.length; valueIndex += 1) {
        rawValues = rawValues.concat(String(value[valueIndex] || '').split(/[,;\s]+/));
      }
    } else {
      rawValues = String(value).split(/[,;\s]+/);
    }

    for (var index = 0; index < rawValues.length; index += 1) {
      var rawBranchCode = this.normalizeString_(rawValues[index]);

      if (!/^\d{3}$/.test(rawBranchCode) || branchCodeMap[rawBranchCode]) {
        continue;
      }

      branchCodeMap[rawBranchCode] = true;
      branchCodes.push(rawBranchCode);
    }

    branchCodes.sort(function(left, right) {
      return Number(left) - Number(right) || left.localeCompare(right);
    });

    return branchCodes.join(', ');
  },

  normalizeLastAction_: function(value) {
    return this.normalizeString_(value);
  },

  normalizeReportType_: function(value) {
    return SXWorkbookVariant.parseRequestedVariant(value);
  },

  normalizeReportDate_: function(value) {
    if (value === null || typeof value === 'undefined') {
      return '';
    }

    var text = String(value).trim();
    if (!text) {
      return '';
    }

    var dashedMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (dashedMatch) {
      return dashedMatch[1] + dashedMatch[2] + dashedMatch[3];
    }

    var compactMatch = text.match(/^(\d{8})$/);

    if (compactMatch) {
      return compactMatch[1];
    }

    return '';
  },

  normalizeIsoString_: function(value) {
    if (value === null || typeof value === 'undefined') {
      return '';
    }

    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      return value.toISOString();
    }

    var text = String(value).trim();
    if (!text) {
      return '';
    }

    var parsed = new Date(text);

    return isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  },

  normalizeBooleanValue_: function(value) {
    if (value === true || value === false) {
      return value;
    }

    var text = String(value || '').trim().toLowerCase();

    return text === 'true' || text === '1' || text === 'yes';
  },

  normalizeOptionalBoolean_: function(value) {
    if (value === null || typeof value === 'undefined' || String(value).trim() === '') {
      return null;
    }

    return this.normalizeBooleanValue_(value);
  },

  buildDriveFileUrl_: function(fileId) {
    return 'https://drive.google.com/file/d/' + encodeURIComponent(fileId) + '/view';
  },

  buildSpreadsheetUrl_: function(fileId) {
    return 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(fileId) + '/edit';
  },

  getStoredRegistrySpreadsheetId_: function() {
    return this.normalizeString_(
      PropertiesService.getScriptProperties().getProperty(
        SXConfig.PROCESSING_REGISTRY_SPREADSHEET_PROPERTY_KEY
      )
    );
  },

  setStoredRegistrySpreadsheetId_: function(spreadsheetId) {
    PropertiesService.getScriptProperties().setProperty(
      SXConfig.PROCESSING_REGISTRY_SPREADSHEET_PROPERTY_KEY,
      spreadsheetId
    );
  },

  clearStoredRegistrySpreadsheetId_: function() {
    PropertiesService.getScriptProperties().deleteProperty(
      SXConfig.PROCESSING_REGISTRY_SPREADSHEET_PROPERTY_KEY
    );
  },

  getCurrentActor_: function() {
    try {
      return this.normalizeString_(Session.getActiveUser().getEmail());
    } catch (error) {
      return '';
    }
  },

  getNowIso_: function() {
    return new Date().toISOString();
  },

  logRecordMutation_: function(label, record) {
    this.logInfo_(label, {
      id: record.id,
      filename: record.filename,
      reportType: record.reportType,
      reportDate: record.reportDate,
      driveFileId: record.driveFileId,
      branchCodes: record.branchCodes,
      printed: !!record.printed,
      uploadedAt: record.uploadedAt,
      printedAt: record.printedAt,
      updatedAt: record.updatedAt,
      lastAction: record.lastAction
    });
  },

  logInfo_: function(label, value) {
    SXLogger.info(
      SXLogger.create('SXProcessingRegistry'),
      label,
      this.stringifyLogValue_(this.withLogTimestamp_(value))
    );
  },

  logWarn_: function(label, value) {
    SXLogger.warn(
      SXLogger.create('SXProcessingRegistry'),
      label,
      this.stringifyLogValue_(this.withLogTimestamp_(value))
    );
  },

  stringifyLogValue_: function(value) {
    if (value === null || typeof value === 'undefined') {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  },

  withLogTimestamp_: function(value) {
    var eventAt = this.getNowIso_();
    var nextValue;
    var key;

    if (value === null || typeof value === 'undefined') {
      return {
        eventAt: eventAt
      };
    }

    if (typeof value === 'string') {
      return {
        eventAt: eventAt,
        message: value
      };
    }

    if (typeof value !== 'object') {
      return {
        eventAt: eventAt,
        value: value
      };
    }

    nextValue = {};
    for (key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        nextValue[key] = value[key];
      }
    }

    if (!nextValue.eventAt) {
      nextValue.eventAt = eventAt;
    }

    return nextValue;
  }
};
