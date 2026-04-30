var SXRoutes = {
  FAVICON_FILE_ID: '1oxON7uhCV0zoPspneBNOvYG9HvjAMIIk',

  getFaviconUrl_: function() {
    var props = PropertiesService.getScriptProperties();
    return props.getProperty('FAVICON_URL') ||
      'https://drive.google.com/uc?export=view&id=' + this.FAVICON_FILE_ID + '&type=.png';
  },

  doGet: function(e) {
    if (e && e.parameter && e.parameter.faviconDebug) {
      return ContentService
        .createTextOutput(this.getFaviconUrl_())
        .setMimeType(ContentService.MimeType.TEXT);
    }

    var template = HtmlService.createTemplateFromFile('src/client/Index');
    template.bootstrap = this.getClientBootstrap();

    var output = template
      .evaluate()
      .setTitle(SXConfig.APP_NAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

    try {
      output.setFaviconUrl(this.getFaviconUrl_());
    } catch (err) {
      console.warn('Skipping favicon:', err && err.message ? err.message : err);
    }

    return output;
  },

  include: function(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  },

  getClientBootstrap: function() {
    // Future history-table bootstrap data should be added here so the page can
    // render upload tools and history state from one server-rendered shell.
    return {
      appName: SXConfig.APP_NAME,
      maxUploadMb: Math.round(SXConfig.MAX_UPLOAD_BYTES / (1024 * 1024)),
      retentionHours: SXConfig.OUTPUT_RETENTION_HOURS,
      maxBatchFiles: SXConfig.MAX_BATCH_FILES
    };
  }
};
