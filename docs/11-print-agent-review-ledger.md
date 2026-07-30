# 11 Auto-Print Agent — Code Review Ledger

สถานะ: กำลังทำ

จุดประสงค์: ไฟล์นี้ให้ AI/มนุษย์อีก session (เช่น Fable) เข้ามา**ตรวจโค้ดของแต่ละ task ใน `docs/10-print-agent-tasks.md` แบบอิสระ** — ไม่ใช่แค่เชื่อ work log ที่ผู้ implement เขียนเอง ทุก task ที่ implement เสร็จในไฟล์ 10 ต้องมีแถวในตารางนี้เพื่อรอ/บันทึกผลรีวิว

## วิธีรีวิว (สำหรับ session ที่มาตรวจ)

1. เปิด `docs/10-print-agent-tasks.md` อ่าน work log ของ task ที่จะรีวิว (มีรายชื่อไฟล์ที่แตะ)
2. เปิดไฟล์จริงที่ระบุ อ่านโค้ดทั้งหมด เทียบกับ acceptance criteria ของ task นั้นและ design spec `docs/09-auto-print-agent-design.md`
3. รัน test จริง (`npm test` ใน `server/`; ถ้า task ต้อง DB ให้ตั้ง Docker Postgres ทดสอบตามหัวข้อ "สภาพแวดล้อมทดสอบ" ใน docs/10) — อย่าเชื่อแค่ตัวเลข pass/fail ที่จดไว้ ให้รันเองซ้ำ
4. ประเมิน: ถูกต้องตาม spec ไหม, มี edge case ที่พลาดไหม, ปลอดภัยไหม (โดยเฉพาะจุดที่แตะ production credential/data), test ครอบคลุมพอไหม หรือแค่ผ่านผิวเผิน
5. เติมคอลัมน์ `ผู้รีวิว` / `วันที่รีวิว` / `ผลตัดสิน` (`ผ่าน` / `ผ่านมีข้อสังเกต` / `ไม่ผ่าน`) / `หมายเหตุ` ในตารางด้านล่าง — ถ้า "ไม่ผ่าน" หรือ "ผ่านมีข้อสังเกต" ต้องเขียนเหตุผลและ (ถ้าเป็นไปได้) เสนอ fix ไว้ในหมายเหตุ อย่าแก้โค้ดเองโดยไม่บอกไว้ตรงนี้ก่อน
6. ห้าม mark "ผ่าน" ถ้ายังไม่ได้รันเทสจริงด้วยตัวเอง

## ตารางรีวิว

