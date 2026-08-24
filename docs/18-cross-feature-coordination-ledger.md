# 18 Cross-Feature Coordination Ledger

วันที่จัดทำ: 2026-08-18
สถานะ: กำลังทำ (living doc — อัปเดตทุกครั้งที่มี workstream ใหม่แตะ print-agent/shared schema)

## จุดประสงค์

ไฟล์นี้ให้ LLM/มนุษย์ **session ใหม่ที่ยังไม่มี context** อ่านก่อนเริ่มงานใดๆ ในนี้ที่แตะ
print-agent, `print_jobs`, `processing_records`, หรือ shared service files — เพื่อเห็นภาพว่า
**มีมากกว่าหนึ่ง workstream กำลังเล็งไปที่โครงสร้างเดียวกันพร้อมกัน** และป้องกันการ merge/commit
ที่ชนกันโดยไม่รู้ตัว

ไม่ใช่ที่แทน `docs/11-print-agent-review-ledger.md` (นั่นคือ per-task code review ของงานสร้าง
print-agent ครั้งแรก) — ไฟล์นี้คือภาพรวมระดับ "ใครกำลังทำอะไรอยู่ ชนกันตรงไหนได้บ้าง"

## Workstream ที่ active อยู่ตอนนี้

### อัปเดต 2026-08-24 — Shopee live email inbox

- Scope ใหม่: เพิ่มเมนู `/shopee/inbox` ชื่อ **รายงานอีเมล์จาก Shopee** และ endpoint
  `GET /api/app/shopee/inbox` ใน shared backend จริง เพื่ออ่านอีเมลจาก
  `info@mail.shopee.co.th` แบบ read-only
- สถาปัตยกรรม: อ่าน Gmail สดเมื่อเปิดหน้า ใช้ OAuth read-only ของ mailbox
  `admin@scgroup1989.com` ชุดเดียวกับ PharmCare แต่ใช้ query แยก
  (`SEAMLESS_SHOPEE_GMAIL_QUERY`, default ล็อกไว้ที่ sender ข้างต้น) ไม่มี migration/ตารางใหม่
  และไม่แตะ `processing_records`, `print_jobs`, R2 หรือ print-agent
- การจัดประเภทหัวข้อที่ยืนยันจากตัวอย่างจริง 98 ฉบับใน 30 วัน: ยืนยันคำสั่งซื้อ COD,
  ถึงเวลาจัดส่ง, ยกเลิก, สินค้าหมด, ความปลอดภัยบัญชี, พัสดุส่งคืนผู้ขาย
- ไฟล์ production ที่แตะ: `currentSC-official-website-project/backend/src/modules/seamless/`
  (`config.js`, Gmail adapter, Shopee inbox service/controller/routes + tests) และ
  `ClaspSCxSeamless/client/` เท่านั้น
- **ไม่แตะไฟล์ dirty เดิมใน `server/`/`print-agent/` ด้านล่างเลย** — Shopee accounting
  workbook workflow เก่ายังเป็น workstream คนละชุดและยังค้างเหมือนเดิม
- ผล review รอบ 2 แก้แล้วใน local: ข้ามเฉพาะ `messages.get` 404 แต่ propagate
  auth/quota/5xx ทุกกรณี, exact ICT boundary post-filter ด้วย `internalDate`, filter generation
  ป้องกัน stale rows/cursor, Gmail metadata-only + timeout 10 วินาที/no application retry,
  cache ต่อ instance 15 วินาที, cap หน้าไม่เกิน 25 และปกปิด buyer username ฝั่ง backend สำหรับ
  role `user` ทั้ง `จากผู้ซื้อ ...`, `ถูกยกเลิกโดย ...`, `ถูกทำการยกเลิกโดย ...`
  (admin เห็น subject เต็ม)
