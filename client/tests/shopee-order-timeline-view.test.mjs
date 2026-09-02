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

const noop = () => {};
const order = {
  currentStatus: 'order_cancelled',
  eventCount: 3,
  itemCount: 1,
  itemSubtotal: 168,
  items: [{
    name: 'สินค้าทดสอบ',
    quantity: 2,
    unitPrice: 84,
    variant: '9 กรัม',
    productMatch: { status: 'matched', companySku: 'IC-001849' },
  }],
  lastEventAt: '2026-08-24T05:37:17.000Z',
  orderNumber: '26082476830R2P',
  shippingDeadline: '2026-08-30',
  shippingFee: 29,
  shopCode: 'sc-drug-store',
  totalAmount: 197,
  totalQuantity: 2,
};

async function renderView(overrides = {}) {
  const { default: View } = await vite.ssrLoadModule('/src/components/ShopeeOrderTimelineView.jsx');
  return renderToString(React.createElement(View, {
    appRole: 'user',
    canSync: false,
    detailStatus: { message: '', state: 'idle' },
    financialVisibility: {
      itemSubtotal: true,
      shippingFee: false,
      totalAmount: false,
      unitPrice: false,
    },
    financialVisibilityStatus: { message: '', state: 'idle' },
    filters: {
      limit: 25,
      page: 1,
      search: '',
      shopCode: 'all',
      sortBy: 'lastEventAt',
      sortOrder: 'desc',
      status: '',
    },
    isLoading: false,
    isSyncing: false,
    isSavingFinancialVisibility: false,
    onFinancialVisibilityChange: noop,
    onFilterChange: noop,
    onSearchChange: noop,
    onSaveFinancialVisibility: noop,
    onPageChange: noop,
    onRetry: noop,
    onRetryDetail: noop,
    onSyncLatest: noop,
    onSyncOlder: noop,
    onToggleDetail: noop,
    orderDetail: null,
    orders: [],
    page: 1,
    pageSize: 25,
    selectedOrderKey: null,
    searchValue: '',
    status: { message: 'พร้อม', state: 'success' },
    syncCursor: null,
    syncStatus: { message: '', state: 'idle' },
    totalCount: 0,
    totalPages: 0,
    userFinancialVisibility: {
      itemSubtotal: true,
      shippingFee: false,
      totalAmount: false,
      unitPrice: false,
    },
    ...overrides,
  }));
}

test('renders an order summary with distinct status color hooks and no admin sync controls', async () => {
  const html = await renderView({ orders: [order] });

  assert.match(html, /26082476830R2P/);
  assert.match(html, /data-category="order_cancelled"/);
  assert.match(html, /ยกเลิกคำสั่งซื้อ/);
  assert.match(html, /ดู 3/);
  assert.doesNotMatch(html, /ซิงก์อีเมลล่าสุด/);
  assert.doesNotMatch(html, /buyer|username|subject|bodyText/iu);
  assert.match(html, /name="shopCode"/u);
  assert.match(html, /SC Drug Store/u);
  assert.match(html, /DR.Morepen/u);
  assert.match(html, /ทุกร้าน/u);
  assert.match(html, /<th>ร้าน<\/th>/u);
  assert.match(html, /<th>Company SKU<\/th>/u);
  assert.match(html, /<th>ค่าสินค้า<\/th>/u);
  assert.doesNotMatch(html, /<th>ค่าจัดส่ง<\/th>|<th>ยอดรวม<\/th>/u);
  assert.match(html, /฿168/u);
  assert.doesNotMatch(html, /฿197/u);
  assert.match(html, /IC-001849/u);
});

test('regular-user detail shows item subtotal only even if hidden values are supplied', async () => {
  const html = await renderView({
    orders: [order],
    selectedOrderKey: `${order.shopCode}:${order.orderNumber}`,
    detailStatus: { message: '', state: 'success' },
    orderDetail: {
      order,
      events: [],
    },
  });

  assert.match(html, /ค่าสินค้า[\s\S]*฿168/u);
  assert.doesNotMatch(html, /ค่าจัดส่ง|ยอดรวม|฿29|฿197|× ฿84/u);
  assert.match(html, /จำนวน [\s\S]*2/u);
});

