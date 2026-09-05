# ชุดพิมพ์เอกสารบัญชี Shopee — ต้นฉบับและคิวทีละไฟล์

สถานะ 5 กันยายน 2026: ผู้ใช้อนุมัติ commit/push/deploy, migration, อัปเดต Print Agent ที่ 000-HQ และเริ่มพิมพ์พร้อม LINE แล้ว อยู่ระหว่าง rollout ต้องตรวจตัวอย่างจาก Agent จริงก่อนปล่อยคิว และบันทึกผลจริงแยกจากการอนุมัติ

ตรวจ 000-HQ แล้ว: Scheduled Task `ClaspSCxSeamless Print Agent` ใช้ `C:\Users\Administrator\Desktop\ClaspSCxSeamless\print-agent` (ไม่ใช่พาธตัวอย่าง C:\apps), Node 24.19.0, LibreOffice 26.2.5.2, SumatraPDF 3.6.1, Brother MFC-T4500DW คิวว่างก่อน rollout สำรอง schema ก่อน migration 015 และต้องสำรอง Agent/task โดยรักษา `.env` เดิม

## สิ่งที่ผู้ใช้จะได้

- หน้า `/accounting/print-bundle` อัปโหลด PDF/XLSX แยกช่อง SC Drug Store กับ DR.Morepen
- ตรวจเจ้าของร้านใน Statement, Seller Balance และ Income ตรวจรอบรายสัปดาห์จากเนื้อหา และตรวจเลขคำสั่งซื้อกับวันสร้างจาก Income เทียบ All Orders
- เรียงร้าน SC Drug Store ก่อน DR.Morepen ภายในร้านเรียงรอบบัญชี จากเก่าไปใหม่: รายงานการเงิน → Seller Balance → รายละเอียดรายรับ → คำสั่งซื้อ
- คำสั่งซื้อยกมาพิมพ์ครั้งเดียวก่อนคำสั่งซื้อรอบหลักของสัปดาห์แรกที่ใช้ และแสดงรอบรายรับที่เกี่ยวข้องทุกช่วง ไม่ต้องพิมพ์ carry-over ซ้ำทุกรอบ
- เก็บต้นฉบับไม่เปลี่ยนข้อมูล PDF ใช้ไบต์เดิม; XLSX สร้างสำเนาสำหรับพิมพ์ A4 แนวนอน กว้างหนึ่งหน้า ต่อแนวตั้งได้ ก่อนแปลงด้วย LibreOffice
- ให้เปิดต้นฉบับและ PDF ที่จะพิมพ์ พร้อมจำนวนหน้าของแต่ละไฟล์ ก่อนติ๊กตรวจแล้วและกดอนุมัติ
- พิมพ์ PDF ตัวอย่างที่อนุมัติแล้วโดยตรวจ SHA-256; A4, fit, หน้าเดียว, 1 ชุด ไม่รวมเอกสารเป็นไฟล์ใหม่

รูปแบบ `shopee-a4-landscape-reference-v2`: Orders ใช้ 14 คอลัมน์จากชีตรายสัปดาห์ของแบบอ้างอิง raw-only โดยไม่กรองสถานะ เดือน แถวซ้ำ หรือ carry-over; ASM เว้นว่างเมื่อไม่มีใน raw และรายได้สุทธิเป็นสูตรตามแบบเก่า ไม่ใช่ยอดโอนจริง Income. Income เลือกเลขคำสั่งซื้อ วันสร้าง วันโอน และทุกคอลัมน์การเงินที่มีค่าต่างจากศูนย์แม้เพียงหนึ่งแถว (ไม่ใช้ยอดรวมเป็นเกณฑ์) ตัดคอลัมน์เงินที่เป็นศูนย์/ว่างทั้งรอบและรายละเอียดที่ไม่ใช่ยอดเงินตามที่ผู้ใช้อนุญาต ชีต Summary และ Service Fee Details คงข้อมูลครบ หน้าเว็บเปิดดูรายชื่อคอลัมน์ที่พิมพ์/ไม่พิมพ์ได้ Seller Balance คงทุกช่องเดิม การตรวจ PDF ต้องดูหัวคอลัมน์ครบทุกหน้า ไม่ใช่ตรวจขนาดกระดาษอย่างเดียว

## คิวและการกู้เหตุขัดข้อง

ฐานข้อมูลเป็นหลักฐานคิวถาวร มี global advisory lock และ unique active-item index ให้มีงานของชุดนี้ดำเนินการหนึ่งไฟล์เท่านั้น คิวพิมพ์ทั่วไปของระบบจะไม่แทรกระหว่างชุดบัญชีที่ queued/printing/paused

Agent ดาวน์โหลด/แปลงตัวอย่างโดยไม่พิมพ์จนครบ แล้วชุดงานเข้าสู่ `review` การอนุมัติผูกกับ digest ของไฟล์ ตัวอย่าง จำนวนหน้า ลำดับ และเครื่องปลายทาง การอัปโหลดชุดเดิมหรือกดอนุมัติซ้ำไม่สร้างงานใหม่

