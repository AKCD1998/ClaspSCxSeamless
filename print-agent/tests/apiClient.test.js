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
  assert.deepEqual(Object.keys(calls[0].options.headers).sort(), ['Authorization','Content-Type']);
});

test('accounting transport exposes callable claim/event/download/preview methods with layout metadata', async () => {
  const calls=[];
  global.fetch=async(url,options)=>{
    calls.push({url,options});
    return url.endsWith('/original')?new Response('PDF bytes'):new Response(JSON.stringify({ok:true,work:null}));
  };
  const api=createApiClient({apiBaseUrl:'https://example.invalid',internalApiToken:'test-only'});
  await api.claimBatchWork({protocol:1,agentHost:'FAKE',printerName:'FAKE'});
  await api.batchEvent('item',{token:'claim',event:'heartbeat'});
  const bytes=await api.downloadBatchFile('/api/agent/accounting-print-batches/b/items/i/original');
  const layout={version:'shopee-a4-landscape-reference-v2',columns:['หมายเลขคำสั่งซื้อ']};
  await api.uploadBatchPreview('item','claim',bytes,layout);
  assert.equal(calls.length,4);
  assert.match(calls[0].url,/\/claim$/);
  assert.deepEqual(Object.keys(calls[0].options.headers).sort(),['Authorization','Content-Type']);
  assert.equal(calls[2].options.redirect,'error');
  assert.equal(calls[3].options.body.get('token'),'claim');
  assert.deepEqual(JSON.parse(calls[3].options.body.get('printLayout')),layout);
  await assert.rejects(api.downloadBatchFile('https://elsewhere.invalid/file'));
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