test('renders one live search field for every visible table column and every page', async () => {
  const html = await renderView();

  assert.match(html, /type="search"/u);
  assert.match(html, /name="search"/u);
  assert.match(html, /aria-label="ค้นหาทั้งตาราง"/u);
  assert.match(html, /ร้าน เลขคำสั่งซื้อ สถานะ สินค้า SKU ยอด หรือวันที่/u);
  assert.match(html, /ค้นหาอัตโนมัติจากทุกคอลัมน์และทุกหน้า/u);
  assert.equal((html.match(/type="search"/gu) || []).length, 1);
});

test('shows a search-specific empty state', async () => {
  const html = await renderView({
    filters: {
      limit: 25,
      page: 1,
      search: 'IC-001849',
      shopCode: 'all',
      sortBy: 'lastEventAt',
      sortOrder: 'desc',
      status: '',
    },
    searchValue: 'IC-001849',
  });

  assert.match(html, /ไม่พบคำสั่งซื้อที่ตรงกับคำค้นหา/u);
});

test('normalizes a live search without forcing the user to choose a field', async () => {
  const { normalizeShopeeOrderSearch } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );

  assert.equal(normalizeShopeeOrderSearch('  IC-001849   สินค้าทดสอบ  '), 'IC-001849 สินค้าทดสอบ');
});

test('renders chronological event detail and bounded cancellation evidence', async () => {
  const html = await renderView({
    financialVisibility: {
      itemSubtotal: true,
      shippingFee: true,
      totalAmount: true,
      unitPrice: true,
    },
    orders: [order],
    selectedOrderKey: `${order.shopCode}:${order.orderNumber}`,
    detailStatus: { message: '', state: 'success' },
    orderDetail: {
      order: { ...order, itemSubtotal: 168, shippingFee: 38 },
      events: [
        { id: 'event-1', eventType: 'order_confirmed', occurredAt: '2026-08-24T03:00:00.000Z', details: {} },
        { id: 'event-2', eventType: 'shipment_due', occurredAt: '2026-08-24T04:00:00.000Z', details: { shippingDeadline: '2026-08-30' } },
        { id: 'event-3', eventType: 'order_cancelled', occurredAt: '2026-08-24T05:00:00.000Z', details: { cancellationReasonCode: 'shipping_deadline_missed' } },
      ],
    },
  });

  assert.match(html, /สินค้าและยอดชำระ/);
  assert.match(html, /เหตุการณ์ตามลำดับเวลา/);
  assert.match(html, /จัดส่งสินค้าไม่ทันเวลาที่กำหนด/);
  assert.match(html, /ตัวเลือก:[\s\S]*9 กรัม/);
  assert.match(html, /data-match-status="matched"/u);
  assert.match(html, /IC-001849/u);
  assert.match(html, /ค่าจัดส่ง[\s\S]*฿38/u);
  assert.match(html, /ยอดรวม[\s\S]*฿197/u);
  assert.match(html, /× ฿84/u);
});

test('renders component bundles and visibility-only listings without fabricating a Company SKU', async () => {
  const html = await renderView({
    orders: [{
      ...order,
      items: [{
        ...order.items[0],
        productMatch: {
          status: 'bundle',
          components: [
            { companySku: 'IC-003230', quantityPerSale: null },
            { companySku: 'IC-003478', quantityPerSale: null },
          ],
        },
      }],
    }],
    selectedOrderKey: `${order.shopCode}:${order.orderNumber}`,
    detailStatus: { message: '', state: 'success' },
    orderDetail: {
      order: {
        ...order,
        items: [{
          ...order.items[0],
          productMatch: {
            status: 'visibility_only',
            reasonCode: 'never_sold_visibility_listing',
          },
        }],
      },
      events: [],
    },
  });

  assert.match(html, /IC-003230 \+ IC-003478/u);
  assert.match(html, /data-match-status="visibility_only"/u);
  assert.match(html, /สินค้าเพิ่มการมองเห็น/u);
  assert.doesNotMatch(html, /IC-003230\+IC-003478/u);
});

test('shows both bounded Gmail sync actions only to admins', async () => {
  const html = await renderView({
    appRole: 'admin',
    canSync: true,
    filters: { shopCode: 'sc-drug-store', sortBy: 'lastEventAt', sortOrder: 'desc', status: '' },
    syncCursor: 'opaque-gmail-cursor',
    syncStatus: { message: 'บันทึกเหตุการณ์ใหม่ 1 รายการ', state: 'success' },
  });

  assert.match(html, /ซิงก์อีเมลล่าสุด/);
  assert.match(html, /ซิงก์อีเมลหน้าก่อนหน้า/);
  assert.match(html, /บันทึกเหตุการณ์ใหม่ 1 รายการ/);
  assert.match(html, /ตั้งค่าข้อมูลการเงินที่แสดงใน Timeline/u);
  assert.match(html, /name="unitPrice"/u);
  assert.match(html, /name="shippingFee"/u);
  assert.match(html, /name="totalAmount"/u);
});

