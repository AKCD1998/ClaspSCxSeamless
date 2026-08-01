# 14 PharmCare Sonnet Implementation Plan

วันที่จัดทำ: 2026-08-01  
เอกสารแม่: `docs/13-pharmcare-finance-email-automation.md`

## 1. คำสั่งสั้นสำหรับ Sonnet

เริ่มจาก backend-first แบบ vertical slice และทำเฉพาะ **Milestone 1: Read-only PharmCare Inbox** ให้เสร็จพร้อม tests ก่อน ห้ามเริ่ม PDF merge, print job, LINE/email notification หรือ production scheduler ในงานรอบนี้

ผลลัพธ์ปลายทางของ milestone:

```text
synthetic Gmail message หรือ Gmail message จริง 1 ฉบับจาก admin mailbox
  -> normalize direct/Fwd metadata
  -> classify
  -> hash + deduplicate
  -> เก็บไฟล์ใน storage abstraction เดิม
  -> เก็บ metadata ใน PostgreSQL
  -> GET API
  -> แสดงใน /pharmcare/upload ในฐานะ PharmCare Inbox
```

การ import message เดิมซ้ำต้องไม่สร้าง message, attachment, document หรือ R2 object ซ้ำ และห้ามเปลี่ยนสถานะใด ๆ ใน Gmail

## 2. Repo และขอบเขตความรับผิดชอบ

งานนี้แตะสอง repo:

| Repo | หน้าที่ใน milestone นี้ |
|---|---|
| `C:\Users\scgro\Desktop\Webapp training project\currentSC-official-website-project` | PostgreSQL migration, Gmail adapter, parser/classifier, ingestion service และ authenticated API |
| `C:\Users\scgro\Desktop\Webapp training project\ClaspSCxSeamless` | API client, PharmCare Inbox UI และ frontend tests |

ก่อนแก้ไฟล์ให้ตรวจ `git status` ทั้งสอง repo และรักษา user changes ที่มีอยู่ ห้ามแก้หรือ revert งาน RX1011 และ `docs/11-print-agent-review-ledger.md` ที่ไม่เกี่ยวข้อง

## 3. ข้อเท็จจริงที่ห้ามตีความใหม่

- Mailbox automation คือ `admin@scgroup1989.com`
- ผู้ส่ง PharmCare หลักคือ `info@pharmcare.co`
- historical forward 41 ฉบับอยู่ใน admin แล้ว ห้ามส่งซ้ำ
- historical forward แสดง visible From เป็น `auukunn.bkk@gmail.com` และ subject ขึ้นต้น `Fwd:`
- automatic Gmail filter mail แสดง original From/subject ได้โดยตรง
- ห้าม classify จาก visible From เพียง field เดียว
- เอกสารที่พบจริง: `CIV` e-credit invoice, `MRR`, `SFR`, receipt/tax link ที่ไม่มี attachment และ contract
- `pharmcare_business@googlegroups.com` กับ `pharmcare_ops@googlegroups.com` เป็น CC ที่เคยพบ ไม่ใช่ sender ที่ยืนยันแล้ว
- Gmail access ต้อง read-only: ห้าม send, forward, delete, mark read, label หรือแก้ message
- ห้ามใส่ข้อมูลอีเมลจริง, PDF จริง, credential หรือ raw MIME ลง Git/test snapshot/log

## 4. Technical decisions สำหรับ Milestone 1

### 4.1 Backend เป็นเจ้าของ ingestion

หน้า React ห้ามเรียก Gmail API โดยตรง Backend เป็นผู้เข้าถึง Gmail, storage และ PostgreSQL ส่วน browser อ่านเฉพาะ API ที่ผ่าน `appAuth`

### 4.2 สร้างตาราง PharmCare แยกจาก workbook เดิม

ห้ามปลอม PharmCare เป็น `processing_records.report_type='individual'` หรือ `'summary'` และห้ามขยาย print schema ใน milestone นี้ ให้เพิ่ม migration `006_pharmcare_ingestion.sql` อย่างน้อยสามตาราง:

#### `pharmcare_email_messages`

- `id uuid primary key`
- `mailbox_account text not null`
- `gmail_message_id text not null`
- `gmail_thread_id text`
- `route text`: `direct`, `gmail_filter_forward`, `manual_forward`
- visible From/To/CC และ raw/normalized subject
- parsed original From/subject/date
- `received_at`, `ingested_at`
- `status`: `classified`, `manual_review`, `failed`
- `classifier_version`, `error_code`, `error_message`, `metadata jsonb`
- unique `(mailbox_account, gmail_message_id)`

