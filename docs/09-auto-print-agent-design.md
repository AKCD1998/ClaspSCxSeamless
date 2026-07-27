# 09 Auto-Print Agent + LINE Notify Design

วันที่จัดทำ: 2026-07-24
สถานะ: implemented — รอ deploy เครื่อง 000 + setup LINE (ดู `docs/10-print-agent-tasks.md` สำหรับ implementation checklist และ `docs/11-print-agent-review-ledger.md` สำหรับสถานะรีวิวโค้ด)

## 1. เป้าหมาย

สร้าง automation workflow: เครื่อง server ภายในบริษัท ("000 HQ", เชื่อม network ผ่าน Tailscale, มี drive `W:`) คอยเช็คเว็บ ClaspSCxSeamless ทุก 1 ชั่วโมงว่ามีเอกสารที่ **ยังไม่ได้ปริ้นท์ส่งพี่เอ** หรือไม่

- ถ้ามี → ดาวน์โหลดไฟล์ → สั่งปริ้นออกเครื่อง **Brother MFC-T4500DW** (ต่ออยู่กับเครื่อง 000) → แจ้งเตือนผ่าน **LINE Messaging API** → mark ว่าปริ้นท์แล้ว
- ถ้าไม่มี → จบรอบ ไม่ทำอะไร
- **ทุกขั้นตอนต้องเก็บ log** เพื่อใช้ประเมิน performance ของทีมปลายทาง:
  - เอกสารเข้าระบบเมื่อไหร่
  - ส่งคำสั่งปริ้นเมื่อไหร่
  - คำสั่งถึง printer spooler สำเร็จไหม
  - ปริ้นเสร็จจริงหรือยัง
  - มีการ**ขอปริ้นซ้ำ** (เอกสารหาย) กี่ครั้ง ที่เอกสารไหน เมื่อไหร่

หลักการสำคัญ: **เว็บ (backend บน Render/Supabase) เป็น source of truth ของ log ทั้งหมด** ส่วนเครื่อง 000 เป็นแค่ agent ที่ poll + ปริ้น + รายงานกลับ ถ้าเครื่อง 000 ดับ log ไม่หาย และดูรายงานได้จากทุกที่

## 2. ภาพรวมสถาปัตยกรรม

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  ClaspSCxSeamless backend   │  poll   │  Print Agent (เครื่อง 000)   │
│  (Express + Supabase + R2)  │◄────────│  Node.js + Task Scheduler    │
│                             │─────────►                              │
│  - print_jobs table (ใหม่)  │ download │  - xlsx → สั่งปริ้น          │
│  - agent API (ใหม่)         │ report  │  - เช็ค Windows spooler      │
│  - LINE notify (ใหม่)       │         │  - Brother MFC-T4500DW       │
└──────────────┬──────────────┘         └──────────────────────────────┘
               │ push message
               ▼
        LINE OA "ศิริชัยเภสัช.Acc"
```

การแจ้งเตือน LINE ให้ **backend เป็นคนยิง** (ไม่ใช่ agent) เพราะ channel access token ควรอยู่ที่เดียว (Render env) และ log การแจ้งเตือนจะผูกกับ print job ใน DB โดยตรง

## 3. Data model — migration `003_print_jobs.sql`

ตารางใหม่ใน schema `clasp_scx_seamless`:

```sql
CREATE TABLE IF NOT EXISTS print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_record_id uuid NOT NULL REFERENCES processing_records(id),
  generated_file_id uuid REFERENCES generated_files(id),
  attempt_no integer NOT NULL DEFAULT 1,          -- ครั้งที่เท่าไหร่ของเอกสารนี้ (1 = ปริ้นแรก, 2+ = reprint)
  is_reprint boolean NOT NULL DEFAULT false,
  reprint_reason text,                            -- เช่น 'document_lost', 'quality_issue'
  requested_by text,                              -- 'auto-print-agent' หรือชื่อคนที่กดขอปริ้นใหม่
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','downloading','sent_to_spooler','printing','completed','failed')),
  agent_host text,                                -- ชื่อเครื่อง agent เช่น '000-HQ'
  printer_name text,                              -- 'Brother MFC-T4500DW'
  spooler_job_id integer,                         -- id จาก Windows print queue
  error_message text,
  document_uploaded_at timestamptz,               -- copy มาจาก processing_records.uploaded_at ตอนสร้าง job
  queued_at timestamptz NOT NULL DEFAULT now(),   -- agent เจอ + สร้าง job
  sent_to_spooler_at timestamptz,                 -- ส่งเข้า Windows spooler
  completed_at timestamptz,                       -- spooler ยืนยันพิมพ์จบ / job หายจากคิวแบบปกติ
  line_notified_at timestamptz,                   -- backend ยิง LINE สำเร็จ
  line_notify_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_print_jobs_record ON print_jobs (processing_record_id);
