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
        { shopCode: 'sc-drug-store', salesTotal: 154026, orderCount: 613, cancelledOrderCount: 33, cancelledSales: 7478, coveredDays: 31, expectedDays: 31 },
        { shopCode: 'dr-morepen', salesTotal: 17891, orderCount: 36, cancelledOrderCount: 1, cancelledSales: 350, coveredDays: 31, expectedDays: 31 },
      ] }, accounting: { calculatedSalesTotal: 164089, status: 'provisional', sourceBackedOrderCount: 554, provisionalOrderCount: 61 } },
  }));
  assert.match(html, /Business Insights — ภาพรวมยอดขาย/);
  assert.match(html, /ยอดขาย \(คำสั่งซื้อที่ได้รับการยืนยัน\) \(THB\)/);
  assert.match(html, /คำสั่งซื้อ\(ได้รับการยืนยัน\)/);
  assert.match(html, /คำสั่งซื้อที่ยกเลิก/);
  assert.match(html, /ยอดขายที่ยกเลิก/);
  assert.match(html, /154,026/); assert.match(html, /17,891/);
  assert.match(html, /613/); assert.match(html, /36/);
  assert.match(html, /154,026[\s\S]*613[\s\S]*33[\s\S]*7,478/);
  assert.match(html, /17,891[\s\S]*36[\s\S]*>1<[\s\S]*350/);
  assert.match(html, /วันที่:[\s\S]*01-08-2026[\s\S]*31-08-2026/);
  assert.doesNotMatch(html, /ไม่หักยอดยกเลิกออกจากยอดหลัก/);
  assert.doesNotMatch(html, /คนละเกณฑ์/);
  assert.ok(html.indexOf('154,026') < html.indexOf('164,089'));
});

test('does not invent cancellation zeroes when the current Business Insights file omits them', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-09-08', shopCode: 'sc-drug-store', startDate: '2026-09-08' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' },
    summary: { ...summary, confirmedSales: { startDate: '2026-09-08', endDate: '2026-09-08',
      status: 'source_backed', salesTotal: 17362, shops: [
        { shopCode: 'sc-drug-store', status: 'source_backed', salesTotal: 17362, orderCount: 57,
          cancelledOrderCount: null, cancelledSales: null, coveredDays: 1, expectedDays: 1 },
      ] } },
  }));
  assert.match(html, /ไม่มีในไฟล์รูปแบบนี้/);
  assert.match(html, /ระบบจึงเว้นข้อมูลไว้ ไม่ตีความเป็น 0/);
});

test('shows original source filename, freshness, import time and shortened SHA for audit', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const sha = 'abcdef1234567890'.padEnd(64, '0');
  const source = { sourceFilename: '142wuxqhgi.shopee-shop-stats.20260801-20260831.xlsx',
    sourceSha256: sha, observedAt: '2026-09-09T02:00:00.000Z', importedAt: '2026-09-09T02:05:00.000Z',
    coveredStartDate: '2026-08-01', coveredEndDate: '2026-08-31', coveredDays: 31 };
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-08-31', shopCode: 'sc-drug-store', startDate: '2026-08-01' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' },
    summary: { ...summary, confirmedSales: { startDate: '2026-08-01', endDate: '2026-08-31',
      status: 'source_backed', salesTotal: 154026, missingDays: [], shops: [{ shopCode: 'sc-drug-store',
        salesTotal: 154026, orderCount: 613, cancelledOrderCount: 33, cancelledSales: 7478,
        coveredDays: 31, expectedDays: 31, latestDataDate: '2026-08-31', sources: [source] }] } },
  }));
  assert.match(html, /หลักฐานไฟล์ต้นทางและความสดของข้อมูล/u);
  assert.match(html, /142wuxqhgi\.shopee-shop-stats\.20260801-20260831\.xlsx/u);
  assert.match(html, /31-08-2026/u);
  assert.match(html, /abcdef123456[\s\S]*…/u);
  assert.match(html, /ตรวจพบไฟล์/u);
  assert.match(html, /นำเข้าระบบ/u);
});

test('missing official source is unavailable while explicit zero remains zero', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-08-01', shopCode: 'all', startDate: '2026-08-01' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' }, summary: { ...summary, confirmedSales: {
      startDate: '2026-08-01', endDate: '2026-08-01', status: 'incomplete', salesTotal: null,
      missingDays: [{ shopCode: 'dr-morepen', date: '2026-08-01' }], shops: [
        { shopCode: 'sc-drug-store', salesTotal: 0, orderCount: 0, cancelledOrderCount: 0, cancelledSales: 0, coveredDays: 1, expectedDays: 1 },
        { shopCode: 'dr-morepen', salesTotal: null, orderCount: null, cancelledOrderCount: null, cancelledSales: null, coveredDays: 0, expectedDays: 1 },
      ],
    } },
  }));
  assert.match(html, /ยอดขาย \(คำสั่งซื้อที่ได้รับการยืนยัน\) \(THB\):[\s\S]*ยังสรุปไม่ได้ รายงานต้นทางไม่ครบ/);
  assert.match(html, /รายงานต้นทางไม่ครบ[\s\S]*1[\s\S]*วัน-ร้าน/);
  assert.match(html, /฿0/);
});

