# 13 PharmCare Finance Email Automation

วันที่บันทึก: 2026-08-01  
สถานะ: discovery/design note — forward ย้อนหลังแบบ deduplicate แล้ว; ยังไม่ได้ implement Gmail ingestion, PDF processing หรือสร้าง R2 bucket/prefix สำหรับงานนี้

## 1. เป้าหมายใหญ่

สร้าง automation ที่รับเอกสารจากพนักงาน/พาร์ทเนอร์ แล้วส่งต่อถึงฝ่ายบัญชีของบริษัทโดยตรง ลดการส่งเอกสารผ่านคนกลางและลดโอกาสที่เอกสารตกหล่น

ขอบเขตแรกคือเอกสารการเงินจาก PharmCare โดยใช้ `admin@scgroup1989.com` เป็น mailbox กลางสำหรับ automation และใช้เว็บ ClaspSCxSeamless เป็นที่จัดเก็บ ตรวจสอบ รวมเอกสาร และสั่งพิมพ์

Flow ทางธุรกิจที่เจ้าของระบบอธิบาย:

1. ลูกค้าหรือแพทย์สั่งยาให้ลูกค้า
2. PharmCare เป็นตัวกลางหาร้านยาพาร์ทเนอร์ที่อยู่ใกล้และพร้อมให้บริการ
3. ร้านยาจัดยา
4. PharmCare ประสานผู้ให้บริการขนส่ง เช่น Lalamove หรือ LINE MAN
5. เมื่อจบเคสและมีการชำระเงิน จะเกิดข้อมูล/เอกสารการเงินที่เกี่ยวข้องกับบริษัท
6. PharmCare ส่งอีเมลแจ้งเตือนและเอกสารการเงิน
7. ระบบต้องรับเอกสาร จัดประเภท ตั้งชื่อ เก็บ รวมเป็นชุด ตรวจโดยมนุษย์ แล้วส่งพิมพ์ให้ฝ่ายบัญชี

ข้อ 1–6 เป็น business understanding จากเจ้าของระบบ ยังต้องเทียบ transaction ID/เลขเอกสารกับข้อมูลจริงก่อนถือว่าเอกสารรายเคสหนึ่งฉบับเท่ากับหนึ่งเคสเสมอ

## 2. บัญชีอีเมลและ routing ปัจจุบัน

- Mailbox ต้นทางเดิม: `auukunn.bkk@gmail.com`
- Mailbox กลางสำหรับ automation: `admin@scgroup1989.com`
- ผู้ส่งหลักของ PharmCare: `info@pharmcare.co`
- `pharmcare_business@googlegroups.com` และ `pharmcare_ops@googlegroups.com` พบเป็น CC แต่จากการตรวจย้อนหลังยังไม่พบว่าเป็นผู้ส่งจริง
- Gmail ของ `auukunn.bkk@gmail.com` มี filter ที่ verified และใช้งานอยู่:
  - เงื่อนไข `from:(<info@pharmcare.co>)`
  - Forward ไป `admin@scgroup1989.com`
  - Never send it to Spam
  - Mark as important
- Global forwarding ของทั้งสองบัญชีปิดอยู่ การส่งต่อเกิดจาก filter เฉพาะผู้ส่ง

สถานะจากการตรวจแบบ read-only ณ 2026-08-01:

- `auukunn.bkk@gmail.com` มีอีเมลจาก `info@pharmcare.co` 56 ฉบับ
- `admin@scgroup1989.com` มีอีเมล PharmCare ที่ถูก filter ส่งต่อแล้ว 5 ฉบับ: e-credit invoice 4 ฉบับ และสัญญา Telepharmacy 1 ฉบับ
- Backlog จาก `info@pharmcare.co` ก่อน 2026-06-17 มี 51 ฉบับก่อนตรวจ duplicate
- ตรวจพบอีเมลซ้ำ 10 ฉบับจาก 8 กลุ่มเลข CIV โดยไฟล์ของแต่ละกลุ่มมีชื่อ ขนาด และเนื้อหา PDF ตรงกัน จึงไม่ forward ฉบับซ้ำ
- Forward ไป `admin@scgroup1989.com` แล้ว 41 ฉบับเมื่อ 2026-08-01 แบ่งเป็น e-credit invoice ไม่ซ้ำ 25 ฉบับ, รายงานสรุปรอบ 8 ฉบับ และอีเมลข้อมูลใบเสร็จ/ใบกำกับภาษี 8 ฉบับ
- ไม่ส่งซ้ำ 5 ฉบับที่มีอยู่ใน admin แล้ว และไม่รวม calendar/webinar invitation 2 ฉบับจากผู้ส่งรายบุคคลในโดเมน PharmCare
- ตรวจยืนยันหลังส่ง: Sent ของ `auukunn.bkk@gmail.com` และ Inbox ของ `admin@scgroup1989.com` แสดงรายการ historical forward ใหม่ตรงกัน 41 ฉบับ

