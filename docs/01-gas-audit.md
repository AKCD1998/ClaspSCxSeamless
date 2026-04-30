# 01 GAS Technical Audit

วันที่ audit: 2026-04-30

โปรเจกต์นี้เป็น Google Apps Script web app สำหรับอัปโหลดไฟล์ `.xlsx` จาก Seamless/DMIS แล้วแปลงรูปแบบ workbook, export กลับเป็น `.xlsx`, สร้าง preview workbook บน Google Sheets/Drive และบันทึกประวัติการประมวลผลไว้ใน Google Sheet registry

ขอบเขต audit นี้เป็นการอ่านระบบเดิมเท่านั้น ยังไม่ refactor, ยังไม่สร้าง PERN app, และยังไม่ย้ายข้อมูล

## 1. ภาพรวมระบบปัจจุบัน

- Runtime: Google Apps Script V8
- Web app:
  - `executeAs`: `USER_DEPLOYING`
  - `access`: `ANYONE_ANONYMOUS`
- UI เป็น HTML/CSS/vanilla JavaScript ภายใต้ `src/client`
- Server logic เป็น Apps Script JavaScript ภายใต้ `src/server`, `src/transforms`, `src/utils`
- Workflow หลัก:
  - ผู้ใช้อัปโหลดไฟล์ `.xlsx` แบบ `individual` หรือ `summary`
  - Browser อ่านไฟล์เป็น base64 แล้วเรียก `google.script.run.processWorkbookPayload`
  - Server แปลงไฟล์เป็น Google Sheets ชั่วคราวผ่าน Drive API
  - Server ปรับรูปแบบ workbook ด้วย `SpreadsheetApp`
  - Server export เป็นไฟล์ `.xlsx` ใหม่ใน Google Drive
  - Server copy sheet ที่ประมวลผลแล้วเข้า preview spreadsheet
  - Server upsert metadata ลง processing registry spreadsheet
  - UI แสดง link ดาวน์โหลด, link preview และประวัติการจัดการไฟล์

## 2. โครงสร้างไฟล์และบทบาท

| Path | บทบาท |
| --- | --- |
| `.clasp.json` | ตั้งค่า clasp project, `scriptId`, `rootDir`, file extensions |
| `appsscript.json` | Apps Script manifest, timezone, runtime, webapp access |
| `favicon-scseamless-64.png` | favicon asset ใน repo |
| `src/client/Index.html` | shell HTML, include styles/app/client script, inject `window.SX_BOOTSTRAP` |
| `src/client/App.html` | markup หลักของ UI: hero, upload panels, history dashboard/table/grouped view |
| `src/client/Styles.html` | CSS ทั้งหมดของ web app |
| `src/client/Client.js.html` | browser logic: upload, batch processing, status rendering, history UI |
| `src/server/Code.js` | global Apps Script entrypoints ที่ `google.script.run` และ web app เรียก |
| `src/server/Routes.js` | `doGet`, HTML includes, favicon URL, bootstrap data |
| `src/server/Config.js` | constants ของระบบ เช่น file limits, folder IDs, formatting rules, headers |
| `src/server/WorkbookPipeline.js` | orchestration หลักของ upload/convert/transform/export/preview/registry |
| `src/server/WorkbookVariant.js` | ตรวจจับและกำหนด profile ของ `individual`/`summary` workbook |
| `src/server/DriveConversion.js` | upload `.xlsx` ไป Drive API แล้ว convert เป็น Google Sheets |
| `src/server/ExportService.js` | export Google Sheets เป็น `.xlsx` และสร้าง Drive URLs |
| `src/server/PreviewService.js` | สร้าง/เปิด preview spreadsheet และ copy processed sheet เข้าไป |
| `src/server/ProcessingRegistryService.js` | จัดการ registry spreadsheet, CRUD record, filters, printed status |
| `src/server/FilenameBuilder.js` | สร้าง output filename จากวันที่และ branch code |
| `src/server/Logger.js` | logger wrapper เขียน console และเก็บ entries ใน memory |
| `src/server/Warnings.js` | warning collector และ deduplication |
| `src/transforms/TransformWorkbook.js` | pipeline ปรับรูปแบบ workbook |
| `src/transforms/TransformIndiv.js` | logic เฉพาะ individual report |
| `src/transforms/TransformSummary.js` | logic เฉพาะ summary report |
| `src/transforms/Formatting.js` | font, wrap, column width, row height, borders, print intent |
| `src/transforms/HeaderLookup.js` | หา column จาก header text และ merged cells |
| `src/transforms/MergedRangeUtils.js` | อ่าน/จัดการ merged ranges และลบ columns โดยรักษา merges |
| `src/transforms/Cleanup.js` | workspace folder, preview archive folder, stale file cleanup |
| `src/utils/Normalize.js` | normalize text, sanitize filename, estimate text width |
| `src/utils/SheetUtils.js` | used range/model helpers สำหรับ SpreadsheetApp |
| `src/utils/ThaiDateParser.js` | parse วันที่ไทย/พ.ศ. เป็น Gregorian date |
| `src/utils/BranchCodeMap.js` | map HCODE/service code เป็น branch code |
| `src/utils/A1Utils.js` | A1 notation helpers |

