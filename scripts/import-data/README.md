# CSV Import Utilities

โฟลเดอร์นี้เก็บเครื่องมือ import ข้อมูลจาก Google Apps Script / Google Sheets เดิมเข้าสู่ PostgreSQL สำหรับ PERN migration

สคริปต์ปัจจุบัน:

- `import-from-csv.js`: import `ProcessingRegistry.csv` เป็น `processing_records`, `processing_record_branch_codes`, legacy `generated_files` และบันทึก run summary ใน `migration_logs` เมื่อ commit
- สคริปต์เดียวกันรองรับ `ProcessingRegistry` export แบบ JSON จาก GAS helper ด้วย

## Prerequisites

1. ติดตั้ง dependencies แล้ว

```powershell
npm install
```

2. สร้าง PostgreSQL schema แล้ว

```powershell
npm run db:migrate
npm run db:seed
```

3. ตั้งค่า database environment ใน `server/.env` หรือ environment variables เช่น `DATABASE_URL` หรือ `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

อย่าใส่รหัสผ่านจริงลงในไฟล์ที่ commit

## Export CSV From Google Sheets

Export sheet เดิมชื่อ `ProcessingRegistry` เป็น CSV โดยคง header นี้:

```txt
id,reportDate,reportType,filename,driveFileId,driveFileUrl,uploadedAt,uploadedBy,printed,printedAt,printedBy,sourceUploadName,notes,createdAt,updatedAt,lastAction,branchCodes
```

แนะนำเก็บไฟล์ export ไว้นอก repo หรือในโฟลเดอร์ที่ไม่ commit เช่น `exports/`

## Export JSON From Legacy GAS Sheet

ถ้ายังมี registry เดิมอยู่ใน Google Sheets/GAS และอยาก import โดยไม่ต้องกด Export CSV เอง ให้รัน GAS function นี้:

```javascript
exportLegacyProcessingRegistryForSupabaseImport()
```

แล้วนำ JSON result ไปบันทึกเป็นไฟล์ เช่น `exports/ProcessingRegistry.json`

## Dry Run

Dry-run เป็นค่าเริ่มต้นและจะไม่เขียนข้อมูลลง database:

```powershell
node scripts/import-data/import-from-csv.js --registry-csv .\exports\ProcessingRegistry.csv
```

หรือใช้ JSON export:

```powershell
node scripts/import-data/import-from-csv.js --registry-json .\exports\ProcessingRegistry.json
```

หรือระบุชัดเจน:

```powershell
node scripts/import-data/import-from-csv.js --registry-csv .\exports\ProcessingRegistry.csv --dry-run
```

## Commit Import

เมื่อ dry-run ผ่านแล้วจึง commit:

```powershell
node scripts/import-data/import-from-csv.js --registry-csv .\exports\ProcessingRegistry.csv --commit
```

Default commit behavior:

- insert เฉพาะ record ใหม่
- skip duplicate
- ไม่ overwrite existing rows
- ใช้ transaction เดียวต่อ import run
- เขียน summary ลง `migration_logs`

## Allow Update

ใช้เฉพาะหลัง backup database แล้ว:

```powershell
node scripts/import-data/import-from-csv.js --registry-csv .\exports\ProcessingRegistry.csv --commit --allow-update
```

`--allow-update` จะ update `processing_records` ที่ duplicate แทนการ skip แต่ยังไม่ลบข้อมูลเดิมใน table อื่น

## Useful Options

```txt
--registry-csv <path>          path ไปยัง ProcessingRegistry CSV
--registry-json <path>         path ไปยัง ProcessingRegistry JSON export จาก GAS
--source-name <name>           label ที่บันทึกใน migration_source/migration_logs
--registry-spreadsheet-id <id> preserve legacy registry spreadsheet id
--limit <n>                    import เฉพาะ n rows แรก สำหรับ test
--dry-run                      validate/query duplicates แต่ไม่เขียน DB
--commit                       เขียน DB จริง
--allow-update                 update duplicate processing_records
--help                         แสดง help
```

## Output Summary

สคริปต์จะแสดง summary เช่น:

- rows read
- rows valid/failed
- records created/updated/skipped
- duplicate count
- generated file references created/skipped
- branch code links inserted/skipped
- warnings/errors sample

## Safety Notes

- ไม่มี `DROP`, `TRUNCATE` หรือ destructive schema command ในสคริปต์นี้
- สคริปต์เป็น dry-run เป็นค่าเริ่มต้น
- การเขียน database ต้องใช้ `--commit`
- Duplicate ไม่ถูก overwrite เว้นแต่ใช้ `--allow-update`
- ก่อน commit import จริง ให้ backup PostgreSQL ด้วย `pg_dump`
