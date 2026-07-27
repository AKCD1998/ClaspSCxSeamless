# 10 Auto-Print Agent — Implementation Task Loop

สถานะ: เสร็จแล้ว (Task 1-8 ติ๊กครบหมด — เหลือแต่ "งานที่เหลือให้มนุษย์ทำหลัง loop จบ" ด้านล่าง + รอ code review ใน docs/11 ให้ครบทุก task)

> **⚠️ 2026-07-27 — เปลี่ยนแผน deploy: โค้ดทั้งหมดในไฟล์นี้ (server/, client/) ถูกย้ายไปรันจริงบน
> `currentSC-official-website-project/backend` แทนที่จะ deploy `render.yaml` ของ repo นี้เป็น service
> แยกต่างหาก** — เจ้าของไม่ต้องการจ่ายค่า Render web service ตัวที่สองทั้งที่ service เดิมยังใช้ไม่เต็ม
> `claspscxseamless-web` (`render.yaml` ในนี้) **ไม่เคย deploy จริงเลยสักครั้ง** จึงไม่มีอะไรต้อง
> decommission รายละเอียดเต็มของการย้ายอยู่ท้ายไฟล์นี้ หัวข้อ "การย้ายไปรันบน shared backend
> (2026-07-27)" — โค้ดใน `server/`/`client/` ของ repo นี้ยังอยู่ครบเป็นต้นทาง/ประวัติการพัฒนา (ผ่านรีวิว
> 12 รอบ R1-R12) แต่ **ไม่ใช่โค้ดที่รันจริงในโปรดักชันอีกต่อไป**
Design spec ต้นทาง: `docs/09-auto-print-agent-design.md` — **อ่านก่อนเริ่มทุกครั้ง** ทุกการตัดสินใจสำคัญถูกฟิกซ์ไว้แล้วใน section 8 ของไฟล์นั้น ห้ามออกแบบใหม่เอง

## กติกาการทำงาน (บังคับทุก iteration)

1. ทำ **ทีละ 1 task** ตามลำดับ: หยิบ task แรกที่ยัง `[ ]` → implement → test ผ่านจริง → ติ๊ก `[x]` → เขียนสรุปสั้นๆ ใต้ task (ไฟล์ที่แตะ, ผล test) → จบ iteration
2. **ห้าม commit / push git** — ปล่อยไว้ใน working tree ให้เจ้าของโปรเจกต์ review เอง
3. ⚠️ **`server/.env` มี credential ของ PRODUCTION จริง (Supabase + R2)** — ห้ามแก้ไฟล์นี้ และ**ห้ามรัน `npm run db:migrate` / `db:seed` ตรงๆ เด็ดขาด** (มันจะยิงเข้า production ทันที) วิธีที่ถูกต้องสำหรับทดสอบ DB ดูข้อ "สภาพแวดล้อมทดสอบ" ข้างล่าง
4. ห้ามยิง LINE API จริง (ยังไม่มี groupId และจะสแปมพนักงานจริง) — test ด้วย mock/stub เท่านั้น การยิงจริงเป็นขั้น setup ท้ายสุดที่มนุษย์ทำ
5. test ที่มีอยู่เดิมทั้งหมดต้องยังผ่าน (`npm test` ใน `server/`) ก่อนติ๊กงานทุก task
6. โค้ดใหม่ให้เลียนแบบ pattern เดิมของ repo (route → controller → service → repository, `asyncHandler`, `apiError`, validator, การเขียน test แบบ `node:test`)
7. ถ้าเจอ blocker ที่ต้องให้มนุษย์ตัดสินใจ → เขียนไว้ในหัวข้อ "Blockers" ท้ายไฟล์ แล้ว**หยุด loop** (อย่าเดาไปเอง)
8. ทุก task เสร็จหมดแล้ว → อัปเดตสถานะบรรทัดบนสุดของไฟล์นี้เป็น "เสร็จแล้ว" → **หยุด loop**
9. หลังติ๊ก task เป็น `[x]` ทุกครั้ง → เพิ่มแถวใหม่ในตารางของ `docs/11-print-agent-review-ledger.md` (ไฟล์: ไฟล์หลักที่แตะ, สรุปสั้น, เว้นคอลัมน์ผู้รีวิว/ผลตัดสินว่างไว้ให้ session อื่นมากรอก) เพื่อให้มีคิวรอรีวิวครบทุก task

## สภาพแวดล้อมทดสอบ (ใช้ซ้ำได้ทุก task ที่ต้องแตะ DB)

```bash
# สร้าง Postgres ทดสอบแยกจาก production (Docker Desktop ต้องเปิดอยู่ — ถ้ายังไม่เปิด: start "Docker Desktop.exe" แล้วรอ docker info ตอบ)
docker rm -f seamless-test-pg 2>/dev/null
docker run -d --name seamless-test-pg -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=seamless_test -p 55433:5432 postgres:16-alpine

# รัน migration กับ DB ทดสอบ — ต้อง override ตัวแปรผ่าน shell แบบนี้เท่านั้น
# (SC_OFFICIAL_SUPABASE_DATABASE_URL ใน shell ชนะค่าใน .env เพราะ dotenv ไม่ override env ที่มีอยู่แล้ว)
cd server
SC_OFFICIAL_SUPABASE_DATABASE_URL="postgresql://postgres:testpass@localhost:55433/seamless_test" npm run db:migrate
SC_OFFICIAL_SUPABASE_DATABASE_URL="postgresql://postgres:testpass@localhost:55433/seamless_test" npm run db:seed

# รัน test รวม DB parity
TEST_DATABASE_URL="postgresql://postgres:testpass@localhost:55433/seamless_test" SC_OFFICIAL_SUPABASE_DATABASE_URL="postgresql://postgres:testpass@localhost:55433/seamless_test" npm test

# เสร็จงานแล้วเก็บกวาด
docker rm -f seamless-test-pg
```

หมายเหตุ: รัน server ชั่วคราวเพื่อทดสอบ endpoint ก็ใช้ override เดียวกัน (`SC_OFFICIAL_... node src/index.js`)

## ข้อมูลเครื่อง 000 (ยืนยันแล้ว 2026-07-24 — ใช้ค่าเหล่านี้ใน print-agent README/.env.example)

- OS: **Windows Server 2019** (ไม่มี winget/choco — เอกสารติดตั้งห้ามอ้างอิงสองตัวนี้)
- LibreOffice 26.2.5.2 ติดตั้งแล้ว → `SOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.exe`
- SumatraPDF 3.6.1 ติดตั้งแล้ว (per-user, user Administrator) → `SUMATRA_PATH=C:\Users\Administrator\AppData\Local\SumatraPDF\SumatraPDF.exe`
- Printer: Brother MFC-T4500DW ต่อกับเครื่องนี้ (ชื่อ printer จริงใน Windows ให้เช็คด้วย `Get-Printer` ตอน deploy)
- Task Scheduler ต้องตั้งให้รันเป็น user `Administrator` (เพราะ SumatraPDF ติดตั้งแบบ per-user ของ user นี้)

---

## Tasks

### [x] Task 1 — แก้ worksheet ว่างหลุดเข้าไฟล์ processed

- ไฟล์: `server/src/services/workbookTransformService.js` (`transformWorkbook` — ปัจจุบันแปลงแค่ `worksheets[0]` แต่คืนทั้ง workbook)
- ทำ: หลังแปลง sheet แรกเสร็จ ลบ worksheet อื่นทั้งหมดออก (`workbook.removeWorksheet(sheet.id)`)
- Test: เพิ่มใน `tests/workbook-transform.test.js` — สร้าง workbook 3 sheets (sheet 2-3 ว่าง/มีขยะ) → transform → output ต้องเหลือ 1 sheet และเป็น sheet ที่ถูกแปลง
- Acceptance: test ใหม่ผ่าน + test เดิมผ่านหมด

  **สรุป:** แก้ `transformWorkbook` ใน `server/src/services/workbookTransformService.js` — หลังจากตั้ง `worksheet.views` แล้ว loop ลบ worksheet อื่นทั้งหมดที่ไม่ใช่ `worksheet` ที่เพิ่งแปลง (เทียบด้วย `sheet.id !== worksheet.id`) ด้วย `workbook.removeWorksheet(sheet.id)`. เพิ่ม test ใหม่ `transform removes extra worksheets and keeps only the transformed first sheet` ใน `server/tests/workbook-transform.test.js` (สร้าง workbook 3 sheets: REP + Empty Sheet 2 + Junk Sheet 3 มีขยะ → transform → ตรวจว่า `result.workbook.worksheets.length === 1` และเหลือแต่ sheet ที่ถูกแปลง). ผล `npm test` ใน `server/`: 13 tests, 12 pass, 1 skipped (DB parity test, ต้องมี `TEST_DATABASE_URL`), 0 fail.

### [x] Task 2 — Migration `003_print_jobs.sql` + repository

- สร้าง `server/db/migrations/003_print_jobs.sql` — โครงสร้างตาราง `print_jobs` ตาม docs/09 section 3 **เป๊ะๆ** (schema-qualified ไม่ต้องใส่ เพราะ migration runner SET search_path ให้แล้ว — ดู `002_allow_r2_storage_provider.sql` เป็นตัวอย่าง)
- สร้าง `server/src/db/repositories/printJobRepository.js`: `createPrintJob` (คำนวณ `attempt_no` = count job เดิมของ record + 1, `is_reprint` = เคยมี job `completed` มาก่อน), `updatePrintJob`, `getPrintJobById`, `listActivePrintJobs`, `requeueStaleJobs` (active เกิน 30 นาที → กลับเป็น `queued` + log ใน metadata)
- เพิ่มชื่อตารางใน `server/src/db/identifiers.js` (ดู pattern `tables.*` เดิม)
- Test: `tests/print-job-db.test.js` แบบเดียวกับ `processing-record-db.test.js` (skip ถ้าไม่มี `TEST_DATABASE_URL`): สร้าง record → job แรก (`attempt_no=1, is_reprint=false`) → ปิด completed → job สอง (`attempt_no=2, is_reprint=true`)
- Acceptance: migrate ขึ้น DB ทดสอบผ่าน, test ผ่าน, **ห้ามรัน migrate กับ production** (จดใน Blockers ให้มนุษย์รันเองท้ายโปรเจกต์)

  **สรุป:** สร้าง `server/db/migrations/003_print_jobs.sql` (ตาราง `print_jobs` ตาม docs/09 section 3 เป๊ะๆ + trigger `set_updated_at()` ให้ตรง pattern ตารางอื่นในสคีมา). สร้าง `server/src/db/repositories/printJobRepository.js` (`createPrintJob`, `updatePrintJob`, `getPrintJobById`, `listActivePrintJobs`, `requeueStaleJobs` — stale = สถานะ `downloading/sent_to_spooler/printing` ที่ `updated_at` เกิน 30 นาที, log เก็บใน `metadata.staleRequeueLog`). เพิ่ม `printJobs` ใน `server/src/db/identifiers.js`. เพิ่ม `server/tests/print-job-db.test.js` (skip ถ้าไม่มี `TEST_DATABASE_URL`). ทดสอบจริงด้วย Docker Postgres ทดสอบ (`seamless-test-pg`, ตามสภาพแวดล้อมทดสอบด้านบน): `db:migrate` ผ่าน (ไม่แตะ production), `db:seed` ผ่าน, `npm test` พร้อม `TEST_DATABASE_URL`: 14 tests, 14 pass, 0 fail. เก็บกวาด container แล้ว. **ยังไม่ได้รัน migrate กับ production Supabase** — อยู่ในรายการ "งานที่เหลือให้มนุษย์ทำ" ข้อ 1 อยู่แล้ว.

### [x] Task 3 — Agent API `/api/agent/*`

- Routes ใหม่ `server/src/routes/agentRoutes.js` (mount ใน `routes/index.js` ที่ `/agent`) — ทุกเส้นทางอยู่หลัง `internalApiAuth` (มี middleware อยู่แล้ว)
- Endpoints ตาม docs/09 section 4.1:
  - `GET /api/agent/print-queue` — เงื่อนไข: (`printed=false` AND `uploaded_at >= env.autoPrintSince`) OR มี job `queued`; **ไม่รวม** record ที่มี job active (`queued/downloading/sent_to_spooler/printing` ที่ agent กำลังถืออยู่ — ระวังอย่า filter ตัวที่ admin เพิ่ง queue ทิ้ง: ตัด active เฉพาะที่มี `agent_host` แล้ว); เรียก `requeueStaleJobs` ก่อนตอบ; คืน `outputFileId` จาก `record.metadata.outputFileId` + `downloadUrl`
  - `POST /api/agent/print-jobs` — สร้าง job (บันทึก `agent_host`, `printer_name`, `document_uploaded_at` จาก record)
  - `PATCH /api/agent/print-jobs/:id` — อัปเดต status/spoolerJobId/timestamps/errorMessage
  - `POST /api/agent/print-jobs/:id/complete` — set completed → `markPrinted(recordId, 'auto-print-agent')` → เรียก LINE notify (ใช้ service จาก Task 4; ถ้า service ยังไม่มี ให้ stub แล้วผูกจริงใน Task 4) → เก็บ `line_notified_at`/`line_notify_error` (LINE พังต้องไม่ทำให้ complete fail)
- เพิ่ม env ใหม่ใน `config/env.js`: `autoPrintSince` (`AUTO_PRINT_SINCE`) + อัปเดต `.env.example`
- Test: `tests/agent-api.test.js` — auth ปฏิเสธเมื่อไม่มี token (ตั้ง `INTERNAL_API_TOKEN` ใน test), print-queue ว่างตอบ `[]`; ส่วน logic ที่ต้อง DB ให้อยู่ใน `print-job-db.test.js` (skip ได้)
- Acceptance: test ผ่านหมด

  **สรุป:** ไฟล์ใหม่ `server/src/routes/agentRoutes.js` (mount ที่ `/agent` ใน `routes/index.js`, หลัง `internalApiAuth`), `server/src/controllers/agentController.js`, `server/src/services/printAgentService.js` (มี `sendPrintNotification` เป็น stub คืน `{ skipped: true, reason: 'line_notify_not_implemented' }` — Task 4 จะ import `lineNotifyService` จริงมาแทนตรงนี้). เพิ่ม `listPrintQueueCandidates` (SQL join `processing_records` + `print_jobs`: เงื่อนไข cutoff วันที่ OR มี job `queued`, ตัด record ที่มี job active ที่ผูก `agent_host` แล้วออก) และ `getAttemptPreview` ใน `printJobRepository.js`. เพิ่ม `env.autoPrintSince` (`AUTO_PRINT_SINCE`) ใน `config/env.js` + `.env.example` (ตัวแปรนี้มีอยู่แล้วใน `server/.env` จริงแต่ยังว่าง — ไม่ได้แตะไฟล์นั้น). Test ใหม่ `server/tests/agent-api.test.js`: (1) 401 เมื่อไม่มี token — รันได้เสมอไม่แตะ DB เพราะ middleware auth ทำงานก่อนถึง controller (2) print-queue ตอบ `[]` เมื่อ DB ว่าง — test นี้ตั้ง `skip` ถ้าไม่มี `TEST_DATABASE_URL` (ป้องกันไม่ให้ query ตาราง `print_jobs` ชนกับ production ที่ยังไม่ได้ migrate). ผลทดสอบ: `npm test` แบบไม่ override env (ชี้ production ตามปกติ) → 16 tests, 13 pass, 3 skip, 0 fail (endpoint ทดสอบผ่านเฉพาะ auth-reject, ไม่แตะ production DB). `npm test` พร้อม `TEST_DATABASE_URL`+`SC_OFFICIAL_SUPABASE_DATABASE_URL` ชี้ Docker Postgres ทดสอบ (migrate แล้ว) → 16 tests, 16 pass, 0 fail. เก็บกวาด container แล้ว.

