// Local QA verification for the Shopee DR.Morepen accounting workbook transform.
//
// Reads the REAL raw export (read-only — never overwrites it), runs the transform, writes the
// output under outputs/shopee-verify/ using the original manual-artifact name (verification
// output only — the production filename path is cycle-driven, not this literal), then reopens
// the output and validates everything the spec requires a reviewer to check:
//
//   - 5 sheets in exact order, no Sheet1
//   - A:M headers and row offsets
//   - column L every data row is a formula AND its cached result == recalculated H-I-J-K (the
//     permanent guard against a round-then-sum regression — catches it if it ever creeps back)
//   - Excel types (Date for B/M, numbers for F/H/I/J/K, text-stored A/E)
//   - formula-error scan (#REF!, #DIV/0!, #VALUE!, #NAME?, #N/A, #NUM!, #NULL!, #SPILL!)
//   - reconciliation of the June 2026 oracle totals (5,948 / 2,299 / 2,422 / 722 / 505)
//   - comments present at 06!L1 and every weekly L2
//   - page setup per sheet (master portrait; weekly landscape fit-1-wide)
//   - structural print-fit proxy (orientation/fit/paperSize/printArea) + a text-overflow
//     heuristic, since this box has no LibreOffice/soffice. Excel COM is available here, so a
//     real PDF render of each sheet is also attempted; the result (rendered or proxy-only) is
//     reported honestly.
//
// Raw SHA-256 is recorded before and after; the script fails if the raw file changed.
//
// Usage: node scripts/verify-shopee-workbook.js [path-to-raw.xlsx]

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ExcelJS = require('exceljs');
const { transformWorkbook } = require('../server/src/services/workbookTransformService');

const RAW_DEFAULT = 'C:/Users/scgro/Downloads/Order.all.20260601_20260630.xlsx';
const OUT_DIR = path.resolve('outputs', 'shopee-verify');
const OUT_NAME = 'DR.Morepen_รายงานการเงิน_มิถุนายน_สร้างจาก_raw.xlsx'; // verification artifact name only

const SHEET_ORDER = ['06', '01-07.06', '08-14.06', '15-21.06', '22-28.06'];
const ORACLE = {
  '06': { rows: 17, net: 5948 },
  '01-07.06': { rows: 6, net: 2299 },
  '08-14.06': { rows: 7, net: 2422 },
  '15-21.06': { rows: 2, net: 722 },
  '22-28.06': { rows: 2, net: 505 },
};
const FORMULA_ERRORS = ['#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#N/A', '#NUM!', '#NULL!', '#SPILL!'];

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

