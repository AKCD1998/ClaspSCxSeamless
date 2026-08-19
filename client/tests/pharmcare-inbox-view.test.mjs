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

const emptyFilters = {
  status: '',
  documentType: '',
  duplicate: '',
  receivedFrom: '',
  receivedTo: '',
  order: 'desc',
};
const noop = () => {};

async function renderView(props) {
  const { default: PharmCareInboxView } = await vite.ssrLoadModule('/src/components/PharmCareInboxView.jsx');
  return renderToString(
    React.createElement(PharmCareInboxView, {
      // Most existing tests below were written against the full (admin) view — default to
      // 'admin' here so they keep exercising that, and pass appRole: 'user' explicitly for the
      // tests that specifically cover the trimmed-down regular-user table.
      appRole: 'admin',
      documents: [],
      filters: emptyFilters,
      isLoading: false,
      nextCursor: null,
      isLoadingMore: false,
      onLoadMore: noop,
      selectedMessageId: null,
      messageDetail: null,
      detailStatus: { message: '', state: 'idle' },
      onToggleMessageDetail: noop,
      onRetryDetail: noop,
      onToggleOrder: noop,
      previewAttachment: null,
      previewStatus: { message: '', state: 'idle' },
      previewUrl: null,
      previewIsPdf: false,
      onOpenAttachmentPreview: noop,
      onCloseAttachmentPreview: noop,
      onRetryAttachmentPreview: noop,
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

test('a document with an attachment renders its filename as an in-app preview button', async () => {
  const html = await renderView({
    documents: [
      {
        attachmentFilename: 'CIV2601000123.pdf',
        attachmentId: 'att-1',
        documentNumber: 'CIV2601000123',
        documentType: 'e_credit_invoice',
        id: 'doc-1',
        messageId: 'msg-1',
        normalizedSubject: 'PharmCare e-credit invoice CIV2601000123',
        originalFrom: 'info@pharmcare.co',
        receivedAt: '2026-08-01T03:00:00.000Z',
        reviewStatus: 'auto_classified',
        route: 'gmail_filter_forward',
      },
    ],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /<button class="pharmcare-preview-link" type="button">CIV2601000123\.pdf<\/button>/);
  assert.doesNotMatch(html, /\/attachments\/att-1\/download/);
});

test('a document with no attachment (receipt_link_pending) renders plain text, not a link', async () => {
  const html = await renderView({
    documents: [
      {
        attachmentFilename: '',
        attachmentId: null,
        documentNumber: '',
        documentType: 'receipt_link_pending',
        id: 'doc-2',
        normalizedSubject: 'แจ้งใบเสร็จรับเงิน',
        originalFrom: 'info@pharmcare.co',
        receivedAt: '2026-08-01T03:00:00.000Z',
        reviewStatus: 'manual_review',
        route: 'gmail_filter_forward',
      },
    ],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.doesNotMatch(html, /\/attachments\/.*\/download/);
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

const sampleDocument = {
  attachmentFilename: 'CIV2601000123.pdf',
  attachmentId: 'att-1',
  classifierVersion: 'classifier-v1',
  documentNumber: 'CIV2601000123',
  documentType: 'e_credit_invoice',
  half: '',
  id: 'doc-1',
  messageId: 'msg-1',
  normalizedSubject: 'PharmCare e-credit invoice CIV2601000123',
  originalFrom: 'info@pharmcare.co',
  periodEnd: '',
  periodStart: '',
  reasonCodes: ['filename_pattern_match', 'civ_number_extracted'],
  receivedAt: '2026-08-01T03:00:00.000Z',
  reviewStatus: 'auto_classified',
  route: 'gmail_filter_forward',
};

test('pagination: the load-more button only renders while a nextCursor exists', async () => {
  const withCursor = await renderView({
    documents: [sampleDocument],
    nextCursor: 'cursor-2',
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });
  assert.match(withCursor, /โหลดเพิ่ม/);

  const withoutCursor = await renderView({
    documents: [sampleDocument],
    nextCursor: null,
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });
  assert.doesNotMatch(withoutCursor, /โหลดเพิ่ม/);
});

test('pagination: the load-more button is disabled while loading more', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    nextCursor: 'cursor-2',
    isLoadingMore: true,
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /<button[^>]*disabled[^>]*>กำลังโหลด\.\.\.<\/button>/);
});

test('detail: every document row renders a ดู toggle button', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /aria-expanded="false"[^>]*>ดู</);
});

test('detail: an admin session shows the row-level classification evidence section', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    selectedMessageId: 'msg-1',
    detailStatus: { message: 'กำลังโหลดรายละเอียด...', state: 'working' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /aria-expanded="true"[^>]*>ปิด</);
  assert.match(html, /กำลังโหลดรายละเอียด/);
  assert.match(html, /เหตุผลการจัดประเภท \(เอกสารนี้\)/);
  assert.match(html, /รุ่นตัวจัดประเภท/);
  assert.match(html, /ชื่อไฟล์ตรงรูปแบบที่รู้จัก/);
});

test('detail: a regular-user session hides the row-level classification evidence section', async () => {
  const html = await renderView({
    appRole: 'user',
    documents: [sampleDocument],
    selectedMessageId: 'msg-1',
    detailStatus: { message: 'กำลังโหลดรายละเอียด...', state: 'working' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /aria-expanded="true"[^>]*>ปิด</);
  assert.match(html, /กำลังโหลดรายละเอียด/);
  assert.doesNotMatch(html, /เหตุผลการจัดประเภท \(เอกสารนี้\)/);
  assert.doesNotMatch(html, /รุ่นตัวจัดประเภท/);
  assert.doesNotMatch(html, /ชื่อไฟล์ตรงรูปแบบที่รู้จัก/);
});

test('detail: a failed detail fetch shows the error and a retry button', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    selectedMessageId: 'msg-1',
    detailStatus: { message: 'โหลดรายละเอียดไม่สำเร็จ', state: 'error' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /โหลดรายละเอียดไม่สำเร็จ/);
  const retryMatches = html.match(/ลองใหม่/g) || [];
  assert.equal(retryMatches.length, 1);
});

test('detail: a loaded detail lists sibling documents and all attachments of the message', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    selectedMessageId: 'msg-1',
    messageDetail: {
      id: 'msg-1',
      ingestedAt: '2026-08-01T04:00:00.000Z',
      originalFrom: 'pharmcare.billing@example.com',
      originalDate: 'Thu, 30 Jul 2026 10:00:00 +0700',
      rawSubject: 'Fwd: E-Credit Invoice CIV2601000123',
      attachments: [
        { id: 'att-1', originalFilename: 'CIV2601000123.pdf', fileSizeBytes: 204800 },
        { id: 'att-2', originalFilename: 'SETTLEMENT-MRR-0726.pdf', fileSizeBytes: 0 },
      ],
      documents: [
        { ...sampleDocument, id: 'doc-1' },
        {
          id: 'doc-2',
          documentType: 'settlement_mrr',
          documentNumber: 'MRR-0726',
          reviewStatus: 'manual_review',
          reasonCodes: ['no_subject_pattern_match'],
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          half: '',
        },
      ],
    },
    detailStatus: { message: '', state: 'success' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /เอกสารทั้งหมดในอีเมลนี้ \(<!-- -->2<!-- -->\)/);
  assert.match(html, /Settlement \(MRR\)<!-- --> — MRR-0726/);
  assert.match(html, /หัวเรื่องไม่ตรงรูปแบบที่รู้จัก/);
  assert.match(html, /ไฟล์แนบทั้งหมด \(<!-- -->2<!-- -->\)/);
  assert.match(html, /<button class="pharmcare-preview-link" type="button">SETTLEMENT-MRR-0726\.pdf<\/button>/);
  assert.match(html, /200 KB/);
});

test('detail: an unknown reason code falls back to the raw code, and report_prefix codes map', async () => {
  const { formatReasonCode } = await vite.ssrLoadModule('/src/components/pharmcareLabels.js');

  assert.equal(formatReasonCode('some_future_code'), 'some_future_code');
  assert.equal(formatReasonCode('report_prefix_mrr'), 'ชื่อไฟล์ตรงรูปแบบรายงาน MRR');
  assert.equal(formatReasonCode(undefined), '-');
});

test('layout: the inbox table defines explicit per-column widths via a colgroup', async () => {  const html = await renderView({
    documents: [sampleDocument],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  const columns = [...html.matchAll(/<col class="(pharmcare-col-[a-z]+)"\/>/g)].map((match) => match[1]);
  assert.deepEqual(columns, [
    'pharmcare-col-received',
    'pharmcare-col-subject',
    'pharmcare-col-from',
    'pharmcare-col-route',
    'pharmcare-col-type',
    'pharmcare-col-number',
    'pharmcare-col-attachment',
    'pharmcare-col-period',
    'pharmcare-col-status',
    'pharmcare-col-detail',
  ]);
});

test('layout: a regular-user session uses a 7-column table without route/documentNumber/status', async () => {
  const html = await renderView({
    appRole: 'user',
    documents: [sampleDocument],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  const columns = [...html.matchAll(/<col class="(pharmcare-col-user-[a-z]+)"\/>/g)].map((match) => match[1]);
  assert.deepEqual(columns, [
    'pharmcare-col-user-received',
    'pharmcare-col-user-subject',
    'pharmcare-col-user-from',
    'pharmcare-col-user-type',
    'pharmcare-col-user-attachment',
    'pharmcare-col-user-period',
    'pharmcare-col-user-detail',
  ]);
  assert.doesNotMatch(html, /<th>เส้นทาง<\/th>/);
  assert.doesNotMatch(html, /<th>เลขเอกสาร<\/th>/);
  assert.doesNotMatch(html, /<th>สถานะ<\/th>/);
  // 7 <td> per data row (received/subject/from/type/attachment/period/detail), not 10.
  const cellsInRow = (html.match(/<tbody><tr>(.*?)<\/tr>/s) || ['', ''])[1].match(/<td/g) || [];
  assert.equal(cellsInRow.length, 7);
});

test('layout: an admin session still gets the full 10-column table', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /<th>เส้นทาง<\/th>/);
  assert.match(html, /<th>เลขเอกสาร<\/th>/);
  assert.match(html, /<th>สถานะ<\/th>/);
});

test('detail: a regular-user session hides per-document status and reason rows in the sibling list', async () => {
  const html = await renderView({
    appRole: 'user',
    documents: [sampleDocument],
    selectedMessageId: 'msg-1',
    messageDetail: {
      id: 'msg-1',
      attachments: [],
      documents: [{ ...sampleDocument, id: 'doc-1' }],
    },
    detailStatus: { message: '', state: 'success' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.doesNotMatch(html, /ชื่อไฟล์ตรงรูปแบบที่รู้จัก/);
  const statusLabels = html.match(/<span class="pharmcare-detail-label">สถานะ<\/span>/g) || [];
  assert.equal(statusLabels.length, 0);
});

test('preview: the overlay is hidden (renders nothing) when no attachment is being previewed', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.doesNotMatch(html, /pharmcare-preview-overlay/);
  assert.doesNotMatch(html, /role="dialog"/);
});

test('preview: opening an attachment shows a dialog with loading state and a close button', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    previewAttachment: { id: 'att-1', filename: 'CIV2601000123.pdf' },
    previewStatus: { message: 'กำลังเปิดพรีวิว...', state: 'working' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /role="dialog"/);
  assert.match(html, /กำลังเปิดพรีวิว/);
  assert.match(html, />ปิด<\/button>/);
  assert.doesNotMatch(html, /<iframe/);
});

test('preview: a failed preview fetch shows the error and a retry button inside the dialog', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    previewAttachment: { id: 'att-1', filename: 'CIV2601000123.pdf' },
    previewStatus: { message: 'เปิดพรีวิวไม่สำเร็จ', state: 'error' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /เปิดพรีวิวไม่สำเร็จ/);
  const retryMatches = html.match(/ลองใหม่/g) || [];
  assert.equal(retryMatches.length, 1);
});

test('preview: a loaded PDF renders in an iframe with print and download actions', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    previewAttachment: { id: 'att-1', filename: 'CIV2601000123.pdf' },
    previewStatus: { message: '', state: 'success' },
    previewUrl: 'blob:http://localhost/mock',
    previewIsPdf: true,
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /<iframe[^>]+src="blob:http:\/\/localhost\/mock"/);
  assert.match(html, /<button class="history-view-button secondary" type="button">พิมพ์<\/button>/);
  assert.match(html, /<a class="history-view-button secondary" href="[^"]*\/app\/pharmcare\/attachments\/att-1\/download">ดาวน์โหลด<\/a>/);
});

test('preview: a non-PDF attachment shows the fallback message instead of an iframe', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    previewAttachment: { id: 'att-9', filename: 'contract.zip' },
    previewStatus: { message: '', state: 'success' },
    previewUrl: 'blob:http://localhost/mock-zip',
    previewIsPdf: false,
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.doesNotMatch(html, /<iframe/);
  assert.doesNotMatch(html, />พิมพ์</);
  assert.match(html, /ไม่สามารถพรีวิวไฟล์ชนิดนี้ในหน้าเว็บได้/);
  assert.match(html, /\/app\/pharmcare\/attachments\/att-9\/download/);
});

test('sort: the received-at header defaults to descending and toggles to ascending', async () => {
  const descending = await renderView({
    documents: [sampleDocument],
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });
  assert.match(descending, /aria-sort="descending"/);
  assert.match(descending, /<button class="pharmcare-sort-toggle"[^>]*>ได้รับเมื่อ <!-- -->▼<\/button>/);

  const ascending = await renderView({
    documents: [sampleDocument],
    filters: { ...emptyFilters, order: 'asc' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });
  assert.match(ascending, /aria-sort="ascending"/);
  assert.match(ascending, /ได้รับเมื่อ <!-- -->▲/);
});

test('date range: the filter form renders from/to date inputs bound to the filter values', async () => {
  const html = await renderView({
    documents: [sampleDocument],
    filters: { ...emptyFilters, receivedFrom: '2026-08-01', receivedTo: '2026-08-19' },
    status: { message: 'พบเอกสาร 1 รายการ', state: 'success' },
  });

  assert.match(html, /<input type="date" name="receivedFrom" value="2026-08-01"\/>/);
  assert.match(html, /<input type="date" name="receivedTo" value="2026-08-19"\/>/);
  assert.match(html, /ได้รับจากวันที่/);
  assert.match(html, /ถึงวันที่/);
});

test('date range: picking a start after the end (or vice versa) snaps the other side to the same day', async () => {
  const { applyFilterChange } = await vite.ssrLoadModule('/src/components/PharmCareInboxPanel.jsx');

  const base = { ...emptyFilters, receivedFrom: '2026-08-01', receivedTo: '2026-08-19' };
  const startAfterEnd = applyFilterChange(base, 'receivedFrom', '2026-08-25');
  assert.equal(startAfterEnd.receivedFrom, '2026-08-25');
  assert.equal(startAfterEnd.receivedTo, '2026-08-25');

  const endBeforeStart = applyFilterChange(base, 'receivedTo', '2026-07-10');
  assert.equal(endBeforeStart.receivedFrom, '2026-07-10');
  assert.equal(endBeforeStart.receivedTo, '2026-07-10');

  // A same-day pick and normal edits never move the other side.
  const sameDay = applyFilterChange(base, 'receivedTo', '2026-08-01');
  assert.equal(sameDay.receivedFrom, '2026-08-01');
  assert.equal(sameDay.receivedTo, '2026-08-01');

  const unrelated = applyFilterChange(base, 'status', 'manual_review');
  assert.equal(unrelated.status, 'manual_review');
  assert.equal(unrelated.receivedFrom, '2026-08-01');
  assert.equal(unrelated.receivedTo, '2026-08-19');
});
