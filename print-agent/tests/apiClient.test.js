const assert = require('node:assert/strict');
const test = require('node:test');
const { createApiClient } = require('../src/apiClient');

test.afterEach(() => {
  delete global.fetch;
});

test('getPrintQueue sends a bearer token and unwraps the queue array', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ queue: [{ processingRecordId: 'abc' }] }), { status: 200 });
  };

  const api = createApiClient({ apiBaseUrl: 'http://api.test.local/', internalApiToken: 'secret-token' });
  const queue = await api.getPrintQueue();

  assert.equal(calls[0].url, 'http://api.test.local/api/agent/print-queue');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(queue, [{ processingRecordId: 'abc' }]);
});

test('getPrintQueue returns [] when the response has no queue field', async () => {
  global.fetch = async () => new Response(JSON.stringify({}), { status: 200 });

  const api = createApiClient({ apiBaseUrl: 'http://api.test.local', internalApiToken: 'secret-token' });
  const queue = await api.getPrintQueue();

  assert.deepEqual(queue, []);
});

test('requests throw with the backend error message on non-2xx responses', async () => {
  global.fetch = async () => new Response(
    JSON.stringify({ error: { message: 'No token provided.' } }),
    { status: 401 },
  );

  const api = createApiClient({ apiBaseUrl: 'http://api.test.local', internalApiToken: '' });

  await assert.rejects(() => api.getPrintQueue(), /No token provided/);
});

test('createPrintJob posts the job payload and returns the created job', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ job: { id: 'job-1', status: 'queued' } }), { status: 201 });
  };

  const api = createApiClient({ apiBaseUrl: 'http://api.test.local', internalApiToken: 'secret-token' });
  const job = await api.createPrintJob({ processingRecordId: 'abc', agentHost: '000-HQ' });

  assert.equal(calls[0].url, 'http://api.test.local/api/agent/print-jobs');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { processingRecordId: 'abc', agentHost: '000-HQ' });
  assert.deepEqual(job, { id: 'job-1', status: 'queued' });
});

test('downloadFile throws a clear error on a failed download', async () => {
  global.fetch = async () => new Response('not found', { status: 404 });

  const api = createApiClient({ apiBaseUrl: 'http://api.test.local', internalApiToken: 'secret-token' });

  await assert.rejects(() => api.downloadFile('http://api.test.local/api/files/x/download'), /HTTP 404/);
});