| Task | ไฟล์หลักที่แตะ | สรุปสั้น (ผู้ implement เขียน) | ผู้รีวิว | วันที่รีวิว | ผลตัดสิน | หมายเหตุ |
|---|---|---|---|---|---|---|
| 1 — แก้ worksheet ว่างหลุดเข้าไฟล์ processed | `server/src/services/workbookTransformService.js`, `server/tests/workbook-transform.test.js` | ลบ worksheet อื่นทั้งหมดออกจาก workbook หลังแปลง sheet แรกเสร็จ (`workbook.removeWorksheet`), เพิ่ม test 3-sheets | Fable (session ClaspSCShift) | 2026-07-24 | **ผ่าน** | โค้ดถูกต้อง — `.filter()` สร้าง array ใหม่ก่อนค่อยลบ เลี่ยงกับดัก mutate ระหว่าง iterate; test ยืนยันทั้งจำนวน sheet และ identity ของ sheet ที่เหลือ; รันเทสเองแล้วผ่าน |
| 2 — Migration `003_print_jobs.sql` + repository | `server/db/migrations/003_print_jobs.sql`, `server/src/db/repositories/printJobRepository.js`, `server/src/db/identifiers.js`, `server/tests/print-job-db.test.js` | ตาราง `print_jobs` ตาม docs/09 section 3 + trigger `set_updated_at`, repository คำนวณ `attempt_no`/`is_reprint`/`requeueStaleJobs`, ทดสอบผ่าน Docker Postgres จริง | Fable (session ClaspSCShift) | 2026-07-24 | **ผ่าน (R1 แก้แล้ว — Fable re-verify 2026-07-24)** | SQL ตรง spec, trigger reuse `set_updated_at` จาก 001 ถูกต้อง, migrate บน Postgres สดผ่าน (001→002→003) **แต่พบบั๊ก stale recovery ใช้ไม่ได้จริง**: `requeueStaleJobs` เซ็ต `status='queued'` แต่**ไม่ล้าง `agent_host`** → เงื่อนไข NOT EXISTS ใน `listPrintQueueCandidates` (active status + `agent_host IS NOT NULL`) ยังกัน record นั้นออกจาก queue ตลอดกาล = agent ตายกลางคันแล้วเอกสารนั้นไม่มีวันถูกหยิบมาปริ้นอีก; ซ้ำเคส job ค้างสถานะ `queued`+`agent_host` (agent ตายก่อน PATCH แรก) ไม่เข้า STALE_STATUSES เลยไม่ถูก requeue ด้วย → **fix: requeueStaleJobs ต้องเซ็ต `agent_host = NULL` และรวมเคส `queued` ที่มี `agent_host` ในการสแกน stale** — **แก้แล้ว (R1, 2026-07-24): `updatePrintJob` รองรับ `agentHost: null`, `requeueStaleJobs` เซ็ต `agentHost: null` ทุกครั้งที่ requeue + query SELECT ครอบเคส `queued`+`agent_host` ด้วย, เพิ่ม test ยืนยัน (backdate `updated_at` โดยปิด trigger ชั่วคราว) → 23/23 pass บน Docker Postgres ทดสอบ** |
| 3 — Agent API `/api/agent/*` | `server/src/routes/agentRoutes.js`, `server/src/routes/index.js`, `server/src/controllers/agentController.js`, `server/src/services/printAgentService.js`, `server/src/db/repositories/printJobRepository.js` (เพิ่ม `listPrintQueueCandidates`/`getAttemptPreview`), `server/src/config/env.js`, `.env.example`, `server/tests/agent-api.test.js` | 4 endpoints หลัง `internalApiAuth`, print-queue filter ตาม spec + กัน double-print, LINE notify เป็น stub รอ Task 4 | Fable (session ClaspSCShift) | 2026-07-24 | **ผ่าน (R1/R3 แก้แล้ว — Fable re-verify 2026-07-24)** | โครงถูกต้อง, auth ครบ, complete flow (mark printed → LINE → บันทึกผล notify โดยไม่ทำให้ complete fail) ทำถูก; จุดที่ผู้ implement ขอให้เพ่ง (`agent_host IS NOT NULL` ให้ job ของ admin ยังโผล่) ตรรกะถูกตาม spec **แต่ไปพันกับบั๊ก Task 2 ข้างบน — แก้ที่เดียวกัน** (ดู R1); ข้อสังเกต: (a) `AUTO_PRINT_SINCE` ว่าง = ปิด auto-print ทั้งหมด เหลือแต่ manual queue — เป็น fail-safe ที่ดี แต่ควรจดใน .env.example ให้ชัด (b) ~~test isolation พัง: รัน `npm test` ซ้ำบน DB เดิมโดยไม่ล้าง จะ fail ที่ "empty queue" เพราะ `app-request-print.test.js` ทิ้ง queued job ไว้~~ **แก้แล้ว (R3, 2026-07-24): ห่อ `try/finally` cleanup ใน `app-request-print.test.js`, ยืนยันรัน `npm test` 2 รอบติดกันบน DB เดิมผ่านทั้งคู่ 23/23** |
| 4 — LINE notify service + webhook | `server/src/services/lineNotifyService.js`, `server/src/controllers/lineWebhookController.js`, `server/src/routes/lineRoutes.js`, `server/src/routes/index.js`, `server/src/app.js` (raw body verify hook), `server/src/config/env.js`, `.env.example`, `server/src/services/printAgentService.js` (ผูก service จริงแทน stub), `server/tests/line-notify.test.js` | `sendPrintNotification` ตามเทมเพลต docs/09 4.3, webhook verify HMAC ด้วย `timingSafeEqual` แล้ว log groupId ลง `operation_logs`, ไม่ใส่ `internalApiAuth` ที่ webhook เพราะ LINE เรียกเข้ามาเอง | Fable (session ClaspSCShift) | 2026-07-24 | **ผ่าน (R2 แก้แล้ว — Fable re-verify 2026-07-24)** | HMAC verify ถูกต้องและปลอดภัย (เช็ค length ก่อน `timingSafeEqual` เลี่ยง throw; 401 เปล่าๆ ไม่รั่วข้อมูล — deviation จาก "ตอบ 200 เสมอ" แต่สมเหตุสมผลเพราะ 200 จำเป็นเฉพาะ event จริงจาก LINE); ตรวจ `logOperation` แล้ว swallow DB error จริง (catch ใน operationLogRepository) → webhook ตอบ 200 แม้ DB ล่ม; เทคนิค unreachable-DB (127.0.0.1:1) ใน test กัน production ได้จริง + mock fetch ไม่ยิง LINE จริง — ยอมรับได้; ~~บั๊กที่ควรแก้: `formatTimestamp` ใช้ `getHours()` ตาม timezone ของ server~~ **แก้แล้ว (R2, 2026-07-24): เปลี่ยนไปใช้ `Intl.DateTimeFormat` timezone `Asia/Bangkok`**; rawBody hook แบบ global overhead จิ๋ว ยอมรับได้ |
| 5 — ปุ่ม "สั่งปริ้น / ขอปริ้นใหม่" (backend + React) | `server/src/services/processingRecordService.js`, `server/src/controllers/processingRecordController.js`, `server/src/routes/appProcessingRecordRoutes.js`, `server/tests/app-request-print.test.js`, `client/src/services/api.js`, `client/src/components/HistoryActions.jsx`/`HistoryTable.jsx`/`HistoryGrouped.jsx`/`HistoryPanel.jsx`, `client/tests/api-service.test.mjs` | endpoint ใหม่ mark unprinted + สร้าง `print_jobs` แถว `queued` ผ่าน repository เดิมจาก Task 2, ปุ่มใหม่ในหน้าเว็บ confirm+prompt ตาม pattern ปุ่มเดิม | Fable (session ClaspSCShift) | 2026-07-24 | **ผ่าน** | อ่านโค้ดครบทั้ง backend/client — `requestPrint` service ส่ง `requestedBy`/`reason` ผ่าน repository ถูกต้อง, `is_reprint` คำนวณที่ repository ตาม spec, UI ตาม pattern ปุ่ม send-email เดิมเป๊ะ, test มี cleanup ใน `finally` แล้ว (R3); รันเอง: server 23/23, client ผ่าน, `build:client` สำเร็จ |
| 6 — Print agent (`print-agent/` โฟลเดอร์ใหม่) | `print-agent/package.json`, `print-agent/src/{index,apiClient,convert,print,lock,logger}.js`, `print-agent/.env.example`, `print-agent/README.md`, `print-agent/tests/{convert,print,apiClient,index}.test.js`, `.gitignore` (เพิ่ม `agent.lock`) | CLI ตาม docs/09 section 5 ครบ (loop pseudocode 5.1, LibreOffice convert, SumatraPDF print + poll คิวว่าง, lock file, log รายวัน), `--dry-run` ข้าม side-effect ทั้งหมดยกเว้น `GET /print-queue`, README ใช้ข้อมูลเครื่อง 000 จริง | Fable (session ClaspSCShift) | 2026-07-24 | **ผ่านมีข้อสังเกต (R4/R5 ควรแก้ก่อน deploy จริง)** — **R4/R5/R6 ตกลงและแก้แล้ว 2026-07-24 รอ re-verify** | จุดแข็ง: `spawn` แบบ args array ไม่มี shell-injection, escape ชื่อ printer ใน PowerShell ถูกต้อง, lock ใช้ `wx` flag atomic + release ใน `finally`, error ต่อเอกสาร catch แล้วปริ้นตัวถัดไปต่อ, dry-run สะอาดจริง; รันเทสเอง 19/19 ผ่าน; ~~**R4 (ควรแก้): lock ไม่มี stale detection**~~ **แก้แล้ว: `acquireLock` เช็ค PID ในไฟล์ยังรันอยู่จริงไหมผ่าน `process.kill(pid,0)` แทนการเดา time threshold** (ดูรายละเอียดเต็มใน docs/10 หัวข้อ "ประเด็นเสนอจากรีวิวรอบ 2" → R4); ~~**R5 (ควรแก้): `waitForPrintQueueEmpty` เช็คคิวทั้งเครื่องว่าง**~~ **แก้แล้ว: snapshot job ids ก่อนปริ้น → diff หา job ใหม่ → เก็บเป็น `spoolerJobId` (ส่งจริงครั้งแรก) → รอเฉพาะ job นั้น (`waitForSpecificJobToClear`)** — ยืนยันด้วยหลักฐานจริงจากเครื่อง 000 (25 stuck jobs ตั้งแต่ 2020) ว่าเป็น guaranteed failure ไม่ใช่แค่ risk (ดู R5 ใน docs/10); minor: ~~temp dir (`mkdtemp`) ไม่ถูกลบหลังจบรอบ~~ **แก้แล้ว (R6): ลบเมื่อทุกเอกสารสำเร็จ, เก็บไว้ debug เมื่อมี fail**. Test เพิ่มจาก 19 → 28 (ใหม่: `lock.test.js` 7 tests, `print.test.js` +2). รายละเอียด implementation เต็มอยู่ใน docs/10 |
| 7 — End-to-end ทดสอบรวมบนเครื่อง dev | ไม่มีโค้ดใหม่ — เป็น integration verification ล้วน (ดูผลตรวจเต็มใต้ Task 7 ใน docs/10) | ยืนยัน full lifecycle ผ่าน API จริงบน Docker Postgres แยก: upload → print-queue detect → job create/download/spooler/complete → mark printed + LINE skip → request-print reprint → agent เจอ reprint รอบถัดไป; ใช้ `--dry-run` แทนปริ้นจริงเพราะเครื่อง dev ไม่มี LibreOffice/SumatraPDF (จดใน Blockers) | Fable (session ClaspSCShift) | 2026-07-24 | **ผ่าน** | บันทึกผลตรวจใต้ Task 7 ละเอียดครบ 10 ข้อและ consistent กับโค้ดที่ผมรีวิว (สถานะ/ฟิลด์ตรงกับ implementation จริงทุกจุดที่เช็คได้); ผมรัน suite ระดับ automated ซ้ำเองทั้งหมดผ่าน (server 23/23 ×2, agent 19/19, client + build) — ข้อจำกัดที่ยอมรับ: การปริ้นจริงผ่าน LibreOffice/SumatraPDF ยังไม่เคยเกิดขึ้นที่ไหนเลย ต้องถือว่า untested จนกว่าจะ deploy เครื่อง 000 (ตรงกับ Blockers ที่จดไว้) |
| 8 — อัปเดตเอกสาร | `ARCHITECTURE.md`, `docs/09-auto-print-agent-design.md` (บรรทัดสถานะ), `README.md` (ไฟล์ใหม่ — repo ไม่เคยมี README.md มาก่อน) | เพิ่ม endpoint/env vars ใหม่ทั้งหมดลง ARCHITECTURE.md, อัปเดตสถานะ design doc เป็น implemented, สร้าง README.md ชี้ไปยังเอกสารหลัก | — ยังไม่รีวิว — | | | |
| S1 — middleware `appAuth` (docs/12, security hardening P1+P2) | `server/src/middleware/appAuth.js` (ใหม่), `server/src/app.js`, `server/src/config/env.js`, `.env.example`, `server/tests/app-auth.test.js` (ใหม่) | Basic OR Bearer auth ครอบทั้งแอป (SPA + `/api/app/*` + `/api/files/*`) ยกเว้น `/api/line/webhook`/`/api/health`, default-off เมื่อ env ว่าง (มี startup warning), `timingSafeEqual` ทุกจุดเทียบ credential, ปิดช่องโหว่ P1 (request-print เปิดโล่ง) + P2 (file download เปิดโล่ง) ที่พบจาก security review หลัง WP08 | — ยังไม่รีวิว — | | | |
| S2 — ยืนยัน integration จริง P1+P2 (docs/12) | ไม่มีโค้ดใหม่ — curl matrix จริงบน Docker Postgres แยก (ดูผลเต็มใต้ Task S2 ใน docs/12) | ยืนยัน matrix ครบ: ไม่มี credential → 401 ทุก endpoint (รวม SPA), Basic ถูก → 200 ทุกจุดรวม upload+request-print จริง, Bearer agent → print-queue 200 **และ downloadUrl จาก queue โหลดไฟล์จริงได้ด้วย Bearer เดียวกัน** (หัวใจ P2 ฝั่ง agent) + sanity check URL เดียวกันไม่มี credential ยัง 401, `print-agent --dry-run` ชี้ server จริงผ่านปกติ | — ยังไม่รีวิว — | | | |
| S3 — อัปเดตเอกสาร (docs/12) | `ARCHITECTURE.md` (หัวข้อ "Authentication" ใหม่ + env vars), `docs/10-print-agent-tasks.md` (เพิ่มข้อ 7-8 ใน "งานที่เหลือให้มนุษย์ทำ") | อธิบาย `appAuth` ครบ (ใครใช้ credential แบบไหน, เส้นทาง exempt เพราะอะไร, default-off), เพิ่มขั้นตอน deploy ที่ต้องตั้ง `APP_BASIC_USER`/`APP_BASIC_PASSWORD` บน Render + แจ้งพนักงาน | — ยังไม่รีวิว — | | | |
| 1 — Codex final blind re-review | `server/src/services/workbookTransformService.js`, `server/tests/workbook-transform.test.js` | เปิดอ่านไฟล์จริงและเทียบ docs/09 §5.2.1 ใหม่ | Codex | 2026-07-27 | **ผ่าน** | ลบ worksheet อื่นจาก snapshot array ถูกต้องและ test ยืนยัน identity ของ sheet แรก; รัน server DB-backed suite จริงผ่าน 31/31 สองรอบ |
| 2 — Codex re-verify R1 | `server/db/migrations/003_print_jobs.sql`, `server/src/db/repositories/printJobRepository.js`, `server/tests/print-job-db.test.js` | re-verify stale recovery และ lifecycle ของ queued job บน PostgreSQL จริง | Codex | 2026-07-27 | **ไม่ผ่าน** — **แก้แล้ว (R7) รอ re-verify** | R1 ล้าง `agent_host` และทำให้ stale row กลับมาเห็นใน queue ได้จริง แต่ flow ถัดไปผิด: ~~agent `POST /print-jobs` สร้าง **row ใหม่** แทน claim/reuse row `queued` เดิม; เมื่อ row ใหม่ completed แล้ว row เดิมยัง `queued`+ไม่มี `agent_host` ทำให้ record กลับเข้า queue ทุกชั่วโมงและเสี่ยงปริ้นซ้ำไม่สิ้นสุด~~. reproduce บน disposable PostgreSQL จริงแล้ว: admin queued attempt 1 → agent สร้าง attempt 2 → complete attempt 2 → `candidateAfterAgentCompleted=true`, active job ที่เหลือคือ attempt 1 queued. เคส stale-requeue มีปัญหาเดียวกัน. Test R1 ปัจจุบันหยุดตรวจแค่ “กลับเข้า candidates” จึงไม่ครอบ full recovery lifecycle. **แก้แล้ว (R7, 2026-07-27):** Sonnet 5 reproduce บั๊กนี้ซ้ำเองบน Docker Postgres จริงก่อนแก้ (ยืนยันไม่ได้เชื่อ Codex เฉยๆ) แล้วเพิ่ม `claimQueuedJob` (UPDATE...FOR UPDATE SKIP LOCKED) ให้ agent หยิบใช้แถว `queued` เดิมแทนสร้างใหม่ + เพิ่ม test ยืนยันทั้งระดับ repository และระดับ HTTP เต็มวงจร → 33/33 pass. รายละเอียดเต็มอยู่ใน `docs/10-print-agent-tasks.md` หัวข้อ "ประเด็นจากรีวิวรอบ 3" → R7 |
| 3 — Codex re-verify queue/API | `server/src/routes/agentRoutes.js`, `server/src/controllers/agentController.js`, `server/src/services/printAgentService.js`, `server/src/db/repositories/printJobRepository.js`, `server/tests/agent-api.test.js` | ตรวจ SQL double-print guard และ agent lifecycle เทียบ docs/09 | Codex | 2026-07-27 | **ไม่ผ่าน** — **แก้แล้ว (R7) รอ re-verify** | auth/routes ใช้ได้และ R3 test isolation ผ่าน (server suite 31/31 สองรอบบน DB เดิม) แต่ ~~Task 3 เชื่อมกับ defect ข้างบนโดยตรง: queue คืน admin/stale queued row แล้ว create endpoint สร้าง row ซ้ำ ไม่เคย claim/advance queued row เดิม จึงไม่กัน double-print ตาม docs/09 §7~~. **แก้แล้ว (R7, 2026-07-27):** ดูรายละเอียดที่แถว Task 2 ด้านบน — `agentController`/`printAgentService.createAgentPrintJob` เรียก `claimQueuedJob` ก่อนสร้าง row ใหม่แล้ว. ส่วนข้อสังเกตเรื่อง **count+insert ไม่มี transaction/unique constraint จึง race ได้ถ้ามี caller พร้อมกัน — ยังไม่ได้แก้** (`claimQueuedJob` ใช้ `FOR UPDATE SKIP LOCKED` กันชนเฉพาะ path claim-ของเดิม แต่ path สร้างใหม่ล้วนๆ ยังไม่มี lock) ยอมรับเป็นความเสี่ยงต่ำที่เหลืออยู่ (มี agent ตัวเดียว, กด request-print พร้อมกันพอดีเกิดยาก) — จดไว้เป็นหนี้เทคนิครอแก้ภายหลังถ้าจำเป็น |
| 4 — Codex re-verify R2 | `server/src/services/lineNotifyService.js`, `server/src/controllers/lineWebhookController.js`, `server/src/app.js`, `server/tests/line-notify.test.js` | ตรวจ HMAC/raw body/LINE failure/timezone | Codex | 2026-07-27 | **ผ่าน** | R2 ใช้ `Intl.DateTimeFormat` พร้อม `Asia/Bangkok` จริง; HMAC ใช้ raw body + length check ก่อน timing-safe compare; LINE failure ไม่ block completion; test mock ไม่ยิง LINE จริง และ suite ผ่าน |
| 5 — Codex final blind re-review | `server/src/services/processingRecordService.js`, controller/route/tests และ client history files | ตรวจ request-print ทั้ง backend/UI | Codex | 2026-07-27 | **ไม่ผ่าน** — **แก้แล้ว (R7+R8) รอ re-verify** | UI/API payload ทำงานตามที่เขียนและ tests ผ่าน แต่ ~~queued row ที่ endpoint นี้สร้างเป็นต้นเหตุ persistent queue defect ใน Task 2/3: agent ไม่ consume row นี้และสร้างอีก row แทน~~. ~~เพิ่มเติม: การ mark record unprinted กับ insert print job ไม่อยู่ transaction เดียวกัน; insert fail จะเหลือ state เปลี่ยนแล้วแต่ไม่มี tracked request~~. **แก้แล้ว (R7, 2026-07-27):** agent claim row นี้แทนสร้างใหม่แล้ว (ดู Task 2). **แก้แล้ว (R8, 2026-07-27):** `requestPrint` ห่อด้วย `BEGIN`/`COMMIT`/`ROLLBACK` ผ่าน client เดียวกัน (pattern เดียวกับ `workbookService.js`) แล้ว — ถ้า insert job ล้มเหลว จะ rollback การ mark unprinted กลับไปด้วย ไม่เหลือ state ค้างครึ่งๆ กลางๆ อีกต่อไป |
| 6 — Codex re-verify R4-R6 + PowerShell | `print-agent/src/*`, `print-agent/tests/*`, README/.env example | รัน 28 tests และเรียก `getPrintJobs` กับ Windows print queue จริงบนเครื่อง dev | Codex | 2026-07-27 | **ไม่ผ่าน** | R4 PID-liveness และ R6 cleanup ทำงานตาม claim; R5 ดีขึ้นตรงรอเฉพาะ job id. PowerShell integration ถูกเรียกจริงกับ queue `Brother DCP-T510W Printer` และ parse single-object จริงได้ `{id:119, jobStatus:8210}`. แต่ยังไม่ครบ docs/09 §5.3: โค้ดไม่ตรวจ numeric `JobStatus`/printer error และไม่มี fail-fast เมื่อ printer offline; ถ้าหา new job ไม่เจอใน 20 วินาทีจะสมมติว่าสำเร็จทันที ซึ่งแยก “พิมพ์เร็ว” ออกจาก “ไม่เคยเข้า spooler” ไม่ได้. อีกทั้งไม่มี retention 90 วันตาม §5.5. target Brother MFC-T4500DW/เครื่อง 000 และ Sumatra→spooler diff จริงยังไม่เคยทดสอบ จึงยัง risky |
| 7 — Codex final blind re-review | integration evidence ใน docs/10 + code/tests จริง | ตรวจว่าหลักฐาน e2e ครอบ lifecycle หรือไม่ | Codex | 2026-07-27 | **ไม่ผ่าน** — **R7 แก้แล้ว แต่ non-dry-run e2e จริงยังไม่ผ่าน (ค้างเดิม)** | ~~backend/manual-curl lifecycle ที่บันทึกไว้ไม่ตรวจว่า admin queued row ถูก consume หลัง agent complete จึงพลาด defect ที่ reproduce ได้ข้างบน~~. **แก้แล้ว (R7, 2026-07-27):** เพิ่ม test ระดับ HTTP เต็มวงจรจริงใน `server/tests/agent-api.test.js` ที่ตรวจตรงจุดนี้เป๊ะๆ (request-print → agent claim → complete → เช็คว่าไม่กลับเข้าคิว) → ผ่าน. **ยังไม่แก้ (ยอมรับตามเดิม):** non-dry-run agent, LibreOffice, SumatraPDF และ target printer จริงยังไม่เคยผ่าน e2e จริงเหมือนที่ Codex ตั้งข้อสังเกตไว้ — ยังต้องรอเครื่อง 000 |
| 8 — Codex final blind re-review | `ARCHITECTURE.md`, `README.md`, `docs/09-auto-print-agent-design.md`, `print-agent/README.md` | ตรวจ docs เทียบ implementation จริง | Codex | 2026-07-27 | **ไม่ผ่าน** — **R9 แก้แล้ว, JobStatus/retention ยังไม่แก้** | ~~`print-agent/README.md` ยังบอกว่า "รอจนคิวปริ้นของ Windows ว่าง" (ขัดกับ R5 ที่รอเฉพาะ job) และบอก stale lock ให้ลบเอง (ขัดกับ R4 auto-reclaim)~~; ~~ARCHITECTURE claim ว่า queue "never returns" claimed record แต่ persistent queued-row defect ทำให้เอกสารกลับมาได้~~. **แก้แล้ว (R9, 2026-07-27):** แก้ถ้อยคำทั้ง 2 จุดใน `print-agent/README.md` ให้ตรงกับ R4/R5 แล้ว; ARCHITECTURE's claim กลับมาเป็นจริงแล้วหลัง R7 แก้ persistent-queue defect. **ยังไม่แก้ (ยอมรับตามเดิม):** docs/09 ระบุ printer error/fail-fast และ log retention 90 วันซึ่ง implementation ยังไม่มี — ยังเป็นช่องว่างจริงตามที่ Codex ชี้ ไม่ได้อยู่ในขอบเขตที่แก้รอบนี้ |
| S1 — Codex security re-review | `server/src/middleware/appAuth.js`, `server/src/app.js`, `server/src/config/env.js`, `.env.example`, `server/tests/app-auth.test.js` | ตรวจ Basic OR Bearer, coverage, exemptions, default-off | Codex | 2026-07-27 | **ผ่าน** | middleware mount ก่อน `/api` และ static SPA, Basic username/password และ Bearer ใช้ timing-safe compare, exact exemptions ถูกต้อง, 401 มี `WWW-Authenticate`; real HTTP tests ผ่าน. ความเสี่ยง ops ที่ตั้งใจยอมรับ: ถ้า env Basic ขาดตัวใดตัวหนึ่ง production จะเปิดทั้งเว็บ จึงต้องมี deploy checklist/monitoring บังคับ |
| S2 — Codex security integration corroboration | ไม่มีโค้ดใหม่ | รัน real HTTP auth tests + DB-backed suites และตรวจ Bearer download path/client | Codex | 2026-07-27 | **ผ่านมีข้อสังเกต** | ยืนยันจริงว่า no credential=401, Basic/Bearer ผ่าน middleware, health/webhook exempt และ agent `downloadFile` ส่ง Bearer; server suiteบน disposable PostgreSQLผ่าน 31/31 สองรอบ. ไม่ได้ replay upload→real-file download curl matrix ทั้งชุดแยกจาก automated tests ในรอบ Codex นี้ จึง corroborate กลไกสำคัญแต่ไม่อ้างว่า reproduce byte-size 6965 ตาม work log |
| S3 — Codex docs re-review | `ARCHITECTURE.md`, `docs/10-print-agent-tasks.md`, `print-agent/README.md` | ตรวจเอกสาร security/deploy และ consistency | Codex | 2026-07-27 | **ไม่ผ่าน** — **แก้แล้ว (R9) รอ re-verify** | ส่วน `appAuth`/env/deploy ใน ARCHITECTURE และ docs/10 ตรง implementation แต่ acceptance ให้ตรวจ `print-agent/README.md` ว่าไม่ขัดของจริง ซึ่ง~~ไม่ผ่าน: README ยังอธิบาย whole-queue wait และ manual stale-lock cleanup แบบก่อน R4/R5~~. **แก้แล้ว (R9, 2026-07-27):** ดูรายละเอียดที่แถว Task 8 ด้านบน |
| R7 — Codex re-verify รอบ 4 | `server/src/db/repositories/printJobRepository.js`, `server/src/services/printAgentService.js`, `server/tests/print-job-db.test.js`, `server/tests/agent-api.test.js` | ตรวจ claim queued row + lifecycle เดิมบน PostgreSQL จริง | Codex | 2026-07-27 | **ผ่านมีข้อสังเกต** — **R10+R11 แก้แล้ว รอ re-verify** | บั๊กเดิมแบบ single-agent แก้จริง: reproduce แยกได้ `sameRow=true`, row เดิมเปลี่ยนเป็น `completed`, row count คง 1 และ `returnsAfterComplete=false`; regression suite รอบแรกผ่าน 33/33. แต่พบ 2 ข้อที่ต้องบันทึก: ~~(1) server suite รอบสองบน DB เดิมได้ 32/33 เพราะ HTTP regression test assert `queue.length === 1` ทั้งระบบ ขณะ test files รันขนานและมี queued row ของ test อื่นชั่วคราว — เป็น test isolation/flakiness (รอบแรกผ่าน รอบสอง fail `2 !== 1`), ควร assert เฉพาะ record id แทน~~; ~~(2) claim ยัง **ไม่ปลอดภัยเมื่อหลาย caller แข่งกัน** ตามข้อความใน docs/10: reproduce `Promise.all` สอง agent แล้ว caller แรก claim row เดิม ส่วน caller ที่ `SKIP LOCKED` ไม่เจอ row fallback ไป `createPrintJob` จนมี 2 queued rows (`agent_host=A/B`, attempt 1/2) และอาจปริ้นซ้ำ~~. **แก้แล้ว (R10, 2026-07-27):** เปลี่ยน assertion เป็นเช็คเฉพาะ record id ของตัวเอง ไม่เช็ค queue.length ทั้งระบบ — ยืนยันด้วยการรัน suite **3 รอบติดกันบน DB เดิมไม่ reset → 34/34 pass ทุกรอบ** ไม่ flaky อีก. **แก้แล้ว (R11, 2026-07-27):** Sonnet 5 reproduce race นี้ซ้ำเองด้วย `Promise.all` ยิง HTTP request สองอันพร้อมกันจริงก่อนแก้ (ไม่เชื่อ Codex เฉยๆ) ยืนยันเจอ 2 แถวจริงตรงตามที่ Codex รายงาน แล้วเพิ่ม `pg_advisory_xact_lock(hashtext(processingRecordId))` ล็อกทั้งขั้นตอน claim-or-create ต่อ record ใน `printAgentService.createAgentPrintJob` + เช็ค active job ที่มีอยู่ก่อนสร้างใหม่ (กันเคส caller ที่สองมาถึงหลัง caller แรก commit ไปแล้ว) เพิ่ม regression test ยิง 2 request พร้อมกันจริงยืนยันว่าได้ job เดียวกันและมีแค่ 1 แถว → ผ่าน. รายละเอียดเต็มอยู่ใน `docs/10-print-agent-tasks.md` หัวข้อ "ประเด็นจากรีวิวรอบ 4" |
| R8 — Codex re-verify รอบ 4 | `server/src/services/processingRecordService.js` | ตรวจ transaction ปกติและบังคับ insert fail เพื่อพิสูจน์ rollback | Codex | 2026-07-27 | **ผ่าน** | ใช้ DB client เดียวกันสำหรับ `BEGIN` → update record → create job → `COMMIT`, rollback/release ครบ. ทดสอบจริงโดยให้ metadata.outputFileId เป็น UUID ผิดรูปเพื่อบังคับ INSERT fail: หลัง error record ยัง `printed=true`, `lastAction` ค่าเดิม และ active job count=0 ยืนยันว่าไม่เหลือ state ครึ่งกลาง |
| R9 — Codex re-verify รอบ 4 | `print-agent/README.md` | ตรวจ 2 ข้อความเทียบ R4/R5 implementation | Codex | 2026-07-27 | **ผ่าน** | README เปลี่ยนเป็นรอเฉพาะ job ของเอกสารตัวเองและอธิบาย PID-based stale-lock auto-reclaim ตรงกับโค้ดแล้ว; S3 documentation finding เดิมส่วนนี้ปิดได้ |

