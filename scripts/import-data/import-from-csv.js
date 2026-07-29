#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { searchPathOption, tables } = require('../../server/src/db/identifiers');

try {
  require('dotenv').config({
    path: path.resolve(__dirname, '../../server/.env'),
    quiet: true,
  });
} catch (error) {
  // dotenv is optional for this utility; environment variables may already be set.
}

const REGISTRY_HEADERS = [
  'id',
  'reportDate',
  'reportType',
  'filename',
  'driveFileId',
  'driveFileUrl',
  'uploadedAt',
  'uploadedBy',
  'printed',
  'printedAt',
  'printedBy',
  'sourceUploadName',
  'notes',
  'createdAt',
  'updatedAt',
  'lastAction',
  'branchCodes',
];

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'y', 'on', 'printed', 'พิมพ์แล้ว']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'n', 'off', 'unprinted', '']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseArgs(argv) {
  const options = {
    registryCsv: '',
    registryJson: '',
    sourceName: '',
    registrySpreadsheetId: '',
    dryRun: true,
    allowUpdate: false,
    limit: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--registry-csv') {
      options.registryCsv = readRequiredValue(argv, index, arg);
      index += 1;
    } else if (arg === '--registry-json') {
      options.registryJson = readRequiredValue(argv, index, arg);
      index += 1;
    } else if (arg === '--source-name') {
      options.sourceName = readRequiredValue(argv, index, arg);
      index += 1;
    } else if (arg === '--registry-spreadsheet-id') {
      options.registrySpreadsheetId = readRequiredValue(argv, index, arg);
      index += 1;
    } else if (arg === '--limit') {
      options.limit = Number(readRequiredValue(argv, index, arg));
      index += 1;
    } else if (arg === '--commit') {
      options.dryRun = false;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--allow-update') {
      options.allowUpdate = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.registryCsv && !options.registryJson) {
    throw new Error('Missing required option: --registry-csv <path> or --registry-json <path>');
  }

  if (options.registryCsv && options.registryJson) {
    throw new Error('Use only one input source: --registry-csv or --registry-json');
  }

  if (options.limit && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }

  if (options.allowUpdate && options.dryRun) {
    console.warn('Warning: --allow-update has no write effect during dry-run.');
  }

  return options;
}

function readRequiredValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${arg} requires a value`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage:
  node scripts/import-data/import-from-csv.js --registry-csv <path> [options]
  node scripts/import-data/import-from-csv.js --registry-json <path> [options]

Options:
  --registry-csv <path>             ProcessingRegistry CSV export path
  --registry-json <path>            ProcessingRegistry JSON export path from GAS helper
  --source-name <name>              migration source label; defaults to CSV basename
  --registry-spreadsheet-id <id>    preserve legacy registry spreadsheet id
  --limit <n>                       process only first n data rows
  --dry-run                         validate and detect duplicates without writing (default)
  --commit                          write changes in a transaction
  --allow-update                    update duplicate processing_records instead of skipping
  --help                            show this help
`);
}

