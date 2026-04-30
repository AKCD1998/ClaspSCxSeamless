var SXDriveConversion = {
  convertUploadBlobToSpreadsheet: function(blob, originalFilename, logger) {
    var folder = SXCleanup.getWorkspaceFolder(logger);
    var safeBaseName = SXNormalize.sanitizeBaseName(originalFilename);
    var tempName = 'tmp-' + safeBaseName + '-' + Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyyMMdd-HHmmss'
    );
    var uploadBlob = blob.copyBlob();

    uploadBlob.setName(originalFilename || (safeBaseName + '.xlsx'));
    uploadBlob.setContentType(uploadBlob.getContentType() || SXConfig.MIME_TYPES.XLSX);

    var convertedFile = this.importWorkbookAsSpreadsheet_(
      uploadBlob,
      tempName,
      folder.getId()
    );

    SXLogger.info(logger, 'temporary spreadsheet id', convertedFile.id);

    return {
      spreadsheetId: convertedFile.id,
      tempFileId: convertedFile.id,
      workspaceFolderId: folder.getId(),
      spreadsheet: this.waitForSpreadsheet_(convertedFile.id)
    };
  },

  waitForSpreadsheet_: function(spreadsheetId) {
    var attempt = 0;
    var lastError = null;

    while (attempt < 10) {
      try {
        return SpreadsheetApp.openById(spreadsheetId);
      } catch (error) {
        lastError = error;
        Utilities.sleep(500);
      }

      attempt += 1;
    }

    throw new Error('Uploaded workbook conversion did not become available in time: ' + lastError);
  },

  importWorkbookAsSpreadsheet_: function(blob, fileName, folderId) {
    var response = this.performMultipartUpload_(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents',
      {
        name: fileName,
        mimeType: SXConfig.MIME_TYPES.GOOGLE_SHEET,
        parents: [folderId]
      },
      blob
    );

    return response;
  },

  performMultipartUpload_: function(url, metadata, blob) {
    var boundary = 'sx-gas-' + new Date().getTime();
    var contentType = blob.getContentType() || 'application/octet-stream';
    var prefix =
      '--' +
      boundary +
      '\r\n' +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      '\r\n' +
      '--' +
      boundary +
      '\r\n' +
      'Content-Type: ' +
      contentType +
      '\r\n\r\n';
    var suffix = '\r\n--' + boundary + '--';
    var payload = Utilities.newBlob(prefix).getBytes()
      .concat(blob.getBytes())
      .concat(Utilities.newBlob(suffix).getBytes());
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'multipart/related; boundary=' + boundary,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      payload: payload,
      muteHttpExceptions: true
    });
    var responseCode = response.getResponseCode();

    if (responseCode >= 300) {
      throw new Error(
        'Drive conversion upload failed with status ' +
          responseCode +
          ': ' +
          response.getContentText()
      );
    }

    return JSON.parse(response.getContentText());
  }
};
