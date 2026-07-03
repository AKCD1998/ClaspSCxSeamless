var SXWorkbookPipeline = {
  processFormObject: function(formObject) {
    return this.processUpload_(this.normalizeUpload_(this.extractUploadFromForm_(formObject)));
  },

  processPayloadObject: function(payload) {
    return this.processUpload_(this.normalizeUpload_(this.extractUploadFromPayload_(payload)));
  },

  processUpload_: function(upload) {
    var logger = SXLogger.create('SXWorkbook');
    var warningCollector = SXWarnings.create();
    var tempFileId = '';
    var previewResult = null;

    try {
      SXCleanup.cleanupStaleWorkspaceFiles(logger);

      SXLogger.info(logger, 'uploaded filename', upload.originalFilename);
      SXLogger.info(logger, 'uploaded size bytes', upload.size);
      SXLogger.info(logger, 'batch file count', upload.batchFileCount);

      var conversion = SXDriveConversion.convertUploadBlobToSpreadsheet(
        upload.blob,
        upload.originalFilename,
        logger
      );

      tempFileId = conversion.tempFileId;

      var spreadsheet = conversion.spreadsheet || SpreadsheetApp.openById(conversion.spreadsheetId);
      var targetSheet = SXSheetUtils.getFirstSheet(spreadsheet);
      if (!targetSheet) {
        throw this.userError_('Workbook must contain at least one worksheet.');
      }

      var detectedVariant = SXWorkbookVariant.detect(targetSheet);
      var requestedVariant = upload.formatterMode;
      var effectiveVariant = requestedVariant || detectedVariant;

      if (requestedVariant && requestedVariant !== detectedVariant) {
        SXWarnings.add(
          warningCollector,
          'Selected formatter "' +
            requestedVariant +
            '" but the workbook looked like "' +
            detectedVariant +
            '". Continuing with the selected formatter.'
        );
      }

      SXLogger.info(logger, 'requested formatter', requestedVariant || '[auto]');
      SXLogger.info(logger, 'detected workbook variant', detectedVariant);
      SXLogger.info(logger, 'effective formatter', effectiveVariant);

      var transformResult = SXTransformWorkbook.run(spreadsheet, effectiveVariant, warningCollector, logger);
      var filenameResult = SXFilenameBuilder.buildOutputFilename(
        targetSheet,
        upload.originalFilename,
        effectiveVariant
      );

      SXWarnings.merge(warningCollector, filenameResult.warnings);

      SXLogger.info(
        logger,
        'parsed ' + filenameResult.dateSourceLabel,
        filenameResult.parsedDate || '[unparsed]'
      );
      SXLogger.info(
        logger,
        filenameResult.branchSourceLabel,
        filenameResult.rawBranchSource
          ? filenameResult.rawBranchSource + ' -> ' + (filenameResult.branchCode || '[unmapped]')
          : '[empty]'
      );
      SXLogger.info(
        logger,
        'deleted columns',
        transformResult.deletedColumns.length
          ? transformResult.deletedColumns
              .map(function(entry) {
                return entry.headerText + ' @ ' + entry.columnLabel + ' (' + entry.strategy + ')';
              })
              .join(', ')
          : 'none'
      );
      SXLogger.info(logger, 'highlight count', transformResult.highlightCount);
      SXLogger.info(logger, 'output filename', filenameResult.filename);

      var exportResult = SXExportService.exportSpreadsheetToXlsxFile(
        spreadsheet.getId(),
        filenameResult.filename,
        logger
      );
      SXLogger.info(logger, 'final output filename', filenameResult.filename);
      SXLogger.info(
        logger,
        'drive save result',
        exportResult.fileId + ' -> ' + (exportResult.viewUrl || exportResult.downloadUrl || '[missing]')
      );
      previewResult = SXPreviewService.attachProcessedSheet(
        spreadsheet,
        targetSheet,
        {
          previewSpreadsheetId: upload.previewSpreadsheetId,
          batchFileCount: upload.batchFileCount,
          formatterMode: effectiveVariant,
          originalFilename: upload.originalFilename,
          outputFilename: filenameResult.filename
        },
        logger
      );
      SXLogger.info(logger, 'preview output filename', previewResult.previewFilename || '[missing]');
      SXLogger.info(
        logger,
        'preview drive save result',
        previewResult.spreadsheetId + ' -> ' + (previewResult.spreadsheetUrl || '[missing]')
      );
      try {
        var parsedPreviewFilename = SXProcessingRegistryGateway.parsePreviewFilename(
          previewResult.previewFilename
        );

        SXLogger.info(
          logger,
          'parsed preview report type/date',
          JSON.stringify({
            reportType: parsedPreviewFilename.reportType,
            batchMode: parsedPreviewFilename.batchMode,
            reportDate: parsedPreviewFilename.reportDate,
            timestamp: parsedPreviewFilename.timestamp,
            isPreviewFile: parsedPreviewFilename.isPreviewFile
          })
        );

        var registryResult = SXProcessingRegistryGateway.upsertProcessingRecordFromPreview({
          filename: previewResult.previewFilename,
          driveFileId: previewResult.spreadsheetId,
          driveFileUrl: previewResult.spreadsheetUrl,
          sourceUploadName: upload.originalFilename,
          worksheetNames: previewResult.sheetNames,
          branchCode: filenameResult.branchCode
        });

        if (registryResult.ok) {
          SXLogger.info(
            logger,
            'processing registry result',
            registryResult.action + ' ' + registryResult.record.id
          );
        } else {
          SXLogger.warn(
            logger,
            'processing registry skipped',
            registryResult.reason + ': ' + (previewResult.previewFilename || '[missing]')
          );
        }
      } catch (registryError) {
        SXLogger.warn(logger, 'processing registry write skipped', registryError.message);
      }

      var warnings = SXWarnings.list(warningCollector);

      for (var index = 0; index < warnings.length; index += 1) {
        SXLogger.warn(logger, 'warning', warnings[index]);
      }

      return {
        ok: true,
        filename: filenameResult.filename,
        variant: effectiveVariant,
        requestedVariant: requestedVariant || '',
        detectedVariant: detectedVariant,
        warnings: warnings,
        deletedColumns: transformResult.deletedColumns,
        highlightCount: transformResult.highlightCount,
        driveFileId: exportResult.fileId,
        downloadUrl: exportResult.downloadUrl,
        viewUrl: exportResult.viewUrl,
        previewSpreadsheetId: previewResult.spreadsheetId,
        previewUrl: previewResult.spreadsheetUrl,
        previewSheetId: previewResult.sheetId,
        previewSheetName: previewResult.sheetName
      };
    } catch (error) {
      throw this.normalizeError_(error);
    } finally {
      if (tempFileId) {
        SXCleanup.trashFileById(tempFileId, logger);
      }
    }
  },

  extractUploadFromForm_: function(formObject) {
    if (!formObject || !formObject[SXConfig.UPLOAD_FIELD_NAME]) {
      throw this.userError_('Upload one .xlsx workbook using the workbook field.');
    }

    var blob = formObject[SXConfig.UPLOAD_FIELD_NAME];
    if (!blob || typeof blob.getBytes !== 'function') {
      throw this.userError_('The uploaded workbook payload is invalid.');
    }

    var originalFilename = blob.getName() || 'workbook.xlsx';
    if (!/\.xlsx$/i.test(originalFilename)) {
      throw this.userError_('Only .xlsx files are supported.');
    }

    return {
      blob: blob.copyBlob(),
      originalFilename: originalFilename,
      size: blob.getBytes().length,
      formatterMode: formObject.formatterMode,
      previewSpreadsheetId: formObject.previewSpreadsheetId,
      batchFileCount: formObject.batchFileCount
    };
  },

  extractUploadFromPayload_: function(payload) {
    var filePayload = payload && payload.file;

    if (!filePayload || !filePayload.base64) {
      throw this.userError_('Upload one .xlsx workbook before processing.');
    }

    var originalFilename = String(filePayload.originalFilename || 'workbook.xlsx');
    if (!/\.xlsx$/i.test(originalFilename)) {
      throw this.userError_('Only .xlsx files are supported.');
    }

    var bytes;
    try {
      bytes = Utilities.base64Decode(String(filePayload.base64));
    } catch (error) {
      throw this.userError_('The uploaded workbook payload could not be decoded.');
    }

    var blob = Utilities.newBlob(
      bytes,
      filePayload.mimeType || SXConfig.MIME_TYPES.XLSX,
      originalFilename
    );

    return {
      blob: blob,
      originalFilename: originalFilename,
      size: Number(filePayload.size) || bytes.length,
      formatterMode: payload && payload.formatterMode,
      previewSpreadsheetId: payload && payload.previewSpreadsheetId,
      batchFileCount: payload && payload.batchFileCount
    };
  },

  normalizeUpload_: function(upload) {
    var formatterMode = SXWorkbookVariant.parseRequestedVariant(upload.formatterMode);
    if (upload.formatterMode && !formatterMode) {
      throw this.userError_('The selected formatter mode is not supported.');
    }

    var previewSpreadsheetId = upload.previewSpreadsheetId
      ? String(upload.previewSpreadsheetId).trim()
      : '';
    var batchFileCount = Math.max(1, Number(upload.batchFileCount) || 1);
    var size = Number(upload.size) || 0;

    if (!size) {
      throw this.userError_('The uploaded workbook is empty.');
    }

    if (size > SXConfig.MAX_UPLOAD_BYTES) {
      throw this.userError_(
        'The uploaded workbook is too large. The current limit is ' +
          Math.round(SXConfig.MAX_UPLOAD_BYTES / (1024 * 1024)) +
          'MB.'
      );
    }

    return {
      blob: upload.blob.copyBlob ? upload.blob.copyBlob() : upload.blob,
      originalFilename: upload.originalFilename,
      size: size,
      formatterMode: formatterMode,
      previewSpreadsheetId: previewSpreadsheetId,
      batchFileCount: batchFileCount
    };
  },

  discardPreviewSpreadsheet: function(previewSpreadsheetId) {
    var logger = SXLogger.create('SXPreviewCleanup');
    SXPreviewService.discardPreviewSpreadsheet(previewSpreadsheetId, logger);
    return {
      ok: true
    };
  },

  userError_: function(message) {
    var error = new Error(message);
    error.isUserError = true;
    return error;
  },

  normalizeError_: function(error) {
    if (error && error.isUserError) {
      return error;
    }

    if (error && error.message) {
      return new Error(error.message);
    }

    return new Error('Unexpected error processing workbook.');
  }
};
