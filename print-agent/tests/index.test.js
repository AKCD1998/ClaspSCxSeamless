const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'print-agent-test-logs-'));
process.env.API_BASE_URL = 'http://api.test.local';
process.env.INTERNAL_API_TOKEN = 'secret-token';
process.env.PRINTER_NAME = 'Brother MFC-T4500DW';
process.env.AGENT_HOST = 'test-agent-host';
process.env.POLL_LOG_DIR = tempLogDir;

const { runOnce } = require('../src/index');
const lockFilePath = path.resolve(__dirname, '..', 'agent.lock');

test.afterEach(() => {
  delete global.fetch;
  try {
    fs.unlinkSync(lockFilePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
});

test.after(() => {
  fs.rmSync(tempLogDir, { recursive: true, force: true });
});

test('runOnce logs "nothing to print" and exits cleanly when the queue is empty', async () => {
  global.fetch = async () => new Response(JSON.stringify({ queue: [] }), { status: 200 });

  await assert.doesNotReject(() => runOnce({ dryRun: false }));
});

test('runOnce does not crash when the API is unreachable (fake/missing server)', async () => {
  global.fetch = async () => {
    throw new Error('fetch failed: ECONNREFUSED 127.0.0.1:1');
  };

  await assert.doesNotReject(() => runOnce({ dryRun: true }));
});

test('runOnce --dry-run logs the planned action per document without calling create/download/print APIs', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        queue: [
          {
            processingRecordId: 'record-1',
            filename: '2026-04-30-001-02 indiv exp.xlsx',
            downloadUrl: 'http://api.test.local/api/files/file-1/download',
            outputFileId: 'file-1',
          },
        ],
      }),
      { status: 200 },
    );
  };

  await assert.doesNotReject(() => runOnce({ dryRun: true }));

  // Only the initial GET /print-queue call should have happened — no job creation,
  // no download, no print job mutation — because dry-run must not touch real data.
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/agent\/print-queue$/);
});

test('runOnce skips a document gracefully (no crash, no download/print) when create-job returns 409', async () => {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });

    if (/\/api\/agent\/print-queue$/.test(url)) {
      return new Response(
        JSON.stringify({
          queue: [
            {
              processingRecordId: 'record-1',
              filename: '2026-04-30-001-02 indiv exp.xlsx',
              downloadUrl: 'http://api.test.local/api/files/file-1/download',
              outputFileId: 'file-1',
            },
          ],
        }),
        { status: 200 },
      );
    }

    if (/\/api\/agent\/print-jobs$/.test(url) && options && options.method === 'POST') {
      // Another caller already owns this record's print job — the backend's ownership fix.
      return new Response(
        JSON.stringify({ error: { code: 'CONFLICT', message: 'already owned by another caller' } }),
        { status: 409 },
      );
    }

    throw new Error(`Unexpected fetch call in this test: ${url}`);
  };

  // The key assertion: losing the ownership race must not throw out of runOnce (which would
  // abort processing of any remaining queue documents and exit the whole agent run non-zero) —
  // it must be treated as "skip this one, nothing to print" instead.
  await assert.doesNotReject(() => runOnce({ dryRun: false }));

  // Only the queue GET and the single rejected create-job POST should have happened — no
  // download, no updatePrintJob, no completePrintJob, because we never owned this job.
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/api\/agent\/print-queue$/);
  assert.match(calls[1].url, /\/api\/agent\/print-jobs$/);
});

test('acquireLock prevents two concurrent runOnce calls from both processing the same tick', async () => {
  let fetchCallCount = 0;
  global.fetch = async () => {
    fetchCallCount += 1;
    return new Response(JSON.stringify({ queue: [] }), { status: 200 });
  };

  await Promise.all([runOnce({ dryRun: true }), runOnce({ dryRun: true })]);

  assert.equal(fetchCallCount, 1);
});
