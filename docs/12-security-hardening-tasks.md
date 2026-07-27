# 12 Security Hardening (P1+P2) — Implementation Task Loop

สถานะ: เสร็จแล้ว (Task S1-S3 ติ๊กครบหมด — เหลือแต่ "งานที่เหลือให้มนุษย์ทำหลัง loop นี้จบ" ด้านล่าง + รอ code review ใน docs/11)
ที่มา: security review หลังจบ WP08 (ดูบทวิเคราะห์เต็มใน conversation log / สรุปใน "บริบทและการตัดสินใจ" ด้านล่าง) — ช่องโหว่ P1/P2 ต้องปิด**ก่อน** commit/push/deploy ขึ้น Render และก่อน git pull ที่เครื่อง 000

## บริบทและการตัดสินใจ (ฟิกซ์แล้ว — ห้ามออกแบบใหม่เอง)

ช่องโหว่ที่ยืนยันจากโค้ดจริง (2026-07-24):

- **P1:** `/api/app/*` (`appProcessingRecordRoutes.js`) ไม่มี auth เลย — คนนอกที่รู้ URL Render ยิง curl ได้: list เอกสารทั้งหมด, mark printed/unprinted มั่ว, และ `POST /:id/request-print` สั่งเครื่อง Brother ที่สาขาปริ้นกระดาษจริงได้ไม่จำกัด
- **P2:** `/api/files/:id/download` (`fileRoutes.js`) ไม่มี auth — และ file id ไม่ต้องเดาเพราะรั่วจาก P1 (`metadata.outputFileId` ใน response ของ processing-records) → คนนอกโหลดเอกสารชดเชยร้านยา (ข้อมูลส่วนบุคคลเชิงสุขภาพ) ได้ทั้งหมด

**แนวทางที่ตัดสินใจแล้ว: middleware ตัวเดียวชื่อ `appAuth` — ยอมรับ credential 2 แบบ (อย่างใดอย่างหนึ่งผ่าน = ผ่าน):**

1. **HTTP Basic Auth** (`Authorization: Basic ...`) เทียบกับ env ใหม่ `APP_BASIC_USER` / `APP_BASIC_PASSWORD` — สำหรับมนุษย์/เบราว์เซอร์ (เบราว์เซอร์เด้ง prompt เองตาม standard, จำ credential ให้เอง, fetch same-origin ของ React แนบให้อัตโนมัติ → **ไม่ต้องแก้โค้ด client เลย**)
2. **Bearer token** ตรงกับ `INTERNAL_API_TOKEN` เดิม — สำหรับ print-agent (ซึ่งส่ง Bearer อยู่แล้วทุก request รวมทั้งตอน download ไฟล์)

ข้อกำหนดของ `appAuth`:

- Mount แบบครอบ**ทั้งแอป** (ทั้ง `/api/*` และ static React SPA) ใน `app.js` **ยกเว้น** 3 เส้นทางที่ต้องเข้าถึงได้โดยไม่มี credential ของเรา:
  - `POST /api/line/webhook` — LINE server เรียกเข้ามาเอง (ป้องกันด้วย HMAC อยู่แล้ว)
  - `GET /api/health` — Render health check
  - (เส้นทาง `/api/agent/*` ไม่ต้อง exempt — Bearer ของ agent ผ่าน `appAuth` ได้เอง แล้ว `internalApiAuth` เดิมเช็คซ้ำอีกชั้นตามปกติ ไม่ต้องถอดของเดิมออก)
- ตอบ 401 พร้อม header `WWW-Authenticate: Basic realm="..."` เมื่อไม่มี/ผิด credential (เพื่อให้เบราว์เซอร์เด้ง prompt)
- เทียบ password ด้วย `crypto.timingSafeEqual` (เช็ค length ก่อนกัน throw — ดู pattern ใน `lineWebhookController.js`)
- **default-off เมื่อ `APP_BASIC_USER`/`APP_BASIC_PASSWORD` ว่าง** (pattern เดียวกับ `internalApiAuth` ที่ skip เมื่อ token ว่าง) — เพื่อให้ dev local สะดวกและ**เทสเดิมทั้งหมดผ่านโดยไม่ต้องแก้** แต่ต้อง `console.warn` ตอน start ว่า auth ปิดอยู่
- เพิ่ม env ใหม่ใน `config/env.js` + `.env.example` (พร้อมคอมเมนต์ว่าต้องตั้งบน Render เสมอใน production)
- **ห้าม**แตะ `server/.env` จริง (มี production credential)

