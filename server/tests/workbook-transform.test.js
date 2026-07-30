const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');
const { buildOutputFilename } = require('../src/services/workbookRules');
const { copyWorksheet, transformWorkbook } = require('../src/services/workbookTransformService');

async function workbookBuffer(workbook) {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('individual workbook transform deletes target columns and highlights exact 150 values', async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('REP');

  worksheet.getCell('A1').value = 'HCODE';
  worksheet.getCell('A2').value = 'D1180';
  worksheet.getCell('C5').value = '2569 เมษายน 30';
  worksheet.getCell('B8').value = 'วันที่ลงทะเบียน';
  worksheet.getCell('C8').value = 'หมายเหตุอื่นๆ (STMID)';
  worksheet.getCell('D8').value = 'ลำดับที่';
  worksheet.getCell('F8').value = 'หมายเหตุ';
  worksheet.getCell('E10').value = 'ราคาต่อหน่วย';
  worksheet.getCell('E11').value = 150;

  const result = await transformWorkbook(await workbookBuffer(workbook), {
    requestedVariant: 'individual',
  });

  assert.equal(result.detectedVariant, 'individual');
  assert.equal(result.effectiveVariant, 'individual');
  assert.equal(result.deletedColumns.length, 2);
  assert.equal(result.highlightCount, 1);
  // Column deletion now preserves merged ranges instead of just splicing (see
  // workbookFormatting.deleteColumnsPreservingMerges), so the old "verify merged-range
  // parity against real samples" caveat no longer applies.
  assert.ok(!result.warnings.some((warning) => warning.includes('merged-range parity')));
});

test('summary workbook transform deletes ATK and columns to the right', async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('summary');

  worksheet.getCell('C3').value = '30/04/2569 เวลา 10:00';
  worksheet.getCell('C11').value = 'D1180';
  worksheet.getCell('A5').value = 'รหัสหน่วยบริการ';
  worksheet.getCell('B5').value = 'REP Date';
  worksheet.getCell('C5').value = 'ATK';
  worksheet.getCell('D5').value = 'Unused';
  worksheet.getCell('A11').value = 'D1180';
  worksheet.getCell('B11').value = '30/04/2569';

  const result = await transformWorkbook(await workbookBuffer(workbook), {
    requestedVariant: 'summary',
  });
  const filename = buildOutputFilename(result.worksheet, 'summary.xlsx', 'summary');

  assert.equal(result.detectedVariant, 'summary');
  assert.equal(result.effectiveVariant, 'summary');
  assert.equal(result.deletedColumns.length, 1);
  assert.equal(result.deletedColumns[0].count, 2);
  assert.match(filename.filename, /sum exp\.xlsx$/);
});

test('transform removes extra worksheets and keeps only the transformed first sheet', async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('REP');

  worksheet.getCell('A1').value = 'HCODE';
  worksheet.getCell('A2').value = 'D1180';
  worksheet.getCell('C5').value = '2569 เมษายน 30';
  worksheet.getCell('B8').value = 'วันที่ลงทะเบียน';
  worksheet.getCell('C8').value = 'หมายเหตุอื่นๆ (STMID)';
  worksheet.getCell('D8').value = 'ลำดับที่';
  worksheet.getCell('F8').value = 'หมายเหตุ';
  worksheet.getCell('E10').value = 'ราคาต่อหน่วย';
  worksheet.getCell('E11').value = 150;

  workbook.addWorksheet('Empty Sheet 2');
  const junkSheet = workbook.addWorksheet('Junk Sheet 3');
  junkSheet.getCell('A1').value = 'leftover junk data';

  const result = await transformWorkbook(await workbookBuffer(workbook), {
    requestedVariant: 'individual',
  });

  assert.equal(result.workbook.worksheets.length, 1);
  assert.equal(result.workbook.worksheets[0].name, 'REP');
  assert.equal(result.workbook.worksheets[0].id, result.worksheet.id);
});

test('copyWorksheet (used to build the preview workbook) preserves merged ranges', async () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('REP');

  // A vertical 3-row merge, matching the real header shape (e.g. A8:A10 = "ลำดับที่").
  worksheet.getCell('A8').value = 'ลำดับที่';
  worksheet.mergeCells('A8:A10');

  // A horizontal group-header merge with its own sub-header row beneath, matching M8:P8.
  worksheet.getCell('M8').value = 'เรียกเก็บ';
  worksheet.mergeCells('M8:P8');
  worksheet.getCell('M9').value = 'จำนวน';

  const targetWorkbook = new ExcelJS.Workbook();
  const copiedSheet = copyWorksheet(worksheet, targetWorkbook, 'preview-copy');

  assert.deepEqual(new Set(copiedSheet.model.merges), new Set(['A8:A10', 'M8:P8']));

  // With the merge actually applied, only the master cell of each range reports the value —
  // the previous bug copied the "echoed" value into every cell as an independent literal,
  // leaving no merge at all and visibly duplicated text in every row.
  assert.equal(copiedSheet.getCell('A8').value, 'ลำดับที่');
  assert.equal(copiedSheet.getCell('A8').master.address, 'A8');
  assert.equal(copiedSheet.getCell('A9').master.address, 'A8');
  assert.equal(copiedSheet.getCell('A10').master.address, 'A8');
});
