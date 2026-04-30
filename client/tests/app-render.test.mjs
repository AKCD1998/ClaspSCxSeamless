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

async function renderApp(route = '/') {
  const { default: App } = await vite.ssrLoadModule('/src/App.jsx');
  return renderToString(
    React.createElement(
      MemoryRouter,
      { initialEntries: [route] },
      React.createElement(App),
    ),
  );
}

test('main React page renders migrated upload and history sections', async () => {
  const html = await renderApp('/');

  assert.match(html, /Individual Formatter/);
  assert.match(html, /Summary Formatter/);
  assert.match(html, /รายการประวัติการดำเนินการ/);
});

test('history route renders the same migration-friendly page shell', async () => {
  const html = await renderApp('/history');

  assert.match(html, /ประวัติการจัดการไฟล์/);
  assert.match(html, /Table View/);
  assert.match(html, /Grouped View/);
});
