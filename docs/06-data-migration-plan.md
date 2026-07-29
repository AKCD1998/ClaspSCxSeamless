# 06 Data Migration Plan

วันที่จัดทำ: 2026-04-30

เอกสารนี้เป็นแผนย้ายข้อมูลจาก Google Apps Script / Google Sheets เดิมไป PostgreSQL สำหรับ PERN version โดยยึด `/docs/01-gas-audit.md`, `/docs/02-system-specification.md` และ schema ใน `/docs/03-database-design.md` เป็น source of truth

ขอบเขตของขั้นนี้:

- สมมติว่า Google Sheet เดิม export เป็น CSV ได้
- สร้าง mapping จาก CSV/export เดิมไป PostgreSQL table ใหม่
- สร้างสคริปต์ import แบบ non-destructive เป็นค่าเริ่มต้น
- Preserve old IDs, row numbers, Drive IDs/URLs และ metadata สำหรับ traceability
- ไม่รัน destructive command และไม่ overwrite records เว้นแต่ผู้รันส่ง flag ชัดเจน

## 1. Source of Truth

แหล่งข้อมูลหลักที่ต้อง migrate ก่อนคือ Google Sheet registry:

| Source | Location เดิม | Status |
| --- | --- | --- |
| `ProcessingRegistry` sheet | Registry spreadsheet ที่ Apps Script ใช้เก็บ history | Required |
| Drive preview/output file metadata | Google Drive workspace / preview archive folder | Optional แต่ควรเก็บถ้าต้อง preserve link เดิม |
| Preview sheet inventory | Google Sheets preview workbooks | Optional สำหรับ trace sheet-level preview |
| Branch mapping | Hardcoded ใน `SXBranchCodeMap` | Seed แล้ว แต่ import เพิ่มได้ถ้ามี source ภายนอก |

ข้อมูล source `.xlsx` เดิมอาจไม่ครบ เพราะ GAS cleanup ลบ/ย้ายไฟล์ใน workspace ตาม retention 12 ชั่วโมง ดังนั้น registry CSV ต้องถือเป็น minimum migration set

## 2. CSV Exports Required

### 2.1 `ProcessingRegistry.csv`

Export จาก sheet name `ProcessingRegistry` โดยต้องคง header ตามระบบเดิม:

```txt
id,reportDate,reportType,filename,driveFileId,driveFileUrl,uploadedAt,uploadedBy,printed,printedAt,printedBy,sourceUploadName,notes,createdAt,updatedAt,lastAction,branchCodes
```

Mapping:

| CSV column | Target table | Target column |
| --- | --- | --- |
| `id` | `processing_records` | `id` ถ้าเป็น UUID, และ `legacy_registry_id` |
| row number | `processing_records` | `legacy_row_number` |
| export filename | `processing_records` | `migration_source` |
| `reportDate` | `processing_records` | `report_date_key`, `report_date` |
| `reportType` | `processing_records` | `report_type` |
| `filename` | `processing_records` | `filename` |
| `driveFileId` | `processing_records` | `legacy_drive_file_id` |
| `driveFileUrl` | `processing_records` | `legacy_drive_file_url` |
| `uploadedAt` | `processing_records` | `uploaded_at` |
| `uploadedBy` | `processing_records` | `uploaded_by` |
| `printed` | `processing_records` | `printed` |
| `printedAt` | `processing_records` | `printed_at` |
| `printedBy` | `processing_records` | `printed_by` |
| `sourceUploadName` | `processing_records` | `source_upload_name` |
| `notes` | `processing_records` | `notes` |
| `createdAt` | `processing_records` | `created_at` |
| `updatedAt` | `processing_records` | `updated_at` |
| `lastAction` | `processing_records` | `last_action` |
| `branchCodes` | `processing_records` | `legacy_branch_codes` |
| parsed `branchCodes` | `processing_record_branch_codes` | `branch_code` |
| `driveFileId`, `driveFileUrl`, `filename` | `generated_files` | legacy Drive reference row |

หมายเหตุ: ระบบเดิมมักเก็บ preview workbook metadata ใน registry ถ้า `filename` ขึ้นต้น `Preview-` สคริปต์จะสร้าง `generated_files.file_kind = 'preview_workbook'`; ถ้าเป็น `.xlsx` จะใช้ `processed_xlsx`; ถ้าไม่แน่ใจจะใช้ `legacy_drive_file`

### 2.2 `DriveGeneratedFiles.csv` optional

Export จาก Google Drive file listing ถ้าต้องเก็บไฟล์ output/preview ที่ไม่ได้อยู่ครบใน registry

Expected columns:

```txt
fileKind,filename,mimeType,legacyDriveFileId,legacyDriveFileUrl,downloadUrl,viewUrl,fileSizeBytes,createdAt,processingRecordLegacyId
```

Mapping:

| CSV column | Target table | Target column |
| --- | --- | --- |
| `processingRecordLegacyId` | `generated_files` | resolve เป็น `processing_record_id` |
| `fileKind` | `generated_files` | `file_kind` |
| `filename` | `generated_files` | `filename` |
| `mimeType` | `generated_files` | `mime_type` |
| `legacyDriveFileId` | `generated_files` | `legacy_drive_file_id` |
| `legacyDriveFileUrl` | `generated_files` | `legacy_drive_file_url` |
| `downloadUrl` | `generated_files` | `download_url` |
| `viewUrl` | `generated_files` | `view_url` |
| `fileSizeBytes` | `generated_files` | `file_size_bytes` |
| `createdAt` | `generated_files` | `created_at` |

ขั้นแรกของสคริปต์ใน Prompt 7 import จาก `ProcessingRegistry.csv` และสร้าง legacy `generated_files` row จาก registry ให้อัตโนมัติ ถ้ามี Drive inventory แยก ให้เพิ่ม importer ในรอบถัดไปเพื่อ avoid guessing file kind

### 2.3 `PreviewSheets.csv` optional

ใช้เมื่อมีการ export sheet inventory จาก preview spreadsheets

Expected columns:

```txt
previewLegacyDriveFileId,previewFilename,sheetName,sheetOrder,legacySheetId,processingRecordLegacyId
```

Mapping:

| CSV column | Target table | Target column |
| --- | --- | --- |
| `previewLegacyDriveFileId` | `preview_sheets` | resolve `generated_files.id` เป็น `preview_file_id` |
| `previewFilename` | `preview_sheets` | fallback resolve preview file |
| `sheetName` | `preview_sheets` | `sheet_name` |
| `sheetOrder` | `preview_sheets` | `sheet_order` |
| `legacySheetId` | `preview_sheets` | `legacy_sheet_id` |
| `processingRecordLegacyId` | `preview_sheets` | resolve เป็น `processing_record_id` |

### 2.4 `BranchMappings.csv` optional

ถ้ามี mapping มากกว่า 3 รายการที่อยู่ใน code เดิม ให้ export/import เพิ่มได้

Expected columns:

```txt
sourceCode,branchCode,label,active
```

Mapping:

| CSV column | Target table | Target column |
| --- | --- | --- |
| `sourceCode` | `branch_mappings` | `source_code` |
| `branchCode` | `branch_mappings` | `branch_code` |
| `label` | `branch_mappings` | `label` |
| `active` | `branch_mappings` | `active` |

Schema seed ปัจจุบันมี mapping เดิมแล้ว:

- `D1180 -> 001`
- `D6239 -> 003`
- `D5811 -> 004`

## 3. Import Order

1. Backup PostgreSQL ก่อน import จริง
2. Run migration SQL และ seed reference data
3. Export `ProcessingRegistry.csv` จาก Google Sheet เดิม
4. Dry-run import เพื่อตรวจ validation และ duplicate
5. Commit import `ProcessingRegistry.csv`
6. Export/import optional Drive inventory ถ้าต้อง preserve file-level metadata เพิ่ม
7. Export/import optional preview sheet inventory ถ้าต้อง preserve sheet-level preview
8. ตรวจจำนวน record ใน PostgreSQL เทียบกับ CSV source

## 4. Duplicate Rules

Default behavior ของ importer:

- ไม่ overwrite records เดิม
- ตรวจ duplicate จาก `processing_records.legacy_registry_id`, `processing_records.id` ถ้า old id เป็น UUID, และ `processing_records.filename`
- ถ้าเจอ duplicate จะ skip row และเพิ่มใน import summary
- สร้าง `generated_files` เฉพาะเมื่อยังไม่มี legacy Drive reference ซ้ำ
- สร้าง `processing_record_branch_codes` ด้วย `ON CONFLICT DO NOTHING`

ถ้าต้อง update record เดิม ต้องส่ง `--allow-update` พร้อม `--commit` เท่านั้น และควรใช้หลัง backup DB แล้ว

## 5. Validation Rules

Importer ต้อง validate อย่างน้อย:

- CSV ต้องมี header registry ครบตามระบบเดิม
- `filename` ห้ามว่าง
- `reportType` ต้อง normalize เป็น `individual` หรือ `summary`
- `reportDate` ต้องแปลงเป็น `YYYYMMDD` ได้ หรือ fallback จาก filename/source upload/timestamp พร้อม warning
- `printed` ต้องแปลงเป็น boolean ได้
- `branchCodes` ต้อง normalize เป็นรหัสสามหลัก เช่น `001`
- timestamp invalid จะถูกเก็บเป็น `null` และรายงาน warning
- row ที่ fatal validation fail จะไม่ถูก insert

## 6. Traceability Rules

ทุก row ที่ import ต้อง preserve:

- old registry `id`
- old CSV row number ผ่าน `legacy_row_number`
- source CSV filename ผ่าน `migration_source`
- old Drive file ID/URL
- old branch code string ผ่าน `legacy_branch_codes`
- normalized branch codes ใน relation table
- import run summary ใน `migration_logs` เมื่อใช้ `--commit`

## 7. Commands

Dry-run เป็นค่าเริ่มต้น:

```powershell
node scripts/import-data/import-from-csv.js --registry-csv .\exports\ProcessingRegistry.csv
```

