var SXProcessingRegistryGateway = {
  initProcessingRegistry: function() {
    if (!this.isRemoteEnabled_()) {
      return SXProcessingRegistryService.initProcessingRegistry();
    }

    return {
      mode: 'render_api',
      backendUrl: this.resolveApiBaseUrl_(),
      headers: SXProcessingRegistryService.HEADERS.slice()
    };
  },

  createProcessingRecord: function(record) {
    if (!this.isRemoteEnabled_()) {
      return SXProcessingRegistryService.createProcessingRecord(record);
    }

    return this.requestJson_('post', '/processing-records', record || {}).record;
  },

  updateProcessingRecord: function(id, patch) {
    if (!this.isRemoteEnabled_()) {
      return SXProcessingRegistryService.updateProcessingRecord(id, patch);
    }

    return this.requestJson_(
      'patch',
      '/processing-records/' + encodeURIComponent(id),
      patch || {}
    ).record;
  },

  findProcessingRecordByFilename: function(filename) {
    if (!this.isRemoteEnabled_()) {
      return SXProcessingRegistryService.findProcessingRecordByFilename(filename);
    }

    var records = this.listProcessingRecords({
      filename: filename,
      limit: 1
    });

    return records.length ? records[0] : null;
  },

  parsePreviewFilename: function(filename) {
    return SXProcessingRegistryService.parsePreviewFilename(filename);
  },

  listProcessingRecords: function(filters) {
    if (!this.isRemoteEnabled_()) {
      return SXProcessingRegistryService.listProcessingRecords(filters || {});
    }

    return this.requestJson_('get', '/processing-records', null, filters || {}).records || [];
  },

  upsertProcessingRecordFromPreview: function(options) {
    if (!this.isRemoteEnabled_()) {
      return SXProcessingRegistryService.upsertProcessingRecordFromPreview(options);
    }

    return this.requestJson_('post', '/processing-records/upsert-preview', options || {});
  },

  markPrinted: function(id, printedBy) {
    if (!this.isRemoteEnabled_()) {
      return SXProcessingRegistryService.markPrinted(id, printedBy);
    }

    return this.requestJson_(
      'post',
      '/processing-records/' + encodeURIComponent(id) + '/mark-printed',
      {
        printedBy: printedBy || ''
      }
    ).record;
  },

  markUnprinted: function(id) {
    if (!this.isRemoteEnabled_()) {
      return SXProcessingRegistryService.markUnprinted(id);
    }

    return this.requestJson_(
      'post',
      '/processing-records/' + encodeURIComponent(id) + '/mark-unprinted',
      {}
    ).record;
  },

  isRemoteEnabled_: function() {
    return this.normalizeString_(this.resolveApiBaseUrl_()) !== '';
  },

  resolveApiBaseUrl_: function() {
    return (
      this.normalizeString_(SXConfig.PERN_API_BASE_URL) ||
      this.normalizeString_(
        PropertiesService.getScriptProperties().getProperty(
          SXConfig.PERN_API_BASE_URL_PROPERTY_KEY
        )
      )
    ).replace(/\/+$/, '');
  },

  resolveApiToken_: function() {
    return (
      this.normalizeString_(SXConfig.PERN_API_TOKEN) ||
      this.normalizeString_(
        PropertiesService.getScriptProperties().getProperty(SXConfig.PERN_API_TOKEN_PROPERTY_KEY)
      )
    );
  },

  requestJson_: function(method, routePath, body, query) {
    var url = this.buildUrl_(routePath, query);
    var options = {
      method: String(method || 'get').toUpperCase(),
      contentType: 'application/json',
      headers: {
        Accept: 'application/json'
      },
      muteHttpExceptions: true
    };
    var token = this.resolveApiToken_();

    if (token) {
      options.headers.Authorization = 'Bearer ' + token;
    }

    if (body !== null && typeof body !== 'undefined') {
      options.payload = JSON.stringify(body);
    }

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var contentText = response.getContentText() || '';
    var payload = {};

    if (contentText) {
      try {
        payload = JSON.parse(contentText);
      } catch (error) {
        throw new Error('Remote registry API returned invalid JSON (' + statusCode + ').');
      }
    }

    if (statusCode >= 200 && statusCode < 300) {
      return payload;
    }

    throw new Error(
      (payload && payload.error && payload.error.message) ||
        ('Remote registry API request failed with HTTP ' + statusCode + '.')
    );
  },

  buildUrl_: function(routePath, query) {
    var url = this.resolveApiBaseUrl_() + '/api' + routePath;
    var parts = [];
    var key;

    for (key in (query || {})) {
      if (!Object.prototype.hasOwnProperty.call(query, key)) {
        continue;
      }

      var value = query[key];
      if (value === null || typeof value === 'undefined' || String(value).trim() === '') {
        continue;
      }

      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    }

    if (parts.length) {
      url += '?' + parts.join('&');
    }

    return url;
  },

  normalizeString_: function(value) {
    if (value === null || typeof value === 'undefined') {
      return '';
    }

    return String(value).trim();
  }
};