test('regular users never receive the financial visibility settings controls', async () => {
  const html = await renderView({ appRole: 'user', orders: [order] });

  assert.doesNotMatch(html, /ตั้งค่าข้อมูลการเงินที่แสดงใน Timeline/u);
  assert.doesNotMatch(html, /บันทึกการแสดงผล/u);
});

test('admins follow the shared default and see item subtotal only', async () => {
  const html = await renderView({
    appRole: 'admin',
    orders: [order],
  });

  assert.match(html, /<th>ค่าสินค้า<\/th>/u);
  assert.doesNotMatch(html, /<th>ค่าจัดส่ง<\/th>|<th>ยอดรวม<\/th>/u);
  assert.match(html, /฿168/u);
  assert.doesNotMatch(html, /฿29|฿197/u);
  assert.match(html, /การตั้งค่านี้มีผลกับทุกบัญชี รวมถึง admin/u);
});

test('admins see extra financial fields only when enabled in the shared setting', async () => {
  const html = await renderView({
    appRole: 'admin',
    financialVisibility: {
      itemSubtotal: true,
      shippingFee: true,
      totalAmount: true,
      unitPrice: true,
    },
    orders: [order],
  });

  assert.match(html, /<th>ค่าสินค้า<\/th>/u);
  assert.match(html, /<th>ค่าจัดส่ง<\/th>/u);
  assert.match(html, /<th>ยอดรวม<\/th>/u);
  assert.match(html, /฿168/u);
  assert.match(html, /฿29/u);
  assert.match(html, /฿197/u);
});

test('all-shops view is readable but cannot start a mailbox sync', async () => {
  const html = await renderView({
    appRole: 'admin',
    canSync: false,
    filters: { shopCode: 'all', sortBy: 'lastEventAt', sortOrder: 'desc', status: '' },
  });

  assert.match(html, /<button disabled=""[^>]*>ซิงก์อีเมลล่าสุด<\/button>/u);
  assert.match(html, /เลือก SC Drug Store หรือ DR.Morepen เพื่อซิงก์ทีละร้าน/u);
});

test('renders numbered pagination and database-backed date/document sorting controls', async () => {
  const html = await renderView({
    orders: [order],
    page: 6,
    totalCount: 315,
    totalPages: 13,
  });

  assert.match(html, /name="sortBy"/u);
  assert.match(html, /วันที่อัปเดต/u);
  assert.match(html, /เลขคำสั่งซื้อ/u);
  assert.match(html, /name="sortOrder"/u);
  assert.match(html, /หน้า [\s\S]*6[\s\S]* จาก [\s\S]*13/u);
  assert.match(html, /aria-current="page" aria-label="หน้าปัจจุบัน 6"/u);
  assert.match(html, /aria-current="page"[^>]*disabled=""[^>]*>6</u);
  assert.match(html, />…</u);
  assert.doesNotMatch(html, /โหลดคำสั่งซื้อเพิ่ม/u);
});

test('replacement clears stale rows and ignores a previous page completion', async () => {
  const { INITIAL_SHOPEE_ORDER_STATE, shopeeOrderReducer } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  let state = shopeeOrderReducer(INITIAL_SHOPEE_ORDER_STATE, {
    type: 'replacement_started', generation: 1,
  });
  state = shopeeOrderReducer(state, {
    type: 'replacement_succeeded', generation: 1,
    response: { orders: [order], page: 1, pageSize: 25, totalCount: 30, totalPages: 2 },
  });
  state = shopeeOrderReducer(state, { type: 'replacement_started', generation: 2 });

  assert.deepEqual(state.orders, []);
  const stale = shopeeOrderReducer(state, {
    type: 'replacement_succeeded', generation: 1,
    response: { orders: [{ orderNumber: 'stale' }], page: 2, totalCount: 30, totalPages: 2 },
  });
  assert.strictEqual(stale, state);
});

test('a numbered all-shops page keeps the same order number from different shops', async () => {
  const { INITIAL_SHOPEE_ORDER_STATE, shopeeOrderReducer } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  const next = shopeeOrderReducer({ ...INITIAL_SHOPEE_ORDER_STATE, generation: 1 }, {
    type: 'replacement_succeeded',
    generation: 1,
    response: {
      orders: [
        { ...order, shopCode: 'sc-drug-store' },
        { ...order, shopCode: 'dr-morepen' },
      ],
      page: 1,
      pageSize: 25,
      totalCount: 2,
      totalPages: 1,
    },
  });

  assert.equal(next.orders.length, 2);
  assert.deepEqual(next.orders.map((item) => item.shopCode), ['sc-drug-store', 'dr-morepen']);
});