สิ่งที่**ไม่ทำ**ในรอบนี้ (ตัดสินใจแล้วว่า out of scope): per-agent identity/token rotation (P3 — จดเป็นหนี้เทคนิคใน ledger พอ), event-driven architecture, ระบบ login จริงมี user account (over-engineering สำหรับ internal tool ขนาดนี้)

## กติกาการทำงาน (บังคับทุก iteration — เหมือน docs/10)

1. ทำ**ทีละ 1 task** ตามลำดับ: หยิบ task แรกที่ยัง `[ ]` → implement → test ผ่านจริง → ติ๊ก `[x]` → เขียนสรุปใต้ task (ไฟล์ที่แตะ, ผล test) → จบ iteration
2. **ห้าม commit / push git** — ปล่อยไว้ใน working tree ให้เจ้าของ review
3. ⚠️ `server/.env` มี credential PRODUCTION จริง — ห้ามแก้ และห้ามรัน `db:migrate`/`db:seed` ตรงๆ (ใช้ Docker Postgres ทดสอบตามหัวข้อ "สภาพแวดล้อมทดสอบ" ใน docs/10)
4. ห้ามยิง LINE API จริง
5. เทสเดิมทั้งหมดต้องยังผ่าน (server + client + print-agent) ก่อนติ๊กทุก task — โดยเฉพาะ: การเพิ่ม auth ต้อง**ไม่ทำให้เทสเดิมที่ไม่ได้ตั้ง env ใหม่พัง** (default-off design)
6. เลียนแบบ pattern เดิมของ repo (`internalApiAuth` เป็นต้นแบบที่ใกล้สุด)
7. เจอ blocker ที่ต้องให้มนุษย์ตัดสินใจ → เขียนใน "Blockers" แล้วหยุด loop
8. ทุก task เสร็จ → อัปเดตสถานะบรรทัดบนสุดเป็น "เสร็จแล้ว" → หยุด loop
9. หลังติ๊กทุก task → เพิ่มแถวใน `docs/11-print-agent-review-ledger.md` (เว้นคอลัมน์ผู้รีวิวว่างให้ session อื่นมากรอก)

---

## Tasks

### [x] Task S1 — middleware `appAuth` + env ใหม่

