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
    isExporting: false,
    isLoading: false,
    onFilterChange: () => {},
    onExport: () => {},
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
  assert.match(html, /Export Excel/);
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

test('shows the provisional total without long calculation notes', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-08-31', shopCode: 'sc-drug-store', startDate: '2026-08-01' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' },
    summary: { ...summary, accounting: { status: 'provisional', calculatedSalesTotal: 146548,
      sourceBackedSalesTotal: null, sourceBackedOrderCount: 520, provisionalOrderCount: 60,
      quantityReviewOrderCount: 0 } },
  }));
  assert.match(html, /146,548/);
  assert.match(html, /ประมาณการบางส่วน/);
  assert.doesNotMatch(html, /ส่วนลดยังไม่ทราบ ไม่ใช่ศูนย์/);
  assert.doesNotMatch(html, /ยังต้องตรวจความครบถ้วนของทั้งช่วง/);
  assert.doesNotMatch(html, /ยอดขายรายออเดอร์/);
});

test('does not present missing monetary data as a zero total', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-08-31', shopCode: 'all', startDate: '2026-08-01' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' },
    summary: { ...summary, accounting: { status: 'incomplete', calculatedSalesTotal: null,
      sourceBackedOrderCount: 0, provisionalOrderCount: 2, quantityReviewOrderCount: 1 } },
  }));
  assert.match(html, /ยังรวมยอดไม่ได้ มีออเดอร์ขาดยอดเงิน/);
  assert.match(html, /ต้องตรวจสอบก่อนคีย์สินค้า/);
});

test('primary confirmed gross is separate from net orders and follows report dates', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-08-31', shopCode: 'all', startDate: '2026-08-01' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' },
    summary: { ...summary, confirmedSales: { startDate: '2026-08-01', endDate: '2026-08-31',
      status: 'source_backed', salesTotal: 171917, shops: [
        { shopCode: 'sc-drug-store', salesTotal: 154026, orderCount: 613, cancelledSales: 7478, coveredDays: 31, expectedDays: 31 },
        { shopCode: 'dr-morepen', salesTotal: 17891, orderCount: 36, cancelledSales: 350, coveredDays: 31, expectedDays: 31 },
      ] }, accounting: { calculatedSalesTotal: 164089, status: 'provisional', sourceBackedOrderCount: 554, provisionalOrderCount: 61 } },
  }));
  assert.match(html, /ยอดขายยืนยันแล้ว — ก่อนหักยกเลิก/);
  assert.match(html, /154,026/); assert.match(html, /17,891/);
  assert.match(html, /613/); assert.match(html, /36/);
  assert.match(html, /วันที่ในรายงานยืนยันแล้ว/);
  assert.doesNotMatch(html, /ไม่หักยอดยกเลิกออกจากยอดหลัก/);
  assert.doesNotMatch(html, /คนละเกณฑ์/);
  assert.ok(html.indexOf('154,026') < html.indexOf('164,089'));
});

test('missing official source is unavailable while explicit zero remains zero', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-08-01', shopCode: 'all', startDate: '2026-08-01' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' }, summary: { ...summary, confirmedSales: {
      startDate: '2026-08-01', endDate: '2026-08-01', status: 'incomplete', salesTotal: null,
      missingDays: [{ shopCode: 'dr-morepen', date: '2026-08-01' }], shops: [
        { shopCode: 'sc-drug-store', salesTotal: 0, orderCount: 0, cancelledSales: 0, coveredDays: 1, expectedDays: 1 },
        { shopCode: 'dr-morepen', salesTotal: null, orderCount: null, cancelledSales: null, coveredDays: 0, expectedDays: 1 },
      ],
    } },
  }));
  assert.match(html, /ยังสรุปยอดยืนยันแล้วไม่ได้ รายงานต้นทางไม่ครบ/);
  assert.match(html, /รายงานต้นทางไม่ครบ[\s\S]*1[\s\S]*วัน-ร้าน/);
  assert.match(html, /฿0/);
});