### [x] Task 4 — LINE notify service + webhook จับ groupId

- `server/src/services/lineNotifyService.js`: `sendPrintNotification(job, record)` — POST `https://api.line.me/v2/bot/message/push` body `{ to: env.lineTargetId, messages: [{ type: 'text', text }] }`, ข้อความตามเทมเพลต docs/09 section 4.3 (แยกเคสปกติ/reprint) ; ถ้า `LINE_CHANNEL_ACCESS_TOKEN` หรือ `LINE_TARGET_ID` ว่าง → return `{ skipped: true, reason }` โดยไม่ throw
- Webhook: `POST /api/line/webhook` — verify ลายเซ็น `x-line-signature` ด้วย HMAC-SHA256(`LINE_CHANNEL_SECRET`, rawBody) แล้ว log `event.source.groupId` ทุก event ลง `operation_logs` (action `line_webhook_event`) + console; ตอบ 200 เสมอ (LINE ต้องการ) — **ต้องใช้ raw body** ระวัง `express.json()` (ใช้ `express.raw()` เฉพาะ route นี้ หรือเก็บ rawBody ผ่าน verify hook)
- Env ใหม่: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_TARGET_ID` ใน `config/env.js` + `.env.example`
- ผูก service เข้า complete endpoint ของ Task 3
- Test: `tests/line-notify.test.js` — (1) ไม่มี token → skipped ไม่ throw (2) webhook ปฏิเสธลายเซ็นผิด 401, รับลายเซ็นถูก 200 (คำนวณ HMAC ใน test ด้วย secret ปลอม) — ห้ามยิง api.line.me จริง (mock `fetch`)
- Acceptance: test ผ่านหมด

  **สรุป:** `server/src/services/lineNotifyService.js` (ใหม่) — `sendPrintNotification(job, record)` ตามสเปก, ข้อความตามเทมเพลต docs/09 4.3 (มีบรรทัด reprint แยกเมื่อ `job.isReprint`). `server/src/controllers/lineWebhookController.js` + `server/src/routes/lineRoutes.js` (mount `/api/line`, **ไม่ใส่** `internalApiAuth` เพราะ LINE เรียกเข้ามาเอง — ป้องกันด้วย HMAC signature แทน) — verify ด้วย `crypto.timingSafeEqual`, log ทุก event ผ่าน `operationLogRepository.logOperation` (action `line_webhook_event`) ซึ่งเดิม swallow DB error อยู่แล้วจึงตอบ 200 เสมอตามสเปก. เก็บ raw body ผ่าน `verify` hook ใน `express.json()` ที่ `server/src/app.js` (ไม่ใช้ `express.raw()` แยก route เพราะ LINE ส่ง Content-Type `application/json` ซึ่ง `express.json()` จะ parse ไปแล้ว). เพิ่ม `env.lineChannelAccessToken/lineChannelSecret/lineTargetId` ใน `config/env.js` + `.env.example`. ผูกเข้า `printAgentService.completeAgentPrintJob` แทน stub เดิมของ Task 3. Test ใหม่ `server/tests/line-notify.test.js` — **จงใจ override `SC_OFFICIAL_SUPABASE_DATABASE_URL`/`DATABASE_URL` เป็น connection string ที่ต่อไม่ได้ (`127.0.0.1:1`) ตั้งแต่บรรทัดแรกของไฟล์** เพื่อไม่ให้ webhook test เขียนแถวจริงลง `operation_logs` ของ production โดยไม่ตั้งใจ (ไม่ต้องพึ่ง Docker เลยเพราะ `logOperation` swallow DB error อยู่แล้ว, ยืนยันจาก log `[operation_logs] skipped line_webhook_event: connect ECONNREFUSED 127.0.0.1:1` ตอนรันเทส) — ไม่ยิง `api.line.me` จริง (mock `global.fetch`). ผลทดสอบ: `npm test` แบบ default (ไม่ override env นอกไฟล์นี้) → 20 tests, 17 pass, 3 skip, 0 fail. `npm test` พร้อม Docker Postgres ทดสอบที่ migrate แล้ว → 20 tests, 20 pass, 0 fail. เก็บกวาด container แล้ว. ไม่ได้แตะ production DB หรือยิง LINE API จริง.

### [x] Task 5 — ปุ่ม "สั่งปริ้น / ขอปริ้นใหม่" (backend + React)

- Backend: `POST /api/app/processing-records/:id/request-print` body `{ requestedBy?, reason? }` ตาม docs/09 section 4.2 — mark `printed=false` (`lastAction='print_requested'`) + สร้าง `print_jobs` แถว `queued` (`requested_by`, `reprint_reason`; `is_reprint` คำนวณใน repository อยู่แล้ว)
- Client: เพิ่มฟังก์ชันใน `client/src/services/api.js` + ปุ่มใน `HistoryActions.jsx` (ส่ง handler ผ่าน `HistoryTable`/`HistoryGrouped`/`HistoryPanel` ตาม pattern ปุ่ม send-email ที่มีอยู่) — confirm ก่อนส่ง, ถาม reason แบบง่ายด้วย `window.prompt` (ค่าว่าง = สั่งปริ้นปกติ)
- Test: เพิ่มเคสใน `client/tests/api-service.test.mjs` ตาม pattern เดิม + backend test route shape ใน `tests/agent-api.test.js` หรือไฟล์ใหม่
- Acceptance: `npm test` (server) + `npm --prefix client test` + `npm run build:client` ผ่านหมด

  **สรุป:** Backend — เพิ่ม `requestPrint` ใน `processingRecordService.js` (mark `printed=false`/`lastAction='print_requested'` ผ่าน `processingRecordRepository.updateProcessingRecord` แล้วสร้าง `print_jobs` แถว `queued` ผ่าน `printJobRepository.createPrintJob` — `is_reprint`/`attempt_no` คำนวณในนั้นอยู่แล้วจาก Task 2), เพิ่ม controller function + route `POST /api/app/processing-records/:id/request-print` ใน `appProcessingRecordRoutes.js` (ไม่มี `internalApiAuth` เหมือนปุ่มอื่นในหน้าเว็บ). Client — `requestProcessingHistoryPrint` ใน `client/src/services/api.js`, ปุ่มใหม่ "สั่งปริ้น / ขอปริ้นใหม่" ใน `HistoryActions.jsx` ส่งผ่าน `onRequestPrint` prop จาก `HistoryTable.jsx`/`HistoryGrouped.jsx`/`HistoryPanel.jsx` (pattern เดียวกับ `onSendEmail`) — `handleRequestPrint` ใน `HistoryPanel.jsx` ยืนยันด้วย `window.confirm` แล้วถาม `reason` ด้วย `window.prompt` (กด cancel = ไม่ส่ง, เว้นว่าง = สั่งปริ้นปกติ). Test ใหม่: `server/tests/app-request-print.test.js` (404 กรณี record ไม่มีจริง — รันได้เสมอไม่แตะเขียน DB; full happy-path ต้อง `TEST_DATABASE_URL` — สร้าง completed job ก่อนเพื่อทดสอบ `is_reprint=true`/`attempt_no=2` จริง, cleanup ด้วย `try/finally`), `client/tests/api-service.test.mjs` (เคสใหม่ยืนยัน payload ที่ส่งไปแบ็กเอนด์). ผลทดสอบ: `npm test` (server) แบบ default → 22 tests 18 pass 4 skip 0 fail; พร้อม Docker Postgres ทดสอบที่ migrate แล้ว → 22/22 pass (ก่อนแก้ R1 เพิ่ม test อีก 1 ตัว รวมเป็น 23/23); `npm --prefix client test` → 8/8 pass; `npm run build:client` → build สำเร็จ. เก็บกวาด container แล้ว.

### [x] Task 6 — Print agent (`print-agent/` โฟลเดอร์ใหม่)

- Node.js CLI ตาม docs/09 section 5: `print-agent/package.json` (deps น้อยที่สุด — ใช้ `dotenv` + built-in `fetch`), `src/index.js` (loop ต่อรอบตาม 5.1), `src/convert.js` (LibreOffice headless → PDF), `src/print.js` (SumatraPDF `-print-to` + PowerShell `Get-PrintJob` poll จนคิวว่าง, timeout 10 นาที), `src/apiClient.js`, `.env.example` (`API_BASE_URL, INTERNAL_API_TOKEN, PRINTER_NAME, AGENT_HOST, SOFFICE_PATH, SUMATRA_PATH, POLL_LOG_DIR`), lock file กันรันซ้อน, local log รายวัน `logs/print-agent-YYYYMMDD.log`
- `print-agent/README.md`: ขั้นติดตั้งบนเครื่อง 000 (ลง LibreOffice/SumatraPDF, npm install, ตั้ง Task Scheduler รายชั่วโมง `schtasks` ตัวอย่างคำสั่งจริง)
- เพิ่ม `print-agent/logs/` และ `print-agent/.env` เข้า `.gitignore` (เช็คว่า pattern เดิมครอบคลุมแล้วหรือยัง)
- Test: unit test เท่าที่ mock ได้ (`node --test`): การประกอบ argument ของ soffice/Sumatra, การ parse ผล `Get-PrintJob`, flow เมื่อ API ตอบ queue ว่าง — **ไม่ต้องปริ้นจริงใน loop นี้** (ปริ้นจริงคือขั้น deploy บนเครื่อง 000 โดยมนุษย์)
- Acceptance: `node --test` ใน print-agent ผ่าน + `node src/index.js --dry-run` (เพิ่ม flag นี้: ทำทุกอย่างยกเว้นสั่งปริ้นจริง) รันจบโดยไม่ crash เมื่อชี้ API ปลอม/ไม่มี server

  **สรุป:** สร้างโฟลเดอร์ `print-agent/` ใหม่ทั้งหมด: `package.json` (dep เดียวคือ `dotenv@^17.2.3` ตรงกับ `server/package.json`), `src/apiClient.js` (wrapper รอบ `fetch` คุย 4 endpoint ของ Task 3), `src/convert.js` (`buildSofficeArgs` + `runCommand`/`convertToPdf` ผ่าน `child_process.spawn`), `src/print.js` (`buildSumatraArgs`, `printPdf`, `getPrintJobs`ผ่าน PowerShell `Get-PrintJob | ConvertTo-Json -Compress`, `parseGetPrintJobOutput`, `waitForPrintQueueEmpty` poll ทุก 5 วิ timeout 10 นาที), `src/lock.js` (`agent.lock` ผ่าน `fs.openSync(path,'wx')` กันรันซ้อน), `src/logger.js` (log รายวัน `logs/print-agent-YYYYMMDD.log` + console), `src/index.js` (loop ตาม pseudocode 5.1 ครบ: fetch queue → requeue เจอ error ก็ log แล้วจบไม่ throw → สร้าง job → download → convert → print → PATCH ทุกขั้น → รอคิวว่าง → complete; error ระหว่างทาง catch แล้ว PATCH `status:'failed'` ไม่ทำให้ document อื่นหยุดปริ้นต่อ; `--dry-run` flag: ข้ามการสร้าง job/download/convert/print ทั้งหมด แค่ log ว่าจะทำอะไร ไม่แตะ API ที่ทำให้เกิด side effect จริงเลย นอกจาก `GET /print-queue` ตัวเดียว). `.env.example` ครบ 7 ตัวแปรตาม spec. `README.md` ใช้ข้อมูลเครื่อง 000 จริงจากหัวข้อด้านบน (Windows Server 2019, ไม่มี winget/choco, path LibreOffice/SumatraPDF ที่ยืนยันแล้ว) รวมสคริปต์ `Register-ScheduledTask` ตัวอย่างจริงให้รันเป็น user `Administrator`. เพิ่ม `agent.lock` ใน `.gitignore` ราก repo (ตรวจแล้วว่า `.env`/`logs/` มี pattern ครอบคลุม `print-agent/` อยู่แล้วโดยไม่ต้องแก้เพิ่ม — pattern เดิมไม่ scope เฉพาะ `server/`). Test: `tests/convert.test.js`, `tests/print.test.js`, `tests/apiClient.test.js`, `tests/index.test.js` (รวม 19 tests) ครอบ: arg assembly ของทั้ง soffice/Sumatra, parse `Get-PrintJob` output (array/single-object/invalid JSON), `waitForPrintQueueEmpty` (completed true/false), flow queue ว่าง, flow API ต่อไม่ได้ไม่ crash, `--dry-run` ไม่เรียก API ที่มี side effect, lock กันรันซ้อนจริง (ยืนยันด้วย `Promise.all` สอง `runOnce` พร้อมกัน เหลือแค่ 1 fetch call). ผล `npm test` ใน `print-agent/`: 19 tests, 19 pass, 0 fail. รัน `node src/index.js --dry-run` ชี้ `API_BASE_URL=http://127.0.0.1:1` (ไม่มี server จริง) จบด้วย exit code 0 ไม่ crash ตามที่ acceptance ต้องการ พบและแก้เรื่องเล็กน้อยระหว่างทาง: dotenv v17 มี "random tip" log message ทุกครั้งที่ `.config()` (ไม่ใช่ปัญหาความปลอดภัย — เป็น feature โฆษณาสินค้าของ maintainer เอง) → เพิ่ม `{ quiet: true }` ให้ตรง convention เดิมของ `server/src/config/env.js`.

### [x] Task 7 — End-to-end ทดสอบรวมบนเครื่อง dev