Commit import จริง:

```powershell
node scripts/import-data/import-from-csv.js --registry-csv .\exports\ProcessingRegistry.csv --commit
```

Commit พร้อมอนุญาต update duplicate:

```powershell
node scripts/import-data/import-from-csv.js --registry-csv .\exports\ProcessingRegistry.csv --commit --allow-update
```

## 8. Rollback Notes

ก่อน import จริงให้ backup DB:

```bash
pg_dump "$DATABASE_URL" > backups/before-processing-registry-import.sql
```

ถ้า import ผิดพลาด:

- ถ้า script fail ระหว่าง transaction จะ `ROLLBACK` โดยอัตโนมัติ
- ถ้า import commit สำเร็จแล้ว อย่า `TRUNCATE` table โดยตรง
- ใช้ `migration_logs` หา import run ที่เกี่ยวข้อง
- restore จาก backup หรือเขียน forward correction migration ที่ระบุ `migration_source` ชัดเจน

## 9. Open Questions

- Live registry spreadsheet ID อยู่ใน Script Properties ใด และ export CSV จาก deployment ล่าสุดแล้วหรือยัง
- Registry `driveFileId` แต่ละ row หมายถึง preview spreadsheet หรือ processed `.xlsx` ในทุกกรณีหรือไม่
- ต้อง migrate preview sheet list ทั้งหมดหรือใช้ legacy preview Drive URL ระดับ workbook เพียงพอ
- ยังมี output `.xlsx` เก่าที่ต้อง copy ออกจาก Google Drive มาก่อน cleanup หรือไม่
- ต้อง preserve actor email เดิมตาม `uploadedBy`/`printedBy` แบบ exact หรือจะ map เป็น local user ในอนาคต

## 10. Execution Log

- 2026-07-29 — Export `ProcessingRegistry.csv` จากสเปรดชีต "SeamlessXGASExcelFormatV2 Processing
  Registry" (tab `ProcessingRegistry`, แก้ไขล่าสุดวันเดียวกัน — ยืนยันว่าเป็นไฟล์ที่ระบบใช้งานจริง
  ไม่ใช่ไฟล์เก่าที่แก้ไขครั้งสุดท้าย 8 เม.ย.) เก็บไว้ที่ `exports/ProcessingRegistry.csv` (gitignored)
  — 125 rows.
  - **พบและแก้บั๊กจริงใน `scripts/import-data/import-from-csv.js`:** `buildPoolConfig()` เช็คแค่
    `process.env.DATABASE_URL` เฉยๆ ไม่เช็ค `SC_OFFICIAL_SUPABASE_DATABASE_URL` เหมือนที่
    `server/src/config/env.js` ทำ — เพราะ `server/.env` production ตั้งค่าไว้ที่
    `SC_OFFICIAL_SUPABASE_DATABASE_URL` (ตาม convention จริงของ repo) สคริปต์นี้เลย fallback ไปต่อ
    `localhost:5432` แล้วได้ `ECONNREFUSED` เงียบๆ (`AggregateError` ไม่มี `.message` ทำให้
    `console.error(error.message)` เดิมใน `main().catch()` ไม่ print อะไรเลย ดูเหมือน process
    เงียบหายไปเฉยๆ) แก้โดยให้เช็ค `SC_OFFICIAL_SUPABASE_DATABASE_URL` ก่อน เหมือนโค้ดส่วนอื่นของ repo
  - Dry-run ก่อน: 125/125 rows valid, 0 duplicates, 0 errors/warnings
  - Backup production ก่อน commit จริงด้วย `pg_dump --schema=clasp_scx_seamless` (ผ่าน discrete
    `PG*` env vars แทน connection-string เดียว เพราะ `pg_dump`'s URI parser สะดุดกับ connection
    string ของ Supabase pooler) → `backups/before-processing-registry-import.sql` (63 KB, 26
    tables, gitignored)
  - Commit จริง: **125 records created, 0 skipped/updated/failed** ตรงกับ dry-run เป๊ะ — ยืนยันตรง
    ใน DB จริงหลัง commit: `processing_records` ที่ `migration_source='ProcessingRegistry.csv'` =
    125, `generated_files` ที่ `storage_provider='google_drive'` = 125, `migration_logs` แถวล่าสุด
    status = `completed`
  - เพิ่ม `exports/` และ `backups/` เข้า `.gitignore` (มีข้อมูล production จริงและไม่เคย gitignore
    มาก่อน)
  - **ยังไม่ทำ:** แนบไฟล์ `.xlsx` จริง 40 ไฟล์ที่ดาวน์โหลดมาไว้ที่
    `C:\Users\scgro\Downloads\เอกสาร seamlessXSC` (`Preview-summary-single-*`/
    `Preview-individual-single-*`) เข้ากับ `generated_files` rows ที่เพิ่ง import — ต้องจับคู่ด้วย
    filename แล้วอัปโหลดเนื้อไฟล์จริงเข้า storage (R2/local) ของแอปใหม่ แทนที่จะพึ่ง legacy Drive URL