- สถานะ ณ ตอนบันทึก: frontend 61/61 + build ผ่าน, backend targeted 42/42 ผ่าน;
  regression ไม่รวม integration 199 ผ่าน/5 skip; full backend 244 ผ่าน/5 skip. ตัวเลข full suite
  รวม `backend-integration.test.cjs` dirty ของ RX1011 จึงไม่ใช่ Shopee baseline โดยตรง;
  reviewer รอบสุดท้าย approve แล้ว. Code commit backend `8f45b9f` และ frontend `81b714d`
  push ขึ้น `main` แล้ว; **ยังไม่ deploy จนกว่าจะยืนยัน Gmail quota regime ของ Cloud project**

### 1. Shopee accounting workbook workflow

- เอกสาร: `docs/15-shopee-document-mvp.md`, `docs/16-shopee-june-2026-agent-handoff.md`
- ทีม: Codex (Tech Lead) → Claude Sonnet 5 (Senior Dev/Reviewer) → GLM 5.2 (Junior Implementer),
  ตาม protocol ใน docs/16 (ห้าม commit/push/deploy/สั่งพิมพ์จริงจนกว่าเจ้าของ repo จะสั่ง)
- Scope: อัปโหลดเอกสาร Shopee → แปลงเป็นรายงานบัญชี 5 ชีตตาม spec เดือนมิถุนายน 2026 →
  `printPolicy: manual` (**ไม่** auto-queue พิมพ์เอง)
- สถานะ: **ยังไม่เสร็จ/ยังไม่ commit** — ใช้ GLM 5.2 เป็นหลัก แล้วมีช่วงที่ GLM หมดโควต้าจึงให้
  Codex/Claude ทำต่อบางส่วน
- ไฟล์ที่แตะ (working tree ตอนนี้ ยัง dirty ทั้งหมด — ดูหัวข้อ "Git status" ด้านล่างสำหรับ list เต็ม):
  หลักๆ คือ `server/src/services/{printAgentService,workbookService,workbookTransformService,
  emailService,r2StorageService}.js`, `server/src/middleware/appAuth.js`,
  `server/src/controllers/fileController.js`, `print-agent/src/print.js`

### 2. PharmCare finance email automation

- เอกสาร: `docs/13-pharmcare-finance-email-automation.md`,
  `docs/14-pharmcare-sonnet-implementation-plan.md`
- ทีม: Claude Sonnet 5 (M1, M2 fixes + live validation)
- Scope: อ่านอีเมลการเงินจาก PharmCare (Gmail) → classify/dedup → เก็บเป็นเอกสารรอตรวจ →
  (M4-M5 ยังไม่ถึง) รวม PDF แล้วส่งเข้า print queue เดิม
- สถานะ (อัปเดตล่าสุด 2026-08-18 ค่ำ):
  - **M1 (read-only Inbox) — เสร็จและ commit แล้ว**: `currentSC-official-website-project`
    commit `134c1a8`, `ClaspSCxSeamless` commit `480d419`
  - **M2 (Gmail sync) — เสร็จ, validate จริงกับ Gmail สำเร็จแล้ว, commit แล้ว**
    (`currentSC-official-website-project` commit `1b3b8dc` + review fixes + bugfix
    `151a94d`) — **ยังไม่แตะไฟล์ไหนใน ClaspSCxSeamless เลย**
  - **Gmail credential พร้อมใช้งานจริงแล้ว**: OAuth refresh token (mode
    `oauth_refresh_token`) ของ `admin@scgroup1989.com` ตั้งขึ้นสำเร็จผ่าน
    `backend/scripts/pharmcare-gmail-oauth-setup.cjs` — ทดสอบจริงจากเครื่อง local:
    `dry-run` และ `ingest-one` ผ่านทั้งคู่, พิสูจน์ idempotency แล้ว (รันซ้ำได้
    `already_ingested`) — มีเอกสารจริง 1 ฉบับ (`CIV01250811-00020`) ถูก ingest เข้า
    production DB จริงแล้ว
  - **ยังไม่ได้ตั้ง env vars บน Render** (`SEAMLESS_PHARMCARE_GMAIL_*`) — ทดสอบจากเครื่อง
    local เท่านั้น production ยังไม่มี credential
  - ระหว่างทดสอบเจอบั๊กจริงจากข้อมูลจริง (Gmail รายงาน mimeType เป็น
    `application/octet-stream` สำหรับ PDF จริง ทำให้ validation เดิม false-reject) —
    แก้แล้วใน commit `151a94d`
  - M3 (settlement review), M4 (PDF package), M5 (printing) — **ยังไม่เริ่ม**
  - แผนถัดไป (ตามที่เจ้าของ repo บอกไว้ 2026-08-18): **ทำ PharmCare ต่อพรุ่งนี้ให้เสร็จ**
    (ตั้ง env vars บน Render + อาจไป M3+), Shopee ค่อยกลับไปทำต่อ**ภายในสัปดาห์หน้า**