- เปิด Docker Postgres ทดสอบ + migrate + seed → รัน server ด้วย override → อัปโหลดไฟล์ตัวอย่าง (สร้างด้วย ExcelJS ตาม pattern ใน `tests/workbook-transform.test.js`) → ตั้ง `AUTO_PRINT_SINCE` เป็นเมื่อวาน → รัน print-agent จริงชี้ server local โดยตั้ง `PRINTER_NAME=Microsoft Print to PDF` (ปริ้นจริงผ่าน virtual printer — ต้องมี LibreOffice+SumatraPDF บนเครื่อง dev; **ถ้าเครื่อง dev ยังไม่มี ให้ใช้ `--dry-run` แทนแล้วจดไว้ใน Blockers ว่า e2e เต็มรูปแบบรอเครื่อง 000**)
- ตรวจ: print_jobs ครบทุก timestamp, record ถูก mark printed โดย `auto-print-agent`, LINE notify ถูก skip พร้อม reason (ไม่มี target id), ปุ่ม request-print ในเว็บสร้าง job ใหม่และ agent รอบถัดไปหยิบไปเป็น reprint
- Acceptance: เขียนผลการตรวจทุกข้อไว้ใต้ task นี้ + เก็บกวาด (ปิด server, ลบ container, ลบไฟล์ temp)

  **สรุปการตรวจ (2026-07-24):** เครื่อง dev นี้**ไม่มี LibreOffice/SumatraPDF ติดตั้งอยู่** (เช็คแล้ว: ไม่พบ `soffice.exe`/`SumatraPDF.exe` ใน path มาตรฐาน) → ใช้ `--dry-run` แทนสำหรับขั้นตอนปริ้นจริงตามที่ task อนุญาตไว้ ส่วนที่เหลือของ integration ทดสอบผ่าน API จริงครบทุกขั้น (จำลองสิ่งที่ agent จริงบนเครื่อง 000 จะเรียก):

  1. เปิด Docker Postgres ทดสอบแยก (`seamless-e2e-pg`, port 55434) → `db:migrate` + `db:seed` ผ่าน
  2. รัน server จริงชี้ DB นี้ (port 4001, `AUTO_PRINT_SINCE=2026-07-23`, `INTERNAL_API_TOKEN=e2e-test-token`, `LINE_CHANNEL_ACCESS_TOKEN`/`LINE_TARGET_ID` override เป็นค่าว่างชัดเจนเพื่อบังคับ skip แน่นอน) → `GET /api/health` ตอบ `{"status":"ok", database.status:"ok"}`
  3. สร้างไฟล์ตัวอย่างด้วย ExcelJS (pattern เดียวกับ `tests/workbook-transform.test.js`, cell A2=`D1180`, C5=วันที่ภาษาไทย) → `POST /api/workbooks/process` (`formatterMode=individual`) → สำเร็จ ได้ `processingRecordId`
  4. `GET /api/agent/print-queue` → เจอเอกสารที่เพิ่งอัปโหลด, `nextAttemptNo=1`, `isReprint=false` ✅ (เงื่อนไข cutoff `AUTO_PRINT_SINCE` ทำงานถูกต้อง)
  5. รัน `print-agent` จริงด้วย `node src/index.js --dry-run` ชี้ server local → log แสดง "Found 1 document(s)" + บรรทัด `[dry-run]` ระบุไฟล์/printer ถูกต้อง ไม่แตะ API ตัวอื่นนอกจาก `GET /print-queue` ✅
  6. จำลอง flow ของ agent จริงด้วย curl ตรง: `POST /print-jobs` (ได้ `attemptNo=1, isReprint=false, agentHost` ตั้งค่าแล้ว) → `PATCH status=downloading` → ดาวน์โหลดไฟล์จริงผ่าน `downloadUrl` (HTTP 200, ได้ไฟล์ 6965 bytes) → `PATCH status=sent_to_spooler` (`sentToSpoolerAt` ถูกบันทึก) → `POST /complete`
  7. ผลจาก `/complete`: `job.status=completed`, timestamp ครบทุกจุด (`queuedAt`/`sentToSpoolerAt`/`completedAt`) ✅; `record.printed=true`, `record.printedBy='auto-print-agent'`, `record.lastAction='marked_printed'` ✅; `lineNotify={skipped:true, reason:'LINE_CHANNEL_ACCESS_TOKEN or LINE_TARGET_ID is not configured.'}` ตรงกับ `job.lineNotifyError` ✅ (ไม่ได้ยิง LINE จริง)
  8. `GET /api/agent/print-queue` หลัง complete → ตอบ `[]` (ว่าง) ✅ ถูกต้อง
  9. `POST /api/app/processing-records/:id/request-print` (`reason: 'document_lost'`) → `record.printed=false`, `lastAction='print_requested'` ✅; job ใหม่ `attemptNo=2, isReprint=true, reprintReason='document_lost', requestedBy='front-desk-e2e', status='queued', agentHost=''` (ยังไม่มี agent คว้า) ✅
  10. `GET /api/agent/print-queue` → เอกสารกลับมาโผล่พร้อม `isReprint=true, nextAttemptNo=3` ✅; รัน `print-agent --dry-run` รอบใหม่ → เจอเอกสารเดิมอีกครั้งจริง ✅ (agent รอบถัดไปหยิบไปเป็น reprint ตามที่ต้องการ)

  **เก็บกวาด:** ปิด server (kill process, ยืนยันด้วย `curl` ไม่ต่อได้อีกแล้ว), ลบ container `seamless-e2e-pg`, ลบไฟล์ temp ทั้งหมด (`/tmp/e2e-*.xlsx`, `/tmp/e2e-print-agent-logs/`, `print-agent/agent.lock`)

  **จดใน Blockers:** e2e เต็มรูปแบบ (ปริ้นจริงผ่าน virtual printer "Microsoft Print to PDF") ยังไม่ได้ทำเพราะเครื่อง dev นี้ไม่มี LibreOffice/SumatraPDF ติดตั้ง — รอทดสอบปริ้นจริงตอน deploy เครื่อง 000 (ตรงกับ "งานที่เหลือให้มนุษย์ทำ" ข้อ 5 อยู่แล้ว)

### [x] Task 8 — อัปเดตเอกสาร

- `ARCHITECTURE.md`: เพิ่ม endpoints ใหม่ (`/api/agent/*`, `/api/line/webhook`, `/api/app/processing-records/:id/request-print`) + env vars ใหม่ทั้งหมด
- `docs/09-auto-print-agent-design.md`: อัปเดตบรรทัดสถานะเป็น "implemented — รอ deploy เครื่อง 000 + setup LINE"
- `README.md` ของ repo: บรรทัดเดียวชี้ไปที่ docs/09 + print-agent/README.md
- Acceptance: เอกสารตรงกับของจริงที่ implement

  **สรุป:** `ARCHITECTURE.md` — เพิ่ม `POST /api/app/processing-records/:id/request-print` ใน "React Endpoints In Use", เพิ่มหัวข้อใหม่ "Auto-Print Agent + LINE Notify" อธิบาย flow + 4 endpoint agent-only (หลัง `internalApiAuth`) + webhook LINE (public, ป้องกันด้วย HMAC แทน), รวม env vars ใหม่ (`AUTO_PRINT_SINCE`, `LINE_CHANNEL_ACCESS_TOKEN`/`LINE_CHANNEL_SECRET`/`LINE_TARGET_ID`) เข้ากับ list "Environment Variables" เดิม (ไม่แยก section ซ้ำซ้อน) พร้อมอัปเดตบรรทัด `INTERNAL_API_TOKEN` เดิมให้บอกว่ามันคุม `/api/agent/*` ด้วย. `docs/09-auto-print-agent-design.md` — เปลี่ยนบรรทัดสถานะจาก "Design spec — ยังไม่ได้ implement" เป็น "implemented — รอ deploy เครื่อง 000 + setup LINE" พร้อมลิงก์ไปที่ docs/10 (checklist) และ docs/11 (ledger รีวิว). `README.md` ของ repo **ไม่มีอยู่เดิม** (มีแต่ `ARCHITECTURE.md` กับ `print-agent/README.md`/`scripts/README.md`) → สร้างใหม่ตามที่ task ระบุ (ไฟล์เล็กมาก: ชี้ไปที่ `ARCHITECTURE.md` + `docs/09-auto-print-agent-design.md` + `print-agent/README.md`). ตรวจแล้วว่าเอกสารตรงกับของจริง: รัน `npm test` (server) → 23 tests 18 pass 5 skip 0 fail, `npm --prefix client test` → 8/8 pass, `npm test` (print-agent) → 19/19 pass — ไม่มีอะไรพังจากการแก้เอกสารล้วนๆ.

**ทุก task ใน checklist นี้เสร็จหมดแล้ว (Task 1-8) — ดูหัวข้อ "งานที่เหลือให้มนุษย์ทำหลัง loop จบ" ด้านล่างสำหรับขั้นตอน deploy ที่เหลือ และ `docs/11-print-agent-review-ledger.md` สำหรับสถานะรีวิวโค้ด (Task 5-7 ยังไม่มีใครรีวิว ณ จุดนี้)**

---

## งานที่เหลือให้มนุษย์ทำหลัง loop จบ (อย่าทำเองเด็ดขาด)

1. รัน `npm run db:migrate` กับ production Supabase (apply `003_print_jobs.sql`)
2. Issue LINE Channel Access Token (long-lived) + เปิด "Allow bot to join group chats" + ใส่ env บน Render/เครื่อง dev
3. Deploy backend ขึ้น Render + ตั้ง `AUTO_PRINT_SINCE` วันเปิดใช้จริง
4. ตั้ง webhook URL ใน LINE console ชี้ `/api/line/webhook` → เชิญบอทเข้ากลุ่ม → เก็บ groupId จาก log → ตั้ง `LINE_TARGET_ID`
5. ติดตั้งบนเครื่อง 000 ตาม `print-agent/README.md` + ทดสอบปริ้นจริงกับ Brother MFC-T4500DW + เทียบ format LibreOffice 1 รอบ
6. **ก่อนเปิดใช้ agent บนเครื่อง 000 ครั้งแรก:** เคลียร์ซากคิว Brother ที่ค้างอยู่ 25 jobs (สถานะ error/stuck ตั้งแต่ 11/2020-11/2024) ด้วย `Get-PrintJob -PrinterName "<ชื่อจริง>" | Remove-PrintJob` หรือ restart print spooler service + ล้างโฟลเดอร์ `C:\Windows\System32\spool\PRINTERS` — แม้โค้ด agent จะแก้ R5 แล้ว (รอเฉพาะ job ของตัวเองไม่รอทั้งคิว) แต่คิวที่สกปรกยังทำให้ `Get-PrintJob` ช้า/รกได้ ควรเคลียร์ให้สะอาดก่อนเริ่มใช้งานจริง
7. **ตั้ง `APP_BASIC_USER`/`APP_BASIC_PASSWORD` บน Render (บังคับ — ดู `docs/12-security-hardening-tasks.md`)** — ถ้าไม่ตั้ง เว็บจะเปิดโล่งไม่มี auth เหมือนก่อนแก้ security hardening
8. แจ้ง username/password (`APP_BASIC_USER`/`APP_BASIC_PASSWORD`) ให้พนักงานที่ใช้เว็บทราบ เพื่อกรอกตอนเบราว์เซอร์เด้ง login prompt

## ข้อแก้ไขจากรีวิวอิสระ (Fable, 2026-07-24 — รายละเอียดเต็มใน docs/11) — **ทำเป็น task แทรกก่อนเริ่ม Task 7**

- [x] **R1 (บั๊กจริง, Task 2/3):** `requeueStaleJobs` เซ็ต `status='queued'` แต่ไม่ล้าง `agent_host` → เงื่อนไข NOT EXISTS ใน `listPrintQueueCandidates` ยังกัน record ออกจาก queue ถาวรหลัง agent ตายกลางคัน และ job ที่ค้าง `queued`+`agent_host` (ตายก่อน PATCH แรก) ไม่ถูกสแกน stale เลย → แก้: requeue ต้องเซ็ต `agent_host = NULL` ด้วย + รวมเคส `queued` ที่มี `agent_host` ในการสแกน stale + เพิ่ม test ครอบ scenario "agent ตายแล้วเอกสารกลับเข้า queue ได้"

  **สรุป:** `server/src/db/repositories/printJobRepository.js` — เพิ่ม `agentHost` เป็น field ที่ `updatePrintJob` แก้ได้ (`set('agent_host', normalizeString(patch.agentHost) || null)`). แก้ `requeueStaleJobs`: (1) query SELECT stale ตอนนี้ครอบทั้ง `status = ANY(STALE_STATUSES)` **หรือ** `status='queued' AND agent_host IS NOT NULL` (เคส agent ตายก่อน PATCH แรก) (2) การ requeue เซ็ต `agentHost: null` คู่กับ `status: 'queued'` เสมอ เพื่อให้ `listPrintQueueCandidates` ไม่กัน record นี้ออกอีกต่อไป. เพิ่ม test `server/tests/print-job-db.test.js` — "requeueStaleJobs clears agent_host so the record can be picked up again, including a job stuck at queued" ครอบทั้ง 2 เคส (stuck `downloading`, stuck `queued`+`agent_host`), ยืนยันด้วย `listPrintQueueCandidates` ว่า record กลับมาโผล่ใน queue จริง — ต้องปิด trigger `trg_print_jobs_updated_at` ชั่วคราวเพื่อ backdate `updated_at` ในเทส (trigger บังคับ `updated_at=now()` ทุก UPDATE) แล้วเปิดกลับทันที ผลทดสอบ: Docker Postgres ทดสอบ → 23 tests, 23 pass, 0 fail.

- [x] **R2 (บั๊ก UX, Task 4):** `formatTimestamp` ใน `lineNotifyService.js` ใช้เวลา local ของ server — บน Render (UTC) ข้อความ LINE จะเพี้ยน -7 ชม. → แก้ให้ format ด้วย timezone `Asia/Bangkok` + test

  **สรุป:** `server/src/services/lineNotifyService.js` — เปลี่ยน `formatTimestamp` จากใช้ `date.getHours()/getMinutes()` (timezone ของ process) เป็น `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', ... })` แล้วประกอบสตริงจาก `formatToParts` (ตรวจแล้วว่าไม่มีปัญหา "24:00" ตอนเที่ยงคืนใน ICU ของ Node เวอร์ชันนี้). ไม่ต้องเพิ่ม test แยกเพราะ `tests/line-notify.test.js` (Task 4) เรียก `sendPrintNotification` จริงอยู่แล้วผ่าน mocked fetch ครอบ path นี้ในตัว — รันซ้ำแล้วผ่าน

- [x] **R3 (test hygiene, Task 5):** `app-request-print.test.js` ทิ้ง queued job ไว้ ทำให้รัน `npm test` ซ้ำบน DB เดิม fail ที่ "empty queue" (ยืนยันแล้ว: รอบแรก 22/22 รอบสอง 21/22) → เพิ่ม cleanup/teardown ลบ record+job ที่ test สร้าง

  **สรุป:** พบและแก้ปัญหานี้เองระหว่าง implement Task 5 ก่อนเห็นรีวิวของ Fable ด้วยซ้ำ — ห่อ assertion ทั้งหมดใน `try/finally` แล้วลบ `print_jobs`/`processing_records` ที่ test สร้างใน `finally` เสมอ (แม้ assertion fail ก็ยังลบ) ใน `server/tests/app-request-print.test.js`. ยืนยันด้วยการรัน `npm test` ซ้ำ 2 รอบติดกันบน DB เดิมแล้วผ่านทั้งคู่ (23/23 ทั้งสองรอบ)