| R10 — Codex re-verify รอบ 5 | `server/tests/agent-api.test.js` | ตรวจแก้ flaky assertion + รัน suite ซ้ำบน DB เดิม | Codex | 2026-07-27 | **ผ่าน** | assertion เปลี่ยนมา `find` เฉพาะ `processingRecordId` ของ test ตัวเองถูกต้อง; รัน server suite บน disposable PostgreSQL ฐานเดิม 3 รอบติดกันผ่าน 34/34 ทุกครั้ง ไม่พบ flaky failure เดิม |
| R11 — Codex re-verify รอบ 5 | `server/src/services/printAgentService.js`, `server/tests/agent-api.test.js` | ตรวจ advisory-lock concurrency ทั้ง DB ownership และผลที่ agent caller ได้รับ | Codex | 2026-07-27 | **ไม่ผ่าน** — **แก้แล้ว (R12, 2026-07-27) รอ re-verify** | advisory transaction lock แก้ duplicate **DB row** จริง: stress 10 concurrent callers × 10 รอบได้ `uniqueResultIds=1`, `rowCount=1`, ใช้ admin row เดิมทุกครั้ง. ~~แต่ยังไม่กัน duplicate **physical print**: caller ที่แพ้ lock ถูกคืน active job เดิมด้วย HTTP 201 เหมือนเป็นผู้ claim สำเร็จ (`return activeJobs[0]`), และ `print-agent/processDocument` ไม่ตรวจว่า `job.agentHost` เป็นของตนหรือมี `claimed` flag จึงทุก caller จะเดินต่อ download/convert/print job เดียวกันได้. Test ใหม่ยืนยันเพียง "same id/one row" จึงให้ผลผ่านแม้ agent สองตัวปริ้นเอกสารเดียวกันพร้อมกัน. ต้องให้มี owner เดียวเดินต่อได้จริง เช่น second caller ได้ 409/`claimed:false` แล้ว agent skip หรือใช้ idempotency/claim token ที่ตรวจ ownership; จากนั้น test ต้อง assert ว่ามีเพียง caller เดียวได้รับสิทธิ์ process ไม่ใช่แค่ได้ job id เดียวกัน~~ **แก้แล้ว (R12, 2026-07-27):** เจ้าของ reproduce ซ้ำเองแล้วยืนยัน (10 concurrent callers ทั้งหมดได้ HTTP 201 กับ job เดียวกัน) ก่อนแจ้งกลับมา — Sonnet 5 reproduce ซ้ำอีกครั้งได้ผลตรงกัน ก่อนแก้: เปลี่ยน `createAgentPrintJob`'s "มี active job อยู่แล้ว" branch จาก `return activeJobs[0]` (คืนความสำเร็จปลอมให้ผู้แพ้) เป็น `throw conflict(...)` → **HTTP 409** พร้อม `error.code = 'CONFLICT'`; แก้ `print-agent/src/index.js`'s `processDocument` ให้ดักจับ `error.status === 409` จาก `api.createPrintJob` แล้ว log ว่า "ถูกเจ้าของอื่นถือไปแล้ว — ข้าม" คืน `{ ok: true }` (ไม่ crash ทั้ง `runOnce`, ไม่ download/convert/print เอกสารนั้น). เปลี่ยน regression test เดิม (row 47 นี้เอง ก่อน strikethrough) ให้ assert ว่ามี **winner เดียว (201)** และ **loser เดียว (409)** อย่างชัดเจน แทนที่จะเช็คแค่ "job id เดียวกัน"; เพิ่ม test ใหม่ใน `print-agent/tests/index.test.js` ยืนยันว่า `runOnce` เจอ 409 แล้ว skip เอกสารนั้นโดยไม่เรียก download/print/complete เลยและไม่ throw ออกมา. ผลทดสอบ: server พร้อม Docker Postgres จริง **3 รอบติดกันบน DB เดิมไม่ reset → 34/34 pass ทุกรอบ** (รวม test ใหม่); print-agent → 29/29 pass (เพิ่มจาก 28); client 8/8. รายละเอียดเต็มอยู่ใน `docs/10-print-agent-tasks.md` หัวข้อ "ประเด็นจากรีวิวรอบ 6" |

| R12 — Codex re-verify รอบ 7 | `server/src/services/printAgentService.js`, `server/tests/agent-api.test.js`, `print-agent/src/index.js`, `print-agent/tests/index.test.js` | ตรวจ single-owner response semantics + loser agent ต้องไม่ปริ้น | Codex | 2026-07-27 | **ผ่าน** | server เปลี่ยน active-job loser เป็น `CONFLICT`/HTTP 409 จริงและ transaction rollback/release ครบ; agent จับ 409 เฉพาะ create-job แล้ว return `{ ok:true }` เพื่อ skip เอกสารนั้นและเดินเอกสารอื่นต่อ โดยไม่ download/update/convert/print/complete. รัน server 34/34 สามรอบติดกันบน disposable PostgreSQL ฐานเดิมผ่านทั้งหมด; stress HTTP 10 callers พร้อมกันได้ 1×201 + 9×409 (`CONFLICT`), DB 1 row และ winner ใช้ queued row เดิม; print-agent 29/29 และ client 8/8 ผ่าน. R11 duplicate physical-owner finding ปิดได้แล้ว. ข้อสังเกตเล็กน้อย: agent ตีความ 409 ใดๆ จาก create-job ว่า ownership conflict ตาม API ปัจจุบัน ซึ่งถูกต้องกับ implementation ตอนนี้; หาก endpoint เพิ่ม conflict ชนิดอื่นในอนาคตควรส่ง/ตรวจ error code เฉพาะ |
| Shared-backend port — Codex blind review | `currentSC-official-website-project/backend/src/modules/seamless/**`, backend integration/config/tests/docs, `client/src/services/api.js` | เปิดอ่านไฟล์ port จริง เทียบ source เดิม ตรวจ auth/route/storage/migration/test isolation และทดสอบ HTTP + PostgreSQL จริง | Codex | 2026-07-27 | **ไม่ผ่าน** | ส่วนสำคัญที่อ้างไว้ผ่านจริง: migration SQL 3 ไฟล์ hash ตรง source และ migrate รอบสอง skip ทั้งหมด; module require ได้ครบ; route ไม่ชน legacy; CORS ใช้ explicit allowlist พร้อม credentials; R2/email ใช้ `SEAMLESS_*` namespace; `processingRecords.mapRecord` export แล้ว; seamless Jest 13/13 ผ่าน 3 รอบติดกันบน PostgreSQL ฐานเดิม, full backend 73 passed/5 skipped/0 failed, client 8/8; live R12 10 concurrent ได้ 1×201 + 9×409 และ DB มี row เดียว. **แต่พบ security regression ที่ต้องแก้ก่อน commit/deploy:** `routes/index.js` mount `/workbooks` โดย `workbookRoutes.js` ไม่มี `appAuth` ต่างจาก app เดิมที่ middleware ครอบ upload route ด้วย; ยิง `POST /api/workbooks/process` โดยไม่มี credential ผ่านถึง controller และตอบ 400 “At least one workbook file is required” แทน 401 จึงแปลว่า client ใดๆ ที่เข้าถึง service สามารถส่ง workbook ให้ระบบทำงาน/เขียน DB/storage ได้โดยไม่ต้องยืนยันตัวตน (CORS ไม่ใช่ auth และกัน curl/server-to-server ไม่ได้). ควรใส่ `appAuth` ที่ workbook router/mount และเพิ่ม integration test ว่า no auth=401, Basic/Bearer ผ่าน. จุดที่ยัง unverified ตามธรรมชาติของ pre-deploy: production migration เป็น no-op, Render env จริง, LINE webhook URL จริง และเครื่อง 000/เครื่องพิมพ์จริง |
| R13 — Shared-backend workbook appAuth fix | `currentSC-official-website-project/backend/src/modules/seamless/routes/workbookRoutes.js`, `middleware/appAuth.js`, `tests/seamless-app-auth.test.cjs` | ปิด unauthenticated workbook upload โดยไม่ครอบ auth ไปยัง shared routes อื่น และเพิ่ม route-level regression tests | Codex | 2026-07-27 | **ผ่าน** | อ่าน `ARCHITECTURE.md` ต้นทางแล้วคงหลักการเดิมว่า workbook upload เป็น human-app endpoint ที่ต้องยืนยันตัวตน แต่ mount `appAuth` เฉพาะใน `workbookRoutes` ของ Seamless เพื่อไม่กระทบฟีเจอร์สาธารณะอื่นใน shared backend; middleware อยู่ก่อน `multer` จึง reject ก่อนรับ/parse upload. Test route จริงยืนยัน no credential=401 + `WWW-Authenticate`/`UNAUTHORIZED`, Basic ถูกและ Bearer ถูกผ่าน auth แล้วถึง validation เดิม=400. `seamless-app-auth` 8/8 ผ่าน, full backend 76 passed/5 skipped/0 failed และ client 8/8 ผ่าน. ไม่ลบ/แทนที่ config, route, ค่า หรือ business logic เดิม |
| R13 — Sonnet 5 independent cross-check (blind re-review ก่อน commit, สโคปเฉพาะ R13) | `backend/src/modules/seamless/routes/{workbookRoutes,index}.js`, `middleware/{appAuth,errorHandler}.js`, `tests/seamless-app-auth.test.cjs`, `server.js` | ตรวจซ้ำแบบอิสระว่า fix ของ Codex (แถวบน) ถูกต้องจริง ไม่ใช่แค่เชื่อผลที่ Codex เขียนไว้เอง | Sonnet 5 | 2026-07-27 | **ผ่าน — พร้อม commit** | เปิดโค้ดจริงทุกไฟล์ที่ระบุ (ไม่อ่านแค่ ledger/docs) ยืนยัน: `workbookRoutes.js` มี `router.use(appAuth)` ก่อน `router.post("/process", upload.any(), ...)` จริง (auth มาก่อน multer), `routes/index.js` mount `/workbooks` เป็นส่วนหนึ่งของ seamless sub-router เดิม ไม่ได้แก้ลำดับ mount หรือ scope อื่น, `appAuth.js` แก้แค่ comment (เพิ่ม `/api/workbooks/*` ในลิสต์เส้นทางที่ป้องกัน) ตรรกะ Basic/Bearer เดิมไม่เปลี่ยน, `errorHandler.js` ไม่ถูกแตะเลย, `server.js` mount `/api` → seamless router เดิมจุดเดียว ไม่มี route ใหม่ชนกับของเดิม. รันเทสเองจริง: `npx jest --runInBand tests/seamless-app-auth.test.cjs` → 8/8 ผ่าน; `npx jest --runInBand` (ทั้ง backend) → 9/10 suites (1 skip เดิมจากเหตุผลเดียวกับก่อนหน้า, ไม่เกี่ยว R13) 76/81 tests ผ่าน 5 skip (agent-api ที่ต้องมี `DATABASE_URL` override) 0 fail — เทียบกับก่อน R13 (73/78) ต่างกันพอดี +3 เทสใหม่ ไม่มี regression. Start server จริงด้วย `SEAMLESS_APP_BASIC_USER`/`PASSWORD`/`SEAMLESS_INTERNAL_API_TOKEN` แล้วยิง curl สดยืนยันครบ 8 เคส: (1) no-auth POST `/api/workbooks/process` → `401` พร้อม `WWW-Authenticate: Basic realm="ClaspSCxSeamless"` และ body `{"error":{"message":"Authentication required.","code":"UNAUTHORIZED"}}` ก่อนถึง multer/controller จริง (2) Basic ถูก ไม่แนบไฟล์ → `400` `"At least one workbook file is required."` (พิสูจน์ auth ผ่านแล้วถึง validation เดิม ไม่ใช่ auth block) (3) Bearer ถูก ไม่แนบไฟล์ → `400` แบบเดียวกัน (4) Basic ผิด → `401` (5) Bearer ผิด → `401` (6) `/api/health` → `200` ไม่กระทบ (7) `/api/auth/ping` (public route อื่นของ shared backend) → `200` ไม่ถูกล็อกโดยไม่ตั้งใจ (8) LINE webhook ลายเซ็นผิด → `401` ตามกลไก HMAC เดิม ไม่เกี่ยว appAuth. ตรวจ diff เพิ่มเติมด้วยการอ่าน `workbookController.js`/`workbookService.js` เต็มไฟล์เทียบกับที่เขียนไว้ตอน port ครั้งแรก — **ตรงกันทุกบรรทัด ไม่มีการแก้ business logic เลย**. สรุป: R13 ปิดช่องโหว่ได้จริงตามที่ Codex รายงาน ไม่มี blocker ไม่มีผลข้างเคียงต่อ route อื่น พร้อม commit จากมุมนี้. **ยังไม่ได้ตรวจจริง (นอกสโคป R13 รอบนี้):** production migration/env จริงบน Render, LINE webhook URL จริง, เครื่อง 000/เครื่องพิมพ์จริง — ตรงกับที่แถว "Shared-backend port" ด้านบนระบุไว้แล้วว่า unverified ตามธรรมชาติของ pre-deploy |

