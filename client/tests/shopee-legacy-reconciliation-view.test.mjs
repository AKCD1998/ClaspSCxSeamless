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

test('renders a review-only shop choice without exposing Gmail routing data', async () => {
  const { ShopeeLegacyReconciliationView: View } = await vite.ssrLoadModule(
    '/src/components/ShopeeLegacyReconciliationPanel.jsx',
  );
  const html = renderToString(React.createElement(View, {
    error: '',
    isLoading: false,
    nextCursor: 'next',
    onLoadMore: () => {},
    onRefresh: () => {},
    onReview: () => {},
    onSelectionChange: () => {},
    onStatusChange: () => {},
    orders: [{
      currentStatus: 'shipment_due',
      decision: null,
      eventCount: 2,
      evidence: {
        evidenceStatus: 'recipient_match',
        matchedEventCount: 2,
        suggestedShopCode: 'dr-morepen',
        totalEventCount: 2,
      },
      lastEventAt: '2026-08-24T03:00:00.000Z',
      orderNumber: '26082471YK8C02',
    }],
    savingOrderNumber: '',
    selections: { '26082471YK8C02': 'dr-morepen' },
    status: 'pending',
  }));

  assert.match(html, /ตรวจร้านของข้อมูล Shopee เก่า/u);
  assert.match(html, /REVIEW-ONLY/u);
  assert.match(html, /ยืนยันผู้รับเดิม[\s\S]*2[\s\S]*\/[\s\S]*2[\s\S]*อีเมล/u);
  assert.match(html, /แนะนำ:[\s\S]*DR\.Morepen/u);
  assert.match(html, /บันทึกการเลือก/u);
  assert.match(html, /โหลดรายการเก่าเพิ่ม/u);
  assert.doesNotMatch(html, /gmailMessageId|mailboxAccount|subject|buyer/iu);
});

test('renders conflict evidence without preselecting or fabricating a shop', async () => {
  const { ShopeeLegacyReconciliationView: View } = await vite.ssrLoadModule(
    '/src/components/ShopeeLegacyReconciliationPanel.jsx',
  );
  const html = renderToString(React.createElement(View, {
    error: '',
    isLoading: false,
    nextCursor: null,
    onLoadMore: () => {},
    onRefresh: () => {},
    onReview: () => {},
    onSelectionChange: () => {},
    onStatusChange: () => {},
    orders: [{
      currentStatus: 'order_confirmed',
      eventCount: 1,
      evidence: { evidenceStatus: 'recipient_conflict', suggestedShopCode: null },
      lastEventAt: '2026-08-24T03:00:00.000Z',
      orderNumber: '26082471YK8C03',
    }],
    savingOrderNumber: '',
    selections: {},
    status: 'pending',
  }));

  assert.match(html, /ต้องตัดสินใจเอง/u);
  assert.doesNotMatch(html, /แนะนำ:/u);
});
