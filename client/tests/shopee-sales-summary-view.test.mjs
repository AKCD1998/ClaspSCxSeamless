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
        itemSubtotal: 168,
        orderNumber: '260901TEST001',
        orderedAt: '2026-09-01T02:00:00.000Z',
        quantity: 2,
        shopCode: 'sc-drug-store',
      },
      {
        itemSubtotal: 225,
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
  assert.match(html, /จำนวนหน่วยสินค้ารวม/);
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
  assert.match(html, /ค่าสินค้า/u);
  assert.match(html, /฿168/u);
  assert.match(html, /฿225/u);
  assert.match(html, /ไม่รวมค่าจัดส่ง/u);
  assert.match(html, /วันที่ออเดอร์/);
});

test('explains expanded inventory units for a multi-unit bundle', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule(
    '/src/components/ShopeeSalesSummaryPanel.jsx',
  );
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-09-01', shopCode: 'dr-morepen', startDate: '2026-09-01' },
    isLoading: false,
    onFilterChange: () => {},
    onSubmit: () => {},
    onToggleProduct: () => {},
    openProductId: 'bundle-1',
    status: { state: 'success', message: 'พร้อม' },
    summary: {
      orderCount: 1,
      productCount: 1,
      totalQuantity: 3,
      products: [{
        companySkus: ['IC-003478'],
        id: 'bundle-1',
        isBundle: true,
        name: 'Gluco One BG-03 Test Strip',
        orderCount: 1,
        quantityRuleStatus: 'verified',
        totalQuantity: 3,
        unitsPerSale: 3,
        variant: 'แผ่นตรวจ 25 3 กล่อง',
        orders: [{
          isBundle: true,
          itemSubtotal: 350,
          listingQuantity: 1,
          orderNumber: '260825976WKJ0D',
          orderedAt: '2026-08-25T00:29:54.000Z',
          quantity: 3,
          quantityRuleStatus: 'verified',
          shopCode: 'dr-morepen',
          unitsPerSale: 3,
        }],
      }],
    },
  }));

  assert.match(html, /IC-003478/u);
  assert.match(html, /shopee-sales-product-row--bundle/u);
  assert.match(html, /data-bundle="true"/u);
  assert.match(html, /แถวพื้นหลังสีเหลือง/u);
  assert.match(html, /BUNDLE · ต้องแกะ 1 ชุด = 3 หน่วย/u);
  assert.match(html, /1 ชุด = 3 หน่วย/u);
  assert.match(html, /1 ชุด[\s\S]*×[\s\S]*3/u);
  assert.match(html, /฿350/u);
  assert.match(html, /260825976WKJ0D/u);
});

test('does not highlight an ordinary product as a bundle', async () => {
  const html = await renderSummary();

  assert.doesNotMatch(html, /shopee-sales-product-row--bundle/u);
  assert.doesNotMatch(html, /แถวพื้นหลังสีเหลือง/u);
  assert.doesNotMatch(html, /BUNDLE/u);
});
