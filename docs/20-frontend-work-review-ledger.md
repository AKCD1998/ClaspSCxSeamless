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

| 5 | ซ่อนส่วน "เหตุผลการจัดประเภท (เอกสารนี้)" + รุ่นตัวจัดประเภท ออกจาก detail view (ตาม request เจ้าของ repo) | `client/src/components/PharmCareMessageDetail.jsx`, `client/tests/pharmcare-inbox-view.test.mjs` | ซ่อนด้วย flag `SHOW_CLASSIFICATION_EVIDENCE = false` ที่ module level (ไม่ลบโค้ด — สลับกลับเปิดได้ที่เดียวถ้าวันหนึ่งต้องการ debug); **ซ่อนเฉพาะ section บนสุดของกล่อง detail** (reasonCodes ระดับแถว + classifierVersion) — แถว "เหตุผล" ในลิสต์ "เอกสารทั้งหมดในอีเมลนี้" **ยังแสดงอยู่** (เจ้าของระบุเฉพาะ section ที่ paste มา ถ้าจะซ่อนด้วยแจ้งเพิ่ม); แก้ test เดิมจาก assert "โชว์ reasonCodes ทันที" เป็น assert "ซ่อน section + ซ่อน classifierVersion + ไม่มี pill ของ row-level reasons ในหน้า loading" | **เสร็จ** — test 39/39 ผ่าน, `vite build` ผ่าน (1.95s) | Claude Sonnet 5 | 2026-08-19 | **ผ่าน** | อ่าน `PharmCareMessageDetail.jsx` เต็มไฟล์: `SHOW_CLASSIFICATION_EVIDENCE = false` เป็น module-level const ครอบ section ด้วย `{SHOW_CLASSIFICATION_EVIDENCE ? (...) : null}` ถูกต้อง — โค้ดเดิมไม่ได้ถูกลบ แค่ไม่ render, สลับกลับ `true` ตัวเดียวคืนสภาพเดิมได้จริงตามที่อ้าง. เทียบ test เดิม/ใหม่: เคส "detail: the expanded row hides the row-level classification evidence section by default" assert `doesNotMatch` ทั้ง "เหตุผลการจัดประเภท (เอกสารนี้)" และ "รุ่นตัวจัดประเภท" ถูกต้องตรงกับที่ซ่อน, และยืนยันด้วยตาว่าแถว "เหตุผล" ระดับเอกสารในลิสต์ "เอกสารทั้งหมดในอีเมลนี้" (เอกสารพี่น้อง MRR/SFR) ไม่ถูกแตะ — ยังเห็นอยู่ตามที่ implementer แจ้งไว้ตรงๆ ไม่ใช่ scope creep. รัน `npm --prefix client test` เอง (39/39) และ `npm --prefix client run build` เอง (สำเร็จ 1.97s) ยืนยันตรงกับที่จด ไม่มี regression. **หมายเหตุสำคัญจากเจ้าของ repo หลัง task นี้เสร็จ**: การซ่อนแบบ flag คุมทุกคนเท่ากันนี้เป็นทางแก้ชั่วคราว — เจ้าของต้องการยกระดับเป็นระบบสิทธิ์จริง (user ทั่วไปไม่เห็น diagnostic เลย, admin เห็นได้ทั้งหมด + จัดการ/กรุ๊ปอีเมลในเว็บได้ ไม่กระทบ Gmail ภายนอก) — นี่คืองานสถาปัตยกรรม auth ใหม่ทั้งระบบ (ปัจจุบันมี Basic Auth ชุดเดียวใช้ร่วมกันทั้งแอป ไม่มีแนวคิด role เลย) จะจดเป็น task 6 แยกต่างหากหลังคุยขอบเขตกับเจ้าของ repo ก่อนเริ่ม ไม่รวมอยู่ใน task 5 นี้ |

