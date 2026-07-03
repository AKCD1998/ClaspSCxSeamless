const { env } = require('../config/env');

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdentifier(identifier, label = 'identifier') {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid PostgreSQL ${label}: ${identifier}`);
  }

  return identifier;
}

function quoteIdentifier(identifier, label) {
  return `"${assertIdentifier(identifier, label)}"`;
}

function qualifyTable(tableName) {
  return `${quoteIdentifier(env.dbSchema, 'schema')}.${quoteIdentifier(tableName, 'table')}`;
}

const tables = Object.freeze({
  appSettings: qualifyTable('app_settings'),
  branchMappings: qualifyTable('branch_mappings'),
  generatedFiles: qualifyTable('generated_files'),
  migrationLogs: qualifyTable('migration_logs'),
  operationLogs: qualifyTable('operation_logs'),
  previewSheets: qualifyTable('preview_sheets'),
  processingBatches: qualifyTable('processing_batches'),
  processingRecordBranchCodes: qualifyTable('processing_record_branch_codes'),
  processingRecords: qualifyTable('processing_records'),
  schemaMigrations: qualifyTable('schema_migrations'),
  schemaSeeds: qualifyTable('schema_seeds'),
  workbookUploads: qualifyTable('workbook_uploads'),
});

module.exports = {
  quoteIdentifier,
  qualifyTable,
  schemaName: assertIdentifier(env.dbSchema, 'schema'),
  schemaSql: quoteIdentifier(env.dbSchema, 'schema'),
  searchPathOption: `${assertIdentifier(env.dbSchema, 'schema')},public`,
  searchPathSql: `${quoteIdentifier(env.dbSchema, 'schema')}, public`,
  tables,
};