## 3. ข้อควรระวังสำคัญที่สุด: รูปแบบอีเมล Forward ไม่เหมือนกัน

> **ห้าม classifier ตรวจเฉพาะช่อง `From` หรือ subject แบบตรงตัว**

อีเมลใหม่ที่ Gmail filter ส่งต่ออัตโนมัติมายัง `admin@scgroup1989.com` ปัจจุบันยังแสดงผู้ส่งเดิมเป็น `info@pharmcare.co` และ subject เดิม โดย visible `To` อาจยังเป็น `auukunn.bkk@gmail.com` และไม่ได้แสดง admin อยู่ใน To/CC

แต่อีเมลย้อนหลังที่สั่ง Forward แบบ manual/API จะมีลักษณะต่างออกไป:

- ผู้ส่งใหม่เป็น `auukunn.bkk@gmail.com`
- subject ขึ้นต้นด้วย `Fwd:`
- ข้อความต้นฉบับถูก inline ไว้ใน body
- ไฟล์แนบต้นฉบับยังติดมากับอีเมลที่ forward

ดังนั้น automation ต้องรองรับอย่างน้อยสองเส้นทาง:

| เส้นทาง | From ที่ admin เห็น | Subject | วิธีหา identity ต้นฉบับ |
|---|---|---|---|
| Gmail filter สำหรับอีเมลใหม่ | `info@pharmcare.co` | subject เดิม | Gmail headers + subject + attachment |
| Historical manual/API forward | `auukunn.bkk@gmail.com` | `Fwd: ...` | forwarded headers/body + normalized subject + attachment |

Classifier ที่เหมาะสมควรทำตามลำดับนี้:

1. อ่าน Gmail message metadata และเก็บ Gmail message ID เพื่อกัน ingest ซ้ำใน mailbox เดียวกัน
2. Normalize subject โดยตัด prefix เช่น `Fwd:`, `FW:` และ prefix ที่ซ้ำหลายชั้น
3. ถ้า From เป็น `auukunn.bkk@gmail.com` ให้ parse forwarded block เพื่อหา original From/subject/date เท่าที่มี
4. ใช้ชื่อไฟล์แนบและรูปแบบเลขเอกสารเป็นสัญญาณหลักร่วมด้วย
5. คำนวณ SHA-256 ของไฟล์แนบทุกไฟล์ และใช้เลขเอกสาร/ช่วงเวลาเป็น business dedup key
6. อย่าใช้ Gmail message ID เพียงอย่างเดียวในการ deduplicate เพราะการ forward สร้าง message ใหม่และเอกสารเดียวกันอาจมากกว่าหนึ่งเส้นทาง

## 4. ประเภทอีเมล PharmCare ที่พบจริง

ผลตรวจ `auukunn.bkk@gmail.com` แบบ all mail โดยตัด Trash/Spam และค้น exact sender `info@pharmcare.co` รวม 56 ฉบับ:

| ประเภทที่พบ | จำนวน | ลักษณะ | แนวทาง automation |
|---|---:|---|---|
| e-credit invoice | 39 | Subject มี `PharmCare e-credit invoice` และแนบ PDF ชื่อขึ้นต้น `CIV...` บางเลขเอกสารพบซ้ำ | ingest เป็น financial document; dedup ด้วย hash + CIV number |
| รายงานสรุปข้อมูลบริการตามรอบ | 8 | Subject ระบุช่วง `01-15` หรือ `16-วันสุดท้าย`; แนบ `MRR...pdf` และ `SFR...pdf` อย่างละหนึ่งไฟล์ | สร้าง settlement cycle และรอเอกสารคู่ให้ครบ |
| ข้อมูลใบเสร็จรับเงิน/ใบกำกับภาษี | 8 | ไม่มี attachment และมีลิงก์ PharmCare ให้เปิด/ลงนาม | แยก queue; ห้ามถือว่าไม่มีเอกสาร เพียงเพราะไม่มี attachment; ต้องออกแบบ link retrieval ภายหลัง |
| สัญญา Telepharmacy | 1 | แนบ PDF 2 ไฟล์ | non-financial/contract; ไม่เข้าชุดพิมพ์บัญชีอัตโนมัติโดย default |