function buildPoolConfig() {
  const connectionString = process.env.SC_OFFICIAL_SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

  if (connectionString) {
    return {
      connectionString,
      options: `-c search_path=${searchPathOption}`,
    };
  }

  return {
    options: `-c search_path=${searchPathOption}`,
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(process.cwd(), options.registryCsv || options.registryJson);
  const sourceName = options.sourceName || path.basename(sourcePath);
  const parsedSource = await loadRegistrySource(options, sourcePath);
  const rows = options.limit ? parsedSource.rows.slice(0, options.limit) : parsedSource.rows;
  const pool = new Pool(buildPoolConfig());
  const client = await pool.connect();
  const summary = createSummary({
    sourceName,
    sourcePath,
    sourceType: parsedSource.sourceType,
    dryRun: options.dryRun,
    allowUpdate: options.allowUpdate,
  });

  let migrationLogId = null;

  try {
    if (!options.dryRun) {
      await client.query('BEGIN');
      migrationLogId = await createMigrationLog(client, sourceName, {
        sourcePath,
        sourceType: parsedSource.sourceType,
        registrySpreadsheetId: options.registrySpreadsheetId || null,
        allowUpdate: options.allowUpdate,
      });
    }

    for (const rawRow of rows) {
      summary.recordsRead += 1;
      const normalized = normalizeRegistryRow(rawRow, {
        sourceName,
        registrySpreadsheetId: options.registrySpreadsheetId,
      });

      mergeMessages(summary, normalized);

      if (normalized.errors.length > 0) {
        summary.recordsFailed += 1;
        continue;
      }

      summary.recordsValid += 1;
      await importRegistryRow(client, normalized, options, summary);
    }

    if (!options.dryRun) {
      await finishMigrationLog(client, migrationLogId, summary);
      await client.query('COMMIT');
    }

    printSummary(summary);
  } catch (error) {
    if (!options.dryRun) {
      await client.query('ROLLBACK');
    }
    summary.fatalError = error.message;
    printSummary(summary);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function createSummary({ sourceName, sourcePath, sourceType, dryRun, allowUpdate }) {
  return {
    sourceName,
    sourcePath,
    sourceType,
    dryRun,
    allowUpdate,
    recordsRead: 0,
    recordsValid: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    duplicatesFound: 0,
    generatedFilesCreated: 0,
    generatedFilesSkipped: 0,
    branchCodesInserted: 0,
    branchCodesSkipped: 0,
    warnings: [],
    errors: [],
    fatalError: '',
  };
}

async function loadRegistrySource(options, sourcePath) {
  const rawText = await fs.readFile(sourcePath, 'utf8');

  if (options.registryJson) {
    return parseRegistryJson(rawText);
  }

  const parsedCsv = parseCsv(rawText);
  validateHeaders(parsedCsv.headers);
  return {
    sourceType: 'csv',
    headers: parsedCsv.headers,
    rows: parsedCsv.rows,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(field);
      pushCsvRow(rows, row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    pushCsvRow(rows, row);
  }

  if (rows.length === 0) {
    throw new Error('CSV is empty');
  }

  const headers = rows[0].map((value, index) => {
    const normalized = index === 0 ? value.replace(/^\uFEFF/, '') : value;
    return normalized.trim();
  });

  const dataRows = rows.slice(1).map((values, rowIndex) => {
    const record = {};
    headers.forEach((header, headerIndex) => {
      record[header] = values[headerIndex] || '';
    });
    record.__rowNumber = rowIndex + 2;
    return record;
  });

  return {
    headers,
    rows: dataRows,
  };
}

function pushCsvRow(rows, row) {
  if (row.length === 1 && row[0].trim() === '') {
    return;
  }
  rows.push(row);
}

function validateHeaders(headers) {
  const missing = REGISTRY_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new Error(`ProcessingRegistry CSV is missing required headers: ${missing.join(', ')}`);
  }
}

function parseRegistryJson(text) {
  let payload;

  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`Registry JSON is invalid: ${error.message}`);
  }

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload && payload.rows)
      ? payload.rows
      : [];
  const headers = Array.isArray(payload && payload.headers)
    ? payload.headers
    : REGISTRY_HEADERS.slice();

  validateHeaders(headers);

  return {
    sourceType: 'json',
    headers,
    rows: rows.map((row, rowIndex) => {
      const record = {};

      headers.forEach((header) => {
        record[header] = row && Object.prototype.hasOwnProperty.call(row, header) ? row[header] : '';
      });

      record.__rowNumber = Number(row && row.__rowNumber) || rowIndex + 2;
      return record;
    }),
  };
}

