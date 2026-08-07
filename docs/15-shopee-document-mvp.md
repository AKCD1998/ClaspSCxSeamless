# Shopee Document MVP

วันที่เริ่ม implementation: 2026-08-06

## Purpose

เพิ่ม Shopee เป็น document profile ภายในระบบเอกสารหน้าร้าน-บัญชีเดิม โดยใช้ backend, storage,
processing history, admin print request, print-agent, LINE และอีเมลชุดเดียวกับ Seamless
ไม่สร้าง print queue หรือ credential ชุดใหม่

Workflow เป้าหมาย:

1. ผู้ใช้จากสาขาอัปโหลดไฟล์ `Order.all.*.xlsx` ที่ดาวน์โหลดจาก Shopee
2. Backend ตรวจ schema, normalize วันที่/จำนวนเงิน, สร้างเอกสารพิมพ์ และบันทึกประวัติ
3. Admin ตรวจหน้าสรุปและกดสั่งพิมพ์จาก notebook ที่ใดก็ได้
4. Print-agent ที่สำนักงานใหญ่ poll queue ตามรอบของเครื่องและส่งงานเข้า Windows spooler
5. Backend บันทึกผลและใช้ LINE/อีเมล configuration เดิมแจ้งผลหลังพิมพ์สำเร็จ

## Non-negotiable Safety Rules

- ห้ามเขียนทับหรือลบ `.env`, encryption key, API token, database credential หรือ printer credential
- ห้าม commit ค่า secret; tracked files มีเฉพาะ `.env.example`
- Shopee upload เป็น `printPolicy: manual`: การอัปโหลดอย่างเดียวต้องไม่ทำให้พิมพ์ทันที
- งานจะเข้าคิวเมื่อ admin ใช้ action `request-print`; queued job ยังคงผ่าน claim/lock/double-print protection เดิม
- Source upload ถูกเก็บเพื่อ audit แต่เอกสารพิมพ์ต้องไม่แสดงชื่อผู้ซื้อ ชื่อผู้รับ โทรศัพท์ หรือที่อยู่
- ห้ามนำไฟล์ตัวอย่างจริงที่มีข้อมูลลูกค้าเข้า git fixture; tests ต้องใช้ข้อมูลสังเคราะห์เท่านั้น

## Sample Baseline

ไฟล์ที่ใช้ตรวจ:

- Name: `Order.all.20260601_20260630.xlsx`
- SHA-256: `3E2AE2558E649A34A49D116E4E72D18A28C80B795A255CD64685E904A9C7459B`
- Sheet: `orders`
- Shape: 59 columns, 20 data rows
- Important source behavior: วันที่และจำนวนเงินทุกช่องถูก export เป็น text จึงต้อง parse ก่อนคำนวณ
- Period from order rows: 2026-06-01 through 2026-06-30
- Statuses: สำเร็จ 19 rows, ยกเลิก 1 row
- Quantity: 27; returned quantity: 1
- Net sale row total: 10,098.00 THB
- Seller-funded discounts: 700.00 THB
- Shopee fees: commission 967.00 + transaction fee 268.00 + service fee 0.00 = 1,235.00 THB
- `จำนวนเงินทั้งหมด` row total: 7,723.00 THB

ยอดข้างต้นเป็น baseline สำหรับ regression ของไฟล์ตัวอย่าง ไม่ใช่นิยามทางบัญชีถาวร
ก่อนลงบัญชีต้องตรวจเทียบ Shopee Income/Transaction report เพราะ Order export อาจมีหลายแถวต่อคำสั่งซื้อ
และยอดระดับ order อาจถูกซ้ำหรือกระจายต่างกันในไฟล์จากช่วง/เวอร์ชันอื่น

## Output Workbook

Processed workbook เป็นรายงานบัญชี DR.Morepen ตาม verified accounting-cycle configuration
(ดู `server/src/services/shopeeAccountingCycles.js`) ปัจจุบันมี profile ที่ยืนยันแล้วสำหรับ
รอบมิถุนายน 2026 เท่านั้น รอบอื่นที่ยังไม่มี configuration จะ fail closed พร้อมข้อความชัดเจน

Sheet order (exact): `06`, `01-07.06`, `08-14.06`, `15-21.06`, `22-28.06`

- `06` (master): header row 1, data row 2; rows grouped by completed-week (raw order preserved
  within each group); full-row A:M fill per week; column L ทุก data row เป็น Excel formula
  `=Hn-In-Jn-Kn` (cached result เก็บเป็น exact decimal ไม่ round; `#,##0` เป็น display format เท่านั้น)
