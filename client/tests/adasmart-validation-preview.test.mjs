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
  if (vite) await vite.close();
});

test('upload success exposes the Branch 004 review action and upload failure does not', async () => {
  const {
    AdaSmartValidationPreviewView,
    shouldOfferAdaSmartValidation,
  } = await vite.ssrLoadModule('/src/components/AdaSmartValidationPreview.jsx');

  assert.equal(shouldOfferAdaSmartValidation('shopee', { processingRecordId: 'record-1' }), true);
  assert.equal(shouldOfferAdaSmartValidation('shopee', null), false);
  assert.equal(shouldOfferAdaSmartValidation('shopee', { error: 'upload failed' }), false);
  assert.equal(shouldOfferAdaSmartValidation('individual', { processingRecordId: 'record-1' }), false);

  const html = renderToString(React.createElement(AdaSmartValidationPreviewView));
  assert.match(html, /ตรวจสอบก่อนคีย์ AdaSmart — สาขา 004/);
});

test('renders summary, block reasons, and only explicitly safe SKU fields without PII', async () => {
  const { AdaSmartValidationPreviewView } = await vite.ssrLoadModule(
    '/src/components/AdaSmartValidationPreview.jsx',
  );
  const preview = {
    branchCode: '004',
    buyerName: 'PRIVATE BUYER',
    cycle: { periodEnd: '2026-09-13', periodStart: '2026-08-24' },
    hasCriticalPolicyGap: true,
    orders: [{
      address: 'PRIVATE ADDRESS',
      blockReasons: ['customer_policy_missing'],
      orderNumber: '26082871YK8C01',
      safeLines: [{ barcode: '8850000000001', companySku: 'IC-005998', quantity: 2 }],
      status: 'customer_policy_missing',
    }],
    queue: { enabled: false },
    shop: { code: 'dr-morepen', displayName: 'DR.Morepen' },
    summary: {
      blockedByReason: { customer_policy_missing: 1 },
      blockedCount: 1,
      cancelledCount: 0,
      readyCount: 0,
      totalOrderCount: 1,
    },
  };
  const html = renderToString(React.createElement(AdaSmartValidationPreviewView, { preview }));

  assert.match(html, /DR\.Morepen/);
  assert.match(html, /2026-08-24 ถึง 2026-09-13/);
  assert.match(html, /Orders ทั้งหมด/);
  assert.match(html, /ต้องตรวจเอง \/ Block/);
  assert.match(html, /ยังไม่มีนโยบายรหัสลูกค้า/);
  assert.match(html, /IC-005998/);
  assert.match(html, /8850000000001/);
  assert.doesNotMatch(html, /PRIVATE BUYER|PRIVATE ADDRESS/);
  assert.doesNotMatch(html, /ยืนยันสร้างคิว dry-run/);
});

test('queue-disabled and zero-ready states are explicit and cannot confirm', async () => {
  const {
    AdaSmartValidationPreviewView,
    canConfirmAdaSmartPreview,
  } = await vite.ssrLoadModule('/src/components/AdaSmartValidationPreview.jsx');
  const preview = {
    canConfirmDryRun: false,
    cycle: { periodEnd: '2026-09-13', periodStart: '2026-08-24' },
    hasCriticalPolicyGap: false,
    orders: [],
    queue: { enabled: false },
    shop: { displayName: 'SC Drug Store' },
    summary: {
      blockedByReason: {},
      blockedCount: 0,
      cancelledCount: 0,
      readyCount: 0,
      totalOrderCount: 0,
    },
  };
  const html = renderToString(React.createElement(AdaSmartValidationPreviewView, { preview }));

  assert.equal(canConfirmAdaSmartPreview(preview), false);
  assert.match(html, /คิว dry-run ถูกปิดด้วย feature flag/);
  assert.match(html, /ไม่มี order ที่พร้อม/);
  assert.doesNotMatch(html, /ยืนยันสร้างคิว dry-run/);
});

