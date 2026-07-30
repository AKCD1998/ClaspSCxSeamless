const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');

// Deliberately point at an unreachable address so this file never touches the real
// production database (server/.env has real Supabase credentials) — logOperation()
// swallows DB errors, so the webhook handler still responds correctly either way.
process.env.SC_OFFICIAL_SUPABASE_DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:1/line_notify_test_unreachable';
process.env.DATABASE_URL = process.env.SC_OFFICIAL_SUPABASE_DATABASE_URL;
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-access-token';
process.env.LINE_CHANNEL_SECRET = 'test-channel-secret';
process.env.LINE_TARGET_ID = 'test-target-id';

const { env } = require('../src/config/env');
const { createApp } = require('../src/app');
const { closePool } = require('../src/db/pool');
const { sendPrintNotification } = require('../src/services/lineNotifyService');

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

test('sendPrintNotification returns skipped without throwing when LINE env vars are missing', async () => {
  const originalToken = env.lineChannelAccessToken;
  const originalTarget = env.lineTargetId;
  env.lineChannelAccessToken = '';
  env.lineTargetId = '';

  try {
    const result = await sendPrintNotification(
      {
        attemptNo: 1,
        isReprint: false,
        printerName: 'Brother MFC-T4500DW',
        agentHost: '000-HQ',
        completedAt: new Date().toISOString(),
      },
      { filename: 'test.xlsx', reportDate: '20260430', branchCodes: '004' },
    );

    assert.equal(result.skipped, true);
    assert.ok(result.reason);
  } finally {
    env.lineChannelAccessToken = originalToken;
    env.lineTargetId = originalTarget;
  }
});

test('sendPrintNotification pushes a message when LINE is configured (fetch mocked)', async () => {
  const originalFetch = global.fetch;
  let capturedRequest = null;

  global.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return { ok: true, status: 200, text: async () => '' };
  };

  try {
    const result = await sendPrintNotification(
      {
        attemptNo: 2,
        isReprint: true,
        reprintReason: 'document_lost',
        printerName: 'Brother MFC-T4500DW',
        agentHost: '000-HQ',
        completedAt: new Date().toISOString(),
      },
      { filename: 'test.xlsx', reportDate: '20260430', branchCodes: '004' },
    );

    assert.equal(result.skipped, false);
    assert.equal(capturedRequest.url, 'https://api.line.me/v2/bot/message/push');
    assert.equal(capturedRequest.options.headers.Authorization, `Bearer ${env.lineChannelAccessToken}`);

    const body = JSON.parse(capturedRequest.options.body);
    assert.equal(body.to, env.lineTargetId);
    assert.equal(body.messages[0].type, 'flex');
    assert.match(body.messages[0].altText, /ปริ้นซ้ำ/);
    assert.match(JSON.stringify(body.messages[0].contents), /document_lost/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('POST /api/line/webhook rejects an invalid signature', async () => {
  const payload = JSON.stringify({
    events: [{ type: 'message', source: { groupId: 'C-should-not-be-used' } }],
  });

  const response = await fetch(`${baseUrl}/api/line/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-line-signature': 'bogus-signature' },
    body: payload,
  });

  assert.equal(response.status, 401);
});

test('POST /api/line/webhook accepts a valid signature and always answers 200', async () => {
  const payload = JSON.stringify({
    events: [{ type: 'join', source: { type: 'group', groupId: 'C1234567890abcdef' } }],
  });
  const signature = crypto.createHmac('sha256', env.lineChannelSecret).update(payload).digest('base64');

  const response = await fetch(`${baseUrl}/api/line/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-line-signature': signature },
    body: payload,
  });
  const responseBody = await response.json();

  assert.equal(response.status, 200);
  assert.equal(responseBody.ok, true);
});
