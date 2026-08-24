# 19 Frontend Handoff Context

วันที่จัดทำ: 2026-08-19
จุดประสงค์: ให้ session ใหม่ (LLM หรือคน) ที่จะเข้ามาทำงานเฉพาะฝั่ง **frontend** ของ repo นี้ อ่านก่อนเริ่มงาน
เพื่อเข้าใจภาพรวม/สถาปัตยกรรมจริง โดยไม่ต้องไล่อ่านทุกไฟล์เอง

## ⚠️ อ่านก่อนอันดับแรก: `ARCHITECTURE.md` ของ repo นี้ล้าสมัยแล้ว

`ARCHITECTURE.md` (ที่ root ของ repo) เขียนไว้ว่า backend รันอยู่ใน `server/` ของ repo นี้เอง และ deploy
เป็น Render web service เดียวกับ frontend (`claspscxseamless-web` ตาม `render.yaml`) — **นี่ไม่ใช่
สถานะจริงที่ deploy อยู่ตอนนี้แล้ว** (ตรวจสอบสดจริงเมื่อ 2026-08-19 ยืนยันด้านล่าง)

**สถาปัตยกรรมจริงที่ใช้งานอยู่ตอนนี้ (verified live)**:

- **Frontend**: `https://claspscxseamless.onrender.com` — เป็น **static site เท่านั้น** (React build
  จาก `client/`) **ไม่มี backend ของตัวเองทำงานอยู่เลย** (ยิง `GET /api/health` ไปแล้วได้ HTML ของ
  SPA fallback กลับมา ไม่ใช่ JSON — พิสูจน์ว่าไม่มี Express server จริงรันอยู่หลังโดเมนนี้)
- **Backend จริง**: `https://sc-official-website.onrender.com` — เป็น shared backend อีก repo หนึ่ง
  (`currentSC-official-website-project`) ที่ host หลายโมดูล (main website, RX1011, Seamless/นี้,
  DigitalPJK, ReactNJob, SCGlamLiff, PharmCare) รวมกันในเซอร์วิสเดียว
- Client bundle (`client/src/services/api.js`) ตั้งค่า API base URL เป็น
  `https://sc-official-website.onrender.com/api` ตอน build (ผ่าน `VITE_API_BASE_URL`) — เช็คได้จริง
  จาก bundle ที่ deploy อยู่

**สรุป**: ไฟล์โค้ดใน `server/` ของ repo นี้ (Express app เต็มรูปแบบ, มี `app.js`/`controllers`/`routes`
ครบ) **มีอยู่ในเครื่อง/repo จริง แต่ไม่ได้ deploy แยกเป็น service ของตัวเองอีกต่อไป** — โค้ดฝั่ง backend
ที่ "มีผลจริงกับ production" ทั้งหมดตอนนี้อยู่ที่:

```
C:\Users\scgro\Desktop\Webapp training project\currentSC-official-website-project\backend\src\modules\seamless\
```

ถ้าจะแก้ behavior ของ API (`/api/workbooks/*`, `/api/app/processing-records/*`, `/api/app/pharmcare/*`,
`/api/files/*`, `/api/agent/*`, `/api/line/webhook`) **ต้องไปแก้ที่ repo `currentSC-official-website-project`
ไม่ใช่ที่ `server/` ของ repo นี้** — โค้ดใน `server/` ของ repo นี้อาจเป็นต้นทาง (source of truth เดิม)
ที่ถูก port ไปแล้ว หรือเป็นโค้ดค้างที่ยังไม่ได้ sync ให้ตรงกัน (ยังไม่ยืนยัน 100% — ถ้าจะแก้ backend
จริงต้องเช็คทั้งสองที่ก่อนเสมอ)

**ทำไมเรื่องนี้สำคัญกับงาน frontend**: ถ้า session ใหม่ไปแก้ `server/` ของ repo นี้คิดว่าจะมีผลกับ
production แล้วไม่เห็นผลอะไรเปลี่ยน — นี่คือสาเหตุ ต้องไปดู `currentSC-official-website-project` แทน

## Repo นี้คืออะไร

`ClaspSCxSeamless` = ระบบจัดการเอกสารหน้าร้าน → บัญชี ("Seamless X GAS Excel Formatter") เริ่มจาก
Seamless แล้วขยายรองรับหลายแหล่งเอกสาร (source-specific profile) บน history/storage/print-agent
ร่วมกันตัวเดียว:

- **Seamless** (ของเดิม) — แปลง/จัดรูปแบบ workbook Excel จาก DMIS
- **Shopee** — ดึงเอกสารคำสั่งซื้อ Shopee มาแปลงเป็นรายงานบัญชี (`docs/15`, `docs/16`) — **printPolicy: manual**
  เสมอ ไม่เข้าคิวพิมพ์อัตโนมัติ
- **PharmCare** — ดึงอีเมลการเงินจาก PharmCare ผ่าน Gmail มา classify/เก็บเป็นเอกสารรอตรวจ (`docs/13`, `docs/14`)
  — real-time ผ่าน Gmail Pub/Sub push notification ตั้งแต่ 2026-08-19

**ไม่ใช่** ระบบ CRM/loyalty/POS (นั่นคือ repo อื่น เช่น SCCRMV2, SCCRMonPOS)

## โครงสร้างโฟลเดอร์ที่เกี่ยวกับ frontend