## จุดที่จะชนกัน (ต้องอ่านก่อนแตะ)

ทั้งสอง workstream กำลัง**เล็งไปที่โครงสร้างเดียวกันในที่สุด** แม้ตอนนี้ PharmCare จะยังไม่ถึงขั้น
แตะ print-agent จริง (แค่วางแผนไว้ใน docs/14 M5):

| โครงสร้าง/ไฟล์ | Shopee แตะยังไง | PharmCare จะแตะยังไง (M4-M5, ยังไม่เริ่ม) |
|---|---|---|
| `server/src/services/printAgentService.js` | แก้อยู่ตอนนี้ (dirty, ยังไม่ commit) | M5 ต้องเพิ่ม PDF-direct branch |
| `print_jobs` / `processing_records` schema | ใช้ของเดิม (`printPolicy: manual`, ไม่ auto-queue) | M5 ต้อง generalize เป็น printable artifact ทั่วไป (ตาม docs/14 §15.3) |
| `print-agent/src/print.js` (HQ000 agent) | แก้อยู่ตอนนี้ (dirty) | M5 ต้องเพิ่ม `.pdf` branch (ข้าม LibreOffice) |

**กติกา**: ก่อน merge/commit งานใดที่แก้ 3 จุดข้างบน ให้เช็คไฟล์นี้ก่อนว่าอีก workstream
กำลังแก้จุดเดียวกันอยู่หรือเปล่า — ถ้าใช่ ให้ประสานกันก่อน (เช่น รอ Shopee commit ก่อนค่อยเริ่ม
PharmCare M5) อย่าแก้พร้อมกันแบบไม่รู้จักกัน

## Git status ณ วันที่อัปเดตล่าสุด (2026-08-18 ค่ำ)

**ClaspSCxSeamless** — dirty จากงาน Shopee ยังคงเดิม (ยังไม่ commit ตาม protocol docs/16,
ไม่ได้แตะเพิ่มจาก PharmCare เลย):
```
M  docs/07-frontend-backend-integration.md
M  print-agent/src/print.js
M  print-agent/tests/print.test.js
M  server/.env.example
M  server/src/config/env.js
M  server/src/controllers/fileController.js
M  server/src/middleware/appAuth.js
M  server/src/services/emailService.js
M  server/src/services/printAgentService.js
M  server/src/services/r2StorageService.js
M  server/src/services/workbookService.js
M  server/src/services/workbookTransformService.js
M  server/tests/app-auth.test.js
M  server/tests/workbook-transform.test.js
?? docs/17-office-calendar-print-warning-idea.md
?? server/tests/email-service.test.js
?? server/tests/r2-storage-bucket.test.js
```
PharmCare M1 คือ commit `480d419` (ไม่มีไฟล์ M2 ใน repo นี้เลย)

**currentSC-official-website-project** — **สะอาดแล้ว** (PharmCare M2 + fix commit ครบ):
commit `1b3b8dc` (M2) → review fixes → `151a94d` (MIME validation bugfix + OAuth setup
script) ทั้งหมดอยู่บน branch `migrate/shopee-shared-20260807`

เหลือแค่ RX1011 dirty เดิมที่ไม่เกี่ยวข้อง (ห้ามแตะ — ไม่เคยถูกแตะตลอดงาน PharmCare):
`RX1011_INTEGRATION_REPORT.md`, `backend/src/modules/rx1011/db/pool.js`,
`backend/tests/backend-integration.test.cjs`, `docs/env/ENV_VAR_COLLISION_AUDIT.md`,
`docs/INCIDENT_2026-07-27_rx1011_db_env_var.md`