ก่อนส่งเข้า Windows spooler บันทึก `submitted` บน server แล้วติดตาม Job ID ที่ชื่อเอกสารตรง UUID ไฟล์นี้โดยเฉพาะ มี heartbeat 30 วินาที และ lease 3 นาที กรณี agent หาย server ตรวจ lease ทุก 30 วินาที:

- สร้างตัวอย่างค้าง: ขอทำใหม่ได้ด้วย token ใหม่ ยังไม่เคยพิมพ์
- พิมพ์ค้าง/ไม่พบ Job ID/คิว error: หยุดทั้งชุดเป็น `paused` ไม่ส่งซ้ำอัตโนมัติ
- เจ้าหน้าที่ต้องตรวจเอกสารและงานค้างที่เครื่องก่อนเลือกพิมพ์ฉบับเดิมใหม่ หรือยืนยันว่ากระดาษครบแล้ว พร้อมบันทึกเหตุผล/ผู้ดำเนินการ
- งานที่เสร็จไปแล้วไม่ถูกพิมพ์ซ้ำเมื่อดำเนินการต่อ

“ออกจากคิวแล้ว” คือผลจาก Windows ไม่ใช่เซนเซอร์นับกระดาษจริง ห้ามบอกว่ากระดาษออกครบโดยไม่มีคนตรวจ กรณีงานจบเร็วจนไม่เห็น Job ID ระบบเลือกหยุดให้ตรวจ ไม่สมมติว่าสำเร็จ

## LINE

ใช้การตั้งค่า LINE เดิมของ Seamless แจ้งพร้อมตรวจ/เริ่มพิมพ์/หยุด/ทำต่อ/จบร้าน/จบชุด ข้อความภาษาไทยระบุ Batch ID ร้าน รอบบัญชี ลำดับไฟล์ จำนวนไฟล์/หน้า carry-over เครื่องปลายทาง และลิงก์รายการฉบับเต็ม โดยไม่ส่งข้อมูลผู้ซื้อในข้อความ

Outbox เก็บข้อความและผลตอบรับแยกจากสถานะพิมพ์ หาก LINE ล้มเหลวไม่สั่งพิมพ์ซ้ำ ลองส่งด้วย `X-Line-Retry-Key` เดิมทุก 2 นาทีตามลำดับข้อความ และหยุด retry อัตโนมัติเมื่อเกิน 23 ชั่วโมงเพื่อไม่เสี่ยงส่งซ้ำหลังหน้าต่าง dedup 24 ชั่วโมง กรณีนี้ต้องให้ผู้ดูแลตรวจประวัติ LINE/outbox; ยังไม่มีปุ่มปลด outbox ที่หมดอายุใน UI จึงเป็นเงื่อนไขที่ต้องเฝ้าดูในการเปิดใช้งานครั้งแรก

LINE “รับข้อความแล้ว” ไม่ยืนยันว่าคนอ่านแล้ว อนุมัติไม่ได้หากยังไม่มี LINE token/target หรือ URL เว็บ

## เปิดใช้จริง — ต้องอนุมัติ deployment แยกจากการพิมพ์

Backend อยู่ใน `currentSC-official-website-project` คู่กับ branch `feat/accounting-print-bundle-20260905` อ่าน `backend/docs/accounting-original-print-batches.md` ก่อน deploy

1. ตรวจ diff ทั้งสอง repo และทดสอบ อนุมัติ commit/push/deploy ก่อนดำเนินการ
2. Deploy backend พร้อม migration `015_accounting_original_print_batches.sql` โดย feature flag ยังเป็น false ตรวจ migration ledger และสำรองข้อมูลตามขั้นตอนระบบเดิม
3. เก็บไฟล์บน R2 และตั้งเครื่องเป้าหมาย/URL/LINE ให้ถูก ห้ามใช้ storage ชั่วคราวของ server
4. อัปเดตไฟล์ `print-agent/src/{index,apiClient,convert,print,originalBatch,accountingPrintLayout}.js` และ package/lockfile บน 000-HQ แล้ว `npm ci --omit=dev` (เพิ่ม ExcelJS 4.4.0) โดยสำรองรุ่นก่อนหน้าและไม่ทับ `.env`/logs สั่งหยุด task เฉพาะเมื่อไม่มีงานกำลังพิมพ์ และตรวจ lock/process/spooler ก่อนเริ่มใหม่
5. ตั้ง backend `SEAMLESS_ACCOUNTING_BATCH_ENABLED=true` แล้ว agent `ACCOUNTING_BATCH_ENABLED=true` ก่อนอัปโหลดชุดงาน ตรวจ `AGENT_HOST` และ `PRINTER_NAME` ตรงกันทั้งสองฝั่ง
6. Deploy frontend เปิดหน้าใหม่ อัปโหลดต้นฉบับให้ agent สร้าง PDF ตรวจตัวอย่างจาก converter/ฟอนต์จริงบนเครื่องสาขา
7. ให้ผู้ใช้อนุมัติการพิมพ์แยกต่างหาก ห้ามใช้การอนุมัติ deployment เป็นการอนุมัติพิมพ์
8. การทดลองกระดาษจริงต้องขออนุมัติก่อน เฝ้าดู Job ID และลำดับฉบับแรก จากนั้นตรวจ LINE และกระดาษทุกประเภท

