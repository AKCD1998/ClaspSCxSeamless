# 04 UI Migration Notes

วันที่จัดทำ: 2026-04-30

เอกสารนี้บันทึกการย้าย UI จาก Google Apps Script HTML/CSS/vanilla JavaScript ไปเป็น React โดยยังไม่เชื่อม backend จริง

## สิ่งที่ย้ายแล้ว

- ย้าย layout หลักจาก `src/client/App.html` เป็น React single-page UI ใน `client/src/pages/HomePage.jsx`
- ย้าย hero, Individual upload panel, Summary upload panel และ Processing History panel ให้ยังอยู่หน้าเดียวกันเหมือน GAS เดิม
- แยก UI เป็น components:
  - `Hero`
  - `UploadPanel`
  - `HistoryPanel`
  - `HistoryDashboard`
  - `HistoryTable`
  - `HistoryGrouped`
  - `HistoryActions`
- ย้าย CSS จาก `src/client/Styles.html` เป็น `client/src/styles/app.css` โดยคง layout, palette, panel style, history tables, grouped view และ responsive behavior เดิมให้ใกล้ที่สุด
- ย้าย browser-side behavior หลักจาก `src/client/Client.js.html` เป็น React state:
  - file selection label
  - `.xlsx` filtering
  - batch limit validation
  - sequential file processing flow
  - status/warnings/results rendering
  - history filters
  - dashboard grouping by report date
  - table/grouped history view toggle
  - printed/unprinted confirmation flow

## Placeholder API

แทนที่ `google.script.run` ด้วย placeholder functions ใน `client/src/services/api.js`

Current placeholder functions:

- `getBootstrap`
- `processWorkbookPayload`
- `fetchProcessingHistory`
- `markProcessingHistoryPrinted`
- `markProcessingHistoryUnprinted`
- `listProcessingRecords`

Placeholder behavior:

- ไม่เรียก production server
- ไม่ประมวลผล workbook จริง
- อ่านไฟล์ด้วย `FileReader` เพื่อคง browser flow เดิม แต่ไม่ได้ส่งให้ backend จริง
- สร้าง mock upload result, preview ID และ processing history record ใน memory
- History records จะหายเมื่อ refresh หน้า
- Download/preview links เป็น placeholder anchors ยังไม่ใช่ไฟล์จริง

## ความแตกต่างจาก GAS เดิมที่ตั้งใจไว้ในรอบนี้

- ยังไม่มี `google.script.run`
- ยังไม่มี Drive conversion/export
- ยังไม่มี Google Sheets preview workbook จริง
- ยังไม่มีการเขียน registry ลง PostgreSQL หรือ Google Sheets
- Output filename จาก placeholder ยังไม่ parse วันที่/branch จาก workbook จริง
- `deletedColumns`, `highlightCount`, `detectedVariant` เป็นค่าจำลอง
- History load มาจาก in-memory mock records ไม่ใช่ registry spreadsheet
- Mark printed/unprinted แก้ mock record ใน memory เท่านั้น

## สิ่งที่พยายาม preserve

- Thai copy และ typo เดิมยังคงไว้เพื่อ parity รอบแรก
- โครงสร้างหน้าเดียวของ GAS เดิมยังคงไว้
- CSS class names หลักของ GAS เดิมยังถูกใช้ต่อหลายจุด เพื่อให้เทียบ visual ได้ง่าย
- Sequential batch processing behavior ถูกเก็บไว้ใน React
- History filter/group/dashboard logic ถูก port จากแนวทางเดิม
- Confirmation text สำหรับ printed/unprinted ยังคงใกล้เคียงเดิม

## Next Step

รอบถัดไปควร migrate Apps Script server functions เป็น Express services แล้วเปลี่ยน placeholder API ใน `client/src/services/api.js` เป็น HTTP calls จริง โดยยังคง response shape ให้ใกล้ GAS เดิมที่สุด
