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

test('renders a trusted-mailbox classification without asking for confirmation', async () => {
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
        classification: {
          reasonCode: 'trusted_mailbox',
          requiresConfirmation: false,
          shopCode: 'dr-morepen',
          status: 'auto_classified',
        },
        evidenceStatus: 'recipient_match',
        mailboxEvidence: {
          evidenceStatus: 'mailbox_match',
          matchedEventCount: 2,
          suggestedShopCode: 'dr-morepen',
          totalEventCount: 2,
        },
        matchedEventCount: 2,
        productEvidence: {
          catalogVersion: 'shopee-company-sku-2026-08-28',
          evidenceStatus: 'product_match',
          items: [{
            name: 'เครื่องตรวจน้ำตาล',
            variant: '1 เครื่อง',
            matches: [{ companySku: 'IC-003230', shopCode: 'dr-morepen', status: 'matched' }],
          }],
          suggestedShopCode: 'dr-morepen',
        },
        recommendationStatus: 'auto_classified',
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
  assert.match(html, /พบจากกล่องอีเมลของร้านเดียว/u);
  assert.match(html, /จัดร้านอัตโนมัติ:[\s\S]*DR\.Morepen/u);
  assert.match(html, /ไม่ต้องยืนยัน/u);
  assert.match(html, /สินค้าทุกรายการตรงกับร้านเดียว/u);
  assert.match(html, /เครื่องตรวจน้ำตาล[\s\S]*IC-003230/u);
  assert.doesNotMatch(html, /บันทึกการเลือก/u);
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

test('renders product/recipient conflict and keeps the shop unselected', async () => {
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
      evidence: {
        classification: {
          reasonCode: 'evidence_conflict',
          requiresConfirmation: true,
          shopCode: null,
          status: 'manual_review',
        },
        evidenceStatus: 'recipient_match',
        mailboxEvidence: {
          evidenceStatus: 'mailbox_match',
          matchedEventCount: 1,
          suggestedShopCode: 'dr-morepen',
          totalEventCount: 1,
        },
        productEvidence: {
          evidenceStatus: 'product_match',
          items: [],
          suggestedShopCode: 'sc-drug-store',
        },
        recommendationStatus: 'evidence_conflict',
        suggestedShopCode: null,
      },
      lastEventAt: '2026-08-24T03:00:00.000Z',
      orderNumber: '26082471YK8C04',
    }],
    savingOrderNumber: '',
    selections: {},
    status: 'pending',
  }));

  assert.match(html, /หลักฐานจากกล่อง ผู้รับ หรือสินค้าชี้คนละร้าน/u);
  assert.doesNotMatch(html, /แนะนำ:/u);
  assert.match(html, /บันทึกการเลือก/u);
});