## PharmCare real-time sync (Gmail Pub/Sub) — สถานะล่าสุด 2026-08-19

Live ใช้งานจริงแล้ว (ไม่ใช่แค่ manual CLI อีกต่อไป):
- Google Cloud Pub/Sub topic `pharmcare-gmail-notifications` (project
  `disco-outpost-470112-m1`) + push subscription `pharmcare-gmail-push` ชี้ไปที่
  `POST /api/pharmcare-webhooks/gmail?token=...` (ป้องกันด้วย shared secret ใน query string
  เพราะ Google ทำ Basic/Bearer auth ของเราไม่ได้ — pattern เดียวกับ LINE webhook ที่ใช้ HMAC แทน)
- webhook ไม่ parse เนื้อหา notification เลย (Gmail ไม่ส่งเนื้อหาอีเมลมาให้ตอนแจ้งเตือนอยู่แล้ว) —
  แค่ trigger `runPharmcareGmailSync(..., { runKind: "incremental" })` ตัวเดิมที่มีอยู่แล้วซ้ำ
- `watch()` subscription **หมดอายุทุก 7 วัน** ต้องเรียก `node scripts/pharmcare-gmail.cjs watch`
  ซ้ำก่อนหมดอายุ ไม่งั้นแจ้งเตือนหยุดเงียบๆ ไม่มี error โผล่ที่ไหนเลย

**การตัดสินใจสำคัญ (2026-08-19)**: **ยังไม่ตั้ง Render Cron Job ต่ออายุอัตโนมัติ** เพราะ Render
Cron Job ไม่มี free tier ต้องเสียตังเพิ่ม และระบบยังใช้งานไม่มากพอที่จะคุ้ม — เจ้าของ repo ตัดสินใจ
เลือกทำ **manual/on-demand check ผ่าน `node scripts/pharmcare-gmail.cjs status`** ไปก่อน (จะโชว์
warning ชัดเจนถ้า watch ใกล้หมดอายุ/หมดอายุแล้ว) และ **แจ้งเตือนผ่าน LINE เมื่อ sync ที่ webhook
trigger ล้มเหลวจริง** (reuse `lineNotifyService.sendTextAlert`)

**ข้อจำกัดที่ยอมรับไว้ตอนนี้**: ไม่มี proactive check ว่า watch หมดอายุหรือยัง — ถ้าไม่มีใครรัน
`status` เอง ระบบจะไม่รู้ตัวว่า real-time sync หยุดทำงานไปแล้วจนกว่าจะมีคนสังเกตว่าเอกสารไม่เข้ามา
**แผนอนาคตเมื่อระบบใช้งานมากขึ้น**: ตั้ง Render Cron Job (หรือ GitHub Actions scheduled workflow
ที่ไม่เสียตัง) ให้เรียก `watch` อัตโนมัติทุกวัน — ตอนนั้นค่อยยอมเสียตังจ่าย Cron Job ถ้าจำเป็น

## หนี้ที่ควรแก้ก่อน PharmCare M2 ไป production จริง (ไม่ใช่ blocker วันนี้)

- Migration ชื่อ `006` ซ้ำกัน 2 ไฟล์ (`006_add_shopee_document_type.sql` vs
  `006_pharmcare_ingestion.sql`) — ไม่พังเพราะ runner เก็บด้วยชื่อไฟล์เต็ม แต่ควร rename กันสับสน
  (คอมเมนต์อธิบายไว้ในไฟล์แล้ว)
- ~~`backfill` mode ทับ checkpoint ของ incremental sync~~ — **แก้แล้ว**
- ~~CLI `pharmcare-gmail.cjs` โหมด `ingest-one`/`status` ไม่ปิด DB pool~~ — **แก้แล้ว**
- ไม่มี proactive alert เมื่อ Gmail push subscription หมดอายุ (ดูหัวข้อด้านบน) — ยอมรับเป็นความเสี่ยง
  ต่ำตอนนี้ รอ Cron Job ในอนาคต
