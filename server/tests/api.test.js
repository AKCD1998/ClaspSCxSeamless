const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { closePool } = require('../src/db/pool');

let server;
let baseUrl;

function listen(app) {
  return new Promise((resolve) => {
    const startedServer = app.listen(0, '127.0.0.1', () => {
      const address = startedServer.address();
      resolve({
        server: startedServer,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function closeServer(startedServer) {
  return new Promise((resolve, reject) => {
    startedServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

test.before(async () => {
  const started = await listen(createApp());
  server = started.server;
  baseUrl = started.baseUrl;
});

test.after(async () => {
  if (server) {
    await closeServer(server);
  }
  await closePool().catch(() => {});
});

test('GET /api/bootstrap returns upload limits and supported modes', async () => {
  const response = await fetch(`${baseUrl}/api/bootstrap`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.appName, 'Seamless X GAS Excel Formatter');
  assert.equal(payload.maxUploadMb, 20);
  assert.equal(payload.maxBatchFiles, 20);
  assert.deepEqual(payload.formatterModes, ['individual', 'summary']);
});

test('GET /api/health returns a stable health envelope', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(payload.status, /^(ok|degraded)$/);
  assert.equal(payload.service, 'seamless-x-api');
  assert.ok(payload.database);
  assert.match(payload.database.status, /^(ok|unavailable)$/);
});

test('POST /api/workbooks/process rejects missing file uploads', async () => {
  const formData = new FormData();
  formData.append('formatterMode', 'individual');

  const response = await fetch(`${baseUrl}/api/workbooks/process`, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error.message, /At least one workbook file is required/i);
});

test('POST /api/workbooks/process validates workbook file extension', async () => {
  const formData = new FormData();
  formData.append('formatterMode', 'summary');
  formData.append('file', new Blob(['not an xlsx workbook']), 'notes.txt');

  const response = await fetch(`${baseUrl}/api/workbooks/process`, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json();
  const message = payload.error?.message || payload.failures?.[0]?.message || '';

  assert.equal(response.status, 400);
  assert.match(message, /Only \.xlsx files are supported/i);
});