| Deployment audit หลัง R13 | Render services/env-name inventory + live health/bootstrap GET และ production migration (ไม่แสดง secret) | ตรวจ prerequisite ก่อน merge branch ที่ทำให้ `SC-official-website` auto-deploy | Codex | 2026-07-27 | **ยังไม่พร้อม deploy — migration ผ่านแล้ว** | GitHub code พร้อมและเปิด Draft PR แล้ว แต่ Render state ไม่ตรง docs เดิม: `claspscxseamless-web` มีอยู่จริง/ไม่ suspended, health=200 และ bootstrap แบบ no-auth=200 เพราะไม่มี Basic Auth env; shared service health=200 และมี DB/schema แต่ยังขาด `SEAMLESS_APP_BASIC_USER/PASSWORD` รวมถึง LINE/R2/email config. รัน `npm run seamless:migrate` กับ production สำเร็จ โดย 001–003 skip เป็น already-applied ทั้งหมด (no-op ตามคาด). ยังไม่ merge เพื่อไม่ให้ auto-deploy โมดูลแบบ default-off ที่เปิดโล่ง; ไม่หยุด service เก่าจนกว่าจะยืนยัน traffic/การใช้งาน. ต้องตั้ง credentials ก่อน แล้วค่อย merge และ smoke test |

| Production deploy หลัง R13 | GitHub PRs, Render shared backend/static site, env aliases, migration และ live smoke tests | deploy โดยปิด service เก่าแบบ recoverable และยังไม่เปิด scheduled auto-print | Codex | 2026-07-27 | **ผ่าน — web/API production live** | suspend service เก่าแล้ว (503); merge backend PR #2 (`e49f29f`) และ client/docs PR #1 (`bdef288`); production migrations 001–003 no-op; backend/static site live; Basic/Bearer/workbook/agent/LINE-invalid-signature/CORS smoke matrix ผ่านครบ. LINE target ID ยังไม่มีจึง notify skip; R2/email optional config และ physical print บนเครื่อง 000 ยังไม่ verified/ไม่เปิดใช้งาน |

## จุดที่ผู้ implement (Sonnet 5) อยากให้ผู้รีวิวเพ่งเป็นพิเศษ

- **Task 3**: เงื่อนไข SQL ใน `listPrintQueueCandidates` (printJobRepository.js) ที่กันไม่ให้ agent เจอ record ซ้ำ (`NOT EXISTS ... AND pj2.agent_host IS NOT NULL`) — ตรรกะนี้ตั้งใจให้ job ที่ admin เพิ่ง queued (ยังไม่มี agent_host) ยังโผล่ใน queue ได้ แต่ job ที่ agent คว้าไปแล้ว (มี agent_host) ไม่โผล่ซ้ำ — ควรตรวจว่าตรงกับที่ docs/09 ตั้งใจจริงไหม
- **Task 3**: `tests/agent-api.test.js` จงใจ skip เคส "print-queue ตอบ []" เมื่อไม่มี `TEST_DATABASE_URL` เพราะ production DB (`server/.env`) ยังไม่ได้ migrate ตาราง `print_jobs` — ตรวจว่าการ skip นี้สมเหตุสมผลและไม่ได้ซ่อนบั๊กจริง
- ทุก task ที่แตะ DB: ตรวจว่าไม่มี path ไหนหลุดไปยิง production จริงระหว่างเทส (ดู `server/.env` มี `SC_OFFICIAL_SUPABASE_DATABASE_URL` ตั้งอยู่แล้ว ซึ่งชนะค่า override แบบ `process.env.DATABASE_URL = ...` ในโค้ดเทสถ้าไม่ได้ override ตัวแปรนี้ตรงๆ)
- **Task 4**: `POST /api/line/webhook` **ไม่มี** `internalApiAuth` ข้างหน้า (ตั้งใจ — LINE server เป็นคนยิงเข้ามาเอง ไม่มี Bearer token ของเรา) ป้องกันด้วย HMAC signature (`x-line-signature`) แทน — ตรวจว่าการเปิด endpoint นี้แบบ public (แต่ verify signature) ปลอดภัยพอ ไม่รั่วอะไรออกไปแม้ signature ผิด (ตอบแค่ 401 เปล่าๆ)
- **Task 4**: `express.json()` ใน `app.js` เพิ่ม `verify` hook เก็บ `req.rawBody` ให้**ทุก route** (ไม่ใช่แค่ `/api/line/webhook`) เพื่อเลี่ยงปัญหา raw-body-vs-json-parser — เป็น overhead เล็กน้อยทุก request ควรตรวจว่ายอมรับได้และไม่กระทบ endpoint อื่น
- **Task 4**: `tests/line-notify.test.js` จงใจตั้ง `SC_OFFICIAL_SUPABASE_DATABASE_URL`/`DATABASE_URL` เป็น connection string ที่ต่อไม่ได้ (`127.0.0.1:1`) ตั้งแต่บรรทัดแรก แล้วอาศัยว่า `operationLogRepository.logOperation` swallow DB error อยู่แล้วเพื่อให้ webhook ยังตอบ 200 — ตรวจว่า pattern นี้ไม่ได้ซ่อนบั๊กจริงของการเขียน log (เช่นลอง unit-test `logOperation` เองแยกถ้าสงสัย) และ genuinely ไม่แตะ production
- **Task 6**: `--dry-run` ออกแบบให้ข้าม **ทุก** side-effect ต่อ API จริง (ไม่ใช่แค่ข้ามคำสั่งปริ้นทางกายภาพ) — เรียกแค่ `GET /print-queue` ตัวเดียวแล้ว log ว่าจะทำอะไรต่อรายเอกสาร ไม่สร้าง/แก้ `print_jobs` จริงเลย ตีความจากสเปกข้อ 5 + acceptance ("รันจบโดยไม่ crash เมื่อชี้ API ปลอม/ไม่มี server") — ควรตรวจว่าตีความแบบนี้ตรงกับที่ตั้งใจไว้ตอนทำ Task 7 (end-to-end บนเครื่อง dev) หรือควรให้ dry-run ยัง download+convert จริงเพื่อทดสอบ pipeline มากกว่านี้
- **Task 6**: test "acquireLock prevents two concurrent runOnce calls" อาศัยพฤติกรรม JS ที่ `Promise.all([fnA(), fnB()])` เรียก `fnA()` ให้ทำงาน sync จนถึง await แรกก่อน แล้วค่อยเรียก `fnB()` — เป็นพฤติกรรมที่ spec รับรอง (ES2015 array-literal evaluation order) แต่เป็น implementation detail ที่ค่อนข้าง fragile ถ้ามีคน refactor `runOnce`/`acquireLock` ให้มี await ก่อนเรียก `acquireLock` เมื่อไหร่ test นี้จะ false-negative (ผ่านทั้งที่ lock พังจริง) — ควรพิจารณาว่าคุ้มไหมที่จะ mock เวลาแทน
- **Task 6**: `src/print.js`/`getPrintJobs` เรียก PowerShell `Get-PrintJob` จริงไม่ได้ทดสอบ — เทสครอบแค่ `parseGetPrintJobOutput` (การ parse JSON string) ไม่ได้รันคำสั่ง PowerShell จริงเลยเพราะเครื่อง dev ไม่มี printer/print job ให้ทดสอบ ต้องรอ Task 7 (บนเครื่อง dev มี printer จริงหรือ virtual printer) หรือ deploy จริงบนเครื่อง 000 ถึงจะยืนยันได้ว่า `Get-PrintJob -PrinterName X | ConvertTo-Json -Compress` ให้ output ตรงกับที่ `parseGetPrintJobOutput` คาดไว้จริง (โดยเฉพาะ field name แบบ single-object vs array เมื่อมี job เดียว) — **ยังไม่ได้ยืนยันหลัง Task 7 ด้วย** เพราะเครื่อง dev ที่ทำ Task 7 ก็ไม่มี LibreOffice/SumatraPDF เหมือนกัน ยังเป็น gap รอเครื่อง 000 จริง
- **Task 7**: การ "รัน print-agent จริง" ทำแค่ครึ่งเดียว — `node src/index.js --dry-run` เป็น process จริงที่เรียก `GET /print-queue` จริง แต่ส่วน `POST /print-jobs` → `PATCH` → `POST /complete` ถูกจำลองด้วย `curl` มือ (ไม่ใช่ agent process เดินเองจนจบ) เพราะ `--dry-run` design (Task 6) ตั้งใจสกัด API mutation ทั้งหมดออกไป — วิธีนี้ยืนยัน backend integration ได้ครบจริง แต่**ไม่ได้ยืนยันว่า `src/index.js` (โหมดไม่ dry-run) เดินโค้ด create→download→convert→print→PATCH ครบทุกบรรทัดจริงแบบ end-to-end ในกระบวนการเดียว** (การ convert/print ยังไม่เคยถูกเรียกจริงเลยแม้แต่ครั้งเดียวนอก unit test) — ยังต้องรอเครื่อง 000 (หรือเครื่อง dev ที่มี LibreOffice+SumatraPDF) ถึงจะเห็น `runOnce({ dryRun: false })` ทำงานครบวงจรจริง

## คำขอรีวิวก่อน commit/push (Codex, blind แต่มีบริบท) — เพิ่ม 2026-07-27

เจ้าของโปรเจกต์ขอให้อีก AI (Codex) เข้ามา corroborate งานทั้งหมดใน ledger นี้ก่อนจะ commit/push จริง — **นี่คือรีวิวรอบสุดท้ายก่อนของขึ้น git** ไม่ใช่แค่รีวิว task เดียว

**Scope ที่ต้องรีวิว** (ทุกอย่างยังไม่ commit เลยสักตัว — ทำงานอยู่บน working tree ล้วนๆ):
- Tasks 1-8 ทั้งหมดใน `docs/10-print-agent-tasks.md` (auto-print agent + LINE notify)
- R1-R6 (บั๊ก fix จากรีวิวรอบ 1-2 ของ Fable) — ดูรายละเอียดใน docs/10 หัวข้อ "ข้อแก้ไขจากรีวิวอิสระ" และ "ประเด็นเสนอจากรีวิวรอบ 2"
- S1-S3 ใน `docs/12-security-hardening-tasks.md` (auth middleware `appAuth` ปิดช่องโหว่ P1/P2)

**Scope ที่ไม่ต้องรีวิว (นอกเรื่อง):** `git status` ตอนนี้มีไฟล์อื่นที่แก้ไว้ก่อนหน้าไม่เกี่ยวกับงานชุดนี้เลย — `server/src/services/emailService.js`, `server/src/services/r2StorageService.js`, `server/src/controllers/fileController.js`, `server/src/controllers/workbookController.js`, `server/src/db/repositories/generatedFileRepository.js`, `server/src/services/fileStorageService.js`, `server/src/services/workbookService.js`, `server/src/utils/validators.js`, `server/package.json`, `package-lock.json` — เป็นงาน email/R2 storage คนละ feature ที่ implementer ไม่ได้แตะเลยในบทสนทนานี้ ไม่ต้องเสียเวลารีวิวพวกนี้

**วิธีรีวิวแบบ blind-but-informed:**
1. อ่าน `docs/09-auto-print-agent-design.md` (spec ต้นทาง) ก่อน เพื่อรู้ว่า "ถูก" ควรเป็นแบบไหน — **อย่าอ่านแค่ work log ของ Sonnet ในไฟล์ 10/12 แล้วเชื่อตาม** ให้เปิดโค้ดจริงเทียบกับ spec เองทุกจุด
2. เช็คตารางรีวิวด้านบน — Task 1,3,4,5,7 มี Fable รีวิวแล้วว่า "ผ่าน"; Task 2/6 มี R1-R6 ที่ Fable เจอบั๊กแล้ว Sonnet แก้ (มีคำว่า "แก้แล้ว รอ re-verify") — **จุดนี้สำคัญที่สุดที่ต้อง verify จริง**: อ่านโค้ดที่แก้ + รันเทสเองว่าที่ Sonnet claim ว่าแก้แล้วนั้นแก้จริงไหม; Task 8, S1, S2, S3 ยังไม่มีใครรีวิวเลย
3. รันเทสจริงทุก suite (`npm test` ใน `server/`, `npm --prefix client test`, `npm test` ใน `print-agent/`) — อย่าเชื่อตัวเลข pass/fail ที่จดไว้ในไฟล์ ให้รันเองซ้ำตามหัวข้อ "สภาพแวดล้อมทดสอบ" ใน docs/10 (ต้องมี Docker Desktop เปิดอยู่สำหรับเทสที่ต้อง DB)
4. ประเด็นที่ Sonnet เองยังไม่มั่นใจเต็มที่และอยากให้เพ่งเป็นพิเศษ (นอกเหนือจากที่แต่ละ task ระบุไว้แล้ว): (a) `print-agent`'s `Get-PrintJob`/PowerShell integration ไม่เคยรันจริงบนเครื่องที่มี printer เลย ยังเป็น unit-test-only, (b) `waitForSpecificJobToClear`/`detectNewSpoolerJobId` (R5 fix) ไม่เคยเห็นทำงานกับคิว printer จริง, (c) test "acquireLock prevents two concurrent runOnce" อาศัย JS evaluation-order behavior ที่ fragile ตามที่จดไว้ในข้อ 41 ด้านบน
5. เติมผลไว้ในตารางด้านบน (Task 8, S1, S2, S3) ตามฟอร์แมตเดิม — ถ้าเจอว่า R1-R6 บางข้อยังไม่ได้แก้จริงตามที่ claim ไว้ ให้ mark กลับเป็น "ไม่ผ่าน" พร้อมเหตุผล **อย่าลบ/แก้ข้อความเดิมที่ Fable หรือ Sonnet เขียนไว้ ให้เพิ่มต่อท้ายเท่านั้น (ใช้ ~~strikethrough~~ ถ้าจะ mark ว่าล้าสมัย ตาม convention เดิมของไฟล์นี้)**

**หลังจาก Codex รีวิวเสร็จ:** เจ้าของจะเอาผลลัพธ์ไปให้ Sonnet 5 อ่านและประเมิน/แย้งอีกรอบก่อนตัดสินใจว่าจะแก้อะไรเพิ่มก่อน commit หรือไม่ — Codex ไม่ต้องแก้โค้ดเอง (เหมือนกติกาเดิมของ ledger นี้ข้อ 5-6 ด้านบน)

## Work log ของผู้ดูแล ledger