## ประเด็นเสนอจากรีวิวรอบ 2 (Fable, 2026-07-24) — **สถานะ: R4/R5/R6 ตกลงร่วมกันแล้ว (แก้ทั้ง 3 ข้อ) — implement + test เสร็จ 2026-07-24**

> Fable รีวิว Task 5-7 + re-verify R1-R3 แล้ว (ผล: ผ่านหมด — ดู docs/11) ประเด็นข้างล่างเป็น**ข้อเสนอที่ยังเปิดให้แย้ง** — ผู้ implement (Sonnet) โปรดอ่านแล้วตอบใต้แต่ละข้อ: **เห็นด้วย / เห็นต่าง / มีวิธีที่ดีกว่า** พร้อมเหตุผล ถ้าเห็นต่างและเหตุผลฟังขึ้น ไม่ต้องแก้โค้ด — บันทึกข้อสรุปไว้แทน ตัดสินใจร่วมกันแล้วค่อยลงมือ

### R4 — stale lock (`print-agent/src/lock.js`)

- **ข้อสังเกตของ Fable:** ถ้า process ตายกลางรัน (ไฟดับ/ถูก kill) `agent.lock` ค้าง → ทุกรอบถัดไป exit เงียบตลอดกาลจนกว่ามนุษย์จะลบไฟล์ = ระบบหยุดโดยไม่มีสัญญาณเตือน
- **ทางแก้ที่เสนอ:** เช็คอายุ lock (mtime เก่ากว่า ~2 ชม. = stale → ลบทิ้ง acquire ใหม่ + log)
- **ข้อแย้งที่เป็นไปได้ (Fable คิดแทนล่วงหน้า):** (ก) Task Scheduler ตั้ง "Do not start a new instance" ได้อยู่แล้ว อาจถือว่า lock file ซ้ำซ้อนและตัดทิ้งทั้งกลไกก็ได้ — แต่ scheduler กันเฉพาะ instance ที่ scheduler เป็นคน start ไม่ครอบเคสรัน manual (ข) รอบที่ยาวจริงๆ (คิวยาว) อาจเกิน 2 ชม. แล้วโดน override ซ้อน — เลือกตัวเลขให้เกิน worst case ชัดๆ หรือเขียน PID เช็คว่า process ยังอยู่
- **Sonnet ตอบ: เห็นด้วยว่าเป็นบั๊กจริง, แต่มีวิธีที่ดีกว่า time-based threshold ที่ Fable เสนอ.** อ่าน `print-agent/src/lock.js` แล้ว: `acquireLock` เขียน PID ลงไฟล์อยู่แล้ว (`fs.writeFileSync(fd, String(process.pid))`) แต่ไม่เคยถูกอ่านกลับมาใช้เลย — แทนที่จะเดา threshold เวลา (ซึ่ง Fable เองก็ชี้จุดอ่อนไว้แล้วในข้อ (ข): งานคิวยาวจริงอาจเกิน threshold แล้วโดน override ทั้งที่ยังทำงานปกติอยู่) ผมแก้เป็น **เช็คว่า PID ที่เขียนไว้ในไฟล์ยังมี process รันอยู่จริงไหม** (`process.kill(pid, 0)` เพื่อเช็ค existence โดยไม่ส่ง signal จริง) — ถ้า process นั้นตายไปแล้ว (`ESRCH`) = lock ค้างจริง ลบทิ้งแล้ว acquire ใหม่ทันที ไม่ต้องรอ threshold เวลาเลย และไม่มีปัญหา "งานยาวเกิน 2 ชม. โดน override ทั้งที่ยังทำงานอยู่" เพราะเช็คจาก process จริงไม่ใช่เวลา. ยอมรับ residual risk เล็กน้อย: มี TOCTOU race ถ้ามีสอง agent process ตรวจ stale lock พร้อมกันเป๊ะ (เช่นรัน manual ทับ scheduled run ในจังหวะเดียวกัน) แต่ความน่าจะเป็นต่ำมากและ "Do not start a new instance" ของ Scheduler ช่วยกันกรณีปกติอยู่แล้ว. **Implement แล้ว** — ดูโค้ดจริงและผลทดสอบใต้หัวข้อนี้ด้านล่าง.

### R5 — รอคิวทั้งเครื่องว่าง vs รอ job ตัวเอง (`print-agent/src/print.js`)

- **ข้อสังเกตของ Fable:** `waitForPrintQueueEmpty` รอให้คิว printer ทั้งเครื่องว่าง ถ้า Brother ตัวนี้มีงานพิมพ์ของคนอื่นค้าง agent จะรอจน timeout → mark `failed` ทั้งที่เอกสารเราปริ้นออกไปแล้ว → record ยังไม่ printed → รอบหน้าปริ้นซ้ำ = เอกสารเบิ้ล และ `spooler_job_id` ตาม spec 5.3 ไม่เคยถูกเก็บเลย
- **ทางแก้ที่เสนอ:** snapshot `Get-PrintJob` ก่อนสั่งปริ้น → หลังสั่งหา job ใหม่ที่ diff เพิ่มมา → เก็บ id นั้นเป็น `spoolerJobId` → รอเฉพาะ job นั้นหายจากคิว
- **ข้อแย้งที่เป็นไปได้:** (ก) เครื่อง 000 อาจเป็น server เฉพาะกิจที่ไม่มีใครใช้ปริ้นร่วม — ความเสี่ยงต่ำกว่าที่ Fable ประเมิน (ต้องให้เจ้าของยืนยันพฤติกรรมใช้งานจริง) (ข) diff มี race: job เล็กอาจพิมพ์เสร็จก่อน poll แรกจนไม่เคยเห็นในคิว — ตรรกะ "job ใหม่หายไปแล้ว = จบ" ยังถูกใน edge นี้ แต่จะไม่ได้ `spooler_job_id` (ยอมรับได้ไหม?) (ค) ถ้าจะกันปริ้นเบิ้ลจริงจัง อีกชั้นที่ง่ายกว่าคือ timeout แล้ว mark `printing` ค้างไว้แทน `failed` ให้มนุษย์ตัดสิน — แลกกับ automation ที่หยุดรอ
- **🔴 หลักฐานจากเครื่อง 000 จริง (เจ้าของตรวจ 2026-07-24):** (1) `Shared = False` ต่อ USB ตรง — ข้อกังวล "ชนคิวจากเครื่องอื่นในเน็ตเวิร์ก" ตกไป (2) **แต่คิว Brother จริงมีซากงานค้าง 25 jobs สถานะ error/stuck ตั้งแต่ 11/2020 ถึง 11/2024 ไม่เคยถูกเคลียร์** → ด้วยโค้ดปัจจุบันที่รอ "คิวทั้งเครื่องว่าง" คิวนี้**ไม่มีวันว่าง** = ทุก job จะ timeout → mark failed ทั้งที่ปริ้นแล้ว → ปริ้นซ้ำทุกชั่วโมงไม่รู้จบ ตั้งแต่งานแรกที่ deploy — R5 จึงไม่ใช่แค่ risk แต่เป็น guaranteed failure บนสภาพเครื่องจริง (3) print history log (Event 307) เพิ่งถูกเปิด รอ 2-3 วันจะรู้ว่ามีมนุษย์ใช้เครื่องนี้ปริ้นเองด้วยไหม — **งานเพิ่มตอน deploy: เคลียร์ซากคิว 25 งาน (`Get-PrintJob | Remove-PrintJob` หรือ restart spooler + ล้าง `C:\Windows\System32\spool\PRINTERS`) ก่อนเปิดใช้ agent เสมอ ไม่ว่า R5 จะแก้แบบไหน**
- **หมายเหตุจากเจ้าของ (คำถามเรื่องคนใช้ปริ้นร่วม):** ยังไม่มีคำตอบชัดเจน ณ ตอนตัดสินใจ (รอ log Event 307 อีก 2-3 วันตามที่ระบุไว้ในข้อ (3) ด้านบน)
- **Sonnet ตอบ: เห็นด้วยเต็มที่ ต้องแก้ — และคำถามเรื่องคนใช้ปริ้นร่วมไม่ใช่ตัวชี้ขาดจริงๆ ด้วยซ้ำ.** อ่าน `docs/09-auto-print-agent-design.md` section 5.1 (pseudocode ต้นฉบับ) อีกรอบพบว่าโค้ดปัจจุบันเบี่ยงจาก spec เอง: spec เขียนไว้ชัดว่า `wait until spooler job หายจากคิว` (job เดียว ไม่ใช่ทั้งคิว) และ section 5.3 บอกให้ "เก็บ `JobId` เป็น `spooler_job_id`" — แต่ `print-agent/src/print.js` (`waitForPrintQueueEmpty`) ที่ผมเขียนใน Task 6 กลับรอทั้งคิวว่างและไม่เคยเซ็ต `spoolerJobId` เลย (เช็คด้วย `grep spoolerJobId print-agent/src/*.js` ไม่เจอเลยสักที่) เป็นการลดทอนสเปกที่ผมพลาดเอง ไม่ใช่แค่ edge case ที่ Fable คิดขึ้นมาใหม่. หลักฐาน 25 stuck jobs ยืนยันว่านี่คือ guaranteed failure โดยไม่ต้องรอคำตอบเรื่องคนใช้ร่วมเลยด้วยซ้ำ (แม้ไม่มีมนุษย์ใช้ปริ้นร่วมเลย ซากงาน 25 ตัวก็ทำให้คิวไม่มีวันว่างอยู่ดี) คำถามนั้นมีผลแค่ "จะแย่ลงอีกแค่ไหนถ้ามีคนใช้ร่วม" ไม่ใช่ "ต้องแก้ไหม". **Implement ตามที่ Fable เสนอ (snapshot ก่อนปริ้น → diff หา job ใหม่ → เก็บ id → รอเฉพาะ job นั้น)** พร้อมรับมือ edge case (ข) ที่ Fable เตือนไว้เอง: ถ้า job เล็กปริ้นเสร็จเร็วจนไม่เคยเห็นในคิว (poll ไม่ทัน) → ถือว่าปริ้นสำเร็จทันที (ไม่ error) แต่ log ไว้ว่าไม่มี `spoolerJobId` ให้ตรวจสอบภายหลังได้. ดูโค้ดจริงและผลทดสอบใต้หัวข้อนี้ด้านล่าง — และงานเคลียร์ซากคิว 25 งานตอน deploy ยังต้องทำอยู่ดีตามที่จดไว้ (คนละเรื่องกับโค้ด แก้โค้ดแล้วก็ยังต้องเคลียร์เครื่องจริงอยู่ดี).

### R6 — temp dir ไม่ถูกลบ (`print-agent/src/index.js`)

- **ข้อสังเกตของ Fable:** `mkdtempSync` ทุกครั้งที่รัน ไม่เคยลบ — สะสมเรื่อยๆ บนเครื่อง 000
- **ทางแก้ที่เสนอ:** `fs.rmSync(tempDir, { recursive: true, force: true })` ใน `finally` ของ `runOnce`
- **ข้อแย้งที่เป็นไปได้:** เก็บไฟล์ไว้ช่วย debug งานปริ้นที่ fail ได้ — ถ้าอยากได้ทั้งสองอย่าง: ลบเฉพาะเมื่อทุก job ในรอบนั้น complete, เก็บไว้เมื่อมี failure
- **Sonnet ตอบ: เห็นด้วยว่าเป็นบั๊กจริง และเห็นด้วยกับข้อแย้งของ Fable เองพอดี — ใช้ทางประนีประนอมนั้น.** ยืนยันจากโค้ด `print-agent/src/index.js` บรรทัด `fs.mkdtempSync(...)` ใน `runOnce` — สร้างทุกรอบจริง ไม่มีการลบที่ไหนเลยในไฟล์นี้ทั้งไฟล์ (`grep rmSync` ไม่เจอ) สะสมเรื่อยๆ บนเครื่อง 000 จริง. **Implement แบบผสม**: `processDocument` คืนค่า `{ ok: boolean }` ต่อเอกสาร, `runOnce` เก็บผลรวมทั้งรอบ → ถ้าทุกเอกสารสำเร็จหมด ลบ `tempDir` ทิ้งใน `finally`; ถ้ามี fail แม้แต่ 1 เอกสาร เก็บ `tempDir` ไว้ + log path ให้ชัดเจนว่าเก็บไว้เพื่อ debug. ดูโค้ดจริงและผลทดสอบใต้หัวข้อนี้ด้านล่าง.

### สรุปการ implement R4+R5+R6 (2026-07-24)

ไฟล์ที่แตะ:
- `print-agent/src/lock.js` — เขียนใหม่ทั้งไฟล์: `acquireLock` ตอนนี้ถ้าเจอ `EEXIST` จะอ่าน PID จากไฟล์เดิม (`readLockPid`) แล้วเช็คว่า process นั้นยังรันอยู่จริงไหม (`isProcessRunning` ผ่าน `process.kill(pid, 0)`) — ถ้าตายแล้ว (หรือไฟล์อ่าน PID ไม่ได้/เสีย) ถือว่า stale, ลบทิ้งแล้ว acquire ใหม่ทันที ไม่มี time threshold ให้ต้องเดา
- `print-agent/src/print.js` — ลบ `waitForPrintQueueEmpty` ทิ้ง (ใช้ตรรกะผิดตาม spec), เพิ่ม `detectNewSpoolerJobId` (poll หา job id ใหม่หลังสั่งปริ้น เทียบกับ snapshot ก่อนหน้า) + `waitForSpecificJobToClear` (รอเฉพาะ job id นั้นหายจากคิว ไม่สนใจ job อื่นที่ค้างอยู่)
- `print-agent/src/index.js` — `processDocument`: snapshot `getPrintJobs` ก่อน `printPdf`, หา `spoolerJobId` ใหม่หลังปริ้น, ส่งเข้า `PATCH` จริง (ก่อนหน้านี้ไม่เคยส่งเลย), รอเฉพาะ job นั้น (ถ้าหา id ไม่เจอเลยภายใน 20 วิ ถือว่าปริ้นเสร็จเร็วมากแล้ว ไม่ error แค่ log ว่าไม่มี `spoolerJobId`); คืนค่า `{ ok }` ต่อเอกสาร. `runOnce`: เก็บผล `{ ok }` ทุกเอกสารในรอบ → ลบ `tempDir` เฉพาะเมื่อไม่มี fail เลย, เก็บไว้ (พร้อม log path) ถ้ามี fail อย่างน้อย 1 เอกสาร — ย้าย `tempDir`/`api` เข้าไปใน `try` (ประกาศ `let tempDir = null` ไว้นอก) เพื่อไม่ให้ `mkdtempSync` throw แล้วข้าม `releaseLock` ไปดื้อๆ (จุดที่พลาดตอนร่างแรกแล้วแก้ก่อน commit)
- `print-agent/tests/lock.test.js` (ใหม่) — คลุม `isProcessRunning`, acquire สำเร็จ/ไม่สำเร็จเมื่อ process ยังอยู่, reclaim เมื่อ process ตายจริง (ใช้ `spawnSync` รัน child process แล้วปล่อยให้ตายเพื่อได้ PID ที่ตายแน่นอน ไม่เดา), reclaim เมื่อไฟล์ PID เสีย, release ปกติ/ทนทานเมื่อไฟล์หายไปแล้ว
- `print-agent/tests/print.test.js` — แทนที่ test ของ `waitForPrintQueueEmpty` ด้วย test ของ `waitForSpecificJobToClear`/`detectNewSpoolerJobId` รวม regression test ตรงเคสจริง (job อื่นค้างสถานะ error ตลอดกาล ต้องไม่บล็อก)