test('shows weekly finance reconciliation and exceptional-case evidence using Shopee labels', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-09-06', shopCode: 'all', startDate: '2026-08-31' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' },
    summary: { ...summary, officialDocuments: {
      finance: [{
        shopCode: 'sc-drug-store', startDate: '2026-08-31', endDate: '2026-09-06',
        status: 'source_backed', statementTotal: 76618,
        incomeTransferredTotal: 76618, incomeTransferredOrderCount: 417,
        zeroPayoutOrderCount: 1, sellerBalanceOrderTotal: 76618,
        sellerBalanceOrderCount: 416, sellerBalanceAdjustmentTotal: 0,
        sellerBalanceAdjustmentCount: 0,
      }],
      returns: [{
        shopCode: 'sc-drug-store', startDate: '2026-08-31', endDate: '2026-09-06',
        status: 'source_backed', cancelledOrderCount: 5, cancelledNetSales: 1200,
        failedDeliveryOrderCount: 1, failedDeliveryNetSales: 200,
        returnRefundRequestCount: 2, totalRefundAmount: 497,
        coveredDayCount: 7, expectedDayCount: 7,
      }],
    } },
  }));
  assert.match(html, /ตรวจเอกสารการเงินรายสัปดาห์/u);
  assert.match(html, /รายงานการเงิน/u);
  assert.match(html, /รายละเอียดรายรับของฉัน/u);
  assert.match(html, /Seller Balance/u);
  assert.match(html, /76,618/u);
  assert.match(html, /ยอดโอน ฿0 จำนวน [\s\S]*1[\s\S]* รายการ/u);
  assert.match(html, /คำสั่งซื้อที่ยกเลิก \/ คืนเงินหรือคืนสินค้า \/ จัดส่งไม่สำเร็จ/u);
  assert.match(html, /ราคาขายสุทธิ/u);
  assert.match(html, /จำนวนเงินคืนทั้งหมด/u);
});

test('shows separate cancellations and returns plus a deduplicated payout/downstream bridge', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const stage = (officialAmount, reconstructedAmount, variance, status = 'unresolved') => ({
    officialAmount, reconstructedAmount, variance, officialOrderCount: 2,
    reconstructedOrderCount: 2, status,
  });
  const daily = {
    shopCode: 'sc-drug-store', date: '2026-08-25', status: 'unresolved',
    salesBatch: stage(100, 120, 20),
    creditNotes: stage(20, 40, 20),
    returns: stage(0, 0, 0, 'reconciled'),
    confirmedNet: stage(80, 80, 0, 'reconciled'),
    unresolved: [{ reasonCode: 'gross_snapshot_variance',
      message: 'ยอด snapshot เดิมไม่ครบ', orderNumbers: ['260825TEST001'] }],
  };
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-08-25', shopCode: 'sc-drug-store', startDate: '2026-08-25' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' },
    summary: { ...summary, reconciliation: {
      status: 'unresolved', shops: [{ shopCode: 'sc-drug-store', status: 'unresolved',
        salesBatch: daily.salesBatch, creditNotes: daily.creditNotes, returns: daily.returns,
        confirmedNet: daily.confirmedNet,
        sellerVoucherRestoration: { restoredAmount: 20, restoredOrderCount: 2,
          orderNumbers: ['2608259QFHDAH8', '260825ASAD4CXS'], campaigns: [{
            voucherId: 'SVC-1489610191827020', voucherName: 'VCMT BAU 24-30 Aug',
            validFrom: '2026-08-23T17:00:00.000Z', validTo: '2026-08-30T16:59:59.999Z',
            discountRate: 0.05, maxDiscount: 10, minSpend: 110, appliesToAllProducts: true,
            sourceUrl: 'https://seller.shopee.co.th/portal/marketing/vouchers/view?edit=1489610191827020',
            sourceObservedAt: '2026-09-09T17:00:00.000Z', sourceObservedPrecision: 'date',
            sourceNotes: 'Seller Centre voucher detail.',
          }] },
        payoutBridge: { income: { latestState: {
          pending: { factCount: 0, linkedOrderCount: 0, payoutAmount: 0 },
          transferred: { factCount: 1, linkedOrderCount: 1, payoutAmount: 80,
            componentBridge: { additiveComponentTotal: 78, unexplainedResidual: 2,
              components: [{ key: 'commissionFee', label: 'ค่าคอมมิชชั่น', amount: -20, additive: true }],
              evidence: [{ sourceFilename: 'income-sep.xlsx', sourceSha256: 'a'.repeat(64),
                observedAt: '2026-09-10T08:00:00.000Z' }] } },
        } } },
        downstreamControls: { financialStatements: [{ periodStart: '2026-09-01', periodEnd: '2026-09-07',
          transferredTotal: 80, evidence: { sourceFilename: 'statement-sep.pdf',
            sourceSha256: 'b'.repeat(64), observedAt: '2026-09-10T08:00:00.000Z' } }],
          sellerBalanceAdjustments: [], unlinkedSources: [{ reportType: 'seller-balance',
            periodStart: '2026-08-25', periodEnd: '2026-08-31', evidence: {
              sourceFilename: 'balance-unlinked.xlsx', sourceSha256: 'c'.repeat(64),
              observedAt: '2026-09-10T08:00:00.000Z' } }] },
      }],
      aggregates: { daily: [daily] },
    } },
  }));
  assert.match(html, /การสืบย้อนยอดการเงิน/u);
  assert.match(html, /เวลาการชำระสินค้า/u);
  assert.match(html, /ยอดขายที่ยกเลิก/u);
  assert.match(html, /ยอดขายที่คืนเงิน\/คืนสินค้า/u);
  assert.match(html, /ยอดขายยืนยันแล้วสุทธิ/u);
  assert.match(html, /กู้คืนค่า “โค้ดส่วนลดชำระโดยผู้ขาย” จากหลักฐาน/u);
  assert.match(html, /SVC-1489610191827020[\s\S]*VCMT BAU 24-30 Aug/u);
  assert.match(html, /5[\s\S]*%[\s\S]*สูงสุด[\s\S]*฿10[\s\S]*ขั้นต่ำ[\s\S]*฿110/u);
  assert.match(html, /2608259QFHDAH8[\s\S]*260825ASAD4CXS/u);
  assert.match(html, /ไม่ใช่เงินคืนให้ลูกค้า/u);
  assert.match(html, /เปิดหลักฐาน Seller Centre/u);
  assert.match(html, /สถานะล่าสุด: โอนสำเร็จ/u);
  assert.match(html, /ค่าคอมมิชชั่น/u);
  assert.match(html, /ส่วนที่ยังอธิบายไม่ได้:[\s\S]*฿2/u);
  assert.match(html, /income-sep\.xlsx[\s\S]*aaaaaaaaaaaa/u);
  assert.match(html, /Financial Statement[\s\S]*2026-09-01[\s\S]*2026-09-07/u);
  assert.match(html, /ยังไม่เชื่อมกับรอบ Income:[\s\S]*balance-unlinked\.xlsx/u);
  assert.doesNotMatch(html, /สถานะล่าสุด: รอดำเนินการ/u);
  assert.match(html, /ไม่ได้ถูกบังคับให้เท่ากับยอดขาย/u);
  assert.match(html, /260825TEST001/u);
  assert.match(html, /ส่วนต่าง:[\s\S]*฿20/u);
});

