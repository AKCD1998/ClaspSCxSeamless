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
  vite = await createServer({ root: clientRoot, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
});

test.after(async () => { if (vite) await vite.close(); });

const cells = [
  { date: '2026-09-09', status: 'ingested', evidence: {
    dateFrom: '2026-09-09', dateTo: '2026-09-09',
    importedAt: '2026-09-10T02:10:00.000Z', observedAt: '2026-09-10T02:00:00.000Z',
    sourceFilename: 'sales_overview_20260909-20260909.xlsx', sourceSha256: 'a'.repeat(64),
  } },
  { date: '2026-09-08', status: 'missing' },
];

const row = {
  cadence: 'daily', expectedCount: 2, ingestedCount: 1, label: 'Business Insights — ภาพรวมยอดขาย',
  latestCoveredDate: '2026-09-09', latestImportedAt: '2026-09-10T02:10:00.000Z',
  missingCount: 1, reportType: 'business-insights', status: 'incomplete', cells,
};

const data = {
  asOfDate: '2026-09-09', days: 14, dates: ['2026-09-09', '2026-09-08'],
  shops: [
    { shopCode: 'sc-drug-store', shopName: 'SC Drug Store', incompleteRowCount: 1,
      latestImportedAt: '2026-09-10T02:10:00.000Z', rows: [row] },
    { shopCode: 'dr-morepen', shopName: 'DR.Morepen', incompleteRowCount: 0,
      latestImportedAt: '2026-09-10T02:15:00.000Z', rows: [{ ...row, status: 'complete', missingCount: 0,
        ingestedCount: 2, cells: cells.map((cell) => ({ ...cell, status: 'ingested', evidence: cells[0].evidence })) }] },
  ],
};

test('renders shop-document-date grid with exact sync meanings and evidence', async () => {
  const { ShopeeDocumentSyncStatusView } = await vite.ssrLoadModule('/src/components/ShopeeDocumentSyncStatusPanel.jsx');
  const html = renderToString(React.createElement(ShopeeDocumentSyncStatusView, {
    data, days: 14, error: '', groupFilter: 'all', isLoading: false,
    onDaysChange: () => {}, onGroupFilterChange: () => {}, onRefresh: () => {},
    onShopFilterChange: () => {}, shopFilter: 'all',
  }));
  assert.match(html, /สถานะอ้างอิงจากไฟล์ต้นฉบับ/u);
  assert.match(html, /SC Drug Store/u);
  assert.match(html, /DR\.Morepen/u);
  assert.match(html, /Business Insights — ภาพรวมยอดขาย/u);
  assert.match(html, /ดาวน์โหลดและนำเข้าแล้ว/u);
  assert.match(html, /ยังไม่มีข้อมูลในเว็บ/u);
  assert.match(html, /sales_overview_20260909-20260909\.xlsx/u);
  assert.match(html, /ขาด 1 วัน/u);
});

test('shows not-due and Shopee-unavailable states without calling them failures', async () => {
  const { ShopeeDocumentSyncStatusView } = await vite.ssrLoadModule('/src/components/ShopeeDocumentSyncStatusPanel.jsx');
  const weeklyRows = [{ ...row, cadence: 'weekly', reportType: 'financial-statement', label: 'รายงานการเงิน',
    cells: [{ date: '2026-09-09', status: 'not_due' }], status: 'not_due', expectedCount: 0, missingCount: 0 },
  { ...row, cadence: 'weekly', reportType: 'income-pending', label: 'รายละเอียดรายรับของฉัน — รอดำเนินการ',
    cells: [{ date: '2026-09-09', status: 'unavailable' }], status: 'unavailable', expectedCount: 0, missingCount: 0 }];
  const html = renderToString(React.createElement(ShopeeDocumentSyncStatusView, {
    data: { ...data, dates: ['2026-09-09'], shops: [{ ...data.shops[0], rows: weeklyRows }] },
    days: 14, error: '', groupFilter: 'weekly', isLoading: false,
    onDaysChange: () => {}, onGroupFilterChange: () => {}, onRefresh: () => {},
    onShopFilterChange: () => {}, shopFilter: 'all',
  }));
  assert.match(html, /ยังไม่ถึงรอบที่ Shopee ออกรายงาน/u);
  assert.match(html, /Shopee ยังไม่เปิดให้ดาวน์โหลด/u);
  assert.doesNotMatch(html, /ทำงานล้มเหลว/u);
});