- สร้าง `server/src/middleware/appAuth.js` ตามข้อกำหนดใน "บริบทและการตัดสินใจ" ด้านบนเป๊ะๆ (Basic OR Bearer, exempt list, timingSafeEqual, default-off + warn)
- Mount ใน `server/src/app.js` ก่อน routes และก่อน static SPA (ลำดับ: exempt paths ต้องเช็คก่อน auth)
- เพิ่ม `appBasicUser`/`appBasicPassword` ใน `server/src/config/env.js` + `.env.example`
- Test: `server/tests/app-auth.test.js` ใหม่ — (1) env ว่าง → ทุก endpoint ทำงานเหมือนเดิม (default-off) (2) ตั้ง env → `/api/app/processing-records` ไม่มี credential ตอบ 401 พร้อม `WWW-Authenticate`, Basic ถูกตอบ 200, Basic ผิดตอบ 401, Bearer (INTERNAL_API_TOKEN) ถูกตอบ 200 (3) `/api/health` และ `/api/line/webhook` เข้าได้โดยไม่มี credential (webhook ยังโดน HMAC 401 ของมันเองตามปกติ — นั่นคือพฤติกรรมถูก) (4) static SPA path (`GET /`) โดน 401 เมื่อเปิด auth — ระวัง: test ต้อง spawn app แยก process หรือจัดการ env ก่อน require เพราะ `env.js` อ่านครั้งเดียว (ดู pattern ใน `line-notify.test.js` ที่ override env ก่อน require)
- Acceptance: เทสใหม่ผ่าน + เทสเดิม server ทั้งหมดผ่านโดยไม่แก้ (เพราะ default-off) + `npm --prefix client test` และ `npm test` ใน print-agent ยังผ่าน

  **สรุป:** สร้าง `server/src/middleware/appAuth.js` — เช็ค Bearer (เทียบ `env.internalApiToken`) OR Basic (เทียบ `env.appBasicUser`/`appBasicPassword`) ด้วย `crypto.timingSafeEqual` ทุกจุด (เช็ค length ก่อนกัน throw ตาม pattern `lineWebhookController.js`), exempt `/api/line/webhook` และ `/api/health` ด้วย `req.path` exact match, default-off เมื่อ `appBasicUser`/`appBasicPassword` ว่างตัวใดตัวหนึ่ง, ตอบ 401 พร้อม header `WWW-Authenticate: Basic realm="ClaspSCxSeamless"` เมื่อ auth fail. เพิ่ม `appBasicUser`/`appBasicPassword` ใน `config/env.js` + `.env.example` (พร้อมคอมเมนต์เตือนเรื่อง production). Mount `app.use(appAuth)` ใน `app.js` หลัง `morgan` ก่อน `app.use('/api', routes)` (ครอบทั้ง `/api/*` และ static SPA ที่ mount ทีหลัง) — เพิ่ม `console.warn` ตอน `createApp()` เมื่อ env ว่าง (เห็นจริงตอนรันเทส: `[appAuth] APP_BASIC_USER/APP_BASIC_PASSWORD not set...`). Test ใหม่ `server/tests/app-auth.test.js` (8 tests) — ใช้เทคนิคเดียวกับ `line-notify.test.js`/`agent-api.test.js`: mutate `env.appBasicUser`/`env.appBasicPassword`/`env.internalApiToken`/`env.lineChannelSecret` ตรงๆ ระหว่างเทส (env เป็น plain object ไม่ได้ freeze) แทนที่จะ spawn process แยก — เลือก endpoint ที่ auth-pass แล้วเจอ 404 ต่อ (fake UUID, อ่านอย่างเดียว ไม่แตะ production data จริง) เพื่อพิสูจน์ว่า "ผ่าน appAuth" โดยไม่ต้องสร้างข้อมูลจริง; เทส webhook-exempt คำนวณ HMAC เองด้วย secret ที่ override ชั่วคราว (ไม่พึ่ง secret จริงใน `.env`) และส่ง `events: []` เพื่อไม่แตะ `operation_logs` เลย. ผลทดสอบ: `npm test` (server) → 31 tests, 26 pass, 5 skip (ต้อง `TEST_DATABASE_URL`), 0 fail — เทสเดิมทั้งหมดผ่านโดยไม่ต้องแก้แม้แต่บรรทัดเดียว (ยืนยัน default-off ทำงานถูกจริง); `npm --prefix client test` → 8/8 pass; `npm test` (print-agent) → 28/28 pass.

### [x] Task S2 — ยืนยัน integration จริงทั้งสองฝั่ง (มนุษย์ + agent)

- ใช้สภาพแวดล้อมทดสอบจาก docs/10 (Docker Postgres แยก + รัน server จริงด้วย env override รวม `APP_BASIC_USER`/`APP_BASIC_PASSWORD` + `INTERNAL_API_TOKEN`) แล้วเช็ค matrix ด้วย curl จริง:
  - ไม่มี credential: `GET /api/app/processing-records` → 401, `GET /api/files/<id>/download` → 401, `POST /api/app/processing-records/<id>/request-print` → 401, `GET /` (SPA) → 401
  - Basic ถูก: ทุกตัวข้างบน → 200/ทำงานปกติ (upload ผ่าน `/api/workbooks/process` ด้วย Basic เพื่อสร้าง record จริงก่อน)
  - Bearer agent: `GET /api/agent/print-queue` → 200 และ **`downloadUrl` ที่ได้จาก queue ต้องโหลดได้จริงด้วย Bearer เดียวกัน** (นี่คือหัวใจ P2 ฝั่ง agent — `apiClient.downloadFile` ส่ง Bearer อยู่แล้ว ต้องยืนยันว่าผ่าน `appAuth`)
  - รัน `print-agent --dry-run` ชี้ server นี้ → เจอเอกสารใน queue ปกติ (Bearer ผ่านตลอดสาย)