CREATE INDEX idx_print_jobs_status ON print_jobs (status);
CREATE INDEX idx_print_jobs_queued_at ON print_jobs (queued_at DESC);
```

Performance metrics ที่คำนวณได้จากตารางนี้ (ไม่ต้องเก็บซ้ำ):

| Metric | วิธีคิด |
|---|---|
| เวลารอปริ้น | `sent_to_spooler_at - document_uploaded_at` |
| อัตราปริ้นสำเร็จ | `count(status='completed') / count(*)` |
| เอกสารหาย/ขอปริ้นซ้ำ | `count(*) WHERE is_reprint` group by เดือน/สาขา |
| เอกสารไหนหายบ่อย | `processing_record_id having count(*) > 1` |

## 4. Backend เพิ่มใหม่ (ClaspSCxSeamless `server/`)

### 4.1 Agent API — ทุก endpoint อยู่หลัง `internalApiAuth` (Bearer `INTERNAL_API_TOKEN` — มี middleware อยู่แล้วที่ `src/middleware/internalApiAuth.js`)

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| `GET` | `/api/agent/print-queue` | คืนรายการเอกสารที่เข้าเงื่อนไข: (`printed=false` **และ** `uploaded_at >= AUTO_PRINT_SINCE`) **หรือ** มี print job สถานะ `queued` ที่ admin สั่งเองจากเว็บ — พร้อม `generated_file_id` ของไฟล์ processed (`metadata.outputFileId`) + `download_url` + `attempt_no` ถัดไป |
| `POST` | `/api/agent/print-jobs` | agent สร้าง job ก่อนเริ่มปริ้น body: `{ processingRecordId, generatedFileId, agentHost, printerName }` → backend คำนวณ `attempt_no`/`is_reprint` เอง (นับจาก jobs ที่มีอยู่) คืน job id |
| `PATCH` | `/api/agent/print-jobs/:id` | agent อัปเดตสถานะทีละขั้น: `{ status, spoolerJobId?, errorMessage?, sentToSpoolerAt?, completedAt? }` |
| `POST` | `/api/agent/print-jobs/:id/complete` | ทางลัดปิด job: set `status='completed'`, `completed_at` → backend **mark processing record printed** (`printedBy='auto-print-agent'`) → **ยิง LINE notify** → บันทึก `line_notified_at` |

Flow สำคัญ: `mark-printed` อัตโนมัติเกิด**หลังปริ้นสำเร็จเท่านั้น** ถ้า job fail → record ยังค้างเป็นยังไม่ปริ้น → รอบถัดไป agent จะเจอใหม่และลองอีกครั้ง (attempt_no เพิ่ม, แต่ `is_reprint=false` เพราะไม่ใช่เอกสารหาย — ใช้เงื่อนไข: reprint = มี job `completed` มาก่อนแล้ว)

### 4.2 ปุ่ม "สั่งปริ้น / ขอปริ้นใหม่" ในหน้าเว็บ

เพิ่ม action ใน React history panel (ข้างปุ่ม mark printed/unprinted เดิม):

- `POST /api/app/processing-records/:id/request-print` body `{ requestedBy, reason? }`
- ทำ 2 อย่าง: (1) mark record เป็น `printed=false` (`lastAction='print_requested'`) (2) insert แถวใน `print_jobs` สถานะ `queued` — backend คำนวณเองว่าเป็น reprint ไหม (`is_reprint = เคยมี job 'completed' ของ record นี้มาก่อน`) เพื่อให้เป็นหลักฐานว่า "มีการร้องขอ" แม้ agent ยังไม่ทันหยิบ
- endpoint เดียวรองรับทั้ง 2 เคสตามที่ตกลง:
  - **admin สั่งปริ้นเอกสารเก่า** (ก่อนวัน cutoff, ไม่เคยปริ้นผ่านระบบ) → job แรก, `is_reprint=false`
  - **ขอปริ้นซ้ำเพราะเอกสารหาย** → `is_reprint=true` + `reprint_reason` ถูกนับเป็นสถิติ performance
- agent รอบถัดไปเห็น record ใน print-queue ตามปกติ (เอกสารเก่าที่ admin สั่งจะเข้า queue ผ่านเงื่อนไข "มี job queued" ไม่ใช่เงื่อนไขวันที่)

ปุ่ม "ยังไม่ได้ปริ้นท์" เดิม**ยังอยู่** (ใช้แก้สถานะเฉยๆ ไม่สร้าง job) แต่ปุ่มใหม่นี้คือช่องทางที่ถูก track เป็น performance

### 4.3 LINE Notify service — `src/services/lineNotifyService.js`

**ตัดสินใจแล้ว: push เข้า group** (พนักงานแอด OA `@946nuyhl` "ศิริชัยเภสัช.Acc" แล้วดึงเข้ากลุ่มงานเอกสาร บอทส่งข้อความเข้ากลุ่มนั้น)

- ใช้ LINE Messaging API: `POST https://api.line.me/v2/bot/message/push` โดย `to` = `LINE_TARGET_ID` (groupId)
- **ขั้นตอนหา groupId (ทำครั้งเดียวตอน setup):** groupId ได้จาก webhook event เท่านั้น — เพิ่ม endpoint ชั่วคราว `POST /api/line/webhook` ที่ log `event.source.groupId` ทุก event ที่เข้ามา → ตั้ง Webhook URL ใน LINE Developers Console → เชิญบอทเข้ากลุ่ม → อ่าน groupId จาก log → ใส่เป็น `LINE_TARGET_ID` ใน Render env → จะปิด webhook ทิ้งหรือคงไว้เฉยๆ ก็ได้ (ไม่มี logic อื่นผูก)
- ข้อกำหนดใน LINE Developers Console: เปิด "Allow bot to join group chats" (Messaging API settings) ก่อนเชิญบอทเข้ากลุ่ม
- Header: `Authorization: Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
- ข้อความตอนปริ้นสำเร็จ (มี attempt แรก vs reprint ให้ต่างกันชัดๆ):

```
📄 ปริ้นเอกสารส่งพี่เอแล้ว
ไฟล์: 2026-07-17-004-02 sum exp.xlsx
วันที่รายงาน: 17/07/2026 | สาขา 004
ปริ้นเมื่อ: 24/07/2026 14:00
เครื่องปริ้น: Brother MFC-T4500DW (000 HQ)
สถานะ: สำเร็จ ✅
กรุณารับเอกสารที่เครื่องปริ้น หากหาไม่พบสามารถกดขอปริ้นใหม่ในเว็บได้
(การขอปริ้นใหม่จะถูกบันทึกเป็นสถิติการจัดการเอกสารของทีม)
```

- กรณี reprint เพิ่มบรรทัด: `⚠️ นี่คือการปริ้นซ้ำครั้งที่ N ของเอกสารนี้ (เหตุผล: เอกสารหาย)`
- ยิงไม่สำเร็จ → เก็บ `line_notify_error` ไว้ใน job, **ไม่ block** flow ปริ้น (ปริ้นสำเร็จก็คือสำเร็จ)

### 4.4 Env vars ใหม่ (backend)

```
LINE_CHANNEL_ACCESS_TOKEN=   # จาก LINE Developers Console > Messaging API > Channel access token (long-lived)
LINE_TARGET_ID=              # groupId ของกลุ่มงานเอกสาร (ได้จากขั้นตอน webhook ใน 4.3)
AUTO_PRINT_SINCE=            # ISO date เช่น 2026-07-25 — agent ปริ้นอัตโนมัติเฉพาะเอกสารที่อัปโหลดตั้งแต่วันนี้เป็นต้นไป (เอกสารเก่ากว่านี้ต้องให้ admin กดสั่งเอง)
```

## 5. Print Agent (เครื่อง 000) — โฟลเดอร์ใหม่ `print-agent/` ใน repo นี้

Node.js CLI เล็กๆ แยกจาก server (มี `package.json` ของตัวเอง) รันบน Windows เครื่อง 000 ผ่าน **Windows Task Scheduler ทุก 1 ชั่วโมง** (เลือก Task Scheduler แทน service/pm2 เพราะ: รอดเครื่อง restart, มี run-history ในตัว, ไม่ต้องมี process ค้าง)

### 5.1 Loop ต่อรอบ (pseudocode)

```
jobs = GET {API_BASE}/api/agent/print-queue          (Bearer INTERNAL_API_TOKEN)
if jobs.empty: log "nothing to print"; exit 0

