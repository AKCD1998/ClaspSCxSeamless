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

async function renderView(overrides = {}) {
  const { default: ShopeeEmailInboxView } = await vite.ssrLoadModule(
    '/src/components/ShopeeEmailInboxView.jsx',
  );
  return renderToString(
    React.createElement(ShopeeEmailInboxView, {
      emails: [],
      filters: { category: '', receivedFrom: '', receivedTo: '' },
      isLoading: false,
      isLoadingMore: false,
      nextCursor: null,
      onFilterChange: noop,
      onLoadMore: noop,
      onRetry: noop,
      source: 'info@mail.shopee.co.th',
      status: { message: 'พร้อม', state: 'success' },
      ...overrides,
    }),
  );
}

test('renders classified Shopee email rows without exposing message bodies', async () => {
  const html = await renderView({
    emails: [
      {
        id: 'gmail-1',
        category: 'order_confirmed',
        from: 'Shopee <info@mail.shopee.co.th>',
        orderNumber: '26082476830R2P',
        receivedAt: '2026-08-24T05:37:17.000Z',
        subject: 'คำสั่งซื้อชำระเงินปลายทาง #26082476830R2P ถูกยืนยันแล้ว',
        unread: true,
      },
    ],
    nextCursor: 'next-page',
  });

  assert.match(html, /ยืนยันคำสั่งซื้อ COD/);
  assert.match(html, /26082476830R2P/);
  assert.match(html, /ยังไม่อ่าน/);
  assert.match(html, /โหลดเพิ่ม/);
  assert.doesNotMatch(html, /snippet|bodyText/);
});

test('renders the empty and error states with a retry action', async () => {
  const empty = await renderView();
  assert.match(empty, /ไม่พบอีเมล Shopee ตามเงื่อนไขที่เลือก/);

  const failed = await renderView({ status: { message: 'Gmail ไม่พร้อมใช้งาน', state: 'error' } });
  assert.match(failed, /Gmail ไม่พร้อมใช้งาน/);
  assert.match(failed, /ลองใหม่/);
});

test('keeps pagination available when every message in a Gmail page was skipped', async () => {
  const html = await renderView({ emails: [], nextCursor: 'next-after-skipped-page' });

  assert.match(html, /ไม่พบอีเมล Shopee ตามเงื่อนไขที่เลือก/);
  assert.match(html, /โหลดเพิ่ม/);
});

test('date filter transition keeps a valid one-day range', async () => {
  const { applyShopeeEmailFilterChange } = await vite.ssrLoadModule(
    '/src/components/ShopeeEmailInboxPanel.jsx',
  );

  assert.deepEqual(
    applyShopeeEmailFilterChange(
      { category: '', receivedFrom: '2026-08-20', receivedTo: '2026-08-24' },
      'receivedFrom',
      '2026-08-25',
    ),
    { category: '', receivedFrom: '2026-08-25', receivedTo: '2026-08-25' },
  );
});

test('filter replacement clears the old rows/cursor and ignores stale load-more completion', async () => {
  const {
    INITIAL_SHOPEE_INBOX_STATE,
    shopeeInboxReducer,
  } = await vite.ssrLoadModule('/src/components/ShopeeEmailInboxPanel.jsx');

  let state = shopeeInboxReducer(INITIAL_SHOPEE_INBOX_STATE, {
    type: 'replacement_started',
    generation: 1,
  });
  state = shopeeInboxReducer(state, {
    type: 'replacement_succeeded',
    generation: 1,
    response: { emails: [{ id: 'old-row' }], nextCursor: 'old-cursor' },
  });
  state = shopeeInboxReducer(state, { type: 'load_more_started', generation: 1 });

  state = shopeeInboxReducer(state, { type: 'replacement_started', generation: 2 });
  assert.deepEqual(state.emails, []);
  assert.equal(state.nextCursor, null);
  assert.equal(state.isLoadingMore, false);

  const afterStaleSuccess = shopeeInboxReducer(state, {
    type: 'load_more_succeeded',
    generation: 1,
    response: { emails: [{ id: 'stale-row' }], nextCursor: 'stale-cursor' },
  });
  const afterStaleFailure = shopeeInboxReducer(state, {
    type: 'load_more_failed',
    generation: 1,
    message: 'old request failed',
  });
  assert.strictEqual(afterStaleSuccess, state);
  assert.strictEqual(afterStaleFailure, state);
});

test('failed filter replacement cannot fall back to rows or cursor from the previous filter', async () => {
  const {
    INITIAL_SHOPEE_INBOX_STATE,
    shopeeInboxReducer,
  } = await vite.ssrLoadModule('/src/components/ShopeeEmailInboxPanel.jsx');

  let state = shopeeInboxReducer(INITIAL_SHOPEE_INBOX_STATE, {
    type: 'replacement_started',
    generation: 3,
  });
  state = shopeeInboxReducer(state, {
    type: 'replacement_failed',
    generation: 3,
    message: 'Gmail quota exceeded',
  });

  assert.deepEqual(state.emails, []);
  assert.equal(state.nextCursor, null);
  assert.equal(state.isLoading, false);
  assert.equal(state.status.state, 'error');
  assert.match(state.status.message, /quota exceeded/);
});
