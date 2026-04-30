# 02 System Specification for PERN Rebuild

วันที่จัดทำ: 2026-04-30

เอกสารนี้สรุป specification ของระบบ Google Apps Script เดิมเพื่อใช้ rebuild เป็น PERN stack โดยยึดพฤติกรรมเดิมเป็นหลัก ขอบเขตคือการระบุระบบ, data model, workflow, business rules, API candidates และ PostgreSQL table candidates เท่านั้น ยังไม่ใช่ implementation code และยังไม่แทนที่ระบบเดิม

## 1. Current System Overview

ระบบเดิมคือ Apps Script web app ชื่อ `Seamless X GAS Excel Formatter` สำหรับอัปโหลด workbook `.xlsx` จาก Seamless/DMIS สองรูปแบบคือ `individual` และ `summary` แล้วปรับ formatting/export/preview/บันทึกประวัติ

Runtime และ platform:

- Google Apps Script V8
- Web app access: `ANYONE_ANONYMOUS`
- Execute as: `USER_DEPLOYING`
- Frontend: HTML/CSS/vanilla JavaScript
- Backend: Apps Script functions เรียกผ่าน `google.script.run`
- Storage/output: Google Drive, Google Sheets, Script/User Properties

End-to-end behavior:

1. Browser รับไฟล์ `.xlsx` จากผู้ใช้
2. Browser แปลงไฟล์เป็น base64 payload
3. Server decode เป็น blob
4. Server upload/convert `.xlsx` เป็น Google Sheets ชั่วคราว
5. Server ตรวจชนิด workbook เป็น `individual` หรือ `summary`
6. Server ปรับ sheet ด้วย formatting rules
7. Server export processed sheet/workbook เป็น `.xlsx`
8. Server copy processed sheet เข้า preview spreadsheet
9. Serverบันทึกหรือ update processing history ใน registry spreadsheet
10. Browser แสดง link download, preview link, warnings และ history

PERN version ต้องเลียนแบบ behavior นี้ก่อน แล้วจึงค่อยปรับปรุง UX/architecture ภายหลัง

## 2. User Roles

| Role | Current behavior | PERN requirement |
| --- | --- | --- |
| Uploader/User | เข้าหน้า web app ได้แบบ anonymous, อัปโหลด individual/summary, ดูผลลัพธ์และ history | ต้องสามารถทำ workflow เดิมได้อย่างน้อยเท่าระบบเดิม |
| Print/Admin operator | ใช้ history dashboard/table/grouped view และ mark printed/unprinted | ต้องจัดการสถานะ print ได้เหมือนเดิม |
| System owner/deployer | เป็น account ที่ Apps Script execute as และมีสิทธิ Drive/Sheets | ใน PERN ต้องเป็น server/operator ที่ถือ env vars, DB credentials, file storage permissions |
| Future authenticated user | ยังไม่มีในระบบเดิม | เป็น open question; ถ้าเพิ่ม auth ต้องไม่ทำลาย workflow เดิมโดยไม่ตั้งใจ |

ระบบเดิมไม่ได้แยก role ด้วย permission จริงใน UI หรือ backend ทุกคนที่เข้าถึง URL ใช้ความสามารถเดียวกันได้

## 3. Main Workflows

### 3.1 Upload Individual Workbook

Trigger: ผู้ใช้เลือกไฟล์ใน `Individual Formatter`

Input:

- `.xlsx` 1-20 ไฟล์
- formatter mode fixed เป็น `individual`

Expected flow:

1. UI filter เฉพาะไฟล์นามสกุล `.xlsx`
2. UI แสดง selected file label
3. เมื่อ submit, UI validate ว่ามีไฟล์และไม่เกิน `MAX_BATCH_FILES`
4. UI process ทีละไฟล์แบบ sequential
5. ไฟล์แรกไม่มี `previewSpreadsheetId`; server สร้าง preview ใหม่
6. ไฟล์ถัดไปส่ง `previewSpreadsheetId` จากไฟล์ก่อนเพื่อรวม sheet ใน preview เดียว
7. Server convert/transform/export/register แต่ละไฟล์
8. UI แสดง success/failure รายไฟล์, warnings, download links, preview workbook link
9. UI reload history

