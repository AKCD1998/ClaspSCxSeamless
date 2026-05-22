var SXRoutes = {
  doGet: function(e) {
    var template = HtmlService.createTemplateFromFile('src/client/Index');
    template.bootstrap = this.getClientBootstrap();

    var output = template
      .evaluate()
      .setTitle(SXConfig.APP_NAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');

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