- 2026-07-24 — สร้างไฟล์นี้ (Sonnet 5) หลัง Task 1-3 เสร็จ เพื่อให้ session อื่นมารีวิวย้อนหลังได้ ยังไม่มีใครรีวิวจริง
- 2026-07-24 — เพิ่มแถว Task 4 หลัง implement เสร็จ (Sonnet 5)
- 2026-07-24 — Fable รีวิว Task 1-4: Task 1 ผ่าน, **Task 2 ไม่ผ่าน** (บั๊ก `requeueStaleJobs` ไม่ล้าง `agent_host`), Task 3/4 ผ่านมีข้อสังเกต (test isolation ใน Task 3, timezone bug ใน Task 4) — รายละเอียดเต็มอยู่ในตารางด้านบนและ `docs/10-print-agent-tasks.md` หัวข้อ "ข้อแก้ไขจากรีวิวอิสระ"
- 2026-07-24 — Sonnet 5 แก้ทั้ง 3 ข้อ (R1/R2/R3 ใน docs/10) แล้ว: (1) `requeueStaleJobs` เซ็ต `agent_host = NULL` เมื่อ requeue + สแกน `queued`+`agent_host` เป็น stale ด้วย, เพิ่ม test ยืนยันด้วย Docker Postgres จริง (23/23 pass) (2) `lineNotifyService.formatTimestamp` เปลี่ยนไปใช้ `Intl.DateTimeFormat` timezone `Asia/Bangkok` (3) `app-request-print.test.js` ห่อด้วย `try/finally` ลบข้อมูลที่สร้างเสมอ — ยืนยันด้วยการรัน `npm test` ซ้ำ 2 รอบติดกันบน DB เดิม (ไม่ reset) ผ่านทั้งคู่ 23/23. **รอ Fable (หรือ session อื่น) กลับมา re-verify แล้วอัปเดตผลตัดสินในตารางด้านบนเป็น "ผ่าน"** ก่อนเริ่ม Task 7 (end-to-end) จริง — ยังไม่ได้แก้คอลัมน์ผลตัดสินเดิมเองเพราะเป็นสิทธิ์ของผู้รีวิว
- 2026-07-24 — เพิ่มแถว Task 6 หลัง implement เสร็จระหว่าง autonomous loop tick (Sonnet 5) — Task 5 ยังไม่มีใครรีวิว, Task 6 ก็เช่นกัน รอคิว
- 2026-07-24 — เพิ่มแถว Task 7 หลังทำ end-to-end integration check เสร็จ (Sonnet 5) — ไม่มีโค้ดใหม่ ผลตรวจเต็มอยู่ใน docs/10 ใต้ Task 7 — สำคัญ: ยัง**ไม่ได้**รัน `print-agent` โหมดจริง (ไม่ dry-run) เพราะเครื่อง dev ไม่มี LibreOffice/SumatraPDF ดู "จุดที่อยากให้เพ่ง" ด้านบนสำหรับรายละเอียด gap ที่เหลือ
- 2026-07-24 — เพิ่มแถว Task 8 (Sonnet 5) — **Task 1-8 ใน docs/10 ติ๊กครบหมดแล้ว, สถานะบนสุดของไฟล์นั้นเปลี่ยนเป็น "เสร็จแล้ว"** แต่ ledger นี้ยังมีงานค้าง: R1/R2/R3 (Task 2/3/4) รอ re-verify, Task 5/6/7/8 ยังไม่มีใครรีวิวเลยสักตัว — ผู้ที่มารีวิวควรเริ่มจาก R1 (บั๊กจริงที่เคยพบ) ก่อน แล้วค่อยไล่ Task 5→8
- 2026-07-24 — Sonnet 5 อ่าน "ประเด็นเสนอจากรีวิวรอบ 2" (R4-R6, Task 6) แล้วประเมินเองทีละข้อ (ไม่ใช่แค่เชื่อ Fable) — สรุป: **เห็นด้วยทั้ง 3 ข้อว่าเป็นบั๊กจริง, R4 มีวิธีที่ดีกว่าที่เสนอ (PID-liveness check แทน time threshold), R5 ยืนยันเพิ่มด้วยว่าเป็นการเบี่ยงจาก spec เดิม (docs/09 §5.1/5.3) ไม่ใช่แค่ edge case ใหม่, R6 ใช้ทางประนีประนอมที่ Fable เสนอเอง**. คำถามเรื่อง "เครื่องมีคนใช้ปริ้นร่วมไหม" ที่เจ้าของทิ้งไว้ไม่มีคำตอบ ไม่กระทบข้อสรุปเพราะหลักฐาน 25 stuck jobs พิสูจน์แล้วว่า R5 เป็น guaranteed failure อยู่ดีไม่ว่าคำตอบจะเป็นอะไร. Implement ครบทั้ง 3 ข้อใน `print-agent/src/{lock,print,index}.js` + เพิ่ม `tests/lock.test.js` ใหม่ + แก้ `tests/print.test.js` — ระหว่างเขียนเทสเจอบั๊กที่ผมพลาดเองในร่างแรกของ R4 (`existingPid !== process.pid` ทำให้ self-PID ถูกมองว่า reclaimable ผิดๆ) แก้ก่อนส่งแล้ว. ผลทดสอบ: `npm test` ใน `print-agent/` → 28/28 pass (จาก 19). รายละเอียดเต็มอยู่ใน docs/10 หัวข้อ "ประเด็นเสนอจากรีวิวรอบ 2" ท้าย R6. รอ Fable (หรือ session อื่น) re-verify
- 2026-07-24 — เพิ่มแถว S1 (`docs/12-security-hardening-tasks.md`, checklist ใหม่แยกจาก docs/10) — เจ้าของขอให้ทบทวนความปลอดภัยหลัง WP08 จบ พบช่องโหว่จริง 2 จุด (P1: `/api/app/*` เปิดโล่งรวมถึง `request-print` ที่สั่งปริ้นจริงได้จากคนนอก, P2: `/api/files/*` เปิดโล่ง+file id รั่วจาก P1) → ออกแบบ + implement middleware `appAuth` (Basic สำหรับมนุษย์ OR Bearer เดิมสำหรับ agent) ตามที่ตกลงกันไว้ใน "บริบทและการตัดสินใจ" ของ docs/12. Task S1 เสร็จแล้ว (8 tests ใหม่ผ่าน, เทสเดิมทั้ง server/client/print-agent ไม่ต้องแก้เลยเพราะ default-off) เหลือ S2 (integration matrix จริงด้วย curl) และ S3 (docs)
- 2026-07-27 — เพิ่มแถว S2 หลังยืนยัน integration จริงด้วย curl เสร็จ (Sonnet 5) — ไม่มีโค้ดใหม่ ผลตรวจเต็มอยู่ใน docs/12 ใต้ Task S2 — matrix ผ่านครบทุกช่อง (401 ตอนไม่มี credential, 200 ตอน Basic ถูกทุกจุดรวม upload/request-print จริง, Bearer agent เจอ queue **และโหลดไฟล์จริงผ่าน downloadUrl ได้ด้วย Bearer เดียวกัน** ซึ่งเป็นจุดที่สำคัญที่สุดของ P2 ฝั่ง agent, `print-agent --dry-run` ชี้ server จริงผ่านปกติ). เหลือแค่ S3 (docs) ก่อน docs/12 จะเสร็จครบ
- 2026-07-27 — เพิ่มแถว S3 (Sonnet 5) — **Task S1-S3 ใน docs/12 ติ๊กครบหมดแล้ว, สถานะบนสุดของไฟล์นั้นเปลี่ยนเป็น "เสร็จแล้ว"**. งาน security hardening P1+P2 (docs/12 ทั้งไฟล์) เสร็จสมบูรณ์ รอ Fable (หรือ session อื่น) มารีวิว S1/S2/S3 — ยังไม่มีใครรีวิวเลยสักตัวในชุดนี้ ควรเริ่มจาก S1 (โค้ดจริง) ก่อน แล้วดู S2 (ยืนยัน matrix ตรงกับที่บันทึกไว้จริงไหม) แล้วค่อย S3 (docs)
- 2026-07-27 — เพิ่มหัวข้อ "คำขอรีวิวก่อน commit/push (Codex, blind แต่มีบริบท)" (Sonnet 5) — เจ้าของขอให้ Codex เข้ามา corroborate ทั้ง WP08 (Task 1-8 + R1-R6) และ security hardening (S1-S3) แบบ blind ก่อน commit/push จริง (ยังไม่มี commit ไหนของงานชุดนี้เลยจนถึงตอนนี้) เขียนสรุป scope + วิธีรีวิว + สิ่งที่ยังไม่มั่นใจไว้ให้ครบในหัวข้อใหม่นั้น พร้อมระบุชัดว่าไฟล์อื่นที่ค้างอยู่ใน working tree (email/R2 storage) ไม่เกี่ยวกับงานชุดนี้ ไม่ต้องรีวิว. หมายเหตุ: Sonnet (ผม) ไม่มีเครื่องมือเรียก Codex ได้เอง (ไม่มี CLI ติดตั้ง ไม่มี agent type นี้ ไม่มี teammate ชื่อนี้ในเซสชัน) — เจ้าของต้องรัน Codex เองในอีก session/terminal โดยชี้มาที่ ledger นี้
- 2026-07-27 — Codex กลับมารายงานผลรีวิว blind ครบ (แถว 1-8/S1-S3 ชุดที่สองในตารางด้านบน) — เจอบั๊กร้ายแรง 1 จุดที่ไม่เคยมีใครเจอมาก่อน (R7: เอกสาร "ขอปริ้นใหม่" ปริ้นซ้ำไม่จบเพราะแถว `queued` เดิมไม่เคยถูก consume) บวกข้อสังเกตรอง 2 จุด (R8: `requestPrint` ไม่มี transaction, R9: `print-agent/README.md` เขียนพฤติกรรมเก่าค้างจาก R4/R5). Sonnet 5 **ไม่เชื่อ Codex เฉยๆ** — ไล่อ่านโค้ดจริงเองแล้วจำลอง R7 ซ้ำบน Docker Postgres จริงจนเห็นบั๊กเกิดขึ้นต่อหน้า (ไม่ใช่แค่ Codex เข้าใจผิด) ก่อนตัดสินใจแก้. แก้ครบทั้ง R7/R8/R9 ตามรายละเอียดใน `docs/10-print-agent-tasks.md` หัวข้อ "ประเด็นจากรีวิวรอบ 3" แล้ว, เพิ่ม strikethrough+"แก้แล้ว" ลงในแถว Codex ที่เกี่ยวข้องทุกแถว (Task 2/3/5/7/8, S3) โดยไม่ลบข้อความเดิมของ Codex. ยังเหลือค้าง 2 จุดที่ยอมรับว่ายังไม่แก้ (นอกขอบเขตรอบนี้): (a) count+insert race condition ใน path สร้าง job ใหม่ล้วนๆ (ความเสี่ยงต่ำ), (b) printer `JobStatus`/offline detection + 90-day log retention ตาม docs/09 §5.3/§5.5 (ยังไม่ implement). ผลทดสอบ: server พร้อม Docker Postgres จริง 2 รอบติดกัน → 33/33 pass ทั้งคู่; default env → 26 pass 7 skip 0 fail; client 8/8; print-agent 28/28. **ยังไม่ commit — รอ Codex หรือ Fable กลับมา re-verify รอบใหม่ก่อน แล้วเจ้าของจะตัดสินใจว่าพร้อม commit/push หรือยัง**
- 2026-07-27 — Codex re-verify R7-R9 (แถว R7/R8/R9 "รอบ 4" ในตารางด้านบน) — R8/R9 ผ่านจริง, R7 "ผ่านมีข้อสังเกต" เจอ 2 ปัญหาใหม่: **R10** test flaky (assert `queue.length===1` ทั้งระบบ ชนกับ test file อื่นที่รันขนาน), **R11** `claimQueuedJob` ยัง**ไม่ concurrency-safe จริง** ตามที่เอกสารเคยอ้างผิด — reproduce ด้วยยิง 2 agent พร้อมกันได้ 2 queued rows จริง (double-print risk). Sonnet 5 **ไม่เชื่อ Codex เฉยๆ อีกครั้ง** — จำลอง R11 เองด้วย `Promise.all` ยิง HTTP request 2 อันพร้อมกันจริงก่อนแก้ ยืนยันเจอ 2 แถวแยกกันจริงตรงตามที่ Codex รายงาน (ไม่ใช่ Codex เข้าใจผิด). แก้ทั้งคู่: (R10) เปลี่ยน assertion ให้เช็คเฉพาะ record ตัวเอง; (R11) เพิ่ม `pg_advisory_xact_lock` ล็อกทั้งขั้นตอน claim-or-create ต่อ record + เช็ค active job ก่อนสร้างใหม่ ใน `printAgentService.createAgentPrintJob`. เพิ่ม regression test ยิง 2 request พร้อมกันจริงยืนยันว่าเหลือแค่ job เดียว. ผลทดสอบ: รัน `npm test` (server) พร้อม Docker Postgres จริง **3 รอบติดกันบน DB เดิมไม่ reset → 34/34 pass ทุกรอบ**; default env → 26 pass 8 skip 0 fail; client 8/8; print-agent 28/28. รายละเอียดเต็มอยู่ใน `docs/10-print-agent-tasks.md` หัวข้อ "ประเด็นจากรีวิวรอบ 4". **ยังไม่ commit — รอ Codex/Fable re-verify รอบใหม่อีกครั้งก่อนเจ้าของตัดสินใจ commit/push**
- 2026-07-27 — เจ้าของเอง (ไม่ใช่ Codex/Fable รอบนี้) reproduce แล้วเจอว่า R11's "fix" ยังไม่พอ: ยิง 10 concurrent create-job requests จริง เหลือ DB row เดียวจริง (R10/R11 DB-level ผ่าน) **แต่ทั้ง 10 คำขอได้ HTTP 201 เหมือนกันหมด** — ตรงกับที่ Codex แถว 47 เตือนไว้ทุกประการ (`return activeJobs[0]` คืนความสำเร็จปลอมให้ผู้แพ้). เจ้าของระบุ fix ที่ต้องการชัดเจน: ผู้ชนะรายเดียวเดินต่อ ผู้แพ้ต้องได้ 409/`claimed:false`/ownership signal ที่ทำให้ agent หยุดโดยไม่ปริ้น + test ต้องยืนยัน "มีเพียง caller เดียวได้สิทธิ์ process" ไม่ใช่แค่ "มี DB row เดียว". Sonnet 5 reproduce ซ้ำเองอีกครั้ง (10 concurrent → 10× HTTP 201 เดียวกัน) ยืนยันตรงกับที่เจ้าของรายงานก่อนแก้ (**R12**): เปลี่ยน `printAgentService.createAgentPrintJob` ให้ `throw conflict(...)` (HTTP 409) แทนการคืน job ของผู้ชนะให้ผู้แพ้; แก้ `print-agent/src/index.js` ให้ `processDocument` ดัก `error.status === 409` แล้ว skip เอกสารนั้นแบบไม่ crash ทั้ง `runOnce` (เดิมโค้ดไม่มี try/catch ครอบ `createPrintJob` เลย — ถ้าไม่แก้จุดนี้ 409 จะทำให้ agent หยุดทำเอกสารที่เหลือทั้งคิวทันที ซึ่งผิดเจตนา); เขียน regression test ใหม่ใน `agent-api.test.js` ให้ assert ชัดว่ามี winner (201) เดียวและ loser (409) เดียว ไม่ใช่แค่ "job id ตรงกัน"; เพิ่ม test ใหม่ใน `print-agent/tests/index.test.js` ยืนยันว่า `runOnce` เจอ 409 แล้ว skip ได้จริงไม่ crash ไม่ download/print. ผลทดสอบ: server พร้อม Docker Postgres จริง **3 รอบติดกันบน DB เดิมไม่ reset → 34/34 pass ทุกรอบ**; print-agent → 29/29 pass; client → 8/8 pass. รายละเอียดเต็มอยู่ใน `docs/10-print-agent-tasks.md` หัวข้อ "ประเด็นจากรีวิวรอบ 6". อัปเดตแถว R11 (row 47 ด้านบน) ด้วย strikethrough+"แก้แล้ว" ตาม convention เดิม ไม่ลบข้อความ Codex. **ยังไม่ commit — รอเจ้าของ review เองหรือส่งให้ Codex/Fable re-verify รอบใหม่ก่อนตัดสินใจ commit/push**
- 2026-07-27 — เจ้าของ (ไม่ใช่ Codex/Fable) รีวิว R12 เองแบบอิสระแล้วยืนยันผ่าน: server 34/34 ผ่าน 3 รอบติดกันบน DB เดิม; ยิง 10 concurrent HTTP requests ไปยัง record เดียวกันเห็นผู้ชนะ 1 รายได้ 201, ผู้แพ้ 9 รายได้ 409 `CONFLICT`, ฐานข้อมูลมีเพียง 1 job; print-agent 29/29 ผ่าน; client 8/8 ผ่าน; agent ที่ได้ 409 ข้ามเอกสารโดยไม่ download/update/convert/print/complete และยังทำเอกสารอื่นที่เหลือในคิวต่อได้ปกติ; Docker test container ถูกลบแล้ว. **คำตัดสิน: พร้อม commit จากมุม code review** — ไม่มี concurrency/double-print blocker เหลืออยู่แล้ว ข้อจำกัดที่ยังต้องยอมรับก่อน deploy จริงเหมือนเดิม (ยังไม่ทดสอบกับ Brother เครื่องจริง, printer error/offline detection และ log retention 90 วันตาม docs/09 §5.3/§5.5 ยังไม่ implement — นอกขอบเขตงานนี้). เจ้าของสั่งให้ดำเนินการ commit ต่อ.
- 2026-07-27 — **หลัง commit+push (`3e1f933`)** เจ้าของชี้แจง (ตรงกับเจตนาตั้งแต่ prompt แรก ที่ Sonnet พลาดจุดนี้ไปตอนวาง `render.yaml`) ว่าไม่ต้องการ deploy `claspscxseamless-web` เป็น Render service ใหม่แยกต่างหาก — ให้ port ทั้งระบบไปรันบน `currentSC-official-website-project` (`sc-official-website`, service ที่จ่ายเงินอยู่แล้ว) แทน เพื่อไม่ต้องจ่ายค่า web service ตัวที่สอง. วางแผนผ่าน `EnterPlanMode` (อนุมัติแล้ว) แล้ว implement เต็ม scope: ทั้ง `server/` (workbook processing, history, files, email, agent, LINE, appAuth) และ `client/` ถูก port เป็นโมดูลใหม่ `currentSC-official-website-project/backend/src/modules/seamless/` (ขยายจากโมดูล `seamless` เดิมที่มีอยู่แล้ว, ไม่แตะ legacy `/api/processing-records`) — `printAgentService.js` (รวม R12 fix) port แบบ verbatim ที่สุด, route paths เดิมคงไว้หมดจึง **print-agent CLI ไม่ต้องแก้โค้ด**. เขียน Jest test ใหม่ (`backend/tests/seamless-*.test.cjs`) จงใจไม่ใช้ mock-SQL convention เดิมของ backend นั้นเพราะ mock ตรวจจับบั๊ก concurrency (R7/R11/R12) ไม่ได้จริง — ยืนยันด้วย Docker Postgres จริง: auth matrix ครบ, **reproduce R12 ซ้ำบนโค้ด port แล้วสำเร็จ (10 concurrent → 1×201 + 9×409, DB แถวเดียว)**, full lifecycle ผ่าน, Jest suite ใหม่ 13/13 pass 3 รอบติดกันบน DB เดิมไม่ reset, backend suite เดิมทั้งหมด 73/78 pass 0 fail (5 skip = suite ใหม่ตัวเองที่ตั้งใจ skip เมื่อไม่มี `DATABASE_URL` override) เจอบั๊กจริง 1 จุดระหว่าง port (processingRecords.js เดิมไม่ export `mapRecord` ทำให้ `getPrintQueue()` throw) — เจอจาก curl smoke test สด ไม่ใช่แค่อ่านโค้ด แก้แล้วก่อนสรุปผล. รายละเอียดเต็มอยู่ใน `docs/10-print-agent-tasks.md` หัวข้อ "การย้ายไปรันบน shared backend (2026-07-27)". **ทั้งสอง repo ยังไม่ commit — รอเจ้าของ review**
- 2026-07-29 — ระหว่างเตรียม phase G (ทดสอบปริ้นจริงครั้งแรกบนเครื่อง 000) เจ้าของดึงรายการ print queue จริงจาก production มาดู แล้วสังเกตเห็นแถวข้อมูลที่ดูเหมือน test fixture หลุดเข้า production (`test-claim-queued-*`, `test-stale-queued-*`, `test-stale-downloading-*`) — Sonnet 5 ตรวจสอบเองแล้วยอมรับว่าเป็นบั๊กจริงจากฝั่งตัวเอง: grep ยืนยันชื่อไฟล์เหล่านี้ตรงกับ fixture ใน `server/tests/print-job-db.test.js` (test `requeueStaleJobs`/`claimQueuedJob`) เป๊ะ ค้นเพิ่มเจออีก 2 แถวที่ไม่ได้ถูก flag ไว้แต่แรก (`test-print-job-*`, `test-preview-*`) รวมเป็น **5 แถว** ทั้งหมด timestamp ห่างกันไม่ถึง 1 วินาที (`1785125444xxx`) ยืนยันว่าหลุดมาจาก test run เดียวกันช่วงทำงาน R11/R12 ที่ `TEST_DATABASE_URL`/`SC_OFFICIAL_SUPABASE_DATABASE_URL` override ไม่ทำงานจริงตามที่ตั้งใจ (เคสเดียวกับที่เคยสังเกตแบบผ่านๆ ตอนเจอ migration 003 ถูก apply ไปแล้วก่อนเวลาที่ยืนยัน — ตอนนั้นไม่ได้สืบต่อว่ามีข้อมูลหลุดด้วย). ตรวจสอบก่อนลบ: ไม่มี `generated_files`/`print_jobs` อ้างอิงแถวเหล่านี้เลย มีแค่ `processing_record_branch_codes` 2 แถว. Backup production ก่อน (`pg_dump --schema=clasp_scx_seamless` → `backups/before-test-leak-cleanup-*.sql`) แล้วลบทั้ง 5 แถว + branch code links ที่เกี่ยวข้องในทรานแซคชันเดียว ยืนยันหลังลบว่าเหลือ 0 แถวที่ชื่อขึ้นต้น `test-`. **บทเรียน:** ต้อง audit production เป็นระยะเพื่อหา test fixture ที่หลุดจากการรัน suite ระหว่าง dev/review แม้จะตั้งใจใช้ disposable Docker Postgres เสมอก็ตาม — คำแนะนำให้เพิ่มการเช็คนี้เข้า checklist ก่อน production migration/commit ครั้งถัดไป
- 2026-07-29 — **บั๊กจริงที่พบระหว่าง phase G รอบแรกบนเครื่อง 000:** รัน `node src\index.js` (ไม่ dry-run) ครั้งแรกจริง เจอเอกสาร `Preview-summary-single-20260728-050721` ในคิว (จากการ import registry เมื่อวานนี้) → สร้าง print job → **ล้มเหลวที่ขั้น download**: `Failed to parse URL from` (`fetch('')` ของ Node). ตรวจสอบพบสาเหตุ: record ที่ import จาก legacy registry ไม่มี `metadata.outputFileId` เลย (มีแค่ `originalId`/`importedFrom`/`originalPrinted`/`originalReportDate`) ทำให้ `printAgentService.resolveDownloadUrl('')` คืนค่าว่างเสมอ — และแม้จะมี `generated_files` row จริงอยู่ (`file_kind='preview_workbook'`, `storage_provider='google_drive'`) ก็ชี้ไปที่ Google Sheets **edit URL** (ไม่ใช่ direct file download) อยู่ดี ตรวจนับพบ **เอกสาร legacy ที่ยัง `printed=false` ทั้งหมด 26 รายการ** ซึ่งทุกรายการจะพังแบบเดียวกันหมดไม่ว่าจะ trigger ผ่าน auto-print หรือกดปุ่ม "ขอปริ้นใหม่" มือเอง (เพราะปัญหาอยู่ที่ขั้น resolve download URL ซึ่งเหมือนกันทั้งสองทาง) — นอกจากนี้ยังพบอีก 2 records ที่ `printed=false` แต่ไม่ได้มาจาก legacy import (`migration_source IS NULL`, วันที่ 2026-07-04) น่าจะเป็นข้อมูลทดสอบเก่าที่ค้างอยู่เหมือนกัน ยังไม่ได้ตรวจสอบเพิ่มเติม
  - **วิธีแก้ทันที (ทำแล้ว):** ตั้ง `SEAMLESS_AUTO_PRINT_SINCE=2026-07-29` บน Render (`sc-official-website`) กันไม่ให้ documented ทั้ง 26 รายการ (และ record legacy อื่นๆ ในอนาคต) เข้าคิว auto-print อีก — ยืนยันแล้วว่า queue ว่างจริงหลัง redeploy (`{"queue":[]}` จากเครื่อง 000)
  - **ยังไม่แก้ (ทางแก้ถาวรสำหรับ backlog เอกสาร legacy ที่ยังไม่ได้ปริ้น):** ต้องทำ "แนบไฟล์จริง" ตามที่คุยไว้ก่อนหน้า — จับคู่ 40 ไฟล์ `.xlsx` ที่ดาวน์โหลดมาไว้ที่ `เอกสาร seamlessXSC` เข้ากับ `generated_files` row ที่ตรงกันด้วยชื่อไฟล์ อัปโหลดเนื้อไฟล์เข้า storage ของแอปใหม่ แล้วอัปเดต `download_url`/`storage_provider`/`metadata.outputFileId` ให้ถูกต้อง — ถึงตอนนั้นเอกสาร legacy ที่มีไฟล์แนบจะกดปริ้นได้จริงทั้งแบบ auto และ manual; เอกสารที่ไม่มีไฟล์แนบ (เพราะไฟล์ .xlsx หายไปจาก Drive retention) จะยังปริ้นไม่ได้อยู่ดี ต้องยอมรับเป็นข้อจำกัด. Failed job (`2dc809a3-...`) ปล่อยไว้ตามเดิม ไม่ลบ — เป็นหลักฐานจริงของบั๊กนี้ ตรงกับหลักการ traceability ของทั้งระบบ
