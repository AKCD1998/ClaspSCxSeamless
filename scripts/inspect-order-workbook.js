const ExcelJS = require('exceljs');

function displayValue(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    if (typeof value.text === 'string') {
      return value.text;
    }

    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('');
    }

    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return displayValue(value.result);
    }

    if (typeof value.formula === 'string') {
      return value.formula;
    }
  }

  return String(value);
}

function findHeaderRow(worksheet) {
  let best = { rowNumber: 1, populatedCells: 0 };

  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 20); rowNumber += 1) {
    let populatedCells = 0;
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell) => {
      if (displayValue(cell.value).trim()) {
        populatedCells += 1;
      }
    });

    if (populatedCells > best.populatedCells) {
      best = { rowNumber, populatedCells };
    }
  }

  return best;
}

function inspectColumn(worksheet, headerRowNumber, columnNumber) {
  const counts = {
    blank: 0,
    boolean: 0,
    date: 0,
    formula: 0,
    number: 0,
    text: 0,
  };
  const distinct = new Set();

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const value = worksheet.getRow(rowNumber).getCell(columnNumber).value;

    if (value === null || typeof value === 'undefined' || displayValue(value) === '') {
      counts.blank += 1;
      continue;
    }

    if (value instanceof Date) {
      counts.date += 1;
    } else if (typeof value === 'number') {
      counts.number += 1;
    } else if (typeof value === 'boolean') {
      counts.boolean += 1;
    } else if (typeof value === 'object' && typeof value.formula === 'string') {
      counts.formula += 1;
    } else {
      counts.text += 1;
    }

    if (distinct.size < 101) {
      distinct.add(displayValue(value));
    }
  }

  return {
    columnNumber,
    address: worksheet.getRow(headerRowNumber).getCell(columnNumber).address,
    header: displayValue(worksheet.getRow(headerRowNumber).getCell(columnNumber).value),
    counts,
    distinctCount: distinct.size > 100 ? '>100' : distinct.size,
    hidden: worksheet.getColumn(columnNumber).hidden === true,
    numberFormat: worksheet.getRow(headerRowNumber + 1).getCell(columnNumber).numFmt || '',
    width: worksheet.getColumn(columnNumber).width || null,
  };
}

function parseNumericText(value) {
  const normalized = displayValue(value).replace(/,/g, '').trim();
  if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function summarizeColumns(worksheet, headerRowNumber) {
  const categoryHeaders = new Set([
    'สถานะการสั่งซื้อ',
    'สถานะการคืนเงินหรือคืนสินค้า',
    'ช่องทางการชำระเงิน',
    'ตัวเลือกการจัดส่ง',
    'วิธีการจัดส่ง',
  ]);
  const numericHeaders = new Set([
    'ราคาตั้งต้น',
    'ราคาขาย',
    'จำนวน',
    'จำนวนที่ส่งคืน',
    'ราคาขายสุทธิ',
    'ส่วนลดจาก Shopee',
    'โค้ดส่วนลดชำระโดยผู้ขาย',
    'ค่าคอมมิชชั่น',
    'Transaction Fee',
    'ราคาสินค้าที่ชำระโดยผู้ซื้อ (THB)',
    'ค่าจัดส่งที่ชำระโดยผู้ซื้อ',
    'ค่าจัดส่งที่ Shopee ออกให้โดยประมาณ',
    'ค่าจัดส่งสินค้าคืน',
    'ค่าบริการ',
    'จำนวนเงินทั้งหมด',
    'ค่าจัดส่งโดยประมาณ',
  ]);
  const categorySummaries = {};
  const numericSummaries = {};
  const headerIndexes = {};

  for (let columnNumber = 1; columnNumber <= worksheet.columnCount; columnNumber += 1) {
    headerIndexes[displayValue(worksheet.getRow(headerRowNumber).getCell(columnNumber).value)] = columnNumber;
  }

  for (let columnNumber = 1; columnNumber <= worksheet.columnCount; columnNumber += 1) {
    const header = displayValue(worksheet.getRow(headerRowNumber).getCell(columnNumber).value);

    if (categoryHeaders.has(header)) {
      const counts = {};
      for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const value = displayValue(worksheet.getRow(rowNumber).getCell(columnNumber).value).trim() || '(blank)';
        counts[value] = (counts[value] || 0) + 1;
      }
      categorySummaries[header] = counts;
    }

    if (numericHeaders.has(header)) {
      let sum = 0;
      let numericCount = 0;
      let invalidCount = 0;

      for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const raw = worksheet.getRow(rowNumber).getCell(columnNumber).value;
        const parsed = parseNumericText(raw);

        if (parsed === null) {
          if (displayValue(raw).trim()) {
            invalidCount += 1;
          }
          continue;
        }

        sum += parsed;
        numericCount += 1;
      }

      numericSummaries[header] = {
        sum: Math.round(sum * 100) / 100,
        numericCount,
        invalidCount,
      };
    }
  }

  const statusNumericSummaries = {};
  const statusColumn = headerIndexes['สถานะการสั่งซื้อ'];

  if (statusColumn) {
    for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const status = displayValue(worksheet.getRow(rowNumber).getCell(statusColumn).value).trim() || '(blank)';
      const bucket = statusNumericSummaries[status] || { rowCount: 0 };
      bucket.rowCount += 1;

      numericHeaders.forEach((header) => {
        const columnNumber = headerIndexes[header];
        if (!columnNumber) {
          return;
        }

        const parsed = parseNumericText(worksheet.getRow(rowNumber).getCell(columnNumber).value);
        bucket[header] = Math.round(((bucket[header] || 0) + (parsed || 0)) * 100) / 100;
      });

      statusNumericSummaries[status] = bucket;
    }
  }

  const dateBounds = {};
  ['วันที่ทำการสั่งซื้อ', 'เวลาการชำระสินค้า', 'เวลาส่งสินค้า', 'เวลาที่ทำการสั่งซื้อสำเร็จ'].forEach(
    (header) => {
      const columnNumber = headerIndexes[header];
      if (!columnNumber) {
        return;
      }

      const values = [];
      for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const value = displayValue(worksheet.getRow(rowNumber).getCell(columnNumber).value).trim();
        if (value) {
          values.push(value);
        }
      }

      values.sort();
      dateBounds[header] = { first: values[0] || '', last: values[values.length - 1] || '' };
    },
  );

  return { categorySummaries, numericSummaries, statusNumericSummaries, dateBounds };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: node scripts/inspect-order-workbook.js <input.xlsx>');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);

  const result = {
    creator: workbook.creator || '',
    modified: workbook.modified || null,
    worksheets: workbook.worksheets.map((worksheet) => {
      const header = findHeaderRow(worksheet);

      return {
        name: worksheet.name,
        state: worksheet.state,
        rowCount: worksheet.rowCount,
        actualRowCount: worksheet.actualRowCount,
        columnCount: worksheet.columnCount,
        actualColumnCount: worksheet.actualColumnCount,
        header,
        columns: Array.from({ length: worksheet.columnCount }, (_, index) =>
          inspectColumn(worksheet, header.rowNumber, index + 1),
        ),
        merges: worksheet.model.merges || [],
        views: worksheet.views,
        pageSetup: worksheet.pageSetup,
        autoFilter: worksheet.autoFilter || null,
        summaries: summarizeColumns(worksheet, header.rowNumber),
      };
    }),
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