Success criteria:

- ได้ output `.xlsx` สำหรับแต่ละไฟล์ที่สำเร็จ
- ได้ preview workbook link เดียวสำหรับ batch เดียวกัน
- processing history มี record ของ preview output
- ถ้า requested/detected variant ไม่ตรงกัน ต้องมี warning แต่ยังใช้ requested `individual`

### 3.2 Upload Summary Workbook

เหมือน workflow individual แต่ formatter mode fixed เป็น `summary`

Success criteria:

- Output filename ลงท้าย `sum exp.xlsx` เมื่อ parse date/branch ได้
- Summary transform ลบ column ตั้งแต่ `ATK` ถึงขวาสุด
- Preview/history ใช้ report type `summary`

### 3.3 Batch Preview Creation

Batch behavior ปัจจุบัน:

- Process ทีละไฟล์ ไม่ parallel
- Preview spreadsheet name เป็น `Preview-{mode}-{single|multi}-YYYYMMDD-HHmmss`
- ไฟล์หลายไฟล์ใน batch เดียวกันถูก copy เป็นหลาย sheet ใน preview spreadsheet เดียว
- Sheet name derived จาก output filename และตัดไม่เกิน 80 chars; ถ้าซ้ำให้เติม suffix ` (2)`, ` (3)`, ...

PERN version ต้องมี batch concept ที่ preserve ความสัมพันธ์:

- batch หนึ่งมีหลาย uploads
- batch หนึ่งมี preview workbook หนึ่งรายการ
- output files ยังแยกตาม upload

### 3.4 Processing History

Current UI load:

- เรียก `fetchProcessingHistory({})`
- เก็บ records ทั้งหมดไว้ใน browser memory
- filter ฝั่ง client ด้วย report type, report date, printed status
- แสดง dashboard grouped by `reportDate`
- แสดง table view และ grouped view

PERN version:

- ควรรองรับ server-side filters เพื่อ scale ได้ แต่ response ต้องยังรองรับ UI เดิม
- ค่า default ที่เทียบเท่าระบบเดิมคือ return records ล่าสุดเรียงจากใหม่ไปเก่า

### 3.5 Mark Printed / Unprinted

Current behavior:

- User กดปุ่มใน history
- Browser แสดง confirm message
- Server update registry record ด้วย lock
- Mark printed:
  - `printed = true`
  - `printedAt = now`
  - `printedBy = current actor ถ้ามี`
  - `lastAction = marked_printed`
- Mark unprinted:
  - `printed = false`
  - `printedAt = ''`
  - `printedBy = ''`
  - `lastAction = marked_unprinted`

PERN version ต้อง update แบบ atomic และ reload/display record ที่ update แล้ว

## 4. Data Entities

### 4.1 Workbook Upload

ตัวแทนของไฟล์ source ที่ผู้ใช้อัปโหลด

Key properties:

- original filename
- MIME type
- byte size
- requested formatter mode
- detected formatter mode
- effective formatter mode
- batch relationship
- processing status
- warnings/errors

ระบบเดิมไม่ได้เก็บ upload เป็น entity แยกถาวร ยกเว้น `sourceUploadName` ใน registry แต่ PERN ควรมีเพื่อ traceability

### 4.2 Processing Batch

ตัวแทนการ submit หลายไฟล์พร้อมกันจาก upload panel เดียว

Key properties:

- report type/mode requested by panel
- file count
- started/finished timestamps
- preview workbook relationship
- success/failure counts

### 4.3 Processed Workbook Output

ไฟล์ `.xlsx` ที่ระบบ export หลัง transform