```
client/
  src/
    App.jsx                 — routing หลัก (react-router-dom), เลือก theme ตาม path (/shopee, /pharmcare)
    pages/                  — 1 ไฟล์ต่อ 1 หน้า (UploadPage, HistoryPage, ShopeeUploadPage,
                               ShopeeHistoryPage, PharmCareUploadPage, PharmCareHistoryPage, LoginPage)
    components/              — component ที่ page เรียกใช้ (HistoryPanel, HistoryTable, HistoryDashboard,
                               PrintQueueSummary, PharmCareInboxPanel/View, TopNavBar, ...)
    services/api.js          — จุดเดียวที่คุยกับ backend ทั้งหมด (fetch wrapper, ทุกฟังก์ชัน export
                               เป็น API call หนึ่งตัว) — ถ้าจะเพิ่ม endpoint ใหม่ เริ่มที่ไฟล์นี้เสมอ
    styles/                  — CSS (theme variable ต่อ data-theme="default|shopee|pharmcare")
tests/                        — node:test + vite ssrLoadModule (ดู pharmcare-inbox-view.test.mjs,
                               api-service.test.mjs เป็นตัวอย่าง pattern การเขียน test)
```

**Auth ฝั่ง client**: ไม่มี login form ของตัวเอง — พึ่ง HTTP Basic Auth ของเบราว์เซอร์ (prompt native)
กับ session cookie ที่ backend (`appAuth` middleware ใน currentSC-official-website-project) ออกให้
`getSession()`/`login()`/`logout()` ใน `api.js` คุยกับ `/api/app/session/*`

## หน้าเพจที่มีอยู่ตอนนี้ + endpoint ที่ใช้

| หน้า | Path | เรียก API อะไร |
|---|---|---|
| Seamless Upload | `/` | `POST /api/workbooks/process` |
| Seamless History | `/history` | `GET/POST /api/app/processing-records*`, `/api/files/:id/*` |
| Shopee Upload | `/shopee/upload` | เหมือน Seamless แต่ mode=shopee |
| Shopee Email Inbox | `/shopee/inbox` | `GET /api/app/shopee/inbox` — อ่าน Gmail สดแบบ read-only,
                                               filter เฉพาะ `info@mail.shopee.co.th` |
| Shopee History | `/shopee/history` | เหมือนกัน filter เฉพาะ Shopee records |
| PharmCare Inbox | `/pharmcare/upload` | `GET /api/app/pharmcare/inbox`, `/messages/:id`,
                                            `/attachments/:id/download` — **อ่านอย่างเดียว ไม่มีปุ่ม
                                            approve/print** |
| PharmCare History | `/pharmcare/history` | ยัง placeholder (M3 ยังไม่เริ่ม) |

Shopee Email Inbox เป็น live operational view ไม่ใช่ ingestion source of truth: backend ใช้
`format=metadata` (เฉพาะ From/Subject + id/thread/internalDate/labels), timeout 10 วินาที,
ไม่ retry ที่ application layer, cache ต่อ backend instance 15 วินาที และจำกัด 25 แถวต่อหน้า.
Regular `user` จะได้ subject ที่ปกปิด username หลัง `จากผู้ซื้อ`, `ถูกยกเลิกโดย` และ
`ถูกทำการยกเลิกโดย` ฝั่ง server; `admin` ได้ subject เต็ม. Date range เป็นวันปฏิทิน ICT และ
post-filter `internalDate` แบบ
`[receivedFrom, receivedTo)` หลัง Gmail query อีกชั้นหนึ่ง.

## เอกสารที่เกี่ยวข้อง (อ่านเพิ่มตามหัวข้อที่สนใจ)

- `docs/07-frontend-backend-integration.md` — ของเดิม (อาจมีบางส่วนล้าสมัยเหมือน ARCHITECTURE.md เช็คก่อนเชื่อ)
- `docs/09` + `docs/10` + `docs/11` — ระบบ print-agent (HQ000) ออกแบบ/task/review ledger เต็ม
- `docs/13` + `docs/14` — PharmCare finance email automation (spec + implementation plan)
- `docs/15` + `docs/16` — Shopee document MVP (spec + agent handoff protocol)
- **`docs/18` — Cross-feature coordination ledger — อ่านก่อนแตะไฟล์ที่ Shopee กำลังทำงานอยู่ (list
  เต็มอยู่ในนั้น) เพราะงาน Shopee ยัง dirty ไม่ commit ตาม protocol ของ docs/16**

## ข้อควรระวังตอนนี้

1. Shopee workstream กำลังแก้ไฟล์หลายตัวใน `server/`, `print-agent/` แบบยัง dirty ไม่ commit (ดู
   `docs/18` สำหรับ list เต็ม) — **อย่าไปแก้ไฟล์เดียวกันโดยไม่เช็ค docs/18 ก่อน**
2. ถ้างาน frontend ต้องเพิ่ม/แก้ API endpoint ใหม่ — ต้องไปแก้ที่
   `currentSC-official-website-project/backend/src/modules/seamless/` ไม่ใช่ `server/` ของ repo นี้
   (ดูหัวข้อสถาปัตยกรรมจริงด้านบน)
3. Deploy: push เข้า `main` ของ repo นี้ → Render auto-deploy static site ใหม่ (ไม่ต้องรอ backend
   redeploy ถ้าไม่ได้แก้ backend)
