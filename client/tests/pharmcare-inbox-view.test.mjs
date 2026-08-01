import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
let vite;

test.before(async () => {
  vite = await createServer({
    root: clientRoot,
    logLevel: 'silent',
    server: { middlewareMode: true },
    appType: 'custom',
  });
});

test.after(async () => {
  if (vite) {
    await vite.close();
  }
});

const emptyFilters = { status: '', documentType: '', duplicate: '' };
const noop = () => {};

async function renderView(props) {
  const { default: PharmCareInboxView } = await vite.ssrLoadModule('/src/components/PharmCareInboxView.jsx');
  return renderToString(
    React.createElement(PharmCareInboxView, {
      documents: [],
      filters: emptyFilters,
      isLoading: false,
      onFilterChange: noop,
      onRetry: noop,
      status: { message: '', state: 'idle' },
      summary: null,
      ...props,
    }),
  );
}

test('loading state shows the loading placeholder instead of a table or empty message', async () => {
  const html = await renderView({
    isLoading: true,
    status: { message: 'กำลังโหลด PharmCare Inbox...', state: 'working' },
  });

  assert.match(html, /กำลังโหลด PharmCare Inbox/);
  assert.match(html, /กำลังโหลด\.\.\./);
  assert.doesNotMatch(html, /<table/);
});

test('empty state renders the empty message when there are no documents', async () => {
  const html = await renderView({
    isLoading: false,
    status: { message: 'ไม่พบเอกสาร', state: 'warning' },
  });

  assert.match(html, /ไม่พบเอกสาร PharmCare ตามเงื่อนไขที่เลือก/);
  assert.doesNotMatch(html, /<table/);
});

test('error state shows the error message and a retry button', async () => {
  const html = await renderView({
    status: { message: 'โหลด PharmCare Inbox ไม่สำเร็จ', state: 'error' },
  });

  assert.match(html, /โหลด PharmCare Inbox ไม่สำเร็จ/);
  assert.match(html, /ลองใหม่/);
});

test('success state renders a table row per document with a Direct badge for gmail_filter_forward', async () => {
  const html = await renderView({
    documents: [
      {
        attachmentFilename: 'CIV2601000123.pdf',
        documentNumber: 'CIV2601000123',
        documentType: 'e_credit_invoice',
        half: '',
        id: 'doc-1',
        normalizedSubject: 'PharmCare e-credit invoice CIV2601000123',
        originalFrom: 'info@pharmcare.co',
        periodEnd: '',
        periodStart: '',
        receivedAt: '2026-08-01T03:00:00.000Z',
        reviewStatus: 'auto_classified',
        route: 'gmail_filter_forward',
      },
    ],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
    summary: { autoClassified: 1, conflict: 0, duplicate: 0, manualReview: 0 },
  });

  assert.match(html, /<table/);
  assert.match(html, /CIV2601000123/);
  assert.match(html, />Direct</);
  assert.doesNotMatch(html, />Forwarded</);
  assert.match(html, /จัดประเภทแล้ว.*1/s);
});

test('a manual_forward document renders the Forwarded badge instead of Direct', async () => {
  const html = await renderView({
    documents: [
      {
        attachmentFilename: 'CIV2601000999.pdf',
        documentNumber: 'CIV2601000999',
        documentType: 'e_credit_invoice',
        id: 'doc-2',
        normalizedSubject: 'PharmCare e-credit invoice CIV2601000999',
        originalFrom: 'info@pharmcare.co',
        receivedAt: '2026-08-01T03:00:00.000Z',
        reviewStatus: 'auto_classified',
        route: 'manual_forward',
      },
    ],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, />Forwarded</);
  assert.doesNotMatch(html, />Direct</);
});

test('filter selects reflect the currently selected filter values', async () => {
  const html = await renderView({
    filters: { status: 'manual_review', documentType: 'contract', duplicate: 'true' },
  });

  assert.match(html, /<option value="manual_review"[^>]*selected/);
  assert.match(html, /<option value="contract"[^>]*selected/);
  assert.match(html, /<option value="true"[^>]*selected/);
});
