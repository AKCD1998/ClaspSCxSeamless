const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');
const { buildOutputFilename } = require('../src/services/workbookRules');
const { transformWorkbook } = require('../src/services/workbookTransformService');

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
  assert.ok(result.warnings.some((warning) => warning.includes('Node workbook strategy')));
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
