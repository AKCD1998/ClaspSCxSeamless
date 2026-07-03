const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
});

function readBoolean(value, fallback = false) {
  if (typeof value === 'undefined' || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readIdentifier(value, fallback) {
  const normalized = String(value || fallback || '').trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new Error(`Invalid DB_SCHEMA value: ${normalized}`);
  }

  return normalized;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: readNumber(process.env.PORT, 3001),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  dbSchema: readIdentifier(process.env.DB_SCHEMA, 'clasp_scx_seamless'),
  healthFailOnDbError: readBoolean(process.env.HEALTH_FAIL_ON_DB_ERROR, false),
  internalApiToken: process.env.INTERNAL_API_TOKEN || '',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  storageDir: process.env.STORAGE_DIR || 'storage',
  pg: {
    host: process.env.PGHOST,
    port: readNumber(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  },
};

module.exports = { env };