เมื่ออัปโหลดสำเร็จครบและระบบจริงเก็บไฟล์ถาวรแล้ว ผู้ส่งปิดคอม/เบราว์เซอร์ได้; backend, อินเทอร์เน็ต, เครื่อง 000-HQ และเครื่องพิมพ์ต้องทำงานต่อ หน้า preview แบบ localhost ในการพัฒนายังต้องเปิดคอมเครื่องนี้ไว้ ไม่ใช่ระบบ production

Rollback: ห้ามสลับกลับ agent เก่าหรือปิด flag ระหว่างมีชุด queued/printing/paused เพราะจะคลายการกันคิวเดิม ให้หยุด Scheduled Task หลังตรวจงานปัจจุบันจบและจัดการคิวค้างก่อน เก็บตาราง/ไฟล์/audit trail ไว้ ห้าม drop migration เพื่อ rollback

## การทดสอบโดยไม่พิมพ์จริง

```powershell
# จาก client/
npm test
npm run build
# จาก print-agent/
npm test
node src/index.js --dry-run
```

`--dry-run` ไม่ claim/แปลง/ส่ง LINE/พิมพ์ จึงไม่ใช่หลักฐานทดสอบเครื่องจริง

Backend มี tests parser/auth/LINE mock และ `scripts/test-accounting-originals-postgres.cjs` ทดสอบ PostgreSQL จริงเฉพาะ loopback ใน schema ชั่วคราว ครอบคลุม claims แข่งกัน, digest, retry, restart, manual resume, LINE outbox และ atomic uploads

ไฟล์จริงรอบ 27 ก.ค.–30 ส.ค. 2026: 42 ไฟล์ ร้านละ 21 (5 statement + 5 balance + 5 income + 6 orders) ตรวจ Income coverage SC Drug Store 272/272, DR.Morepen 32/32 สัปดาห์ carry-over 20–26 ก.ค. ของทั้งสองร้านพิมพ์ครั้งเดียว

ยังไม่ทดสอบกระดาษจริง/LINE group จริง/ฟอนต์บน scheduled-task session หลัง deployment

### ผลตรวจตัวอย่างในเครื่อง

สร้าง PDF ตัวอย่างครบทุกต้นฉบับด้วย LibreOffice สำเนาโปรแกรมรุ่นที่ติดตั้งบนเครื่องสาขา แต่รันในเครื่องผู้ส่งด้วย profile ชั่วคราว ไม่สั่งพิมพ์ ไม่แก้ไฟล์ในสองโฟลเดอร์ต้นฉบับ และไม่แก้โปรแกรมบนเครื่องสาขา

| ประเภท | ไฟล์ | หน้า |
|---|---:|---:|
| รายงานการเงิน | 10 | 20 |
| Seller Balance | 10 | 16 |
| รายละเอียดรายรับ | 10 | 42 |
| คำสั่งซื้อทั้งหมด | 12 | 67 |
| รวม | 42 | 145 |

SC Drug Store 108 หน้า; DR.Morepen 37 หน้า แทนตัวอย่างรุ่นเดิมที่ผู้ใช้ปฏิเสธ 1,264 หน้า ตรวจข้อมูล 32 สำเนา Excel เทียบต้นฉบับ 16,919 ช่อง ผ่าน; ตรวจขนาดกระดาษ/ขอบเขตข้อความทุกหน้า PDF และหัวคอลัมน์ Orders/Income ทุกหน้าตารางผ่าน ตรวจภาพตัวอย่าง Summary, Income, Balance, Orders รวมหน้าท้าย Orders ที่ยาวที่สุดแล้ว แต่ไม่ได้ตรวจภาพทุกหน้าด้วยตา หลังคำรายงานเรื่องคอลัมน์ล้น ผู้ใช้อนุมัติ deployment และพิมพ์อย่างชัดแจ้งแล้ว การอนุมัตินี้ไม่แทนการตรวจตัวอย่างที่สร้างบนเครื่องสาขา และไม่ใช่หลักฐานว่ากระดาษออกครบ

ผลทดสอบล่าสุด: client 118 ข้อ, agent 45 ข้อ, backend parser/auth/LINE 11 ข้อ, PostgreSQL queue/recovery/layout 6 สถานการณ์ ผ่านทั้งหมด; client build ผ่าน เพิ่ม regression ให้ API client มีเมธอด batch จริง และ server ปฏิเสธ Excel preview แนวตั้ง/ไม่มี layout v2 ทั้งนี้ยังมีข้อจำกัดของ full-suite เดิมตามเอกสาร backend

อ้างอิง protocol: [LINE retry](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/) และ [SumatraPDF command-line options](https://www.sumatrapdfreader.org/docs/Command-line-arguments)
