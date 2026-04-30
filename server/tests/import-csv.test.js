const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeRegistryRow,
  parseCsv,
  validateHeaders,
} = require('../../scripts/import-data/import-from-csv');

const registryHeader =
  'id,reportDate,reportType,filename,driveFileId,driveFileUrl,uploadedAt,uploadedBy,printed,printedAt,printedBy,sourceUploadName,notes,createdAt,updatedAt,lastAction,branchCodes';

test('ProcessingRegistry CSV parser preserves headers, row numbers, and quoted values', () => {
  const csv = `${registryHeader}
legacy-1,20260430,summary,"Preview-summary-single-20260430-101010",drive-1,https://drive.example/file,2026-04-30T10:10:10Z,user@example.test,true,2026-04-30T11:00:00Z,printer@example.test,source.xlsx,"note, with comma",2026-04-30T10:10:10Z,2026-04-30T11:00:00Z,marked_printed,"001, 003"`;

  const parsed = parseCsv(csv);
  validateHeaders(parsed.headers);

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].__rowNumber, 2);
  assert.equal(parsed.rows[0].notes, 'note, with comma');
});

test('ProcessingRegistry row normalization keeps traceability fields', () => {
  const csv = `${registryHeader}
legacy-1,20260430,summary,Preview-summary-single-20260430-101010,drive-1,https://drive.example/file,2026-04-30T10:10:10Z,user@example.test,true,2026-04-30T11:00:00Z,printer@example.test,source.xlsx,,2026-04-30T10:10:10Z,2026-04-30T11:00:00Z,marked_printed,"001, 003"`;
  const parsed = parseCsv(csv);
  const normalized = normalizeRegistryRow(parsed.rows[0], {
    sourceName: 'ProcessingRegistry.csv',
    registrySpreadsheetId: 'registry-spreadsheet-id',
  });

  assert.deepEqual(normalized.errors, []);
  assert.equal(normalized.data.legacyRegistryId, 'legacy-1');
  assert.equal(normalized.data.reportDateKey, '20260430');
  assert.equal(normalized.data.reportDate, '2026-04-30');
  assert.equal(normalized.data.reportType, 'summary');
  assert.equal(normalized.data.legacyRowNumber, 2);
  assert.equal(normalized.data.migrationSource, 'ProcessingRegistry.csv');
  assert.deepEqual(normalized.data.branchCodes, ['001', '003']);
});

test('ProcessingRegistry header validation fails fast when required columns are missing', () => {
  assert.throws(
    () => validateHeaders(['id', 'filename']),
    /missing required headers/i,
  );
});
