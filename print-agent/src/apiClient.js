function buildHeaders(token, extra) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

async function requestJson(url, options, token) {
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(token, options && options.headers),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = (payload && payload.error && payload.error.message) || `Request failed with HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function createApiClient({ apiBaseUrl, internalApiToken }) {
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');

  return {
    async getPrintQueue() {
      const payload = await requestJson(`${base}/api/agent/print-queue`, { method: 'GET' }, internalApiToken);
      return (payload && payload.queue) || [];
    },

    async createPrintJob(body) {
      const payload = await requestJson(
        `${base}/api/agent/print-jobs`,
        { method: 'POST', body: JSON.stringify(body) },
        internalApiToken,
      );
      return payload && payload.job;
    },

    async updatePrintJob(id, patch) {
      const payload = await requestJson(
        `${base}/api/agent/print-jobs/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        internalApiToken,
      );
      return payload && payload.job;
    },

    async completePrintJob(id) {
      return requestJson(
        `${base}/api/agent/print-jobs/${encodeURIComponent(id)}/complete`,
        { method: 'POST', body: JSON.stringify({}) },
        internalApiToken,
      );
    },

    async downloadFile(url) {
      const response = await fetch(url, {
        headers: internalApiToken ? { Authorization: `Bearer ${internalApiToken}` } : {},
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: HTTP ${response.status}`);
      }

      return Buffer.from(await response.arrayBuffer());
    },
  };
}

module.exports = { createApiClient };