นอกจากนี้พบ calendar invitation จากบุคคลในโดเมน PharmCare อีก 2 ฉบับ แต่ไม่ใช่ financial document

## 5. ผลตรวจรอบสรุปยอดจากอีเมลจริง

Search scope: all mail ของ `auukunn.bkk@gmail.com`, exclude Trash/Spam, sender `info@pharmcare.co`, subject กลุ่ม “รายงานสรุปข้อมูลบริการประจำเดือน” พบทั้งหมด 8 ฉบับ

เวลาส่งด้านล่างแปลงเป็นเวลา Asia/Bangkok แล้ว:

| ช่วงบริการใน Subject | อีเมลมาถึง | วันที่ PharmCare ระบุว่าจะโอนภายใน | ไฟล์แนบ |
|---|---|---|---|
| 01–15 ส.ค. 2568 | 23 ส.ค. 2568 03:13 | 31 ส.ค. 2568 | `MRR2508-1-HSPCP00533.pdf`, `SFR2508-1-HSPCP00533.pdf` |
| 16–31 ส.ค. 2568 | 8 ก.ย. 2568 03:17 | 15 ก.ย. 2568 | `MRR2508-2-HSPCP00533.pdf`, `SFR2508-2-HSPCP00533.pdf` |
| 01–15 ก.ย. 2568 | 23 ก.ย. 2568 03:15 | 30 ก.ย. 2568 | `MRR2509-1-HSPCP00533.pdf`, `SFR2509-1-HSPCP00533.pdf` |
| 16–30 ก.ย. 2568 | 8 ต.ค. 2568 03:14 | 15 ต.ค. 2568 | `MRR2509-2-HSPCP00533.pdf`, `SFR2509-2-HSPCP00533.pdf` |
| 01–15 ต.ค. 2568 | 23 ต.ค. 2568 03:13 | 31 ต.ค. 2568 | `MRR2510-1-HSPCP00533.pdf`, `SFR2510-1-HSPCP00533.pdf` |
| 01–15 ม.ค. 2569 | 23 ม.ค. 2569 03:07 | 31 ม.ค. 2569 | `MRR2601-1-HSPCP00533.pdf`, `SFR2601-1-HSPCP00533.pdf` |
| 01–15 ก.พ. 2569 | 23 ก.พ. 2569 03:09 | 28 ก.พ. 2569 | `MRR2602-1-HSPCP00533.pdf`, `SFR2602-1-HSPCP00533.pdf` |
| 16–28 ก.พ. 2569 | 8 มี.ค. 2569 03:08 | 15 มี.ค. 2569 | `MRR2602-2-HSPCP00533.pdf`, `SFR2602-2-HSPCP00533.pdf` |

ข้อสรุปจากหลักฐานที่มี:

- รอบ `01–15` ที่พบทั้ง 5 ฉบับถูกส่งวันที่ 23 ของเดือนเดียวกัน และระบุว่าจะโอนภายในวันสุดท้ายของเดือน
- รอบ `16–วันสุดท้ายของเดือน` ที่พบทั้ง 3 ฉบับถูกส่งวันที่ 8 ของเดือนถัดไป และระบุว่าจะโอนภายในวันที่ 15 ของเดือนถัดไป
- ความจำเดิมว่า “อีเมลส่งวันที่ 30/31 และ 15” น่าจะสลับระหว่าง **วันที่อีเมลมาถึง** กับ **วันที่ PharmCare ระบุว่าจะโอนเงินภายใน**
- จากตัวอย่างจริง pattern วันส่งคือประมาณ `23` และ `8`; pattern วันโอนคือวันสุดท้ายของเดือนและวันที่ `15`
- ช่วงครึ่งหลังต้อง parse วันสุดท้ายจริงของเดือน: 28, 29, 30 หรือ 31 ห้าม hard-code เป็น `16-30`
- Subject ใช้ปี พ.ศ. เช่น 2569 แต่ filename ใช้ปี ค.ศ. แบบสองหลัก เช่น `26`
- Mailbox มีช่วงที่ไม่พบรายงานต่อเนื่อง เช่น ครึ่งหลัง ต.ค. 2568, พ.ย.–ธ.ค. 2568 และครึ่งหลัง ม.ค. 2569 จึงยังสรุปไม่ได้ว่าเป็น “ไม่มีรายการ”, “ไม่ได้ส่ง” หรือ “หาไม่พบ” ระบบต้องแสดง missing-cycle alert แทนการเดา