#### `pharmcare_email_attachments`

- parent message FK
- Gmail attachment/part identifier
- original filename, MIME, byte size, SHA-256
- `storage_provider`, `storage_path`
- `duplicate_of_attachment_id` nullable self-FK
- ingest status และ metadata
- unique ต่อ message + Gmail part/attachment identifier
- index ที่ SHA-256 แต่ไม่จำเป็นต้องบังคับ unique เพราะต้องรักษาหลักฐานว่าไฟล์เดียวกันมาจากหลาย message

#### `pharmcare_documents`

- source message FK และ attachment FK nullable
- `document_type`: `e_credit_invoice`, `settlement_mrr`, `settlement_sfr`, `receipt_link_pending`, `contract`, `unknown`
- document number, partner code, service period start/end, `H1`/`H2`
- source URL nullable สำหรับอีเมลไม่มี attachment
- `review_status`: `auto_classified`, `manual_review`, `duplicate`, `conflict`
- duplicate/superseded relation และ classifier evidence/version

ยังไม่ต้องสร้าง settlement cycle/package/print relation ใน migration นี้ เว้นแต่ต้องใช้ field เล็กน้อยเพื่อแสดง Inbox จริง ๆ

เพิ่มชื่อ table ลง `src/modules/seamless/tables.js` และให้ migration ใช้ pattern/schema runner เดิม

### 4.3 Classification ต้องเป็น pure functions ก่อน

แยก service ที่ unit test ได้โดยไม่ต้องใช้ Gmail/DB/R2:

- normalize prefix `Fwd:`, `FW:` ซ้ำหลายชั้นแบบ case-insensitive
- parse forwarded header block เพื่อหา original From, subject และ date เท่าที่มี
- ตรวจ sender allowlist จาก original sender เมื่อเป็น forward
- classify จาก subject + attachment filename + MIME + parsed fields
- filename/document number มีน้ำหนักมากกว่า display name
- parse `CIV...`, `MRRYYMM-{1|2}-HSPCP...`, `SFRYYMM-{1|2}-HSPCP...`
- แปลง `-1-` เป็น H1 และ `-2-` เป็น H2 โดยคำนวณวันสุดท้ายของเดือนจริง
- unknown/conflicting evidence ต้องเข้า `manual_review` ไม่ถูกทิ้ง
- คืน `reasonCodes`/evidence ที่ UI และ audit อ่านได้ ห้ามคืนแค่ boolean

### 4.4 Dedup สองระดับ

1. Message idempotency: `(mailbox_account, gmail_message_id)`
2. Business/file dedup:
   - SHA-256 เดียวกันข้าม message = duplicate และ reuse canonical storage object
   - CIV number เดียวกัน + hash เดียวกัน = duplicate
   - CIV number เดียวกัน + hash ต่างกัน = `conflict/manual_review`; ห้าม overwrite หรือเลือกฉบับล่าสุดอัตโนมัติ

ทำ check + insert ใน transaction เท่าที่ทำได้ ออกแบบให้ retry หลัง crash ได้โดยไม่สร้าง object/row ซ้ำ ถ้า upload สำเร็จแต่ DB transaction fail ต้องมีผลลัพธ์หรือ cleanup strategy ที่อธิบายใน code comment/test

### 4.5 Storage

reuse `fileStorageService.writeStoredFile()` และ `readStoredFile()` ก่อน ใช้ kind เช่น `pharmcare-source`; source file ต้อง immutable และไม่ public

ใน milestone นี้ยังไม่ต้องสร้าง bucket ใหม่ การใช้ R2 เดิมภายใต้ `SEAMLESS_R2_KEY_PREFIX` + kind แยกเพียงพอสำหรับ vertical slice และ local fallback ต้องยังทำงานใน test/dev

### 4.6 Gmail adapter

สร้าง interface แยกจาก ingestion service เพื่อ mock ใน tests เช่น:

- `listCandidateMessageIds({ after, pageToken })`
- `getMessage(messageId)`
- `getAttachment(messageId, attachmentId)`

ใช้ scope `https://www.googleapis.com/auth/gmail.readonly` เท่านั้น และ pin mailbox เป็น `admin@scgroup1989.com` ผ่าน env ที่ขึ้นต้น `SEAMLESS_PHARMCARE_GMAIL_...`

อย่า commit credential และอย่า log token/raw MIME/body เต็ม เลือก auth mode สำหรับ unattended Render หลังยืนยันสิทธิ Google Workspace:

