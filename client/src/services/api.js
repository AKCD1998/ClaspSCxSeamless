function resolveDefaultApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:3001/api';
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || resolveDefaultApiBaseUrl()).replace(/\/+$/, '');

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Backend returned an unreadable response.');
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    // The backend now (usually) lives on a different origin than this client (a separate
    // Render static site, sharing the backend's already-paid web service instead of a second
    // one). Browser-native HTTP Basic Auth is only attached to cross-origin requests when
    // credentials are explicitly included — the fetch default ('same-origin') would silently
    // drop it, making protected Seamless calls (/api/app/*, /api/files/*, /api/workbooks/*,
    // /api/bootstrap) return 401 forever after the login prompt. The backend's CORS config
    // already allows credentials for known origins (CORS_ORIGIN env var), so this is safe.
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });
  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.failures?.[0]?.message ||
      payload?.message ||
      `Request failed with HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.error?.code || payload?.failures?.[0]?.code;
    error.details = payload?.error?.details || payload?.failures?.[0]?.details;
    throw error;
  }

  return payload;
}

function appendOptional(formData, key, value) {
  if (value !== null && typeof value !== 'undefined' && value !== '') {
    formData.append(key, String(value));
  }
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function getBootstrap() {
  return requestJson('/bootstrap');
}

export async function processWorkbookPayload(payload) {
  const file = payload?.file;

  if (!(file instanceof File)) {
    throw new Error('Workbook upload requires a browser File object.');
  }

  const formData = new FormData();
  formData.append('file', file, file.name);
  appendOptional(formData, 'formatterMode', payload.formatterMode);
  appendOptional(formData, 'previewWorkbookId', payload.previewSpreadsheetId || payload.previewWorkbookId);
  appendOptional(formData, 'batchId', payload.batchId);
  appendOptional(formData, 'batchFileCount', payload.batchFileCount);

  const response = await requestJson('/workbooks/process', {
    method: 'POST',
    body: formData,
  });

  if (response?.successes?.length) {
    return response.successes[0];
  }

  if (response?.failures?.length) {
    throw new Error(response.failures[0].message || 'Workbook processing failed.');
  }

  throw new Error('Workbook processing returned no result.');
}

export async function fetchProcessingHistory(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value !== null && typeof value !== 'undefined' && value !== '') {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  const payload = await requestJson(`/app/processing-records${query ? `?${query}` : ''}`);

  return payload?.records || [];
}

export async function markProcessingHistoryPrinted(id, printedBy = '') {
  return requestJson(`/app/processing-records/${encodeURIComponent(id)}/mark-printed`, {
    method: 'POST',
    body: JSON.stringify({ printedBy }),
  });
}

export async function markProcessingHistoryUnprinted(id) {
  return requestJson(`/app/processing-records/${encodeURIComponent(id)}/mark-unprinted`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function requestProcessingHistoryPrint(id, options = {}) {
  return requestJson(`/app/processing-records/${encodeURIComponent(id)}/request-print`, {
    method: 'POST',
    body: JSON.stringify({
      requestedBy: options.requestedBy || '',
      reason: options.reason || '',
    }),
  });
}

export async function listProcessingRecords(params = {}) {
  return fetchProcessingHistory(params);
}

export async function sendGeneratedFileEmail(fileId, options = {}) {
  return requestJson(`/files/${encodeURIComponent(fileId)}/send-email`, {
    method: 'POST',
    body: JSON.stringify({ to: options.to || '' }),
  });
}