## 3. Apps Script entrypoints และ server functions

### `src/server/Code.js`

ไฟล์นี้ expose function ระดับ global ให้ Apps Script runtime และ `google.script.run`

- `doGet(e)`: delegate ไป `SXRoutes.doGet`
- `include(filename)`: include HTML partial
- `processWorkbookUpload(formObject)`: รับ upload แบบ form object แล้วส่งเข้า pipeline
- `processWorkbookPayload(payload)`: รับ payload base64 จาก browser แล้วส่งเข้า pipeline
- `discardPreviewSpreadsheet(previewSpreadsheetId)`: trash preview spreadsheet
- `initProcessingRegistry()`: ensure registry spreadsheet/sheet/headers
- `createProcessingRecord(record)`: เพิ่ม record ใน registry
- `updateProcessingRecord(id, patch)`: update record ใน registry
- `findProcessingRecordByFilename(filename)`: หา record ด้วย filename
- `parsePreviewFilename(filename)`: parse ชื่อ preview file
- `fetchProcessingHistory(filters)`: list records สำหรับ UI history
- `markProcessingHistoryPrinted(id)`: mark printed พร้อม response wrapper
- `markProcessingHistoryUnprinted(id)`: mark unprinted พร้อม response wrapper
- `listProcessingRecords(filters)`: list records โดยตรง
- `markPrinted(id, printedBy)`: mark printed โดยตรง
- `markUnprinted(id)`: mark unprinted โดยตรง

### `src/server/Routes.js`

- `SXRoutes.FAVICON_FILE_ID`: Drive file ID fallback สำหรับ favicon
- `getFaviconUrl_()`: อ่าน `FAVICON_URL` จาก Script Properties หรือสร้าง Drive URL จาก fallback ID
- `doGet(e)`: render `src/client/Index`, inject bootstrap, set title/meta/favicon; ถ้ามี `faviconDebug` จะ return favicon URL เป็น text
- `include(filename)`: โหลด HTML partial จาก Apps Script project
- `getClientBootstrap()`: ส่ง `appName`, `maxUploadMb`, `retentionHours`, `maxBatchFiles` ไป frontend

### `src/server/WorkbookPipeline.js`

เป็น orchestration หลักของระบบ

- `processFormObject(formObject)`: extract upload จาก form object แล้ว process
- `processPayloadObject(payload)`: extract upload จาก base64 payload แล้ว process
- `processUpload_(upload)`: ลำดับงานหลักทั้งหมด:
  - cleanup stale workspace files
  - convert uploaded blob เป็น Google Sheets
  - เปิด first worksheet
  - detect/request workbook variant
  - run transform
  - build output filename
  - export เป็น `.xlsx`
  - attach sheet เข้า preview spreadsheet
  - upsert processing registry record
  - return metadata, URLs, warnings, deleted columns, highlight count
- `extractUploadFromForm_(formObject)`: validate form upload field และ `.xlsx`
- `extractUploadFromPayload_(payload)`: validate payload, decode base64, สร้าง blob
- `normalizeUpload_(upload)`: validate formatter mode, preview ID, batch count, size limit
- `discardPreviewSpreadsheet(previewSpreadsheetId)`: trash preview file
- `userError_(message)`: สร้าง error ที่ถือว่าเป็น user-facing
- `normalizeError_(error)`: normalize error ก่อน throw กลับ frontend

### `src/server/WorkbookVariant.js`

- `TYPES`: `individual`, `summary`
- `parseRequestedVariant(value)`: รับ `individual`/`indiv`/`summary`/`sum`
- `detect(sheet, model)`: detect summary จาก sheet name `summary`/`sum` หรือ header `ATK` แถว 5; fallback เป็น individual
- `getProfile(variant)`: คืน config ของ variant เช่น header rows, deletion mode, highlight headers, fixed sizes, print repeat row count

