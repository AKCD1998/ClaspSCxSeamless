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
    filters: { shopCode: 'all', status: '' },
    isLoading: false,
    isLoadingMore: false,
    isSyncing: false,
    nextCursor: null,
    onFilterChange: noop,
    onLoadMore: noop,
    onRetry: noop,
    onRetryDetail: noop,
    onSyncLatest: noop,
    onSyncOlder: noop,
    onToggleDetail: noop,
    orderDetail: null,
    orders: [],
    selectedOrderKey: null,
    status: { message: 'พร้อม', state: 'success' },
    syncCursor: null,
    syncStatus: { message: '', state: 'idle' },
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
  assert.match(html, /IC-001849/u);
});

test('renders chronological event detail and bounded cancellation evidence', async () => {
  const html = await renderView({
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
    filters: { shopCode: 'sc-drug-store', status: '' },
    syncCursor: 'opaque-gmail-cursor',
    syncStatus: { message: 'บันทึกเหตุการณ์ใหม่ 1 รายการ', state: 'success' },
  });

  assert.match(html, /ซิงก์อีเมลล่าสุด/);
  assert.match(html, /ซิงก์อีเมลหน้าก่อนหน้า/);
  assert.match(html, /บันทึกเหตุการณ์ใหม่ 1 รายการ/);
});

test('all-shops view is readable but cannot start a mailbox sync', async () => {
  const html = await renderView({
    appRole: 'admin',
    canSync: false,
    filters: { shopCode: 'all', status: '' },
  });

  assert.match(html, /<button disabled=""[^>]*>ซิงก์อีเมลล่าสุด<\/button>/u);
  assert.match(html, /เลือก SC Drug Store หรือ DR.Morepen เพื่อซิงก์ทีละร้าน/u);
});

test('replacement clears stale rows and ignores a previous page completion', async () => {
  const { INITIAL_SHOPEE_ORDER_STATE, shopeeOrderReducer } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  let state = shopeeOrderReducer(INITIAL_SHOPEE_ORDER_STATE, {
    type: 'replacement_started', generation: 1,
  });
  state = shopeeOrderReducer(state, {
    type: 'replacement_succeeded', generation: 1, response: { orders: [order], nextCursor: 'old' },
  });
  state = shopeeOrderReducer(state, { type: 'replacement_started', generation: 2 });

  assert.deepEqual(state.orders, []);
  assert.equal(state.nextCursor, null);
  const stale = shopeeOrderReducer(state, {
    type: 'load_more_succeeded', generation: 1, response: { orders: [{ orderNumber: 'stale' }] },
  });
  assert.strictEqual(stale, state);
});

test('combined pagination keeps the same order number from different shops', async () => {
  const { INITIAL_SHOPEE_ORDER_STATE, shopeeOrderReducer } = await vite.ssrLoadModule(
    '/src/components/ShopeeOrderTimelinePanel.jsx',
  );
  const state = {
    ...INITIAL_SHOPEE_ORDER_STATE,
    generation: 1,
    orders: [{ ...order, shopCode: 'sc-drug-store' }],
  };
  const next = shopeeOrderReducer(state, {
    type: 'load_more_succeeded',
    generation: 1,
    response: { orders: [{ ...order, shopCode: 'dr-morepen' }] },
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
    nextCursor: 'old-cursor',
    orders: [order],
  };
  const state = shopeeOrderReducer(stale, { type: 'shop_required', generation: 4 });

  assert.equal(state.generation, 4);
  assert.deepEqual(state.orders, []);
  assert.equal(state.nextCursor, null);
  assert.match(state.status.message, /เลือกร้าน Shopee/u);
});