- ชีตรายสัปดาห์ `01-07.06`/`08-14.06`/`15-21.06`/`22-28.06`: period label ที่ D1, header row 2,
  data row 3; sort completed time ascending แล้ว raw row number; header fill `#C0E6F5`;
  เฉพาะ cell ในคอลัมน์ M ลงสีตาม completed-date (วันเดียวกันได้สีเดียวกัน); L formula จากแถว 3

คอลัมน์ A:M และ type/format ตาม full accounting specification (A,E text `@`; B,M true Date
`yyyy-mm-dd hh:mm`; F `#,##0`; H,I,J,K `#,##0.00`; L `#,##0`); font Angsana New 14, center,
no borders, gridlines visible, no freeze panes; wrap ที่ C และ multiline headers I–K; comment
ที่ `06!L1` และทุก weekly `L2`

Filtering: skip blank order number; exclude status `ยกเลิกแล้ว`; include order date ตาม cycle window
(มิถุนายน 2026 = 2026-06-01 00:00:00 ถึง 2026-06-28 23:59:59); รายการวันที่สั่งซื้อ 29–30 มิถุนายน
ถูกกันไปรอบกรกฎาคม; จัดชีตรายสัปดาห์ด้วย completed time (BF); รายการ included ที่ไม่มี completed time
หรือจัดสัปดาห์ไม่ได้จะ throw (never silent drop)

ผลจากไฟล์ baseline: raw 20 → cancelled 1 + carryover 2 ถูกตัด → master 17 rows;
weekly 6/7/2/2; net totals 2,299/2,422/722/505 = master 5,948
(expected counts/totals ใช้เป็น regression oracle ใน test/verification เท่านั้น ไม่ hardcode ลง output)

`result.worksheet` ชี้ไปที่ master sheet `06` (self-contained, ใช้ใน preview workbook ผ่าน
`copyWorksheet`); metadata คง keys เดิม (`periodStart`/`periodEnd`/`printPolicy:'manual'`/
`rowCount`/`statuses`/`totals`/...) และเพิ่ม accounting-cycle keys (`cycleKey`, `weeklyCounts`,
`weeklyNetTotals`, `cancelledExcluded`, `carryoverExcluded`, `finalRows`, ...)

Production output filename ขับจาก cycle profile: `{periodStart}_to_{periodEnd}-dr-morepen-accounting.xlsx`
(ไม่มี literal เดือนในชื่อไฟล์ — ปลอดภัยสำหรับเดือนอื่น); ชื่อ literal
`DR.Morepen_รายงานการเงิน_มิถุนายน_สร้างจาก_raw.xlsx` ใช้ใน `scripts/verify-shopee-workbook.js`
สำหรับ local visual QA เท่านั้น เพื่อเทียบกับ manual artifact เดิม

## Database and API Changes

- Formatter/report type เพิ่ม `shopee`
- Migration: `server/db/migrations/006_add_shopee_document_type.sql`
- `GET /api/bootstrap` ประกาศ mode `shopee`
- Endpoint upload เดิม: `POST /api/workbooks/process` พร้อม `formatterMode=shopee`
- History endpoint เดิม filter ด้วย `reportType=shopee`
- Manual print endpoint เดิม: `POST /api/app/processing-records/:id/request-print`
- Auto-print query ข้าม records ที่มี `metadata.printPolicy = manual` แต่ queued admin requests ยังถูก poll ตามปกติ

## Frontend

- `/shopee/upload`: upload workflow จริง ไม่ใช่ placeholder
- `/shopee/history`: history ถูก lock ที่ `reportType=shopee` และใช้ download/email/request-print actions เดิม

## Verification

- Server tests include synthetic Shopee workbook typing, formulas, PII exclusion, filename period, and wrong-page rejection
- Client render tests cover Shopee upload/history pages
- Production client build succeeds
- Real sample was exported through Excel PDF rendering for a visual two-page print check

Database-backed print tests require `TEST_DATABASE_URL`; do not point this variable at production merely to run tests.

## Session Operating Context

- Primary repo: `ClaspSCxSeamless`
- Codex acts as tech lead/reviewer
- Claude Sonnet 5 is intended as senior developer/reviewer when the owner invokes it
- GLM 5.2 is intended for larger-volume, lower-complexity implementation tasks when the owner invokes it
- Review priority: prevent secret/key overwrite, preserve existing user work, prevent duplicate physical prints, and keep an auditable source-to-output trail