- 2026-07-29 — **บั๊กจริงอีกจุดที่พบระหว่างทดสอบอัปโหลดไฟล์จริงจากสาขา (ไม่ใช่ synthetic test file):**
  เจ้าของอัปโหลดไฟล์จริง 2 ไฟล์ (`REP_individual_INS_2026072916562626.xlsx`,
  `rep_summary_zone05 (8).xlsx`) ผ่านเว็บแอปจริง ทั้งคู่ fail ด้วย generic message
  `Cannot read properties of null (reading 'toString')` — reproduce สำเร็จเองด้วยการรันไฟล์จริงทั้งสอง
  ผ่าน `transformWorkbook` โดยตรง (ไม่ผ่าน HTTP) ได้ full stack trace ชี้ชัดว่าเป็นบั๊กใน
  `workbookRules.js`'s `getCellText`/`getA1Text`: ExcelJS's `cell.text` getter **throw** (ไม่ใช่คืนค่า
  falsy) เมื่อเจอ cell ที่เป็นส่วนหนึ่งของ merged range แต่ merge-master reference เสีย/dangling —
  ไฟล์จริงจากสาขาที่ผ่านการแก้ไขมือมาหลายปีเจอเคสนี้ ในขณะที่ synthetic test workbook (สร้างสดด้วย
  ExcelJS เอง) ไม่เคยสร้าง merge ที่เสียแบบนี้เลยจึงไม่เคยถูกจับได้มาก่อน (ทั้งใน
  `server/tests/workbook-transform.test.js` เดิมและ `backend/tests/seamless-workbook-transform.test.cjs`
  ที่ port มา). โค้ดเดิม `cell.text || cell.value` ป้องกันไม่ได้เพราะ getter throw ก่อนถึง `||`
  - **แก้แล้วทั้ง 2 repo:** เพิ่มฟังก์ชัน `safeCellText(cell)` ห่อ `cell.text` ด้วย try/catch แล้ว
    fallback ไป `cell.value` เมื่อ throw — แก้ที่ `currentSC-official-website-project/backend/src/
    modules/seamless/services/workbookRules.js` (โค้ดที่รันจริง) และ `ClaspSCxSeamless/server/src/
    services/workbookRules.js` (ต้นทาง/เอกสารอ้างอิง) ให้เหมือนกันทั้งคู่
  - **ยืนยันด้วยไฟล์จริงทั้ง 2 ไฟล์:** รัน `transformWorkbook` ตรงๆ หลังแก้ → ผ่านทั้งคู่, parse วันที่/
    รหัสสาขาถูกต้อง (`REP_individual...` → branch 004, date 2026-07-27; `rep_summary_zone05 (8)` →
    branch 004, date 2026-07-29) — ไม่ได้เก็บไฟล์จริงทั้งสองไว้ใน repo เพราะเป็นข้อมูลรายงานจริงของสาขา
  - ผลทดสอบ suite เดิมหลังแก้: `backend` (shared) → 77 pass, 5 skip, 0 fail; `ClaspSCxSeamless/server`
    (ต้นทาง) → 26 pass, 8 skip, 0 fail — ไม่มี regression ทั้งสองฝั่ง
  - **ยังไม่ตรวจ:** ยังไม่ได้ทดสอบซ้ำผ่านหน้าเว็บจริงหลัง deploy โค้ดที่แก้แล้ว (แก้แค่ในเครื่อง dev นี้
    ยังไม่ commit/push/deploy) — ต้องรอ deploy ก่อนแล้วให้เจ้าของลองอัปโหลดไฟล์เดิมซ้ำอีกครั้งเพื่อยืนยัน
    end-to-end จริง
- 2026-07-29 — **Phase G หยุดชั่วคราว** เจ้าของสังเกตว่าเครื่องพิมพ์ที่สำนักงาน (เครื่อง 000) ปิดอยู่
  จึงพักการทดสอบปริ้นจริงไว้ก่อน สถานะ ณ จุดหยุด (สำหรับ resume ทีหลัง):
  - แก้บั๊ก merged-cell (`safeCellText`) แล้ว commit+push ขึ้น `sc-official-website` แล้ว
    (commit `1d2a9bd`) ยืนยันด้วยไฟล์จริง 2 ไฟล์จากสาขาว่า `transformWorkbook` ผ่านแล้ว
  - อัปโหลดไฟล์จริงสำเร็จ 2 ไฟล์ผ่านหน้าเว็บ สร้าง record ใหม่ 2 แถว (`printed=false`,
    มี `outputFileId`/`generated_files` ถูกต้องครบ): `Preview-summary-single-20260729-100657.xlsx`
    (id `2ae5f40c-...`), `Preview-individual-single-20260729-100647.xlsx` (id `4d7a03ed-...`)
    — ยังไม่มี `print_jobs` ผูกกับทั้งคู่เลย (0 แถว) ทั้งสองยังไม่ได้ถูกปริ้น
  - **พบว่า auto-print queue ว่างผิดปกติ** แม้ทั้ง 2 record เข้าเงื่อนไข `printed=false` — สาเหตุที่คาดว่า
    น่าจะใช่: `SEAMLESS_AUTO_PRINT_SINCE` (ชื่อ env var ที่โค้ดอ่านจริง ไม่มี fallback ไปที่
    `AUTO_PRINT_SINCE` เฉยๆ) อาจถูกตั้งผิดชื่อบน Render ตอนแก้ปัญหา legacy backlog ก่อนหน้านี้ ทำให้
    ค่าอ่านได้เป็นค่าว่าง ซึ่งตามดีไซน์คือ "ปิด auto-print ทั้งหมด" — ปิดทั้ง legacy backlog (ตั้งใจ)
    และเอกสารใหม่จริง (ไม่ตั้งใจ) พร้อมกัน **ยังไม่ได้ยืนยันหรือแก้ไข** เพราะไม่มีสิทธิ์เข้า Render
    dashboard โดยตรงจากฝั่งนี้ — ต้องให้เจ้าของเช็คชื่อ env var จริงบน Render เอง
  - **ทางเลือกที่ยังไม่ได้ลอง (bypass AUTO_PRINT_SINCE ได้เลย ไม่ต้องรอแก้ env):** กดปุ่ม
    "ขอปริ้นใหม่" บนเอกสารทั้ง 2 นี้ผ่านหน้าเว็บโดยตรง — จะสร้าง `print_jobs` แถวสถานะ `queued`
    ทันที ซึ่งเข้าเงื่อนไข query ไม่ว่า `AUTO_PRINT_SINCE` จะถูกตั้งถูกหรือผิดก็ตาม
  - **ขั้นต่อไปเมื่อพร้อมทดสอบต่อ (เครื่องพิมพ์เปิดแล้ว):** (1) เช็ค/แก้ชื่อ env var
    `SEAMLESS_AUTO_PRINT_SINCE` บน Render ให้ถูกต้อง (2) หรือกดปุ่ม "ขอปริ้นใหม่" บนเอกสาร 2 ไฟล์
    ข้างต้นเพื่อ bypass ปัญหานี้ (3) เช็คคิวยืนยันเจอเอกสารจริง (4) รัน `node src\index.js` บนเครื่อง 000
    ยืนยัน lifecycle เต็ม + กระดาษออกจริง (5) รันซ้ำทันทีเพื่อยืนยันไม่ปริ้นซ้ำ. **หมายเหตุ:**
    ไฟล์ทั้ง 2 นี้เก็บบน local disk (ephemeral บน Render) — ถ้ามี redeploy เกิดขึ้นก่อนจะทดสอบต่อ
    ไฟล์อาจหายไปแล้ว ต้องอัปโหลดใหม่หากเป็นเช่นนั้น