วันส่งที่พบเป็น observed behavior ไม่ควรถือเป็น SLA แบบตายตัวจนกว่าจะยืนยันกับ PharmCare ระบบต้อง trigger จากการมาถึงของอีเมลจริง และใช้วันที่ 23/8 เป็นเพียง expected-arrival window สำหรับแจ้งเตือนกรณีเอกสารขาด

## 6. การตีความไฟล์รายงานตามรอบ

ในอีเมลแต่ละรอบ PharmCare ระบุว่ารายงานประกอบด้วย:

- ค่ายา `Medicine Cost (Reimbursement)`
- ค่าบริการทางเภสัชกรรม

จากชื่อไฟล์และข้อความใน body มีข้อสันนิษฐานสำหรับ classifier:

- `MRR` น่าจะเป็นรายงานส่วน Medicine/Reimbursement
- `SFR` น่าจะเป็นรายงานส่วน Service Fee
- suffix `-1-` หมายถึงรอบวันที่ 01–15
- suffix `-2-` หมายถึงรอบวันที่ 16–วันสุดท้ายของเดือน
- `HSPCP00533` เป็น partner/facility identifier ที่ต้องเก็บเป็น structured field

ความหมายเต็มของ MRR/SFR ยังควรยืนยันจากเนื้อหา PDF หรือเอกสารจาก PharmCare ก่อนตั้งชื่อ field ทางบัญชีอย่างเป็นทางการ

## 7. Target automation flow

```text
PharmCare
  -> Gmail: admin@scgroup1989.com
  -> ingest email + metadata + attachments
  -> identify original sender / normalize forwarded subject
  -> classify financial vs non-financial
  -> hash + deduplicate
  -> parse document number / service period / partner code
  -> store original file in Cloudflare R2
  -> create database records and settlement cycle
  -> wait/check cycle completeness
  -> human review
  -> merge selected PDFs into one print package
  -> human clicks "ปริ้นเอกสารรอบ {...} ส่งพี่เอ"
  -> existing print-agent / printer workflow
  -> email + LINE group notification
  -> accounting receives the printed document directly
```

ขั้นตอนละเอียด:

1. ระบบตรวจอีเมลใหม่ใน `admin@scgroup1989.com` ด้วย polling หรือ Gmail push mechanism ที่จะเลือกภายหลัง
2. เก็บ metadata สำคัญและ raw/original evidence เท่าที่ policy อนุญาต
3. แยก direct filtered mail กับ historical/manual forward
4. ตรวจ allowlist sender/original sender, subject pattern, MIME type และ attachment filename
5. ดาวน์โหลด attachment ไปพื้นที่ชั่วคราว, คำนวณ hash และตรวจ duplicate ก่อนเขียน storage
6. จัดกลุ่มเอกสารเป็น:
   - per-case financial document
   - settlement MRR
   - settlement SFR
   - receipt/tax link pending retrieval
   - non-financial/ignored
   - unknown/manual review
7. ตั้งชื่อและเก็บไฟล์ใน R2 พร้อม metadata ใน PostgreSQL
8. สร้าง cycle key เช่น `2026-02-H1` หรือ `2026-02-H2` จากช่วงใน subject/filename ไม่ใช่จากวันที่อีเมลเข้ามาอย่างเดียว
9. แสดงความครบถ้วนของรอบ: MRR, SFR และรายการเอกสารรายเคสที่เกี่ยวข้อง
10. ให้มนุษย์เลือก/ตรวจเอกสารก่อน merge; ห้าม merge/print final โดยไม่มี review ใน phase แรก
11. รวม PDF ตามลำดับที่กำหนด แล้วสร้าง immutable print package พร้อม manifest
12. ผู้ใช้กด `ปริ้นเอกสารรอบ {cycle} ส่งพี่เอ`
13. เชื่อมกับ print agent และ LINE/email notification ที่มีอยู่ โดยเพิ่มการรองรับ PDF pass-through
14. บันทึก audit log ตั้งแต่ ingest, classify, rename, merge, approve, print, notify และ reprint

## 8. Classification rules รุ่นแรกที่เสนอ

