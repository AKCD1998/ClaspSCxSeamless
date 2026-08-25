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

test('renders only the next-cycle card and keeps internal cycle details hidden from staff', async () => {
  const { default: Notice } = await vite.ssrLoadModule(
    '/src/components/ShopeeAccountingCycleNotice.jsx',
  );
  const html = renderToString(React.createElement(Notice, {
    payload: {
      hasHistory: true,
      lastCompletedCycle: { periodStart: '2026-06-29', periodEnd: '2026-07-26' },
      nextCycle: {
        periodStart: '2026-07-27',
        periodEnd: '2026-08-23',
        weeks: [
          { name: '27.07-02.08', start: '2026-07-27', end: '2026-08-02' },
          { name: '03-09.08', start: '2026-08-03', end: '2026-08-09' },
          { name: '10-16.08', start: '2026-08-10', end: '2026-08-16' },
          { name: '17-23.08', start: '2026-08-17', end: '2026-08-23' },
        ],
        downloadGuidance: {
          preferredFromIct: '2026-07-27T00:00:00+07:00',
          preferredToIct: '2026-08-23T23:59:59+07:00',
        },
      },
      dateFieldGuidance: { message: 'ใช้วันที่รายได้เข้าเมื่อมีข้อมูลนี้' },
    },
    status: { message: 'คำนวณรอบถัดไปจากประวัติที่บันทึกแล้ว', state: 'success' },
  }));

  assert.match(html, /27 ก\.ค\. 2569/);
  assert.match(html, /23 ส\.ค\. 2569/);
  assert.match(html, /00:00–23:59/);
  assert.match(html, /ใช้วันที่รายได้เข้า/);
  assert.doesNotMatch(html, /รอบล่าสุดที่ปิดต่อเนื่องแล้ว/);
  assert.doesNotMatch(html, /ช่วงวันที่สั่งซื้อที่ต้องเลือกใน Shopee/);
  assert.doesNotMatch(html, /ชีตที่จะสร้าง 4 สัปดาห์/);
  assert.doesNotMatch(html, /27\.07-02\.08/);
});

test('renders a safe reference-cycle state when no persisted history exists', async () => {
  const { default: Notice } = await vite.ssrLoadModule(
    '/src/components/ShopeeAccountingCycleNotice.jsx',
  );
  const html = renderToString(React.createElement(Notice, {
    payload: {
      hasHistory: false,
      lastCompletedCycle: null,
      nextCycle: {
        periodStart: '2026-06-01',
        periodEnd: '2026-06-28',
        weeks: [],
      },
    },
    status: { message: 'ยังไม่พบประวัติ ระบบแสดงรอบอ้างอิงเริ่มต้น', state: 'warning' },
  }));

  assert.match(html, /ยังไม่พบประวัติ/);
  assert.match(html, /1 มิ\.ย\. 2569/);
  assert.match(html, /28 มิ\.ย\. 2569/);
  assert.match(html, /data-state="warning"/);
  assert.doesNotMatch(html, /รอบล่าสุดที่ปิดต่อเนื่องแล้ว/);
  assert.doesNotMatch(html, /ช่วงวันที่สั่งซื้อที่ต้องเลือกใน Shopee/);
  assert.doesNotMatch(html, /ชีตที่จะสร้าง 4 สัปดาห์/);
});

test('renders missing-cycle guidance without exposing the internal empty-cycle warning', async () => {
  const { default: Notice } = await vite.ssrLoadModule(
    '/src/components/ShopeeAccountingCycleNotice.jsx',
  );
  const html = renderToString(React.createElement(Notice, {
    payload: {
      hasHistory: true,
      hasGaps: true,
      lastCompletedCycle: { periodStart: '2026-06-01', periodEnd: '2026-06-28' },
      nextCycle: { periodStart: '2026-06-29', periodEnd: '2026-07-26', weeks: [] },
      missingCycles: [
        { cycleKey: 'july', periodStart: '2026-06-29', periodEnd: '2026-07-26' },
      ],
      futureCompletedCycles: [
        { cycleKey: 'august', periodStart: '2026-07-27', periodEnd: '2026-08-23' },
      ],
      unconfirmedEmptyCycles: [
        { cycleKey: 'empty-july', periodStart: '2026-06-29', periodEnd: '2026-07-26' },
      ],
    },
    status: { message: 'พบ 1 รอบที่ขาด', state: 'warning' },
  }));

  assert.match(html, /พบ 1 รอบที่ยังขาด/);
  assert.match(html, /ระบบจะไม่ข้ามรอบ/);
  assert.match(html, /มีไฟล์รอบถัดไปแล้ว 1 รอบ/);
  assert.doesNotMatch(html, /ไม่พบรายการสำเร็จในรอบ/);
  assert.doesNotMatch(html, /data-kind="empty"/);
  assert.match(html, /รอบที่ต้องทำให้ครบก่อน/);
  assert.doesNotMatch(html, /รอบล่าสุดที่ปิดต่อเนื่องแล้ว/);
  assert.doesNotMatch(html, /ช่วงวันที่สั่งซื้อที่ต้องเลือกใน Shopee/);
  assert.doesNotMatch(html, /ชีตที่จะสร้าง 4 สัปดาห์/);
});

test('does not render stale cycle details while the refreshed status is an error', async () => {
  const { default: Notice } = await vite.ssrLoadModule(
    '/src/components/ShopeeAccountingCycleNotice.jsx',
  );
  const html = renderToString(React.createElement(Notice, {
    payload: {
      nextCycle: { periodStart: '2026-07-27', periodEnd: '2026-08-23', weeks: [] },
    },
    status: { message: 'refresh failed', state: 'error' },
  }));

  assert.match(html, /refresh failed/);
  assert.doesNotMatch(html, /27 ก\.ค\. 2569/);
  assert.doesNotMatch(html, /รอบบัญชีถัดไป/);
});

test('cycle status helper warns for gaps without surfacing empty-file internals', async () => {
  const { cycleErrorState, cycleStatusFromPayload } = await vite.ssrLoadModule(
    '/src/pages/ShopeeUploadPage.jsx',
  );

  assert.deepEqual(cycleStatusFromPayload({ missingCycles: [{}] }), {
    message: 'พบ 1 รอบที่ขาด ระบบจะไม่เลื่อน checkpoint ข้ามรอบ',
    state: 'warning',
  });
  assert.deepEqual(
    cycleStatusFromPayload({ hasHistory: true, unconfirmedEmptyCycles: [{}] }),
    { message: 'คำนวณรอบถัดไปจากประวัติที่ต่อเนื่องแล้ว', state: 'success' },
  );
  assert.equal(cycleStatusFromPayload({ hasHistory: true }).state, 'success');
  assert.deepEqual(cycleErrorState(new Error('refresh failed')), {
    payload: null,
    status: { message: 'refresh failed', state: 'error' },
  });
});
