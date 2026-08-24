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
