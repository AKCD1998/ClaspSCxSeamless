# 08 Local Test Checklist

วันที่จัดทำ: 2026-04-30

เอกสารนี้เป็น checklist สำหรับทดสอบ PERN migration ในเครื่อง local ก่อน deploy และก่อนตัดสินใจเลิกใช้ Google Apps Script เดิม จุดประสงค์คือยืนยันว่า workflow ใหม่รักษา behavior สำคัญของระบบเดิมได้มากพอ และระบุช่องว่างที่ต้องทดสอบด้วยไฟล์จริง

## 1. Automated Test Commands

ติดตั้ง dependencies ก่อน:

```powershell
npm install
```

รันทั้งหมด:

```powershell
npm test
```

รันเฉพาะ backend:

```powershell
npm run test:server
```

รันเฉพาะ frontend:

```powershell
npm run test:client
```

Build frontend:

```powershell
npm run build:client
```

หมายเหตุบน Windows: ถ้า `npm` ถูก block ด้วย PowerShell execution policy ให้ใช้ `npm.cmd` เช่น:

```powershell
npm.cmd run test:server
```

## 2. Test Files Added

Server tests:

- `/server/tests/api.test.js`
- `/server/tests/workbook-transform.test.js`
- `/server/tests/import-csv.test.js`
- `/server/tests/processing-record-db.test.js`

Client tests:

- `/client/tests/app-render.test.mjs`
- `/client/tests/api-service.test.mjs`

## 3. Automated Test Coverage

| Focus | Automated coverage | Notes |
| --- | --- | --- |
| Health check endpoint | `server/tests/api.test.js` calls `GET /api/health` | Accepts `ok` or `degraded` so local DB outage is visible but does not fail basic test |
| Database connection | `GET /api/health` verifies database status envelope | Real DB write/read parity is opt-in with `TEST_DATABASE_URL` |
| Main API endpoints | bootstrap, workbook process validation, processing route shape | Full upload success still needs PostgreSQL and real `.xlsx` sample |
| Main UI pages render | `client/tests/app-render.test.mjs` renders React routes through Vite SSR | Checks home/history shell, upload panels, history panel |
| Form validation | API rejects missing file and non-`.xlsx` file | UI validation remains manual plus build/render tests |
| Data save/retrieve parity | `server/tests/processing-record-db.test.js` creates/lists one record when `TEST_DATABASE_URL` is set | Skipped by default to avoid writing to a non-test database |
| Document generation behavior | `server/tests/workbook-transform.test.js` creates in-memory `.xlsx` workbooks with ExcelJS | Covers individual deletion/highlight and summary ATK deletion |
| Data migration import script | `server/tests/import-csv.test.js` tests CSV parsing, headers, row normalization | Does not write DB |

## 4. Optional Database Parity Test

Use a disposable test database only:

```powershell
$env:TEST_DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@localhost:5432/<TEST_DB_NAME>"
npm run test:server
```

ก่อนรัน test นี้ต้อง apply schema:

```powershell
$env:DATABASE_URL=$env:TEST_DATABASE_URL
npm run db:migrate
npm run db:seed
```

ห้ามใช้ production database กับ `TEST_DATABASE_URL`

## 5. Local Manual Setup

1. ตั้งค่า `server/.env` จาก `server/.env.example`
2. ตั้งค่า `client/.env` หรือใช้ default:

```txt
VITE_API_BASE_URL=http://localhost:3001/api
```

3. Run migrations/seeds:

```powershell
npm run db:migrate
npm run db:seed
```

4. Start backend:

```powershell
npm run dev:server
```

5. Start frontend:

```powershell
npm run dev:client
```

6. เปิด:

```txt
http://localhost:5173
```

## 6. Manual Local Test Checklist