Key properties:

- output filename
- file storage path หรือ object key ในระบบใหม่
- legacy Drive file ID/URL ถ้ามาจาก migration
- download URL
- report type
- parsed report date
- branch code(s)
- transform statistics เช่น deleted columns, highlight count

### 4.4 Preview Workbook

Workbook สำหรับให้ผู้ใช้เปิดตรวจหลาย processed sheets

Key properties:

- preview filename
- batch mode `single`/`multi`/`legacy`
- report type
- report date ที่ parse จาก filename ถ้ามี
- timestamp ใน filename
- storage path หรือ legacy Drive spreadsheet ID/URL
- sheet list

### 4.5 Preview Worksheet

Sheet ที่ copy เข้า preview workbook

Key properties:

- preview workbook ID
- source upload/output relationship
- sheet name
- sheet order
- legacy sheet ID ถ้ามาจาก Google Sheets

### 4.6 Processing Record

entity หลักที่ map จาก registry spreadsheet เดิม

Current fields:

- `id`
- `reportDate`
- `reportType`
- `filename`
- `driveFileId`
- `driveFileUrl`
- `uploadedAt`
- `uploadedBy`
- `printed`
- `printedAt`
- `printedBy`
- `sourceUploadName`
- `notes`
- `createdAt`
- `updatedAt`
- `lastAction`
- `branchCodes`

PERN version ต้อง preserve field เหล่านี้หรือมี legacy mapping ที่ชัดเจน

### 4.7 Branch Mapping

Map service/HCODE source เป็น branch code

Current map:

- `D1180` -> `001`
- `D6239` -> `003`
- `D5811` -> `004`

### 4.8 Transform Rule/Profile

ไม่จำเป็นต้องเป็น table ใน v1 ถ้า hardcode ตามระบบเดิม แต่ต้องระบุเป็น behavior:

- individual profile
- summary profile
- deletion headers
- highlight headers
- fixed widths/heights
- print intent

### 4.9 Processing Log / Audit Event

ระบบเดิม log ผ่าน Apps Script console และ `lastAction` ใน registry แต่ไม่มี table log แยก PERN ควรมี audit events สำหรับ operations สำคัญ เช่น upload processed, record updated, printed status changed, import migrated row

## 5. Field Definitions

### 5.1 Processing Record Fields

| Field | Type concept | Required | Current format/behavior |
| --- | --- | --- | --- |
| `id` | UUID/string | yes | `Utilities.getUuid()` ถ้าไม่ได้ส่งมา |
| `reportDate` | date key | yes by default | registry ใช้ `YYYYMMDD`; fallback เป็นวันนี้ตาม script timezone |
| `reportType` | enum | yes | `summary` หรือ `individual` |
| `filename` | string | yes | preview filename ใน registry upsert |
| `driveFileId` | string | yes | Google Drive file/spreadsheet ID เดิม |
| `driveFileUrl` | string | derived if empty | Drive file URL หรือ spreadsheet URL |
| `uploadedAt` | ISO datetime | default now | เวลา upload/registry write |
| `uploadedBy` | string/email | optional | `Session.getActiveUser().getEmail()` ถ้าอ่านได้ |
| `printed` | boolean | yes | default false |
| `printedAt` | ISO datetime/string empty | optional | set เมื่อ mark printed; clear เมื่อ unprinted |
| `printedBy` | string/email | optional | actor หรือ uploadedBy เมื่อ mark printed |
| `sourceUploadName` | string | optional | original `.xlsx` filename |
| `notes` | string | optional | manual/system notes |
| `createdAt` | ISO datetime | yes | default now |
| `updatedAt` | ISO datetime | yes | default now และเปลี่ยนทุก update |
| `lastAction` | string | optional | เช่น `uploaded_created`, `uploaded_updated`, `marked_printed` |
| `branchCodes` | string/list concept | optional | current stored เป็น comma-separated sorted `NNN` |

