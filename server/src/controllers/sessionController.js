const crypto = require('node:crypto');
const { env } = require('../config/env');
const { badRequest, unauthorized } = require('../utils/apiError');
const { clearSessionCookie, hasValidSessionCookie, setSessionCookie } = require('../middleware/session');

function timingSafeEqualStrings(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

function login(req, res) {
  const username = String((req.body && req.body.username) || '').trim();
  const password = String((req.body && req.body.password) || '');

  if (!username || !password) {
    throw badRequest('Username and password are required.');
  }

  if (!env.appBasicUser || !env.appBasicPassword) {
    res.json({ ok: true });
    return;
  }

  if (!timingSafeEqualStrings(username, env.appBasicUser) || !timingSafeEqualStrings(password, env.appBasicPassword)) {
    throw unauthorized('Incorrect username or password.');
  }

  setSessionCookie(res);
  res.json({ ok: true });
}

function logout(req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
}

function getSession(req, res) {
  const authRequired = Boolean(env.appBasicUser && env.appBasicPassword);

  res.json({
    authenticated: !authRequired || hasValidSessionCookie(req),
  });
}

module.exports = { getSession, login, logout };
