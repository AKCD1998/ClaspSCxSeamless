# 20 Frontend Work Review Ledger

วันที่สร้าง: 2026-08-19
สถานะ: กำลังทำ (living doc — เพิ่มแถวทุกครั้งที่มีงาน frontend ใหม่)

## จุดประสงค์

ไฟล์นี้บันทึกงาน frontend ทุกชิ้นที่ GLM 5.2 (Junior Implementer) ทำใน repo นี้
เพื่อให้ **Claude Sonnet 5 (Senior Dev/Reviewer)** ตรวจสอบย้อนหลังได้ว่า: โค้ดถูกไหม,
มีปัญหา/พังอะไรระหว่างทำไหม, ตรง spec ไหม — ตาม pattern เดียวกับ
`docs/11-print-agent-review-ledger.md` (แต่ของ docs/11 คืองาน print-agent,
ไฟล์นี้คืองาน frontend `client/` โดยเฉพาะ)

ไม่ใช่ที่แทน `docs/18` (นั่นคือ coordination ระหว่าง workstream) — ไฟล์นี้คือ
work log + review ระดับ "task ละแถว"

## กติกาสำหรับผู้ implement (GLM 5.2)

1. **ก่อนเริ่ม task ใดๆ** — เช็ค `docs/18` ก่อนว่าไฟล์ที่จะแตะมี workstream อื่นถืออยู่หรือเปล่า
2. **ทุก task เขียนแถวในตารางด้านล่าง**: ก่อนเริ่ม (สถานะ "กำลังทำ") และหลังเสร็จ (สรุปสั้น +
   ผล test/build)
3. **ห้าม commit/push/deploy เอง** — ตาม protocol เดียวกับ docs/16: รอเจ้าของ repo สั่งก่อน
   (deploy เกิดอัตโนมัติเมื่อ push เข้า `main` จึงยิ่งห้าม push เอง)
4. **แก้ backend ไม่ได้ใน repo นี้** — backend จริงอยู่ที่
   `currentSC-official-website-project/backend/src/modules/seamless/` (ดู docs/19) —
   ถ้า task ต้องแก้ backend ให้แจ้งเจ้าของ repo แยก อย่าแก้เอง
5. รัน test (`client` ผ่าน `npm test` ที่ root หรือตาม README) + `npm run build` ใน `client/`
   ให้ผ่านก่อน mark เสร็จ — จดผลจริงไว้ในแถว

## วิธีรีวิว (สำหรับ Claude Sonnet 5)

1. อ่านแถวของ task ในตารางด้านล่าง → เปิดไฟล์จริงที่ระบุ อ่านโค้ดเต็มๆ
2. เทียบกับ acceptance criteria ที่จดไว้ + spec ที่อ้างอิง (docs/13/14 สำหรับ PharmCare,
   docs/19 สำหรับภาพรวม frontend)
3. รัน test/build เองซ้ำ — อย่าเชื่อแค่ตัวเลขที่ผู้ implement จด:
   - เฉพาะงาน frontend นี้: `npm --prefix client test` (ควรได้ 31/31) และ
     `npm --prefix client run build`
   - อย่าใช้ `npm test` ที่ root โดยไม่รู้: มันรัน server tests ด้วย ซึ่ง `server/` มีงาน
     Shopee ที่ยัง dirty ไม่ได้ commit (ดู docs/18) — failure จากตรงนั้นไม่ใช่ของงานนี้
4. เติมคอลัมน์ `ผู้รีวิว` / `วันที่รีวิว` / `ผลตัดสิน` (`ผ่าน` / `ผ่านมีข้อสังเกต` / `ไม่ผ่าน`) /
   `หมายเหตุ` — ถ้าไม่ผ่านระบุเหตุผล + แนวแก้ อย่าแก้โค้ดเองโดยไม่จดไว้ตรงนี้ก่อน
5. ห้าม mark "ผ่าน" ถ้ายังไม่ได้รันเทสจริงด้วยตัวเอง

## ตารางงาน + รีวิว

