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
  assert.match(html, /รอบบัญชี Shopee ถัดไป/);
  assert.match(html, /กำลังตรวจสอบรอบล่าสุด/);
  assert.match(html, /อัปโหลด Order\.all — SC Drug Store/);
  assert.match(html, /อัปโหลด Order\.all — DR\.Morepen/);
  assert.match(html, /data-shop="sc-drug-store"/);
  assert.match(html, /data-shop="dr-morepen"/);
  assert.match(html, /sc-drug-store\.jpg/);
  assert.match(html, /dr-morepen\.jpg/);
  assert.equal((html.match(/type="file"/g) || []).length, 2);
  assert.doesNotMatch(html, /กำลังพัฒนา/);
});

test('Shopee history route is locked to Shopee records and exposes admin print controls', async () => {
  const html = await renderPage('/src/pages/ShopeeHistoryPage.jsx', '/shopee/history');

  assert.match(html, /ประวัติเอกสาร Shopee และคิวปริ้นท์/);
  assert.match(html, /รายงานคำสั่งซื้อ Shopee/);
  assert.match(html, /กดสั่งพิมพ์/);
});

test('Shopee reports route renders the read-only Gmail inbox', async () => {
  const html = await renderPage('/src/pages/ShopeeReportsPage.jsx', '/shopee/inbox');

  assert.match(html, /รายงานอีเมล์จาก Shopee/);
  assert.match(html, /Shopee Email Inbox/);
  assert.match(html, /info@mail\.shopee\.co\.th/);
  assert.doesNotMatch(html, /กำลังพัฒนา/);
});

test('Shopee orders route renders the privacy-safe order timeline', async () => {
  const html = await renderPage('/src/pages/ShopeeOrdersPage.jsx', '/shopee/orders');

  assert.match(html, /ไทม์ไลน์คำสั่งซื้อ Shopee/);
  assert.match(html, /Shopee Order Timeline/);
  assert.match(html, /ไม่เก็บหัวเรื่อง เนื้อหาอีเมล หรือข้อมูลผู้ซื้อ/);
});

test('PharmCare reports route renders the email inbox under its new menu name', async () => {
  const html = await renderPage('/src/pages/PharmCareReportsPage.jsx', '/pharmcare/inbox');

  assert.match(html, /รายงานอีเมล์จาก Pharm Care/);
  assert.match(html, /PharmCare Inbox/);
  assert.doesNotMatch(html, /กำลังพัฒนา/);
});

test('PharmCare upload route is back to a placeholder pointing at the reports menu', async () => {
  const html = await renderPage('/src/pages/PharmCareUploadPage.jsx', '/pharmcare/upload');

  assert.match(html, /อัปโหลดข้อมูล Pharm Care/);
  assert.match(html, /กำลังพัฒนา/);
  assert.match(html, /รายงานอีเมล์จาก Pharm Care/);
  // The inbox panel itself no longer lives on this page.
  assert.doesNotMatch(html, /panel-eyebrow">PharmCare Inbox/);
});
