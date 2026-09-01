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

const summary = {
  endDate: '2026-09-01',
  orderCount: 2,
  productCount: 1,
  startDate: '2026-09-01',
  totalQuantity: 5,
  products: [{
    companySkus: ['IC-001849'],
    id: '1',
    name: 'สินค้าทดสอบ',
    orderCount: 2,
    totalQuantity: 5,
    variant: '30 เม็ด',
    orders: [
      {
        orderNumber: '260901TEST001',
        orderedAt: '2026-09-01T02:00:00.000Z',
        quantity: 2,
        shopCode: 'sc-drug-store',
      },
      {
        orderNumber: '260901TEST002',
        orderedAt: '2026-09-01T03:00:00.000Z',
        quantity: 3,
        shopCode: 'dr-morepen',
      },
    ],
  }],
};

async function renderSummary(openProductId = '') {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule(
    '/src/components/ShopeeSalesSummaryPanel.jsx',
  );
  return renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-09-01', shopCode: 'all', startDate: '2026-09-01' },
    isLoading: false,
    onFilterChange: () => {},
    onSubmit: () => {},
    onToggleProduct: () => {},
    openProductId,
    status: { state: 'success', message: 'พร้อม' },
    summary,
  }));
}

test('renders totals and keeps order rows collapsed initially', async () => {
  const html = await renderSummary();

  assert.match(html, /สินค้าทดสอบ/);
  assert.match(html, /IC-001849/);
  assert.match(html, /จำนวนที่ขายรวม/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /260901TEST001/);
});

test('renders shop, order number, quantity, and order date when a product is expanded', async () => {
  const html = await renderSummary('1');

  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /SC Drug Store/);
  assert.match(html, /DR\.Morepen/);
  assert.match(html, /260901TEST001/);
  assert.match(html, /260901TEST002/);
  assert.match(html, /วันที่ออเดอร์/);
});
