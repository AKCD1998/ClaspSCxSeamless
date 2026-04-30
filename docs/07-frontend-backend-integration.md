# 07 Frontend Backend Integration

วันที่จัดทำ: 2026-04-30

เอกสารนี้สรุปการเชื่อม React frontend กับ Express backend สำหรับ PERN migration รอบแรก โดยยังไม่ deploy production

## Summary

React UI เดิมที่ migrate จาก GAS ได้เปลี่ยนจาก placeholder/mock API เป็น HTTP calls จริงไปยัง Express backend แล้ว

ไฟล์หลักที่เกี่ยวข้อง:

- `client/src/services/api.js`
- `client/src/pages/HomePage.jsx`
- `client/src/components/UploadPanel.jsx`
- `client/src/components/HistoryPanel.jsx`
- `server/src/routes/workbookRoutes.js`
- `server/src/routes/processingRecordRoutes.js`
- `server/src/routes/fileRoutes.js`
- `server/src/services/workbookService.js`

## Environment Variable

Frontend ใช้ Vite env variable:

```txt
VITE_API_BASE_URL=http://localhost:3001/api
```

ไฟล์ตัวอย่างอยู่ที่:

```txt
client/.env.example
```

ถ้าไม่ตั้งค่า ระบบจะ fallback เป็น `http://localhost:3001/api`

Backend ใช้ `server/.env` ตาม `server/.env.example` เช่น `DATABASE_URL`, `PUBLIC_BASE_URL`, `STORAGE_DIR` และ PostgreSQL variables ห้าม commit secret จริง

## API Mapping

| React service function | HTTP endpoint | Purpose |
| --- | --- | --- |
| `getBootstrap()` | `GET /api/bootstrap` | โหลด config เช่น max upload size และ batch limit |
| `processWorkbookPayload(payload)` | `POST /api/workbooks/process` | อัปโหลด workbook ด้วย `multipart/form-data` |
| `fetchProcessingHistory(filters)` | `GET /api/processing-records` | โหลด history จาก PostgreSQL |
| `markProcessingHistoryPrinted(id)` | `POST /api/processing-records/:id/mark-printed` | mark printed |
| `markProcessingHistoryUnprinted(id)` | `POST /api/processing-records/:id/mark-unprinted` | mark unprinted |
| generated file link | `GET /api/files/:id/download` | ดาวน์โหลด generated `.xlsx` หรือ preview workbook |

## Workflow Status

### Upload Individual / Summary

Frontend:

1. User เลือก `.xlsx`
2. UI validate จำนวนไฟล์และนามสกุล
3. ส่งทีละไฟล์แบบ sequential เหมือน GAS เดิม
4. ไฟล์แรกไม่มี `previewWorkbookId`
5. Backend สร้าง preview workbook แล้วส่ง `previewSpreadsheetId` และ `batchId` กลับ
6. ไฟล์ถัดไปส่ง `previewSpreadsheetId` และ `batchId` เพื่อ append preview workbook เดิม
7. UI แสดง loading, warnings, errors, preview link และ download links

Backend:

1. รับ multipart upload ด้วย `multer`
2. ใช้ `exceljs` โหลด workbook
3. detect variant แล้วใช้ requested formatter mode เป็นหลัก
4. transform workbook ตาม rules ที่ย้ายมาจาก GAS บางส่วน
5. สร้าง processed `.xlsx`
6. สร้างหรือ append preview workbook `.xlsx`
7. บันทึก `processing_records`, `workbook_uploads`, `generated_files`, `preview_sheets`, `operation_logs`
8. ส่ง response shape ใกล้เคียง GAS เดิมให้ UI

### Processing History

- UI ยัง preserve behavior เดิมโดย fetch records แล้ว filter ฝั่ง client
- Backend รองรับ query filters แล้ว แต่ UI รอบนี้ยังรักษา client-side filtering เพื่อ parity กับ GAS
- Mark printed/unprinted เรียก Express endpoint และ reload history หลังสำเร็จ

## Behavior Differences From GAS

รายการที่ต่างจากระบบเดิมในรอบนี้:

- GAS ส่งไฟล์เป็น base64 ผ่าน `google.script.run`; PERN ส่งเป็น `multipart/form-data`
- GAS preview เป็น Google Sheets; PERN รอบนี้สร้าง preview workbook เป็น local `.xlsx`
- GAS download/view URL เป็น Google Drive URL; PERN รอบนี้เป็น `/api/files/:id/download`
- Workbook transform ใช้ `exceljs`; formatting/merged-range parity ต้อง test กับ sample `.xlsx` จริงก่อน production
- Google Drive conversion/export behavior ยังไม่ได้จำลองครบ 100%
- History link column เปลี่ยน wording จาก Google Drive เป็น file link เพราะ output ใหม่อาจเป็น local file

## Required Local Run

ติดตั้ง dependencies:

```powershell
npm install
```

เตรียม database:

```powershell
npm run db:migrate
npm run db:seed
```

รัน backend:

```powershell
npm run dev:server
```

รัน frontend:

```powershell
npm run dev:client
```

เปิด frontend:

```txt
http://localhost:5173
```

## Validation Notes

ตรวจแล้ว:

- `client/src/services/api.js` ไม่มี mock/placeholder records แล้ว
- Client build ผ่านด้วย `npm.cmd --prefix client run build`
- Server route/controller/service syntax ผ่าน `node --check`
- Server app load ผ่าน `require('./server/src/app').createApp()`

ยังไม่ได้ยืนยัน end-to-end ด้วยไฟล์ `.xlsx` จริง เพราะต้องมี PostgreSQL ที่ migrate แล้วและ sample workbook จริง

## Open Follow-ups

- เพิ่ม automated integration tests หลังมี test database
- เพิ่ม sample workbook parity tests สำหรับ individual/summary
- ปรับ preview ให้เป็น web preview หรือ retained Google Drive bridge ถ้าผู้ใช้ต้องเปิดแบบ Google Sheets เหมือนเดิม
- เพิ่ม auth/actor mapping ถ้าระบบ production ไม่ควร anonymous เหมือน GAS เดิม