function normalizeRegistryRow(row, context) {
  const warnings = [];
  const errors = [];
  const oldId = clean(row.id);
  const filename = clean(row.filename);
  const sourceUploadName = clean(row.sourceUploadName);
  const reportType = normalizeReportType(row.reportType);
  const dateResult = normalizeReportDate(row.reportDate, {
    filename,
    sourceUploadName,
    uploadedAt: row.uploadedAt,
  });
  const uploadedAt = normalizeTimestamp(row.uploadedAt, 'uploadedAt', warnings);
  const printedAt = normalizeTimestamp(row.printedAt, 'printedAt', warnings);
  const createdAt = normalizeTimestamp(row.createdAt, 'createdAt', warnings) || uploadedAt || new Date().toISOString();
  const updatedAt = normalizeTimestamp(row.updatedAt, 'updatedAt', warnings) || uploadedAt || createdAt;
  const printed = normalizeBoolean(row.printed, warnings);
  const branchCodes = normalizeBranchCodes(row.branchCodes, filename);

  warnings.push(...dateResult.warnings);

  if (!filename) {
    errors.push(rowMessage(row, 'filename is required'));
  }

  if (!reportType) {
    errors.push(rowMessage(row, `reportType must be individual or summary; got "${clean(row.reportType)}"`));
  }

  if (!dateResult.reportDateKey) {
    errors.push(rowMessage(row, `reportDate could not be normalized; got "${clean(row.reportDate)}"`));
  }

  if (!clean(row.driveFileId) && !clean(row.driveFileUrl)) {
    warnings.push('driveFileId and driveFileUrl are empty; generated_files legacy reference will be skipped');
  }

  return {
    rowNumber: row.__rowNumber,
    errors,
    warnings,
    data: {
      id: isUuid(oldId) ? oldId : null,
      legacyRegistryId: oldId || null,
      reportDateKey: dateResult.reportDateKey,
      reportDate: dateResult.reportDate,
      reportType,
      filename,
      legacyDriveFileId: clean(row.driveFileId) || null,
      legacyDriveFileUrl: clean(row.driveFileUrl) || null,
      uploadedAt,
      uploadedBy: clean(row.uploadedBy) || null,
      printed,
      printedAt: printed ? printedAt : null,
      printedBy: printed ? clean(row.printedBy) || null : null,
      sourceUploadName: sourceUploadName || null,
      notes: clean(row.notes) || null,
      createdAt,
      updatedAt,
      lastAction: clean(row.lastAction) || null,
      legacyBranchCodes: clean(row.branchCodes) || null,
      branchCodes,
      legacyRegistrySpreadsheetId: context.registrySpreadsheetId || null,
      legacyRegistrySheetName: 'ProcessingRegistry',
      legacyRowNumber: row.__rowNumber,
      migrationSource: context.sourceName,
      metadata: {
        importedFrom: 'ProcessingRegistry',
        originalId: oldId || null,
        originalReportDate: clean(row.reportDate) || null,
        originalPrinted: clean(row.printed) || null,
      },
    },
  };
}

function normalizeReportType(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === 'summary' || normalized === 'sum') {
    return 'summary';
  }
  if (normalized === 'individual' || normalized === 'indiv') {
    return 'individual';
  }
  return '';
}

function normalizeReportDate(value, context) {
  const warnings = [];
  const raw = clean(value);
  const candidates = [raw, context.filename, context.sourceUploadName, context.uploadedAt].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = parseDateKey(candidate);
    if (parsed.reportDateKey) {
      if (candidate !== raw) {
        warnings.push(`Row date fallback used "${candidate}" because reportDate was "${raw || '<empty>'}"`);
      }
      return parsed;
    }
  }

  const now = new Date();
  const fallbackKey = formatDateKey(now);
  warnings.push(`Row date fallback used current date ${fallbackKey} because reportDate was "${raw || '<empty>'}"`);
  return {
    reportDateKey: fallbackKey,
    reportDate: `${fallbackKey.slice(0, 4)}-${fallbackKey.slice(4, 6)}-${fallbackKey.slice(6, 8)}`,
    warnings,
  };
}

function parseDateKey(value) {
  const raw = clean(value);
  if (!raw) {
    return {};
  }

  const compactMatch = raw.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  if (compactMatch) {
    const key = `${compactMatch[1]}${compactMatch[2]}${compactMatch[3]}`;
    if (isValidDateKey(key)) {
      return dateKeyResult(key);
    }
  }

  const isoMatch = raw.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const key = `${isoMatch[1]}${isoMatch[2].padStart(2, '0')}${isoMatch[3].padStart(2, '0')}`;
    if (isValidDateKey(key)) {
      return dateKeyResult(key);
    }
  }

  const thaiStyleMatch = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (thaiStyleMatch) {
    let year = Number(thaiStyleMatch[3]);
    if (year > 2400) {
      year -= 543;
    }
    const key = `${year}${thaiStyleMatch[2].padStart(2, '0')}${thaiStyleMatch[1].padStart(2, '0')}`;
    if (isValidDateKey(key)) {
      return dateKeyResult(key);
    }
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.valueOf())) {
    return dateKeyResult(formatDateKey(date));
  }

  return {};
}

function dateKeyResult(key) {
  return {
    reportDateKey: key,
    reportDate: `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`,
    warnings: [],
  };
}

function isValidDateKey(key) {
  if (!/^\d{8}$/.test(key)) {
    return false;
  }
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(4, 6));
  const day = Number(key.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
}

function normalizeTimestamp(value, fieldName, warnings) {
  const raw = clean(value);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.valueOf())) {
    warnings.push(`${fieldName} is invalid and will be imported as null: "${raw}"`);
    return null;
  }
  return date.toISOString();
}