test('confirmation control appears only for an eligible dry-run preview', async () => {
  const {
    AdaSmartValidationPreviewView,
    canConfirmAdaSmartPreview,
  } = await vite.ssrLoadModule('/src/components/AdaSmartValidationPreview.jsx');
  const preview = {
    canConfirmDryRun: true,
    cycle: { periodEnd: '2026-09-13', periodStart: '2026-08-24' },
    hasCriticalPolicyGap: false,
    orders: [],
    policies: {
      customerCode: 'CUST-SHOPEE-004',
      customerPolicyKey: 'branch-004:shopee-credit-customer',
      customerPolicyRevision: 'customer-policy-v1',
      customerPolicyStatus: 'approved',
    },
    queue: { enabled: true },
    shop: { displayName: 'SC Drug Store' },
    summary: {
      blockedByReason: {},
      blockedCount: 0,
      cancelledCount: 0,
      readyCount: 1,
      totalOrderCount: 1,
    },
  };
  const html = renderToString(React.createElement(AdaSmartValidationPreviewView, { preview }));
  assert.equal(canConfirmAdaSmartPreview(preview), true);
  assert.match(html, /ยืนยันสร้างคิว dry-run/);
  assert.doesNotMatch(html, /ส่งคีย์จริง/);
});

test('shows the approved AdaSmart customer identity from the preview without leaking extra fields', async () => {
  const {
    AdaSmartValidationPreviewView,
    canConfirmAdaSmartPreview,
  } = await vite.ssrLoadModule('/src/components/AdaSmartValidationPreview.jsx');
  const preview = {
    canConfirmDryRun: true,
    cycle: { periodEnd: '2026-09-13', periodStart: '2026-08-24' },
    hasCriticalPolicyGap: false,
    orders: [],
    policies: {
      customerCode: 'CUST-SHOPEE-004',
      customerPolicyKey: 'branch-004:shopee-credit-customer',
      customerPolicyRevision: 'customer-policy-v1',
      customerPolicyStatus: 'approved',
      credentials: 'DO-NOT-RENDER',
      internalNote: 'PRIVATE INTERNAL NOTE',
    },
    queue: { enabled: true },
    shop: { displayName: 'DR.Morepen' },
    summary: {
      blockedByReason: {},
      blockedCount: 0,
      cancelledCount: 0,
      readyCount: 1,
      totalOrderCount: 1,
    },
  };
  const html = renderToString(React.createElement(AdaSmartValidationPreviewView, { preview }));

  assert.equal(canConfirmAdaSmartPreview(preview), true);
  assert.match(html, /CUST-SHOPEE-004/);
  assert.match(html, /ผ่านการอนุมัติ/);
  assert.match(html, /customer-policy-v1/);
  assert.match(html, /branch-004:shopee-credit-customer/);
  assert.doesNotMatch(html, /DO-NOT-RENDER|PRIVATE INTERNAL NOTE/);
});

test('fails closed when customer code is missing or policy is not approved', async () => {
  const {
    AdaSmartValidationPreviewView,
    canConfirmAdaSmartPreview,
  } = await vite.ssrLoadModule('/src/components/AdaSmartValidationPreview.jsx');
  const base = {
    canConfirmDryRun: true,
    cycle: { periodEnd: '2026-09-13', periodStart: '2026-08-24' },
    hasCriticalPolicyGap: false,
    orders: [],
    queue: { enabled: true },
    shop: { displayName: 'DR.Morepen' },
    summary: {
      blockedByReason: {},
      blockedCount: 0,
      cancelledCount: 0,
      readyCount: 1,
      totalOrderCount: 1,
    },
  };
  const cases = [
    {
      ...base,
      policies: {
        customerCode: null,
        customerPolicyKey: 'branch-004:shopee-credit-customer',
        customerPolicyRevision: 'customer-policy-v1',
        customerPolicyStatus: 'approved',
      },
    },
    {
      ...base,
      policies: {
        customerCode: 'CUST-SHOPEE-004',
        customerPolicyKey: 'branch-004:shopee-credit-customer',
        customerPolicyRevision: 'customer-policy-v1',
        customerPolicyStatus: 'missing',
      },
    },
  ];

  cases.forEach((preview) => {
    const html = renderToString(React.createElement(AdaSmartValidationPreviewView, { preview }));
    assert.equal(canConfirmAdaSmartPreview(preview), false);
    assert.match(html, /ไม่ผ่าน \/ ข้อมูลไม่ครบ/);
    assert.match(html, /ปิดการยืนยันแบบ fail closed/);
    assert.doesNotMatch(html, /ยืนยันสร้างคิว dry-run/);
  });
});