| Test case | Steps | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Backend health | Open `/api/health` | JSON contains `status`, `service`, `database` |  |  |
| Bootstrap config | Open `/api/bootstrap` | Returns app name, max upload 20MB, max batch 20, formatter modes |  |  |
| Frontend loads | Open `http://localhost:5173` | Hero, Individual panel, Summary panel, History panel render |  |  |
| Backend connection state | Load frontend with backend running | Status says backend connected |  |  |
| Backend unavailable state | Stop backend, refresh frontend | UI shows backend connection error and default config |  |  |
| Empty upload validation | Submit upload without choosing file | UI shows file required/selection error |  |  |
| Non-XLSX validation | Choose or send non-`.xlsx` file | Browser/API rejects with clear error |  |  |
| Batch limit validation | Select more than 20 `.xlsx` files | UI rejects before upload |  |  |
| Individual upload | Upload known individual sample | Output `.xlsx`, preview workbook link, history record |  | Need real sample |
| Summary upload | Upload known summary sample | Output `.xlsx`, preview workbook link, history record |  | Need real sample |
| Batch preview | Upload 2+ files in same panel | One preview workbook contains multiple sheets |  | Need real sample |
| Download output | Click output download link | Browser downloads generated `.xlsx` |  |  |
| Download preview | Click preview link | Browser downloads preview `.xlsx` |  | GAS opened Google Sheets; PERN currently downloads local `.xlsx` |
| History reload | Upload succeeds or press refresh | New record appears in history |  | Requires DB |
| History filters | Filter by report type/date/printed | Table/grouped view shows matching records |  |  |
| Mark printed | Click printed action and confirm | Record printed status becomes true and `printedAt` set |  | Requires DB |
| Mark unprinted | Click unprinted action and confirm | Record printed status becomes false and printed metadata clears |  | Requires DB |
| CSV dry-run | Run import script without `--commit` | Summary prints, no DB writes |  | Needs CSV and DB reachable for duplicate checks |
| CSV commit | Run import script with `--commit` on test DB | Rows imported, `migration_logs` updated |  | Use test DB only |

## 7. Manual GAS vs PERN Comparison Checklist

| GAS original behavior | PERN new behavior | Expected result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Upload individual `.xlsx` through GAS panel | Upload same file through React Individual panel | Same user flow and equivalent processed output |  |  |
| Upload summary `.xlsx` through GAS panel | Upload same file through React Summary panel | Same user flow and equivalent processed output |  |  |
| GAS rejects non-`.xlsx` | PERN rejects non-`.xlsx` | Clear user-facing validation error |  |  |
| GAS enforces max 20 files | PERN enforces max 20 files | Same batch limit |  |  |
| GAS creates Google Sheets preview | PERN creates local preview `.xlsx` | Preview remains usable for review before download |  | Behavior differs by storage/viewer |
| GAS appends batch files to one preview spreadsheet | PERN appends batch files to one preview workbook | One preview output per batch |  |  |
| GAS output filename individual pattern | PERN output filename individual pattern | `YYYY-MM-DD-{branch}-02 indiv exp.xlsx` when metadata is parseable |  |  |
| GAS output filename summary pattern | PERN output filename summary pattern | `YYYY-MM-DD-{branch}-02 sum exp.xlsx` when metadata is parseable |  |  |
| GAS deletes individual target columns | PERN deletes individual target columns | Columns `วันที่ลงทะเบียน` and `หมายเหตุอื่นๆ (STMID)` removed |  |  |
| GAS deletes summary `ATK` to right | PERN deletes summary `ATK` to right | `ATK` and right-side columns removed |  |  |
| GAS highlights exact 150 in individual money columns | PERN highlights exact 150 in same columns | Same cells highlighted |  |  |
| GAS applies font/wrap/row/column formatting | PERN applies ExcelJS formatting | Visually close enough for operator workflow |  | Must compare real files |
| GAS writes ProcessingRegistry row | PERN writes `processing_records` row | History field values equivalent |  |  |
| GAS history filters on client | PERN UI filters on client after API fetch | Same visible filter behavior |  |  |
| GAS mark printed uses script lock | PERN mark printed updates PostgreSQL | Status, timestamp, actor behavior equivalent enough |  | Actor may differ until auth exists |
| GAS preserves Drive file links | PERN stores local generated links and legacy Drive links from migration | User can access current generated output and historical links |  |  |
| GAS errors return through `google.script.run` failure handler | PERN errors return JSON error envelope | UI shows clear error |  |  |
| GAS registry CSV export | PERN import script maps to PostgreSQL | Imported row count and key fields match |  |  |

## 8. Acceptance Criteria Before Production

- All automated tests pass locally
- `/api/health` reports database `ok` in the target local/dev environment
- At least one real individual sample and one real summary sample pass end-to-end
- Generated `.xlsx` files are manually compared against GAS output
- Processing history records match expected report date/type/filename/printed behavior
- CSV import dry-run and test DB commit have been run before production import
- Known behavior differences are documented in `/docs/07-frontend-backend-integration.md`
