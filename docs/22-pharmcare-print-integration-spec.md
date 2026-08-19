# 22 PharmCare Print Integration Spec

วันที่จด: 2026-08-19
สถานะ: Backend เสร็จแล้ว (implement + test โดย Claude Sonnet 5 เอง เพราะแตะ shared print
pipeline ของ `currentSC-official-website-project`) — **Frontend (ปุ่ม "ขอปริ้น" ในหน้า
PharmCare Inbox) ยังไม่เริ่ม รอ GLM 5.2**

## จุดประสงค์

ให้เอกสาร PharmCare (เช่น E-Credit Invoice PDF) กดปริ้นผ่าน**ช่องทางเดียวกับที่ Seamless ใช้อยู่
แล้ว** ได้ — เครื่องพิมพ์จริง (print-agent), คิวพิมพ์ (`print_jobs`), และการแจ้งเตือน
(LINE group เดียวกัน + อีเมลผู้รับเดียวกัน) — โดยไม่แก้ print-agent หรือ schema ใหม่เลย

**Reference สนทนากับเจ้าของ repo (2026-08-19)** — สรุปการตัดสินใจ:
1. สร้างคิวปริ้นด้วยการใช้ตาราง `processing_records` เดิมซ้ำ (ไม่ generalize เป็น
   source_type/source_id ใหม่ — เร็วกว่า เสี่ยงน้อยกว่า)