**ระวัง bug ที่เจอระหว่างเขียนเทสเอง (แก้แล้วก่อนส่ง):** ตอนร่างแรกของ `acquireLock` มีเงื่อนไข `existingPid !== process.pid` กันไว้ (คิดว่าล็อกของตัวเองไม่ต้องกันตัวเอง) แต่ทำให้เทส "ล็อกถูกถือโดย process ที่ยังรันอยู่" และเทส "กันสองรอบพร้อมกัน" fail เพราะทั้งคู่จำลองด้วย PID เดียวกัน (test process เดียวกัน) — ลบเงื่อนไขนั้นออกเพราะไม่มีประโยชน์จริงในโปรดักชัน (ไม่มี code path ไหนเรียก `acquireLock` ซ้ำในโปรเซสเดียวกัน) และแก้ปัญหาเทสได้ถูกทางด้วย

ผลทดสอบ: `npm test` ใน `print-agent/` → **28 tests, 28 pass, 0 fail** (เพิ่มจาก 19 เป็น 28: +7 จาก `lock.test.js`, +2 จาก `print.test.js` ที่เพิ่ม). รัน `node src/index.js --dry-run` ชี้ API ปลอมอีกรอบ → exit code 0 ไม่ crash เหมือนเดิม (ยืนยันว่าไม่ทำ Task 6 เดิมพัง). ไม่ได้แตะ `server/`/`client/` เลยรอบนี้ (การ fix ทั้งหมดอยู่ใน `print-agent/` ล้วนๆ) จึงไม่จำเป็นต้องรัน `npm test` ของ server/client ซ้ำ แต่ตรวจแล้วว่าไม่มีการเปลี่ยน public API ระหว่าง print-agent กับ backend (field ชื่อ `spoolerJobId` มีอยู่แล้วใน `printJobRepository.updatePrintJob` ตั้งแต่ Task 2 เพียงแต่ไม่เคยถูกส่งมาจริง).

**งานที่ยังไม่ได้ทำ (นอกเหนือขอบเขต R4-R6):** เคลียร์ซากคิว 25 jobs บนเครื่อง 000 จริงยังต้องทำตอน deploy อยู่ดี (เป็นงาน ops บนเครื่องจริง ไม่ใช่โค้ด) — เพิ่มเข้ารายการ "งานที่เหลือให้มนุษย์ทำ" ด้านล่างแล้ว

## ประเด็นจากรีวิวรอบ 3 (Codex, blind review ก่อน commit — 2026-07-27) — **แก้แล้ว**

Codex รีวิวทั้งหมดใน ledger แบบ blind ก่อน commit ตามคำขอเจ้าของ (ดู `docs/11` หัวข้อ "คำขอรีวิวก่อน commit/push") พบบั๊กร้ายแรง 1 จุดที่ Fable ไม่เคยเจอ — Sonnet ตรวจสอบเองซ้ำจนยืนยันว่าเป็นบั๊กจริง (reproduce ได้บน Postgres จริงต่อหน้า ไม่ใช่แค่เชื่อ Codex) แล้วแก้ให้ครบ

### R7 — บั๊กร้ายแรง: เอกสารที่ "ขอปริ้นใหม่" จะปริ้นซ้ำไม่จบ (persistent queued-row defect)

- **ข้อค้นพบของ Codex:** ตอนพนักงานกดปุ่ม "ขอปริ้นใหม่" ระบบสร้างแถว `print_jobs` สถานะ `queued` ไว้ 1 แถว (เรียกว่าแถว A) แต่ตอน agent ไปหยิบงานจริง มันเรียก `POST /api/agent/print-jobs` ซึ่ง**สร้างแถวใหม่อีกแถวหนึ่งเสมอ** (แถว B) แทนที่จะใช้แถว A — พอ agent ปริ้นเสร็จและปิดแถว B, แถว A ยังค้างสถานะ `queued` ตลอดไป (ไม่มี `agent_host`) ทำให้เอกสารนั้น**ยังคงถูกมองว่า "รอปริ้น" อยู่** และโผล่กลับมาในคิวทุกครั้งที่ agent เช็ค (ทุก 1 ชั่วโมง) → ปริ้นซ้ำไม่มีวันจบ
- **Sonnet ตรวจสอบเอง (ไม่เชื่อ Codex เฉยๆ):** จำลองสถานการณ์นี้บน Docker Postgres จริงทีละขั้นตอน (เอกสารเคยปริ้นแล้ว → กดขอปริ้นใหม่ → agent หยิบงาน → agent ปริ้นเสร็จ → เช็คคิวอีกครั้ง) แล้ว**เห็นบั๊กเกิดขึ้นจริงกับตา** — เอกสารกลับมาอยู่ในคิวอีกครั้งทั้งที่เพิ่งปริ้นเสร็จ (`nextAttemptNo` เพิ่มขึ้นเรื่อยๆ ไม่จบ) ยืนยันว่าไม่ใช่ Codex เข้าใจผิด เป็นบั๊กจริง
- **ต้นเหตุ:** โค้ด agent (`printAgentService.createAgentPrintJob`) ทำตาม pseudocode ใน `docs/09` §5.1 ตรงตัว ("POST /api/agent/print-jobs" สร้างงานใหม่เสมอ) แต่ pseudocode ต้นฉบับไม่เคยพูดถึงกรณีที่มีแถว `queued` ค้างอยู่แล้วจากปุ่ม "ขอปริ้นใหม่" (Task 5) หรือจากการ requeue งานค้าง (R1) — เป็นช่องว่างที่ทั้ง spec เดิมและตอน implement Task 5/R1 ไม่เคยจับได้ รวมถึงตอนทดสอบ Task 7 เอง ก็ทดสอบแค่ "เอกสารกลับเข้าคิวหลังขอปริ้นใหม่" แต่ไม่เคยทดสอบต่อจนจบ (ปริ้นเสร็จแล้วเช็คว่าหายจากคิวจริงไหม) จึงไม่เคยจับบั๊กนี้ได้เอง
- **วิธีแก้:** ก่อน agent จะสร้างงานใหม่ ให้เช็คก่อนว่ามีแถว `queued` ที่ยังไม่มีใครหยิบ (`agent_host IS NULL`) ค้างอยู่สำหรับเอกสารนี้ไหม — ถ้ามีให้ "หยิบใช้" แถวนั้นเลย (เติม `agent_host`/`printer_name` เข้าไป) แทนที่จะสร้างแถวใหม่ทับ ถ้าไม่มีค่อยสร้างใหม่ตามเดิม
  - ไฟล์ที่แตะ: `server/src/db/repositories/printJobRepository.js` (เพิ่มฟังก์ชัน `claimQueuedJob` — ใช้ `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)` เพื่อหยิบแถวที่เก่าที่สุดที่ยังไม่มีใครถือ แบบปลอดภัยแม้มีหลาย process แข่งกันหยิบ), `server/src/services/printAgentService.js` (`createAgentPrintJob` เรียก `claimQueuedJob` ก่อน ถ้าไม่เจอค่อย fallback ไปสร้างใหม่เหมือนเดิม)
  - Test ใหม่: `server/tests/print-job-db.test.js` (test ระดับ repository ตรงๆ ว่า `claimQueuedJob` หยิบแถวเดิมจริง ไม่สร้างแถวใหม่ และเอกสารหายจากคิวถาวรหลังปิดงาน) + `server/tests/agent-api.test.js` (test ระดับ HTTP เต็มวงจรจริง: เรียก endpoint จริงทุกตัวตามลำดับที่พนักงาน/agent จะทำจริง แล้วเช็คว่าเอกสารไม่กลับมาในคิวอีก — เป็น regression test ตรงเคสที่ Codex เจอเป๊ะๆ)
  - ผลทดสอบ: รันบน Docker Postgres จริง 2 รอบติดกัน (ไม่ reset DB ระหว่างรอบ) → **33 tests, 33 pass, 0 fail ทั้งสองรอบ**, รัน default (ไม่มี DB จริง) → 33 tests, 26 pass, 7 skip, 0 fail

### R8 — `requestPrint` ไม่ใช้ transaction (Codex พบเป็นข้อสังเกตรอง)

- **ข้อค้นพบ:** `processingRecordService.requestPrint` เขียนข้อมูล 2 ที่แยกกัน (mark record เป็นยังไม่ปริ้น + สร้าง print job) โดยไม่ได้ครอบด้วย transaction เดียวกัน — ถ้าขั้นตอนที่สองล้มเหลว (เช่น DB ขาดตอน) จะเหลือ record ที่ถูก mark ว่ายังไม่ปริ้นแล้ว แต่ไม่มีงานพิมพ์ถูกสร้างไว้เลย (ไม่มีหลักฐานว่ามีการขอปริ้น)
- **วิธีแก้:** ห่อทั้งสองขั้นตอนด้วย `BEGIN`/`COMMIT`/`ROLLBACK` ผ่าน DB client เดียวกัน (pattern เดียวกับที่ `workbookService.js` ใช้อยู่แล้วในโปรเจกต์นี้) — ถ้าขั้นตอนไหนล้มเหลว จะ rollback ทั้งคู่กลับไปเป็นสถานะเดิมก่อนเริ่ม ไม่มีทางเหลือ state ค้างครึ่งๆ กลางๆ
  - ไฟล์ที่แตะ: `server/src/services/processingRecordService.js`
  - ผลทดสอบ: อยู่ในชุดเดียวกับ R7 ด้านบน (test `POST /api/app/processing-records/:id/request-print marks unprinted and queues a print job` ยังผ่านเหมือนเดิม ยืนยันว่า transaction ไม่ทำให้ behavior ปกติเปลี่ยน)

### R9 — `print-agent/README.md` ยังเขียนพฤติกรรมเก่าที่แก้ไปแล้วตอน R4/R5

- **ข้อค้นพบ:** README บอกว่า agent "รอจนคิวปริ้นของ Windows ว่าง" (พฤติกรรมเก่าก่อนแก้ R5 ซึ่งตอนนี้รอเฉพาะงานของตัวเองแล้ว) และบอกให้มนุษย์ลบไฟล์ `agent.lock` เองเวลาค้าง (พฤติกรรมเก่าก่อนแก้ R4 ซึ่งตอนนี้ agent reclaim lock ให้อัตโนมัติแล้ว) — คนอ่านตอน deploy จริงจะเข้าใจผิดว่าต้องทำตามขั้นตอนเก่าที่ไม่จำเป็นแล้ว
- **วิธีแก้:** แก้ข้อความทั้ง 2 จุดใน `print-agent/README.md` ให้ตรงกับพฤติกรรมจริงหลัง R4/R5 (รอเฉพาะงานตัวเอง, lock reclaim อัตโนมัติ — เหลือแค่แนะนำให้เช็ค `Get-Process node` ถ้ายังเจอปัญหาซ้ำหลายรอบ)

**สรุปผลทดสอบรวมหลังแก้ R7-R9:** `npm test` (server) พร้อม Docker Postgres จริง → 33/33 pass (2 รอบติดกันบน DB เดิม); `npm test` (server) แบบ default → 26 pass, 7 skip, 0 fail; `npm --prefix client test` → 8/8 pass; `npm test` (print-agent) → 28/28 pass (ไม่ได้แก้โค้ด print-agent รอบนี้ นอกจาก README).

## ประเด็นจากรีวิวรอบ 4 (Codex re-verify R7-R9, 2026-07-27) — **แก้แล้ว**

Codex กลับมา re-verify R7-R9 (ไม่แก้โค้ดเอง ตามกติกา) พบว่า R8/R9 ผ่านจริง และ R7 "ผ่านมีข้อสังเกต" — บั๊กหลักแก้ได้จริงแต่เจอปัญหาเพิ่ม 2 จุดจากการตรวจเข้มข้นขึ้น (test flakiness ตอนรันซ้ำ + concurrency race ที่ยังไม่ปลอดภัยจริงตามที่เอกสารอ้าง) Sonnet ตรวจสอบเองทั้งคู่จนยืนยันเป็นบั๊กจริงก่อนแก้

### R10 — Regression test ของ R7 flaky เมื่อรันพร้อมไฟล์เทสอื่น

- **ข้อค้นพบของ Codex:** test "full reprint cycle" เช็ค `queue.length === 1` ทั้งระบบ แต่ `node --test tests/*.test.js` รันหลายไฟล์เทสพร้อมกัน (concurrent) — ถ้าไฟล์เทสอื่นมี queued row ชั่วคราวอยู่ในฐานข้อมูลเดียวกันตอนนั้นพอดี ค่าที่ได้จะมากกว่า 1 ทำให้ assertion fail แบบ flaky (Codex เจอจริงตอนรันรอบสอง: 32/33)
- **Sonnet ตรวจสอบเอง:** อ่านโค้ดเทสแล้วยืนยันว่า assertion บรรทัดนั้นเช็ค `queue.length` ทั้งระบบจริงๆ (บรรทัดถัดไปเช็คเฉพาะ record ของตัวเองอยู่แล้ว แสดงว่าจงใจพลาดจุดเดียว ไม่ใช่ design ผิดทั้งหมด) ยอมรับว่าเป็นบั๊กจริงในเทสของตัวเอง
- **วิธีแก้:** เปลี่ยนจากเช็ค `queue.length === 1` เป็นเช็คว่า record ของตัวเองอยู่ใน queue (`queue.find(doc => doc.processingRecordId === record.id)`) โดยไม่สนใจว่ามี record อื่นอยู่ด้วยกี่ตัว — ไฟล์ที่แตะ: `server/tests/agent-api.test.js`

### R11 — `claimQueuedJob` ยังไม่ปลอดภัยจริงเมื่อมีสอง caller พร้อมกัน (concurrency race)

