# 03 Database Design

วันที่จัดทำ: 2026-04-30

เอกสารนี้ออกแบบ PostgreSQL schema สำหรับ PERN version โดยยึด `/docs/01-gas-audit.md` และ `/docs/02-system-specification.md` เป็น source of truth เป้าหมายคือ preserve registry/history/output metadata จาก Google Apps Script เดิมก่อน แล้วค่อยปรับปรุงภายหลัง

ไฟล์ SQL ที่เกี่ยวข้อง:

- Migration: `/server/db/migrations/001_initial_schema.sql`
- Seed: `/server/db/seeds/001_seed_reference_data.sql`

## Summary

Schema แยกข้อมูลเป็นกลุ่มหลักดังนี้:

- `processing_records`: replacement ของ Google Sheet `ProcessingRegistry`
- `processing_batches` และ `workbook_uploads`: trace การ upload/batch ที่ระบบเดิมไม่ได้เก็บละเอียด
- `generated_files` และ `preview_sheets`: trace output `.xlsx`, preview workbook, legacy Drive/Sheets IDs/URLs
- `branch_mappings` และ `processing_record_branch_codes`: normalize branch code โดยยังเก็บ legacy string ไว้
- `operation_logs` และ `migration_logs`: audit/log ที่ระบบเดิมมีบางส่วนผ่าน console และ `lastAction`
- `app_settings`: เก็บ non-secret legacy configuration เช่น folder names/IDs และ limits เพื่อ migration traceability

ใช้ `uuid` primary keys ผ่าน `pgcrypto.gen_random_uuid()`, ใช้ `jsonb` สำหรับรายละเอียดที่ไม่ควร normalize เร็วเกินไป เช่น warnings, deleted column reports, transform summary และ metadata จาก import

## Design Principles

- Preserve first: ทุก field จาก registry เดิมมี mapping ชัดเจนใน `processing_records`
- Normalize moderately: branch codes แยก relation ได้ แต่ยังเก็บ `legacy_branch_codes` เพื่อเทียบ CSV เดิม
- Keep file traceability: ทุก source upload, processed file, preview workbook และ legacy Drive file มีที่เก็บ metadata
- Avoid premature user/auth model: เก็บ `uploaded_by`, `printed_by`, `created_by`, `actor` เป็น text เพราะระบบเดิมไม่มี user table
- Do not store secrets: `app_settings` มี `is_secret` flag แต่ seed ใส่เฉพาะ non-secret values
- Migration-safe: ไม่มี destructive SQL ต่อข้อมูลเดิม และ initial schema ใช้ `CREATE TABLE IF NOT EXISTS`

## Tables

### `app_settings`

เก็บ configuration และ legacy properties ที่ไม่ใช่ secret เช่น app name, upload limits, folder names, legacy folder IDs และ registry sheet names

เหตุผล: GAS เดิมใช้ `SXConfig`, Script Properties และ User Properties การมี table นี้ช่วยให้ import/migration trace ได้โดยไม่ต้อง hardcode ทุกอย่างใน application code

### `branch_mappings`

เก็บ mapping จาก HCODE/service source code เป็น branch code

Initial seed:

- `D1180` -> `001`
- `D6239` -> `003`
- `D5811` -> `004`

### `processing_batches`

ตัวแทนหนึ่งรอบการ submit จาก UI panel รองรับ batch single/multi และช่วย group preview workbook กับ uploads หลายไฟล์

สำคัญสำหรับ PERN เพราะระบบใหม่ควร trace ได้ว่าไฟล์หลายไฟล์ถูก process พร้อมกันและ share preview workbook เดียวกัน

### `processing_records`

table หลักสำหรับ history และ replacement ของ Google Sheet registry

Mapping จาก registry เดิม:

| GAS registry header | PostgreSQL column |
| --- | --- |
| `id` | `legacy_registry_id` และอาจใช้เป็น `id` หาก importer แปลงเป็น UUID ได้ |
| `reportDate` | `report_date_key` และ optional `report_date` |
| `reportType` | `report_type` |
| `filename` | `filename` |
| `driveFileId` | `legacy_drive_file_id` |
| `driveFileUrl` | `legacy_drive_file_url` |
| `uploadedAt` | `uploaded_at` |
| `uploadedBy` | `uploaded_by` |
| `printed` | `printed` |
| `printedAt` | `printed_at` |
| `printedBy` | `printed_by` |
| `sourceUploadName` | `source_upload_name` |
| `notes` | `notes` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `lastAction` | `last_action` |
| `branchCodes` | `legacy_branch_codes` plus normalized `processing_record_branch_codes` |

`legacy_row_number`, `legacy_registry_spreadsheet_id`, `legacy_registry_sheet_name` และ `migration_source` มีไว้เพื่อ trace กลับไป CSV/sheet เดิม

### `processing_record_branch_codes`