| Rule | Document type | Required extraction |
|---|---|---|
| normalized subject มี `e-credit invoice` หรือไฟล์ `CIV*.pdf` | `pharmcare_e_credit_invoice` | CIV number, received time, file hash |
| normalized subject มี `รายงานสรุปข้อมูลบริการ` และไฟล์ `MRR*.pdf` | `pharmcare_settlement_mrr` | period start/end, half, HSPCP code |
| normalized subject มี `รายงานสรุปข้อมูลบริการ` และไฟล์ `SFR*.pdf` | `pharmcare_settlement_sfr` | period start/end, half, HSPCP code |
| subject/body กล่าวถึงใบเสร็จรับเงิน/ใบกำกับภาษี แต่ไม่มี attachment | `pharmcare_receipt_link_pending` | URL/reference, expiry/access status |
| subject/body กล่าวถึงสัญญา | `pharmcare_contract` | contract identifier; exclude from auto print |
| ไม่ตรง rule หรือมี conflict | `manual_review` | reason codes + original metadata |

Rule ทุกข้อควรให้ filename/document number มีน้ำหนักมากกว่า display name ของ sender และต้องบันทึก classifier version เพื่อให้ reprocess ได้เมื่อกฎเปลี่ยน

## 9. การตั้งชื่อและ R2 storage

ยังไม่ได้สร้าง R2 bucket/prefix เฉพาะสำหรับ flow นี้ และยังไม่ควรสร้างจนกว่าจะตัดสินใจเรื่อง retention, access และ environment แยก dev/production

แนวทาง object key ที่เสนอ:

```text
pharmcare/{year}/{month}/{cycle-key}/{document-type}/{document-number-or-hash}_{original-filename}
```

ตัวอย่าง:

```text
pharmcare/2026/02/2026-02-H1/settlement-mrr/MRR2602-1-HSPCP00533.pdf
pharmcare/2026/02/2026-02-H1/settlement-sfr/SFR2602-1-HSPCP00533.pdf
pharmcare/2026/02/2026-02-H1/e-credit-invoice/CIVxxxxxxxx.pdf
```

ข้อกำหนด:

- เก็บ `original_filename` แยกใน DB แม้ object key จะถูก normalize
- ห้าม overwrite object เดิมแบบเงียบ ๆ
- เก็บ SHA-256, byte size, MIME type, Gmail message ID, received timestamp และ ingest timestamp
- เก็บไฟล์ต้นฉบับ immutable; PDF ที่ merge แล้วเป็น generated artifact คนละ record
- ใช้ signed/proxied download และจำกัดสิทธิ์เพราะเป็นเอกสารการเงิน
- ห้าม commit R2 credentials หรือข้อมูลบัญชีธนาคารลง repo

## 10. Data model ขั้นต้น

ตาราง/กลุ่มข้อมูลที่ควรมี:

### `email_ingest_messages`

- mailbox account
- Gmail message ID และ thread ID
- route: `direct`, `gmail_filter_forward`, `manual_forward`
- visible From/To/CC
- parsed original From/subject/date
- raw subject และ normalized subject
- received/imported timestamps
- classifier version/status/error
- raw MIME storage reference ถ้าตัดสินใจเก็บ

### `email_attachments`

- parent message
- original filename/MIME/size
- SHA-256
- R2 object key
- ingestion/dedup status

### `pharmcare_financial_documents`

- document type
- document number เช่น CIV number
- partner/facility code เช่น `HSPCP00533`
- service period start/end และ half `H1`/`H2`
- source attachment/link
- verification status
- duplicate/superseded relationship

### `pharmcare_settlement_cycles`

- cycle key
- period start/end
- expected MRR/SFR flags
- completeness/reconciliation/review status
- payment-due date parsed from email body ถ้าต้องใช้
- final print package reference

### `document_packages`

- cycle
- immutable manifest ของ document IDs/hashes ตามลำดับ
- merged PDF reference
- created/approved by/at
- print status และ print job reference

ต้องตัดสินใจภายหลังว่าจะ generalize `processing_records`/`print_jobs` เดิมให้รองรับ PDF package หรือสร้าง relation เพิ่มสำหรับ generic document package โดยต้องไม่ทำลาย Excel workflow เดิม

## 11. การรวม PDF และ human review

ลำดับเอกสารใน package ที่เสนอ:

