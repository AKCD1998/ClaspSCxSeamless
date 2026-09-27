import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { copyScopeIsValid, verifiedCopyColumns } from '../src/components/shopeeAdaSmartCopy.js';
const filters = { shopCode: 'sc-drug-store', startDate: '2026-09-01', endDate: '2026-09-01' };
const plan = { ...filters, status: 'ready', issues: [], targetCents: 10000, totalCents: 10000, varianceCents: 0,
  orderCount: 1, sourceLineCount: 1, rowCount: 2, merchandiseCents: 10000, supportCents: 0, sellerCents: 0,
  confirmedSales: { orderCount: 1 }, rows: [
    { sku: '630010066', quantity: 1, unitPrice: '33.34', amountCents: 3334, sources: [] },
    { sku: '630010066', quantity: 2, unitPrice: '33.33', amountCents: 6666, sources: [] },
  ] };

test('copy columns contain only aligned values including repeated numeric SKU', () => {
  assert.deepEqual(verifiedCopyColumns(plan, filters), { sku: '630010066\n630010066', quantity: '1\n2', unitPrice: '33.34\n33.33' });
  assert.equal(copyScopeIsValid({ ...filters, shopCode: 'all' }), false);
});
test('stale filters, mismatch, unresolved units and malformed values prevent all copying', () => {
  assert.equal(verifiedCopyColumns(plan, { ...filters, startDate: '2026-09-02', endDate: '2026-09-02' }), null);
  for (const changed of [
    { ...plan, targetCents: 9999 }, { ...plan, status: 'review_required' },
    { ...plan, issues: [{ reason: 'unit unverified' }] }, { ...plan, rowCount: 3 },
    { ...plan, rows: [{ ...plan.rows[0], sku: '630010066\ninvalid' }] },
    { ...plan, rows: [{ ...plan.rows[0], quantity: 0 }] },
  ]) assert.equal(verifiedCopyColumns(changed, filters), null);
});
test('toggle preserves original table while copy mode renders independent BI amount and buttons', async () => {
  const vite = await createServer({ root: new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/u, '$1'),
    logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
    const props = { filters, summary: { products: [{ id: 'original', name: 'original product', companySkus: ['IC-003143'],
      totalQuantity: 1, orderCount: 1, orders: [] }] }, status: { state: 'success', message: 'ready' } };
    const original = renderToString(React.createElement(ShopeeSalesSummaryView, props));
    assert.match(original, /original product/u);
    const copy = renderToString(React.createElement(ShopeeSalesSummaryView, { ...props, viewMode: 'adasmart', copyPlan: plan })).replace(/<!-- -->/gu, '');
    assert.doesNotMatch(copy, /original product/u);
    assert.match(copy, /100\.00/u);
    assert.match(copy, /คัดลอกรหัส IC\/SKU/u);
    assert.match(copy, /คัดลอกจำนวนสินค้า/u);
    assert.match(copy, /คัดลอกราคาต่อหน่วย/u);
    const stale = renderToString(React.createElement(ShopeeSalesSummaryView, { ...props, viewMode: 'adasmart', copyPlan: plan, isStale: true }));
    assert.equal((stale.match(/disabled=""/gu) || []).length, 4);
    assert.match(stale, /วันที่เปลี่ยนแล้ว/u);
    const empty = renderToString(React.createElement(ShopeeSalesSummaryView, { ...props, viewMode: 'adasmart',
      copyPlan: { ...plan, orderCount: 0, rowCount: 0, rows: [], targetCents: 0, totalCents: 0, confirmedSales: { orderCount: 0 } } }));
    assert.match(empty, /ยืนยันว่าไม่มีออเดอร์ในวันนี้/u);
  } finally { await vite.close(); }
});