for each doc in jobs:
  job = POST /api/agent/print-jobs {recordId, fileId, host, printer}
  try:
    PATCH job {status:'downloading'}
    file = GET doc.downloadUrl → temp\{job.id}.xlsx     (ผ่าน API proxy เดิม ไม่สน R2/local)
    pdf  = convert xlsx → pdf                            (ดูข้อ 5.2)
    spoolId = print pdf → "Brother MFC-T4500DW"          (ดูข้อ 5.3)
    PATCH job {status:'sent_to_spooler', spoolerJobId, sentToSpoolerAt}
    wait until spooler job หายจากคิว (poll ทุก 5s, timeout 10 นาที)
    POST job/complete                                    → backend mark printed + LINE notify
  catch err:
    PATCH job {status:'failed', errorMessage: err}
    continue                                             (เอกสารอื่นต้องได้ปริ้นต่อ)
```

### 5.2 แปลง xlsx → PDF — **ตัดสินใจแล้ว: LibreOffice headless + SumatraPDF** (เครื่อง 000 ไม่มี Microsoft Excel)

Flow: `soffice --headless --convert-to pdf --outdir <temp> <file>.xlsx` → ได้ PDF → ปริ้นด้วย `SumatraPDF.exe -print-to "<PRINTER_NAME>" -silent <file>.pdf`

Prerequisites ต้องติดตั้งบนเครื่อง 000 (จดใน README ของ `print-agent/`):

1. **LibreOffice** (ตัวเต็ม ฟรี) — ใช้เฉพาะ `soffice.exe` headless mode
2. **SumatraPDF** (portable ก็ได้) — ใช้ `-print-to` silent printing
3. path ของทั้งสองตัวใส่ใน `print-agent/.env` (`SOFFICE_PATH`, `SUMATRA_PATH`)

ข้อควรทำตอนติดตั้งจริง: ปริ้นไฟล์ตัวอย่างจริง 1 รอบเทียบกับที่เคยปริ้นจาก Excel/GAS เดิม เพื่อยืนยันว่า format จาก LibreOffice ไม่เพี้ยนจนใช้งานไม่ได้ (เอกสารชุดนี้เป็นตารางเรียบๆ ความเสี่ยงต่ำ)

### 5.2.1 ปัญหา worksheet ว่างในไฟล์ processed — **ต้องแก้ที่ backend ก่อนเปิดใช้ agent**

พบ root cause แล้ว: `server/src/services/workbookTransformService.js` (`transformWorkbook`) แปลงเฉพาะ `workbook.worksheets[0]` แต่ return ทั้ง workbook — ถ้าไฟล์ต้นทางที่อัปโหลดมามี sheet อื่นติดมาด้วย (เช่น sheet ว่างจากไฟล์ export) ไฟล์ processed จะมี sheet ว่างค้างอยู่ ทำให้:
- LibreOffice แปลง PDF ออกมามีหน้าว่าง → agent ปริ้นกระดาษเปล่าทิ้งทุกงาน

**งานที่ต้องทำ (backend, ก่อน implement agent):** ใน `transformWorkbook` หลังแปลง sheet แรกเสร็จ ให้ลบ worksheet อื่นทั้งหมดออกจาก workbook (`workbook.removeWorksheet(sheet.id)` สำหรับทุก sheet ที่ไม่ใช่ตัวแรก) + เพิ่ม unit test ว่า workbook ที่อัปโหลดมามี 2+ sheets แล้ว output เหลือ sheet เดียว — แก้ตรงนี้จบที่เดียว ทุกไฟล์ processed ใหม่จะสะอาด (ไฟล์เก่าที่ generate ไปแล้วยังมี sheet ว่างอยู่ แต่ตามข้อ 8.3 เราเริ่มปริ้นเฉพาะเอกสารใหม่ จึงไม่กระทบ)

### 5.3 การปริ้น + เช็คสถานะบน Windows

- ส่งปริ้น: ผ่านวิธีที่เลือกใน 5.2 ระบุชื่อ printer ตรงตัว (`Get-Printer` หาชื่อจริงก่อน อาจเป็น "Brother MFC-T4500DW Printer")
- เช็คว่า "คำสั่งถึงปริ้นเตอร์": PowerShell `Get-PrintJob -PrinterName X` → เจอ job = ถึง spooler แล้ว เก็บ `JobId` เป็น `spooler_job_id`
- เช็ค "ปริ้นสำเร็จ": poll จน job หายจากคิวโดยไม่มี error state (`Get-PrintJob` แล้วไม่เจอ + printer ไม่ error) → ถือว่า completed หมายเหตุ: Windows spooler บอกได้แค่ "ส่งให้เครื่องพิมพ์จบแล้ว" ไม่รู้ว่ากระดาษหมด/หมึกหมดหลังจากนั้น — ระดับนี้เพียงพอสำหรับ log performance
- Printer offline/ไม่เจอ → fail เร็ว พร้อม `error_message='printer_offline'`

### 5.4 Config agent (`print-agent/.env` — เข้า `.gitignore` แล้วตามแพทเทิร์นเดิม)

```
API_BASE_URL=https://<render-service>.onrender.com
INTERNAL_API_TOKEN=<ตรงกับฝั่ง Render>
PRINTER_NAME=Brother MFC-T4500DW
AGENT_HOST=000-HQ
POLL_LOG_DIR=logs            # log ฝั่ง local เสริม (source of truth จริงอยู่ DB)
```

### 5.5 Local log ฝั่ง agent

เขียนไฟล์ `logs/print-agent-YYYYMMDD.log` (append, เก็บ 90 วัน) ทุกรอบ poll แม้ไม่มีงาน — ไว้ debug กรณี agent ต่อ API ไม่ได้เลย (ซึ่ง log ใน DB จะไม่มีร่องรอย)

## 6. หน้า Dashboard performance (phase ถัดไป, optional)

- `GET /api/app/print-metrics?from=&to=` → สรุป: จำนวนปริ้น, สำเร็จ/ล้มเหลว, จำนวน reprint, รายการเอกสารที่ reprint พร้อมเหตุผล, เวลาเฉลี่ย upload→print
- React tab ใหม่ "สถิติการปริ้น" ใน history page — ใช้ตอบคำถาม "ทีมทำเอกสารหายบ่อยแค่ไหน" ได้ทันทีโดยไม่ต้อง query เอง

## 7. Security & ops

- Agent → backend: HTTPS + Bearer `INTERNAL_API_TOKEN` เท่านั้น (endpoint กลุ่ม `/api/agent/*` ปฏิเสธถ้าไม่มี token — ต่างจาก `/api/app/*` ที่เปิดให้ UI)
- ไม่ต้องเปิด inbound port ที่เครื่อง 000 เลย (agent เป็นฝ่าย poll ออกอย่างเดียว; Tailscale ไม่จำเป็นกับ flow นี้ แต่มีไว้ remote เข้าไปดูเครื่องได้)
- LINE token อยู่บน Render env เท่านั้น ไม่อยู่บนเครื่อง 000
- กัน double-print: `GET /api/agent/print-queue` ต้องไม่คืน record ที่มี print job สถานะ active (`queued/downloading/sent_to_spooler/printing`) อยู่แล้ว + agent lock ด้วยไฟล์ `agent.lock` กันรันซ้อนถ้ารอบก่อนยังไม่จบ
- Job ค้างสถานะ active เกิน 30 นาที → backend ถือเป็น stale, คืนกลับเข้า queue ได้ (กันกรณี agent ตายกลางคัน)

## 8. การตัดสินใจ (ยืนยันโดยเจ้าของโปรเจกต์ 2026-07-24)

1. **วิธีปริ้น xlsx**: เครื่อง 000 **ไม่มี** Microsoft Excel → ใช้ **LibreOffice headless แปลง PDF + SumatraPDF silent print** (รายละเอียด 5.2)
2. **LINE ปลายทาง**: **push เข้า group** — พนักงานแอด OA `@946nuyhl` แล้วสร้างกลุ่มงานเอกสาร, ต้องทำขั้นตอนหา groupId ผ่าน webhook ครั้งเดียวตอน setup (รายละเอียด 4.3)
3. **ขอบเขตเอกสาร**: agent ปริ้นอัตโนมัติ**เฉพาะเอกสารใหม่** (`uploaded_at >= AUTO_PRINT_SINCE`) — เอกสารเก่า admin สั่งปริ้นเองได้จากปุ่มในเว็บ และการสั่งซ้ำถูก log เป็น reprint (รายละเอียด 4.2)
4. **ไฟล์ที่ปริ้น**: ไฟล์ processed รายตัว (`metadata.outputFileId`) 1 ชุด — **ข้อควรระวังที่ยืนยันแล้ว**: ไฟล์ processed ปัจจุบันอาจมี worksheet ว่างติดมาจากไฟล์ต้นทาง ต้องแก้ backend ตาม 5.2.1 ก่อนเปิดใช้ agent ไม่งั้นปริ้นหน้าเปล่าทุกงาน

## 9. ลำดับงาน implement (สำหรับ Sonnet 5)

1. **แก้ worksheet ว่างใน transform** ตาม 5.2.1 (ลบ sheet ที่ไม่ใช่ตัวแรกออกจาก output + unit test) — ทำก่อนเพราะทุกไฟล์ที่ generate หลังจากนี้จะสะอาดพร้อมปริ้น
2. Migration `003_print_jobs.sql` + repository `printJobRepository.js` (+ ทดสอบกับ Docker Postgres ตามแนว docs/08)
3. Agent API routes `/api/agent/*` + เงื่อนไข print-queue (cutoff `AUTO_PRINT_SINCE` + queued jobs) + กัน double-print + stale job recovery
4. `lineNotifyService.js` + webhook ชั่วคราวสำหรับดึง groupId + env ใหม่ + ผูกเข้า complete flow
5. Endpoint + ปุ่ม "สั่งปริ้น / ขอปริ้นใหม่" ใน React (4.2)
6. `print-agent/` ตาม section 5 + ทดสอบบนเครื่อง dev ก่อน (printer จำลอง "Microsoft Print to PDF" ใช้แทน Brother ได้; ต้องลง LibreOffice + SumatraPDF บนเครื่อง dev ด้วย)
7. ติดตั้งบนเครื่อง 000: ลง LibreOffice + SumatraPDF → clone repo → `npm install` ใน `print-agent/` → ตั้ง Task Scheduler รายชั่วโมง → ทดสอบ end-to-end กับ Brother MFC-T4500DW จริง + เทียบ format งานปริ้น 1 รอบ
8. Setup LINE: เปิด "Allow bot to join group chats" → เชิญบอทเข้ากลุ่ม → เก็บ groupId → ตั้ง `LINE_TARGET_ID` + `AUTO_PRINT_SINCE` บน Render
9. (optional) print-metrics endpoint + tab สถิติ

ทุกข้อ ทดสอบตามวินัยเดิมของ repo นี้: automated test ก่อน แล้ว end-to-end กับของจริง แล้วค่อยถือว่าเสร็จ