| # | Task | ไฟล์หลักที่แตะ | สรุปโดยผู้ implement | สถานะ | ผู้รีวิว | วันที่รีวิว | ผลตัดสิน | หมายเหตุ |
|---|---|---|---|---|---|---|---|---|
| 0 | เตรียม context + เสนอแผนปรับปรุงหน้า PharmCare Inbox | (ยังไม่แตะโค้ด — อ่าน docs/18, 19, โค้ด client ปัจจุบัน, backend inbox controller) | สำรวจพบ: (1) backend รองรับ cursor pagination แต่ frontend ไม่ได้ใช้ — ผู้ใช้เห็นแค่ 50 แถวแรก (2) `getPharmcareMessage()` มีใน api.js แต่ไม่มี UI เรียกเลย — เห็น reasonCodes ของ manual_review ไม่ได้ (3) Gmail real-time sync live แล้วแต่หน้าไม่มีปุ่มรีเฟรช/auto-refetch (4) ไม่มี filter ช่วงวันที่ (ต้องแก้ backend ด้วย) — เจ้าของ repo เลือก: ทำข้อ 1+2 (จดเป็น task 1, 2) ส่วนข้อ 3 ไว้ก่อน ข้อ 4 รอประสาน backend | เสร็จ (เฉพาะการสำรวจ) | | | | |
| 1 | Inbox pagination "โหลดเพิ่ม" ด้วย nextCursor ที่ backend มีอยู่แล้ว | `client/src/components/PharmCareInboxPanel.jsx`, `client/src/components/PharmCareInboxView.jsx`, `client/tests/pharmcare-inbox-view.test.mjs` (ไม่ต้องแก้ api.js — cursor ไหลผ่าน filters object เดิมได้เลย) | เพิ่ม state `nextCursor`/`isLoadingMore` ใน Panel: `loadMoreInbox()` ยิง `{...filters, cursor: nextCursor}` แล้ว **append** รายการใหม่ต่อท้าย (dedupe ด้วย id เผื่อข้อมูลเปลี่ยนระหว่างกด) ไม่ replace; เปลี่ยน filter แล้ว `loadInbox` ทำงานใหม่ทั้ง list และ reset cursor; ปุ่ม "โหลดเพิ่ม" อยู่ footer ใน `.history-table-wrap` ใช้ class เดิม (`history-dashboard-pagination`, `history-view-button secondary`) ซ่อนเมื่อ nextCursor หมด / disable ระหว่างโหลด; ข้อความสถานะเปลี่ยนเป็น "แสดง N รายการ" (สะสม) | **เสร็จ** — test 31/31 ผ่าน, `vite build` ผ่าน (1.38s) | Claude Sonnet 5 | 2026-08-19 | **ผ่าน** | อ่าน `PharmCareInboxPanel.jsx`/`View.jsx` เต็มไฟล์ ตรวจ logic เอง (ไม่ได้เชื่อแค่สรุป): `loadMoreInbox` dedupe ด้วย `Set` ของ id ก่อน append ถูกต้อง, `useEffect([filters])` เรียก `loadInbox` ใหม่ซึ่ง `setNextCursor` ทับด้วยค่าจาก page 1 เสมอ = reset cursor ตามที่อ้างจริง, ปุ่ม "โหลดเพิ่ม" ใช้ `{nextCursor ? (...) : null}` ซ่อนถูกต้องเมื่อไม่มีหน้าเพิ่ม และ `disabled={isLoadingMore}` ระหว่างโหลด — ตรงกับ test "pagination: the load-more button only renders while a nextCursor exists" และ "...is disabled while loading more" ที่รันจริงผ่าน. รัน `npm --prefix client test` เอง (31/31) และ `npm --prefix client run build` เอง (สำเร็จ 973ms) ยืนยันตรงกับที่ผู้ implement จด ไม่มี regression |
| 2 | ดูรายละเอียดฉบับ + reasonCodes ผ่าน `getPharmcareMessage()` | `client/src/components/PharmCareMessageDetail.jsx` (ใหม่), `client/src/components/pharmcareLabels.js` (ใหม่ — label map รวมของ View/Detail), `client/src/components/PharmCareInboxView.jsx`, `client/src/components/PharmCareInboxPanel.jsx`, `client/src/styles/app.css`, `client/tests/pharmcare-inbox-view.test.mjs` | คอลัมน์ใหม่ "รายละเอียด" (ปุ่ม ดู/ปิด + aria-expanded) ต่อแถว; กดแล้ว expand เป็นแถวลูก `colSpan=10`: แสดง reasonCodes ของแถวนั้น **ทันทีจากข้อมูลใน inbox row เอง** (backend ใส่มาใน listInboxDocuments แล้ว) ระหว่างรอ fetch; fetch `getPharmcareMessage(messageId)` (ใช้ `messageId` ของแถว ไม่ใช่ document id — settlement 1 อีเมลที่แตกเป็น MRR+SFR จะเห็นเอกสารพี่น้องเดียวกันเมื่อกดจากแถวไหนก็ได้); cache ต่อ messageId (เปิดซ้ำไม่ยิงซ้ำ) + guard stale response ด้วย ref; แสดง: อีเมลต้นทางจริง (originalFrom/originalDate/rawSubject/ingestedAt/errorCode/Message), เอกสารทั้งหมดในอีเมล (type เลขที่ สถานะ รอบ reasonCodes), ไฟล์แนบทั้งหมด (ลิงก์ดาวน์โหลด + ขนาด); แปล reason code เป็นไทยทั้งชุดที่ classifier ใช้จริง (เก็บจาก backend 2026-08-19) โดย code ไม่รู้จัก fallback เป็น raw string | **เสร็จ** — test 31/31 ผ่าน (เพิ่ม 8 เคส), `vite build` ผ่าน | Claude Sonnet 5 | 2026-08-19 | **ผ่านมีข้อสังเกต** | ตรวจละเอียดครบ: (1) เทียบ `REASON_CODE_LABELS` ใน `pharmcareLabels.js` กับโค้ดจริงฝั่ง backend (`grep` ตรงๆ ใน `currentSC-official-website-project/backend/src/modules/seamless/services/pharmcare*`) — **ตรงครบทั้ง 17 โค้ดคงที่ + pattern `report_prefix_*` แบบ dynamic ไม่มีตกหล่น/ไม่มีของปลอม** (2) เทียบ field ที่ `PharmCareMessageDetail.jsx` อ่าน (`originalFrom`/`originalDate`/`rawSubject`/`ingestedAt`/`errorCode`/`errorMessage`/`document.duplicateOfDocumentId`/`attachment.fileSizeBytes` ฯลฯ) กับ shape จริงที่ `pharmcareController.getMessageDetail` ส่งกลับ (`mapMessage`/`mapDocument`/sanitized attachment) — ตรงทุก field ไม่มีพิมพ์ผิดชื่อ (3) ไล่ race-condition ใน `PharmCareInboxPanel.jsx` เอง (ไม่เชื่อแค่คอมเมนต์): stale-response guard ด้วย `selectedMessageIdRef`, toggle-close ระหว่างกำลังโหลด, cache ต่อ messageId — ทุกเคส trace ผ่านแล้วถูกต้องจริง. **ข้อสังเกต (ไม่ block)**: `<tr className="pharmcare-detail-row-tr">` ใน `PharmCareInboxView.jsx` อ้างถึง class ที่**ไม่มีนิยามใน `app.css` เลย** — ไม่ error ไม่กระทบข้อมูล แค่แถว detail ไม่ได้ styling พิเศษที่ตั้งใจไว้ (ถ้าตั้งใจให้มี background/border แยกจากแถวปกติ ยังไม่เกิดขึ้นจริง) แก้ทีหลังได้ไม่เร่งด่วน. รัน `npm --prefix client test` เอง (31/31 รวม 5 เคสของ detail) และ `npm --prefix client run build` เอง (สำเร็จ) ยืนยันตรงกับที่จด — ไฟล์ dirty ทั้งหมดตรงกับ 7 ไฟล์ที่ระบุเป๊ะ ไม่มีไฟล์ Shopee ปนมา (เช็คด้วย `git status` เอง), HEAD ยังอยู่ที่ `5dde3c4` ตรงตามที่แจ้ง |
| 3 | แก้คอลัมน์สถานะทับปุ่ม "ดู" (bug จาก task 2 ที่เจ้าของ repo เจอหลัง deploy) | `client/src/components/PharmCareInboxView.jsx`, `client/src/styles/app.css`, `client/tests/pharmcare-inbox-view.test.mjs` | สาเหตุ: `.history-table` เป็น `table-layout: fixed` (width อิงแถว header) แต่ตาราง PharmCare ไม่มี `<colgroup>` กำหนด width เลย (ของเดิม 9 คอลัมน์ ป้ายสถานะ nowrap ล้นออกนอกขอบขวาไม่เห็น — พอ task 2 เพิ่มคอลัมน์ที่ 10 ความล้นไปทับปุ่ม "ดู" กลายเป็นชนกัน) แก้โดยเพิ่ม `<colgroup>` 10 `<col>` ตาม pattern HistoryTable (`history-col-*`): received 9 / subject 13 / from 10 / route 6 / type 12 / number 9 / attachment 11 / period 9 / **status 14** (กว้างพอสำหรับป้ายยาวสุด "จัดประเภทอัตโนมัติแล้ว" แบบ nowrap: 14% ของ min-width 1420px ≈ 199px หัก padding แล้วเหลือ ~151px > ความกว้างตัวอักษร ~130px) / detail 7 — รวม 100%; ถือโอกาสเพิ่ม rule `.pharmcare-detail-row-tr > td { padding: 0; }` ตามข้อสังเกตค้างของ review task 2 (ไม่ให้ padding ซ้อนกับของ `.pharmcare-detail` เอง); เพิ่ม test ยืนยัน colgroup ครบ 10 คอลัมน์ตามลำดับ | **เสร็จ** — test 32/32 ผ่าน, `vite build` ผ่าน (1.23s) | Claude Sonnet 5 | 2026-08-19 | **ผ่าน** | อ่าน `PharmCareInboxView.jsx` เต็มไฟล์ยืนยัน `<colgroup>` มี 10 `<col>` ตรงลำดับ header ทั้ง 10 คอลัมน์เป๊ะ, เช็คผลรวม % เอง (9+13+10+6+12+9+11+9+14+7 = 100 ✓ ไม่เกิน/ขาด) เทียบกับ `app.css` (`.pharmcare-col-*`) ตรงกับที่ implement บอกทุกค่า. ยืนยันด้วยว่า `.pharmcare-detail-row-tr > td { padding: 0; }` ถูกเพิ่มจริงตามข้อสังเกตค้างจาก task 2 (ปิดข้อสังเกตนั้นได้). รัน `npm --prefix client test` เอง (**39/39** ผ่าน — รวม test ของ task 4 ที่มากับ diff เดียวกัน ดูรายละเอียดที่แถว 4) และ `npm --prefix client run build` เอง (สำเร็จ 4.25s) ยืนยันตรงกับที่จด. ข้อจำกัดที่ยังจริงอยู่: ความกว้างเป็น CSS math ไม่ใช่ screenshot จาก browser จริง — แนะนำเจ้าของ repo ยืนยัน visual มือหลัง deploy อีกที |
| 4 | พรีวิวเอกสารในหน้าเว็บ (คลิกไฟล์แนบ → overlay พรีวิว พิมพ์/ดาวน์โหลดได้ ไม่ต้องโหลดลงเครื่องก่อน) | `client/src/services/api.js`, `client/src/components/PharmCareAttachmentPreview.jsx` (ใหม่), `client/src/components/PharmCareInboxView.jsx`, `client/src/components/PharmCareMessageDetail.jsx`, `client/src/components/PharmCareInboxPanel.jsx`, `client/src/styles/app.css`, `client/tests/pharmcare-inbox-view.test.mjs`, `client/tests/api-service.test.mjs` | ทำตามแนวทาง frontend-only: `fetchPharmcareAttachmentBlob()` ใหม่ใน api.js ดึงไฟล์ผ่าน endpoint เดิม (`credentials: 'include'`, error เกิดข้อความจาก backend เหมือน pattern `requestJson`) → Panel สร้าง object URL (revoke ทุกครั้งที่ปิด/เปลี่ยน/unmount + stale guard ด้วย `previewTargetRef`) → `PharmCareAttachmentPreview` (pure + iframe ref) แสดงใน `<iframe>` ผ่าน PDF viewer ในตัวของ browser; ถ้า blob เป็น `application/octet-stream` แต่ไฟล์จบ `.pdf` จะ re-wrap เป็น `application/pdf` (pattern จริงที่เจอจาก Gmail ตาม bug M2 ใน docs/18); ปุ่ม **พิมพ์** = `iframe.contentWindow.print()`, **ดาวน์โหลด** = `<a>` ชี้ URL เดิม (`a.history-view-button` เสริม CSS เพราะ style ปุ่มผูกกับ element `button` ตรงๆ), **ปิด** = ปุ่ม/คลิก backdrop/Escape (dialog focus ตัวเองตอนเปิดเพื่อให้ Escape ทำงานจริง); ไฟล์ไม่ใช่ PDF → fallback ข้อความ + ปุ่มดาวน์โหลด; **พฤติกรรมเปลี่ยน (ตาม request): ชื่อไฟล์แนบในตาราง+detail เดิมเป็นลิงก์ดาวน์โหลดตรง กดที่ชื่อไฟล์เปิดพรีวิวแทน — ดาวน์โหลดย้ายไปปุ่มในหน้าพรีวิว** | **เสร็จ** — test 39/39 ผ่าน (เพิ่ม 5 เคส UI + 2 เคส api), `vite build` ผ่าน (1.27s) | Claude Sonnet 5 | 2026-08-19 | **ผ่าน** | อ่านทุกไฟล์ที่แตะเต็มไฟล์: `api.js` (`fetchPharmcareAttachmentBlob` reuse endpoint เดิม, error-message pattern ตรงกับ `requestJson` ที่มีอยู่แล้ว, `credentials:'include'` ครบ), `PharmCareAttachmentPreview.jsx` (ใหม่ทั้งไฟล์), `PharmCareInboxPanel.jsx`, `PharmCareInboxView.jsx`, `PharmCareMessageDetail.jsx`, `app.css`. ประเด็นที่ไล่ตรวจเอง (ไม่เชื่อแค่สรุป): (1) stale-guard ของ preview — `previewTargetRef` เช็คทั้งใน success และ error branch ของ `loadAttachmentPreview` ถูกต้อง แก้ race ได้จริงถ้าผู้ใช้กดเปลี่ยนไฟล์ก่อน fetch เดิมเสร็จ (2) object URL — `releasePreviewUrl()` ถูกเรียกทั้งตอนเปิดไฟล์ใหม่ (กัน leak ระหว่างสลับ), ตอนปิด, และตอน unmount (`useEffect(() => releasePreviewUrl, [])`) ครบทุกจุดออก ไม่มี URL หลุดไม่ revoke (3) MIME re-wrap: `looksLikePdf` เช็คทั้ง `blob.type === 'application/pdf'` และนามสกุลไฟล์ `.pdf` แล้ว re-wrap เป็น `new Blob([blob], {type:'application/pdf'})` เฉพาะกรณี type ไม่ตรง — ตรงกับ bug MIME ที่เจอจริงจาก M2 (`declared_mime_type_mismatch`, docs/18) (4) Escape-to-close: `overlayRef` focus ตัวเองใน `useEffect([attachment?.id])` + `tabIndex={-1}` + `onKeyDown` ที่ dialog level ถูกต้องตาม pattern มาตรฐานสำหรับ dialog ที่ต้องการรับ keyboard event (5) เทียบ field `attachmentId`/`attachmentFilename` ที่ `PharmCareInboxView.jsx` อ่านจาก row กับ backend จริง — `grep` ยืนยันใน `pharmcareRepository.js` (บรรทัด 69, 415) ว่าเป็น field จริงที่ backend ส่งมาจาก `listInboxDocuments` ไม่ใช่ field สมมติ (6) พฤติกรรมเปลี่ยน (download → preview เมื่อคลิกชื่อไฟล์) เป็นไปตามที่ request จริง ปุ่มดาวน์โหลดยังอยู่ในหน้าพรีวิว ไม่ได้หายไปไหน. รัน `npm --prefix client test` เอง (39/39 ทั้งไฟล์รวม task 3+4) และ `npm --prefix client run build` เอง (สำเร็จ 4.25s) ยืนยันตรงกับที่จด ไม่มี regression. ข้อจำกัดที่ยังจริงอยู่ (ไม่ block เพราะเป็นข้อจำกัดของสภาพแวดล้อม SSR test ไม่ใช่บั๊กที่เจอ): blob fetch + MIME re-wrap + `iframe.contentWindow.print()` รันจริงได้เฉพาะใน browser จริง — แนะนำเจ้าของ repo ทดสอบมือหลัง deploy 3 อย่าง: (ก) PDF ที่ Gmail แปะ `application/pdf` ตรงๆ (ข) PDF ที่ Gmail แปะ `application/octet-stream` (เคส M2 bug) (ค) กดปุ่มพิมพ์จริงจาก iframe |

