const crypto = require('node:crypto');
const { env } = require('../config/env');

const COOKIE_NAME = 'sx_session';

function maxAgeMs() {
  const days = Number.isFinite(env.sessionDays) && env.sessionDays > 0 ? env.sessionDays : 7;
  return days * 24 * 60 * 60 * 1000;
}

function sign(payload) {
  return crypto.createHmac('sha256', env.sessionSecret).update(payload).digest('hex');
}

// Session token is a plain `<expiresAtMs>.<hmac>` — there is only one shared login (no
// per-user identity to carry), so a stateless signed expiry is enough; no session table needed.
function createSessionToken() {
  const expiresAt = Date.now() + maxAgeMs();
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  const text = String(token || '');
  const separatorIndex = text.lastIndexOf('.');

  if (separatorIndex === -1) {
    return false;
  }

  const payload = text.slice(0, separatorIndex);
  const providedSignature = text.slice(separatorIndex + 1);
  const expectedSignature = sign(payload);

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return false;
  }

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

function cookieOptions() {
  const isProduction = env.nodeEnv === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: maxAgeMs(),
    path: '/',
  };
}

function setSessionCookie(res) {
  res.cookie(COOKIE_NAME, createSessionToken(), cookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

function hasValidSessionCookie(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  return Boolean(token) && verifySessionToken(token);
}

module.exports = {
  COOKIE_NAME,
  clearSessionCookie,
  hasValidSessionCookie,
  setSessionCookie,
};
