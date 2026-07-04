# 07 Frontend Backend Integration

วันที่จัดทำ: 2026-04-30

เอกสารนี้สรุปการเชื่อม React frontend กับ Express backend สำหรับ PERN migration รอบแรก และสถานะที่พร้อม deploy บน Render โดยไม่ต้องใช้ GAS UI เป็น frontend หลัก

## Summary

React UI เดิมที่ migrate จาก GAS ได้เปลี่ยนจาก placeholder/mock API เป็น HTTP calls จริงไปยัง Express backend แล้ว และสามารถ serve เป็น frontend หลักจาก backend เดียวกันได้

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

ถ้าไม่ตั้งค่า ระบบจะ fallback เป็น same-origin `/api` ใน browser และ fallback เป็น `http://localhost:3001/api` ใน local SSR/test

Backend ใช้ `server/.env` ตาม `server/.env.example`

ค่าที่ prefer สำหรับ production ของ workspace นี้:

```txt
SC_OFFICIAL_SUPABASE_DATABASE_URL=postgresql://...
SEAMLESS_DB_SCHEMA=clasp_scx_seamless
PUBLIC_BASE_URL=https://<render-service>.onrender.com
STORAGE_DIR=/var/data/storage
```

Server ยังรองรับ `DATABASE_URL` และ `DB_SCHEMA` เป็น alias เพื่อ backward compatibility แต่ไม่ใช่ชื่อหลักที่ควรใช้ใน Render ของ repo นี้

## API Mapping

| React service function | HTTP endpoint | Purpose |
| --- | --- | --- |
| `getBootstrap()` | `GET /api/bootstrap` | โหลด config เช่น max upload size และ batch limit |
| `processWorkbookPayload(payload)` | `POST /api/workbooks/process` | อัปโหลด workbook ด้วย `multipart/form-data` |
| `fetchProcessingHistory(filters)` | `GET /api/app/processing-records` | Browser-facing history API สำหรับ React frontend |
| `markProcessingHistoryPrinted(id)` | `POST /api/app/processing-records/:id/mark-printed` | mark printed จาก React frontend |
| `markProcessingHistoryUnprinted(id)` | `POST /api/app/processing-records/:id/mark-unprinted` | mark unprinted จาก React frontend |
| generated file link | `GET /api/files/:id/download` | ดาวน์โหลด generated `.xlsx` หรือ preview workbook |

หมายเหตุ:

- `GET/POST/PATCH /api/processing-records` path เดิมยังคงอยู่สำหรับ internal/GAS integration
- React frontend ใช้ `/api/app/processing-records` เพื่อไม่ต้องพก internal token ใน browser

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

Production shape ที่รองรับแล้ว:

- build `client/` เป็น `client/dist`
- ให้ Express serve static frontend ที่ `/` และรองรับ SPA route fallback เช่น `/history`
- ใช้ same-origin API calls จาก React ไป `/api/*`
- deploy เป็น Render web service เดียวผ่าน `render.yaml`

## Validation Notes

ตรวจแล้ว:

- `client/src/services/api.js` ไม่มี mock/placeholder records แล้ว
- Client build ผ่านด้วย `npm.cmd --prefix client run build`
- Server route/controller/service syntax ผ่าน `node --check`
- Server app load ผ่าน `require('./server/src/app').createApp()`
- local production-style stack ผ่านจริงกับ Supabase project `fneevjmjlgvjqcocknft`
- `POST /api/workbooks/process` สร้างข้อมูลจริงใน `clasp_scx_seamless.processing_records`
- `GET /api/app/processing-records` อ่าน record ที่เพิ่งสร้างกลับมาได้

ตัวอย่างล่าสุดที่ยืนยันแล้ว:

- ก่อนทดสอบ `clasp_scx_seamless.processing_records` มี `0` แถว
- ยิง upload workbook ตัวอย่างเข้า backend local ที่ชี้ production Supabase
- หลังทดสอบ `processing_records = 1`, `processing_batches = 1`, `workbook_uploads = 1`, `generated_files = 3`, `preview_sheets = 1`

## Render Deploy Notes

ไฟล์ `render.yaml` ที่ root ของ repo ถูกเตรียมไว้สำหรับ deploy แบบ:

- Render web service เดียว
- React build ถูก serve จาก Express
- health check ใช้ `GET /api/health`
- migrations และ seeds รันผ่าน `preDeployCommand`
- generated files เก็บใน persistent disk ที่ `/var/data/storage`

ค่าที่ต้องตั้งใน Render Dashboard ให้ตรง:

- `SC_OFFICIAL_SUPABASE_DATABASE_URL`
- `SEAMLESS_DB_SCHEMA=clasp_scx_seamless`
- `PUBLIC_BASE_URL=https://<render-service>.onrender.com`
- `CORS_ORIGIN=https://<render-service>.onrender.com`

## Open Follow-ups

- เพิ่ม automated integration tests หลังมี test database
- เพิ่ม sample workbook parity tests สำหรับ individual/summary
- ปรับ preview ให้เป็น web preview หรือ retained Google Drive bridge ถ้าผู้ใช้ต้องเปิดแบบ Google Sheets เหมือนเดิม
- เพิ่ม auth/actor mapping ถ้าระบบ production ไม่ควร anonymous เหมือน GAS เดิม