## บันทึกการตัดสินใจ / เหตุการณ์สำคัญ

- **2026-08-19** — สร้างไฟล์นี้ตามคำขอของเจ้าของ repo: งาน frontend ทุกชิ้นต้องจดที่นี่เพื่อให้
  Claude Sonnet 5 ตรวจ ตรวจแล้วต้องเติมผลในตาราง
- **2026-08-19** — Task 1 + 2 เสร็จ (ไม่ได้ commit — ตามกติกา รอเจ้าของ repo สั่ง) ข้อจำกัดที่ reviewer
  ควรรู้ก่อน mark ผ่าน: (1) logic ใน Panel (append/dedupe/reset-on-filter, cache+stale-guard ของ
  detail) ยังไม่มี automated test โดยตรง เพราะชุด test ของ repo นี้เป็น renderToString (SSR) ไม่มี
  DOM ให้รัน React effects — ทดแทนด้วย test การ render ของ View ทุก state + ต้องอาศัย code review
  ของ Panel.jsx โดยตรง (2) ยังไม่ได้ทดสอบกับข้อมูล production จริงเพราะ `/api/app/pharmcare/*`
  ต้องมี credential — หลัง deploy ให้เจ้าของเปิดหน้า `/pharmcare/upload` ทดสอบ visual เอง