- Acceptance: บันทึกผล matrix ทุกช่องไว้ใต้ task นี้ + เก็บกวาด (ปิด server, ลบ container, ลบ temp)

  **ผล matrix (2026-07-27, Docker Postgres `seamless-s2-pg` port 55435, server จริง port 4002 พร้อม `APP_BASIC_USER=s2-human-user`/`APP_BASIC_PASSWORD=s2-human-pass`/`INTERNAL_API_TOKEN=s2-test-agent-token`):**

  | เคส | Endpoint | ผล |
  |---|---|---|
  | ไม่มี credential | `GET /api/app/processing-records` | **401** ✅ |
  | ไม่มี credential | `GET /api/files/<fake-id>/download` | **401** ✅ |
  | ไม่มี credential | `POST /api/app/processing-records/<fake-id>/request-print` | **401** ✅ |
  | ไม่มี credential | `GET /` (SPA) | **401** ✅ |
  | Basic ถูก | `POST /api/workbooks/process` (สร้าง record จริงด้วย ExcelJS sample) | **200**, สร้าง `processingRecordId`/`outputFileId` จริงสำเร็จ ✅ |
  | Basic ถูก | `GET /api/app/processing-records` | **200** ✅ |
  | Basic ถูก | `GET /api/files/<real-id>/download` | **200**, size 6965 bytes (ไฟล์จริง) ✅ |
  | Basic ถูก | `POST /api/app/processing-records/<real-id>/request-print` | **200**, สร้าง `print_jobs` แถวใหม่จริง (`attemptNo=1, status=queued`) ✅ |
  | Basic ถูก | `GET /` (SPA) | **200** ✅ |
  | Bearer agent | `GET /api/agent/print-queue` | **200**, เจอ record ที่เพิ่งอัปโหลด (`nextAttemptNo=2` เพราะมี request-print job ค้างจาก step ก่อนหน้า) ✅ |
  | Bearer agent (**หัวใจของ P2**) | `GET <downloadUrl จาก queue>` ด้วย Bearer เดียวกัน | **200**, size 6965 bytes — ไฟล์เดียวกับที่มนุษย์โหลดได้ ✅ |
  | sanity check | `GET <downloadUrl เดียวกัน>` แบบไม่มี credential | **401** ✅ (ยืนยันว่า path นี้ปิดจริง ไม่ใช่ fluke) |
  | Bearer agent | `node print-agent/src/index.js --dry-run` ชี้ server นี้จริง | เจอ 1 เอกสาร, log `[dry-run] Would create a print job...` ระบุ `downloadUrl` ถูกต้อง, exit code 0 ✅ |

  **สรุป: ทุกช่องผ่านตามที่ออกแบบไว้ ไม่มีช่องไหนหลุด** — P1 (request-print เปิดโล่ง) และ P2 (file download เปิดโล่ง) ปิดสนิททั้งคู่ ขณะที่ทั้งมนุษย์ (Basic ผ่านเบราว์เซอร์) และ print-agent (Bearer เดิม ไม่ต้องแก้โค้ด agent เลย) ยังใช้งานได้ปกติทุกจุด รวมถึง flow ที่ agent ต้องโหลดไฟล์จริงหลังเห็น queue

  **เก็บกวาด:** ปิด server (kill process, ยืนยันด้วย `curl` ไม่ต่อได้อีกแล้ว — เจอ race เล็กน้อยตอนเช็คครั้งแรกที่ยัง 200 อยู่เพราะเช็คเร็วเกินไปหลัง kill, เช็คซ้ำแล้วยืนยัน 000/ไม่ต่อได้จริง), ลบ container `seamless-s2-pg`, ลบไฟล์ temp ทั้งหมด (`/tmp/s2-*.xlsx`, `/tmp/s2-*.json`, `/tmp/s2-server.log`, `/tmp/s2-print-agent-logs/`, `print-agent/agent.lock`)