function normalizeBoolean(value, warnings) {
  const normalized = clean(value).toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }
  warnings.push(`printed value "${clean(value)}" is not recognized; imported as false`);
  return false;
}

function normalizeBranchCodes(value, filename) {
  const tokens = new Set();
  const combined = `${clean(value)} ${clean(filename)}`;
  const matches = combined.match(/\b\d{3}\b/g) || [];
  matches.forEach((match) => tokens.add(match));
  return Array.from(tokens).sort();
}

async function importRegistryRow(client, normalized, options, summary) {
  const existing = await findExistingProcessingRecord(client, normalized.data);

  if (existing) {
    summary.duplicatesFound += 1;

    if (!options.allowUpdate) {
      summary.recordsSkipped += 1;
      return;
    }

    if (!options.dryRun) {
      await updateProcessingRecord(client, existing.id, normalized.data);
      await insertBranchCodes(client, existing.id, normalized.data.branchCodes, summary);
      await insertGeneratedFileReference(client, existing.id, normalized.data, summary);
    }
    summary.recordsUpdated += 1;
    return;
  }

  if (options.dryRun) {
    summary.recordsCreated += 1;
    if (normalized.data.legacyDriveFileId || normalized.data.legacyDriveFileUrl) {
      summary.generatedFilesCreated += 1;
    }
    summary.branchCodesInserted += normalized.data.branchCodes.length;
    return;
  }

  const processingRecordId = await insertProcessingRecord(client, normalized.data);
  await insertBranchCodes(client, processingRecordId, normalized.data.branchCodes, summary);
  await insertGeneratedFileReference(client, processingRecordId, normalized.data, summary);
  summary.recordsCreated += 1;
}

async function findExistingProcessingRecord(client, data) {
  const conditions = [];
  const params = [];

  if (data.id) {
    params.push(data.id);
    conditions.push(`id = $${params.length}::uuid`);
  }

  if (data.legacyRegistryId) {
    params.push(data.legacyRegistryId);
    conditions.push(`legacy_registry_id = $${params.length}`);
  }

  if (data.filename) {
    params.push(data.filename);
    conditions.push(`filename = $${params.length}`);
  }

  if (conditions.length === 0) {
    return null;
  }

  const result = await client.query(
    `SELECT id, legacy_registry_id, filename
       FROM ${tables.processingRecords}
      WHERE ${conditions.join(' OR ')}
      ORDER BY updated_at DESC
      LIMIT 1`,
    params,
  );
  return result.rows[0] || null;
}

async function insertProcessingRecord(client, data) {
  const result = await client.query(
    `INSERT INTO ${tables.processingRecords} (
       id,
       legacy_registry_id,
       report_date_key,
       report_date,
       report_type,
       filename,
       legacy_drive_file_id,
       legacy_drive_file_url,
       uploaded_at,
       uploaded_by,
       printed,
       printed_at,
       printed_by,
       source_upload_name,
       notes,
       last_action,
       legacy_branch_codes,
       legacy_registry_spreadsheet_id,
       legacy_registry_sheet_name,
       legacy_row_number,
       migration_source,
       metadata,
       created_at,
       updated_at
     )
     VALUES (
       COALESCE($1::uuid, gen_random_uuid()),
       $2, $3, $4::date, $5, $6, $7, $8, $9::timestamptz, $10,
       $11, $12::timestamptz, $13, $14, $15, $16, $17, $18, $19,
       $20, $21, $22::jsonb, $23::timestamptz, $24::timestamptz
     )
     RETURNING id`,
    [
      data.id,
      data.legacyRegistryId,
      data.reportDateKey,
      data.reportDate,
      data.reportType,
      data.filename,
      data.legacyDriveFileId,
      data.legacyDriveFileUrl,
      data.uploadedAt,
      data.uploadedBy,
      data.printed,
      data.printedAt,
      data.printedBy,
      data.sourceUploadName,
      data.notes,
      data.lastAction,
      data.legacyBranchCodes,
      data.legacyRegistrySpreadsheetId,
      data.legacyRegistrySheetName,
      data.legacyRowNumber,
      data.migrationSource,
      JSON.stringify(data.metadata),
      data.createdAt,
      data.updatedAt,
    ],
  );
  return result.rows[0].id;
}

