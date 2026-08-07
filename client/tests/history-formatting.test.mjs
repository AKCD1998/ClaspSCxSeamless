import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getHistoryDisplayFilename,
  getHistoryDocumentUrl,
} from '../src/utils/historyFormatting.js';

test('Shopee history opens the complete processed workbook instead of the one-sheet preview', () => {
  const record = {
    reportType: 'shopee',
    filename: 'Preview-shopee-single.xlsx',
    driveFileUrl: 'https://example.test/preview.xlsx',
    metadata: {
      outputFilename: '2026-06-01_to_2026-06-30-shopee-orders.xlsx',
      outputDownloadUrl: 'https://example.test/processed.xlsx',
    },
  };

  assert.equal(getHistoryDisplayFilename(record), record.metadata.outputFilename);
  assert.equal(getHistoryDocumentUrl(record), record.metadata.outputDownloadUrl);
});

test('legacy Seamless history keeps the shared preview workbook link and name', () => {
  const record = {
    reportType: 'individual',
    filename: 'Preview-individual-multi.xlsx',
    driveFileUrl: 'https://example.test/preview.xlsx',
    metadata: {
      outputFilename: '2026-06-30-001-02 indiv exp.xlsx',
      outputDownloadUrl: 'https://example.test/processed.xlsx',
    },
  };

  assert.equal(getHistoryDisplayFilename(record), record.filename);
  assert.equal(getHistoryDocumentUrl(record), record.driveFileUrl);
});
