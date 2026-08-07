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
    server: {
      middlewareMode: true,
    },
    appType: 'custom',
  });
});

test.after(async () => {
  if (vite) {
    await vite.close();
  }
});

async function renderPage(modulePath, route = '/') {
  const { default: Page } = await vite.ssrLoadModule(modulePath);
  return renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: [route] },
      React.createElement(Page),
    ),
  );
}

test('main React page renders migrated upload and history sections', async () => {
  const html = await renderPage('/src/pages/UploadPage.jsx');

  assert.match(html, /อัปโหลดไฟล์จาก Seamless/);
  assert.match(html, /แจกแจงการชดเชยรายคน/);
  assert.match(html, /สรุปจำนวนการชดชยทั้งหมด/);
});

test('history route renders the same migration-friendly page shell', async () => {
  const html = await renderPage('/src/pages/HistoryPage.jsx', '/history');

  assert.match(html, /ประวัติการจัดการไฟล์/);
  assert.match(html, /Table View/);
  assert.match(html, /Grouped View/);
});

test('Shopee upload route renders the live workbook upload workflow', async () => {
  const html = await renderPage('/src/pages/ShopeeUploadPage.jsx', '/shopee/upload');

  assert.match(html, /อัปโหลดยอดขาย Shopee/);
  assert.match(html, /อัปโหลดรายงานคำสั่งซื้อ Shopee/);
  assert.doesNotMatch(html, /กำลังพัฒนา/);
});

test('Shopee history route is locked to Shopee records and exposes admin print controls', async () => {
  const html = await renderPage('/src/pages/ShopeeHistoryPage.jsx', '/shopee/history');

  assert.match(html, /ประวัติเอกสาร Shopee และคิวปริ้นท์/);
  assert.match(html, /รายงานคำสั่งซื้อ Shopee/);
  assert.match(html, /กดสั่งพิมพ์/);
});