### 5.2 Upload Payload Fields

| Field | Required | Current behavior |
| --- | --- | --- |
| `file.originalFilename` | yes | fallback `workbook.xlsx`; ต้องลงท้าย `.xlsx` |
| `file.mimeType` | optional | fallback `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `file.size` | yes concept | ใช้ตรวจ empty และ max 20MB |
| `file.base64` | yes | decode ด้วย `Utilities.base64Decode` |
| `formatterMode` | optional but UI sends | parse เป็น `individual`/`summary`; invalid แล้ว error |
| `previewSpreadsheetId` | optional | ใช้ append preview batch |
| `batchFileCount` | optional | normalize เป็นอย่างน้อย 1 |

PERN version ควรรับ `multipart/form-data` สำหรับไฟล์จริง แต่ response และ business behavior ต้องเทียบเท่า payload เดิม

### 5.3 Upload Result Fields

Current success response includes:

- `ok`
- `filename`
- `variant`
- `requestedVariant`
- `detectedVariant`
- `warnings`
- `deletedColumns`
- `highlightCount`
- `driveFileId`
- `downloadUrl`
- `viewUrl`
- `previewSpreadsheetId`
- `previewUrl`
- `previewSheetId`
- `previewSheetName`

PERN response ควรคงชื่อ field ที่ UI ต้องใช้ หรือมี adapter ชัดเจน:

- `filename`
- `variant`
- `detectedVariant`
- `warnings`
- `downloadUrl`
- `previewWorkbookId`
- `previewUrl`
- `previewSheetName`

### 5.4 Deleted Column Report Fields

- `headerText`
- `matchedText`
- `strategy`
- `start`
- `count`
- `columnLabel`

## 6. Business Rules

### 6.1 File Acceptance

- รับเฉพาะ `.xlsx`
- Empty upload ต้อง error
- ขนาดเกิน 20MB ต้อง error
- Batch เกิน 20 ไฟล์ต้อง error ฝั่ง UI; backend ควร enforce ซ้ำ

### 6.2 Variant Rules

- Requested mode จาก UI มี priority เหนือ detected mode
- ถ้า requested mode ไม่ตรง detected mode ต้องเพิ่ม warning และใช้ requested mode ต่อ
- ถ้าไม่มี requested mode:
  - sheet name `summary`/`sum` หรือพบ header `ATK` ที่แถว 5 -> `summary`
  - otherwise -> `individual`

### 6.3 Individual Transform Rules

- Header rows: 8, 9, 10
- Table range: header `ลำดับที่` ถึง `หมายเหตุ`
- Delete columns whose headers match:
  - `วันที่ลงทะเบียน`
  - `หมายเหตุอื่นๆ (STMID)`
- Highlight exact value `150` in columns whose headers match:
  - `ราคาต่อหน่วย`
  - `ราคาเพดาน`
  - `รวมเงินที่ขอเบิก`
  - `ชดเชย`
  - `ไม่ชดเชย`
  - `จ่ายเพิ่ม`
  - `เรียกคืน`
- Highlight style:
  - background `#ffc7ce`
  - font color `#9c0006`
- Apply table borders to final table range

### 6.4 Summary Transform Rules

- Header rows: 5, 6, 7, 8, 9, 10
- Detect deletion start header `ATK` on configured deletion header row(s)
- Delete `ATK` column and all columns to the right
- Final table range is used range after deletion
- No `150` highlight behavior

### 6.5 Formatting Rules

- Font family: `AngsanaUPC`
- Font size: `9`
- Header rows wrapped and vertically middle aligned
- Column widths calculated from display text and merged cells
- Widths fit target printable width:
  - target width inches: `9.6`
  - DPI: `96`
- Individual fixed row heights:
  - row 8: 15
  - row 9: 15
  - row 10: 15