async function updateProcessingRecord(client, id, data) {
  await client.query(
    `UPDATE ${tables.processingRecords}
        SET legacy_registry_id = COALESCE($2, legacy_registry_id),
            report_date_key = $3,
            report_date = $4::date,
            report_type = $5,
            filename = $6,
            legacy_drive_file_id = $7,
            legacy_drive_file_url = $8,
            uploaded_at = $9::timestamptz,
            uploaded_by = $10,
            printed = $11,
            printed_at = $12::timestamptz,
            printed_by = $13,
            source_upload_name = $14,
            notes = $15,
            last_action = $16,
            legacy_branch_codes = $17,
            legacy_registry_spreadsheet_id = $18,
            legacy_registry_sheet_name = $19,
            legacy_row_number = $20,
            migration_source = $21,
            metadata = metadata || $22::jsonb
      WHERE id = $1::uuid`,
    [
      id,
      data.legacyRegistryId,
      data.reportDateKey,
      data.reportDate,
      data.reportType,
      data.filename,
      data.legacyDriveFileId,
      data.legacyDriveFileUrl,
      data.uploadedAt,
      data.uploadedBy,
      data.printed,
      data.printedAt,
      data.printedBy,
      data.sourceUploadName,
      data.notes,
      data.lastAction,
      data.legacyBranchCodes,
      data.legacyRegistrySpreadsheetId,
      data.legacyRegistrySheetName,
      data.legacyRowNumber,
      data.migrationSource,
      JSON.stringify({
        ...data.metadata,
        updatedByCsvImport: true,
      }),
    ],
  );
}

async function insertBranchCodes(client, processingRecordId, branchCodes, summary) {
  for (const branchCode of branchCodes) {
    const result = await client.query(
      `INSERT INTO ${tables.processingRecordBranchCodes} (processing_record_id, branch_code)
       VALUES ($1::uuid, $2)
       ON CONFLICT DO NOTHING`,
      [processingRecordId, branchCode],
    );

    if (result.rowCount === 1) {
      summary.branchCodesInserted += 1;
    } else {
      summary.branchCodesSkipped += 1;
    }
  }
}

async function insertGeneratedFileReference(client, processingRecordId, data, summary) {
  if (!data.legacyDriveFileId && !data.legacyDriveFileUrl) {
    return;
  }

  const fileKind = inferFileKind(data.filename);
  const existing = await findExistingGeneratedFile(client, processingRecordId, data, fileKind);

  if (existing) {
    summary.generatedFilesSkipped += 1;
    return;
  }

  await client.query(
    `INSERT INTO ${tables.generatedFiles} (
       processing_record_id,
       file_kind,
       filename,
       mime_type,
       storage_provider,
       download_url,
       view_url,
       legacy_drive_file_id,
       legacy_drive_file_url,
       legacy_google_mime_type,
       metadata,
       created_at,
       updated_at
     )
     VALUES (
       $1::uuid, $2, $3, $4, 'google_drive', $5, $6, $7, $8, $9, $10::jsonb,
       $11::timestamptz, $12::timestamptz
     )`,
    [
      processingRecordId,
      fileKind,
      data.filename,
      inferMimeType(fileKind),
      data.legacyDriveFileUrl,
      data.legacyDriveFileUrl,
      data.legacyDriveFileId,
      data.legacyDriveFileUrl,
      inferLegacyGoogleMimeType(fileKind),
      JSON.stringify({
        importedFrom: 'ProcessingRegistry',
        sourceUploadName: data.sourceUploadName,
        reportType: data.reportType,
        reportDateKey: data.reportDateKey,
      }),
      data.createdAt,
      data.updatedAt,
    ],
  );
  summary.generatedFilesCreated += 1;
}

async function findExistingGeneratedFile(client, processingRecordId, data, fileKind) {
  const conditions = [];
  const params = [];

  if (data.legacyDriveFileId) {
    params.push(data.legacyDriveFileId);
    conditions.push(`legacy_drive_file_id = $${params.length}`);
  }

  params.push(processingRecordId, fileKind, data.filename);
  conditions.push(`(processing_record_id = $${params.length - 2}::uuid AND file_kind = $${params.length - 1} AND filename = $${params.length})`);

  const result = await client.query(
    `SELECT id
       FROM ${tables.generatedFiles}
      WHERE ${conditions.join(' OR ')}
      LIMIT 1`,
    params,
  );
  return result.rows[0] || null;
}

function inferFileKind(filename) {
  if (/^Preview-/i.test(filename)) {
    return 'preview_workbook';
  }
  if (/\.xlsx$/i.test(filename)) {
    return 'processed_xlsx';
  }
  return 'legacy_drive_file';
}