1. preferred: service account + Domain-Wide Delegation impersonating admin mailbox
2. fallback: OAuth client + refresh token ของ admin mailbox

ถ้ายังไม่มี credential ให้ implement adapter/config validation + mock/fixture path ก่อน งานต้อง test ได้ครบโดยไม่ต่อ Gmail จริง

### 4.7 API

เพิ่ม router ใต้ `/api/app/pharmcare` และครอบด้วย `appAuth`:

- `GET /inbox` รองรับ cursor/limit และ filters ขั้นต่ำ `status`, `documentType`, `duplicate`
- `GET /messages/:id` สำหรับ detail/evidence/attachments
- download source file ต้องผ่าน authenticated proxy; reuse pattern ของ `/api/files/:id/download` หรือทำ PharmCare-specific endpoint ที่ตรวจ ownership

response ต้องไม่ expose `storage_path`, Gmail credential, raw MIME หรือ stack trace

ไม่ต้องเพิ่ม public sync endpoint ถ้าจำเป็นต้องมี endpoint สำหรับ manual sync ให้ป้องกันด้วย internal bearer token, default disabled และทดสอบ 401/403

### 4.8 UI

เปลี่ยน `/pharmcare/upload` จาก placeholder เป็น “PharmCare Inbox” แบบ read-only ก่อน โดยมี:

- summary count: new/classified, manual review, duplicate, failed
- table/list: received time, normalized subject, original sender, type, document number, filename, cycle/period, status
- filters ตาม API
- loading, empty, error และ retry state
- badge แยก direct กับ forwarded
- ไม่ต้องมี approve, merge, print, resend หรือ delete button

คง `/pharmcare/history` เป็น placeholder หรือระบุว่า cycle/package history เป็น milestone ถัดไป ห้ามจำลองข้อมูล production ใน UI

## 5. ลำดับการทำงานที่ Sonnet ต้องทำ

### Step 0 — Baseline

1. อ่าน `docs/13-pharmcare-finance-email-automation.md` และไฟล์ที่เกี่ยวข้องก่อนแก้
2. ตรวจ repo status และบันทึกว่าไฟล์ใด dirty อยู่ก่อน
3. รัน tests/build เดิมของ backend และ client; ถ้ามี failure เดิมให้รายงานแยก ห้ามแก้ของไม่เกี่ยวข้อง

### Step 1 — Pure classifier

1. สร้าง synthetic fixtures ครบ direct mail, manual `Fwd:`, CIV, MRR, SFR, receipt-link, contract และ unknown
2. เขียน unit tests ก่อน/พร้อม implementation
3. ยืนยัน Buddhist/Gregorian year และ last-day-of-month cases รวม leap year
4. ห้ามใช้ข้อมูลจริงจาก mailbox ใน fixture

### Step 2 — Schema/repositories

1. เพิ่ม migration 006 และ table mapping
2. เพิ่ม repository functions แบบ parameterized SQL
3. ทดสอบ unique/idempotency และ duplicate/conflict behavior
4. ห้ามแก้ constraints ของ workbook/print tables เดิม

### Step 3 — Ingestion/storage vertical slice

1. รับ normalized Gmail DTO จาก mock adapter
2. ดาวน์โหลด attachment buffer, validate actual PDF signature/MIME/size, SHA-256
3. classify, deduplicate, write storage, persist DB และ audit outcome
4. import ซ้ำแล้วคืนสถานะ `already_ingested` โดยไม่มี row/object ใหม่
5. error หนึ่ง message ต้องไม่ทำให้ batch ทั้งหมดหยุด และต้อง retry ได้

### Step 4 — Authenticated API

1. เพิ่ม controller/routes/repository query
2. pagination/filter validation และ stable ordering
3. tests: unauthenticated rejection, list/detail success, invalid filters, no sensitive fields

### Step 5 — Read-only Inbox UI

1. เพิ่ม methods ใน `client/src/services/api.js`
2. แทน placeholder ใน `PharmCareUploadPage.jsx`
3. เพิ่ม component เฉพาะเมื่อช่วยให้ test/อ่านง่าย อย่า refactor History เดิมโดยไม่จำเป็น
4. เพิ่ม frontend tests สำหรับ loading/success/empty/error/filter และ forwarded badge

### Step 6 — Optional live smoke test

ทำเฉพาะเมื่อ credential พร้อมและผู้ใช้อนุญาต environment นั้นแล้ว:

1. เริ่มด้วย dry-run message เดียวจาก `admin@scgroup1989.com`
2. แสดง classification/evidence โดยไม่เขียน Gmail
3. ingest message เดิมสองรอบและพิสูจน์ว่ารอบสองเป็น `already_ingested`
4. ตรวจว่า source object/DB row มีเพียงชุดเดียวและ Inbox แสดงหนึ่งรายการ
5. ห้าม backfill 41 ฉบับจนกว่า single-message acceptance ผ่าน

## 6. Tests และ acceptance criteria

Milestone 1 ถือว่าเสร็จเมื่อครบทุกข้อ:

- direct mail และ historical `Fwd:` ถูก normalize เป็น original sender/subject ที่ถูกต้อง
- classify synthetic CIV/MRR/SFR/receipt-link/contract ได้ และ unknown เข้า manual review
- H1/H2 และวันสุดท้ายเดือน 28/29/30/31 ถูกต้อง
- ingest Gmail message เดิมซ้ำไม่สร้าง DB row หรือ storage object ซ้ำ
- hash ซ้ำถูก link เป็น duplicate; CIV เดิมแต่ hash ต่างกันเป็น conflict
- API ทุก endpoint อยู่หลัง auth และไม่ leak storage path/raw MIME/secrets
- `/pharmcare/upload` แสดงข้อมูลจาก API จริง พร้อม loading/empty/error/filter
- tests ใหม่ผ่าน และ tests/build เดิมไม่ regress
- ไม่มี print job, LINE message, email notification หรือ Gmail mutation เกิดจาก milestone นี้
- มี handoff note ระบุไฟล์ที่แก้, migration, env ที่ต้อง provision, คำสั่งทดสอบ และงานค้าง

คำสั่งตรวจขั้นต่ำ:

```powershell
npm --prefix "C:\Users\scgro\Desktop\Webapp training project\currentSC-official-website-project\backend" test -- --runInBand
npm --prefix "C:\Users\scgro\Desktop\Webapp training project\ClaspSCxSeamless\client" test
npm --prefix "C:\Users\scgro\Desktop\Webapp training project\ClaspSCxSeamless\client" run build
```

ถ้า integration tests ต้องใช้ PostgreSQL จริง ให้แยกผลเป็น unit tests ที่รันได้ทุกเครื่องกับ DB integration tests ที่ skip อย่างชัดเจนเมื่อไม่มี test `DATABASE_URL`

## 7. Out of scope ของงานรอบนี้

- backfill ทั้ง 41 messages
- Gmail push/Pub/Sub หรือ production polling scheduler
- ดาวน์โหลดเอกสารจาก receipt/tax URL
- settlement completeness/missing-cycle alert
- PDF merge, manifest, approval หรือ `/pharmcare/history` ตัวจริง
- เปลี่ยน `processing_records`, `generated_files` หรือ `print_jobs`
- PDF-direct branch ใน HQ000 print-agent
- สั่งพิมพ์, ส่ง LINE หรือส่ง email
- แก้ production email `Unauthorized`/missing config
- สร้าง R2 bucket ใหม่หรือเปลี่ยน retention policy

## 8. Milestones หลังจากนี้

หลัง Milestone 1 ผ่าน ค่อยทำตามลำดับ:

1. **M2 Gmail Sync:** cursor/checkpoint, advisory lock, bounded retry, error metrics และ controlled backfill 41 messages
2. **M3 Settlement Review:** cycle H1/H2, MRR/SFR completeness, receipt-link queue, manual relink/override audit
3. **M4 PDF Package:** immutable manifest, preview, human approval และ merged PDF ใน R2
4. **M5 Printing:** generalize printable artifact, PDF-direct branch, preserve double-print protection และแยก spool-complete จาก accounting acknowledgement
5. **M6 Notifications/operations:** แก้ email provider config, LINE/email templates, monitoring, retention/backup และ runbook

ทุก milestone ต้อง deploy แบบไม่สั่งพิมพ์ production โดยอัตโนมัติ และเปิด feature flag ก่อนเสมอ

## 9. รูปแบบรายงานกลับหลัง Sonnet ทำเสร็จ

ให้ Sonnet ตอบกลับเป็นหัวข้อต่อไปนี้:

1. Outcome ที่ทำได้จริง
2. Files changed แยกสอง repo
3. Schema/API/UI behavior
4. Tests/build ที่รันและผลลัพธ์
5. Live Gmail smoke test ทำหรือไม่ได้ทำ พร้อมเหตุผล
6. Environment variables ที่ผู้ใช้ต้อง provision โดยไม่แสดง secret value
7. Risks/open questions
8. Git status ที่เหลือ และยืนยันว่าไม่ได้แตะ user changes ที่ไม่เกี่ยวข้อง