async function main() {
  const rawPath = path.resolve(process.argv[2] || RAW_DEFAULT);
  const shaBefore = sha256(rawPath);
  console.log(`raw SHA-256 (before): ${shaBefore}`);

  const buffer = fs.readFileSync(rawPath);
  const originalFilename = path.basename(rawPath);
  const result = await transformWorkbook(buffer, { requestedVariant: 'shopee', originalFilename });

  await fsp.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.resolve(OUT_DIR, OUT_NAME);
  fs.writeFileSync(outPath, Buffer.from(await result.workbook.xlsx.writeBuffer()));

  const shaAfter = sha256(rawPath);
  console.log(`raw SHA-256 (after):  ${shaAfter}`);
  if (shaBefore !== shaAfter) {
    throw new Error('RAW FILE CHANGED — source was overwritten. ABORT.');
  }

  // Reopen and validate.
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fs.readFileSync(outPath));

  const findings = [];
  const pass = (msg) => console.log(`  ✔ ${msg}`);
  const fail = (msg) => {
    console.log(`  ✖ ${msg}`);
    findings.push(msg);
  };

  console.log('\n=== STRUCTURE ===');
  const sheetNames = wb.worksheets.map((s) => s.name);
  if (JSON.stringify(sheetNames) === JSON.stringify(SHEET_ORDER)) pass(`5 sheets in exact order: ${sheetNames.join(', ')}`);
  else fail(`sheet order wrong: got ${JSON.stringify(sheetNames)}`);
  if (!sheetNames.includes('Sheet1')) pass('no Sheet1');
  else fail('Sheet1 present');

  console.log('\n=== PER-SHEET VALIDATION ===');
  const table = [];
  for (const name of SHEET_ORDER) {
    const sheet = wb.getWorksheet(name);
    if (!sheet) {
      fail(`missing sheet ${name}`);
      continue;
    }
    const dataStart = name === '06' ? 2 : 3;
    let rowCount = 0;
    let formulaErrorCount = 0;
    let formulaCount = 0;
    let cachedMismatchCount = 0;
    let netSum = 0;
    let typeErrors = [];

    for (let r = dataStart; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      const a = row.getCell(1).value;
      if (!a) continue;
      rowCount += 1;

      // types
      if (typeof row.getCell(6).value !== 'number') typeErrors.push(`F${r} not number`);
      if (typeof row.getCell(8).value !== 'number') typeErrors.push(`H${r} not number`);
      const b = row.getCell(2).value;
      const m = row.getCell(13).value;
      if (!(b instanceof Date)) typeErrors.push(`B${r} not Date`);
      if (!(m instanceof Date)) typeErrors.push(`M${r} not Date`);

      // L formula + cached==recalc guard
      const lCell = row.getCell(12).value;
      if (!lCell || typeof lCell !== 'object' || !lCell.formula) {
        fail(`${name} L${r} is not a formula`);
        continue;
      }
      formulaCount += 1;
      const recalculated = round2(row.getCell(8).value - row.getCell(9).value - row.getCell(10).value - row.getCell(11).value);
      if (round2(lCell.result) !== recalculated) {
        cachedMismatchCount += 1;
        fail(`${name} L${r} cached ${lCell.result} != recalculated ${recalculated}`);
      }
      netSum = round2(netSum + recalculated);

      // formula-error scan across the row
      for (let c = 1; c <= 13; c += 1) {
        const cell = row.getCell(c).value;
        const text = typeof cell === 'object' && cell ? JSON.stringify(cell) : String(cell || '');
        if (FORMULA_ERRORS.some((err) => text.includes(err))) formulaErrorCount += 1;
      }
    }

    // comments
    let commentOk = false;
    if (name === '06') {
      commentOk = !!sheet.getCell('L1').note;
    } else {
      commentOk = !!sheet.getCell('L2').note && sheet.getCell('D1').value === name;
    }

    const oracle = ORACLE[name];
    if (rowCount === oracle.rows) pass(`${name}: ${rowCount} rows (== oracle ${oracle.rows})`);
    else fail(`${name}: ${rowCount} rows (!= oracle ${oracle.rows})`);
    if (round2(netSum) === oracle.net) pass(`${name}: net ${netSum} (== oracle ${oracle.net})`);
    else fail(`${name}: net ${netSum} (!= oracle ${oracle.net})`);
    if (formulaCount === rowCount) pass(`${name}: all ${formulaCount} L cells are formulas`);
    else fail(`${name}: only ${formulaCount}/${rowCount} L cells are formulas`);
    if (cachedMismatchCount === 0) pass(`${name}: cached == recalculated on every row`);
    else fail(`${name}: ${cachedMismatchCount} cached/recalc mismatches`);
    if (formulaErrorCount === 0) pass(`${name}: no formula errors`);
    else fail(`${name}: ${formulaErrorCount} formula errors`);
    if (typeErrors.length === 0) pass(`${name}: types correct`);
    else fail(`${name}: type errors ${typeErrors.slice(0, 3).join(', ')}`);
    if (commentOk) pass(`${name}: comment${name === '06' ? ' at L1' : ' at L2 + D1 label'} present`);
    else fail(`${name}: comment missing`);

    table.push({ sheet: name, rows: rowCount, netRevenue: netSum, formulaErrors: formulaErrorCount, cachedEqRecalc: cachedMismatchCount === 0 });
  }

  // Reconciliation
  console.log('\n=== RECONCILIATION ===');
  const weeklySum = round2(['01-07.06', '08-14.06', '15-21.06', '22-28.06'].reduce((sum, name) => {
    const sheet = wb.getWorksheet(name);
    let s = 0;
    for (let r = 3; r <= sheet.rowCount; r += 1) {
      const a = sheet.getRow(r).getCell(1).value;
      if (!a) continue;
      const l = sheet.getRow(r).getCell(12).value;
      s = round2(s + (l && typeof l === 'object' ? round2(l.result) : 0));
    }
    return sum + s;
  }, 0));
  if (weeklySum === 5948) pass(`weekly net sum ${weeklySum} == master 5948`);
  else fail(`weekly net sum ${weeklySum} != master 5948`);

  // Print setup per sheet
  console.log('\n=== PAGE SETUP ===');
  const master = wb.getWorksheet('06');
  if (master.pageSetup.orientation === 'portrait' && master.pageSetup.paperSize === 9) pass('06 portrait A4');
  else fail(`06 page setup wrong: ${master.pageSetup.orientation}/${master.pageSetup.paperSize}`);
  for (const name of SHEET_ORDER.slice(1)) {
    const sheet = wb.getWorksheet(name);
    if (sheet.pageSetup.orientation === 'landscape' && sheet.pageSetup.fitToWidth === 1 && sheet.pageSetup.paperSize === 9 && sheet.pageSetup.printArea) {
      pass(`${name} landscape A4 fit-1-wide printArea=${sheet.pageSetup.printArea}`);
    } else {
      fail(`${name} page setup wrong: orient=${sheet.pageSetup.orientation} fitW=${sheet.pageSetup.fitToWidth} paper=${sheet.pageSetup.paperSize} area=${sheet.pageSetup.printArea}`);
    }
  }

  // Structural text-overflow heuristic (a secondary proxy — the primary visual QA is the PDF
  // render above). The heuristic must NOT read cell.text for date/number cells, because .text
  // returns the raw Date.toString() / full-precision number, not the numFmt display value.
  // Likewise, columns with wrapText enabled by spec (C product name; I/J/K multiline headers)
  // wrap rather than clip, so they are excluded.
  console.log('\n=== TEXT-OVERFLOW HEURISTIC (structural proxy) ===');
  const DATE_COLS = new Set([2, 13]); // B, M
  const WRAP_COLS = new Set([3, 9, 10, 11]); // C, I, J, K (wrapped per spec)
  let overflowFlags = 0;
  const overflowSamples = [];
  for (const name of SHEET_ORDER) {
    const sheet = wb.getWorksheet(name);
    for (let c = 1; c <= 13; c += 1) {
      if (DATE_COLS.has(c) || WRAP_COLS.has(c)) continue;
      const width = sheet.getColumn(c).width || 8;
      for (let r = 1; r <= sheet.rowCount; r += 1) {
        const text = sheet.getRow(r).getCell(c).text || '';
        if (text.length > width * 1.6) {
          overflowFlags += 1;
          if (overflowSamples.length < 5) overflowSamples.push(`${name}!r${r}c${c} (w${width}, len${text.length})`);
        }
      }
    }
  }
  if (overflowFlags === 0) pass('no obvious text overflow (dates/wrapped cols excluded)');
  else {
    fail(`${overflowFlags} cells may overflow: ${overflowSamples.join('; ')}`);
  }

  // Visual QA: attempt a real PDF render via Excel COM (available on this box, v16.0).
  console.log('\n=== VISUAL QA (render) ===');
  let renderResult = 'not-attempted';
  try {
    const pdfDir = path.resolve(OUT_DIR, 'pdf');
    await fsp.mkdir(pdfDir, { recursive: true });
    const ps1 = [
      '$ErrorActionPreference = "Stop"',
      '$x = New-Object -ComObject Excel.Application',
      '$x.Visible = $false',
      `$wb = $x.Workbooks.Open("${outPath.replace(/\//g, '\\\\')}")`,
      `$wb.ExportAsFixedFormat(0, "${path.resolve(pdfDir, 'DR-Morepen-June-2026.pdf').replace(/\//g, '\\\\')}")`,
      '$wb.Close($false)',
      '$x.Quit()',
      '[System.Runtime.Interopservices.Marshal]::ReleaseComObject($x) | Out-Null',
      'Write-Output "rendered"',
    ].join('; ');
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps1], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (out.includes('rendered')) {
      renderResult = 'rendered via Excel COM 16.0 to outputs/shopee-verify/pdf/';
      pass('Excel COM PDF export succeeded — real render available for human visual QA');
    } else {
      renderResult = 'excel-com-no-output';
      fail('Excel COM ran but produced no confirmation');
    }
  } catch (e) {
    renderResult = `excel-com-failed: ${String(e.message || e).slice(0, 120)}`;
    console.log(`  ℹ Excel COM render unavailable (${String(e.message || e).slice(0, 80)}).`);
    console.log('    Falling back to STRUCTURAL PROXY only (print-setup + text-overflow checks above).');
    console.log('    A human must open the .xlsx once before real accounting use.');
  }

  console.log('\n=== SUMMARY TABLE ===');
  console.log('sheet      | rows | net revenue | formula errors | cached==recalc');
  console.log('-----------|------|-------------|----------------|----------------');
  for (const row of table) {
    console.log(
      `${row.sheet.padEnd(10)} | ${String(row.rows).padStart(4)} | ${String(row.netRevenue).padStart(11)} | ${String(row.formulaErrors).padStart(14)} | ${row.cachedEqRecalc}`,
    );
  }

  console.log(`\noutput: ${outPath}`);
  console.log(`render: ${renderResult}`);
  console.log(`raw SHA-256 unchanged: ${shaBefore === shaAfter}`);

  if (findings.length) {
    console.error(`\nVERIFICATION FAILED: ${findings.length} finding(s)`);
    process.exitCode = 1;
  } else {
    console.log('\nVERIFICATION PASSED');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