- 2026-07-29 — **บั๊กจริงพบ+แก้: legacy branch codes ไม่ zero-padded ทำให้หน้าเว็บแสดง "-" ผิด**
  เจ้าของสังเกตในหน้าเว็บว่าเอกสาร legacy หลายรายการ (รวมถึง `Preview-summary-single-20260728-050721`,
  `Preview-individual-single-20260728-045829` ฯลฯ) แสดงคอลัมน์ "เอกสารของสาขา" เป็น "-" ทั้งที่ไม่ควร
  ตรวจสอบครั้งแรกพลาด (นับ `processing_record_branch_codes` junction table แทนที่จะเช็ค
  `legacy_branch_codes` ซึ่งเป็น field จริงที่หน้าเว็บอ่าน) ก่อนจะพบสาเหตุจริง: `legacy_branch_codes`
  ของ record จำนวนมากถูกเก็บเป็นเลขหลักเดียว เช่น `"3"`, `"1"`, `"4"` แทนที่จะเป็น zero-padded 3 หลัก
  (`"003"`, `"001"`, `"004"`) — client's `normalizeBranchCodeList` (และ server's `normalizeBranchCodes`
  ทั้งคู่) ใช้ regex `/^\d{3}$/` เช็คแบบเข้มงวด ทำให้เลขหลักเดียวถูกกรองทิ้งเงียบๆ กลายเป็น array ว่าง
  แล้ว UI แสดง "-" — **ตรวจสอบเต็มพบว่ากระทบ 117 จาก 125 legacy records ที่ import มา** (ไม่ใช่แค่
  4 records ที่คิดไว้ตอนแรกจากการเช็ค junction table)
  - แก้ด้วยสคริปต์ zero-pad ทุกส่วนที่เป็นตัวเลข 1-3 หลักให้เป็น 3 หลัก แล้วเรียก
    `processingRecords.updateProcessingRecord(id, { branchCodes: paddedValue })` ของจริง (ใช้โค้ด
    เดียวกับที่แอปใช้ ไม่เขียน SQL ตรงๆ เอง) เพื่อให้ทั้ง `legacy_branch_codes` และ junction table
    sync กันถูกต้อง
  - Dry-run ก่อน: 117 would-fix, 4 already-correct, 0 unparseable — สะอาดหมด
  - Backup production ก่อน commit จริง (`backups/before-branch-code-padding-fix-*.sql`)
  - Commit จริง: แก้ครบ 117 รายการ ยืนยันหลังแก้ว่า **0 รายการยังผิดรูปแบบ** จาก 121 รายการที่มีค่า
    ไม่ว่าง
  - ระหว่างตรวจก็ยืนยันด้วยว่า 2 เอกสารที่อัปโหลดจริงทดสอบก่อนหน้า (`Preview-summary-single-
    20260729-100657`, `Preview-individual-single-20260729-100647`) มี `legacy_branch_codes="004"`
    ถูกต้องอยู่แล้วในฐานข้อมูลจริง — "-" ที่เจ้าของเห็นในสกรีนช็อตก่อนหน้าเป็นแค่ state ค้างของหน้าเว็บ
    ไม่ใช่บั๊กจริงของ pipeline ปัจจุบัน

- 2026-07-29 — **ยืนยัน R2 fallback จริง + attach legacy preview workbooks เข้า R2**
  - อัปโหลด raw-source ผ่าน production flow `POST /api/workbooks/process` ใหม่ 2 ไฟล์:
    `rep_summary_zone05 (8).xlsx` (`formatterMode=summary`) และ
    `REP_individual_INS_2026072916562626.xlsx` (`formatterMode=individual`) — response ทั้งคู่
    `ok: true`, 0 failures; query production ยืนยัน generated files ใหม่ครบ 6 rows
    (`source_upload`, `processed_xlsx`, `preview_workbook` อย่างละชนิดต่อ input) เป็น
    `storage_provider='r2'` ทั้งหมด จึงยืนยันว่า bare `R2_*` fallback จาก commit `edb580b`
    ทำงานจริงบน Render
  - Legacy dry-run: ตรวจไฟล์ `.xlsx` 40 ไฟล์ใน `Downloads/เอกสาร seamlessXSC`, จำกัด record ที่
    `migration_source='ProcessingRegistry.csv'`, เทียบ basename กับ `processing_records.filename`
    และตรวจ `file_kind='preview_workbook'` — จับคู่พร้อมย้าย 34, already-R2 0,
    ambiguous/missing preview row 0, จับคู่ record ไม่พบ 6
  - ก่อนเขียนจริงสร้าง production backup:
    `backups/before-legacy-preview-r2-attach-20260729-190914.sql` (258,721 bytes, gitignored)
  - ผลจริง: อ่าน buffer จากไฟล์ local และเรียก
    `writeStoredFile('preview_workbook', filename, buffer)` ของ shared backend เพื่ออัปโหลด R2
    ครบ 34/34 จากนั้นอัปเดต `generated_files` rows เดิมครบ 34 rows ภายใน transaction;
    ไม่สร้าง row ใหม่และไม่แก้ record ที่ไม่ match โดยเก็บ `legacy_drive_file_id`/
    `legacy_drive_file_url` เดิมไว้ครบ
  - Post-commit query exact 34 IDs: `storage_provider='r2'` 34/34,
    R2 key path ถูกต้อง 34/34, `download_url=view_url` และไม่ว่าง 34/34,
    file size/checksum ครบ 34/34, legacy Drive traceability ยังอยู่ 34/34,
    และทุก row ยังเป็น `file_kind='preview_workbook'`
  - ไฟล์ที่จับคู่ record ไม่พบและไม่ได้แตะ:
    `Preview-individual-single-20260723-222920.xlsx`,
    `Preview-individual-single-20260728-000853.xlsx`,
    `Preview-individual-single-20260728-003311.xlsx`,
    `Preview-summary-single-20260722-044244.xlsx`,
    `Preview-summary-single-20260723-223004.xlsx`,
    `Preview-summary-single-20260728-003411.xlsx`

- 2026-07-29 — **แก้บั๊ก: ปุ่ม "เปิดไฟล์" ของ legacy เอกสารยังเปิด Google Sheets แม้ย้ายขึ้น R2 แล้ว**
  - สาเหตุ: การ migrate ข้างต้นตั้งใจคงค่า `legacy_drive_file_id`/`legacy_drive_file_url` เดิมไว้
    (เพื่อรักษา traceability) แต่ `HistoryTable.jsx` render ปุ่ม "เปิดไฟล์" จาก
    `record.driveFileUrl` (= `processing_records.legacy_drive_file_url`) โดยตรง ไม่เคย join กับ
    `generated_files.download_url` — ผลคือทั้ง 34/34 record ที่ย้ายขึ้น R2 แล้ว ปุ่มยังพาไปที่
    Google Sheets URL เดิม ไม่ได้ดาวน์โหลดจาก R2 เหมือนไฟล์ที่อัปโหลดใหม่
  - Dry-run (`fix-legacy-drive-url-tmp.js` ใน `backend/`): join `processing_records` กับ
    `generated_files` (filename + `file_kind='preview_workbook'`) เฉพาะที่
    `migration_source='ProcessingRegistry.csv'` และ `storage_provider='r2'` — พบ 34/34 ต้องแก้,
    already-correct 0, skip (ไม่มี `download_url`) 0
  - Backup ก่อนเขียนจริง: `backups/before-legacy-drive-url-fix-2026-07-29T12-31-27-109Z.sql`
    (265,471 bytes, gitignored)
  - Commit จริงผ่าน `processingRecords.updateProcessingRecord(id, { driveFileUrl })` เดิมของแอป
    (ไม่ใช้ raw SQL) อัปเดต `legacy_drive_file_url` ให้เท่ากับ
    `generated_files.download_url`/`view_url` ที่ R2 migration ตั้งไว้แล้ว ครบ 34/34
  - Verify หลัง commit: query ซ้ำด้วยเงื่อนไขเดิม — เหลือ 0/34 ที่ยังชี้ไป `docs.google.com`
  - ลบสคริปต์ชั่วคราวแล้ว (`fix-legacy-drive-url-tmp.js`, `check-legacy-url-tmp.js`)
  - หมายเหตุ: `legacy_drive_file_id` (Drive file ID) ไม่ได้แก้ เพราะไม่มีที่ใดใน client อ่านฟิลด์นี้
    ไปแสดงเป็นลิงก์โดยตรง มีแต่ `legacy_drive_file_url` ที่กระทบ UI

- 2026-07-29 — **แก้บั๊ก: ไฟล์ legacy ที่ดาวน์โหลดแล้วเปิดไม่ถูกโปรแกรม (ไม่รู้ว่าต้องใช้ Excel)**
  - ผู้ใช้ดาวน์โหลด `Preview-individual-single-20260728-001551` มาทดสอบหลังแก้ URL ด้านบน แต่
    Windows ไม่รู้ว่าไฟล์นี้ควรเปิดด้วย Excel — ตรวจพบว่า `generated_files.filename` (34 legacy
    rows เดิม) ไม่มีนามสกุล `.xlsx` ต่อท้าย และ `generated_files.mime_type` ยังเป็นค่าที่ import
    มาจาก Google Drive API ตอน migrate (`application/vnd.google-apps.spreadsheet` — mimetype ของ
    ไฟล์ Google Sheets แบบ native ไม่ใช่ของจริงที่เป็น `.xlsx`) ทั้งสองฟิลด์นี้เป็นตัวกำหนด
    `Content-Disposition filename=`/`Content-Type` ตอนดาวน์โหลดใน `fileController.js` โดยตรง —
    เทียบกับไฟล์ที่อัปโหลดใหม่ (fresh upload) ซึ่ง filename ลงท้าย `.xlsx` และ mime_type เป็น
    `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` เสมอ
  - Dry-run (`fix-legacy-filename-mime-tmp.js`): join เงื่อนไขเดียวกับการแก้ URL ด้านบน (34 rows)
    — ทั้ง 34 filename ไม่มี `.xlsx` และ mime_type ผิดทั้งหมด
  - Backup ก่อนเขียนจริง: `backups/before-legacy-filename-mime-fix-2026-07-29T12-41-24-281Z.sql`
    (265,743 bytes, gitignored)
  - Commit จริงด้วย raw SQL ตรง (`updateGeneratedFile()` เดิมของแอปไม่รองรับแก้ `filename`/
    `mime_type`) ต่อ `.xlsx` เข้า filename เดิม และตั้ง mime_type เป็นค่า xlsx จริง ครบ 34/34
    — ไม่แตะ `storage_path`/R2 object key เดิม (ไม่จำเป็น เพราะ header ตอนดาวน์โหลดมาจาก DB
    column ไม่ใช่จาก storage key)
  - ผลข้างเคียงที่รู้ตัว: `generated_files.filename` ไม่ตรงกับ `processing_records.filename`
    อีกต่อไปสำหรับ 34 legacy records (processing_records ไม่มี `.xlsx` ต่อท้าย) — ตรวจแล้วว่า
    โค้ด runtime ของแอปไม่มีจุดไหน join สองตารางนี้ด้วย filename เลย (`getGeneratedFileById`
    ใช้ id เท่านั้น) จึงไม่กระทบการทำงานจริง มีผลแค่กับ diagnostic script ชั่วคราวที่ใช้ join
    แบบเดิมเท่านั้น
  - Verify หลัง commit: query ตรงด้วย `legacy_drive_file_id` (แทน filename join ที่ใช้ไม่ได้แล้ว)
    — 34/34 filename ลงท้าย `.xlsx`, 34/34 mime_type ถูกต้อง
  - ลบสคริปต์ชั่วคราวแล้ว (`fix-legacy-filename-mime-tmp.js`)

- 2026-07-30 — **เพิ่ม session-cookie login แทน Basic Auth popup + แก้บั๊ก relative download URL**
  - ผู้ใช้ขอให้สร้างหน้า login จริงแทน browser native Basic Auth popup เพราะ popup ทำงานไม่คงเส้น
    คงวา (fetch ของแอปแนบ credential ได้ แต่ลิงก์ `<a href target="_blank">` ธรรมดาเป็นการ navigate
    ใหม่ที่ไม่ reuse credential เดิมเสมอไป)
  - Backend (mirror ทั้งสอง repo): เพิ่ม `middleware/session.js` (stateless HMAC-signed httpOnly
    cookie, ไม่มี session table เพราะมี login ร่วมกันแบบเดียว ไม่ใช่ per-user identity),
    `POST /api/app/session/login`, `POST /api/app/session/logout`, `GET /api/app/session`
    (public, ไม่ผ่าน appAuth) — `appAuth` รับ valid session cookie เป็นวิธีที่ 3 นอกจาก
    Basic/Bearer เดิม `cookie-parser` wire เข้า server ทั้งสอง (มีอยู่แล้วเป็น unused dependency
    ใน shared backend, เพิ่มใหม่ใน source repo)
  - Client: เพิ่ม `LoginPage.jsx`, `App.jsx` เช็ค session ตอนโหลดแล้ว gate หน้า login/app,
    ปุ่ม "ออกจากระบบ", `api.js` เพิ่ม `login`/`logout`/`getSession`
  - Verify ด้วย chrome-devtools จริง: login คงอยู่ข้าม reload, navigate ตรงไปยัง
    `/api/files/:id/download` (จำลองปุ่ม "เปิดไฟล์") ผ่านได้โดยไม่มี native popup เลย, logout แล้ว
    endpoint เดิม fallback กลับไปเรียก Basic Auth เหมือนเดิม (พิสูจน์ auth ถูก revoke จริง)
  - ระหว่างทดสอบจริงหลัง deploy พบบั๊กจริงอีกจุด: ปุ่ม "เปิดไฟล์" ของไฟล์ที่เพิ่ง reprocess ใหม่
    (2026-07-29/07-27 test records) เปิดไปที่หน้า root ของ client เอง (`claspscxseamless.onrender.com/`)
    แทนที่จะเป็นไฟล์ — สาเหตุ: `download_url`/`view_url`/`legacy_drive_file_url` ที่สร้างตอน
    ประมวลผลเป็น relative path (`/api/files/:id/download`) เพราะ `SEAMLESS_PUBLIC_BASE_URL` ไม่ได้
    ตั้งค่าไว้ ตั้งแต่ client แยกเป็น Render Static Site คนละ origin กับ API แล้ว relative path
    จะ resolve กับ origin ของ client เอง (ซึ่งไม่มี route นี้ จึงตกไปที่ SPA fallback → หน้า root)
  - แก้โค้ด: `readPublicBaseUrl()`/`env.publicBaseUrl` fallback ไปที่ `RENDER_EXTERNAL_URL`
    (env var ที่ Render inject ให้อัตโนมัติทุก web service) เมื่อไม่ได้ตั้ง
    `SEAMLESS_PUBLIC_BASE_URL`/`PUBLIC_BASE_URL` เอง — ไม่ต้องเพิ่ม env var ใหม่บน Render
  - Data fix: พบ 4 `generated_files` rows + 2 `processing_records.legacy_drive_file_url` เป็น
    relative path จริง (ทั้งหมดคือ 2 ไฟล์ที่เพิ่ง reprocess ก่อนหน้านี้ในวันเดียวกัน ไม่มี record
    เก่ากว่านี้ที่กระทบ) — backup (`before-relative-url-fix-2026-07-30T01-40-36-380Z.sql`)
    แล้ว dry-run/commit ต่อ URL ให้เป็น absolute (`https://sc-official-website.onrender.com...`)
    ครบ 4+2 verify แล้วเหลือ 0 relative rows
  - Test suite ทั้งสอง repo ผ่านครบ (backend 81/86 pass 5 skip, ClaspSCxSeamless 29/37 pass 8 skip,
    ไม่มี fail) ก่อน commit

