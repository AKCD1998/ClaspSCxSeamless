const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const { createApp } = require('../src/app');
const { env } = require('../src/config/env');
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

function basicHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
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

test('when APP_BASIC_USER/APP_BASIC_PASSWORD are unset, the app stays open (default-off)', async () => {
  const originalUser = env.appBasicUser;
  const originalPassword = env.appBasicPassword;
  env.appBasicUser = '';
  env.appBasicPassword = '';

  try {
    const response = await fetch(`${baseUrl}/api/app/processing-records/00000000-0000-0000-0000-000000000000/request-print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // No credential supplied at all — if auth were enforced this would be 401, not 404.
    assert.equal(response.status, 404);
  } finally {
    env.appBasicUser = originalUser;
    env.appBasicPassword = originalPassword;
  }
});

test('with APP_BASIC_USER/APP_BASIC_PASSWORD set, requests without credentials are rejected with WWW-Authenticate', async () => {
  const originalUser = env.appBasicUser;
  const originalPassword = env.appBasicPassword;
  env.appBasicUser = 'test-user';
  env.appBasicPassword = 'test-password';

  try {
    const response = await fetch(`${baseUrl}/api/app/processing-records`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error.code, 'UNAUTHORIZED');
    assert.match(response.headers.get('www-authenticate') || '', /Basic/);
  } finally {
    env.appBasicUser = originalUser;
    env.appBasicPassword = originalPassword;
  }
});

test('correct Basic credentials pass auth', async () => {
  const originalUser = env.appBasicUser;
  const originalPassword = env.appBasicPassword;
  env.appBasicUser = 'test-user';
  env.appBasicPassword = 'test-password';

  try {
    const response = await fetch(
      `${baseUrl}/api/app/processing-records/00000000-0000-0000-0000-000000000000/request-print`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: basicHeader('test-user', 'test-password'),
        },
        body: JSON.stringify({}),
      },
    );

    // Passed auth, reached the controller, then 404'd on the fake record id — not 401.
    assert.equal(response.status, 404);
  } finally {
    env.appBasicUser = originalUser;
    env.appBasicPassword = originalPassword;
  }
});

test('incorrect Basic credentials are rejected', async () => {
  const originalUser = env.appBasicUser;
  const originalPassword = env.appBasicPassword;
  env.appBasicUser = 'test-user';
  env.appBasicPassword = 'test-password';

  try {
    const response = await fetch(`${baseUrl}/api/app/processing-records`, {
      headers: { Authorization: basicHeader('test-user', 'wrong-password') },
    });

    assert.equal(response.status, 401);
  } finally {
    env.appBasicUser = originalUser;
    env.appBasicPassword = originalPassword;
  }
});

test('a valid Bearer INTERNAL_API_TOKEN also passes auth (print-agent keeps working)', async () => {
  const originalUser = env.appBasicUser;
  const originalPassword = env.appBasicPassword;
  const originalToken = env.internalApiToken;
  env.appBasicUser = 'test-user';
  env.appBasicPassword = 'test-password';
  env.internalApiToken = 'agent-bearer-token';

  try {
    const response = await fetch(
      `${baseUrl}/api/files/00000000-0000-0000-0000-000000000000/download`,
      {
        headers: { Authorization: 'Bearer agent-bearer-token' },
      },
    );

    // Passed auth, reached the controller, then 404'd on the fake file id — not 401.
    assert.equal(response.status, 404);
  } finally {
    env.appBasicUser = originalUser;
    env.appBasicPassword = originalPassword;
    env.internalApiToken = originalToken;
  }
});

test('/api/health is exempt from auth even when credentials are required', async () => {
  const originalUser = env.appBasicUser;
  const originalPassword = env.appBasicPassword;
  env.appBasicUser = 'test-user';
  env.appBasicPassword = 'test-password';

  try {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
  } finally {
    env.appBasicUser = originalUser;
    env.appBasicPassword = originalPassword;
  }
});

test('/api/line/webhook is exempt from appAuth (a correctly HMAC-signed request still succeeds with no Basic/Bearer credential)', async () => {
  const originalUser = env.appBasicUser;
  const originalPassword = env.appBasicPassword;
  const originalSecret = env.lineChannelSecret;
  env.appBasicUser = 'test-user';
  env.appBasicPassword = 'test-password';
  env.lineChannelSecret = 'test-secret-for-appauth-exempt-check';

  try {
    // Empty events array — the webhook loop never runs, so this never touches operation_logs.
    const payload = JSON.stringify({ events: [] });
    const signature = crypto.createHmac('sha256', env.lineChannelSecret).update(payload).digest('base64');

    const response = await fetch(`${baseUrl}/api/line/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-line-signature': signature },
      body: payload,
    });

    // No Basic/Bearer credential was sent at all, yet the request succeeded — proving
    // appAuth exempted this path rather than the webhook's own check happening to pass.
    assert.equal(response.status, 200);
  } finally {
    env.appBasicUser = originalUser;
    env.appBasicPassword = originalPassword;
    env.lineChannelSecret = originalSecret;
  }
});

test('the React SPA shell also requires auth when enabled', async () => {
  const originalUser = env.appBasicUser;
  const originalPassword = env.appBasicPassword;
  env.appBasicUser = 'test-user';
  env.appBasicPassword = 'test-password';

  try {
    const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });
    assert.equal(response.status, 401);
  } finally {
    env.appBasicUser = originalUser;
    env.appBasicPassword = originalPassword;
  }
});