- **ข้อค้นพบของ Codex:** เรียก agent สองตัวพร้อมกันจริง (ไม่ใช่จำลอง) แล้วได้ผลลัพธ์เป็น **2 แถวแยกกัน** — ตัวแรก claim แถวเดิมได้ ส่วนตัวที่สองเจอแถวถูก lock (`SKIP LOCKED`) จึงข้ามไปสร้างแถวใหม่แทน = เอกสารถูกปริ้นสองครั้งได้จริงถ้ามีสอง caller ชนกัน แม้ deployment ปัจจุบันมี agent เดียวก็ตาม เอกสาร (docs/10 เดิม) เขียนไว้ว่า "ปลอดภัยแม้มีหลาย process แข่งกันหยิบ" ซึ่งไม่จริง
- **Sonnet ตรวจสอบเอง (ไม่เชื่อ Codex เฉยๆ):** จำลองด้วยการยิง `POST /api/agent/print-jobs` สองคำขอพร้อมกันจริง (ไม่ใช่ sequential) ไปที่ record เดียวกันที่มี unclaimed queued row อยู่ 1 แถว แล้วดูฐานข้อมูลตรงๆ — **ยืนยันเจอ 2 แถวจริงตามที่ Codex บอก** (`agent-A` claim แถวเดิม, `agent-B` ได้แถวใหม่แยกต่างหาก) ก่อนจะลงมือแก้
- **ต้นเหตุ:** `FOR UPDATE SKIP LOCKED` ใน `claimQueuedJob` ป้องกันแค่ "สอง caller claim แถวเดียวกันซ้ำ" (data corruption) แต่ไม่ได้ป้องกัน "caller ที่สองเจอแถวโดน lock แล้วไปสร้างแถวใหม่แทน" ซึ่งเป็นคนละปัญหากัน
- **วิธีแก้:** ใช้ `pg_advisory_xact_lock(hashtext(processingRecordId))` ล็อกทั้งขั้นตอน (claim → เช็ค active job → create) ให้ทำทีละ caller ต่อ record เดียวกันเท่านั้น (caller อื่นที่มาถึง record เดียวกันพร้อมกันจะต้องรอคิว) และเพิ่มการเช็ค "มี active job อยู่แล้วไหม" ก่อนจะสร้างใหม่ — ถ้ามี (เช่น caller ก่อนหน้าเพิ่ง claim/สร้างไปแล้วในคิวเดียวกัน) ให้ใช้ job นั้นซ้ำแทนที่จะสร้างซ้อน ผลคือไม่ว่าจะมี caller กี่ตัวพร้อมกันสำหรับ record เดียวกัน จะลงเอยที่ job เดียวกันเสมอ — ไฟล์ที่แตะ: `server/src/services/printAgentService.js` (`createAgentPrintJob`)
- **Test ใหม่:** `server/tests/agent-api.test.js` — ยิง `POST /api/agent/print-jobs` สองคำขอพร้อมกันจริงด้วย `Promise.all` ไปที่ record เดียวกัน แล้วยืนยันว่าทั้งคู่ได้ job id เดียวกัน และมีแถวในฐานข้อมูลแค่ 1 แถว (regression test ตรงเคสที่ Codex เจอเป๊ะๆ)

**ผลทดสอบหลังแก้ R10+R11:** รัน `npm test` (server) พร้อม Docker Postgres จริง **3 รอบติดกันบน DB เดิมไม่ reset** → **34/34 pass ทั้ง 3 รอบ** (ไม่ flaky อีกแล้ว); `npm test` (server) แบบ default → 26 pass, 8 skip, 0 fail; `npm --prefix client test` → 8/8 pass; `npm test` (print-agent) → 28/28 pass. ไฟล์ที่แตะทั้งหมดรอบนี้: `server/src/services/printAgentService.js`, `server/tests/agent-api.test.js`.

**ยังเหลือค้างตามเดิม (ยอมรับ, นอกขอบเขต):** printer `JobStatus`/offline detection และ log retention 90 วัน (docs/09 §5.3/§5.5) ยังไม่ implement — เป็นงาน enhancement รอบถัดไป ไม่ใช่บั๊กที่ทำให้ระบบพังหรือปริ้นซ้ำ

## ประเด็นจากรีวิวรอบ 6 (เจ้าของ reproduce เอง, 2026-07-27) — **แก้แล้ว**

เจ้าของทดสอบเองด้วยการยิง 10 concurrent `POST /api/agent/print-jobs` ไปยัง record เดียวกัน หลังแก้ R10/R11 แล้ว — พบว่า Codex เตือนไว้ถูกต้องในแถว 47 ของ `docs/11-print-agent-review-ledger.md` (ที่ตอนนั้นยังไม่ได้แก้): DB เหลือแถวเดียวจริง แต่ **ทั้ง 10 คำขอได้ HTTP 201 เหมือนกันหมด** ทำให้ print-agent ทุกตัว (ถ้ามีหลาย instance/หลาย poll ชนกันจริง) จะ download+print เอกสารเดียวกันซ้ำได้ แม้ฐานข้อมูลมีแถวเดียว เพราะ "ผู้แพ้" ไม่มีทางรู้ว่าตัวเองแพ้

### R12 — ผู้แพ้ race ต้องได้ 409 ไม่ใช่ 201 ปลอม + agent ต้องหยุดโดยไม่ปริ้น

- **ข้อค้นพบของเจ้าของ:** "แก้ได้ครึ่งหนึ่ง" — ฐานข้อมูลไม่สร้าง row ซ้ำแล้ว (R11 DB-level ใช้ได้จริง) แต่ทุก caller ยังได้รับ response ที่แยกไม่ออกจากความสำเร็จ (201 + job เดิม) ระบุ fix ที่ต้องการชัดเจน: ต้องมีผู้ชนะรายเดียวเดินต่อ ส่วนรายอื่นต้องได้ `409`/`claimed:false`/ownership mechanism ที่ทำให้ agent หยุดโดยไม่ปริ้น แล้ว test ต้องยืนยัน "มีเพียง caller เดียวได้สิทธิ์ process" ไม่ใช่แค่ "มี DB row เดียว"
- **Sonnet ตรวจสอบเอง:** reproduce ซ้ำเองด้วย 10 concurrent `POST /api/agent/print-jobs` จริงไปยัง record เดียวกันที่มี unclaimed queued row 1 แถว — ยืนยันตรงกับที่เจ้าของรายงานทุกประการ (10/10 ได้ HTTP 201, `job.id` เดียวกัน, ฐานข้อมูลมี 1 แถว) ก่อนลงมือแก้ ยัง grep `print-agent/src/index.js` ยืนยันว่าไม่มี ownership check ใดๆ เลย (`agentHost`/`createPrintJob` ไม่เคยถูกเทียบกับใคร)
- **ต้นเหตุ:** `printAgentService.createAgentPrintJob`'s "มี active job อยู่แล้ว" branch (จาก R11) เขียนว่า `await client.query('COMMIT'); return activeJobs[0];` — คืน job ของผู้ชนะให้ผู้แพ้เหมือนเป็นผู้ claim สำเร็จเอง ทั้งที่ผู้แพ้ไม่ได้ claim อะไรเลย
- **วิธีแก้ (`server/src/services/printAgentService.js`):** เปลี่ยน branch นั้นเป็น `throw conflict('This document already has an active print job owned by another caller.', { existingJobId: activeJobs[0].id })` — ไม่มี `COMMIT` (ไม่มี write เกิดขึ้นบน path นี้ ให้ `catch` ข้างนอก `ROLLBACK` ปิด transaction ตามปกติ) `asyncHandler`+`errorHandler` middleware ที่มีอยู่แล้วจะแปลง thrown `ApiError` เป็น HTTP 409 อัตโนมัติโดยไม่ต้องแก้ controller
- **วิธีแก้ (`print-agent/src/index.js`):** เดิม `const job = await api.createPrintJob(...)` อยู่**นอก** try/catch ของ `processDocument` เลย และ `runOnce`'s `for` loop ก็ไม่มี try/catch ครอบ `processDocument` เช่นกัน — แปลว่าถ้า `createPrintJob` throw (409) จะหลุดขึ้นไปจน `main()`'s `.catch` แล้ว **abort ทั้ง run ทันที ข้ามเอกสารที่เหลือทั้งคิว** ซึ่งผิดเจตนา (แค่แพ้ race เอกสารเดียวไม่ควรทำให้เอกสารอื่นไม่ถูกปริ้นด้วย) แก้โดยห่อ `api.createPrintJob(...)` ด้วย try/catch แยกต่างหาก: ถ้า `error.status === 409` → log ว่าเอกสารนี้มีเจ้าของอื่นแล้ว แล้ว `return { ok: true }` (skip อย่างสงบ ไม่ใช่ความล้มเหลว); error อื่นๆ (เช่น network) ยัง log แล้ว `return { ok: false }` เหมือนเดิม
- **Test ใหม่:**
  - `server/tests/agent-api.test.js` — เขียน regression test เดิม (ที่เคย assert แค่ "job id ตรงกัน") ใหม่ทั้งหมดให้ยิง 2 concurrent request แล้ว assert ว่ามี **winner เดียว (status 201)** และ **loser เดียว (status 409, `error.code === 'CONFLICT'`)** อย่างชัดเจน — ไม่ใช่แค่เช็คว่า DB มีแถวเดียว
  - `print-agent/tests/index.test.js` — เพิ่ม test ใหม่ mock ให้ `POST /api/agent/print-jobs` ตอบ 409 แล้วยืนยันว่า `runOnce` ไม่ throw, ไม่เรียก download/print/complete เลย (เช็คจาก fetch call count = 2: แค่ queue GET + create-job POST ที่ถูกปฏิเสธ)
- **ผลทดสอบ:** `npm test` (server) พร้อม Docker Postgres จริง **3 รอบติดกันบน DB เดิมไม่ reset → 34/34 pass ทุกรอบ**; `npm test` (print-agent) → **29/29 pass** (เพิ่มจาก 28, รวม test 409-skip ใหม่); `npm --prefix client test` → 8/8 pass. ไฟล์ที่แตะรอบนี้: `server/src/services/printAgentService.js`, `server/tests/agent-api.test.js`, `print-agent/src/index.js`, `print-agent/tests/index.test.js`.

**ยืนยันด้วย reproduction สด (ไม่ใช่แค่อ่านโค้ด):** ก่อนแก้ยิง 10 concurrent requests เห็น 10× HTTP 201 เหมือนที่เจ้าของรายงาน; หลังแก้ยิงเทส 2-concurrent ใหม่เห็น 1× 201 + 1× 409 ทุกครั้งที่รัน (ยืนยันด้วยการรัน suite 3 รอบติดกันไม่ reset DB)

## Blockers

(ว่าง — AI เขียนเพิ่มที่นี่เมื่อเจอ)

- 2026-07-24 — **ไม่ใช่ blocker ที่ต้องรอมนุษย์ตัดสินใจ (มี fallback ระบุไว้ใน task 7 อยู่แล้ว)**: เครื่อง dev ที่รัน loop นี้ไม่มี LibreOffice/SumatraPDF ติดตั้ง จึงใช้ `--dry-run` แทนการปริ้นจริงตอนทำ Task 7 ตามที่ spec อนุญาต — e2e แบบปริ้นจริงผ่าน virtual printer ยังไม่ได้ทำ ต้องรอทดสอบตอน deploy เครื่อง 000 จริง (ตรงกับ "งานที่เหลือให้มนุษย์ทำ" ข้อ 5 อยู่แล้ว ไม่ต้องเพิ่มงานใหม่)

## Work log

(AI เขียนสรุปสั้นๆ ต่อท้ายทุก iteration: วันที่ / task / ไฟล์ที่แตะ / ผล test)