1. Cover/manifest ของรอบ
2. MRR
3. SFR
4. เอกสารรายเคส เรียงตามวันจบเคสหรือเลขเอกสาร
5. เอกสารประกอบอื่นที่ผู้ตรวจเลือก

ก่อนเปิดปุ่มพิมพ์ ระบบควรตรวจ:

- มี MRR และ SFR ครบหรือผู้ตรวจยอมรับ exception แล้ว
- ไม่มี attachment hash ซ้ำใน package
- เอกสารทุกฉบับอยู่ในช่วงเดียวกับ cycle หรือถูก override พร้อมเหตุผล
- จำนวนหน้าและลำดับแสดงให้ผู้ตรวจเห็น
- เก็บ manifest เพื่อพิสูจน์ภายหลังว่า package ที่พิมพ์ประกอบด้วยไฟล์ใดบ้าง

ปุ่มเป้าหมาย: `ปริ้นเอกสารรอบ {period/cycle} ส่งพี่เอ`

ClaspSCxSeamless มี print-agent, printer และ LINE/email notification flow อยู่แล้วตาม `docs/09-auto-print-agent-design.md` และ `print-agent/README.md` แต่ flow เดิมเน้นไฟล์ workbook จึงต้องเพิ่ม PDF pass-through และตรวจ data model ของ print job ก่อน reuse

## 12. Reliability, security และ audit requirements

- Idempotent ingest: ดึงอีเมลเดิมซ้ำได้โดยไม่สร้างเอกสารซ้ำ
- Dedup สองระดับ: Gmail message ID ต่อ mailbox และ file hash/document number ข้าม mailbox/forward
- Retry ได้ทุกขั้นโดยไม่ overwrite หลักฐานเดิม
- Unknown/conflicting data ต้องเข้า manual review ไม่ถูกทิ้ง
- ตรวจ MIME จริงและขนาดไฟล์ ห้ามเชื่อ extension อย่างเดียว
- เก็บ secrets ใน environment เท่านั้น
- จำกัด mailbox/R2/DB permission ตาม least privilege
- Audit ทุก action โดยเฉพาะ rename, relink cycle, approve, merge, print และ reprint
- การแจ้งเตือนล้มเหลวต้องไม่เปลี่ยนสถานะว่าพิมพ์สำเร็จ/ไม่สำเร็จอย่างผิดความจริง
- แยก `email received`, `document ingested`, `cycle complete`, `human approved`, `print requested`, `spool completed` และ `accounting acknowledged` เป็นคนละสถานะ

## 13. สิ่งที่ยังต้องยืนยันก่อน implement

1. ยืนยันว่ารายการ `CIV...` คือเอกสารรายเคสที่ต้องเข้าชุดบัญชีทุกฉบับหรือไม่ และหนึ่งเคสอาจมี CIV มากกว่าหนึ่งฉบับหรือมีฉบับแก้ไขได้หรือไม่
2. เปิดตรวจ PDF MRR/SFR เพื่อยืนยันความหมาย field และวิธี map รายการรายเคสเข้ารอบ
3. ระบุวิธีเข้าถึงใบเสร็จ/ใบกำกับภาษีที่มาเป็นลิงก์และไม่มี attachment รวมถึงอายุ link/authentication
4. ยืนยันว่ารอบที่ไม่พบอีเมลหมายถึงไม่มี transaction หรือเอกสารตกหล่น
5. ตัดสิน expected-arrival alert เช่น แจ้งเตือนถ้ายังไม่พบ H1 หลังวันที่ 24/25 หรือ H2 หลังวันที่ 9/10 โดยไม่ hard-code จนกว่าจะได้ SLA
6. ตัดสิน R2: bucket แยกหรือ bucket เดิมแต่ใช้ prefix แยก พร้อม retention/backup policy
7. กำหนดผู้มีสิทธิ approve package และกดพิมพ์
8. กำหนด recipient ของ email/LINE notification และข้อความที่ฝ่ายบัญชีต้องการ
9. Backfill เสร็จแล้ว 41 ฉบับหลังตัด duplicate; ห้ามส่ง backlog ชุดนี้ซ้ำอีก ขั้นต่อไปคือ ingest จาก mailbox admin โดยรองรับ `Fwd:`
10. ทดสอบด้วย synthetic fixture และสำเนาข้อมูลจริงใน dev โดยไม่สั่งพิมพ์/แจ้งเตือน production ก่อน

## 14. Implementation order ที่แนะนำ