### [x] Task S3 — อัปเดตเอกสาร

- `ARCHITECTURE.md`: อธิบาย `appAuth` (ใครต้องใช้ credential แบบไหน, เส้นทางไหน exempt เพราะอะไร) + env ใหม่ 2 ตัว
- `docs/10-print-agent-tasks.md` หัวข้อ "งานที่เหลือให้มนุษย์ทำ": เพิ่มข้อ "ตั้ง `APP_BASIC_USER`/`APP_BASIC_PASSWORD` บน Render (บังคับ — ถ้าไม่ตั้ง เว็บจะเปิดโล่งเหมือนเดิม)" และข้อ "แจ้ง username/password ให้พนักงานที่ใช้เว็บ"
- `print-agent/README.md`: ไม่ต้องแก้ (agent ใช้ Bearer เดิม) แต่ตรวจยืนยันว่าไม่มีข้อความไหนขัดกับของจริง
- Acceptance: เอกสารตรงกับ implementation + เทสทุก suite ยังผ่าน (docs-only ไม่ควรพังอะไร)

  **สรุป:** `ARCHITECTURE.md` — เพิ่มหัวข้อใหม่ "Authentication" (ก่อน "React Endpoints In Use") อธิบาย `appAuth`: Basic สำหรับมนุษย์ (เบราว์เซอร์เด้ง prompt เอง ไม่ต้องแก้ client), Bearer `INTERNAL_API_TOKEN` เดิมสำหรับ agent (ไม่ต้องแก้ agent), 2 เส้นทาง exempt (`/api/health`, `/api/line/webhook`) พร้อมเหตุผล, และ default-off behavior เมื่อ dev ไม่ได้ตั้ง env; อัปเดตบรรทัด `INTERNAL_API_TOKEN` เดิมให้บอกว่าตอนนี้ใช้เป็น Bearer credential ของ `appAuth` ด้วย; เพิ่มบรรทัด `APP_BASIC_USER`/`APP_BASIC_PASSWORD` ใหม่ใน "Environment Variables". `docs/10-print-agent-tasks.md` "งานที่เหลือให้มนุษย์ทำ" — เพิ่มข้อ 7 (ตั้ง env บน Render บังคับ) และข้อ 8 (แจ้ง credential ให้พนักงาน) ต่อจากข้อ 6 เดิม. `print-agent/README.md` — ตรวจแล้วไม่มีข้อความขัดแย้ง (พูดถึง `INTERNAL_API_TOKEN` อย่างเดียวซึ่งยังถูกต้องเป๊ะ ไม่ต้องแก้). ผลทดสอบยืนยันว่า docs-only ไม่พังอะไรจริง: `npm test` (server) → 31 tests 26 pass 5 skip 0 fail; `npm --prefix client test` → 8/8 pass; `npm test` (print-agent) → 28/28 pass.

**ทุก task ใน docs/12 เสร็จหมดแล้ว (S1-S3)** — ดูหัวข้อ "งานที่เหลือให้มนุษย์ทำหลัง loop นี้จบ" ด้านล่างสำหรับขั้นตอนถัดไป

---

## งานที่เหลือให้มนุษย์ทำหลัง loop นี้จบ

1. Review + commit + push ทั้ง working tree (WP08 + hardening นี้)
2. ทำตามรายการเดิมใน docs/10 ("งานที่เหลือให้มนุษย์ทำ" ข้อ 1-6) + ตั้ง `APP_BASIC_USER`/`APP_BASIC_PASSWORD` บน Render
3. **แล้วค่อย** git pull ที่เครื่อง 000 — ลำดับนี้สำคัญ: อย่า pull ที่ 000 ก่อน backend บน Render พร้อม