### `src/server/FilenameBuilder.js`

- `buildOutputFilename(sheet, originalFilename, variant)`: route ไป individual/summary filename builder
- `buildIndividualOutputFilename_(sheet, originalFilename)`: ใช้วันที่จาก `C5` หรือ scan fallback, branch จาก `HCODE`, สร้างชื่อ `YYYY-MM-DD-branch-02 indiv exp.xlsx`
- `buildSummaryOutputFilename_(sheet, originalFilename)`: ใช้วันที่จาก `C3`, branch จาก `C11`, หรือ scan columns `รหัสหน่วยบริการ`/`REP Date`, สร้างชื่อ `YYYY-MM-DD-branch-02 sum exp.xlsx`
- `getSummaryFilenameMetadata_(sheet)`: รวม logic อ่าน metadata summary แบบ fixed cell และ fallback scan
- `scanIndividualDateFallback_(sheet)`: scan top metadata area สำหรับวันที่ individual
- `buildFallbackOutputFilename_(originalFilename)`: fallback เป็น `base-processed.xlsx`

### `src/server/DriveConversion.js`

- `convertUploadBlobToSpreadsheet(blob, originalFilename, logger)`: สร้าง temp filename, upload/convert ไป workspace folder, wait จน Spreadsheet เปิดได้
- `waitForSpreadsheet_(spreadsheetId)`: retry `SpreadsheetApp.openById` สูงสุด 10 ครั้ง ครั้งละ 500ms
- `importWorkbookAsSpreadsheet_(blob, fileName, folderId)`: เรียก Drive upload endpoint แบบ multipart
- `performMultipartUpload_(url, metadata, blob)`: สร้าง multipart payload และใช้ OAuth token จาก `ScriptApp`

### `src/server/ExportService.js`

- `exportSpreadsheetToXlsxFile(spreadsheetId, outputFilename, logger)`: export blob แล้ว create file ใน workspace folder
- `exportSpreadsheetBlob_(spreadsheetId, outputFilename)`: เรียก Drive export endpoint เป็น `.xlsx`
- `buildDownloadUrl(fileId)`: สร้าง direct download URL
- `buildViewUrl(fileId)`: สร้าง Drive file view URL

### `src/server/PreviewService.js`

- `attachProcessedSheet(sourceSpreadsheet, sheet, options, logger)`: เปิดหรือสร้าง preview spreadsheet, copy processed sheet เข้าไป, ตั้งชื่อ sheet ไม่ให้ซ้ำ, ลบ default sheet ถ้าจำเป็น, คืน URL/ID/sheet names
- `discardPreviewSpreadsheet(previewSpreadsheetId, logger)`: trash preview file
- `openPreviewSpreadsheet_(previewSpreadsheetId)`: เปิด spreadsheet ด้วย ID
- `createPreviewSpreadsheet_(formatterMode, batchFileCount, logger)`: สร้าง preview spreadsheet ชื่อ `Preview-{mode}-{single|multi}-YYYYMMDD-HHmmss`, set locale/timezone, ย้ายเข้า preview archive folder
- `resolveBatchModeLabel_(batchFileCount)`: `single` หรือ `multi`
- `buildSourceLabel_(originalFilename, outputFilename)`: สร้าง base sheet name จาก output filename
- `buildUniqueSheetName_(spreadsheet, baseName)`: กัน sheet name ซ้ำด้วย suffix
- `sheetNameExists_(spreadsheet, name)`: ตรวจชื่อ sheet
- `getSheetNames_(spreadsheet)`: list sheet names
- `removeDefaultSheetIfNeeded_(spreadsheet, preservedSheet)`: ลบ `Sheet1` ว่างหลัง copy

### `src/server/ProcessingRegistryService.js`

เป็น service จัดการ Google Sheet registry สำหรับ history

Headers ปัจจุบัน:

```txt
id, reportDate, reportType, filename, driveFileId, driveFileUrl,
uploadedAt, uploadedBy, printed, printedAt, printedBy, sourceUploadName,
notes, createdAt, updatedAt, lastAction, branchCodes
```

Functions สำคัญ:

- `initProcessingRegistry()`: ensure registry และคืน metadata
- `createProcessingRecord(record)`: สร้าง record ใหม่พร้อม UUID/defaults
- `updateProcessingRecord(id, patch)`: update record ตาม ID
- `findProcessingRecordByFilename(filename)`: หา record แรกจาก filename
- `listProcessingRecords(filters)`: อ่าน registry, backfill branch codes, filter, sort ล่าสุดก่อน
- `parsePreviewFilename(filename)`: parse pattern `Preview-(summary|individual)-(single|multi)-YYYYMMDD-HHmmss` และ legacy pattern
- `upsertProcessingRecordFromPreview(options)`: สร้างหรือ update record จาก preview file metadata
- `markPrinted(id, printedBy)`: ตั้ง `printed=true`, `printedAt`, `printedBy`, `lastAction=marked_printed`
- `markUnprinted(id)`: ตั้ง `printed=false`, clear printed metadata
- `withRegistryLock_(callback)`: ใช้ `LockService.getScriptLock()` เพื่อกัน concurrent writes
- `ensureRegistryReady_()`: resolve spreadsheet, ensure sheet และ headers
- `resolveRegistrySpreadsheet_()`: ใช้ configured ID, stored Script Property, หรือสร้างใหม่
- `createRegistrySpreadsheet_()`: สร้าง spreadsheet ใหม่และย้ายไป preview archive folder ถ้าทำได้
- `ensureHeaders_(sheet)`: initialize/migrate headers หรือ throw ถ้า schema ไม่ตรง
- `readSheetRecords_(sheet)`, `rowToRecord_(row)`, `recordToRow_(record)`: map row/record
- `buildCreateRecord_(record)`, `applyPatchToRecord_(existingRecord, patch)`: normalize/validate/default fields
- `applyFilters_(entries, filters)`, `normalizeFilters_(filters)`: filter by id, filename, reportType, reportDate, driveFileId, printed, limit
- `backfillBranchCodes_(sheet, entries)`: เติม `branchCodes` จาก worksheet names/Drive spreadsheet ถ้ายังว่าง
- `resolveBranchCodesForRecordOptions_(options, driveFileId)`: หา branch codes จาก worksheet names, options, หรือ spreadsheet
- `coerceReportDate_(reportDate, filename, sourceUploadName)`: ใช้ input date, filename/source filename, หรือวันนี้
- `normalizeBranchCodes_(value)`: รับ array/string, เก็บเฉพาะ `NNN`, dedupe และ sort
- `getCurrentActor_()`: ใช้ `Session.getActiveUser().getEmail()` ถ้าอ่านได้

### `src/server/Logger.js` และ `Warnings.js`

- `SXLogger.create/info/warn/error`: log ไป console และเก็บ entries
- `SXWarnings.create/add/merge/list`: รวม warning message และ dedupe ก่อนส่งกลับ frontend

## 4. Transform และ formatting logic

### `src/transforms/TransformWorkbook.js`

- `run(spreadsheet, variant, warningCollector, logger)`: pipeline ปรับ workbook:
  - ตรวจ first sheet และ used range
  - apply font `AngsanaUPC` size `9`
  - wrap header rows
  - collect columns ที่ต้องลบตาม variant
  - delete columns โดยรักษา merged ranges
  - detect final table range
  - calculate/fit/apply column widths
  - apply row heights
  - individual เท่านั้น: apply borders และ highlight ค่า `150`
  - apply print intent ด้วย frozen rows
  - return worksheet name, variant, deleted columns, highlight count
- `safeStep_(warningCollector, label, operation)`: จับ error ของแต่ละ step แล้วแปลงเป็น warning

### `src/transforms/TransformIndiv.js`

- `collectColumnMatches(sheet, model, warningCollector, profile)`: หา columns ที่ header ตรงกับ `วันที่ลงทะเบียน`, `หมายเหตุอื่นๆ (STMID)`
- `detectFinalTableRange(sheet, model, profile)`: หา table จาก header เริ่ม `ลำดับที่` ถึง `หมายเหตุ`
- `apply150Highlighting(sheet, model, tableRange, warningCollector, profile)`: highlight cells ที่ค่าเท่ากับ `150` ใน headers ที่กำหนด
- `findExactHighlightColumnByName_(...)`: หา highlight column แบบ exact ก่อน fallback
- `isValueExactly150_(value)`: ตรวจ number/string ที่เท่ากับ 150 เท่านั้น

### `src/transforms/TransformSummary.js`

- `collectColumnMatches(sheet, model, warningCollector, profile)`: หา header `ATK` แล้วลบตั้งแต่ column นั้นไปถึงขวาสุด
- `detectFinalTableRange(sheet, model, profile)`: table ใช้ used range หลังลบ column แล้ว

