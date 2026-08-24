# 23 Tech Lead Handoff — 2026-08-19

เขียนโดย: Claude Sonnet 5 (Senior Dev/Reviewer ของ session นี้)
สำหรับ: Codex คนใหม่ที่จะเข้ามารับตำแหน่ง Tech Lead ต่อ
วันที่เขียน: 2026-08-19 (คืน)
สถานะ: ภาพนิ่ง ณ เวลาที่เขียน — โค้ด/commit จริงจะเดินหน้าต่อหลังจากนี้ ให้เช็ค `git log` จริง
เทียบกับ commit hash ที่อ้างไว้ในเอกสารนี้เสมอถ้าตัวเลขไม่ตรง

ไฟล์นี้ตั้งใจให้อ่านจบแล้ว**เข้าใจครบ ไม่ต้องไปไล่ถามใครอีก** — ยาวโดยตั้งใจ อย่าข้าม
ส่วนไหนคิดว่าไม่เกี่ยว เพราะ repo นี้เป็น shared backend ที่มีหลาย workstream ชนกันได้ง่าย

---

## 1. ภาพรวมทั้งระบบ — มีกี่ repo ทำอะไรบ้าง

มี 2 repo หลักที่เกี่ยวข้องกับงานทั้งหมดใน session นี้ (path เป็น local path บนเครื่อง
ที่ session นี้รันอยู่ — ถ้า Codex คนใหม่รันบนเครื่องอื่น path จะต่างออกไป แต่โครงสร้าง repo
เหมือนกัน):

### 1.1 `currentSC-official-website-project` (ชื่อบน GitHub: `AKCD1998/SC-official-website`)

**นี่คือ shared backend ตัวจริงที่ deploy อยู่จริงบน Render เป็น service ชื่อ
`sc-official-website`** — เป็น Express + PostgreSQL monolith ที่รวมหลาย "module" ของบริษัท
ไว้ในที่เดียว:
- `backend/src/modules/seamless/` — **ตัวที่ session นี้แตะเยอะที่สุด** คือ backend จริงของ
  ระบบ "Seamless X GAS Excel Formatter" + PharmCare + Shopee (ดูหัวข้อ 2)
- `backend/src/modules/rx1011/` — ระบบอื่น (ร้านยา RX1011) — **มีไฟล์ dirty ค้างอยู่ ห้ามแตะ**
  ดูหัวข้อ 6.1
- `backend/src/modules/scglamliff/`, `backend/src/modules/digitalpjk/`, และ modules อื่นๆ —
  ระบบอื่นของบริษัทที่ไม่เกี่ยวกับ session นี้เลย ไม่ต้องอ่าน

Database: PostgreSQL, schema `clasp_scx_seamless` (ตั้งชื่อผ่าน env var
`SEAMLESS_DB_SCHEMA`/`DB_SCHEMA`) — **schema เดียวใช้ร่วมกันทั้ง Seamless และ PharmCare**
(ดู `backend/src/modules/seamless/tables.js` — table ทั้งหมดของทั้งสองฟีเจอร์อยู่ใน list
เดียวกัน)

### 1.2 `ClaspSCxSeamless` (ชื่อบน GitHub: `AKCD1998/ClaspSCxSeamless`)

**นี่คือ frontend เท่านั้น** — React + Vite, deploy เป็น **static site** บน Render
(`claspscxseamless.onrender.com`) **ไม่มี backend service จริงของตัวเองเลย** — เรียก API
ไปที่ `currentSC-official-website-project`'s deployed backend โดยตรง (ข้ามโดเมน ใช้ Basic
Auth/session cookie ผ่าน `credentials: 'include'`)

**สิ่งสำคัญที่ต้องรู้ — repo นี้มีโค้ด "ตาย" (dead code) อยู่ด้วย**: โฟลเดอร์ `server/` และ
`print-agent/` ใน repo นี้เป็น**โค้ดยุคเก่าก่อนย้ายไป shared backend** — ตาม
`docs/19-frontend-handoff-context.md` ที่เคยแก้ไขความเข้าใจผิดไว้แล้ว ระบบจริงทั้งหมดย้ายไปอยู่
`currentSC-official-website-project/backend/src/modules/seamless/` หมดแล้ว **แต่** ณ ตอนที่
เขียนเอกสารนี้ ยังมีไฟล์ dirty (ยังไม่ commit) ค้างอยู่ใน `server/`/`print-agent/` จาก
workstream ของ Shopee (ดูหัวข้อ 6.2) — **สับสนได้ง่ายว่า `server/` คือของจริงหรือของตาย
ต้องเช็ค `docs/19` ให้แน่ใจก่อนแตะ**

`client/` คือโค้ด frontend จริงที่ deploy อยู่ — React SPA, routing ด้วย `react-router-dom`,
ไม่มี state management library ใหญ่ (แค่ React state + prop drilling) test ด้วย Node's
built-in `node:test` + `react-dom/server`'s `renderToString` (**ไม่มี DOM จริง ไม่มี React
effects รันได้ใน test — ดูหัวข้อ 3.4**)

---

## 2. ระบบ Seamless module คืออะไร (สิ่งที่ session นี้ทำงานอยู่ด้วยตลอด)

`backend/src/modules/seamless/` ใน `currentSC-official-website-project` เป็น backend เดียว
ที่รองรับ **3 sub-product** พร้อมกัน โดยแชร์โครงสร้างข้อมูล/pipeline บางส่วน:

1. **Seamless X GAS Excel Formatter** (ของเดิมที่สุด) — อัปโหลด workbook, แปลงเป็นรายงาน
   Excel, เก็บ `processing_records`, ส่งปริ้นผ่าน print-agent (เครื่องพิมพ์จริง), แจ้งเตือน
   LINE + อีเมล เมื่อปริ้นเสร็จ
2. **Shopee** — ใช้ pipeline เดียวกับ Seamless (`processing_records`, print-agent เดิม) แค่
   `reportType: 'shopee'` — **workstream นี้ session ปัจจุบันไม่ได้แตะเลย ยังค้างอยู่ตามเดิม
   (ดูหัวข้อ 6.2)**
