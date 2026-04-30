var SXExportService = {
  exportSpreadsheetToXlsxFile: function(spreadsheetId, outputFilename, logger) {
    var folder = SXCleanup.getWorkspaceFolder(logger);
    var exportBlob = this.exportSpreadsheetBlob_(spreadsheetId, outputFilename);
    var exportedFile = folder.createFile(exportBlob);

    // Future processing-history writes can use this return boundary as the
    // canonical source for exported-file Drive metadata.
    return {
      fileId: exportedFile.getId(),
      filename: outputFilename,
      downloadUrl: this.buildDownloadUrl(exportedFile.getId()),
      viewUrl: exportedFile.getUrl() || this.buildViewUrl(exportedFile.getId())
    };
  },

  exportSpreadsheetBlob_: function(spreadsheetId, outputFilename) {
    var exportUrl =
      'https://www.googleapis.com/drive/v3/files/' +
      encodeURIComponent(spreadsheetId) +
      '/export?mimeType=' +
      encodeURIComponent(SXConfig.MIME_TYPES.XLSX);
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() >= 300) {
      throw new Error('Drive export failed with status ' + response.getResponseCode() + '.');
    }

    return response.getBlob().setName(outputFilename);
  },

  buildDownloadUrl: function(fileId) {
    return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
  },

  buildViewUrl: function(fileId) {
    return 'https://drive.google.com/file/d/' + encodeURIComponent(fileId) + '/view';
  }
};