- 2026-07-30 — **แก้บั๊กจริง: preview workbook เสีย merge ทั้งหมด (header ที่ user เห็นเละ)**
  - หลังจากพิสูจน์ก่อนหน้านี้ว่า `generated_files` ประเภท `processed_xlsx` มี header/merge
    ถูกต้องตรงกับ legacy ทุกจุด (ยืนยันด้วยการเทียบ `sheet.model.merges` ตรงๆ) user ส่ง screenshot
    จาก Microsoft Excel จริง (ไม่ใช่ browser preview) แสดง header แถว 8/9/10 ซ้ำกันครบทุกคอลัมน์
    ไม่มี merge เลย — เป็นการยืนยันว่ามีบั๊กจริง แต่เป็นคนละไฟล์กับที่ตรวจก่อนหน้า: title bar
    ระบุ "Preview-individual-single-20260730-075101" คือไฟล์ `preview_workbook` (ไฟล์ที่ปุ่ม
    "เปิดไฟล์" ใช้จริง) ไม่ใช่ `processed_xlsx` ที่ตรวจไปแล้ว
  - Root cause: `copyWorksheet()` ใน `workbookTransformService.js` (ใช้สร้าง preview workbook
    เท่านั้น) copy ค่า cell/style/row height/column width แต่**ไม่เคย copy merged ranges เลย**
    — ค่าที่อ่านจาก non-master cell ของ merge (ซึ่ง ExcelJS คืนค่า "echo" จาก master cell) ถูก
    เขียนเป็นค่าอิสระแยกกันในทุกเซลล์ของปลายทาง โดยไม่มีการ merge จริง ทำให้ Excel แสดง header
    ซ้ำทุกแถวแทนที่จะ merge เป็นก้อนเดียว
  - แก้: เพิ่ม `(sourceWorksheet.model.merges || []).forEach(range => targetWorksheet.mergeCells(range))`
    หลัง copy column widths ใน `copyWorksheet()` — ทั้งสอง repo
  - เพิ่ม regression test ใหม่ทั้งสอง repo: สร้าง worksheet มี vertical merge (A8:A10) +
    horizontal group merge (M8:P8) แล้วยืนยันว่า `copyWorksheet()` คง merge ไว้ (เช็ค
    `model.merges` และ `.master.address` ของทุก cell ในแต่ละ merge)
  - Test suite ผ่านครบหลังแก้ (backend 82/87 pass 5 skip, ClaspSCxSeamless 30/38 pass 8 skip)
  - ลบ 2 test processing_records เดิม (พร้อม backup
    `before-second-test-record-cleanup-2026-07-30T02-05-56-564Z.sql`) แล้ว reprocess
    `rep_summary_zone05 (8).xlsx`/`REP_individual_INS_2026072916562626.xlsx` ใหม่ผ่าน pipeline
    ที่แก้แล้ว — ดาวน์โหลด preview workbook จริงจาก R2 มาตรวจ `model.merges` ตรงๆ ยืนยันตรงกับ
    legacy ทุก coordinate ทั้งสองไฟล์
  - หมายเหตุ: URL ที่ได้จาก local reprocess (ไม่มี `RENDER_EXTERNAL_URL` ในเครื่อง) ยังเป็น
    relative อีกครั้ง — แก้ด้วย script เดิม (ตรง ๆ ไม่ผ่าน dry-run รอบนี้ เพราะเป็นการแก้ URL
    แบบเดียวกับที่ทดสอบซ้ำแล้วหลายรอบในวันเดียวกัน และเป็น record ที่เพิ่งสร้างเองทั้งหมด)
    ยืนยันแล้วว่าไม่มี relative URL เหลือ

- 2026-07-30 — **เปลี่ยน print-agent polling interval จากทุก 1 ชั่วโมง เป็นทุก 2 นาที**
  - เหตุผล: user ต้องการ feedback (ปริ้น/LINE/email สำเร็จหรือไม่) เร็วที่สุดเท่าที่ทำได้ เพื่อ
    ตัดสินใจว่าจะลองใหม่หรือรอ — bottleneck จริงคือรอบ poll ของ agent เอง ไม่ใช่การสื่อสาร
    client-server จึงไม่จำเป็นต้องใช้ WebSocket (ดูเหตุผลเต็มในบทสนทนา)
  - ประเมิน resource impact บน shared backend แล้ว: `GET /api/agent/print-queue` เป็น indexed
    SELECT เบา ๆ ไม่กี่ query, คืนเร็วมากเมื่อคิวว่าง (กรณีปกติ) — เทียบกับ traffic จริงจาก
    reactnjob/digitalpjk/scglamliff/sccrm/loyalty/crm/slider ถือว่า negligible; user ตกลงจะสังเกต
    resource consumption จริงหลังปรับใช้เพิ่มเติมเอง
  - อัปเดต `print-agent/README.md`: คำอธิบาย interval, PowerShell setup snippet
    (`RepetitionInterval` จาก `-Hours 1` เป็น `-Minutes 2`), เพิ่มขั้นตอนอัปเดต schedule ของ task
    ที่ตั้งไว้แล้วบนเครื่อง 000 ด้วย `Set-ScheduledTask` (ไม่ต้องลบ/สร้างใหม่), และเพิ่มคำอธิบาย
    ว่า backend ยิงอีเมลไปยัง `SEAMLESS_DOCS_RECIPIENT_EMAIL` ด้วยแล้ว (ไม่ใช่แค่ LINE)
  - `docs/09-auto-print-agent-design.md`/`docs/10-print-agent-tasks.md` ไม่ได้แก้ — เป็นเอกสาร
    design/history เดิม (ตาม convention เดิมของ ledger นี้คือไม่แก้ข้อความ history เก่า)
  - **ยังไม่ได้ทำจริงบนเครื่อง 000** — README มีคำสั่ง `Set-ScheduledTask` พร้อมใช้ รอ user/ผู้ดูแล
    เครื่อง 000 รันเอง แล้วสังเกต resource consumption ของ backend ต่อ

- 2026-07-30 — **Phase G จริงสำเร็จ + แก้บั๊ก page orientation เป็น Portrait ผิด (ควรเป็น Landscape)**
  - Phase G (บนเครื่อง 000 จริง): ตั้ง Task Scheduler ทุก 2 นาทีสำเร็จ (เจอบั๊กจริงระหว่างทาง —
    `[TimeSpan]::MaxValue` ทำให้ Task Scheduler XML invalid บน Windows Server 2019 เครื่องนี้ แก้
    ด้วย `New-TimeSpan -Days 3650` แทน), ทดสอบจริงด้วยการกดปุ่ม "สั่งปริ้น / ขอปริ้นใหม่" จาก
    dev laptop คนละเครื่อง — ยืนยันครบ 4 ทาง (print_jobs DB row, print-agent log, Windows
    Print Service Operational event log job 13 ~66MB 2 หน้า, ข้อความ LINE จริง) ว่าปริ้นสำเร็จ
    ครั้งเดียวไม่ซ้ำ (`attempt_no: 1`, `is_reprint: false`) ภายใน ~40 วินาทีจากตอนกดปุ่ม — ปิด
    phase G ทั้งหมด รวมถึงข้อกังวลเรื่อง WebSocket vs polling (สรุปว่า bottleneck คือ agent
    poll interval เอง ไม่ใช่ client-server communication จึงไม่จำเป็นต้องใช้ WebSocket)
  - บั๊กใหม่ที่พบระหว่างทดสอบจริง: PDF ที่ print-agent สร้าง (LibreOffice `--convert-to pdf`)
    ออกมาเป็น Portrait (595×842pt) ทั้งที่ควรเป็น Landscape — user ยืนยันด้วยการดาวน์โหลดไฟล์จริง
    2 ไฟล์ (individual + summary) ผ่าน `GET /api/files/:id/download` แล้วแปลง PDF ด้วยคำสั่งเดียว
    กับที่ print-agent ใช้จริง ตรวจ `/MediaBox` ตรงๆ
  - Root cause: ตรวจ legacy GAS source (`SeamlessXGASExcelFormatV2`) ทั้งหมด — ไม่มี
    `pageSetup`/`orientation`/`landscape` ใน code เลยสักที่ แต่ไฟล์ legacy reference จริงทั้ง 2
    ประเภท (individual/summary ที่โหลดมาก่อนหน้านี้) มี `pageSetup.orientation: "landscape"`
    ชัดเจน (พร้อม `fitToPage:false, fitToWidth:1, fitToHeight:1, scale:100, paperSize:9,
    margins 0.7/0.7/0.75/0.75 header/footer 0`) — สรุปว่าค่านี้ถูกตั้งไว้ครั้งเดียวผ่าน Google
    Sheets print-setup dialog บน template แล้ว exporter ของ Sheets serialize ติดมากับไฟล์ xlsx
    เอง ไม่ใช่ผลจาก script ใดๆ — ไฟล์ raw ที่ผู้ใช้อัปโหลดจริงไม่มี field พวกนี้เลย (portrait
    โดย omission) เทียบกับ ExcelJS default (`workbook.addWorksheet()` สดๆ) ก็ยืนยันว่า
    `fitToPage/fitToWidth/fitToHeight/scale` ตรงกับ default ของ ExcelJS อยู่แล้ว มีแค่
    `orientation` (ตัวบั๊กจริง) กับ `margins.header/footer` (default 0.3 แต่ legacy คือ 0) ที่ต้อง
    เปลี่ยนจริง
  - แก้: เพิ่ม `applyPageSetup(worksheet)` ใน `workbookTransformService.js` (ทั้งสอง repo)
    เรียกท้าย `transformWorkbook()` ตั้งค่าทุก field ตรงๆ (ไม่พึ่ง OOXML spec default แบบ
    implicit) — ทดสอบ dry-run กับไฟล์จริงทั้ง 2 ไฟล์ (rep_summary_zone05, REP_individual_INS)
    ยืนยัน `pageSetup` ตรงกับ legacy reference เป๊ะ
  - เพิ่ม regression test ทั้งสอง repo (`.each`/for-loop ทั้ง individual และ summary) ยืนยันค่า
    pageSetup ทุก field ตรงตาม legacy reference — test suite ผ่านครบ (backend 84/89 pass 5 skip,
    ClaspSCxSeamless 32/40 pass 8 skip, ไม่มี fail)
  - **ยังไม่ verify ระดับ PDF จริง** (ไม่มี LibreOffice บนเครื่อง dev ที่ใช้พัฒนา) — รอ deploy
    แล้วให้ user/เครื่อง 000 ทำ dry-run เดิม (ดาวน์โหลดไฟล์ที่ reprocess ใหม่ → แปลง PDF ด้วย
    soffice command เดิม → เช็ค `/MediaBox` width > height) เพื่อยืนยันปิด task นี้จริง

- 2026-07-30 — **เพิ่ม report title banner (สาขา/วันที่) บนหัวเอกสาร ให้บัญชีรู้ทันทีว่าเป็นไฟล์อะไร**
  - user ส่งไฟล์ตัวอย่างที่แก้เอง (`Preview-individual-single-20260730-090623 (3).xlsx`) แสดง
    merged cell ใหญ่ตัวหนา 48pt เขียนว่า "รายคน สาขา 004 {REP DATE}" ต่อจาก metadata เดิม
    (คอลัมน์ H เป็นต้นไป แถว 1-5) — ขอให้เพิ่มลง pipeline จริงโดยไม่แตะ processing เดิม
  - ยืนยัน design กับ user 3 จุด: wording ของ summary คือ "สรุป..." (แทน "รายคน" ที่หมายถึง
    รายบุคคลเท่านั้น), ตำแหน่ง merge ให้ตรงกับตัวอย่างเป๊ะ (ไม่ใช่ full-width banner แบบใหม่),
    รูปแบบวันที่คือ ค.ศ. DD/MM/YYYY (`27/07/2026`)
  - พบจุดสำคัญที่ต้องแก้จากตัวอย่าง: ตัวอย่าง user ใช้แถว 1-5 คงที่ทั้งสองประเภท แต่
    SUMMARY_HEADER_ROWS เริ่มที่แถว 5 จริง (ตาราง header จริงของ summary) — ถ้าใช้แถว 1-5 ตามแบบ
    จะทับ header จริงของ summary พอดี จึงต้องให้ summary จบที่แถว 4 แทน (individual ยังคงแถว
    1-5 ได้ปกติเพราะ header จริงเริ่มแถว 8) — และคอลัมน์สิ้นสุด (ตัวอย่างใช้ W ตายตัว) เปลี่ยนเป็น
    dynamic ตาม `bounds.right` จริงของแต่ละไฟล์ เพราะ individual/summary จบคนละคอลัมน์กัน
  - Implementation: `applyReportTitle()` ใหม่ใน `workbookTransformService.js` (ทั้งสอง repo) ใช้
    `buildOutputFilename()` เดิม (มีอยู่แล้วสำหรับตั้งชื่อไฟล์ output) ดึง branchCode/parsedDate
    มาสร้างข้อความหัวเรื่อง โดยไม่แตะ business logic ใดๆ ที่มีอยู่แล้ว — wrap ด้วย try/catch
    ผลัก warning แทนการ throw เพราะเป็นแค่ของตกแต่ง ไม่ควรทำให้การประมวลผลเอกสารจริงพัง
  - Export `columnLetter` จาก `workbookFormatting.js` เพิ่ม (เดิมเป็น private helper) เพื่อคำนวณ
    ขอบเขต merge แบบ dynamic
  - ทดสอบ dry-run กับไฟล์จริงทั้งสองไฟล์: individual ได้ "รายคน สาขา 004 วันที่ 27/07/2026"
    (merge H1:X5), summary ได้ "สรุป สาขา 004 วันที่ 29/07/2026" (merge H1:Y4) — ตรงตาม design
  - เพิ่ม regression test ทั้งสอง repo (individual + summary) ยืนยันข้อความ, font, และว่า merge
    ไม่ทับ header จริงของแต่ละ variant — test suite ผ่านครบ (backend 86/91 pass 5 skip,
    ClaspSCxSeamless 34/42 pass 8 skip, ไม่มี fail)