relation แบบ normalized ระหว่าง processing record กับ branch code ใช้ query dashboard/filter ได้ง่ายกว่า comma-separated string

ยังคง `processing_records.legacy_branch_codes` ไว้เพื่อ preserve exact value จากระบบเดิม

### `workbook_uploads`

เก็บ metadata ของ source upload และ processing result รายไฟล์ เช่น requested/detected/effective variant, status, warnings, deleted columns, highlight count

ระบบ GAS เดิมไม่ได้มี table นี้ แต่ข้อมูลเหล่านี้มีอยู่ใน response/log และจำเป็นสำหรับ parity/debug ใน PERN

### `generated_files`

เก็บไฟล์ที่เกี่ยวกับ document generation/output:

- source upload file
- processed `.xlsx`
- preview workbook
- legacy Drive file reference

เก็บได้ทั้ง local storage path, download/view URL, checksum, file size, expiry/deleted timestamps และ legacy Drive metadata

### `preview_sheets`

เก็บ sheet ที่อยู่ใน preview workbook เพื่อ preserve batch preview behavior:

- preview workbook หนึ่งไฟล์มีหลาย sheet
- sheet name ต้อง unique ใน preview เดียว
- sheet order ต้อง trace ได้
- legacy Google Sheet ID/spreadsheet ID เก็บได้เมื่อต้อง migrate preview เดิม

### `operation_logs`

audit event/log ของ operations สำคัญ เช่น upload processed, registry record updated, printed status changed, migration row skipped

เหตุผล: ระบบเดิมมี Apps Script console logs และ `lastAction` เท่านั้น PERN ควรมี persistent logs ขั้นต่ำเพื่อ debug และ audit

### `migration_logs`

เก็บ run summary ของ CSV/import migration เช่น records read/created/updated/skipped/failed และ error summary

ใช้สำหรับ Prompt 7 data migration script ต่อไป

## Index Strategy

Indexes ออกแบบตาม query ที่คาดว่าจะใช้:

- History list/filter:
  - `processing_records(report_type, report_date_key)`
  - `processing_records(printed)`
  - `processing_records(uploaded_at DESC)`
  - `processing_records(filename)`
  - `processing_records(legacy_drive_file_id)`
- Dashboard/group by branch:
  - `processing_record_branch_codes(branch_code)`
- Batch/upload trace:
  - `workbook_uploads(batch_id)`
  - `workbook_uploads(processing_record_id)`
  - `generated_files(batch_id)`
  - `generated_files(upload_id)`
  - `generated_files(processing_record_id)`
- File lookup:
  - `generated_files(file_kind)`
  - `generated_files(legacy_drive_file_id)`
- Logs:
  - `operation_logs(created_at DESC)`
  - `operation_logs(action)`
  - `operation_logs(processing_record_id)`
- Migration:
  - `migration_logs(started_at DESC)`

## Data Preservation Notes

- Old registry rows should be imported into `processing_records` first
- If old `id` is valid UUID, importer may set `processing_records.id`; otherwise store it in `legacy_registry_id` and generate new UUID
- Preserve old row numbers from CSV/Sheet in `legacy_row_number`
- Preserve legacy Drive URLs/IDs even if the actual file is not copied
- Preserve preview spreadsheet IDs/URLs as `generated_files` rows with `file_kind = 'preview_workbook'` and `storage_provider = 'google_drive'`
- Preserve exported XLSX Drive file IDs/URLs as `generated_files` rows with `file_kind = 'processed_xlsx'` when known
- Import `branchCodes` into both `processing_records.legacy_branch_codes` and `processing_record_branch_codes`
- Source `.xlsx` files may be unavailable due to 12-hour cleanup; missing source files should not block registry migration

## Rollback Notes

Initial schema rollback should be handled carefully because the tables will eventually contain migrated production history

Safe rollback before any data import:

1. Stop the backend service if it is running
2. Confirm the database has no important imported data
3. Drop objects in reverse dependency order:
   - `preview_sheets`
   - `generated_files`
   - `workbook_uploads`
   - `processing_record_branch_codes`
   - `operation_logs`
   - `migration_logs`
   - `processing_records`
   - `processing_batches`
   - `branch_mappings`
   - `app_settings`
   - trigger function `set_updated_at`
4. Keep `pgcrypto` installed unless no other database object uses it

Rollback after data import:

- Do not drop tables directly
- Take a database backup first with `pg_dump`
- Export `processing_records`, `generated_files`, `preview_sheets`, and migration logs to CSV before any destructive rollback
- Prefer forward migrations that add/alter columns instead of dropping the initial schema

## Open Design Decisions

- Storage backend is still open: local Ubuntu disk is assumed by schema through `storage_provider = 'local'`, but Google Drive or object storage can be represented
- Authentication is not designed yet; actor fields remain plain text
- Workbook library choice is not encoded in schema
- Retention policy for generated files is represented by `expires_at`/`deleted_at`, but operational cleanup rules will be defined later