### `src/transforms/Formatting.js`

- `applyWorkbookFont`, `wrapHeaderRows`: ตั้ง font และ wrap headers
- `calculateColumnWidths`: คำนวณ width จาก display text, merged cells, fixed widths
- `fitColumnWidthsToPrintableWidth`: shrink widths ให้ไม่เกิน target print width
- `applyColumnWidths`, `applyRowHeights`: apply sizing กับ sheet
- `applyTableBorders`: ใส่ border ให้ table range
- `applyPrintIntent`: freeze repeat rows เป็น print-preview hint
- helper ภายในคำนวณ row height, grapheme width, merged width, squeeze widths

### `src/transforms/HeaderLookup.js`, `MergedRangeUtils.js`, `Cleanup.js`

- `SXHeaderLookup.findColumnByHeaderText`: หา header โดย exact normalized text และ trimmed fallback รองรับ merged cells
- `SXMergedRangeUtils`: อ่าน merged ranges, build index, break/re-merge หลัง delete columns
- `SXCleanup`:
  - `getWorkspaceFolder`: ใช้ User Properties เก็บ folder ID หรือสร้าง folder ชื่อ `SeamlessXGASExcelFormatV2 Workspace`
  - `getPreviewArchiveFolder`: เปิด preview archive folder จาก config ID/resource key
  - `cleanupStaleWorkspaceFiles`: trash files เก่ากว่า retention hours
  - `trashFileById`: trash file ตาม ID

## 5. Utilities

- `SXNormalize`:
  - normalize display/header text
  - compact header text
  - sanitize filename base
  - estimate line/grapheme width สำหรับ column sizing
- `SXSheetUtils`:
  - first sheet
  - used range bounds จาก display values และ merged ranges
  - build model รวม display values, raw values, merge index
  - resolved display value จาก merged cell anchor
  - หา header row และ last non-empty row
- `SXThaiDateParser`:
  - map เดือนภาษาไทยและตัวย่อเป็นเลขเดือน
  - parse Thai Buddhist date จาก individual metadata
  - parse summary REP date format `dd/mm/yyyy`
  - convert พ.ศ. เป็น ค.ศ.
- `SXBranchCodeMap`:
  - map `D1180 -> 001`, `D6239 -> 003`, `D5811 -> 004`
  - หา branch จาก HCODE column
- `SXA1Utils`: แปลง column number เป็น letters และสร้าง A1 range labels

## 6. Frontend UI และ browser logic

### UI structure

`src/client/App.html` มีหน้าจอหลัก:

- Hero/intro อธิบายระบบ
- Panel อัปโหลด `Individual Formatter`
- Panel อัปโหลด `Summary Formatter`
- History panel:
  - filters: report type, report date, printed status
  - dashboard summary by report date
  - table view
  - grouped view
  - action buttons mark printed/unprinted

### Browser functions ใน `Client.js.html`

- Upload:
  - `bindUploadPanel(config)`: bind form/file input/status/result ของแต่ละ panel
  - `processFilesSequentially(files, formatterMode, statusElement)`: ประมวลผลหลายไฟล์ทีละไฟล์โดยส่ง `previewSpreadsheetId` ต่อกันเพื่อรวม preview ใน workbook เดียว
  - `processSingleWorkbook(file, formatterMode, previewSpreadsheetId, batchFileCount)`: อ่านไฟล์แล้วเรียก `google.script.run.processWorkbookPayload`
  - `readFileAsPayload(file)`: ใช้ `FileReader.readAsDataURL`, ตัด base64
  - `renderBatchResult`, `renderWarnings`, `renderResults`: render success/failure/warnings/links
  - `buildBatchStatus`, `getBatchState`, `setStatus`, `setBusy`: status UI
  - `filterWorkbookFiles`: รับเฉพาะชื่อไฟล์ `.xlsx`
- History:
  - `bindHistoryPanel()`: bind filters, refresh, view toggle, initial load
  - `fetchProcessingHistory(filters)`: เรียก `google.script.run.fetchProcessingHistory`
  - `filterProcessingHistoryRecords(records, filters)`: filter ฝั่ง client จาก records ทั้งหมด
  - `renderHistoryDashboard`, `renderHistoryResults`, `renderHistoryTable`, `renderGroupedHistory`
  - `groupRecordsByReportDate`, `buildHistoryGroupSummary`: group และ aggregate dashboard/grouped view
  - `buildHistoryRow`, `buildHistoryGroupRecord`, `buildHistoryActionsContainer`: render rows/cards/actions
  - `submitHistoryPrintAction`, `runHistoryPrintAction`: confirm แล้วเรียก `markProcessingHistoryPrinted` หรือ `markProcessingHistoryUnprinted`
  - format helpers: report type, printed status, date, timestamp, branch codes, HTML escape