| 7 | ปุ่มสลับ dark/light theme ที่ navbar + dark mode แบบ surface inversion (ตาม request เจ้าของ repo 19 ส.ค. เย็น) | `client/src/App.jsx`, `client/src/components/TopNavBar.jsx`, `client/src/styles/app.css`, `client/tests/top-navbar.test.mjs` (ใหม่) | แนวทาง: `data-color-mode="light|dark"` บน wrapper เดียวกับ `data-theme` ใน `AuthenticatedApp`, state + persist ใน localStorage key `colorMode` (try/catch กัน SSR/privacy mode → default light); ปุ่ม toggle วางใน `top-navbar-actions` ก่อนปุ่มออกจากระบบ (props optional — ไม่ส่ง `onToggleColorMode` มาก็ไม่โชว์ ตาม pattern `onLogout`) label "🌙 โหมดมืด"/"☀️ โหมดสว่าง" (บอกโหมดที่จะสลับไป) + aria-label ตาม; **CSS additive-only** — block `[data-color-mode="dark"]` ใหม่ท้ายไฟล์ ไม่แตะ rule เดิมเลย: flip `--ink`/`--muted`→ขาว/เทาอ่อน, `--panel`→เทาเข้ม, surface ขาว literal ทั้งหมดที่ grep เจอ (input/select, history-table-wrap, history-group, history-dashboard-wrap, print-queue-summary, pharmcare-preview #fff, เส้นแบ่งตาราง, tint ปุ่ม secondary/pill, history-empty, group-header, pharmcare-detail) และ dim พื้นหลังเคลื่อนไหวด้วย `filter: brightness(0.34) saturate(1.05)`; **accent ตาม request**: hue เดิมทั้งหมด ปรับเฉพาะ `--accent-strong`/`--success`/`--warning`/`--error` อ่อนขึ้นเล็กน้อยเพื่อ contrast (`--accent` ปุ่ม gradient คงเดิม) แยก per-theme (default เขียวอ่อนขึ้น/shopee ส้มอ่อนขึ้น+panelน้ำตาลเข้ม/pharmcare ฟ้าอ่อนขึ้น+panelเขียวเข้ม) — **(จด task 7 เพราะเลข 6 ถูกจองไว้สำหรับงานระบบสิทธิ์ตามหมายเหตุท้าย task 5)** | **เสร็จ** — test 46/46 ผ่าน (เพิ่ม 3 เคส top-navbar), `vite build` ผ่าน (1.29s) | Claude Sonnet 5 | 2026-08-19 | **ผ่าน** | อ่าน `App.jsx`/`TopNavBar.jsx`/CSS block เต็มทุกไฟล์: localStorage อ่าน/เขียนมี try/catch กัน SSR/privacy mode ถูกต้อง default 'light' จริง, ปุ่ม toggle เป็น optional prop (ไม่ส่ง `onToggleColorMode` ไม่โชว์) ตรงกับ pattern `onLogout` ที่มีอยู่แล้ว. ยืนยัน **additive-only จริง** — grep `[data-color-mode="dark"]` เจอ block เดียวท้ายไฟล์ ไม่มี rule เดิมถูกแก้เลยแม้บรรทัดเดียว เพราะใช้กลไก CSS custom properties (`--panel`/`--ink` ฯลฯ) ที่ rule เดิมอ้างอิงอยู่แล้ว การ override ค่าตัวแปรจึงพอโดยไม่ต้องแตะ selector เดิม — เข้าใจถูกต้องตามที่ implementer อธิบาย. รัน `npm --prefix client test` เอง (50/50 รวมกับ task 8 — ตัวเลข 46 ที่จดไว้เป็นค่าระหว่างทำก่อน task 8 เสร็จ ไม่ใช่ตัวเลขสุดท้าย ไม่ block) และ `npm --prefix client run build` เอง (สำเร็จ) ยืนยันไม่มี regression. ข้อจำกัดที่ยังจริงอยู่ (ไม่ block): สี dark mode ยังไม่เคยเห็นบน browser จริง ต้องให้เจ้าของ repo ยืนยัน visual หลัง deploy ทั้ง 3 theme ตามที่ implementer แจ้งไว้ |

| 8 | Sort asc/desc + date range filter ที่คอลัมน์ "ได้รับเมื่อ" — **งาน cross-repo แตะ backend จริงด้วย** (เจ้าของ repo อนุมัติ 2026-08-19 หลังถามชัดเจน เพราะ frontend-only จะ sort/กรองได้เฉพาะข้อมูลที่โหลดมาแล้ว = ผิดเงียบๆ กับ cursor pagination) | **frontend**: `client/src/components/PharmCareInboxPanel.jsx`, `client/src/components/PharmCareInboxView.jsx`, `client/src/styles/app.css`, `client/tests/pharmcare-inbox-view.test.mjs`, `client/tests/api-service.test.mjs` — **backend**: `currentSC-official-website-project/backend/src/modules/seamless/db/pharmcareRepository.js`, `.../controllers/pharmcareController.js`, `backend/tests/pharmcare-repository.test.cjs`, `backend/tests/pharmcare-routes.test.cjs` | **backend**: `listInbox` รับ `order=asc|desc` (default desc) + `receivedFrom`/`receivedTo` (YYYY-MM-DD, validate ทั้ง format และวันที่มีจริง — V8 กลิ้งวันที่เดือนกุมภาแบบ 2026-02-31 ไปเดือนถัดไปแทนที่จะ NaN เลยต้อง round-trip ผ่าน Date.UTC, และ from>to → 400); controller แปลงวันที่เป็น ICT-midnight ISO (คนเลือกวันตามปฏิทินไทย +07:00 ไม่ใช่ UTC ของ server — 23:30 ไอซีทีคืนนั้นยังนับเป็นวันเดียวกัน) โดย receivedTo เป็น exclusive (วันถัดไปเที่ยงคืน) ทำให้ from==to ได้**เอกสารของวันเดียวพอดี**; repository เปลี่ยน ORDER จาก `d.created_at` เป็น `m.received_at` (sort ตามคอลัมน์ที่ผู้ใช้เห็น ต่างกันแค่วินาทีตอน ingest) + cursor เปลี่ยนเป็น (received_at, id) พร้อมทิศเปรียบเทียบตาม order (cursor เดิมรูปแบบ createdAt จะ decode ไม่ผ่าน → กลับไปหน้า 1 — เกิดแค่ชั่วขณะตอน deploy); **frontend**: ปุ่ม sort เป็นหัวคอลัมน์ "ได้รับเมื่อ ▼/▲" เอง (มี `aria-sort` + title อธิบาย) + date inputs "ได้รับจากวันที่/ถึงวันที่" ในแถว filter — เลือกให้ from>to ระบบดันอีกฝั่งตามอัตโนมัติ (`applyFilterChange` pure function export ไว้ test ตรงๆ); เทียบกับโค้ด role ของ Sonnet (แก้ไฟล์ระหว่างทำ) — ทำงานร่วมกับ admin/user view ทั้งสองแบบ | **เสร็จ** — frontend test 50/50 + build ผ่าน (2.42s), backend `npx jest pharmcare` 86/86 ผ่าน (รวมเคสใหม่: single-day ICT range, asc cursor ไม่ซ้ำ/ไม่หลุด, order ผิด→400, วันที่เดือนกุมภา→400, from>to→400) | | | | หมายเหตุสำคัญตอน commit: (1) ฝั่ง ClaspSCxSeamless working tree มี task 7 (theme) รอ commit อยู่ด้วย — แยกหรือรวม commit ตามดุลยพินิจของ reviewer แต่ต้องไม่ปนไฟล์ Shopee (2) ฝั่ง currentSC-official-website-project มีไฟล์ RX1011 dirty อยู่เดิม (pool.js, backend-integration.test.cjs ฯลฯ — ของงานอื่นตาม docs/18) **ห้าม commit รวม** ให้ stage เฉพาะ 4 ไฟล์ pharmcare* (3) deploy backend กระทบ shared service ทั้งเว็บ — ควร deploy ตอนที่เจ้าของยืนยันแล้ว |

| 9 | ย้าย PharmCare Inbox ออกจากเมนู "อัปโหลดข้อมูล Pharm Care" ไปเมนูย่อยใหม่ "รายงานอีเมล์จาก Pharm Care" (ตาม request เจ้าของ repo) | `client/src/App.jsx`, `client/src/components/TopNavBar.jsx`, `client/src/pages/PharmCareReportsPage.jsx` (ใหม่), `client/src/pages/PharmCareUploadPage.jsx` (กลับเป็น placeholder), `client/tests/app-render.test.mjs` | Route ใหม่ `/pharmcare/inbox` + page ใหม่ `PharmCareReportsPage` (Hero ชื่อ "รายงานอีเมล์จาก Pharm Care" ตรงชื่อเมนู + PharmCareInboxPanel เดิมทั้งก้อน ไม่แตะ logic ใน panel เลย — pagination/พรีวิว/sort/role ทุกอย่างตามไปทั้งหมดเพราะเป็น component เดิม); `/pharmcare/upload` กลับเป็น placeholder ตาม pattern PharmCareHistoryPage พร้อมข้อความบอกว่ารายงานย้ายไปเมนูใหม่แล้ว; ลำดับ dropdown: อัปโหลดข้อมูล Pharm Care → รายงานอีเมล์จาก Pharm Care → ประวัติ; redirect `/pharmcare` เปลี่ยนจากชี้ `/pharmcare/upload` มาชี้ `/pharmcare/inbox` (หน้าที่มีของจริง); theme `pharmcare` ติดไปอัตโนมัติเพราะ `resolveTheme` ใช้ startsWith('/pharmcare'); **จุดที่ตัดสินใจเองจาก request กว้าง รบกวน reviewer พิจารณา**: ชื่อ route `/pharmcare/inbox`, ลำดับเมนู, จุดหมาย redirect, Hero title ภาษาไทย | **เสร็จ** — test 52/52 ผ่าน (เพิ่ม 2 เคส: หน้าใหม่โชว์ inbox + หน้า upload กลับเป็น placeholder ชี้ไปเมนูใหม่), `vite build` ผ่าน (2.05s) | Claude Sonnet 5 | 2026-08-19 | **ผ่าน** | อ่านทุกไฟล์เต็ม (`App.jsx`, `TopNavBar.jsx`, `PharmCareReportsPage.jsx`, `PharmCareUploadPage.jsx`) ตรงกับที่บรรยายทุกจุด: route `/pharmcare/inbox` เรนเดอร์ `PharmCareInboxPanel` เดิมไม่แก้ logic, `/pharmcare/upload` เหลือแค่ placeholder ไม่ import Panel แล้ว (ไม่มี dead code), redirect `/pharmcare` ชี้ไป `/pharmcare/inbox` ถูกต้อง, ลำดับ dropdown ตรงตามที่อธิบาย. จุดที่ implementer ตัดสินใจเอง (route name, ลำดับเมนู, ปลายทาง redirect, ไม่ redirect `/pharmcare/upload`) พิจารณาแล้วสมเหตุสมผลทุกข้อ ไม่มีข้อขัดแย้งจะต้องแก้. รัน `npm --prefix client test` เอง (52/52 ตรงกับที่จด ไม่มี stray assertion หลงเหลือ) และ `npm --prefix client run build` เอง (สำเร็จ 1.32s) ยืนยันไม่มี regression |

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
- **2026-08-19** — Task 5 ผ่านรีวิว (Claude Sonnet 5) — flag `SHOW_CLASSIFICATION_EVIDENCE`
  ทำงานถูกต้อง, test 39/39 + build ผ่าน — **Sonnet 5 commit เอง** ตามที่เจ้าของ repo สั่งไว้
  stage เฉพาะ `PharmCareMessageDetail.jsx` + `pharmcare-inbox-view.test.mjs` + ledger นี้
  ไม่แตะไฟล์ Shopee ที่ยัง dirty เลย. **เจ้าของ repo ขอเพิ่มเติมหลัง task นี้**: อยากได้ระบบ
  สิทธิ์ผู้ใช้จริง (user ทั่วไป vs admin) แทน flag คุมทุกคนเท่ากัน — ยังไม่ได้เริ่ม รอคุยขอบเขต
  กับเจ้าของ repo ก่อน จะจดเป็น task 6 เมื่อขอบเขตชัดเจนแล้ว

| 6 | ระบบสิทธิ์ user ทั่วไป vs admin — ซ่อนคอลัมน์เส้นทาง/เลขเอกสาร/สถานะ + เหตุผลการจัดประเภทจาก user ทั่วไป (ตาม request เจ้าของ repo หลัง task 5) | Backend (`currentSC-official-website-project`): `config.js`, `middleware/appAuth.js`, `middleware/session.js`, `controllers/sessionController.js`, `controllers/pharmcareController.js`, `.env.example`, `tests/pharmcare-routes.test.cjs`, `tests/seamless-app-auth.test.cjs`. Frontend (repo นี้): `client/src/services/api.js`, `client/src/components/PharmCareInboxPanel.jsx`, `PharmCareInboxView.jsx`, `PharmCareMessageDetail.jsx`, `client/src/styles/app.css`, `client/tests/pharmcare-inbox-view.test.mjs` | เพิ่มรหัสผ่านชุดที่สอง (`SEAMLESS_APP_ADMIN_BASIC_USER/PASSWORD`) — appAuth ติด `req.appRole` ('admin'/'user') ตามชุดรหัสที่ match, session cookie พก role ไปด้วย. `pharmcareController` ตัด field `route`/`documentNumber`/`reviewStatus`/`reasonCodes`/`classifierVersion` ออกจาก response **ฝั่ง backend เอง** สำหรับ non-admin (ไม่ใช่แค่ซ่อนที่ UI — เปิด devtools/network tab ก็ไม่เห็น). Frontend: Panel เรียก `getSession()` เองเพื่อรู้ role ของตัวเอง (default 'user' ระหว่างรอ/ถ้า fetch fail), ส่ง `appRole` ลงไปที่ View → ตารางแสดง 7 คอลัมน์ (ไม่มีเส้นทาง/เลขเอกสาร/สถานะ) แทน 10 คอลัมน์สำหรับ user ทั่วไป พร้อม colgroup ชุดใหม่ (`.pharmcare-col-user-*`) กระจายพื้นที่ที่เหลือให้คอลัมน์อื่น, ส่วน "เหตุผลการจัดประเภท" ใน detail (task 5 เดิมใช้ hardcoded flag) เปลี่ยนมาผูกกับ role จริงแทน — admin เห็น user ไม่เห็น | **เสร็จ** (Sonnet 5 implement เองทั้งฝั่ง backend เพราะแตะ auth boundary ของ shared backend + production DB — ไม่ผ่าน GLM 5.2) — backend test 202/202 ผ่าน, frontend test 43/43 ผ่าน (เพิ่ม 6 เคสใหม่คลุม role matrix), `vite build` ผ่าน | Claude Sonnet 5 | 2026-08-19 | **ผ่าน** | Self-implemented + self-reviewed เนื่องจากงานนี้เป็น auth/security boundary ของ shared backend (ไม่ใช่ frontend-only เหมือน task 1-5) — เจ้าของ repo ยืนยัน scope 2 รอบผ่าน AskUserQuestion (วิธี auth = รหัสผ่านชุดที่ 2, ฟีเจอร์ admin = resolve manual_review + group เอกสาร (ยังไม่ทำ รอ task 7)) ก่อนเริ่ม และยืนยัน commit+push ทั้ง 2 repo ก่อน push จริง (backend deploy ทันทีที่ push). Backend commit `eb11a3e` push แล้วที่ `currentSC-official-website-project` main. ประเด็นที่ต้องรู้: **ต้องตั้งค่า `SEAMLESS_APP_ADMIN_BASIC_USER`/`SEAMLESS_APP_ADMIN_BASIC_PASSWORD` บน Render env vars เอง** — ถ้าไม่ตั้ง จะไม่มีใครได้ role admin เลย (ทุกคนเห็นแค่ view แบบ user แม้จะล็อกอินด้วยรหัสผ่านเดิมก็ตาม) ยังไม่ได้ทำ: resolve manual_review / group เอกสารที่เกี่ยวข้องกัน (ต้อง migration ใหม่ + endpoint ใหม่ — เป็น task 7 แยกต่างหาก) |
- **2026-08-19** — Task 6 เสร็จ + ผ่านรีวิว (Claude Sonnet 5 implement เองทั้ง backend+frontend
  เนื่องจากแตะ auth boundary ของ shared backend) — backend test 202/202, frontend test 43/43,
  build ผ่านทั้งคู่ — **Sonnet 5 commit เอง** ตามที่เจ้าของ repo สั่งไว้ backend commit `eb11a3e`
  push แล้วที่ `currentSC-official-website-project` main, frontend commit ตามหลังในนี้
  ไม่แตะไฟล์ RX1011 ที่ยัง dirty ใน backend repo และไม่แตะไฟล์ Shopee ใน repo นี้เลย.
  **สำคัญ**: เจ้าของ repo ต้องตั้งค่า `SEAMLESS_APP_ADMIN_BASIC_USER`/`PASSWORD` บน Render เอง
  ก่อนฟีเจอร์ admin จะใช้งานได้จริง (ไม่ตั้ง = ทุกคนเห็น view แบบ user ทั้งหมด ปลอดภัยไว้ก่อน).
  **GLM 5.2 อ่านต่อจากตรงนี้ได้เลยสำหรับ task ถัดไป** — task 7 (resolve manual_review + group
  เอกสาร) ยังไม่เริ่ม รอ spec เพิ่มเติม
- **2026-08-19** — อัปเดตสถานะล่าสุดให้ผู้ implement (GLM 5.2) อ่านก่อนเริ่มงานต่อ เพื่อไม่ให้งง:
  หลัง task 6 (ผ่านรีวิว, commit แล้วทั้ง 2 repo) เจ้าของ repo ขอเพิ่มอีก 1 อย่างที่ **ยังไม่ได้
  จดเป็น task แยกในตารางด้านบน** — รองรับ staff หลาย username ใช้รหัสผ่านชุดเดียวกัน
  (`SEAMLESS_APP_BASIC_USER` เปลี่ยนจากรับ username เดียว เป็นรับ comma-separated list เช่น
  `staff000,staff001,staff003,staff004,staff005`) — Sonnet 5 implement เองที่ backend
  (`currentSC-official-website-project`) เพราะเป็นส่วนต่อขยายของ auth boundary เดียวกับ task 6
  ไม่แตะฝั่ง frontend repo นี้เลย (ไม่มีการเปลี่ยนแปลง UI ที่เกี่ยวข้อง). Backend test 203/203
  ผ่าน commit `a132251` push แล้วที่ `currentSC-official-website-project` main (ต่อจาก `eb11a3e`
  ของ task 6). เจ้าของ repo ตั้งค่า env vars บน Render เองแล้ว (ทั้ง admin pair จาก task 6 และ
  staff usernames ชุดนี้).

  **สรุปสถานะรวมล่าสุด (สำหรับอ่านก่อนรับงานต่อ)**:
  - Task 1–6 เสร็จ + ผ่านรีวิวหมดแล้ว, commit+push แล้วทั้ง backend และ frontend repo
  - Backend commits ล่าสุด (`currentSC-official-website-project` main): `eb11a3e` (role split
    admin/user) → `a132251` (multi-username staff list)
  - Frontend commits ล่าสุด (repo นี้ main): `2284ed5` (task 5 flag) → `00d8903` (task 6 role
    gating ของตาราง/detail)
  - Task 7 (admin resolve manual_review + group เอกสารที่เกี่ยวข้องกัน) — **ยังไม่เริ่ม** รอ spec
    เพิ่มเติมจากเจ้าของ repo ก่อน (ต้องมี DB migration ใหม่ + endpoint ใหม่ที่ backend)
  - ไม่มีงาน frontend ค้างให้ GLM 5.2 ทำตอนนี้ — รอ task ถัดไปจากเจ้าของ repo
- **2026-08-19** — เพิ่ม task ใหม่ (task 8) จาก Claude Sonnet 5: ทำปุ่ม "ขอปริ้น" สำหรับเอกสาร
  PharmCare — **backend เสร็จแล้ว** (Sonnet 5 implement+test+commit เอง เพราะแตะ shared print
  pipeline: `currentSC-official-website-project` commit `9e4bec9`, spec เต็มที่
  `docs/22-pharmcare-print-integration-spec.md` — อ่านไฟล์นั้นก่อนเริ่ม มี API contract +
  ตัวอย่างโค้ดอ้างอิงชัดเจน) — **frontend รอ GLM 5.2 ทำต่อ** สรุปสั้น: เพิ่ม
  `requestPharmcarePrint()` ใน `api.js` (pattern เดียวกับ `requestProcessingHistoryPrint()` ที่
  มีอยู่แล้ว) + ปุ่ม "ขอปริ้น" เฉพาะ admin ในตาราง/detail panel ของ PharmCare Inbox (เอกสารที่ไม่มี
  ไฟล์แนบไม่ควรมีปุ่มนี้) — ดูตัวอย่าง loading/confirm/error pattern จาก `HistoryPanel.jsx`
  `handleRequestPrint()` (บรรทัด ~185-210) + `HistoryActions.jsx` ปุ่ม "สั่งปริ้น / ขอปริ้นใหม่"
  ได้เลย เป็น pattern เดียวกันตรงๆ ยังไม่เริ่มโค้ดฝั่ง frontend เลย ณ ตอนนี้
- **2026-08-19** — Task 7 (dark mode toggle) + Task 8 (sort/date-range, cross-repo) ผ่านรีวิว
  (Claude Sonnet 5) — ตรวจละเอียดทั้งสองงาน (ไม่ได้แค่แปะ ✅ ในตาราง เพราะ table cell กำลังถูกแก้
  พร้อมกันจาก session อื่น เลยบันทึกผลตรงนี้แทน กัน edit ชนกัน):

  **Task 7 (dark mode)**: อ่าน `App.jsx`/`TopNavBar.jsx`/CSS block เต็มทุกไฟล์ — localStorage
  try/catch ถูกต้อง (SSR/privacy mode ปลอดภัย), ปุ่ม optional prop ตรง pattern `onLogout` เดิม,
  ยืนยัน **additive-only จริง** (grep `[data-color-mode="dark"]` เจอ block เดียวท้ายไฟล์ ไม่มี
  rule เดิมถูกแก้แม้บรรทัดเดียว — ใช้กลไก CSS custom properties ที่ rule เดิมอ้างอิงอยู่แล้วจึงพอ
  แค่ override ตัวแปร). **ผ่าน**

  **Task 8 (sort/date-range)**: (1) `isValidCalendarDate` round-trip ผ่าน `Date.UTC` จับ
  2026-02-31 ได้จริง (2) ICT boundary ตรวจเอง — `toIctMidnightIso`/`toNextIctMidnightIso` ถูก
  ทั้งสองด้าน, เทสของ implementer เลือกเคสขอบ 16:30Z (=23:30 ICT) ไม่ใช่แค่เคสง่าย (3) cursor
  `(received_at, id)` เปรียบเทียบทิศตาม order ถูกต้อง ยืนยัน backward-compat กับ cursor เก่า
  (4) `pharmcare-repository.test.cjs` เป็น live-DB test ยืนยัน pagination จริงระดับ SQL ไม่ใช่แค่
  mock. **ผ่าน**

  รันเองยืนยันทั้งคู่: `npx jest` เต็ม backend repo (**213 ผ่าน, 5 skip เดิม, ไม่มี fail** — เลข
  86/86 ที่ implementer จดไม่ตรงกับที่รันได้จริงในเครื่องผม แต่ไม่มี test ไหน fail เลย ไม่ block)
  และ `npm --prefix client test` + `run build` เอง (**50/50 ผ่าน + build สำเร็จ** ตรงกับที่จด)
  ไม่มี regression ทั้งสองฝั่ง — **Sonnet 5 commit เอง** ตามที่เจ้าของ repo สั่งไว้ ทำตาม
  หมายเหตุที่ implementer ทิ้งไว้เป๊ะ: แยก commit task 7/8, ไม่ปนไฟล์ Shopee/RX1011
- **2026-08-19** — Task 7 + 8 commit แล้ว — backend `currentSC-official-website-project` commit
  `145ed33` push แล้ว, frontend (repo นี้) commit `859e973` push แล้ว (รวม task 7+8 commit
  เดียวกันเพราะ `app.css` มีการแก้ของทั้งสอง task ปนกันจนแยก commit สะอาดๆ ไม่ได้ — ตามที่
  implementer เปิดทางไว้ว่า "แยกหรือรวมตามดุลยพินิจ reviewer") ไม่ปนไฟล์ RX1011/Shopee เลยทั้ง
  สองฝั่ง ตรวจสอบแล้ว **GLM 5.2 อ่านต่อจากตรงนี้ได้เลยสำหรับ task ถัดไป** — ยังไม่มี task ใหม่
  ที่ระบุไว้ ณ ตอนนี้ รอเจ้าของ repo สั่งเพิ่ม
- **2026-08-19** — Task 9 ผ่านรีวิว (Claude Sonnet 5) — ตรวจ route wiring + placeholder ครบทุก
  จุด ไม่มี dead code เหลือ, test 52/52 + build ผ่าน — **Sonnet 5 commit เอง** ตามที่เจ้าของ repo
  สั่งไว้ commit `88b2c56` push แล้วที่ `main` ไม่ปนไฟล์ Shopee เลย **GLM 5.2 อ่านต่อจากตรงนี้ได้
  เลยสำหรับ task ถัดไป** — ยังไม่มี task ใหม่ ณ ตอนนี้ (งานปุ่ม "ขอปริ้น" ตาม docs/22 ยังรอเจ้าของ
  repo ตัดสินใจว่าจะให้เริ่มเมื่อไหร่)

- **2026-08-24 — Task 10: Shopee live email inbox (Codex implement/review)** — เพิ่ม route
  `/shopee/inbox`, เมนู "รายงานอีเมล์จาก Shopee", live read-only inbox table, category/date
  filters และ Gmail page-token pagination. Backend จริงเพิ่ม `GET /api/app/shopee/inbox` และ
  reuse Gmail OAuth read-only ของ `admin@scgroup1989.com` โดยบังคับ query/default sender
  `info@mail.shopee.co.th`; ไม่ใช้ DB/print pipeline และไม่แตะ `server/`/`print-agent/` dirty
  ของ Shopee accounting workbook workstream เก่า. ตรวจด้วยข้อมูล Gmail จริง 98 ฉบับย้อนหลัง
  30 วันเพื่อยืนยัน category patterns. **Review รอบ 2 request changes แล้วแก้ครบ:** (1) ข้ามเฉพาะ
  Gmail 404; 401/429/5xx แบบ single/mixed ทำให้ทั้งหน้า error ไม่คืน partial เงียบ (2) exact ICT
  date boundary post-filter ด้วย `internalDate` (3) frontend reducer ผูก rows/cursor กับ request
  generation เดียวกันและ guard stale success/failure (4) metadata-only + partial fields,
  timeout 10 วินาที/no application retry, cache ต่อ instance 15 วินาที, cap 25 แถว (5) role
  `user` ถูกปกปิด buyer username ใน subject ที่ backend; admin เห็นเต็ม. **Review รอบ 3 privacy
  fix:** regex ครอบคลุมทั้ง `จากผู้ซื้อ ...`, `ถูกยกเลิกโดย ...` และ
  `ถูกทำการยกเลิกโดย ...` พร้อม route regression test. ผล local ล่าสุด: frontend **61/61 ผ่าน**
  + Vite build ผ่าน; backend targeted **42/42 ผ่าน**; regression ไม่รวม integration
  **199 ผ่าน/5 skip**; full backend **244 ผ่าน/5 skip**. Full run มี warning ว่า env
  `SC_OFFICIAL_SUPABASE_DATABASE_URL` ขาดตอนโหลดบาง module แต่ test ยังผ่าน; และตัวเลข full suite
  รวม `backend-integration.test.cjs` dirty ของ RX1011 จึงไม่ใช่ Shopee baseline โดยตรง. Gmail
  quota ตามเอกสาร Google ปัจจุบันคือ `list=5`, `get=20`, 6,000 units/min/user สำหรับ project
  ภายใต้ regime ใหม่ แต่ project ที่เคยใช้ช่วง พ.ย. 2025–เม.ย. 2026 อาจใช้ quota เดิม — ก่อน
  deploy ต้องตรวจ Cloud Console ของ project จริงและเฝ้าดู quota หลังเปิดใช้. **Final review:
  approve with non-blocking notes.** Code commit backend `8f45b9f` และ frontend `81b714d` push
  ขึ้น `main` แล้วโดย stage เฉพาะไฟล์งานนี้; **ยังไม่ deploy** ตาม quota gate.

- **2026-08-24 — Task 11: Shopee order timeline (Codex implementation, รอ independent
  review)** — เชื่อมอีเมล Shopee ที่มีเลขคำสั่งซื้อเดียวกันเป็น current state + chronological
  events โดยเพิ่มตารางแยก `shopee_orders`/`shopee_order_events`; ไม่ใช้
  `processing_records`/print pipeline และไม่เขียน raw subject/body, buyer username, ชื่อผู้รับ,
  ที่อยู่ หรือเบอร์โทรลง DB. Parser เก็บเฉพาะเลขคำสั่งซื้อ, วันสั่ง/กำหนดส่ง, รายการสินค้า,
  จำนวน/ราคา/ยอดเงิน, delivery method และ cancellation reason code ที่กำหนดไว้. Idempotency
  บังคับด้วย unique Gmail message ID ต่อ mailbox (ไม่ dedupe ด้วย subject เพราะอีเมลพัสดุคืน
  อาจมี subject ซ้ำ). API ใหม่: `GET /api/app/shopee/orders`,
  `GET /api/app/shopee/orders/:orderNumber` สำหรับ session ที่ login และ
  `POST /api/app/shopee/orders/sync` เฉพาะ admin; sync อ่านครั้งละไม่เกิน 25 ข้อความ,
  concurrency 5, timeout 10 วินาที, ปิด automatic retry, ข้ามเฉพาะ Gmail 404 และส่ง opaque
  Gmail cursor กลับเพื่อให้ admin เลือกโหลดอีเมลเก่าต่อเอง. Frontend เพิ่ม
  `/shopee/orders`, filter สถานะ, ตารางสรุป, expandable item/amount detail และ timeline สีตาม
  event; sync controls default-hidden จนยืนยัน role admin และ backend ตรวจ role ซ้ำอีกชั้น.
  ผล local ณ ก่อน review: backend Shopee + Gmail adapter targeted **77/77 ผ่าน**, backend
  regression ไม่รวม DB integration **218 ผ่าน/5 skip**, backend full **263 ผ่าน/5 skip**, frontend
  **67/67 ผ่าน**, Vite production build ผ่าน. **Deployment order ที่ห้ามสลับ:** ตรวจ Gmail quota
  gate → รัน `npm run seamless:migrate` ใน backend เพื่อ apply
  `008_shopee_order_timeline.sql` → deploy backend → deploy frontend → admin กด sync latest และ
  ตรวจ sample 1–3 orders. ตอนนี้ยังไม่ stage/commit/push/deploy และห้ามรวม dirty RX1011,
  `server/`, `print-agent/`, `docs/07`, `docs/17` เข้า commit งานนี้.

- **2026-08-24 — Task 11 remediation assignment (`TASK11-SENIOR-REMEDIATION`)** — เจ้าของงาน
  มอบหมายให้ **Codex Senior Dev ในอีก session เป็น implementer** และให้ Codex session เดิมเป็น
  coordinator/reviewer หลังส่งมอบ เพื่อไม่ให้สอง session แก้ไฟล์เดียวกันพร้อมกัน. สถานะเริ่มต้น:
  **assigned / ยังไม่เริ่มแก้ / ยังไม่อนุญาตให้ commit-push-deploy**. Senior Dev ต้องแก้ findings
  จาก independent review ให้ครบ: (1) High privacy — product parser ต้องยืนยัน product section,
  fail closed เมื่อพบ sensitive buyer/recipient labels และมี egress allowlist ก่อนคืน JSONB
  items พร้อม adversarial regression tests (2) Medium frontend race — sync เสร็จต้อง refresh ด้วย
  filter ล่าสุด ไม่ใช่ closure เก่า พร้อม async/component-level regression test (3) Low — ใช้
  order-number rule `[A-Z0-9]{8,40}` เดียวกันใน parser/controller/SQL constraint พร้อม tests
  (4) เพิ่ม PostgreSQL migration smoke test ใน Backend CI ด้วย ephemeral service container ห้ามใช้
  production secret/database. Residual quota risk (หลาย sync requests พร้อมกันข้าม tab/instance)
  ต้องประเมินและเลือก PostgreSQL advisory lock/per-mailbox protection ที่ทดสอบได้ หรือบันทึกเหตุผล
  ชัดเจนหากยังไม่ implement; browser-only `isSyncing` ไม่ถือเป็น server-side protection.

  Working agreement: อ่าน `docs/23` และ Task 10–11 ใน ledger นี้ก่อนแก้; backend จริงอยู่ที่
  `currentSC-official-website-project/backend/src/modules/seamless`, frontend จริงอยู่เฉพาะ
  `ClaspSCxSeamless/client`. ห้ามแตะ/stage dirty RX1011 ใน backend และห้ามแตะ/stage
  `ClaspSCxSeamless/server`, `print-agent`, `docs/07`, `docs/17`. ใช้ `apply_patch`, ไม่รัน
  migration กับฐานข้อมูลจริง, ไม่ stage/commit/push/deploy. เมื่อเสร็จให้แก้ entry นี้ต่อท้ายด้วย
  `Implementation handoff:` ระบุไฟล์ที่แก้, design decisions, targeted/regression/full/frontend/
  build/migration-smoke results, residual risks และ explicit stage list แล้วหยุดรอ coordinator
  review. Coordinator จะตรวจ diff/test ซ้ำและเป็นผู้ขออนุมัติ commit/push จากเจ้าของ repo.

  **Implementation handoff:** remediation เสร็จครบและสถานะคือ **Ready for coordinator review**.
  Privacy boundary เปลี่ยนเป็น fail closed: parser จะรับสินค้าเฉพาะภายใน heading ที่ยืนยันว่าเป็น
  product section, ต้องพบขอบเขตยอดรวมและ quantity/price ที่ parse ได้ และทิ้ง items ทั้ง section
  เมื่อพบ buyer/recipient/name/address/phone label. เพิ่ม shared allowlist sanitizer ที่ใช้ทั้งก่อน
  persist และตอน map JSONB ออกจาก repository; event details ก็คืนเฉพาะ
  `shippingDeadline`/`cancellationReasonCode`. Order number ใช้ shared
  `^[A-Z0-9]{8,40}$` ใน parser/controller/repository และ SQL constraint เดียวกัน.

  Server-side quota protection ใช้ PostgreSQL session advisory lock ต่อ normalized mailbox แบบ
  `pg_try_advisory_lock` ก่อน Gmail call แรก; request ที่ชน lock ตอบ `409 CONFLICT` ทันที และ
  unlock/release client ใน success, callback failure และ unlock failure paths. Frontend sync
  orchestration อ่าน `filtersRef.current` หลัง sync resolve จึง refresh ด้วย filter ล่าสุด;
  generation guard เดิมยังกัน response เก่าเขียนทับ state. Backend CI เดิมถูกขยายด้วย
  `postgres:16-alpine`, test-only local URL/schema, migration สองรอบและ verifier ที่ refuse
  non-local/non-`*_ci` target; regression ignore ของ `backend-integration.test.cjs` คงเดิม.

  ไฟล์ remediation ที่แก้/เพิ่มโดยตรง: backend `.github/workflows/backend-ci.yml`,
  `backend/package.json`, `backend/scripts/verify-seamless-migrations.cjs`,
  `shopeeOrderValidation.js`, order parser/controller/repository/timeline service, migration 008
  และ order parser/repository/route/service tests; frontend
  `client/src/components/ShopeeOrderTimelinePanel.jsx`,
  `client/tests/shopee-order-timeline-view.test.mjs` และ ledger entry นี้.

  ผลตรวจสุดท้าย: backend targeted Shopee + Gmail adapter **88/88 ผ่าน**; regression ไม่รวม
  integration **229 ผ่าน/5 skip**; full backend **274 ผ่าน/5 skip**; frontend **68/68 ผ่าน**;
  Vite production build ผ่าน; Backend CI YAML parse ผ่าน; `git diff --check` ผ่านโดยมีเพียง
  CRLF warnings. Migration smoke ผ่านบน PostgreSQL ชั่วคราว local-only: apply migration SQL
  ทั้ง 9 ไฟล์สำเร็จ, รอบสอง skip ทั้งหมดตาม ledger และ verifier ยืนยัน migration ledger,
  สองตาราง, invalid short order constraint และ valid order/event insert โดย rollback test data.
  ไม่ได้ apply migration กับฐานข้อมูลจริง.

  Residual risks/gates: ต้องยืนยัน Gmail quota regime เดิมก่อน deploy; template อีเมลที่เปลี่ยน
  heading/structure จะถูก fail closed เป็น order/event ที่ไม่มี items จนเพิ่ม fixture ที่ตรวจแล้ว;
  advisory lock ป้องกันข้าม tab/process/instance เมื่อทุก instance ใช้ PostgreSQL เดียวกัน แต่ถ้า
  DB ใช้งานไม่ได้ sync จะ fail ก่อนแตะ Gmail; CI workflow ยังไม่เกิด run จริงจน coordinator
  อนุมัติ commit/push. Local unit/full suite ยังพิมพ์ warning ว่าขาด
  `SC_OFFICIAL_SUPABASE_DATABASE_URL` ตาม baseline แต่ไม่มี test fail.

  **Explicit stage list — backend repo (Task 11 only):**
  `.github/workflows/backend-ci.yml`, `backend/package.json`,
  `backend/scripts/verify-seamless-migrations.cjs`,
  `backend/src/modules/seamless/controllers/shopeeOrderController.js`,
  `backend/src/modules/seamless/db/migrations/008_shopee_order_timeline.sql`,
  `backend/src/modules/seamless/db/shopeeOrderRepository.js`,
  `backend/src/modules/seamless/routes/shopeeEmailRoutes.js`,
  `backend/src/modules/seamless/services/pharmcare/gmailAdapter.js`,
  `backend/src/modules/seamless/services/shopeeEmailInboxService.js`,
  `backend/src/modules/seamless/services/shopeeOrderEmailParser.js`,
  `backend/src/modules/seamless/services/shopeeOrderTimelineService.js`,
  `backend/src/modules/seamless/shopeeOrderValidation.js`,
  `backend/src/modules/seamless/tables.js`,
  `backend/tests/pharmcare-gmail-adapter.test.cjs`,
  `backend/tests/shopee-order-email-parser.test.cjs`,
  `backend/tests/shopee-order-repository.test.cjs`,
  `backend/tests/shopee-order-routes.test.cjs`,
  `backend/tests/shopee-order-timeline-service.test.cjs`.

  **Explicit stage list — frontend/docs repo (Task 11 only):** `client/src/App.jsx`,
  `client/src/components/TopNavBar.jsx`, `client/src/components/shopeeEmailLabels.js`,
  `client/src/components/ShopeeOrderTimelinePanel.jsx`,
  `client/src/components/ShopeeOrderTimelineView.jsx`,
  `client/src/pages/ShopeeOrdersPage.jsx`, `client/src/services/api.js`,
  `client/src/styles/app.css`, `client/tests/api-service.test.mjs`,
  `client/tests/app-render.test.mjs`, `client/tests/shopee-order-timeline-view.test.mjs`,
  `client/tests/top-navbar.test.mjs`, `docs/20-frontend-work-review-ledger.md`,
  `docs/23-tech-lead-handoff-2026-08-19.md`.

  Explicitly exclude backend RX1011/report/integration/env-audit incident files and frontend
  `docs/07`, `docs/17`, `server/`, `print-agent/` dirty workstreams. ยังไม่ได้ stage, commit,
  push, apply migration กับฐานข้อมูลจริง หรือ deploy.

  **Coordinator review round 1 (Codex session เดิม, 2026-08-24): Request changes.** ตรวจ diff
  และ reproduce แยกจาก implementer แล้วพบ 2 confirmed defects: (1) **High privacy** — sensitive
  detector ยัง bypass ได้ด้วย label ที่มีคำนำหน้า เช่น `ข้อมูลผู้ซื้อ: <name>`;
  `containsSensitiveShopeeLabel()` คืน false, parser รับเป็น `item.name` เมื่อมี quantity/price
  ครบ และ egress sanitizer ตัวเดียวกันก็ปล่อยออก API จึงยัง persist/return PII ได้. ต้อง normalize
  optional metadata prefixes/bullets และเพิ่ม adversarial matrix เช่น `ข้อมูลผู้ซื้อ`,
  `ข้อมูลผู้รับ`, `ที่อยู่สำหรับจัดส่ง`, `เบอร์โทรมือถือ` ทั้ง parser + ingress/egress tests.
  (2) **Medium functional/data quality** — Gmail จริงที่ตรวจแบบ read-only และไม่บันทึกข้อมูลส่วนตัว
  พบว่า COD template ใช้ heading `รายละเอียดคำสั่งซื้อ` พร้อม numbered item/quantity/price/total
  ครบ แต่ `PRODUCT_SECTION_HEADING_PATTERN` ไม่รับ heading นี้ ทำให้ parser คืน `items: []`.
  Probe local ยืนยัน `itemCount: 0`; ต้องรับ heading จริงนี้โดยยังคง verified totals boundary,
  structural quantity/price และ sensitive-label fail-closed พร้อม fixture regression ที่ตรงโครงสร้าง
  Gmail จริง. จาก sample แยก shipment/COD/cancellation 3 ประเภท ทุกฉบับมี
  `รายละเอียดคำสั่งซื้อ`, numbered item และ totals boundary และไม่มี sensitive label อยู่ในช่วง
  heading→ยอดรวม; COD sample ไม่มี specific heading อีกสามแบบ จึงโดน defect แน่นอน.

  ส่วนอื่น coordinator ตรวจแล้วผ่าน: shared order-number rule ตรง parser/controller/repository/SQL;
  stale-filter refresh อ่าน `filtersRef.current`; PostgreSQL advisory lock เกิดก่อน Gmail, conflict
  เป็น 409, unlock แล้ว reacquire ได้จริงบน local PostgreSQL; migration verifier ปฏิเสธ non-local/
  non-`*_ci` และตรวจครบ 9 migrations. รันเอง: targeted **88/88**, regression แบบ CI ต่อ
  ephemeral PostgreSQL **229 ผ่าน/5 skip**, full backend **274 ผ่าน/5 skip**, frontend **68/68**,
  Vite build และ migration idempotency/verifier ผ่าน. CI-like regression มี Jest open-handle warning
  จาก PostgreSQL pool แล้วปิดเองหลัง idle timeout แต่ exit 0 — non-blocking note. PostgreSQL
  ชั่วคราวถูก coordinator start เพื่อ verify และ stop แล้ว; data directory เดิมยังไม่ถูกลบ.
  **สถานะยังไม่พร้อม stage/commit/push/deploy**; ส่งกลับ Senior Dev แก้สอง defect และเพิ่ม tests
  แล้วต่อท้าย `Implementation handoff round 2` ใต้ marker เดิม.

  **Implementation handoff round 2 (2026-08-24):** แก้ confirmed defects ทั้งสองข้อแล้วและสถานะ
  คือ **Ready for coordinator review round 2**. Sensitive-label normalizer ลอก bullet/numbered
  prefixes และ metadata prefixes `ข้อมูล`/`รายละเอียด` แบบซ้ำได้ก่อนตรวจ label; matrix ครอบ
  `ข้อมูลผู้ซื้อ`, `ข้อมูลผู้รับ`, `ที่อยู่สำหรับจัดส่ง`, `เบอร์โทรมือถือ` และ
  `หมายเลขโทรศัพท์มือถือ`. Parser ทิ้ง items ทั้ง section เมื่อพบ label เหล่านี้ และ shared
  persistence/API-egress sanitizer ทิ้ง items ทั้ง array หาก `name` หรือ `variant` ตัวใดมี
  sensitive label จึงไม่เหลือ safe sibling ที่อาจทำให้เข้าใจผิดว่า section ผ่าน validation.

  Product-section allowlist เพิ่ม verified heading `รายละเอียดคำสั่งซื้อ` ตาม Gmail template จริง
  โดยยังต้องมี numbered item, quantity, price และ totals boundary ครบ. COD real-template fixture
  ใช้ลำดับ heading → numbered item → quantity → price → `ยอดรวมค่าสินค้า` และยืนยัน
  `itemCount: 1`/item fields จริง; negative matrix ยืนยันว่าขาด structural field ใด field หนึ่ง
  จะ fail closed เป็น `items: []`. Adversarial parser tests วาง sensitive metadata ต่อจาก valid
  item เพื่อยืนยันว่าทิ้งทั้ง section ส่วน repository tests ยืนยันทั้ง SQL persistence parameter
  และ `mapOrder()` API egress ไม่คืน matrix เดียวกัน.

  ไฟล์ที่แก้ใน round 2 เท่านั้น: backend
  `backend/src/modules/seamless/shopeeOrderValidation.js`,
  `backend/src/modules/seamless/services/shopeeOrderEmailParser.js`,
  `backend/tests/shopee-order-email-parser.test.cjs`,
  `backend/tests/shopee-order-repository.test.cjs`; frontend/docs
  `docs/20-frontend-work-review-ledger.md`. Explicit stage list ของ Task 11 ทั้งก้อนยังคงเป็นรายการ
  ใน Implementation handoff รอบแรก; ห้ามรวม dirty RX1011/report/integration/env-audit incident
  files หรือ frontend `docs/07`, `docs/17`, `server/`, `print-agent/` เช่นเดิม.

  ผลตรวจ round 2: backend targeted Shopee + Gmail adapter **102/102 ผ่าน**; regression ไม่รวม
  integration **243 ผ่าน/5 skip**; full backend **288 ผ่าน/5 skip**; frontend **68/68 ผ่าน**;
  Vite production build ผ่าน; Node syntax checks ผ่าน. Migration smoke รันใหม่บน PostgreSQL
  ชั่วคราว local-only schema `clasp_scx_seamless_round2_ci`: apply SQL ทั้ง 9 files สำเร็จ,
  รอบสอง skip ทั้งหมดและ verifier ผ่าน migration ledger/tables/order constraint/valid insert.
  `git diff --check` ทั้งสอง repo ผ่านโดยมีเพียง CRLF warnings. Local backend suites ยังมี baseline
  warning ว่าขาด `SC_OFFICIAL_SUPABASE_DATABASE_URL` แต่ไม่มี test fail.

  Residual gates ไม่เปลี่ยน: ต้องตรวจ Gmail quota regime ก่อน deploy, CI workflow จริงยังไม่รัน
  จน commit/push และ migration 008 ยังไม่ถูก apply กับฐานข้อมูลจริง. ยังไม่ได้ stage, commit, push,
  apply migration กับฐานข้อมูลจริง หรือ deploy และไม่ได้แตะ dirty workstreams เดิม.

  **Coordinator review round 2 (Codex session เดิม, 2026-08-24): Approve with non-blocking
  notes.** ไม่พบ Critical, High, Medium หรือ Low defect เพิ่มเติมจาก delta รอบ 2. อ่าน
  sensitive-label normalizer/parser/repository boundaries และ tests ที่เพิ่มทั้งหมด แล้วทำ
  independent synthetic probes แยกจาก fixture ของ implementer: matrix 5 รูปแบบเดิม รวม
  bullet/numbered/full-width colon, nested metadata prefixes และ English label ถูกตรวจพบและ
  fail closed เป็น `items: []` ทั้ง parser และ shared persistence/API-egress sanitizer. Probe
  heading จริง `รายละเอียดคำสั่งซื้อ` ได้สินค้า 1 รายการพร้อม quantity/price ถูกต้อง ขณะที่กรณี
  ไม่มี totals boundary ยังได้ 0 รายการตาม fail-closed contract.

  Coordinator รันซ้ำ: backend targeted Shopee + Gmail adapter **102/102 ผ่าน**, regression ไม่รวม
  integration **243 ผ่าน/5 skip**, full backend **288 ผ่าน/5 skip**, frontend **68/68 ผ่าน** และ
  Vite production build ผ่าน. `git diff --check` ทั้งสอง repo ผ่านโดยมีเพียง CRLF warnings เดิม;
  test/build ไม่สร้างไฟล์ใหม่ และ dirty workstreams ที่ explicitly excluded ยังอยู่ครบ. Migration/
  CI files ไม่ได้เปลี่ยนใน round 2; migration smoke/idempotency/verifier ผ่านจาก handoff รอบ 2
  และ coordinator เคยตรวจกลไกเดียวกันบน PostgreSQL ชั่วคราวในรอบ 1 แล้ว จึงไม่ได้ apply หรือแตะ
  ฐานข้อมูลจริงซ้ำใน review นี้.

  **Verdict:** Task 11 พร้อมให้เจ้าของอนุมัติ stage แบบ explicit ตามรายการด้านบน แล้ว commit/push
  เพื่อให้ remote CI ทำงาน. ยังไม่พร้อม deploy จนยืนยัน Gmail quota regime และทำ deployment gate
  ตามลำดับเดิม (apply migration 008 ก่อน backend/frontend deploy). Coordinator รอบนี้ไม่ได้ stage,
  commit, push, apply production migration หรือ deploy.

- **2026-08-25 — Task 12: Shopee rolling four-week accounting cycle + persisted next-cycle
  notifier (`TASK12-SHOPEE-ACCOUNTING-CYCLE`) — Ready for senior review.** เจ้าของอนุมัติกติกา
  รอบบัญชีต่อเนื่อง 4 สัปดาห์ (28 วัน) จันทร์–อาทิตย์ โดยยึด workbook เดือนมิถุนายน 2569 เป็น
  anchor: `2026-06-01..2026-06-28`. ระบบสร้าง profile ของเดือนก่อน/ถัดไปอัตโนมัติเฉพาะวันที่เริ่ม
  ที่ตรงกับลำดับ 28 วันจาก anchor และ fail closed หากชื่อไฟล์เริ่มผิด boundary หรือสิ้นสุดก่อนครบ
  รอบ. Master sheet ใช้เดือนของวันสิ้นรอบ; ชีตรายสัปดาห์และสีทั้งสี่ชุดสร้างจาก profile เดิมโดย
  ไม่ต้องให้บัญชีอนุมัติชื่อ/สีใหม่ทุกเดือน. รอบกรกฎาคมที่ยืนยันคือ `2026-06-29..2026-07-26`
  พร้อมชีต `07`, `29.06-05.07`, `06-12.07`, `13-19.07`, `20-26.07`; รอบถัดไปคือ
  `2026-07-27..2026-08-23` พร้อม master `08`.

  เพิ่ม read-only endpoint `GET /api/app/shopee/accounting-cycle` ซึ่งคำนวณ checkpoint จาก
  `transformSummary.periodEnd` ของ Shopee records ใน `processing_records` ที่มีอยู่แล้ว โดยเลือก
  period end สูงสุด จึงไม่ถอยหลังเมื่อ re-upload ไฟล์เก่าและไม่ต้องเพิ่ม migration/table. หน้า
  Shopee upload แสดงรอบล่าสุด, ช่วงดาวน์โหลดถัดไปแบบ inclusive `00:00..23:59` ICT, ชื่อชีตทั้ง
  สี่ และ refresh checkpoint หลัง process สำเร็จ. หากยังไม่มี history จะแสดง anchor cycle ที่
  ตรวจแล้ว; หาก endpoint ผิดพลาด upload เดิมยังใช้งานได้และ notifier มี retry-safe error state.

  Date-basis decision: Order.all transformer จัดสัปดาห์ด้วย `เวลาที่ทำการสั่งซื้อสำเร็จ`
  (`order_completed_at`) ตาม contract เดือนมิถุนายน. วันรายได้เข้า/วัน settlement ไม่รับประกันว่า
  เป็นวันเดียวกันและไม่มี field ที่ยืนยันใน Order.all นี้ จึงไม่เดา/ไม่สร้าง automation เท็จ;
  notifier บอกให้บัญชีกระทบยอดกับ income report ก่อนปิดรอบ. การอ่าน checkpoint จำกัด 250 records
  และใช้ metadata เท่านั้น; หากในอนาคตมีมากกว่านี้โดยไม่มี record ใหม่กว่าภายในหน้าที่อ่าน ต้อง
  เปลี่ยนเป็น repository query แบบ aggregate/indexed.

  Workbook QA พบ typed date ในคอลัมน์ B แคบจน Excel/PDF แสดง `########`; แก้ให้ B กว้างเท่ากับ
  M ซึ่งใช้ number format เดียวกัน และเพิ่ม regression guard. สร้าง synthetic July workbook ผ่าน
  transformer จริง, เปิดด้วย Microsoft Excel และ export PDF เพื่อตรวจทุกหน้า: sheet order/date
  ranges/fills ถูกต้อง, B/M แสดง datetime ครบ, สูตร L ทุก data row เป็น `H-I-J-K`, ไม่พบ PII หรือ
  formula-error token. Frontend ตรวจ browser จริงทั้ง desktop, mobile light และ mobile dark;
  notifier ไม่ overflow และ dark cards อ่านได้. Mobile navbar เดิมยังมี horizontal overflow ที่
  390px ซึ่งเกิดก่อน Task 12 และไม่ได้แก้ใน task นี้. QA artifacts ชั่วคราวถูกลบแล้ว.

  ผลตรวจ: backend targeted cycle/workbook **22/22 ผ่าน**; backend full **305 ผ่าน/5 skip**;
  frontend **71/71 ผ่าน**; Vite production build ผ่าน (76 modules); `git diff --check` ทั้งสอง
  repo ผ่านโดยมีเพียง CRLF warnings. Backend full suite มี baseline warning เรื่อง
  `SC_OFFICIAL_SUPABASE_DATABASE_URL` แต่ไม่มี failure. ยังไม่ได้ stage, commit, push, deploy หรือ
  apply migration/database write ใด ๆ.

  **Explicit stage list — backend repo (Task 12 only):**
  `backend/src/modules/seamless/controllers/shopeeAccountingCycleController.js`,
  `backend/src/modules/seamless/routes/shopeeEmailRoutes.js`,
  `backend/src/modules/seamless/services/shopeeAccountingCycleStatusService.js`,
  `backend/src/modules/seamless/services/shopeeAccountingCycles.js`,
  `backend/src/modules/seamless/services/shopeeWorkbookTransform.js`,
  `backend/tests/seamless-shopee-workbook-transform.test.cjs`,
  `backend/tests/shopee-accounting-cycle-status.test.cjs`,
  `backend/tests/shopee-accounting-cycles.test.cjs`,
  `backend/tests/shopee-order-routes.test.cjs`.

  **Explicit stage list — frontend/docs repo (Task 12 only):**
  `client/src/components/ShopeeAccountingCycleNotice.jsx`,
  `client/src/pages/ShopeeUploadPage.jsx`, `client/src/services/api.js`,
  `client/src/styles/app.css`, `client/tests/api-service.test.mjs`,
  `client/tests/app-render.test.mjs`,
  `client/tests/shopee-accounting-cycle-notice.test.mjs`,
  `docs/20-frontend-work-review-ledger.md`.

  Explicitly exclude backend RX1011/report/integration/env-audit incident files and frontend
  `docs/07`, `docs/17`, `server/`, `print-agent/` dirty workstreams. ห้ามใช้ `git add -A`.

- **2026-08-25 — Task 13 concept backlog: Shopee ↔ POS product reconciliation
  (`TASK13-SHOPEE-POS-RECONCILIATION`) — Discovery only / intentionally deferred.** แนวคิดนี้
  เกิดจาก independent document comparison ระหว่าง Shopee finished workbook
  `ศิริชัย รายงานยอดขาย กรกฎาคม(1).xlsx` กับ POS sales PDF `_sc_frm_sql_smsalequatation.pdf`.
  Reviewer รายงานว่า 46 included lines มีจำนวนรวมตรงทั้งหมด แต่ชื่อ/รสสินค้าผิด 3 lines ในรอบ
  `29.06-05.07`: order `260626472PUVXU`, `260626463SWRQQ`, `26062645SKRA16` เป็น Vita-C
  รสองุ่นใน Excel แต่ POS PDF lines 4, 6, 7 เป็นรสสับปะรด รายการละ 6 ซอง. ผลรวมจึงย้าย
  องุ่น 18 ซองไปเป็นสับปะรด 18 ซองโดยยอดรวมไม่หาย. นี่เป็น evidence จาก reviewer ที่เจ้าของส่ง
  ต่อมา; Codex session นี้ยังไม่ได้ independently re-open/re-verify เอกสารสองไฟล์ดังกล่าว.

  เป้าหมายในอนาคตคือระบบ reconcile ที่เก็บ source truth สองฝั่งแยกกัน: “ลูกค้าสั่งอะไรใน
  Shopee” เทียบกับ “บริษัทบันทึก/จ่ายสินค้าอะไรใน POS” แล้วแสดง mismatch ก่อนปิดรอบ. ระบบห้าม
  silently rewrite เอกสารต้นทาง. ผู้มีสิทธิ์สามารถยืนยัน mismatch ที่ตั้งใจได้ แต่ต้องเลือก reason
  code และใส่เหตุผล เช่นสินค้าหมดจึงตกลงส่งสินค้าที่ดีกว่าโดยไม่ยกเลิก Shopee order; reconciliation
  ต้องเก็บทั้ง ordered product และ fulfilled/POS product ไว้ ไม่เปลี่ยน mismatch ให้ดูเหมือน match.

  Candidate product master คือ SC Drug database/API ที่ใช้งานผ่าน workspace
  `C:\Users\scgro\Desktop\FadaSoft-projects.code-workspace`. ก่อนออกแบบจริงต้อง inspect แบบ
  read-only ว่า workspace ชี้ไป repo/service ใด, API contract/auth/availability/identifier ที่เสถียร
  คืออะไร และมี SKU/หน่วย/pack-size/active-status/aliases ครบหรือไม่; ห้าม assume ว่าชื่อสินค้าเป็น
  primary key หรือว่า production API พร้อมเป็น dependency ของ reconciliation.

  **Proposed guardrails สำหรับ discovery/design:**

  1. สร้าง canonical product identity จาก stable SC Drug product ID/SKU และตาราง aliases แยก
     Shopee listing name/variant/SKU กับ POS item code/name; normalize Unicode, whitespace,
     punctuation และหน่วย แต่ต้องรักษารส/ขนาด/pack/strength เป็น identity attributes ห้าม fuzzy
     จน “องุ่น” กลายเป็น “สับปะรด”.
  2. แปลงจำนวนเป็น base unit ด้วย versioned conversion rule เช่น `24+1 ซอง × 1 = 25 ซอง`,
     `2 กระป๋อง × 2 = 4 กระป๋อง`, `3 bx × 1 = 3 กล่อง`; เก็บ raw value และ normalized value
     พร้อม rule/version ที่ใช้ เพื่อ re-run และ audit ได้.
  3. Matching ต้อง deterministic ก่อน: external order/reference ID (ถ้า POS มี), canonical product,
     variant, normalized quantity และ accounting cycle. Fuzzy matching ใช้เสนอ candidate ให้คน
     เลือกเท่านั้น ห้าม auto-approve. หาก POS ไม่มี Shopee order number ต้องลด confidence และ
     แยกให้ชัดว่าเป็น aggregate reconciliation ไม่ใช่ per-order proof.
  4. Result states ขั้นต่ำ: `matched`, `product_mismatch`, `quantity_mismatch`, `unmapped_product`,
     `ambiguous`, `excluded_order_status`, `authorized_substitution`, `resolved_data_error`.
  5. Override ต้องจำกัด role (admin/accounting ตาม policy ที่จะยืนยัน), require reason code + note,
     เก็บ actor/time/source record IDs/source file hashes/before-after values/mapping version และ
     append-only history. การ re-run ห้ามลบ override เดิม และต้อง flag เมื่อ source หรือ mapping
     version เปลี่ยนจน decision เดิมอาจไม่ตรง.
  6. Import/sync ต้อง idempotent และรักษา raw snapshot; ป้องกัน duplicate cycle/file, partial parse,
     stale mapping, concurrent reconciliation และการนำ cancelled/unpaid/in-transit line มารวมผิด.
     Buyer/recipient PII ไม่จำเป็นต่อ product reconciliation และต้องไม่ถูก copy เข้า API/UI/audit.
  7. UI ควรสรุป matched/mismatch/unmapped totals, drill down ถึงหลักฐานสองฝั่ง, แสดง confidence/
     pack conversion และมี explicit “ยืนยันดำเนินการพร้อมเหตุผล”; ห้ามใช้สีอย่างเดียวสื่อสถานะ.
  8. ก่อน implementation ต้องตอบ open questions: POS มี Shopee order ID หรือ key เชื่อมระดับบิล
     หรือไม่, PDF เป็น source หลักหรือมี structured API/export, SC Drug ID เชื่อม POS code ได้ตรง
     หรือไม่, ใครมีสิทธิ์ approve, reason taxonomy/หลักฐานขั้นต่ำ/รอบแก้ไขย้อนหลังคืออะไร และ
     accounting ต้องการ reconcile ต่อ order, ต่อ line หรือยอดรวมต่อรอบ.

  **Recommended phased delivery หลังระบบพื้นฐานเสร็จ:** Phase 0 read-only discovery + data
  contract + manually verified fixture; Phase 1 offline deterministic reconciliation report ไม่มี
  override; Phase 2 persisted results/product mappings + audited override workflow; Phase 3 optional
  SC Drug live lookup/cache และ operational monitoring. ทุก phase ต้องมี golden fixtures ที่รวม
  mismatch สาม order ข้างต้น, pack conversion, legitimate substitution, duplicate/re-upload,
  excluded statuses และ adversarial near-name products.

  สถานะปัจจุบัน: **idea recorded only**. ยังไม่อนุมัติ implementation, database migration,
  SC Drug API call, การแก้ POS/Shopee data, stage, commit, push หรือ deploy. Senior Dev ถูกขอให้
  review จุดบอด/architecture ก่อน แล้วส่ง findings และคำถามที่ต้องให้เจ้าของหรือบัญชียืนยัน.

- **2026-08-25 — Task 12 senior review round 1: Request changes.** Reviewer independently
  reproduced 2 blocking defects แม้ suite เดิมผ่าน: **High** — transformer ใช้ `orderDate` ตัด
  cycle membership แล้วค่อยใช้ `completedAt` แบ่งสัปดาห์ ทำให้ออเดอร์ที่สร้างก่อนรอบแต่สำเร็จใน
  รอบตกหล่น และออเดอร์ที่สร้างในรอบแต่สำเร็จรอบถัดไปทำให้ allocation fail. Repro คือ order
  `2026-06-28 23:50` / completed `2026-06-29 00:05` ถูกตัดออก และ order
  `2026-07-26 23:50` / completed `2026-07-27 00:05` ทำให้ทั้งไฟล์ fail. Reviewer ยังชี้ว่า UI
  ที่บอกให้ดาวน์โหลด exact cycle อาจทำรายการค้างหลุดถ้า Shopee filter ใช้ order-created date.
  **Medium** — status service เลือก max `periodEnd` จึงข้าม gap ได้ เช่น June + August แต่ขาด
  July แล้วแนะนำ September. Residual notes: zero-row success ปิดรอบเท็จได้, query จำกัด 250
  records และ refresh failure ยังแสดง payload เก่า. Verdict: ห้าม stage/commit/deploy จนแก้.

  Reviewer run: backend targeted **35/35**, regression ไม่แตะ dirty integration **260 ผ่าน/5
  skip**, frontend **71/71**, Vite build 76 modules และ browser QA ผ่าน; ไม่ได้แก้หรือเรียก
  production. ตัวเลขนี้เป็นผลที่ reviewer รายงาน ไม่ใช่ผล run ของ coordinator.

  **Coordinator remediation round 1 — Ready for senior review round 2.** Cycle membership และ
  weekly allocation ใช้ parsed `completedAt` ตัวเดียวกันแล้ว; `orderDate` เหลือเป็น typed output
  field เท่านั้น. Completed ก่อนรอบ/หลังรอบถูก exclude เป็น
  `completedBeforeCycleExcluded`/`completedAfterCycleExcluded` โดยหลังรอบคง alias
  `carryoverExcluded` และไม่ทำให้ allocation fail. Boundary repro สองกรณีถูกตรึงด้วย regression
  tests; zero-row output ยังสร้าง workbook ได้แต่ metadata เป็น
  `cycleClosureStatus: review_required_empty` และ `checkpointEligible: false` จึงไม่ปิดรอบจนกว่า
  จะมีไฟล์ valid ที่มีรายการ. Valid re-upload ของ cycle เดียวกันล้าง empty warning ได้.

  เพื่อรองรับ order-date overlap, cycle ไม่ได้ derive จาก filename start อีกต่อไป แต่เลือก cycle
  ล่าสุดที่ filename end ครอบคลุมครบ แล้ว require ว่า source start ต้องไม่ช้ากว่า cycle start.
  ดังนั้น export ที่เริ่มย้อนหลังยังเลือก cycle ได้ deterministic. Public API แยก accounting
  completion window ออกจาก download guidance: preferred filter คือ `order_completed_at` ช่วง
  exact cycle; fallback เมื่อ Shopee ให้กรองเฉพาะ `order_created_at` คือย้อนหลังขั้นต่ำ 28 วัน
  และ UI เตือนชัดว่าไม่ guaranteed — ต้องรวม pending orders ที่เก่ากว่านั้นด้วยถ้ามี. ไม่ได้ claim
  ว่ายืนยัน Shopee filter field จริงแล้ว.

  Checkpoint เปลี่ยนเป็น highest cycle ที่ **ต่อเนื่องจาก anchor**. API คืน `hasGaps`,
  `missingCycles`, `futureCompletedCycles` และ `unconfirmedEmptyCycles`; June + August จะค้างที่
  June, `nextCycle` เป็น July และแสดง August ว่าเป็น future file ที่ยังไม่เลื่อน checkpoint.
  เพิ่ม DB query `SELECT DISTINCT` เฉพาะ transform-summary fields โดยไม่มี history-page limit
  จึงเอาข้อจำกัด 250 records ออกโดยไม่เพิ่ม migration. Frontend แสดง gap/empty warning,
  เปลี่ยน label จาก “ช่วงที่ต้องดาวน์โหลด” เป็น accounting cycle + download strategy และล้าง/
  ซ่อน stale payload เมื่อ refresh error. Date-color key เปลี่ยนมาอ่าน UTC fields ให้ตรงกับ
  wall-clock serialization และไม่เปลี่ยนวันตาม timezone ของ runner.

  ผลตรวจ coordinator หลัง remediation: backend targeted cycle/routes/workbook/query **43/43
  ผ่าน**; backend full **314 ผ่าน/5 skip**; frontend **74/74 ผ่าน**; Vite production build ผ่าน
  (76 modules). Browser QA ด้วย mocked read-only session/bootstrap/status ผ่านที่ desktop 1440px,
  mobile 390px light และ mobile 390px dark: gap, overlap guidance และ four-week cards อ่านครบ,
  panel ไม่ overflow; navbar mobile overflow เดิมยังอยู่นอก scope. Browser artifacts ถูกลบแล้ว.
  Backend full ยังมี baseline warning เรื่อง `SC_OFFICIAL_SUPABASE_DATABASE_URL` และ mocked
  webhook/operation logs แต่ไม่มี failure. ไม่มี production DB/API call และไม่มี migration.

  **Revised explicit stage list — backend Task 12 only:**
  `backend/src/modules/seamless/controllers/shopeeAccountingCycleController.js`,
  `backend/src/modules/seamless/processingRecords.js`,
  `backend/src/modules/seamless/routes/shopeeEmailRoutes.js`,
  `backend/src/modules/seamless/services/shopeeAccountingCycleStatusService.js`,
  `backend/src/modules/seamless/services/shopeeAccountingCycles.js`,
  `backend/src/modules/seamless/services/shopeeWorkbookTransform.js`,
  `backend/tests/processing-records-cycle-summaries.test.cjs`,
  `backend/tests/seamless-shopee-workbook-transform.test.cjs`,
  `backend/tests/shopee-accounting-cycle-status.test.cjs`,
  `backend/tests/shopee-accounting-cycles.test.cjs`,
  `backend/tests/shopee-order-routes.test.cjs`.

  **Revised explicit stage list — frontend/docs Task 12 only:**
  `client/src/components/ShopeeAccountingCycleNotice.jsx`,
  `client/src/pages/ShopeeUploadPage.jsx`, `client/src/services/api.js`,
  `client/src/styles/app.css`, `client/tests/api-service.test.mjs`,
  `client/tests/app-render.test.mjs`,
  `client/tests/shopee-accounting-cycle-notice.test.mjs`,
  `docs/20-frontend-work-review-ledger.md`.

  Explicitly exclude backend RX1011/report/integration/env-audit incident files and frontend
  `docs/07`, `docs/17`, `server/`, `print-agent/`. ยังไม่ได้ stage, commit, push หรือ deploy;
  ห้ามใช้ `git add -A`. Remaining business gate: เจ้าของ/บัญชียังต้องยืนยันว่า Shopee export UI
  กรองด้วย completion date ได้หรือใช้ order-created date เท่านั้น; จนยืนยัน ให้ทำตาม fallback
  overlap และตรวจ pending orders เก่ากว่า 28 วันทุกครั้ง.

- **2026-08-25 — Task 12 senior review round 2: Approve with non-blocking notes.** Reviewer
  ยืนยันว่า blocking defects ทั้งสองข้อแก้ครบและไม่พบ confirmed defect ใหม่; อนุมัติ explicit
  stage/commit/push และ remote CI แต่ยังไม่อนุมัติ production deploy จนกว่าจะยืนยัน business gate
  ว่า Shopee export กรองด้วย completion date ได้หรือไม่. หากกรองได้เฉพาะ order-created date ต้อง
  ใช้ lookback และรวม pending orders ที่เก่ากว่า 28 วันตามคำเตือนใน UI. Reviewer แนะนำเพิ่ม smoke
  ของ distinct-summary query ด้วย PostgreSQL จริงเป็น non-blocking hardening.

  Coordinator ปิด non-blocking SQL note โดยเพิ่ม
  `backend/tests/shopee-accounting-cycle-postgres.integration.test.cjs` เข้า Jest suite ที่ workflow
  `backend-ci.yml` รันอยู่แล้ว; ไม่สร้างหรือแก้ workflow เพิ่ม. Test มี fail-safe gate บังคับ
  `SEAMLESS_MIGRATION_SMOKE=1`, schema ลงท้าย `_ci` และ database host เป็น local เท่านั้น จากนั้น
  truncate เฉพาะ ephemeral transaction, insert duplicate/empty/excluded fixtures, เรียก repository
  query จริงและ rollback. Local CI simulation ใช้ PostgreSQL 18 ชั่วคราว, apply migrations ทั้ง 9
  ไฟล์ และ integration test **1/1 ผ่าน**; server ถูกหยุดและ data directory ถูกลบแล้ว. Backend full
  แบบไม่มี smoke env **314 ผ่าน/6 skip** (เพิ่ม 1 intentional skip สำหรับ real-PostgreSQL test),
  frontend **74/74 ผ่าน** และ Vite production build ผ่าน 76 modules.

  **Final backend stage list เพิ่มจากรอบอนุมัติเพียงไฟล์ hardening นี้:**
  `backend/tests/shopee-accounting-cycle-postgres.integration.test.cjs`. ไฟล์ Task 12 อื่นใช้ revised
  explicit stage list ข้างต้นเหมือนเดิม. Feature branch ทั้งสอง repo คือ
  `feat/shopee-accounting-cycles`; production deploy ยังคง blocked ที่ Shopee export-filter business
  gate และยังไม่มี production DB/API call.
