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

test('Income table renders shop/date filters, Seller Balance evidence, preview action, and pagination', async () => {
  const { default: Table, PAGE_SIZE } = await vite.ssrLoadModule(
    '/src/components/AccountingIncomeOrdersTable.jsx',
  );
  assert.equal(PAGE_SIZE, 10);
  const html = renderToString(React.createElement(Table));
  assert.equal((html.match(/<th(?:>|\s)/g) || []).length, 8);
  assert.match(html, /type="search"/);
  assert.equal((html.match(/type="date"/g) || []).length, 2);
  assert.match(html, /value="orderedAt"/);
  assert.match(html, /value="transferredAt" selected=""/);
  assert.match(html, /value="sc-drug-store"/);
  assert.match(html, /value="dr-morepen"/);
  assert.match(html, /SC Drug Store/u);
  assert.match(html, /DR\.Morepen/u);
  assert.match(html, /aria-label="หน้ารายการ Income"/);
  assert.match(html, /ก่อนหน้า/);
  assert.match(html, /ถัดไป/);
  assert.match(html, /สถานะ Seller Balance/u);
  assert.match(html, /วันที่เงินเข้า Seller Balance/u);
  assert.match(html, /ยอดสุทธิ Seller Balance/u);
  assert.match(html, /accounting-income-balance-net-col/u);
  assert.match(html, /ดูตัวอย่างก่อนดาวน์โหลดหรือพิมพ์/u);
  assert.match(html, /เอกสารสำหรับบัญชีใช้ช่วง “วันที่โอนชำระเงินสำเร็จ” เท่านั้น/u);
  assert.match(html, /ระบบจะยังไม่ดาวน์โหลดไฟล์/u);
  assert.match(html, /accounting-income-export" disabled=""/u);
  assert.match(html, /ไม่ใช่หลักฐานการชำระของลูกค้าโดยตรง/u);
  assert.match(html, /Order All/u);
});

test('Income export preview shows sources and rows before offering print or download', async () => {
  const { default: Preview } = await vite.ssrLoadModule(
    '/src/components/AccountingIncomeExportPreview.jsx',
  );
  const html = renderToString(React.createElement(Preview, {
    downloadLoading: false,
    onClose() {},
    onDownload() {},
    onPrint() {},
    pdfUrl: 'blob:https://app.example.test/combined-pdf',
    preview: {
      documents: [{
        endDate: '2026-08-31',
        filename: 'Income.transferred.xlsx',
        kind: 'income',
        kindLabel: 'รายงานรายรับของฉัน',
        originalAvailable: true,
        originalUrl: 'https://api.example.test/original.xlsx',
        periodType: 'income',
        periodTypeLabel: 'รายงาน Income',
        shopCode: 'sc-drug-store',
        shopLabel: 'SC Drug Store',
        startDate: '2026-08-01',
      }],
      filters: {
        dateFrom: '2026-08-01',
        dateTo: '2026-08-31',
        orderNumber: '',
        shopLabel: 'SC Drug Store',
      },
      orders: [{
        amount: 125.5,
        orderDate: '2026-07-30',
        orderNumber: '260730TEST001',
        sellerBalanceInflowDate: '2026-08-02',
        sellerBalanceNetAmount: 125.5,
        sellerBalanceStatus: 'credited',
        sellerBalanceStatusLabel: 'เงินเข้าแล้ว',
        shopCode: 'sc-drug-store',
        shopLabel: 'SC Drug Store',
        transferDate: '2026-08-01',
      }],
      sourcePolicy: { fullCalendarMonth: true, monthlyIncluded: true },
      summary: {
        availableOriginalCount: 1,
        creditedCount: 1,
        missingOriginalCount: 0,
        orderCount: 1,
        totalIncome: 125.5,
      },
      timezone: 'Asia/Bangkok',
    },
  }));

  assert.match(html, /role="dialog"/u);
  assert.match(html, /พรีวิวเอกสารรวมพร้อมภาคผนวก/u);
  assert.match(html, /เปิด PDF เพื่อพิมพ์/u);
  assert.match(html, /PDF รวมพร้อมภาคผนวก/u);
  assert.match(html, /ข้อมูลสรุปและลิงก์เดิม/u);
  assert.match(html, /<iframe/u);
  assert.match(html, /PDF รายรับพร้อมภาคผนวกเอกสาร Shopee ต้นฉบับ/u);
  assert.match(html, /ดาวน์โหลดชุดเอกสาร \(\.zip\)/u);
  assert.match(html, /Income\.transferred\.xlsx/u);
  assert.match(html, /เปิดดูต้นฉบับ/u);
  assert.match(html, /รายงานการเงินรายเดือนที่ตรงทั้งเดือน/u);
  assert.match(html, /260730TEST001/u);
  assert.match(html, /accounting-income-preview-status/u);
  assert.match(html, /data-status="credited"/u);
});

test('Income formatters preserve local dates and numeric two-decimal currency', async () => {
  const { formatIncomeAmount, formatIncomeDate } = await vite.ssrLoadModule(
    '/src/components/AccountingIncomeOrdersTable.jsx',
  );
  assert.match(formatIncomeDate('2026-09-01'), /01\/09\/2569/u);
  assert.match(formatIncomeAmount(125.5), /125\.50/u);
  assert.equal(formatIncomeAmount('not-a-number'), '-');
});

test('Seller Balance status badges render every safe reconciliation label', async () => {
  const { SellerBalanceStatusBadge } = await vite.ssrLoadModule(
    '/src/components/AccountingIncomeOrdersTable.jsx',
  );
  const cases = [
    ['credited', 'เงินเข้าแล้ว', 'success'],
    ['outflow_or_reversed', 'มีเงินออกหรือย้อนรายการ', 'error'],
    ['amount_mismatch', 'พบข้อมูลแต่ยอดไม่ตรง', 'warning'],
    ['not_found_in_covered_report', 'รายงานครอบคลุม แต่ไม่พบ', 'warning'],
    ['not_covered', 'ยังไม่มีรายงานครอบคลุม', 'neutral'],
  ];
  for (const [status, label, tone] of cases) {
    const html = renderToString(React.createElement(SellerBalanceStatusBadge, { status }));
    assert.match(html, new RegExp(label, 'u'));
    assert.match(html, new RegExp(`data-state="${tone}"`, 'u'));
  }
});