- **2026-08-19** — ยืนยันกับ git status จริง: ไฟล์ dirty ทั้งหมดใน repo เป็นของ workstream
  Shopee (`server/`, `print-agent/`, `docs/07`) — **ไม่มีไฟล์ `client/` ตัวไหน dirty** เริ่มงาน
  frontend PharmCare ได้โดยไม่ชน
- **2026-08-19** — Task 1 + 2 ผ่านรีวิว (Claude Sonnet 5, ดูรายละเอียดในตารางด้านบน) — **เจ้าของ
  repo สั่งให้ Sonnet 5 commit เอง** (นอกเหนือ protocol ปกติที่ให้เจ้าของ repo commit) commit
  แล้วที่ `dfba43b` (`main`) — stage เฉพาะ 7 ไฟล์ของงานนี้ ไม่แตะไฟล์ Shopee ที่ยัง dirty เลย —
  push แล้ว Render จะ auto-deploy frontend ให้เอง **GLM 5.2 อ่านต่อจากตรงนี้ได้เลยสำหรับ task ถัดไป**
  — ข้อสังเกตเดียวที่ค้างจาก review (ไม่ block): `.pharmcare-detail-row-tr` ไม่มี CSS rule นิยามไว้
  ใน `app.css` ถ้ามี task ถัดไปแตะ styling ของ detail row อยู่แล้ว เพิ่มให้ด้วยได้