### `google.script.run` calls

- `processWorkbookPayload(payload)`
- `fetchProcessingHistory(filters)`
- `markProcessingHistoryPrinted(recordId)`
- `markProcessingHistoryUnprinted(recordId)`

## 7. ข้อมูลและแหล่งข้อมูลที่ระบบใช้อยู่

### Uploaded workbooks

- Input เป็น `.xlsx` เท่านั้น
- จำกัดขนาดด้วย `SXConfig.MAX_UPLOAD_BYTES = 20MB`
- จำกัด batch ด้วย `SXConfig.MAX_BATCH_FILES = 20`
- Browser ส่ง `originalFilename`, `mimeType`, `size`, `base64`, `formatterMode`, `previewSpreadsheetId`, `batchFileCount`

### Temporary converted Google Sheets

- สร้างจาก Drive API multipart upload ไปยัง Google Drive
- MIME target: `application/vnd.google-apps.spreadsheet`
- อยู่ใน workspace folder
- หลัง process จะ trash temp spreadsheet ใน `finally`

### Workspace Drive folder

- ชื่อ folder: `SeamlessXGASExcelFormatV2 Workspace`
- User Properties key: `SX_WORKSPACE_FOLDER_ID`
- เก็บ temporary converted sheets และ exported `.xlsx`
- cleanup files เก่ากว่า `OUTPUT_RETENTION_HOURS = 12`

### Preview archive folder

- Config ID: `1UtikzyKi8Kg65W6zPz0WYOJ98Xmj7wWx`
- Resource key ปัจจุบันว่าง
- เก็บ preview spreadsheets และ registry spreadsheet ที่สร้างใหม่
- Preview spreadsheet locale/timezone:
  - locale: `th_TH`
  - timezone: `Asia/Bangkok`

### Processing registry spreadsheet

- Config fixed ID ปัจจุบันว่าง (`PROCESSING_REGISTRY_SPREADSHEET_ID = ''`)
- ถ้าไม่มี fixed ID จะอ่าน/เขียน Script Properties key `SX_PROCESSING_REGISTRY_SPREADSHEET_ID`
- ถ้าไม่มี stored ID หรือเปิดไม่ได้ จะสร้าง spreadsheet ใหม่ชื่อ `SeamlessXGASExcelFormatV2 Processing Registry`
- Sheet name: `ProcessingRegistry`
- Headers:
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

### Generated output files

- Exported `.xlsx` อยู่ใน workspace folder
- Return metadata:
  - `driveFileId`
  - `downloadUrl`
  - `viewUrl`
  - `filename`
- Output filename patterns:
  - individual: `YYYY-MM-DD-{branchCode}-02 indiv exp.xlsx`
  - summary: `YYYY-MM-DD-{branchCode}-02 sum exp.xlsx`
  - fallback: `{sanitized-original}-processed.xlsx`

### Preview spreadsheets

- Preview filename pattern:
  - current: `Preview-{summary|individual}-{single|multi}-YYYYMMDD-HHmmss`
  - registry parser รองรับ legacy: `Preview-{summary|individual}-YYYYMMDD-HHmmss`
- แต่ละ uploaded file จะถูก copy เป็น sheet ใน preview workbook
- Batch upload ใช้ `previewSpreadsheetId` ต่อเนื่องเพื่อรวมหลาย sheet ใน preview เดียว

### Workbook cells/headers ที่เป็น data source สำคัญ

- Individual:
  - วันที่หลัก: `C5`
  - fallback date: scan top area rows 1-10, cols 1-6
  - branch source: column `HCODE`
  - delete headers: `วันที่ลงทะเบียน`, `หมายเหตุอื่นๆ (STMID)`
  - table start/end headers: `ลำดับที่` ถึง `หมายเหตุ`
  - highlight headers: `ราคาต่อหน่วย`, `ราคาเพดาน`, `รวมเงินที่ขอเบิก`, `ชดเชย`, `ไม่ชดเชย`, `จ่ายเพิ่ม`, `เรียกคืน`