- Fixed individual column widths exist for known Thai headers
- Print intent uses frozen rows because Apps Script cannot set full page setup reliably

### 6.6 Filename Rules

Individual:

- Primary date source: `C5`, parsed as Thai Buddhist/Gregorian date text
- Fallback date source: scan rows 1-10, columns 1-6
- Branch source: first usable value in `HCODE` column mapped through branch map
- Success pattern: `YYYY-MM-DD-{branchCode}-02 indiv exp.xlsx`
- If date or branch missing: fallback `{sanitized-original}-processed.xlsx` and warning

Summary:

- Primary date source: `C3`, parsed as `dd/mm/yyyy` with optional `เวลา HH:mm`
- Primary branch source: `C11`
- Fallback scan:
  - branch column header `รหัสหน่วยบริการ`
  - date column header `REP Date`
  - scan from row 11
- Success pattern: `YYYY-MM-DD-{branchCode}-02 sum exp.xlsx`
- If date or branch missing: fallback `{sanitized-original}-processed.xlsx` and warning

### 6.7 Registry Rules

- Registry exact filename match updates existing row
- Same reportDate/reportType but different preview filename remains a separate row for audit traceability
- Registry records are sorted by uploaded/updated/created timestamp descending in list responses
- Headers must match expected schema; mismatch throws error
- Branch codes are normalized to unique sorted three-digit codes

## 7. Document Generation Rules

In this project, "document generation" means workbook output and preview generation, not Google Docs text templates

### 7.1 Conversion

- Input `.xlsx` is converted to a Google Sheets spreadsheet in the current GAS system
- PERN equivalent must import `.xlsx` while preserving enough workbook structure for:
  - sheet values/display values
  - merged cells
  - row/column dimensions
  - styles required by transform

### 7.2 Processed XLSX Output

- Output is a `.xlsx` file for each input file
- Output must preserve transformed first worksheet behavior
- Output must include:
  - deleted target columns
  - adjusted merges after deletion
  - font settings
  - header wrapping
  - column widths
  - row heights
  - borders for individual table
  - highlight style for exact `150` values in individual reports

### 7.3 Preview Workbook

- Preview contains copied processed sheets
- Single file batch creates preview name with `single`
- Multi file batch creates preview name with `multi`
- Preview sheet name is derived from output filename and made unique
- Preview workbook should be openable from UI
- In PERN, preview may be implemented as generated `.xlsx`, web preview, or stored file, but it must support the same user decision point: "open preview workbook before using/downloaded output"

### 7.4 Generated File Retention

- GAS workspace cleanup trashes files older than 12 hours
- PERN must define explicit retention for temporary uploads/outputs/previews
- Migrated historical records must not be deleted by temp cleanup

## 8. Validation Rules

### 8.1 Upload Validation

- File required
- Extension must be `.xlsx`
- Size must be greater than 0
- Size must be <= 20MB
- Batch count must be <= 20
- Formatter mode must be empty, `individual`, `indiv`, `summary`, or `sum`
- Base64 decode failure is user-facing error in GAS; PERN should return HTTP 400

### 8.2 Registry Record Validation

- `id` required for updates
- `filename` required for create/upsert
- `driveFileId` currently required in GAS create/upsert; PERN equivalent should require either new storage file ID/path or legacy Drive ID during migration
- `reportType` must normalize to `summary` or `individual`
- `reportDate` accepted current formats:
  - `YYYYMMDD`
  - `YYYY-MM-DD`
  - fallback extracted from filename/sourceUploadName
- `printed` accepts boolean-like values in migration/import:
  - true values include `true`, `1`, `yes`
  - false otherwise
- `branchCodes` accepts string/array but stores only unique `NNN` tokens

### 8.3 History Filter Validation

- `reportType`: empty, `summary`, `individual`
- `reportDate`: empty, `YYYYMMDD`, or `YYYY-MM-DD` converted to `YYYYMMDD`
- `printed`: empty/null, true, false
- `limit`: positive integer if supplied