1. ยืนยัน taxonomy และ inspect PDF ตัวอย่าง
2. เพิ่ม schema สำหรับ email/document/cycle/package และ automated tests
3. ทำ Gmail ingest แบบ read-only/dry-run แสดงผล classifier ก่อน
4. ทำ R2 storage + hash/idempotency โดยใช้ test prefix
5. ทำหน้า inbox/manual-review และ cycle completeness
6. ทำ PDF merge + manifest + preview
7. เพิ่ม human approval และ PDF print integration
8. ผูก LINE/email notification และ audit
9. Import historical forward 41 ฉบับที่มีอยู่ใน admin เฉพาะหลัง classifier รองรับ manual `Fwd:` และผ่าน dry-run โดยไม่ forward อีเมลซ้ำ
10. เปิด production trigger สำหรับอีเมลใหม่ แล้ว monitor missing/duplicate/error metrics

## 15. Production site และ HQ000 print integration context

ตรวจ production แบบ read-only เมื่อ 2026-08-01 ที่ `https://claspscxseamless.onrender.com` แล้วพบว่าแกน `Web -> print queue -> HQ000 -> printer` ใช้งานอยู่จริง ส่วนหน้า PharmCare ยังเป็น placeholder

### 15.1 สิ่งที่ production มีอยู่แล้ว

- หน้า `/history` แสดง processing history, สถานะพิมพ์, คิวพิมพ์, เวลาพิมพ์, LINE notification และ email notification รายไฟล์
- มีปุ่ม `สั่งปริ้น / ขอปริ้นใหม่` ซึ่งให้ผู้ใช้ confirm และใส่เหตุผลก่อนส่งคำขอ
- คอมเครื่องใดก็ได้ที่ login ผ่านเว็บสามารถเรียก `POST /api/app/processing-records/:id/request-print`
- Backend เปลี่ยน record เป็น `printed=false` และสร้าง `print_jobs` สถานะ `queued` ภายใน transaction เดียวกัน
- HQ000 ไม่ต้องรับ inbound connection จากคอมผู้ใช้ ตัว print-agent บน HQ000 เป็นฝ่าย poll `GET /api/agent/print-queue` ผ่าน HTTPS ด้วย internal bearer token
- Agent claim งานเพื่อกันหลาย instance พิมพ์ซ้ำ, ดาวน์โหลด generated file, ส่งงานเข้า Windows spooler และรายงานผลกลับ backend
- Backend เป็น source of truth ของ print status และส่ง LINE/email notification หลัง agent complete งาน
- หน้า `/pharmcare/upload` และ `/pharmcare/history` มี route/navigation แล้ว แต่ยังแสดงเพียงข้อความ “กำลังพัฒนา”

### 15.2 Flow การพิมพ์ปัจจุบัน

```text
Logged-in browser
  -> POST request-print
  -> processing_records + queued print_jobs
  -> HQ000 print-agent polls queue
  -> claim job / download generated .xlsx
  -> LibreOffice converts .xlsx to PDF
  -> SumatraPDF sends PDF to Brother printer
  -> Windows spooler job clears
  -> agent calls complete
  -> backend marks printed + sends LINE/email + updates History UI
```

สถานะ `completed` ในปัจจุบันหมายถึง spooler job ของงานนั้นหายจากคิวแล้ว ไม่ใช่หลักฐานทางกายภาพว่ากระดาษออกครบหรือผู้รับได้รับเอกสารแล้ว หากต้องการ end-to-end proof ต้องเพิ่ม `accounting acknowledged` เป็นอีกสถานะหนึ่ง

### 15.3 ข้อจำกัดที่ต้องแก้ก่อน PharmCare ใช้ flow เดิม

1. Print-agent hard-code ไฟล์ temp เป็น `.xlsx` และเรียก LibreOffice ทุกงาน เอกสาร PharmCare ที่เป็น PDF ต้องเพิ่ม MIME/extension branch:
   - `.xlsx` -> LibreOffice -> PDF -> SumatraPDF
   - `.pdf` -> ข้าม LibreOffice -> SumatraPDF โดยตรง
