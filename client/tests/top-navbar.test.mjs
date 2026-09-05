import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
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
  if (vite) {
    await vite.close();
  }
});

const noop = () => {};

async function renderNavBar(props) {
  const { default: TopNavBar } = await vite.ssrLoadModule('/src/components/TopNavBar.jsx');
  return renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/pharmcare/upload'] },
      React.createElement(TopNavBar, { onLogout: noop, ...props }),
    ),
  );
}

test('navbar renders a color mode toggle offering dark mode while in light mode', async () => {
  const html = await renderNavBar({ colorMode: 'light', onToggleColorMode: noop });

  assert.match(html, /<button[^>]*class="top-navbar-theme-toggle"[^>]*>🌙 โหมดมืด<\/button>/);
  assert.match(html, /aria-label="สลับเป็นโหมดมืด"/);
  // The toggle sits in the actions row, before the logout button.
  const toggleIndex = html.indexOf('top-navbar-theme-toggle');
  const logoutIndex = html.indexOf('top-navbar-logout');
  assert.ok(toggleIndex !== -1 && logoutIndex !== -1 && toggleIndex < logoutIndex);
});

test('navbar toggle offers light mode (and the matching label) while in dark mode', async () => {
  const html = await renderNavBar({ colorMode: 'dark', onToggleColorMode: noop });

  assert.match(html, /☀️ โหมดสว่าง<\/button>/);
  assert.match(html, /aria-label="สลับเป็นโหมดสว่าง"/);
});

test('navbar hides the color mode toggle when no handler is provided', async () => {
  const html = await renderNavBar({ colorMode: 'light' });

  assert.doesNotMatch(html, /top-navbar-theme-toggle/);
  assert.match(html, /ออกจากระบบ/);
});

test('Shopee navigation includes the live email report route', async () => {
  const { NAV_GROUPS } = await vite.ssrLoadModule('/src/components/TopNavBar.jsx');
  const shopee = NAV_GROUPS.find((group) => group.key === 'shopee');

  assert.ok(shopee);
  assert.deepEqual(
    shopee.items.map((item) => item.to),
    [
      '/shopee/upload',
      '/shopee/inbox',
      '/shopee/orders',
      '/shopee/sales-summary',
      '/accounting/print-bundle',
      '/shopee/history',
    ],
  );
  assert.equal(shopee.items[1].label, 'รายงานอีเมล์จาก Shopee');
  assert.equal(shopee.items[2].label, 'ไทม์ไลน์คำสั่งซื้อ');
  assert.equal(shopee.items[3].label, 'สรุปยอดขายสินค้า');
  assert.equal(shopee.items[4].label, 'ชุดเอกสารบัญชี/ปริ้น');
});