test('shows an exact reconciliation after evidence-backed seller-voucher restoration', async () => {
  const { ShopeeSalesSummaryView } = await vite.ssrLoadModule('/src/components/ShopeeSalesSummaryPanel.jsx');
  const stage = (amount, count) => ({
    officialAmount: amount, reconstructedAmount: amount, variance: 0,
    officialOrderCount: count, reconstructedOrderCount: count, status: 'reconciled',
  });
  const restoration = {
    restoredAmount: 110, restoredOrderCount: 11,
    orderNumbers: ['2608259QFHDAH8', '260825ASAD4CXS', '260828G1PS9JAG'],
    campaigns: [{
      voucherId: 'SVC-1489610191827020', voucherName: 'VCMT BAU 24-30 Aug',
      validFrom: '2026-08-23T17:00:00.000Z', validTo: '2026-08-30T16:59:59.999Z',
      discountRate: 0.05, maxDiscount: 10, minSpend: 110, appliesToAllProducts: true,
      sourceUrl: 'https://seller.shopee.co.th/portal/marketing/vouchers/view?edit=1489610191827020',
      sourceObservedAt: '2026-09-09T17:00:00.000Z', sourceObservedPrecision: 'date',
      sourceNotes: 'Seller Centre voucher detail.',
    }],
  };
  const shop = {
    shopCode: 'sc-drug-store', status: 'reconciled',
    salesBatch: stage(154026, 613), creditNotes: stage(7478, 33),
    returns: stage(0, 0), confirmedNet: stage(146548, 580),
    sellerVoucherRestoration: restoration,
  };
  const html = renderToString(React.createElement(ShopeeSalesSummaryView, {
    filters: { endDate: '2026-08-31', shopCode: 'sc-drug-store', startDate: '2026-08-01' },
    onFilterChange: () => {}, onSubmit: () => {}, onToggleProduct: () => {},
    status: { state: 'success', message: 'พร้อม' },
    summary: { ...summary, reconciliation: {
      status: 'reconciled', shops: [shop],
      aggregates: { daily: [{ ...shop, date: '2026-08-25', unresolved: [],
        sellerVoucherRestoration: restoration }] },
    } },
  }));
  assert.match(html, /ตรงกัน ส่วนต่าง ฿0\.00/u);
  assert.match(html, /รายวันตรงกันครบทุกวันในช่วงที่เลือก/u);
  assert.match(html, /กู้คืนค่า “โค้ดส่วนลดชำระโดยผู้ขาย” จากหลักฐาน[\s\S]*฿110/u);
  assert.match(html, /154,026[\s\S]*7,478[\s\S]*146,548/u);
  assert.doesNotMatch(html, /ยังมีส่วนต่างที่ต้องสืบย้อน/u);
});