2. `processing_records.report_type` ปัจจุบันรับเฉพาะ `individual`/`summary` และ `generated_files.file_kind` ยังไม่มี PharmCare source/package PDF จึงห้ามปลอม PharmCare เป็น workbook เดิมเพื่อให้ผ่าน constraint
3. `print_jobs.processing_record_id` เป็น required foreign key ระบบต้องตัดสินว่าจะ generalize `processing_records` หรือเพิ่ม generic printable artifact/document package relation
4. Login ปัจจุบันเป็น shared session และไม่ได้บันทึก user identity รายบุคคล; UI ส่ง `requestedBy` ว่างโดย default จึงยัง audit ไม่ได้ว่าใคร/คอมใดเป็นผู้กด
5. จากหน้า production พบ LINE สำเร็จในหลายรายการ แต่ email notification แสดง `Unauthorized` หรือ configuration missing จึงต้องแก้ email provider/config ก่อนพึ่งพาการแจ้งเตือนช่องทางนี้
6. การกัน double-print มีทั้ง transaction/advisory lock ฝั่ง backend และ local agent lock แล้ว ต้อง preserve behavior นี้เมื่อเพิ่ม PharmCare package

### 15.4 จุดเชื่อม Gmail กับเว็บที่ตกลงเป็นแนวทาง

ไฟล์จาก Gmail ไม่ควรถูกดึงโดยหน้า browser เพราะจะทำงานเฉพาะตอนมีคนเปิดหน้าเว็บและทำให้ credential กระจายไป client ควรมี backend worker เป็นผู้ monitor `admin@scgroup1989.com`

```text
admin@scgroup1989.com
  -> backend Gmail ingestion worker
  -> parse original sender / Fwd / subject / attachment
  -> checksum + deduplicate
  -> R2 original document
  -> PostgreSQL email/document/cycle metadata
  -> PharmCare Inbox/Review UI
  -> human approves cycle and file order
  -> backend merges immutable PDF package
  -> R2 final package
  -> request-print
  -> HQ000 direct-PDF printing
  -> LINE/email/audit
```

หน้าเว็บเป็น operator console ที่อ่านสถานะจาก PostgreSQL และขอ action ผ่าน API ไม่ใช่ที่เก็บ binary หลัก ไฟล์ binary ควรอยู่ R2 และ DB เก็บ object key, original filename, MIME type, size, SHA-256, Gmail message ID, document number และ relationships

### 15.5 แนวทางจัดพื้นที่ R2

ถ้ายังไม่สร้าง bucket แยก สามารถใช้ bucket เดิมและ namespace/prefix แยกก่อน โดยต้องตัดสิน retention/access/backup ก่อน production backfill

```text
clasp-scx-seamless/pharmcare-source/...
clasp-scx-seamless/pharmcare-package/...
```

- `pharmcare-source`: ไฟล์ต้นฉบับ immutable จาก Gmail/manual upload
- `pharmcare-package`: merged PDF ที่ผ่าน human approval พร้อม manifest
- ดาวน์โหลดผ่าน authenticated backend proxy เช่นเดียวกับ generated files ปัจจุบัน ไม่เปิด R2 object เป็น public URL
- ถ้าภายหลังต้องแยก bucket ให้คง DB/storage abstraction เดิมเพื่อไม่ให้ frontend หรือ print-agent ต้องรู้ตำแหน่งจริง

### 15.6 หน้า PharmCare ที่ควรพัฒนาจาก placeholder

`/pharmcare/upload` ควรเปลี่ยนเป็น PharmCare Inbox โดยมี manual PDF upload เป็น fallback ไม่ใช่ ingestion หลัก:

- New/unclassified
- Classified financial documents
- Duplicates/superseded
- Missing attachment/link retrieval pending
- Errors/manual review

`/pharmcare/history` ควรแสดง:

- รอบ H1/H2 และช่วงวันที่จริง
- ความครบถ้วน MRR/SFR/เอกสารรายเคส
- expected-arrival/missing-cycle warning
- human approval และ package manifest
- final merged PDF preview/download
- print request/queue/spool/notification/reprint history

### 15.7 จุดตัดเชื่อมกับระบบเดิม

ขอบเขตที่ควร reuse:

- app/session authentication
- authenticated file download proxy
- R2 storage service และ SHA-256 utility
- print job status machine, queue claiming และ double-print protection
- HQ000 poll model, SumatraPDF printing และ spooler tracking
- LINE/email status columns และ History UI patterns

ขอบเขตที่ควรสร้างแยกหรือ generalize อย่างชัดเจน:

- Gmail ingestion state
- PharmCare document taxonomy
- settlement cycle และ missing-cycle logic
- source PDF/link retrieval
- PDF package/manifest/human approval
- PDF-direct branch ใน print-agent
- actor identity/role ถ้าต้องการ audit รายบุคคล