3. **PharmCare** — ระบบใหม่ที่ session นี้สร้าง/ต่อยอดเกือบทั้งหมด (ดูหัวข้อ 3) — ดึงอีเมล
   การเงินจาก Gmail (`info@pharmcare.co`), จัดประเภทอัตโนมัติ, เก็บเป็นเอกสารรอตรวจ,
   แสดงในหน้าเว็บ, และ (ใหม่ล่าสุด) ปริ้นผ่าน pipeline เดียวกับ Seamless ได้แล้ว

### 2.1 ตารางหลักที่ต้องรู้จัก (schema `clasp_scx_seamless`)

| ตาราง | ใช้ทำอะไร | ใครเป็นเจ้าของ |
|---|---|---|
| `processing_records` | 1 แถว = 1 เอกสารที่ผ่าน pipeline ปริ้น/แจ้งเตือน | Seamless (ของเดิม) — **PharmCare ก็ใช้ตารางนี้ซ้ำแล้ว** (ดูหัวข้อ 4.1) |
| `generated_files` | ไฟล์ output ที่ผูกกับ processing_record (storage pointer) | Seamless — PharmCare ใช้ซ้ำเช่นกัน |
| `print_jobs` | คิวพิมพ์จริง ที่ print-agent (ซอฟต์แวร์บนเครื่องพิมพ์) poll | Seamless — ใช้ร่วมกันทุก source |
| `pharmcare_email_messages` | 1 แถว = 1 อีเมลที่ดึงมาจาก Gmail | PharmCare |
| `pharmcare_email_attachments` | ไฟล์แนบของอีเมล (PDF จริง) | PharmCare |
| `pharmcare_documents` | 1 แถว = 1 เอกสารที่ classify ได้จากอีเมล (อีเมลเดียวอาจมีหลายเอกสาร เช่น MRR+SFR) | PharmCare |
| `pharmcare_sync_state` / `pharmcare_sync_runs` | สถานะ/ประวัติการ sync Gmail | PharmCare |

**กลไกสำคัญที่ทำให้ PharmCare ใช้ pipeline ของ Seamless ซ้ำได้**: `readStoredFile()`/
`createStoredFileStream()` ใน `services/fileStorageService.js` เป็น generic (รับแค่
`storageProvider`+`storagePath`+`bucket`) ไม่สนว่าไฟล์มาจากไหน — `generated_files` และ
`pharmcare_email_attachments` ทั้งคู่เก็บไฟล์จริงผ่านฟังก์ชันเดียวกันนี้ อยู่ storage เดียวกัน
(local disk หรือ Cloudflare R2 bucket เดียวกัน) จึงชี้ไปที่ physical file เดียวกันข้ามตาราง
ได้โดยไม่ต้องคัดลอกไฟล์เลย — **นี่คือหลักการที่ใช้ทำ print integration (หัวข้อ 4)**

---

## 3. งานที่ session นี้ทำ (เรียงตามลำดับเวลา, ละเอียด)

### 3.1 PharmCare backend (Gmail ingestion) — เสร็จและ deploy ใช้งานจริงแล้ว

ก่อนหน้าใน session นี้ (ไม่ใช่ commit ล่าสุด — ดู `git log` ของ
`currentSC-official-website-project` ย้อนไปถึง `0a376c7`):
- ดึงอีเมลจาก Gmail (`admin@scgroup1989.com` ที่ forward มาจาก / ถูก filter จาก
  `info@pharmcare.co`) ผ่าน OAuth refresh token
- Classify อัตโนมัติเป็น 6 ประเภท: `e_credit_invoice`, `settlement_mrr`, `settlement_sfr`,
  `receipt_link_pending`, `contract`, `unknown` — **ความหมายแต่ละอันดูที่
  `docs/21-pharmcare-document-type-glossary.md`** (คำเตือนสำคัญ: MRR/SFR เป็นตัวย่อที่**ยังไม่
  เคยยืนยันความหมายเต็มจาก PharmCare อย่างเป็นทางการ**)
- Dedup ด้วย SHA-256 ของไฟล์แนบ + เลขเอกสาร
- Real-time sync ผ่าน Gmail Pub/Sub push notification (ไม่ใช้ cron job แบบเสียตัง) +
  GitHub Actions workflow (`.github/workflows/pharmcare-gmail-watch-renew.yml`) คอย renew
  `watch()` subscription ทุกวัน (หมดอายุทุก 7 วัน) — verified ว่า GitHub Actions ฟรีไม่จำกัดจริง
  เพราะ repo เป็น public
- เจอบั๊กจริงจากข้อมูลจริงระหว่างทดสอบ แก้ไปแล้วหลายจุด (nested MIME parsing, MIME
  false-reject, query scope กว้างเกินไปจับอีเมลผิดกลุ่ม) — รายละเอียดเต็มอยู่ใน
  `docs/13-pharmcare-finance-email-automation.md` และ `docs/14-pharmcare-sonnet-implementation-plan.md`

**สถานะ**: deploy แล้ว ใช้งานจริงอยู่ ไม่มีอะไรค้าง

### 3.2 PharmCare frontend — สร้างทั้งหมดตั้งแต่ศูนย์ใน session นี้ (task 1–9)

ทำงานผ่าน multi-agent workflow: **Codex (Tech Lead เดิม) → Claude Sonnet 5 (Senior
Dev/Reviewer, session นี้) → GLM 5.2 (Junior Implementer)** — protocol เต็มอยู่ที่
**`docs/20-frontend-work-review-ledger.md`** (ไฟล์นี้สำคัญที่สุด — เป็น living document
บันทึกทุก task ที่ทำ พร้อมผลรีวิวแบบละเอียด อ่านไฟล์นี้ก่อนไฟล์อื่นถ้าต้องการรู้ว่า
"อะไรทำไปแล้วบ้าง อะไรยังไม่เสร็จ")

Task ที่เสร็จแล้ว (ทั้งหมด **ผ่านรีวิว + commit + push แล้ว**):

