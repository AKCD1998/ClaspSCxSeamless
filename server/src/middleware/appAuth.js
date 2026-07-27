const crypto = require('node:crypto');
const { env } = require('../config/env');
const { unauthorized } = require('../utils/apiError');

const EXEMPT_PATHS = ['/api/line/webhook', '/api/health'];

function isExempt(req) {
  return EXEMPT_PATHS.includes(req.path);
}

function normalizeBearerToken(value) {
  const text = String(value || '').trim();
  const match = text.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
}

function parseBasicCredentials(value) {
  const text = String(value || '').trim();
  const match = text.match(/^Basic\s+(.+)$/i);

  if (!match) {
    return null;
  }

  let decoded;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch (error) {
    return null;
  }

  const separatorIndex = decoded.indexOf(':');

  if (separatorIndex === -1) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function timingSafeEqualStrings(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

function appAuth(req, res, next) {
  if (!env.appBasicUser || !env.appBasicPassword) {
    next();
    return;
  }

  if (isExempt(req)) {
    next();
    return;
  }

  const bearerToken = normalizeBearerToken(req.headers.authorization);

  if (env.internalApiToken && bearerToken && timingSafeEqualStrings(bearerToken, env.internalApiToken)) {
    next();
    return;
  }

  const basicCredentials = parseBasicCredentials(req.headers.authorization);

  if (
    basicCredentials &&
    timingSafeEqualStrings(basicCredentials.username, env.appBasicUser) &&
    timingSafeEqualStrings(basicCredentials.password, env.appBasicPassword)
  ) {
    next();
    return;
  }

  res.set('WWW-Authenticate', 'Basic realm="ClaspSCxSeamless"');
  next(unauthorized('Authentication required.'));
}

module.exports = { appAuth };