- Summary:
  - fixed date source: `C3`
  - fixed branch source: `C11`
  - fallback columns: `รหัสหน่วยบริการ`, `REP Date`
  - delete start header: `ATK`, ลบถึงขวาสุด

## 8. User workflows

### Workflow A: Upload Individual

1. ผู้ใช้เลือกไฟล์ `.xlsx` ใน Individual panel
2. UI filter เฉพาะ `.xlsx` และ validate มีไฟล์อย่างน้อย 1 ไฟล์
3. UI ตรวจไม่เกิน `maxBatchFiles`
4. UI ประมวลผลทีละไฟล์ด้วย formatter mode `individual`
5. Server detect workbook variant; ถ้า detect ไม่ตรงกับ requested mode จะเพิ่ม warning แต่ใช้ requested mode ต่อ
6. Server transform worksheet ตาม individual profile
7. Server export `.xlsx` และสร้าง/append preview workbook
8. Server upsert processing history
9. UI แสดง warnings, preview link, download links และ reload history

### Workflow B: Upload Summary

เหมือน Individual แต่ formatter mode เป็น `summary`, transform ใช้ summary profile, output filename ลงท้าย `sum exp.xlsx`, และ preview/registry report type เป็น summary

### Workflow C: Batch Preview

1. Upload หลายไฟล์ใน panel เดียว
2. ไฟล์แรกสร้าง preview spreadsheet ใหม่
3. ไฟล์ถัดไปส่ง `previewSpreadsheetId` เดิมกลับไป server
4. Server copy processed sheet เพิ่มใน preview spreadsheet เดิม
5. UI แสดง preview workbook link เดียวและ download links รายไฟล์

### Workflow D: Processing History

1. หน้าโหลด history อัตโนมัติด้วย `fetchProcessingHistory({})`
2. UI เก็บ records ทั้งหมดไว้ใน memory
3. Filters report type/date/printed ทำฝั่ง client
4. Dashboard group records ตาม `reportDate`
5. Table view แสดง record รายไฟล์
6. Grouped view แสดง grouped records ตาม report date

### Workflow E: Mark Printed / Unprinted

1. ผู้ใช้กด action ใน history row/group card
2. UI แสดง `window.confirm`
3. UI เรียก `markProcessingHistoryPrinted(id)` หรือ `markProcessingHistoryUnprinted(id)`
4. Server update registry row ภายใต้ script lock
5. UI reload history

## 9. External dependencies และ platform behavior

- Google Apps Script services:
  - `HtmlService`
  - `ContentService`
  - `SpreadsheetApp`
  - `DriveApp`
  - `PropertiesService`
  - `LockService`
  - `Utilities`
  - `Session`
  - `ScriptApp`
  - Apps Script `console`
- Google Drive API endpoints:
  - multipart upload: `/upload/drive/v3/files?uploadType=multipart`
  - export: `/drive/v3/files/{id}/export`
- Browser APIs:
  - `FileReader`
  - DOM APIs
  - `window.confirm`
  - `google.script.run`
- Implicit platform dependencies:
  - Apps Script OAuth token ต้องมีสิทธิ Drive/Spreadsheet ที่เพียงพอ
  - Drive conversion จาก `.xlsx` เป็น Google Sheets ต้องสำเร็จและพร้อมเปิดภายใน retry window
  - SpreadsheetApp formatting/export behavior เป็นส่วนสำคัญของ output parity

## 10. ข้อมูลที่ต้อง preserve ก่อน migration ไป PERN

- Original GAS source files ทั้งหมด
- `.clasp.json` และ `appsscript.json` เพื่อ trace deployment เดิม
- Uploaded source `.xlsx` เดิม ถ้ายังเก็บอยู่ใน Drive หรือ source system
- Exported `.xlsx` outputs ที่ยังต้องใช้งาน
- Preview spreadsheets ทั้งหมดใน preview archive folder
- Processing registry spreadsheet:
  - spreadsheet ID
  - sheet name
  - header schema
  - rows ทั้งหมด
  - old row numbers ถ้าต้องการ trace
- Drive metadata:
  - file IDs
  - URLs
  - created timestamps
  - folder membership
- Script/User Properties ที่เกี่ยวข้อง:
  - `SX_WORKSPACE_FOLDER_ID`
  - `SX_PROCESSING_REGISTRY_SPREADSHEET_ID`
  - optional `FAVICON_URL`
- Business metadata:
  - `reportDate`
  - `reportType`
  - `filename`
  - `sourceUploadName`
  - `branchCodes`
  - printed status fields
  - `lastAction`