| # | งาน | สรุปสั้น |
|---|---|---|
| 1 | Pagination "โหลดเพิ่ม" | ใช้ cursor pagination ที่ backend มีอยู่แล้ว |
| 2 | ดูรายละเอียดเอกสาร + reasonCodes | expand แถวดู evidence การจัดประเภท |
| 3 | แก้บั๊กคอลัมน์ชนกัน | เพิ่ม `<colgroup>` ที่ตารางไม่มีมาก่อน |
| 4 | พรีวิว PDF ในหน้าเว็บ | คลิกไฟล์แนบ → overlay + iframe แทนดาวน์โหลดตรง |
| 5 | ซ่อนข้อมูล diagnostic | เริ่มจาก hardcoded flag ก่อน (ภายหลังกลายเป็น role-based ใน task 6) |
| 6 | **ระบบสิทธิ์ admin vs user** | ดูหัวข้อ 3.3 — งานใหญ่ที่สุด แตะ auth boundary |
| 7 | Dark/light mode toggle | CSS additive-only, ไม่แตะ rule เดิมเลย |
| 8 | Sort asc/desc + กรองช่วงวันที่ | แตะ backend ด้วย (cross-repo) |
| 9 | ย้ายเมนู Inbox | จาก "อัปโหลดข้อมูล Pharm Care" ไปเมนูใหม่ "รายงานอีเมล์จาก Pharm Care" |

**Task 6 (ระบบสิทธิ์) สำคัญมาก ต้องเข้าใจให้ครบ**:
- เพิ่ม Basic Auth credential ชุดที่สอง (`SEAMLESS_APP_ADMIN_BASIC_USER`/
  `SEAMLESS_APP_ADMIN_BASIC_PASSWORD`) แยกจากชุด user ทั่วไป (`SEAMLESS_APP_BASIC_USER`/
  `SEAMLESS_APP_BASIC_PASSWORD` — ตัวหลังนี้ตอนหลังแก้ให้รับ **comma-separated list** ได้ด้วย
  เช่น `staff000,staff001,staff003`)
- `appAuth.js` middleware ติด `req.appRole = 'admin' | 'user'` — session cookie พก role
  ไปด้วย (เดิมไม่มีแนวคิด role เลย ต้องแก้ token encoding)
- **field ที่ถือว่าเป็น diagnostic/operational (ไม่ใช่ user ทั่วไปควรเห็น) ถูกตัดออกจาก
  response ฝั่ง backend เอง** ไม่ใช่แค่ซ่อนที่ UI — ดูที่
  `pharmcareController.js`'s `ADMIN_ONLY_DOCUMENT_FIELDS` (`route`, `documentNumber`,
  `reviewStatus`, `reasonCodes`, `classifierVersion`)
- **ต้องตั้งค่า env var บน Render เอง** ถ้ายังไม่ได้ตั้ง — ไม่งั้นไม่มีใครได้ role admin เลย
  (ทุกคนเห็นแค่ view แบบ user) ดูหัวข้อ 7 (Env vars)

### 3.3 PharmCare print integration (backend เสร็จ, frontend ยังไม่เริ่ม) — **จุดที่ค้างอยู่ตอนนี้**

ต้องการให้: เอกสาร PharmCare กดปริ้นผ่านช่องทางเดียวกับ Seamless ได้ (print-agent เครื่องจริง,
LINE group เดียวกัน, อีเมลผู้รับเดียวกัน) แต่ template แยกสี/ข้อความให้ scroll ผ่านๆ
ก็แยกออกว่าอันไหนของ PharmCare

**สเปกเต็มอยู่ที่ `docs/22-pharmcare-print-integration-spec.md` — อ่านไฟล์นี้ก่อนแตะอะไร**
สรุปสั้น:
- **Backend เสร็จแล้ว** (`currentSC-official-website-project` commit `9e4bec9`,
  ตามด้วย sort/date-range work ที่ `145ed33`): endpoint ใหม่
  `POST /api/app/pharmcare/documents/:id/print` (admin-only) — สร้าง `processing_records`
  + `generated_files` row ที่ชี้ไปยัง storage เดิมของไฟล์แนบ (ไม่คัดลอกไฟล์) แล้วเรียก
  `processingRecordAppService.requestPrint()` **โค้ดเดิม 100%** ของ Seamless — LINE/อีเมล
  แจ้งเตือนสลับ template อัตโนมัติเมื่อ `record.metadata.source === 'pharmcare'`
- **Frontend ยังไม่มีเลย** — ไม่มีปุ่ม "ขอปริ้น" ในหน้า PharmCare Inbox, ไม่มีฟังก์ชัน
  `requestPharmcarePrint()` ใน `client/src/services/api.js` เลย — **นี่คืองานที่ยังไม่ได้
  มอบหมายอย่างเป็นทางการ รอเจ้าของ repo ตัดสินใจว่าจะเริ่มเมื่อไหร่**
- **ยังไม่ได้ทดสอบ end-to-end จริง** แม้ backend จะ deploy แล้ว — เพราะไม่มีปุ่มกดจริง
  เช็คลิสต์ 7 ข้อสำหรับทดสอบมือมีอยู่ท้าย `docs/22`

---

## 4. รายละเอียดทางเทคนิคที่สำคัญที่สุด (ต้องเข้าใจก่อนแก้อะไรใน pipeline นี้)

### 4.1 ทำไม PharmCare ใช้ตาราง `processing_records` ซ้ำ (ไม่สร้างตารางใหม่)

ตัดสินใจร่วมกับเจ้าของ repo (มีบันทึกการตัดสินใจอยู่ใน `docs/22`): แทนที่จะ generalize
print pipeline ใหม่ทั้งหมด (source_type/source_id ทั่วไป) ซึ่งจะต้อง redeploy ซอฟต์แวร์บน
เครื่องพิมพ์จริงด้วย — เลือกใช้ทางลัดที่ปลอดภัยกว่า: สร้างแถว `processing_records` ปลอมๆ
(tagged `metadata.source = 'pharmcare'`) ที่ชี้ไปยังไฟล์ PharmCare ตัวจริง