2. Trigger เป็นปุ่ม "ขอปริ้น" กดเอง ทีละฉบับ (**ไม่มี auto-print** สำหรับ PharmCare)
3. ช่องทางแจ้งเตือน (LINE group + อีเมลผู้รับ) ใช้ชุดเดียวกับ Seamless เป๊ะ ไม่มี config ใหม่
4. Template แยกกันด้วย accent color (เขียว Seamless / เขียวมิ้นท์-ฟ้า PharmCare #1DADA8)
   + emoji/หัวข้อต่างกัน แต่โครงสร้าง bubble เดียวกัน — อีเมลแยกแค่ subject prefix
   (`[PharmCare]` vs `[ClaspSCxSeamless]`) ไม่มี HTML template

## สถาปัตยกรรม (ภาพรวม)

```
กด "ขอปริ้น" ที่แถวเอกสาร PharmCare (frontend, ยังไม่ทำ)
  → POST /api/app/pharmcare/documents/:id/print (backend, เสร็จแล้ว)
    → ensurePrintableRecord(): สร้าง (หรือ reuse) processing_records + generated_files row
      ที่ชี้ไปยัง storage object เดิมของไฟล์แนบ PharmCare (ไม่คัดลอกไฟล์)
    → processingRecordAppService.requestPrint(recordId, {requestedBy, reason})
      — โค้ดเดิม 100% ไม่แตะเลย
  → print-agent (เครื่องจริง) poll คิวตามปกติ → ดาวน์โหลด → ปริ้น
  → completeAgentPrintJob() (โค้ดเดิม) → sendPrintNotification() + sendPrintEmailNotification()
    — ทั้งสองฟังก์ชันนี้เช็ค record.metadata.source === 'pharmcare' แล้วสลับ template
```

## ไฟล์ที่แตะฝั่ง Backend (`currentSC-official-website-project`, เสร็จแล้ว)

| ไฟล์ | สิ่งที่เพิ่ม/แก้ |
|---|---|
| `backend/src/modules/seamless/services/pharmcarePrintService.js` (ใหม่) | `requestPharmcarePrint(documentId, {requestedBy, reason})` — หา document+attachment ตรงจาก `pharmcare_documents`/`pharmcare_email_attachments` (query ตรงๆ ไม่ผ่าน `pharmcareRepository.js` เพราะไฟล์นั้นมีอีก workstream แก้อยู่พร้อมกัน ณ ตอนเขียนโค้ดนี้ — ดู docs/18), สร้าง `generated_files`+`processing_records` แบบ idempotent ต่อ document (เช็คด้วย `metadata->>'pharmcareDocumentId'`), ล็อกด้วย `pg_advisory_xact_lock` กันสองคลิกพร้อมกันสร้างซ้ำ |
| `backend/src/modules/seamless/controllers/pharmcarePrintController.js` (ใหม่) | `requestPrint(req, res)` — เช็ค `req.appRole === 'admin'` เอง (403 ถ้าไม่ใช่) แล้วเรียก service |
| `backend/src/modules/seamless/routes/pharmcareRoutes.js` | เพิ่ม `POST /documents/:id/print` |
| `backend/src/modules/seamless/errors.js` | เพิ่ม `forbidden()` helper (403) — ไม่มีมาก่อน มีแต่ `unauthorized` (401) |
| `backend/src/modules/seamless/services/lineNotifyService.js` | แยก `buildPharmcareFlexContents()` ออกจาก `buildFlexContents()` เดิม — เช็ค `record.metadata?.source === 'pharmcare'` แล้วสลับ; เพิ่ม `buildAccentStrip(color)` (แถบสีบางๆ บนสุดของ bubble ทั้งสองแบบ — เขียว `#0D7A56` ของเดิม, ฟ้าอมเขียว `#1DADA8` ของ PharmCare); `buildAltText()` สลับ emoji 📄/💊 ตาม source |
| `backend/src/modules/seamless/services/printAgentService.js` | `sendPrintEmailNotification()` สลับ subject prefix `[PharmCare]`/`[ClaspSCxSeamless]` ตาม `record.metadata?.source` |
| `backend/src/modules/seamless/processingRecords.js` | `listProcessingRecords()` เพิ่ม `WHERE metadata->>'source' IS DISTINCT FROM 'pharmcare'` **เฉพาะตอนไม่ได้ query ด้วย `id`** (ป้องกันไม่ให้ PharmCare print record โผล่ปนใน History dashboard ของ Seamless/Shopee — จุดเดียวที่ enforce ไม่ต้องจำไปทำทุกจุดที่เรียก) — การ lookup ตรงด้วย id (ที่ print pipeline เองใช้) ยังหาเจอตามปกติ |

### ทำไมใช้ `processing_records` ซ้ำ (ไม่สร้างตารางใหม่)

`print-agent` (ซอฟต์แวร์บนเครื่องพิมพ์จริง) และ `readStoredFile`/`createStoredFileStream`
เป็น generic อยู่แล้ว (รับแค่ `storageProvider`+`storagePath`+`downloadUrl` ไม่สนว่าไฟล์มาจากไหน)
— ยืนยันแล้วว่า `pharmcare_email_attachments.storage_path` ใช้ `readStoredFile()`/
`createStoredFileStream()` ตัวเดียวกับที่ `generated_files.storage_path` ใช้ (ทั้งคู่อยู่ schema
`clasp_scx_seamless` เดียวกัน) จึงชี้ไปที่ physical file เดิมได้โดยไม่ต้องคัดลอกไฟล์เลย

**ข้อจำกัดที่ต้องรู้**: `report_type` เป็น enum จำกัด (`individual`/`summary`/`shopee` —
validators.js `parseFormatterMode`) ใส่ `'pharmcare'` ตรงๆ ไม่ได้ ใช้ `'individual'` แทน
(ใกล้เคียงที่สุด — เอกสารเดี่ยวต่อฉบับ) ตัวบ่งชี้จริงว่าเป็น PharmCare คือ
`metadata.source === 'pharmcare'`

## Backend API Contract (สำหรับ Frontend เรียก)

```
POST /api/app/pharmcare/documents/:id/print
Authorization: ต้องเป็น admin session (Basic Auth คู่ admin หรือ session cookie role=admin)
Body (ทั้งสอง field optional):
  { "requestedBy": "ชื่อคนกด (optional)", "reason": "เหตุผลถ้าเป็นการปริ้นซ้ำ (optional)" }

Response 200 (โครงสร้างเดียวกับ requestProcessingHistoryPrint ที่ frontend มี pattern อยู่แล้ว):
  {
    "ok": true,
    "message": "Print requested." | "Reprint requested.",
    "record": { ...processing_records mapped shape... },
    "job": { id, processingRecordId, isReprint, attemptNo, status: "queued", ... }
  }

Error responses:
  400 BAD_REQUEST  — เอกสารไม่มีไฟล์แนบให้ปริ้น (เช่น receipt_link_pending ที่ยังไม่มีไฟล์)
  403 FORBIDDEN     — session ไม่ใช่ admin
  404 NOT_FOUND     — document id ไม่มีจริง
```

`:id` = **document id** (ตัวเดียวกับ `document.id` ที่ frontend ใช้อยู่แล้วในตาราง PharmCare
Inbox — ไม่ใช่ attachment id หรือ message id) เพราะเอกสารเป็นหน่วยที่ผู้ใช้คิดถึงตอนกด "ปริ้น"
(หนึ่ง message อาจมีหลาย document — เช่น MRR+SFR — ต้องเลือกว่าจะปริ้นฉบับไหน)

กดปุ่มซ้ำที่เอกสารเดิม (ปริ้นซ้ำ) จะได้ response กลับมาเหมือนเดิมทุกครั้ง (idempotent สร้าง
record/file แค่ครั้งแรก) — ครั้งที่สองเป็นขึ้นไปจะได้ `message: "Reprint requested."` และ
`job.isReprint: true` โดยอัตโนมัติ (โค้ดเดิมของ `processingRecordAppService.requestPrint`
จัดการให้อยู่แล้ว ไม่ต้องทำอะไรเพิ่มฝั่ง frontend)

## Tests ที่เขียนไว้แล้ว (backend, ทั้งหมดผ่าน)

- `tests/pharmcare-print-controller.test.cjs` — 403 เมื่อไม่ใช่ admin, 200 พร้อมส่ง body ผ่านไป
  ที่ service ถูกต้องเมื่อเป็น admin, error propagation
- `tests/line-notify-print-notification.test.cjs` — เทียบ template สองแบบ (สี accent, emoji,
  ข้อความ), fallback ของ documentType ที่ไม่รู้จัก, reprint warning box ยังทำงานถูกทั้งสอง
  template
- `tests/seamless-processing-records.test.cjs` — เพิ่ม 2 เคส: PharmCare record ไม่โผล่ในลิสต์
  ทั่วไป, แต่หาเจอเมื่อ query ด้วย id ตรงๆ
- **ยังไม่ได้เขียนเทส**: `pharmcarePrintService.js` เอง (การ query จริง + advisory lock
  transaction) — โค้ดในสไตล์เดียวกับ `createAgentPrintJob` ที่มีอยู่แล้วในโค้ดเบสนี้ก็ไม่มี unit
  test ระดับนี้เหมือนกัน (ดูเหมือนทีมเดิมพึ่ง live/integration test แทน) — ต้องทดสอบมือ end-to-end
  หลัง deploy ก่อนประกาศว่าใช้งานได้จริง (ดูหัวข้อถัดไป)

## ทดสอบมือหลัง deploy (ต้องทำก่อนบอกว่า "ใช้ได้แล้ว")

1. เรียก `POST /api/app/pharmcare/documents/:id/print` ด้วย admin session จริงกับเอกสารจริง 1 ฉบับ
2. เช็คว่า `processing_records`/`generated_files` แถวใหม่ถูกสร้างจริงใน DB (`metadata.source =
   'pharmcare'`)
3. เช็คว่า **ไม่โผล่**ในหน้า History dashboard ของ Seamless (`/history`)
4. รอ print-agent (หรือกระตุ้นด้วยมือ) ปริ้นจริง เช็คว่าไฟล์ที่ออกมาถูกต้อง (ไม่ใช่ error/blank)
5. เช็ค LINE group ว่าได้ข้อความ 💊 สีฟ้าอมเขียว ไม่ใช่ 📄 สีเขียวของ Seamless
6. เช็คอีเมลว่า subject ขึ้นต้น `[PharmCare]`
7. กดปุ่มซ้ำที่เอกสารเดิม เช็คว่าไม่ได้สร้าง record/file ใหม่ซ้ำ (reuse ของเดิม) และแจ้งเตือนบอก
   "ปริ้นซ้ำ" ถูกต้อง

## งานฝั่ง Frontend ที่เหลือ (สำหรับ GLM 5.2 — task 8 ใน docs/20)

**ยังไม่เริ่มเลย** ดูรายละเอียด task ที่ `docs/20-frontend-work-review-ledger.md`
(บันทึกเป็น task ใหม่แยกจากไฟล์นี้ ไฟล์นี้เป็นแค่ spec อ้างอิงของฝั่ง backend)

สรุปสั้นๆ ที่ frontend ต้องทำ:
1. เพิ่ม `requestPharmcarePrint(documentId, {requestedBy, reason})` ใน `client/src/services/
   api.js` — pattern เดียวกับ `requestProcessingHistoryPrint()` ที่มีอยู่แล้ว (ดูไฟล์นั้นเป็น
   ตัวอย่างตรงๆ ได้เลย)
2. เพิ่มปุ่ม "ขอปริ้น" ในตาราง/detail panel ของ PharmCare Inbox — **เฉพาะ admin เท่านั้น**
   (เช็คจาก `appRole` ที่ Panel มีอยู่แล้ว จาก task 6) — เอกสารที่ไม่มีไฟล์แนบ
   (`receipt_link_pending` ที่ยังไม่มีไฟล์) ไม่ควรมีปุ่มนี้เลยหรือ disable ไว้
3. Loading/success/error state เหมือน pattern ปุ่ม reprint เดิมของ Seamless (ดูตัวอย่างจริงใน
   `HistoryActions.jsx`/`HistoryPanel.jsx`)
