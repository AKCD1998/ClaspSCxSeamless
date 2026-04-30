import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
let vite;
let originalFetch;

test.before(async () => {
  process.env.VITE_API_BASE_URL = 'http://api.test.local/api';
  originalFetch = globalThis.fetch;
  vite = await createServer({
    root: clientRoot,
    logLevel: 'silent',
    server: {
      middlewareMode: true,
    },
    appType: 'custom',
  });
});

test.after(async () => {
  globalThis.fetch = originalFetch;
  if (vite) {
    await vite.close();
  }
});

test('getBootstrap calls the configured backend URL', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        appName: 'Seamless X GAS Excel Formatter',
        maxUploadMb: 20,
        retentionHours: 12,
        maxBatchFiles: 20,
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getBootstrap();

  assert.equal(calls[0].url, 'http://api.test.local/api/bootstrap');
  assert.equal(payload.maxUploadMb, 20);
});

test('API errors surface backend error messages', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      error: {
        message: 'Backend validation failed.',
        code: 'BAD_REQUEST',
      },
    }),
    { status: 400 },
  );

  const api = await vite.ssrLoadModule('/src/services/api.js');

  await assert.rejects(
    () => api.getBootstrap(),
    /Backend validation failed/,
  );
});

test('processWorkbookPayload sends multipart form data and unwraps first success', async () => {
  if (typeof File === 'undefined') {
    return;
  }

  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        ok: true,
        successes: [
          {
            ok: true,
            filename: '2026-04-30-001-02 indiv exp.xlsx',
            previewSpreadsheetId: 'preview-id',
            previewUrl: 'http://api.test.local/api/files/preview-id/download',
          },
        ],
        failures: [],
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const result = await api.processWorkbookPayload({
    file: new File(['xlsx'], 'source.xlsx'),
    formatterMode: 'individual',
    batchFileCount: 1,
  });

  assert.equal(calls[0].url, 'http://api.test.local/api/workbooks/process');
  assert.equal(calls[0].options.method, 'POST');
  assert.ok(calls[0].options.body instanceof FormData);
  assert.equal(result.previewSpreadsheetId, 'preview-id');
});

test('processWorkbookPayload rejects non-File values before network calls', async () => {
  const api = await vite.ssrLoadModule('/src/services/api.js');

  await assert.rejects(
    () => api.processWorkbookPayload({ file: { name: 'source.xlsx' } }),
    /File object/,
  );
});