**ข้อจำกัดที่ต้องรู้ถ้าจะแก้โค้ดจุดนี้**:
- `report_type` เป็น enum จำกัด (`individual`/`summary`/`shopee` เท่านั้น — บังคับผ่าน
  `validators.js`'s `parseFormatterMode()`) — ใส่ `'pharmcare'` ตรงๆ ไม่ได้ ใช้
  `'individual'` แทนแล้วพึ่ง `metadata.source` เป็นตัวบ่งชี้จริง
- `processingRecords.listProcessingRecords()` มีการกรอง
  `WHERE metadata->>'source' IS DISTINCT FROM 'pharmcare'` **เฉพาะตอนไม่ได้ query ด้วย
  `id`** — เพื่อไม่ให้ record ปลอมของ PharmCare โผล่ปนในหน้า History dashboard ของ
  Seamless/Shopee **ถ้าจะเพิ่ม query ใหม่ที่ list processing_records ต้องเช็คว่าต้องกรองแบบนี้
  ด้วยหรือเปล่า**
- ไฟล์ `pharmcarePrintService.js` (ใหม่) **จงใจไม่ import จาก `pharmcareRepository.js`**
  เพราะตอนเขียนโค้ดนี้มีอีก session กำลังแก้ไฟล์นั้นพร้อมกันอยู่ (ดูหัวข้อ 5) — มันเขียน SQL
  query ตรงๆ เอง

### 4.2 ระบบ role (admin/user) — จุดที่ต้องระวังเวลาเพิ่ม field ใหม่

ถ้าเพิ่ม field ใหม่ใน PharmCare document ที่เป็นข้อมูล diagnostic/operational (ไม่ใช่
user ทั่วไปควรเห็น) **ต้องเพิ่มเข้า `ADMIN_ONLY_DOCUMENT_FIELDS` array ใน
`pharmcareController.js` ด้วย** ไม่งั้นจะรั่วไปหา user ทั่วไปโดยไม่ตั้งใจ (backend
strip ไม่ครบ) — และถ้าจะซ่อนที่ frontend ด้วย ให้เช็ค `appRole` prop ที่ผ่านมาจาก
`PharmCareInboxPanel.jsx` (fetch เองจาก `getSession()`)

### 4.3 Cursor pagination ของ PharmCare inbox — sort ได้ 2 ทิศ

`listInboxDocuments()` ใน `pharmcareRepository.js` เรียงตาม `m.received_at` (ไม่ใช่
`d.created_at`) และ cursor เข้ารหัสเป็น `(receivedAt, id)` เปรียบเทียบทิศทางตาม
`order` param — ถ้าจะแก้ sort logic ต้องระวัง backward-compat กับ cursor แบบเก่า
(`decodeCursor()` เช็ค `!decoded.receivedAt` แล้ว degrade เป็นหน้าแรกถ้า decode ไม่ผ่าน)

### 4.4 Date-range filter ตีความเป็นวันปฏิทินไทย (ICT +07:00) ไม่ใช่ UTC

`parseInboxDate()`/`toIctMidnightIso()`/`toNextIctMidnightIso()` ใน `pharmcareController.js`
แปลงวันที่ที่ user เลือก (YYYY-MM-DD) เป็นช่วงเวลา ICT-midnight ถึง ICT-midnight+24h
(exclusive upper bound) — ถ้า server รันที่ timezone อื่น (เช่น UTC บน Render) โค้ดนี้ก็ยัง
ถูกต้องเพราะคำนวณ offset ตรงๆ ไม่พึ่ง timezone ของเครื่อง server เลย

---

## 5. Coordination กับ workstream อื่น (สำคัญมาก อย่าข้าม)

**`docs/18-cross-feature-coordination-ledger.md`** — ไฟล์นี้ตั้งใจให้ session ใหม่อ่านก่อน
แตะ `print-agent`, `print_jobs`, `processing_records`, หรือ shared service files — **แต่ ณ
ตอนที่เขียน handoff นี้ ไฟล์นั้นล้าสมัยไปมากแล้ว** (เขียนไว้ 2026-08-18 ก่อนงาน task 6-9 และ
print integration ทั้งหมดจะเกิดขึ้น) **สิ่งที่ยังจริงอยู่จากไฟล์นั้น**: Shopee workstream ยัง
มีไฟล์ dirty ค้างอยู่ใน `ClaspSCxSeamless/server/`+`print-agent/` (ดูหัวข้อ 6.2) ยังไม่ได้
commit — **ถ้า Codex คนใหม่จะเริ่มงาน Shopee ต่อ ควรอัปเดต `docs/18` ให้ทันสมัยก่อน**
(หรือจะเขียนไฟล์ใหม่แทนก็ได้ ไฟล์เดิมยังอ้างอิงได้สำหรับประวัติ)

**ระหว่าง session นี้ มีอีก session (เรียกกันว่า "zcode" — น่าจะเป็นชื่อเล่นของ GLM 5.2 หรือ
เครื่องมืออื่นที่เจ้าของ repo ใช้) แก้ไฟล์พร้อมกันแบบ real-time**: `pharmcareController.js`,
`pharmcareRepository.js`, และ test คู่กันของทั้งสองไฟล์ — งานนั้นคือ**การเพิ่ม
sort/date-range filter ที่กลายมาเป็น task 8 ใน docs/20 ท้ายที่สุด** (คนละ session แต่งาน
เดียวกัน — น่าจะเป็นเหตุผลที่ตัวเลข test ("86/86") ที่ implementer รายงานไม่ตรงกับที่ reviewer
รันได้จริง (213/218) — อาจมีการรันซ้อนกันระหว่าง session) **บทเรียน**: ถ้ามีหลาย session
ทำงานใน repo เดียวกันพร้อมกัน ให้ระวัง merge conflict และเช็ค `git status`/`git diff` ก่อน
เขียนทับไฟล์เสมอ (Sonnet 5 ใน session นี้แก้ปัญหาด้วยการเขียน service ใหม่แยกไฟล์แทนที่จะ
import จากไฟล์ที่กำลังถูกแก้พร้อมกัน — ดูหัวข้อ 4.1)

---

## 6. ไฟล์ที่ dirty ค้างอยู่ตอนนี้ — **ห้ามแตะโดยไม่ได้รับอนุมัติชัดเจน**

### 6.1 `currentSC-official-website-project` — ไฟล์ RX1011 (เหตุการณ์เก่า, ยังไม่ปิด)

```
M RX1011_INTEGRATION_REPORT.md
M backend/src/modules/rx1011/db/pool.js
M backend/tests/backend-integration.test.cjs
M docs/env/ENV_VAR_COLLISION_AUDIT.md
?? docs/INCIDENT_2026-07-27_rx1011_db_env_var.md
```

**เรื่องเดิม**: เคยเกิดเหตุ `git reset --hard origin/main` ทำลายงาน RX1011 ที่ยังไม่ได้
commit ไปโดยไม่ตั้งใจ (root cause: ใช้ hard-reset แทนการแก้แบบเจาะจงตอน local main
diverge จาก origin) กู้คืนมาได้บางส่วนจาก incident doc ที่รอดมา (`pool.js` เป็นตัวหลักที่
ใช้ยืนยันความถูกต้องของการกู้คืนไฟล์อื่น) **ไฟล์เหล่านี้ยังไม่ได้ commit จนถึงตอนนี้ ตาม
กติกาที่ตกลงไว้ตลอด session ว่าห้าม commit RX1011 จนกว่าเจ้าของ repo จะสั่งชัดเจนแยก
ต่างหาก (ไม่ใช่แค่พูดผ่านๆ)** — ถ้า Codex คนใหม่เจอไฟล์เหล่านี้ dirty อยู่ อย่าเพิ่ง
`git add`/commit/reset ทิ้ง โดยไม่ถามเจ้าของ repo ก่อน

### 6.2 `ClaspSCxSeamless` — ไฟล์ Shopee (workstream อื่น, ค้างมาตั้งแต่ session ก่อนๆ)

```
M docs/07-frontend-backend-integration.md
M print-agent/src/print.js
M print-agent/tests/print.test.js
M server/.env.example
M server/src/config/env.js
M server/src/controllers/fileController.js
M server/src/middleware/appAuth.js
M server/src/services/emailService.js
M server/src/services/fileStorageService.js
M server/src/services/printAgentService.js
M server/src/services/r2StorageService.js
M server/src/services/workbookService.js
M server/src/services/workbookTransformService.js
M server/tests/app-auth.test.js
M server/tests/workbook-transform.test.js
?? server/tests/email-service.test.js
?? server/tests/r2-storage-bucket.test.js
```

**สถานะ**: Shopee accounting workbook workflow — ยังไม่เสร็จ ไม่มี session ไหนแตะต่อ
ในช่วงเวลาที่ handoff นี้ครอบคลุม — **ทุก `git add`/commit ตลอด session นี้ระวังไม่ให้ปน
ไฟล์กลุ่มนี้เข้าไปเลยแม้แต่ไฟล์เดียว** (เป็นกฎเหล็กที่ตอกย้ำซ้ำๆ ตลอด session — ไม่เคย
staged ไฟล์เหล่านี้เลยสักครั้ง)

---

## 7. Environment variables ที่ต้องรู้ (Render env vars ของ
`currentSC-official-website-project`'s `sc-official-website` service)

| ตัวแปร | ใช้ทำอะไร | สถานะ ณ ตอนเขียน handoff |
|---|---|---|
| `SEAMLESS_APP_BASIC_USER` | Basic Auth ผู้ใช้ทั่วไป — รับ comma-separated list ได้ (task 6.5) | ตั้งไว้แล้ว (เจ้าของ repo ตั้งเป็น `staff000,staff001,staff003,staff004,staff005`) |
| `SEAMLESS_APP_BASIC_PASSWORD` | รหัสผ่านร่วมของ user ทั่วไป (ทุก username ข้างบนใช้ร่วมกัน) | ตั้งแล้ว (`123123` — **อ่อนมาก** เคยเตือนเจ้าของ repo แล้วว่าเสี่ยง แต่เจ้าของยืนยันจะใช้ต่อ) |
| `SEAMLESS_APP_ADMIN_BASIC_USER` / `SEAMLESS_APP_ADMIN_BASIC_PASSWORD` | Basic Auth ชุด admin (เห็นข้อมูล diagnostic ครบ) | เจ้าของ repo ยืนยันว่าตั้งแล้วในแชท แต่**ไม่เคย verify ด้วยเครื่องมือจริงในบทสนทนานี้** — ควรยืนยันซ้ำถ้าเจอปัญหา role ไม่ทำงาน |
| `SEAMLESS_LINE_CHANNEL_ACCESS_TOKEN` / `SEAMLESS_LINE_TARGET_ID` | LINE group แจ้งเตือนปริ้น (ของเดิม, ใช้ร่วมกับ PharmCare) | มีอยู่แล้วก่อน session นี้ ไม่ได้แตะ |
| `EMAIL_PROVIDER` (`brevo`/`sendgrid`) + `BREVO_API_KEY`/`SENDGRID_API_KEY` + `MAIL_USER` + `SEAMLESS_DOCS_RECIPIENT_EMAIL` | อีเมลแจ้งเตือนปริ้น | มีอยู่แล้วก่อน session นี้ |
| `SEAMLESS_PHARMCARE_GMAIL_*` (หลายตัว — ดู `docs/13`/`docs/14`) | Gmail OAuth credential สำหรับดึงอีเมล PharmCare | ตั้งแล้ว ใช้งานจริงอยู่ |
| `SEAMLESS_DB_SCHEMA` / `DB_SCHEMA` | ชื่อ Postgres schema | `clasp_scx_seamless` |

**คำเตือนสำคัญจาก incident เก่า** (ดู memory: "Shared backend DB env-var collision"):
โมดูลใน `sc-official-website` บางตัวเคย fallback ไปใช้ `DATABASE_URL` ตัวกลางโดยไม่ตั้งใจ
ถ้า env var เฉพาะของ module ไม่ได้ตั้ง — เคยทำให้เกิด outage กับ RX1011 มาแล้ว (2026-07-27)
**ตั้ง env var ใหม่ให้ระบุชื่อเฉพาะเจาะจงเสมอ อย่าปล่อยให้ fallback ไปโดนของ module อื่น**

---

## 8. Test suite — วิธีรันให้ถูก (สำคัญ อย่ารันผิดแล้วเข้าใจผิดว่ามีอะไรพัง)

### 8.1 `currentSC-official-website-project/backend`

```bash
npx jest                              # รันทั้งหมด (มี test ของ module อื่นที่ไม่เกี่ยวด้วย)
npx jest tests/pharmcare-routes.test.cjs tests/pharmcare-repository.test.cjs   # เฉพาะ PharmCare
```

ณ ตอนเขียน handoff: **213 ผ่าน, 5 skip (ต้องการ live DB — ไม่ใช่ bug), 0 fail**

### 8.2 `ClaspSCxSeamless/client`

```bash
npm --prefix client test     # ทั้งหมด 52 tests (SSR-only ผ่าน renderToString ไม่มี DOM จริง)
npm --prefix client run build
```

**ห้ามรัน `npm test` ที่ root ของ `ClaspSCxSeamless` โดยไม่รู้ตัว** — จะไปรัน `server/` tests
ด้วย ซึ่งมีงาน Shopee ที่ยัง dirty (หัวข้อ 6.2) — failure จากตรงนั้นไม่ใช่ของ PharmCare/Seamless
frontend เลย จะทำให้เข้าใจผิดว่ามีอะไรพัง

### 8.3 ข้อจำกัดของ frontend test suite ที่ต้องรู้

Test ทั้งหมดใช้ `vite.ssrLoadModule()` + `renderToString()` — **ไม่มี DOM จริง ไม่มี React
effects (`useEffect`) รันได้เลย** ดังนั้น logic ที่อยู่ใน `useEffect`/event handler
(เช่น `PharmCareInboxPanel.jsx`'s fetch logic, stale-response guard, object-URL cleanup)
**ทดสอบผ่าน SSR ไม่ได้โดยตรง** — ต้องอาศัย code review ของมนุษย์/LLM อ่านโค้ดจริงแทน (นี่คือ
เหตุผลที่ protocol ของ `docs/20` เน้นย้ำว่า reviewer ต้อง "อ่านโค้ดเต็มไฟล์" ไม่ใช่แค่เชื่อ
summary)

---

## 9. Protocol การทำงานที่ session นี้ใช้ (ถ้าจะสานต่อรูปแบบเดิม)

1. **`docs/20-frontend-work-review-ledger.md`** — GLM 5.2 (Junior Implementer) implement
   → จดแถวในตาราง → Claude Sonnet 5 (Senior Dev/Reviewer) อ่านโค้ดจริงเต็มไฟล์ + รัน
   test/build เอง (ไม่เชื่อตัวเลขที่ implementer รายงาน) → เติมผลตัดสิน → **Sonnet 5 เป็นคน
   commit เอง** (ผิดจาก protocol เขียนไว้เดิมที่บอกว่าเจ้าของ repo commit — เจ้าของ repo สั่ง
   เปลี่ยนกติกานี้เองระหว่าง session โดยชัดเจน "นายเป็นคน commit ดีกว่าแล้วบอก glm 5.2 ด้วย
   เพราะนายเป้น senior dev")
2. **งานที่แตะ shared backend auth boundary หรือ pipeline สำคัญ (print/notify)** — Sonnet 5
   implement เองโดยตรง ไม่ผ่าน GLM 5.2 เลย (เช่น task 6 ระบบสิทธิ์, print integration
   ทั้งหมด) เพราะความเสี่ยงสูงกว่างาน frontend ทั่วไป
3. **ก่อน commit ทุกครั้ง** — เช็ค `git status` ให้แน่ใจว่า stage เฉพาะไฟล์ของงานนั้นจริงๆ
   ไม่ปนไฟล์ RX1011 (หัวข้อ 6.1) หรือ Shopee (หัวข้อ 6.2) เข้าไปเด็ดขาด — **ไม่เคยใช้
   `git add -A` เลยสักครั้งตลอด session**
4. **Backend deploy กระทบ shared service ทั้งเว็บ** (ไม่ใช่แค่ PharmCare/Seamless) — ต้อง
   ระวังกว่า frontend deploy ปกติ แต่ session นี้ push ตรงหลังเจ้าของ repo ยืนยันด้วยวาจาทุก
   ครั้ง ไม่เคยรอ manual approval step เพิ่มเติมอื่น

---

## 10. งานที่ยังไม่เริ่ม / ค้างอยู่ (TODO สำหรับ Tech Lead คนใหม่)

เรียงตามความสำคัญที่คาดว่าเจ้าของ repo จะถามถึงก่อน:

1. **ปุ่ม "ขอปริ้น" สำหรับ PharmCare (frontend)** — สเปกพร้อมที่ `docs/22` ยังรอ
   เจ้าของ repo สั่งเริ่ม (บอกไว้ว่า "เดี๋ยวค่อยคิดเรื่องนั้น") — งานเล็ก (เพิ่ม 1 ฟังก์ชันใน
   `api.js` + 1 ปุ่ม, มี pattern ของจริงให้ก็อปจาก `HistoryPanel.jsx`/`HistoryActions.jsx`
   อยู่แล้ว) เหมาะมอบให้ GLM 5.2 ทำได้เลยถ้าได้ไฟเขียว
2. **ทดสอบมือ end-to-end ของ print integration** — เช็คลิสต์ 7 ข้อท้าย `docs/22` ทำไม่ได้
   จนกว่าจะมีปุ่มกดจริงจากข้อ 1 ก่อน
3. **Resolve manual_review + จัดกลุ่มเอกสารที่เกี่ยวข้องกัน (admin action)** — เจ้าของ repo
   เคยถามไว้ตอนคุยเรื่อง role system (task 6) ว่าอยากได้ฟีเจอร์นี้ในอนาคต **แต่ยังไม่เคยเขียน
   สเปกเลย** ต้องคุยขอบเขตใหม่ทั้งหมดก่อนเริ่ม (ต้องมี DB migration ใหม่ + endpoint ใหม่ —
   ใหญ่กว่างานที่ผ่านมาทั้งหมด)
4. **RX1011 ไฟล์ dirty (หัวข้อ 6.1)** — ต้องถามเจ้าของ repo ตรงๆ ว่าจะ commit หรือทิ้งไป
   ไม่ควรปล่อยค้างตลอดกาล
5. **Shopee workstream (หัวข้อ 6.2)** — ค้างมานานที่สุดในบรรดาทั้งหมด ไม่มีใครแตะระหว่าง
   session นี้เลย ควรถามเจ้าของ repo ว่าจะสานต่อเมื่อไหร่ หรือจะทิ้ง
6. **ยืนยัน visual จริงของ dark mode (task 7)** — ออกแบบจากค่า CSS ล้วนๆ ยังไม่เคยเห็นบน
   browser จริง ต้องกดทดสอบทั้ง 3 theme (default/shopee/pharmcare) หลัง deploy
7. **`docs/18` ล้าสมัย** — ควรอัปเดตหรือเขียนใหม่ก่อนเริ่มงานที่แตะ print pipeline/shared
   schema ครั้งต่อไป (อ้างอิงหัวข้อ 5)

---

## 11. รายการเอกสารทั้งหมดที่เกี่ยวข้อง (เรียงตามลำดับที่ควรอ่าน)

ทั้งหมดอยู่ใน `ClaspSCxSeamless/docs/` เว้นแต่ระบุไว้อื่น:

1. **`docs/19-frontend-handoff-context.md`** — ภาพรวมสถาปัตยกรรม (แก้ความเข้าใจผิดเรื่อง
   `server/` เป็นโค้ดตาย) — อ่านก่อนสุดถ้ายังไม่เข้าใจโครงสร้าง repo
2. **`docs/20-frontend-work-review-ledger.md`** — **สำคัญที่สุด** ประวัติงาน frontend ทุก
   task พร้อมผลรีวิวละเอียด + commit hash ทุกตัว
3. **`docs/18-cross-feature-coordination-ledger.md`** — coordination ระหว่าง workstream
   (ล้าสมัยบางส่วน ดูหัวข้อ 5 ของเอกสารนี้)
4. **`docs/13-pharmcare-finance-email-automation.md`** + **`docs/14-pharmcare-sonnet-implementation-plan.md`** — สเปกดั้งเดิมของ PharmCare backend (M1-M5, ตอนนี้ทำถึง
   "M5 บางส่วน" คือ print integration)
5. **`docs/21-pharmcare-document-type-glossary.md`** — ความหมายประเภทเอกสาร PharmCare
6. **`docs/22-pharmcare-print-integration-spec.md`** — สเปกเต็มของ print integration
   (backend เสร็จ, frontend รอเริ่ม)
7. ไฟล์นี้ (**`docs/23-tech-lead-handoff-2026-08-19.md`**) — สรุปรวมทั้งหมด

ใน `currentSC-official-website-project` ไม่มี convention เลขไฟล์แบบนี้ — เอกสารที่เกี่ยวข้อง
กระจายอยู่ที่ root (`RX1011_INTEGRATION_REPORT.md`, `docs/env/ENV_VAR_COLLISION_AUDIT.md`,
`docs/INCIDENT_2026-07-27_rx1011_db_env_var.md` — ทั้งหมดเกี่ยวกับ RX1011 เท่านั้น ไม่เกี่ยว
กับ PharmCare/Seamless เลย)

---

## 12. Commit hash ล่าสุด ณ เวลาที่เขียน handoff นี้ (ใช้เทียบว่า repo อยู่ทันสมัยหรือเปล่า)

**`currentSC-official-website-project` (branch `main`)**:
```
145ed33  seamless: PharmCare inbox sort order + received-date range filters
9e4bec9  seamless: let PharmCare documents ride the existing print/notify pipeline
a132251  seamless: allow multiple staff usernames sharing one password
eb11a3e  seamless: add admin role tier for PharmCare Inbox diagnostics
608d249  Add GitHub Actions workflow to renew PharmCare Gmail watch daily
```

**`ClaspSCxSeamless` (branch `main`)**:
```
eb4aced  docs/20: record task 9 commit hash for GLM 5.2
88b2c56  PharmCare: move Inbox to its own "รายงานอีเมล์จาก Pharm Care" menu
0c9a0b3  docs/20: record task 7+8 commit hashes for GLM 5.2
859e973  PharmCare Inbox: dark mode toggle + sort/date-range filters
aa9b864  docs: add PharmCare print integration spec (backend half, done)
```

ถ้า `git log -1` ของทั้งสอง repo ไม่ตรงกับบรรทัดบนสุดข้างต้น แปลว่ามีงานใหม่เกิดขึ้นหลังจาก
เขียน handoff นี้แล้ว — ไปอ่าน `docs/20` เพิ่มเติมเพื่อดูว่า task ไหนถูกเพิ่มมาใหม่

---

## Addendum 2026-08-24 — Shopee live email inbox (local, ยังไม่ deploy)

เจ้าของ repo สั่งเพิ่ม "รายงานอีเมล์จาก Shopee" โดยอ่านเมลจาก
`info@mail.shopee.co.th`. เลือกทำเป็น **live read-only Gmail inbox** ที่
`/shopee/inbox` แทนการสร้าง ingestion tables ใหม่: endpoint
`GET /api/app/shopee/inbox` ใช้ Gmail OAuth read-only ชุดเดิมของ mailbox
`admin@scgroup1989.com`, query แยก `SEAMLESS_SHOPEE_GMAIL_QUERY` (default sender ข้างต้น),
รองรับ category/date filters และ Gmail page-token pagination. Backend ตรวจ From header ซ้ำก่อน
คืนผล จึงไม่กลายเป็น general mailbox browser. ไม่มีการเก็บ body/snippet และไม่มี write action
ต่อ Gmail. Shopee path ใช้ `messages.get format=metadata` + partial fields เฉพาะ envelope ที่จำเป็น
(ไม่โหลด body), timeout 10 วินาที, ไม่ retry ที่ application layer, cache ต่อ instance 15 วินาที
และจำกัดไม่เกิน 25 แถวต่อหน้า. 404 ระหว่าง list/get ข้ามได้เพราะข้อความอาจหายไปแล้ว แต่
401/429/5xx ทั้ง single และ mixed จะ fail ทั้งหน้าเพื่อไม่คืนข้อมูล partial เงียบ.

ช่วงวันที่ใช้ Gmail query ที่กว้างกว่าขอบล่างหนึ่งวินาที แล้ว post-filter `internalDate` แบบ exact
`[receivedFrom, receivedTo)` จึงไม่รั่ว 23:59:59 ของวัน ICT ก่อนหน้า. Frontend ใช้ request
generation: เมื่อเปลี่ยน filter จะล้าง rows/cursor เก่าทันที และ stale load-more ทั้ง success/error
เขียนทับ state ใหม่ไม่ได้. ด้าน privacy, role `user` ได้ subject ที่ปกปิด buyer username ฝั่ง
backend ทั้งรูปแบบ `จากผู้ซื้อ ...`, `ถูกยกเลิกโดย ...` และ `ถูกทำการยกเลิกโดย ...` ส่วน
`admin` เห็น subject เต็ม.

งานนี้ไม่แตะ DB migration, `processing_records`, print pipeline, `server/` หรือ `print-agent/`
จึงไม่ชน Shopee accounting workbook dirty workstream เดิม. Category 6 แบบได้จากตัวอย่าง Gmail
จริง 98 ฉบับย้อนหลัง 30 วัน (COD confirmed/shipment due/cancelled/out of stock/security/
seller return). ผล local ล่าสุดหลัง review fixes: frontend 61/61 + build ผ่าน, backend targeted
42/42, regression ไม่รวม integration 199 ผ่าน/5 skip, full backend 244 ผ่าน/5 skip. Full suite
มี warning เรื่อง local env ขาด `SC_OFFICIAL_SUPABASE_DATABASE_URL` แต่ไม่ fail; ตัวเลข full ยัง
รวม `backend-integration.test.cjs` dirty ของ RX1011 จึงไม่ใช่ baseline ของ Shopee โดยตรง.

Deployment gate ที่ยังต้องทำ: เปิด Google Cloud Console ตรวจ quota regime ของ OAuth project จริง
(Google อัปเดต 1 พ.ค. 2026: project ใหม่ 6,000 units/min/user; project ที่เคยใช้ช่วง พ.ย.
2025–เม.ย. 2026 อาจยังอยู่ quota เดิม; `messages.list=5`, `messages.get=20`) และ monitor quota
หลังเปิด staff. หน้า 25 แถวมีต้นทุนสูงสุด 505 units เมื่อ cache miss; cache ช่วยเฉพาะ request
filter/cursor เดียวกันบน backend instance เดียว. อ้างอิง:
https://developers.google.com/workspace/gmail/api/reference/quota

Final review ไม่พบ defect เพิ่มและ approve แล้ว. Code commits ที่ push ขึ้น `main`:

- `currentSC-official-website-project`: `8f45b9f` — `seamless: add read-only Shopee email inbox API`
- `ClaspSCxSeamless`: `81b714d` — `Shopee: add live read-only email inbox`

Stage แบบ explicit เฉพาะไฟล์ Shopee; dirty RX1011, `server/`, `print-agent/`, `docs/07` และ
`docs/17` ไม่ติด commit. **ยังไม่ deploy จนกว่าจะยืนยัน Gmail quota regime ของ Cloud project**.

---

## Addendum 2026-08-24 — Shopee order timeline (local, รอ independent review)

งานต่อจาก live inbox คือจับอีเมลที่มีเลขคำสั่งซื้อเดียวกันเป็น order timeline ที่
`/shopee/orders`. งานนี้ **แยกจาก Shopee workbook/print pipeline**: เพิ่มตารางใหม่ใน schema
`clasp_scx_seamless` คือ `shopee_orders` (current state) และ `shopee_order_events`
(append-only events) ผ่าน migration `008_shopee_order_timeline.sql`; ไม่ใช้
`processing_records`, `generated_files` หรือ `print_jobs`.

Privacy boundary คือ parser เก็บเฉพาะเลขคำสั่งซื้อ, วันสั่ง/กำหนดส่ง, ชื่อ/ตัวเลือก/จำนวน/ราคา
สินค้า, ยอดเงิน, delivery method และ cancellation reason code ที่กำหนดไว้. ห้ามเก็บหรือคืน raw
subject/body, buyer username, ชื่อผู้รับ, ที่อยู่ หรือเบอร์โทร. Event dedupe ด้วย unique
`(mailbox_account, gmail_message_id)` เพราะ seller-return subject สามารถซ้ำกันได้. API ใหม่:

- `GET /api/app/shopee/orders` — list + status filter + opaque DB cursor
- `GET /api/app/shopee/orders/:orderNumber` — order + chronological events
- `POST /api/app/shopee/orders/sync` — admin-only; Gmail cursor แยกจาก DB cursor

Sync อ่านสูงสุด 25 ข้อความต่อคำขอ, full-message concurrency 5, timeout 10 วินาที, ปิด automatic
retry, ข้ามเฉพาะ 404 และ re-check From header ก่อน parse. Frontend default role เป็น `user` และ
ซ่อน sync controls จน `getSession()` ยืนยัน admin; backend ตรวจ admin ซ้ำ จึงไม่พึ่ง UI เป็น
security boundary. สีสถานะใช้ palette เดียวกับ live inbox และรายละเอียดแบบ expandable แสดง
items/amounts/timeline โดยไม่มีข้อมูลผู้ซื้อ.

ผล local ก่อนส่ง review: backend targeted (Shopee + Gmail adapter) **77/77**, regression ไม่รวม
integration **218 ผ่าน/5 skip**, full backend **263 ผ่าน/5 skip**, frontend **67/67** และ Vite
production build ผ่าน; `git diff --check` ผ่าน มีเพียง CRLF warnings. ยังไม่ stage/commit/push,
ยังไม่ apply migration และยังไม่ deploy. Base HEAD ก่อนงานนี้คือ backend `7b7e567` และ frontend
`5af5393`; section 12 เป็น snapshot เก่ากว่าและต้องใช้ `git log`/addendum นี้เป็นหลัก.

Deployment order: (1) ยืนยัน Gmail quota gate เดิม (2) รัน `npm run seamless:migrate` ที่ backend
เพื่อ apply migration 008 (3) deploy backend (4) deploy frontend (5) login admin แล้ว sync latest
หนึ่งหน้าและตรวจ sample 1–3 orders. ห้ามรวม dirty RX1011 ใน backend และห้ามรวม dirty
`server/`, `print-agent/`, `docs/07`, `docs/17` ใน frontend. รายการไฟล์และผลทดสอบล่าสุดอยู่ที่
Task 11 ใน `docs/20-frontend-work-review-ledger.md`.