test('an in-flight sync refreshes the newest filter after the user changes it', async () => {
  const { syncShopeeOrdersAndRefresh } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  let completeSync;
  let syncOptions;
  const syncRequest = (options) => {
    syncOptions = options;
    return new Promise((resolve) => { completeSync = resolve; });
  };
  const filtersRef = { current: { shopCode: 'sc-drug-store', status: 'shipment_due' } };
  const loadedFilters = [];
  const syncedResults = [];
  let renderedRows = [];
  const loadOrders = async (activeFilters) => {
    loadedFilters.push({ ...activeFilters });
    renderedRows = [{ orderNumber: `row-${activeFilters.status}` }];
  };

  const pendingSync = syncShopeeOrdersAndRefresh({
    cursor: null,
    filtersRef,
    loadOrders,
    onSynced: (result) => syncedResults.push(result),
    syncRequest,
  });
  filtersRef.current = { shopCode: 'dr-morepen', status: 'order_cancelled' };
  completeSync({ storedEvents: 1 });
  await pendingSync;

  assert.deepEqual(syncOptions, { cursor: null, limit: 25, shopCode: 'sc-drug-store' });
  assert.deepEqual(loadedFilters, [{ shopCode: 'dr-morepen', status: 'order_cancelled' }]);
  assert.deepEqual(renderedRows, [{ orderNumber: 'row-order_cancelled' }]);
  assert.deepEqual(syncedResults, []);
});

test('an in-flight sync publishes its cursor and status only while the same shop is selected', async () => {
  const { syncShopeeOrdersAndRefresh } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  const filtersRef = { current: { shopCode: 'sc-drug-store', status: '' } };
  const syncedResults = [];

  await syncShopeeOrdersAndRefresh({
    cursor: 'cursor-1',
    filtersRef,
    loadOrders: async () => {},
    onSynced: (result) => syncedResults.push(result),
    syncRequest: async () => ({ nextCursor: 'cursor-2', storedEvents: 1 }),
  });

  assert.deepEqual(syncedResults, [{ nextCursor: 'cursor-2', storedEvents: 1 }]);
});

test('all-shops scope is rejected before issuing a sync request', async () => {
  const { syncShopeeOrdersAndRefresh } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  let requested = false;

  await assert.rejects(
    syncShopeeOrdersAndRefresh({
      cursor: null,
      filtersRef: { current: { shopCode: 'all', status: '' } },
      loadOrders: async () => {},
      syncRequest: async () => { requested = true; },
    }),
    /เลือกร้าน SC Drug Store หรือ DR.Morepen/u,
  );
  assert.equal(requested, false);
});

test('a detail response is stale when the same order number is selected under another shop', async () => {
  const { isShopeeDetailRequestCurrent } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  const filtersRef = { current: { shopCode: 'dr-morepen' } };
  const selectedOrderRef = {
    current: { orderNumber: '260825ABC', shopCode: 'dr-morepen' },
  };

  assert.equal(isShopeeDetailRequestCurrent({
    filtersRef,
    orderNumber: '260825ABC',
    selectedOrderRef,
    shopCode: 'sc-drug-store',
    viewShopScope: 'sc-drug-store',
  }), false);
  assert.equal(isShopeeDetailRequestCurrent({
    filtersRef,
    orderNumber: '260825ABC',
    selectedOrderRef,
    shopCode: 'dr-morepen',
    viewShopScope: 'dr-morepen',
  }), true);
});

test('shop-required state clears rows without issuing a cross-shop default', async () => {
  const { INITIAL_SHOPEE_ORDER_STATE, shopeeOrderReducer } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  const stale = {
    ...INITIAL_SHOPEE_ORDER_STATE,
    orders: [order],
    page: 3,
    totalCount: 51,
    totalPages: 3,
  };
  const state = shopeeOrderReducer(stale, { type: 'shop_required', generation: 4 });

  assert.equal(state.generation, 4);
  assert.deepEqual(state.orders, []);
  assert.equal(state.page, 1);
  assert.equal(state.totalPages, 0);
  assert.match(state.status.message, /เลือกร้าน Shopee/u);
});