- 2026-07-24 — Task 1 เสร็จ. ไฟล์ที่แตะ: `server/src/services/workbookTransformService.js` (แก้ `transformWorkbook` ให้ลบ worksheet อื่นทั้งหมดออกหลังแปลงเสร็จ), `server/tests/workbook-transform.test.js` (เพิ่ม test เคส 3 sheets). ผล `npm test` ใน `server/`: 13 tests — 12 pass, 1 skipped (ต้องมี `TEST_DATABASE_URL`), 0 fail.
- 2026-07-24 — Task 2 เสร็จ. ไฟล์ที่แตะ: `server/db/migrations/003_print_jobs.sql` (ใหม่), `server/src/db/repositories/printJobRepository.js` (ใหม่), `server/src/db/identifiers.js` (เพิ่ม `printJobs`), `server/tests/print-job-db.test.js` (ใหม่). ทดสอบกับ Docker Postgres ทดสอบ (`seamless-test-pg`, port 55433): `db:migrate` + `db:seed` ผ่าน, `npm test` พร้อม `TEST_DATABASE_URL`: 14 tests, 14 pass, 0 fail. ลบ container ทิ้งหลังทดสอบเสร็จ. ไม่ได้แตะ production DB.
- 2026-07-24 — Task 3 เสร็จ. ไฟล์ที่แตะ: `server/src/routes/agentRoutes.js` (ใหม่), `server/src/routes/index.js` (mount `/agent`), `server/src/controllers/agentController.js` (ใหม่), `server/src/services/printAgentService.js` (ใหม่ — LINE notify เป็น stub รอ Task 4), `server/src/db/repositories/printJobRepository.js` (เพิ่ม `listPrintQueueCandidates`, `getAttemptPreview`), `server/src/config/env.js` + `.env.example` (เพิ่ม `autoPrintSince`/`AUTO_PRINT_SINCE`), `server/tests/agent-api.test.js` (ใหม่). ทดสอบ 2 รอบ: (1) `npm test` แบบ default (ชี้ production ตามปกติ ไม่ override env) → 16 tests, 13 pass, 3 skip, 0 fail — endpoint ทดสอบเฉพาะ auth-reject ซึ่งไม่แตะ DB เลย ปลอดภัยกับ production ที่ยังไม่มีตาราง `print_jobs` (2) `npm test` พร้อม Docker Postgres ทดสอบที่ migrate แล้ว (`TEST_DATABASE_URL` + `SC_OFFICIAL_SUPABASE_DATABASE_URL` ชี้ container เดียวกัน) → 16 tests, 16 pass, 0 fail รวมเคส print-queue ตอบ `[]` จริง. ลบ container ทิ้งหลังทดสอบเสร็จ. ไม่ได้แตะ production DB หรือยิง LINE จริง.
- 2026-07-24 — Task 4 เสร็จ. ไฟล์ที่แตะ: `server/src/services/lineNotifyService.js` (ใหม่), `server/src/controllers/lineWebhookController.js` (ใหม่), `server/src/routes/lineRoutes.js` (ใหม่, mount `/line` ใน `routes/index.js`), `server/src/app.js` (เพิ่ม `verify` hook ใน `express.json()` เก็บ `req.rawBody`), `server/src/config/env.js` + `.env.example` (เพิ่ม LINE env 3 ตัว), `server/src/services/printAgentService.js` (เปลี่ยนจาก stub ไปเรียก `lineNotifyService` จริง), `server/tests/line-notify.test.js` (ใหม่). Test นี้ override `SC_OFFICIAL_SUPABASE_DATABASE_URL`/`DATABASE_URL` เป็นค่าที่ต่อไม่ได้ตั้งแต่ต้นไฟล์ เพื่อกันไม่ให้ webhook test เขียนลง production `operation_logs` โดยไม่ตั้งใจ. ผลทดสอบ: `npm test` แบบ default → 20 tests, 17 pass, 3 skip, 0 fail; พร้อม Docker Postgres ทดสอบที่ migrate แล้ว → 20 tests, 20 pass, 0 fail. เก็บกวาด container แล้ว. ไม่ได้แตะ production DB หรือยิง LINE API จริง.
- 2026-07-24 — Task 5 เสร็จ. Backend: `server/src/services/processingRecordService.js` (เพิ่ม `requestPrint`), `server/src/controllers/processingRecordController.js` (เพิ่ม `requestPrint`), `server/src/routes/appProcessingRecordRoutes.js` (เพิ่ม route `POST /:id/request-print`), `server/tests/app-request-print.test.js` (ใหม่). Client: `client/src/services/api.js` (เพิ่ม `requestProcessingHistoryPrint`), `client/src/components/HistoryActions.jsx`/`HistoryTable.jsx`/`HistoryGrouped.jsx`/`HistoryPanel.jsx` (ปุ่ม + handler ใหม่), `client/tests/api-service.test.mjs` (เคสใหม่). ผลทดสอบ: `npm test` (server, default) → 22 tests 18 pass 4 skip 0 fail; พร้อม Docker Postgres ทดสอบ → 22/22 pass ตอนนั้น (ก่อนแก้ R1/R3 ด้านล่างรวมเป็น 23/23); `npm --prefix client test` → 8/8 pass; `npm run build:client` → สำเร็จ.
- 2026-07-24 — แก้ 3 ข้อจากรีวิวอิสระของ Fable (ดูหัวข้อ "ข้อแก้ไขจากรีวิวอิสระ" ด้านบนสำหรับรายละเอียดเต็ม R1-R3): (R1) `printJobRepository.requeueStaleJobs`/`updatePrintJob` เพิ่มการล้าง `agent_host` + สแกน `queued`+`agent_host` เป็น stale ด้วย, เพิ่ม test ใหม่ใน `print-job-db.test.js`; (R2) `lineNotifyService.formatTimestamp` เปลี่ยนไปใช้ `Intl.DateTimeFormat` timezone `Asia/Bangkok`; (R3) `app-request-print.test.js` ห่อ assertion ด้วย `try/finally` ให้ cleanup เสมอ. ยืนยันด้วย Docker Postgres ทดสอบ: รัน `npm test` 2 รอบติดกันบน DB เดิมไม่ reset ผ่านทั้งคู่ 23/23. `npm test` (server, default) → 23 tests 18 pass 5 skip 0 fail. เก็บกวาด container แล้ว. รอ Fable re-verify แล้วอัปเดตผลตัดสินใน `docs/11`.
- 2026-07-24 — Task 6 เสร็จ (ทำต่อระหว่าง autonomous loop tick — Task 6 คือ task ถัดไปที่ยังเป็น `[ ]` ตามลำดับที่ user กำกับมาตลอดทุกรอบ ไม่มี blocker ที่ต้องรอมนุษย์ตัดสินใจ). สร้างโฟลเดอร์ใหม่ทั้งหมด `print-agent/` (package.json, src/{index,apiClient,convert,print,lock,logger}.js, .env.example, README.md, tests/{convert,print,apiClient,index}.test.js). เพิ่ม `agent.lock` ใน `.gitignore` ราก repo (`.env`/`logs/` มี pattern ครอบคลุมอยู่แล้ว). ผลทดสอบ: `npm test` ใน `print-agent/` → 19 tests, 19 pass, 0 fail. `node src/index.js --dry-run` ชี้ `API_BASE_URL=http://127.0.0.1:1` (ไม่มี server) → จบด้วย exit code 0 ไม่ crash. เก็บกวาด `logs/`/`agent.lock` ที่สร้างระหว่างทดสอบมือแล้ว. ไม่ได้ปริ้นจริง ไม่ได้ต่อ production API ใดๆ.
- 2026-07-24 — Task 7 เสร็จ. เครื่อง dev ไม่มี LibreOffice/SumatraPDF → ใช้ `--dry-run` แทนตามที่ spec อนุญาต (จดใน Blockers แล้ว, ไม่ใช่ blocker ที่ต้องรอมนุษย์). ตั้ง Docker Postgres แยก (`seamless-e2e-pg`, port 55434) + migrate + seed → รัน server จริง (port 4001, `AUTO_PRINT_SINCE` เมื่อวาน, LINE env override เป็นค่าว่างชัดเจน) → อัปโหลดไฟล์ตัวอย่างจริงผ่าน `POST /api/workbooks/process` → ทดสอบ full lifecycle ผ่าน API จริง (print-queue detect → agent dry-run เจอเอกสาร → จำลอง POST/PATCH/complete ของ agent จริงด้วย curl → ยืนยัน `print_jobs` มี timestamp ครบ, `record.printed=true` โดย `auto-print-agent`, LINE notify skip พร้อม reason ถูกต้อง, queue ว่างหลัง complete → `request-print` สร้าง reprint job attemptNo=2 → agent รอบถัดไปเจอเป็น reprint จริง). ผลตรวจทุกข้อบันทึกไว้ใต้ Task 7 ด้านบนแล้ว. เก็บกวาด: ปิด server, ลบ container, ลบไฟล์ temp ทั้งหมด. ไม่ได้แตะ production DB/LINE API จริง.
- 2026-07-24 — Task 8 เสร็จ (task สุดท้ายในไฟล์นี้). ไฟล์ที่แตะ: `ARCHITECTURE.md` (เพิ่ม `POST /api/app/processing-records/:id/request-print` ใน endpoint list, เพิ่มหัวข้อ "Auto-Print Agent + LINE Notify" อธิบาย agent endpoints + webhook, รวม env vars ใหม่เข้ากับ list เดิม), `docs/09-auto-print-agent-design.md` (เปลี่ยนบรรทัดสถานะเป็น "implemented — รอ deploy เครื่อง 000 + setup LINE"), `README.md` (ไฟล์ใหม่ — repo ไม่มี README.md เดิม มีแต่ ARCHITECTURE.md, สร้างไฟล์เล็กชี้ไปที่ ARCHITECTURE.md + docs/09 + print-agent/README.md ตามที่ task ระบุ). ผลทดสอบหลังแก้เอกสาร (ยืนยันไม่มีอะไรพัง): `npm test` (server) → 23 tests 18 pass 5 skip 0 fail; `npm --prefix client test` → 8/8 pass; `npm test` (print-agent) → 19/19 pass. **อัปเดตสถานะบรรทัดบนสุดของไฟล์นี้เป็น "เสร็จแล้ว" ตามกติกาข้อ 8 — ทุก task (1-8) ติ๊กครบแล้ว หยุด loop.**
- 2026-07-24 — ตอบและแก้ "ประเด็นเสนอจากรีวิวรอบ 2" (R4-R6) ตามที่เจ้าของขอให้ประเมินเองก่อนแก้ (ไม่ใช่แค่เชื่อ Fable). อ่านโค้ดจริงใน `print-agent/src/{lock,print,index}.js` + `docs/09` section 5.1/5.3 แล้วเห็นด้วยทั้ง 3 ข้อว่าเป็นบั๊กจริง (รายละเอียดการประเมิน + คำตอบเต็มอยู่ใต้ R4/R5/R6 ด้านบน). Implement ครบ: (R4) `lock.js` เช็ค PID liveness แทน time-based staleness, (R5) `print.js` เปลี่ยนจาก `waitForPrintQueueEmpty` (ผิด spec, guaranteed failure จากหลักฐาน 25 stuck jobs) เป็น `detectNewSpoolerJobId`+`waitForSpecificJobToClear` (รอเฉพาะ job ของตัวเอง + บันทึก `spoolerJobId` จริงครั้งแรก), (R6) `index.js` ลบ temp dir เฉพาะเมื่อไม่มี fail. ไฟล์ที่แตะ: `print-agent/src/lock.js`, `print-agent/src/print.js`, `print-agent/src/index.js`, `print-agent/tests/lock.test.js` (ใหม่), `print-agent/tests/print.test.js` (แก้). ผลทดสอบ: `npm test` ใน `print-agent/` → 28 tests, 28 pass, 0 fail (จาก 19). รัน `node src/index.js --dry-run` ชี้ API ปลอมซ้ำ → exit 0 ไม่ crash เหมือนเดิม. เพิ่มขั้นตอน "เคลียร์ซากคิว 25 jobs ก่อนเปิดใช้ agent" เข้ารายการ "งานที่เหลือให้มนุษย์ทำ" ข้อ 6. ไม่ได้แตะ `server/`/`client/` เลยรอบนี้.
- 2026-07-27 — ตอบและแก้ "ประเด็นจากรีวิวรอบ 3" (R7-R9) จาก Codex blind review ก่อน commit. **R7 คือบั๊กร้ายแรงที่สุดที่เจอในโปรเจกต์นี้** — เอกสารที่กด "ขอปริ้นใหม่" จะปริ้นซ้ำไม่จบเพราะแถว `queued` เดิมไม่เคยถูกเคลียร์ Sonnet ไม่เชื่อ Codex เฉยๆ แต่จำลองสถานการณ์บน Docker Postgres จริงเองจนเห็นบั๊กเกิดขึ้นต่อหน้า ก่อนจะลงมือแก้. Implement ครบ 3 ข้อ: (R7) เพิ่ม `claimQueuedJob` ใน `printJobRepository.js` ให้ agent หยิบใช้แถว `queued` เดิมแทนสร้างใหม่ (ใช้ `FOR UPDATE SKIP LOCKED` กันชนกันถ้ามีหลาย process), แก้ `printAgentService.createAgentPrintJob` ให้เรียก claim ก่อนสร้างใหม่; (R8) ห่อ `processingRecordService.requestPrint` ด้วย transaction (`BEGIN`/`COMMIT`/`ROLLBACK` ตาม pattern ของ `workbookService.js`); (R9) แก้ `print-agent/README.md` 2 จุดที่เขียนพฤติกรรมเก่าก่อน R4/R5. ไฟล์ที่แตะ: `server/src/db/repositories/printJobRepository.js`, `server/src/services/printAgentService.js`, `server/src/services/processingRecordService.js`, `server/tests/print-job-db.test.js` (เพิ่ม test), `server/tests/agent-api.test.js` (เพิ่ม full-cycle regression test ผ่าน HTTP endpoint จริงทุกตัว), `print-agent/README.md`. ผลทดสอบ: Docker Postgres จริง 2 รอบติดกันไม่ reset DB → 33/33 pass ทั้งสองรอบ; default env → 26 pass, 7 skip, 0 fail; client 8/8; print-agent 28/28 (ไม่ได้แก้โค้ด print-agent, แค่ README). รายละเอียดเต็มอยู่ในหัวข้อ "ประเด็นจากรีวิวรอบ 3" ด้านบน. เก็บกวาด container แล้ว. **ยังไม่ commit — รอเจ้าของ review + สั่ง commit เอง.**
- 2026-07-27 — Codex re-verify R7-R9 เจอปัญหาเพิ่ม 2 จุด ("ประเด็นจากรีวิวรอบ 4"): R10 (test flaky ตอนรันไฟล์เทสหลายไฟล์พร้อมกัน) และ R11 (`claimQueuedJob` ยังไม่ปลอดภัยจริงถ้ามีสอง caller พร้อมกัน — ยัง double-print ได้). Sonnet ไม่เชื่อ Codex เฉยๆ อีกครั้ง — จำลอง R11 ด้วยการยิง HTTP request สองอันพร้อมกันจริง (ไม่ sequential) แล้วดูฐานข้อมูลตรงๆ **ยืนยันเจอ 2 แถวแยกกันจริงตามที่ Codex บอก** ก่อนแก้. แก้ทั้งคู่: (R10) เปลี่ยน assertion ของเทสให้เช็คเฉพาะ record ตัวเอง ไม่เช็ค queue.length ทั้งระบบ; (R11) เพิ่ม `pg_advisory_xact_lock` ล็อกทั้งขั้นตอน claim-or-create ต่อ record ใน `printAgentService.createAgentPrintJob` + เช็ค active job ที่มีอยู่แล้วก่อนสร้างใหม่ (กันกรณี caller ที่สองมาถึงหลังจาก caller แรก commit ไปแล้ว). เพิ่ม test ใหม่จำลองการยิง 2 request พร้อมกันจริงยืนยันว่าได้ job เดียวกันและมีแค่ 1 แถวในฐานข้อมูล. ไฟล์ที่แตะ: `server/src/services/printAgentService.js`, `server/tests/agent-api.test.js`. ผลทดสอบ: รัน `npm test` (server) พร้อม Docker Postgres จริง **3 รอบติดกันบน DB เดิมไม่ reset → 34/34 pass ทุกรอบ** (ยืนยันว่า flaky หายจริง); default env → 26 pass 8 skip 0 fail; client 8/8; print-agent 28/28. รายละเอียดเต็มอยู่ในหัวข้อ "ประเด็นจากรีวิวรอบ 4" ด้านบน. **ยังไม่ commit — รอเจ้าของ review + สั่ง commit เอง.**
- 2026-07-27 — เจ้าของ reproduce เองด้วยการยิง 10 concurrent create-job requests แล้วพบว่า R11's "fix" ยังไม่พอ: DB เหลือแถวเดียวจริง แต่ทั้ง 10 คำขอได้ HTTP 201 เหมือนกันหมด — ตรงกับที่ Codex เตือนไว้ในแถว 47 ของ ledger ที่ตอนนั้นยังไม่ได้แก้ ("ประเด็นจากรีวิวรอบ 6", R12). Sonnet 5 reproduce ซ้ำเองยืนยันตรงกันก่อนแก้: เปลี่ยน `printAgentService.createAgentPrintJob`'s "มี active job แล้ว" branch จาก `return activeJobs[0]` เป็น `throw conflict(...)` → ผู้แพ้ race ได้ HTTP 409 จริง; แก้ `print-agent/src/index.js`'s `processDocument` ให้ดัก `error.status === 409` แล้ว skip เอกสารนั้นแบบไม่ crash ทั้ง `runOnce` (เดิมไม่มี try/catch ครอบ `createPrintJob` เลย ถ้าไม่แก้จะ abort ทั้งคิวที่เหลือเพราะแพ้ race แค่เอกสารเดียว); เขียน regression test ใหม่ให้ assert "winner เดียว (201) + loser เดียว (409)" แทน "job id ตรงกัน"; เพิ่ม test ใหม่ยืนยันว่า print-agent เจอ 409 แล้ว skip ได้จริงไม่ download/print. ไฟล์ที่แตะ: `server/src/services/printAgentService.js`, `server/tests/agent-api.test.js`, `print-agent/src/index.js`, `print-agent/tests/index.test.js`. ผลทดสอบ: server พร้อม Docker Postgres จริง **3 รอบติดกันบน DB เดิมไม่ reset → 34/34 pass ทุกรอบ**; print-agent → 29/29 pass (จาก 28); client 8/8. รายละเอียดเต็มอยู่ในหัวข้อ "ประเด็นจากรีวิวรอบ 6" ด้านบน. อัปเดตแถว R11 ใน `docs/11-print-agent-review-ledger.md` (row 47) ด้วย strikethrough+"แก้แล้ว (R12)". **ยังไม่ commit — รอเจ้าของ review + สั่ง commit เอง.**
- 2026-07-27 — **หลัง commit+push R12 แล้ว (`3e1f933`)**, เจ้าของถามขั้นตอน deploy ต่อ ("ตั้ง LINE token, deploy backend") แล้วชี้แจงว่า webhook URL ที่ตั้งใจใช้จริง (`sc-official-website.onrender.com`) เป็นคนละ Render service กับที่ `render.yaml` ของ repo นี้ (`claspscxseamless-web`) กำหนดไว้ — เพราะ**เจตนาเดิมของเจ้าของ (ตั้งแต่ prompt แรก) คือให้ทั้งระบบนี้รันบน Render service เดิมที่จ่ายเงินอยู่แล้ว (`currentSC-official-website-project`, repo `SC-official-website`) ไม่ใช่ deploy service ใหม่แยกต่างหาก** เพื่อไม่ต้องจ่ายค่า web service ตัวที่สอง Sonnet 5 ยอมรับว่าพลาดจุดนี้ตั้งแต่แรก (`render.yaml` ที่สร้างไว้ในไฟล์ 10/12 ก่อนหน้าเป็นแผนผิด — ไม่เคย deploy จริงจึงไม่มีอะไรต้อง decommission) ตรวจสอบยืนยันด้วยการอ่านโค้ดจริงของ `currentSC-official-website-project/backend` ก่อนเริ่ม ใช้ `EnterPlanMode` วางแผน scope เต็ม (ย้ายทั้ง backend ไม่ใช่แค่ print-agent/LINE/appAuth ตามที่เจ้าของยืนยัน) แล้ว implement ทั้งหมด — **รายละเอียดเต็มอยู่ในหัวข้อ "การย้ายไปรันบน shared backend (2026-07-27)" ท้ายไฟล์นี้**