- Branch mapping:
  - `D1180 -> 001`
  - `D6239 -> 003`
  - `D5811 -> 004`
- Formatting/business rules:
  - deletion headers
  - highlight `150`
  - filename parsing rules
  - batch preview naming
  - retention behavior

## 11. Migration implications สำหรับ PERN

- PostgreSQL ควรมี table สำหรับ processing records ที่ map จาก registry headers โดยตรง เพื่อรักษา parity และ traceability
- ควรเก็บ old Drive IDs/URLs เป็น legacy fields แม้ระบบใหม่จะไม่ใช้ Google Drive เป็น storage หลัก
- ต้องตัดสินใจ document/workbook engine สำหรับ Node:
  - import `.xlsx`
  - preserve merged cells
  - delete columns while preserving merges
  - apply fonts, widths, heights, borders, fills
  - export `.xlsx`
- Preview behavior ใน PERN ต้องมี replacement:
  - generated preview workbook file
  - web preview page
  - หรือ storage-based file preview
- Current client ส่งไฟล์เป็น base64 ผ่าน Apps Script; PERN ควรเปลี่ยนเป็น `multipart/form-data` แต่ต้อง preserve user flow และ response shape ให้ใกล้เดิม
- History filters ปัจจุบัน filter ฝั่ง client หลัง fetch all records; PERN อาจรองรับ server-side filters แต่ UI parity ต้องเหมือนเดิมก่อน
- Locking/concurrency ปัจจุบันใช้ `LockService`; PERN ต้องใช้ database transaction/row lock หรือ unique constraints แทน

## 12. Risks และ unknowns

- ไม่พบ sample `.xlsx` ใน repo จึงยังยืนยัน output parity ด้วยไฟล์จริงไม่ได้
- Processing registry spreadsheet ID ไม่ได้ hardcode ใน config; อาจอยู่ใน Script Properties ของ deployed project ต้อง export ก่อน migration
- Workspace folder ID อยู่ใน User Properties ของ Apps Script user/deployment ต้องดึงจาก runtime ถ้าต้อง preserve
- Preview archive folder ID ถูก hardcode แต่สิทธิการเข้าถึงจริงต้องตรวจใน Google Drive
- Current web app access เป็น anonymous แต่ execute as deploying user; PERN ต้องออกแบบ auth/authorization ใหม่หรือระบุว่าจะเปิด public แบบเดิม
- Drive conversion/export behavior อาจให้ผล formatting ต่างจาก library ฝั่ง Node
- `SpreadsheetApp` ไม่รองรับ page setup บางอย่างอยู่แล้ว; ระบบเดิมใช้ frozen rows เป็น print hint ดังนั้น parity ต้องนิยามจาก output ที่ผู้ใช้เห็นจริง
- Branch code map มีเพียง 3 entries ใน code; ถ้าสาขามีมากกว่านี้ต้องหา source mapping เพิ่ม
- Date parsing รองรับรูปแบบที่ code ระบุเท่านั้น; sample data อาจมีรูปแบบอื่นที่ยังไม่ทราบ
- Registry header mismatch จะ throw error ในระบบเดิม; migration ต้องระวัง sheet ที่ถูกแก้มือ
- Stale file cleanup trash ไฟล์ใน workspace folder ตาม retention; ก่อน migration ต้องสำรองไฟล์สำคัญ เพราะบาง output อาจถูกลบแล้ว
- UI text มีภาษาไทยและ typo บางส่วนตามระบบเดิม; การย้ายเป็น React ควรรักษาก่อน แล้วค่อยแก้ภายหลังถ้าต้องการ

## 13. Audit conclusion

ระบบเดิมไม่ใช่ CRUD app ทั่วไป แต่เป็น document/workbook processing workflow ที่พึ่งพา Google Drive conversion, Google Sheets formatting, และ registry spreadsheet อย่างมาก จุดที่เสี่ยงที่สุดในการย้ายไป PERN คือการแทน `SpreadsheetApp`/Drive export ให้ได้ output `.xlsx` ใกล้เคียงเดิม และการ preserve registry/Drive metadata เพื่อให้ประวัติการทำงานไม่หาย

ขั้นถัดไปที่เหมาะสมคือสร้าง `/docs/02-system-specification.md` โดยใช้ audit นี้คู่กับ codebase เพื่อกำหนด data entities, business rules, API endpoints และ PostgreSQL schema candidates แบบละเอียดก่อนเริ่มสร้าง PERN skeleton
