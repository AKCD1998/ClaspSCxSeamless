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

test('processWorkbookPayload surfaces duplicate-upload failures from backend payloads', async () => {
  if (typeof File === 'undefined') {
    return;
  }

  globalThis.fetch = async () => new Response(
    JSON.stringify({
      ok: false,
      successes: [],
      failures: [
        {
          fileName: 'source.xlsx',
          message: 'This workbook was already uploaded previously.',
          code: 'DUPLICATE_UPLOAD',
          details: {
            existingGeneratedFileId: 'existing-file-id',
          },
        },
      ],
    }),
    { status: 409 },
  );

  const api = await vite.ssrLoadModule('/src/services/api.js');

  await assert.rejects(
    () => api.processWorkbookPayload({
      file: new File(['xlsx'], 'source.xlsx'),
      formatterMode: 'individual',
    }),
    (error) => {
      assert.equal(error.message, 'This workbook was already uploaded previously.');
      assert.equal(error.code, 'DUPLICATE_UPLOAD');
      assert.equal(error.details.existingGeneratedFileId, 'existing-file-id');
      return true;
    },
  );
});

test('getPharmcareInbox builds a query string from filters and returns the payload', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        documents: [{ id: 'doc-1', documentType: 'e_credit_invoice' }],
        nextCursor: null,
        summary: { autoClassified: 1, conflict: 0, duplicate: 0, manualReview: 0 },
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getPharmcareInbox({ documentType: 'e_credit_invoice', status: 'auto_classified' });

  assert.equal(
    calls[0].url,
    'http://api.test.local/api/app/pharmcare/inbox?documentType=e_credit_invoice&status=auto_classified',
  );
  assert.equal(payload.documents.length, 1);
});

test('getPharmcareInbox omits the query string when no filters are set', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ documents: [], nextCursor: null, summary: null }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  await api.getPharmcareInbox({});

  assert.equal(calls[0].url, 'http://api.test.local/api/app/pharmcare/inbox');
});

test('getPharmcareMessage fetches a single message by id', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: 'msg-1', attachments: [], documents: [] }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.getPharmcareMessage('msg-1');

  assert.equal(calls[0].url, 'http://api.test.local/api/app/pharmcare/messages/msg-1');
  assert.equal(payload.id, 'msg-1');
});

test('getPharmcareAttachmentDownloadUrl builds the authenticated download proxy URL', async () => {
  const api = await vite.ssrLoadModule('/src/services/api.js');

  assert.equal(
    api.getPharmcareAttachmentDownloadUrl('att-1'),
    'http://api.test.local/api/app/pharmcare/attachments/att-1/download',
  );
});

test('fetchPharmcareAttachmentBlob fetches with credentials and returns the blob', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' }), { status: 200 });
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const blob = await api.fetchPharmcareAttachmentBlob('att-1');

  assert.equal(calls[0].url, 'http://api.test.local/api/app/pharmcare/attachments/att-1/download');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(blob.type, 'application/pdf');
});

test('fetchPharmcareAttachmentBlob surfaces backend error messages on failure', async () => {
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { message: 'Attachment content not found.' } }),
    { status: 404 },
  );

  const api = await vite.ssrLoadModule('/src/services/api.js');

  await assert.rejects(
    () => api.fetchPharmcareAttachmentBlob('att-missing'),
    (error) => {
      assert.equal(error.message, 'Attachment content not found.');
      assert.equal(error.status, 404);
      return true;
    },
  );
});

test('requestProcessingHistoryPrint posts requestedBy and reason to the request-print endpoint', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        ok: true,
        message: 'Reprint requested.',
        record: { id: 'record-id', printed: false },
        job: { id: 'job-id', status: 'queued', isReprint: true },
      }),
      { status: 200 },
    );
  };

  const api = await vite.ssrLoadModule('/src/services/api.js');
  const payload = await api.requestProcessingHistoryPrint('record-id', { reason: 'document_lost' });

  assert.equal(calls[0].url, 'http://api.test.local/api/app/processing-records/record-id/request-print');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { requestedBy: '', reason: 'document_lost' });
  assert.equal(payload.job.isReprint, true);
});