function inferMimeType(fileKind) {
  if (fileKind === 'processed_xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (fileKind === 'preview_workbook') {
    return 'application/vnd.google-apps.spreadsheet';
  }
  return null;
}

function inferLegacyGoogleMimeType(fileKind) {
  if (fileKind === 'preview_workbook') {
    return 'application/vnd.google-apps.spreadsheet';
  }
  return null;
}

async function createMigrationLog(client, sourceName, metadata) {
  const result = await client.query(
    `INSERT INTO ${tables.migrationLogs} (source_name, source_type, status, metadata)
     VALUES ($1, $2, 'started', $3::jsonb)
     RETURNING id`,
    [sourceName, metadata.sourceType || 'csv', JSON.stringify(metadata)],
  );
  return result.rows[0].id;
}

async function finishMigrationLog(client, migrationLogId, summary) {
  const status = summary.recordsFailed > 0 || summary.warnings.length > 0 ? 'completed_with_warnings' : 'completed';
  await client.query(
    `UPDATE ${tables.migrationLogs}
        SET status = $2,
            finished_at = now(),
            records_read = $3,
            records_created = $4,
            records_updated = $5,
            records_skipped = $6,
            records_failed = $7,
            error_summary = $8,
            metadata = metadata || $9::jsonb
      WHERE id = $1::uuid`,
    [
      migrationLogId,
      status,
      summary.recordsRead,
      summary.recordsCreated,
      summary.recordsUpdated,
      summary.recordsSkipped,
      summary.recordsFailed,
      summary.errors.slice(0, 20).join('\n') || null,
      JSON.stringify({
        duplicatesFound: summary.duplicatesFound,
        generatedFilesCreated: summary.generatedFilesCreated,
        generatedFilesSkipped: summary.generatedFilesSkipped,
        branchCodesInserted: summary.branchCodesInserted,
        branchCodesSkipped: summary.branchCodesSkipped,
        dryRun: summary.dryRun,
        allowUpdate: summary.allowUpdate,
      }),
    ],
  );
}

function mergeMessages(summary, normalized) {
  for (const warning of normalized.warnings) {
    if (summary.warnings.length < 50) {
      summary.warnings.push(rowMessage({ __rowNumber: normalized.rowNumber }, warning));
    }
  }
  for (const error of normalized.errors) {
    if (summary.errors.length < 50) {
      summary.errors.push(error);
    }
  }
}

function rowMessage(row, message) {
  return `row ${row.__rowNumber}: ${message}`;
}

function clean(value) {
  return String(value || '').trim();
}

function isUuid(value) {
  return UUID_RE.test(clean(value));
}

function printSummary(summary) {
  const mode = summary.dryRun ? 'DRY RUN' : 'COMMIT';
  console.log(`\nCSV import summary (${mode})`);
  console.log(`Source: ${summary.sourceName}`);
  console.log(`Rows read: ${summary.recordsRead}`);
  console.log(`Rows valid: ${summary.recordsValid}`);
  console.log(`Rows failed: ${summary.recordsFailed}`);
  console.log(`Records created: ${summary.recordsCreated}`);
  console.log(`Records updated: ${summary.recordsUpdated}`);
  console.log(`Records skipped: ${summary.recordsSkipped}`);
  console.log(`Duplicates found: ${summary.duplicatesFound}`);
  console.log(`Generated file refs created: ${summary.generatedFilesCreated}`);
  console.log(`Generated file refs skipped: ${summary.generatedFilesSkipped}`);
  console.log(`Branch code links inserted: ${summary.branchCodesInserted}`);
  console.log(`Branch code links skipped: ${summary.branchCodesSkipped}`);

  if (summary.warnings.length > 0) {
    console.log('\nWarnings sample:');
    summary.warnings.slice(0, 10).forEach((warning) => console.log(`- ${warning}`));
  }

  if (summary.errors.length > 0) {
    console.log('\nErrors sample:');
    summary.errors.slice(0, 10).forEach((error) => console.log(`- ${error}`));
  }

  if (summary.fatalError) {
    console.log(`\nFatal error: ${summary.fatalError}`);
  }

  console.log('\nJSON summary:');
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  parseCsv,
  parseRegistryJson,
  validateHeaders,
  normalizeRegistryRow,
  normalizeReportType,
  normalizeBranchCodes,
  parseDateKey,
};