- **2026-08-19** — Task 3 + 4 ผ่านรีวิว (Claude Sonnet 5, ดูรายละเอียดในตารางด้านบน) — ตรวจ
  colgroup ครบ 10 คอลัมน์ + ผลรวม 100%, cross-check `attachmentId`/`attachmentFilename` กับ
  backend จริง (`pharmcareRepository.js`), ไล่ race-condition/object-URL-leak ของ preview เอง
  ทุกจุด ไม่พบปัญหา block. รัน `npm --prefix client test` เอง (39/39) และ
  `npm --prefix client run build` เอง (สำเร็จ) ยืนยันตรงกับที่ implementer จด — **Sonnet 5
  commit เอง** ตามที่เจ้าของ repo สั่งไว้ (นอกเหนือ protocol ปกติ) stage เฉพาะไฟล์ของงานนี้
  (7 ไฟล์เดิม + `PharmCareAttachmentPreview.jsx` ใหม่ + ledger นี้) ไม่แตะไฟล์ Shopee
  (`server/`, `print-agent/`, `docs/07`) ที่ยัง dirty เลย — push แล้ว Render จะ auto-deploy
  ให้เอง **GLM 5.2 อ่านต่อจากตรงนี้ได้เลยสำหรับ task ถัดไป**. ข้อจำกัดที่ต้องทดสอบมือหลัง
  deploy: ความกว้างคอลัมน์ visual จริง (task 3), และ blob preview + MIME re-wrap + print จาก
  iframe จริงในเบราว์เซอร์ (task 4) — ทั้งสองอย่าง SSR test ยืนยันได้แค่ logic/structure
