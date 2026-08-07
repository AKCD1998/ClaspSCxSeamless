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

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: readNumber(process.env.PORT, 3001),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  databaseUrl: firstNonEmpty(
    process.env.SC_OFFICIAL_SUPABASE_DATABASE_URL,
    process.env.DATABASE_URL,
  ),
  dbSchema: readIdentifier(
    firstNonEmpty(process.env.SEAMLESS_DB_SCHEMA, process.env.DB_SCHEMA),
    'clasp_scx_seamless',
  ),
  healthFailOnDbError: readBoolean(process.env.HEALTH_FAIL_ON_DB_ERROR, false),
  internalApiToken: process.env.INTERNAL_API_TOKEN || '',
  // SEAMLESS_-prefixed variants are accepted ahead of the eventual shared-backend port (see
  // docs on that plan) — env vars have already been provisioned under that prefix on Render.
  // Bare name still wins if both happen to be set, matching the SEAMLESS_DB_SCHEMA precedent
  // below.
  appBasicUser: firstNonEmpty(process.env.APP_BASIC_USER, process.env.SEAMLESS_APP_BASIC_USER),
  appBasicPassword: firstNonEmpty(
    process.env.APP_BASIC_PASSWORD,
    process.env.SEAMLESS_APP_BASIC_PASSWORD,
  ),
  sessionSecret: firstNonEmpty(
    process.env.SESSION_SECRET,
    process.env.INTERNAL_API_TOKEN,
    process.env.APP_BASIC_PASSWORD,
    process.env.SEAMLESS_APP_BASIC_PASSWORD,
  ),
  sessionDays: readNumber(process.env.SESSION_DAYS, 7),
  autoPrintSince: process.env.AUTO_PRINT_SINCE || '',
  lineChannelAccessToken: firstNonEmpty(
    process.env.LINE_CHANNEL_ACCESS_TOKEN,
    process.env.SEAMLESS_LINE_CHANNEL_ACCESS_TOKEN,
  ),
  lineChannelSecret: firstNonEmpty(
    process.env.LINE_CHANNEL_SECRET,
    process.env.SEAMLESS_LINE_CHANNEL_SECRET,
  ),
  lineTargetId: firstNonEmpty(process.env.LINE_TARGET_ID, process.env.SEAMLESS_LINE_TARGET_ID),
  // Falls back to Render's own auto-injected RENDER_EXTERNAL_URL so download/view URLs come out
  // absolute without needing a dedicated env var — see fileStorageService.js buildApiUrl.
  publicBaseUrl: firstNonEmpty(
    process.env.PUBLIC_BASE_URL,
    process.env.SEAMLESS_PUBLIC_BASE_URL,
    process.env.RENDER_EXTERNAL_URL,
  ),
  storageDir: firstNonEmpty(process.env.STORAGE_DIR, process.env.SEAMLESS_STORAGE_DIR, 'storage'),
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || '',
  docsRecipientEmail: firstNonEmpty(
    process.env.DOCS_RECIPIENT_EMAIL,
    process.env.SEAMLESS_DOCS_RECIPIENT_EMAIL,
  ),
  r2: {
    endpoint: process.env.R2_ENDPOINT || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    keyPrefix: process.env.R2_KEY_PREFIX || 'clasp-scx-seamless',
    forcePathStyle: readBoolean(process.env.R2_FORCE_PATH_STYLE, false),
  },
  pg: {
    host: process.env.PGHOST,
    port: readNumber(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  },
};

module.exports = { env };
