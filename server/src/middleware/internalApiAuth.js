const { env } = require('../config/env');
const { unauthorized } = require('../utils/apiError');

function normalizeBearerToken(value) {
  const text = String(value || '').trim();
  const match = text.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : '';
}

function internalApiAuth(req, res, next) {
  if (!env.internalApiToken) {
    next();
    return;
  }

  const token = normalizeBearerToken(req.headers.authorization);

  if (token !== env.internalApiToken) {
    next(unauthorized('Missing or invalid internal API token.'));
    return;
  }

  next();
}

module.exports = { internalApiAuth };