### 8.4 Workbook Content Validation

- Workbook must contain at least one worksheet
- First worksheet must contain at least one populated cell
- Missing deletion/highlight/table headers should produce warnings where current GAS uses warnings
- Fatal errors should be limited to cases where processing cannot continue

## 9. UI Pages and Components

PERN React UI should initially preserve the single-page shape of `src/client/App.html`

### 9.1 Main App Shell

- Header/hero section with Thai intro copy
- Bootstrap config equivalent:
  - app name
  - max upload MB
  - retention hours
  - max batch files

### 9.2 Upload Panel Component

Reusable for individual and summary:

- panel eyebrow/title/copy
- hidden or prop-based formatter mode
- file input with multiple `.xlsx`
- selected file label
- submit button
- status area
- warnings list
- result summary
- preview link
- result download list

### 9.3 History Panel Component

Subcomponents:

- filter form:
  - report type select
  - report date input `YYYYMMDD`
  - printed status select
  - apply/clear buttons
- refresh button
- dashboard table by report date
- table/grouped segmented view toggle
- table view rows
- grouped view sections
- printed/unprinted action buttons

### 9.4 UI States

Required states:

- idle
- selected files
- busy/processing file N of total
- success with all files
- success with warnings
- partial failure
- total failure
- history loading
- history empty
- history error
- action confirmation
- action updating

## 10. Server-side Functions and Responsibilities

### Current GAS Functions

| Current function/module | Responsibility | PERN equivalent |
| --- | --- | --- |
| `doGet` / `SXRoutes.doGet` | render web app shell and bootstrap | React served by Vite/Nginx; backend `/api/bootstrap` |
| `processWorkbookPayload` | process base64 workbook upload | `POST /api/workbooks/process` |
| `SXWorkbookPipeline.processUpload_` | orchestration across cleanup, conversion, transform, export, preview, registry | service-level transaction/workflow coordinator |
| `SXDriveConversion` | convert `.xlsx` to Google Sheets | XLSX import service using selected Node workbook library |
| `SXTransformWorkbook` | apply variant transform pipeline | workbook transform service |
| `SXTransformIndiv` | individual-specific rules | individual transform module |
| `SXTransformSummary` | summary-specific rules | summary transform module |
| `SXFormatting` | styling and sizing | formatting adapter around workbook library |
| `SXFilenameBuilder` | parse metadata and output filenames | filename/metadata service |
| `SXPreviewService` | create/append preview spreadsheet | preview workbook service |
| `SXExportService` | export processed file | file storage/export service |
| `SXProcessingRegistryService` | history records and printed state | processing record repository/service |
| `SXCleanup` | cleanup temp workspace files | scheduled/temp-file cleanup service |
| `SXLogger` | operation logging | structured logger |
| `SXWarnings` | warnings collection | warnings helper |

### PERN Backend Responsibilities

- Accept file uploads safely
- Validate request limits
- Store original upload or temporary upload for processing
- Parse workbook and detect variant
- Apply transform rules
- Generate processed `.xlsx`
- Generate or update preview workbook
- Persist processing records in PostgreSQL
- Preserve legacy metadata during migration
- Return UI-compatible result payloads
- Provide history list/filter APIs
- Provide printed/unprinted update APIs
- Log meaningful operations and errors

## 11. Required API Endpoints for Express Backend

API names are proposed for rebuild; exact route names can be adjusted later, but behavior must be preserved

### 11.1 Bootstrap

`GET /api/bootstrap`

Returns:

- `appName`
- `maxUploadMb`
- `retentionHours`
- `maxBatchFiles`
- supported formatter modes

### 11.2 Process Workbooks

`POST /api/workbooks/process`

Request:

- `multipart/form-data`
- fields:
  - `files[]`
  - `formatterMode`
  - optional `batchId` or `previewWorkbookId`

Behavior:

- Process files sequentially by default
- Return per-file successes/failures
- Create or append preview workbook

Response concept:

- `ok`
- `successes[]`
- `failures[]`
- `previewState`
- `warnings[]`

### 11.3 Process Single Workbook

`POST /api/workbooks/process-one`

Optional internal/API-compatible endpoint mirroring current `processWorkbookPayload`

Request:

- one file
- `formatterMode`
- optional `previewWorkbookId`
- `batchFileCount`

Response should map closely to current GAS upload result fields

### 11.4 Discard Preview

`DELETE /api/previews/:previewWorkbookId`

Behavior:

- Delete/trash temp preview if allowed
- Must not delete migrated historical preview files unless explicitly configured

### 11.5 List Processing History

`GET /api/processing-records`

Query:

- `id`
- `filename`
- `reportType`
- `reportDate`
- `driveFileId` or legacy ID
- `printed`
- `limit`

Response:

- array of processing records sorted newest first

### 11.6 Get Processing Record

`GET /api/processing-records/:id`

Response:

- one processing record or 404

### 11.7 Create Processing Record

`POST /api/processing-records`

Purpose:

- preserve admin/import/testing equivalent of `createProcessingRecord`
- not required for normal UI if records are created by workbook processing

### 11.8 Update Processing Record

`PATCH /api/processing-records/:id`

Purpose:

- preserve equivalent of `updateProcessingRecord`
- validate patch fields

### 11.9 Mark Printed

`POST /api/processing-records/:id/mark-printed`

Request:

- optional `printedBy`

Response:

- `ok`
- `message`
- `record`

### 11.10 Mark Unprinted

`POST /api/processing-records/:id/mark-unprinted`

Response:

- `ok`
- `message`
- `record`

### 11.11 File Downloads

`GET /api/files/:fileId/download`

Behavior:

- Serve generated `.xlsx`
- For migrated legacy Drive-only files, either redirect to legacy URL or return clear not-available response depending on migration decision

### 11.12 Health Check

`GET /api/health`

Returns:

- backend status
- database connectivity status if lightweight enough

## 12. Required PostgreSQL Tables

Actual SQL belongs in the database design step; this section defines required table concepts and important fields

### 12.1 `processing_records`

Primary replacement for Google Sheet registry

Important fields:

- `id`
- `report_date`
- `report_type`
- `filename`
- `legacy_drive_file_id`
- `legacy_drive_file_url`
- `uploaded_at`
- `uploaded_by`
- `printed`
- `printed_at`
- `printed_by`
- `source_upload_name`
- `notes`
- `created_at`
- `updated_at`
- `last_action`
- `legacy_branch_codes`
- `legacy_row_number`
- `migration_source`

### 12.2 `processing_batches`

Tracks multi-file submission and preview grouping

Important fields:

- `id`
- `formatter_mode`
- `batch_mode`
- `file_count`
- `success_count`
- `failure_count`
- `started_at`
- `finished_at`
- `created_by`

### 12.3 `workbook_uploads`

Tracks source uploads

Important fields:

- `id`
- `batch_id`
- `processing_record_id`
- `original_filename`
- `mime_type`
- `file_size_bytes`
- `requested_variant`
- `detected_variant`
- `effective_variant`
- `status`
- `error_message`
- `created_at`

### 12.4 `generated_files`

Tracks output files and preview files/sheets stored by PERN

Important fields:

- `id`
- `processing_record_id`
- `batch_id`
- `upload_id`
- `file_kind` (`source_upload`, `processed_xlsx`, `preview_workbook`)
- `filename`
- `mime_type`
- `storage_path`
- `download_url`
- `legacy_drive_file_id`
- `legacy_drive_file_url`
- `file_size_bytes`
- `created_at`

### 12.5 `preview_sheets`

Tracks sheets inside preview workbook

Important fields:

- `id`
- `preview_file_id`
- `upload_id`
- `processing_record_id`
- `sheet_name`
- `sheet_order`
- `legacy_sheet_id`
- `created_at`

### 12.6 `branch_mappings`

Stores service code to branch code mapping

Important fields:

- `id`
- `source_code`
- `branch_code`
- `label`
- `active`
- `created_at`
- `updated_at`

Initial data must include:

- `D1180` -> `001`
- `D6239` -> `003`
- `D5811` -> `004`

### 12.7 `processing_record_branch_codes`

Normalized relation between processing records and branch codes

Important fields:

- `processing_record_id`
- `branch_code`

Keep `legacy_branch_codes` on `processing_records` for traceability and exact migration comparison

### 12.8 `operation_logs`

Audit/log table for meaningful actions

Important fields:

- `id`
- `scope`
- `level`
- `action`
- `message`
- `metadata`
- `processing_record_id`
- `upload_id`
- `created_at`

### 12.9 `migration_logs`

Tracks CSV/import migration runs

Important fields:

- `id`
- `source_name`
- `source_type`
- `started_at`
- `finished_at`
- `status`
- `records_read`
- `records_created`
- `records_updated`
- `records_skipped`
- `error_summary`

## 13. Migration Assumptions

- Original GAS files remain in repo and are not deleted during migration
- Processing registry can be exported to CSV with exact headers
- Current registry rows are source of truth for history migration
- Existing Drive URLs/IDs should be preserved as legacy metadata even if PERN stores new files elsewhere
- Uploaded original `.xlsx` files may not all be available because workspace cleanup may have trashed old files
- Preview spreadsheets in archive folder may need manual export/listing if they must be preserved
- `reportDate` in PostgreSQL should support querying as date, but migration must preserve original `YYYYMMDD` value
- Branch codes should be normalized in PostgreSQL but original comma-separated string should be retained
- Node workbook library selection must be validated against real sample `.xlsx` files before claiming parity
- Authentication is not specified by the current system; first rebuild should preserve access behavior only if accepted by owner
- No real passwords, tokens, SSH credentials, or Google credentials should be stored in repo docs or examples

## 14. Open Questions

1. Where is the live `SX_PROCESSING_REGISTRY_SPREADSHEET_ID` stored, and can it be exported before migration?
2. Should the PERN app remain anonymous like the GAS web app, or require login?
3. What storage backend should replace Google Drive for generated files: local disk on Ubuntu, S3-compatible storage, or Google Drive retained temporarily?
4. What Node workbook library will match `SpreadsheetApp` formatting/export closely enough for `.xlsx` parity?
5. Are there real sample individual/summary `.xlsx` files available for parity tests?
6. Are branch mappings limited to `D1180`, `D6239`, `D5811`, or should more mappings be imported from another source?
7. Should historical preview spreadsheets be migrated as downloadable files, web previews, or legacy Drive links only?
8. Should server-side history filters exactly match current client-side filtering, including edge cases for invalid dates?
9. Should generated file retention stay 12 hours for new temporary outputs, or should PERN retain outputs longer?
10. Who should be recorded as `uploadedBy`/`printedBy` when there is no authenticated PERN user?
11. Should fallback filename behavior remain exactly `{sanitized-original}-processed.xlsx`, or should PERN add collision-safe suffixes?
12. Should registry upsert continue to match only exact preview filename, or should PERN add uniqueness constraints by report date/type?
13. Should UI Thai copy and typos be preserved exactly in v1 React migration, then corrected later?
14. What is the production domain/URL and Nginx path layout for final deployment?

## 15. Acceptance Criteria for This Specification

- PERN implementer can identify core workflows without rereading every GAS file
- Required fields from the processing registry are explicitly captured
- Known workbook transform rules are documented
- Future Express API surface is defined at behavior level
- Required PostgreSQL table concepts are identified without writing SQL yet
- Open questions are explicit where repository inspection cannot answer them
