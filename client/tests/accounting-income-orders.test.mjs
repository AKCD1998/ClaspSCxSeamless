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

test('Income table renders requested fields, Seller Balance evidence, shared date controls, and pagination', async () => {
  const { default: Table, PAGE_SIZE } = await vite.ssrLoadModule(
    '/src/components/AccountingIncomeOrdersTable.jsx',
  );
  assert.equal(PAGE_SIZE, 10);
  const html = renderToString(React.createElement(Table));
  assert.equal((html.match(/<th(?:>|\s)/g) || []).length, 7);
  assert.match(html, /type="search"/);
  assert.equal((html.match(/type="date"/g) || []).length, 2);
  assert.match(html, /value="orderedAt"/);
  assert.match(html, /value="transferredAt" selected=""/);
  assert.match(html, /aria-label="หน้ารายการ Income"/);
  assert.match(html, /ก่อนหน้า/);
  assert.match(html, /ถัดไป/);
  assert.match(html, /สถานะ Seller Balance/u);
  assert.match(html, /วันที่เงินเข้า Seller Balance/u);
  assert.match(html, /ยอดสุทธิ Seller Balance/u);
  assert.match(html, /accounting-income-balance-net-col/u);
  assert.match(html, /ไม่ใช่หลักฐานการชำระของลูกค้าโดยตรง/u);
  assert.match(html, /Order All/u);
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