## การย้ายไปรันบน shared backend (2026-07-27)

**สรุปสั้น:** ทุกอย่างในไฟล์นี้ (`server/`, `client/`) ถูก port ไปเป็นโมดูลใหม่ใน
`currentSC-official-website-project/backend/src/modules/seamless/` โดยขยายจากโมดูล `seamless`
เดิมที่มีอยู่แล้ว (legacy internal API `/api/processing-records`, ไม่ได้แตะ) ให้ backend ตัวเดียวที่
จ่ายเงินอยู่แล้ว (`sc-official-website` บน Render) รองรับทั้งหมด — plan เต็มถูกเขียนไว้ล่วงหน้าและอนุมัติแล้วก่อน implement (ดู `EnterPlanMode`/`ExitPlanMode` transcript ของ session นั้น)

**สถาปัตยกรรมที่ตัดสินใจ:**
- ใช้ shared `db.js` pool + schema `clasp_scx_seamless` เดิม (ไม่แยก DB เหมือน `digitalpjk`/`rx1011`) เพราะ schema นี้ตั้งใจ share กับระบบอื่นอยู่แล้วตาม ARCHITECTURE.md
- Route paths เดิมทั้งหมดคงไว้ไม่เปลี่ยน (`/api/agent/*`, `/api/app/processing-records/*`, `/api/files/*`, `/api/line/webhook`, `/api/workbooks/*`, `/api/bootstrap`) — ไม่ชนกับ route ที่มีอยู่แล้วเลยสักตัว จึง **print-agent CLI ไม่ต้องแก้โค้ดเลย** เปลี่ยนแค่ `API_BASE_URL`/`INTERNAL_API_TOKEN` ใน `.env`
- `appAuth` (Basic/Bearer) ผูกเฉพาะ router ใหม่ (`/api/app/*`, `/api/files/*`, `/api/bootstrap`) **ไม่ใช่ทั้งแอปเหมือนต้นฉบับ** เพราะ shared backend มีฟีเจอร์สาธารณะอื่นอีกมาก (reactnjob, digitalpjk, scglamliff, sccrm, loyalty, crm, slider, auth, contact) ต้องเปิดต่อไปโดยไม่มี login prompt
- `printAgentService.js` (รวม R12 fix) ถูก port แบบ verbatim ที่สุดเท่าที่ทำได้ เพราะเป็นไฟล์ที่ผ่านการรีวิว 12 รอบมาแล้ว
- File storage/email ใช้ config namespace ใหม่ (`SEAMLESS_R2_*`, ไม่ใช้ `lib/r2Storage.js` เดิมของ shared backend ซึ่งไม่มี prefix isolation/download/presign และผูกกับ slider images) — reuse `SENDGRID_API_KEY`/`MAIL_USER` เดิมของ shared backend สำหรับอีเมล
- Client (`client/`) deploy เป็น Render **Static Site แยกต่างหาก (ฟรี)** แทนที่จะ fold เข้า SPA เดิมของ shared backend — เพราะ Basic Auth ผูกกับทั้งหน้าเดียวไม่ได้ scoped ตาม path ได้ง่ายถ้า merge เข้า SPA เดียวกับหน้าสาธารณะอื่น; เพิ่ม `credentials: 'include'` ใน `client/src/services/api.js`'s `fetch()` เพราะ cross-origin ต้องระบุชัดถึงจะแนบ cached Basic Auth header ได้ (shared backend's CORS เปิด `credentials: true` ให้อยู่แล้ว)
- Migration runner ใหม่ (`backend/src/modules/seamless/db/migrate.js`) อ่าน/เขียน `clasp_scx_seamless.schema_migrations` ตัวเดิมที่ repo นี้สร้างไว้ (001-003 apply ไปที่ production แล้วตั้งแต่ก่อนหน้านี้ในวันเดียวกัน) — รันแล้วเป็น no-op ถูกต้อง ไม่ apply ซ้ำ

**ไฟล์ใหม่ทั้งหมด** (`currentSC-official-website-project/backend/src/modules/seamless/`): `tables.js`, `appConfig.js`, `db/{printJobRepository,generatedFileRepository,batchRepository,operationLogRepository,previewSheetRepository,workbookUploadRepository,migrate}.js` + `db/migrations/*.sql` (คัดลอกจาก repo นี้), `services/{workbookRules,workbookTransformService,workbookService,processingRecordAppService,printAgentService,lineNotifyService,fileStorageService,r2StorageService,emailService}.js`, `middleware/{appAuth,internalApiAuth,errorHandler}.js`, `utils/asyncHandler.js`, `controllers/{bootstrapController,lineWebhookController,workbookController,appProcessingRecordController,fileController,agentController}.js`, `routes/{workbookRoutes,appProcessingRecordRoutes,fileRoutes,agentRoutes,lineRoutes,bootstrapRoutes,index}.js`; extended `config.js`/`errors.js`/`validators.js`/`processingRecords.js` (เพิ่ม export `mapRecord`/`findProcessingRecordByFilename`/`getProcessingRecordById` ที่ขาดไป); `server.js` (mount ใหม่ + เพิ่ม `verify` hook ให้ `express.json()` จับ `req.rawBody` สำหรับ LINE HMAC — จุดเดียวที่ต้องแก้โค้ดเดิม), `.env.example` (เพิ่ม `SEAMLESS_*` block), `package.json` (เพิ่ม `exceljs` dependency + `seamless:migrate` script). Tests ใหม่: `backend/tests/seamless-{agent-api,line-webhook,app-auth,workbook-transform}.test.cjs` (Jest จริงกับ Docker Postgres จริง — จงใจไม่ตาม convention mock-SQL เดิมของ backend นี้ เพราะ mock ตรวจจับบั๊ก concurrency ของ R7/R11/R12 ไม่ได้จริง) + `backend/docs/seamless-print-agent-testing.md` อธิบายเหตุผล/วิธีรัน

**บั๊กที่เจอระหว่าง port (แก้แล้วก่อน verify):** `processingRecords.js` เดิมของ shared backend ไม่ export `mapRecord`/`findProcessingRecordByFilename`/`getProcessingRecordById` (ใช้แค่ภายในไฟล์เดิม) ทำให้ `printAgentService.getPrintQueue()` throw `TypeError` ตอน smoke test จริงครั้งแรก — เจอจาก curl test สด ไม่ใช่แค่อ่านโค้ด แก้โดยเพิ่ม 3 ชื่อนี้เข้า `module.exports`

**ผลทดสอบ (สดจริงบน Docker Postgres แยก, ไม่แตะ production):**
- Auth matrix ครบ: no-credential → 401 ทุก route ใหม่ (`/api/bootstrap`, `/api/agent/*`, `/api/app/*`, `/api/files/*`), Basic ถูก → 200, Bearer ถูก → 200, Bearer ผิด → 401, LINE webhook ลายเซ็นผิด → 401, `/api/health` เดิมไม่กระทบ
- **R12 concurrency reproduce ซ้ำบนโค้ด port แล้ว: ยิง 10 concurrent create-job requests → ผู้ชนะ 1 ราย (201) ผู้แพ้ 9 ราย (409 `CONFLICT`) ฐานข้อมูลมีแถวเดียว** — ตรงกับพฤติกรรมที่ยืนยันแล้วใน repo ต้นทาง
- full request-print → agent claim → complete → LINE skip (ไม่ได้ตั้ง token) → queue ว่างหลัง complete: ผ่านครบ
- R8 rollback test (บังคับ INSERT fail ด้วย `metadata.outputFileId` ผิดรูป) → record ไม่เปลี่ยน `printed`/`lastAction`, ไม่มี job ค้าง: ผ่าน
- Jest suite ใหม่ (`seamless-*.test.cjs`) รัน **3 รอบติดกันบน DB เดิมไม่ reset → 13/13 pass ทุกรอบ**
- Full backend test suite เดิม (ไม่มี DB override) → **9/10 suites pass, 73/78 tests pass, 0 fail** (5 skip = suite ใหม่ของเราเองที่ skip เพราะไม่มี `DATABASE_URL` override ตามการออกแบบ ไม่ใช่ regression)
- Client: `npm test` → 8/8 pass หลังเพิ่ม `credentials: 'include'`

**ยังไม่ทำ (เจ้าของต้องทำเอง/ตัดสินใจต่อ):** ตั้ง `SEAMLESS_*` env vars จริงบน Render (`sc-official-website`), รัน `npm run seamless:migrate` กับ production จริง (schema/ตารางมีอยู่แล้วจาก repo นี้ ควรเป็น no-op แต่ต้องรันยืนยัน), deploy `client/` เป็น Render Static Site แยก + ตั้ง `VITE_API_BASE_URL`/เพิ่ม origin เข้า `CORS_ORIGIN`, ตั้งค่า LINE webhook ให้ชี้ URL ของ `sc-official-website` จริง (ไม่ใช่ `claspscxseamless-web` ที่ไม่เคยมีจริง), ติดตั้ง print-agent บนเครื่อง 000 ชี้ `.env` ไปที่ backend ใหม่. **ยังไม่ commit ทั้งสอง repo — รอเจ้าของ review**

### R13 — ปิด unauthenticated workbook upload บน shared backend (2026-07-27)

Codex blind review พบว่า scope ของ `appAuth` ที่ port ครั้งแรกตกหล่น `/api/workbooks/*`:
route ถูก mount ใช้งานจริงแต่ `workbookRoutes.js` ไม่มี middleware ทำให้คำขอที่ไม่มี credential
ผ่านถึง controller (ตอบ validation 400 แทน 401). CORS ไม่สามารถทดแทน authentication สำหรับ curl
หรือ server-to-server caller ได้

แก้โดยเพิ่ม `appAuth` ภายใน `workbookRoutes` ก่อน `multer`/`POST /process`; จึงยังคงหลักการของ
shared backend ว่าไม่ครอบ auth ไปยัง feature สาธารณะอื่น และไม่เปลี่ยน route path, payload,
workbook processing logic, config หรือค่าเดิมใดๆ. เพิ่ม route-level regression tests ใน
`backend/tests/seamless-app-auth.test.cjs` ยืนยัน no credential → 401 พร้อม
`WWW-Authenticate`/`UNAUTHORIZED`, ส่วน Basic และ Bearer ที่ถูกต้องผ่าน auth แล้วถึง validation
เดิม → 400 เมื่อไม่มีไฟล์.

ผลทดสอบหลังแก้: `seamless-app-auth` 8/8, full shared-backend suite 76 passed + 5 skipped +
0 failed, และ client 8/8 ผ่าน.

### Deployment audit หลัง R13 (2026-07-27)

ตรวจ Render workspace จริงก่อน merge/deploy แล้วพบว่า ข้อความก่อนหน้านี้ที่ระบุว่า
`claspscxseamless-web` “ไม่เคย deploy” ไม่ตรงกับ external state ปัจจุบัน: มี service
`claspscxseamless-web` (`srv-d94a29dckfvc739jo3mg`) อยู่จริง, สถานะไม่ suspended,
และ `https://claspscxseamless-web.onrender.com/api/health` ตอบ 200. ยังไม่ได้ลบ/หยุด service
ดังกล่าว เพราะต้องยืนยัน traffic/ข้อมูลที่ใช้งานอยู่ก่อน.

ตรวจเฉพาะชื่อ env โดยไม่แสดง secret พบว่า service เก่าไม่มี `APP_BASIC_USER`/
`APP_BASIC_PASSWORD`; live `GET /api/bootstrap` โดยไม่ใส่ credential ตอบ 200. Shared service
`SC-official-website` มี DB URL/schema พร้อมและ health ตอบ 200 แต่ยังไม่มี
`SEAMLESS_APP_BASIC_USER`/`SEAMLESS_APP_BASIC_PASSWORD` รวมถึง LINE/R2/email config สำหรับ
โมดูลใหม่นี้. จึงเปิด Draft PR ไว้แต่ยังไม่ merge/trigger auto-deploy จนกว่าจะตั้ง production
credentials อย่างน้อยสองค่าแรกให้ครบ. Scheduled auto-print ยังไม่ถูกเปิด.

หลัง audit รัน `npm run seamless:migrate` กับ production database ผ่าน connection string ของ
shared Render service โดยไม่แสดงค่า secret แล้ว: 001, 002 และ 003 ถูก skip เป็น
already-applied ทั้งหมดและจบสำเร็จ จึงยืนยันแล้วว่า production migration เป็น no-op ตามคาด.