## Blockers

(ว่าง — AI เขียนเพิ่มที่นี่เมื่อเจอ)

## Work log

(AI เขียนสรุปต่อท้ายทุก iteration: วันที่ / task / ไฟล์ที่แตะ / ผล test)

- 2026-07-24 — Task S1 เสร็จ. ไฟล์ที่แตะ: `server/src/middleware/appAuth.js` (ใหม่), `server/src/app.js` (mount middleware + startup warning), `server/src/config/env.js` + `.env.example` (เพิ่ม `appBasicUser`/`appBasicPassword`/`APP_BASIC_USER`/`APP_BASIC_PASSWORD`), `server/tests/app-auth.test.js` (ใหม่, 8 tests). ผลทดสอบ: `npm test` (server) → 31 tests 26 pass 5 skip 0 fail (เทสเดิมไม่ต้องแก้เลย); `npm --prefix client test` → 8/8 pass; `npm test` (print-agent) → 28/28 pass. ไม่ได้แตะ production `.env` หรือ migrate ใดๆ.
- 2026-07-27 — Task S2 เสร็จ (ไม่มีโค้ดใหม่ — เป็น integration verification ล้วนด้วย curl จริง). Docker Desktop ไม่ได้รันอยู่ตอนเริ่ม ต้อง `Start-Process` เปิดเองก่อนแล้วรอ `docker info` ตอบ (~20 วิ). ตั้ง Docker Postgres แยก (`seamless-s2-pg`, port 55435) + migrate + seed → รัน server จริง (port 4002) พร้อม `APP_BASIC_USER`/`APP_BASIC_PASSWORD`/`INTERNAL_API_TOKEN` จริง → รัน matrix เต็มด้วย curl (ผลละเอียดบันทึกไว้ใต้ Task S2 ด้านบนแล้ว): ไม่มี credential → 401 ทั้ง 4 endpoint; Basic ถูก → 200 ทั้งหมดรวม upload จริง + request-print จริง; Bearer agent → print-queue 200 และที่สำคัญที่สุดคือ **`downloadUrl` จาก queue โหลดไฟล์จริงได้ด้วย Bearer เดียวกัน** (หัวใจของ P2 ฝั่ง agent) พร้อม sanity check ว่า URL เดียวกันไม่มี credential ยัง 401 อยู่; `print-agent --dry-run` ชี้ server นี้จริง → เจอเอกสาร, exit 0. **ทุกช่อง matrix ผ่านหมด ไม่มีจุดไหนหลุด** — ปิด P1+P2 สำเร็จโดยไม่กระทบการใช้งานจริงของทั้งมนุษย์และ agent. เก็บกวาด: ปิด server, ลบ container, ลบไฟล์ temp ทั้งหมดแล้ว.
- 2026-07-27 — Task S3 เสร็จ (task สุดท้ายในไฟล์นี้). ไฟล์ที่แตะ: `ARCHITECTURE.md` (เพิ่มหัวข้อ "Authentication" อธิบาย `appAuth` ครบ + env vars ใหม่ 2 ตัว), `docs/10-print-agent-tasks.md` (เพิ่มข้อ 7-8 ใน "งานที่เหลือให้มนุษย์ทำ"). `print-agent/README.md` ตรวจแล้วไม่ต้องแก้ (ไม่มีข้อความขัดแย้งกับของจริง). ผลทดสอบ: `npm test` (server) → 31 tests 26 pass 5 skip 0 fail; `npm --prefix client test` → 8/8 pass; `npm test` (print-agent) → 28/28 pass — docs-only ไม่พังอะไรจริง. **อัปเดตสถานะบรรทัดบนสุดของไฟล์นี้เป็น "เสร็จแล้ว" — ทุก task (S1-S3) ติ๊กครบแล้ว หยุด loop.**
