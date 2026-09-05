import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import {
  uploadAccountingOriginals,
  listAccountingPrintBatches,
  getAccountingPrintBatch,
  approveAccountingPrintBatch,
  resolveAccountingPrintBatch,
  accountingFileUrl,
} from "../services/api.js";

export const SHOPS = [
  { code: "sc-drug-store", name: "SC Drug Store" },
  { code: "dr-morepen", name: "DR.Morepen" },
];
export const STATUS = {
  preparing: "กำลังสร้างตัวอย่าง",
  pending: "รอสร้างตัวอย่าง",
  review: "พร้อมตรวจและอนุมัติ",
  ready: "ตัวอย่างพร้อมตรวจ",
  queued: "รอเริ่มพิมพ์",
  printing: "กำลังพิมพ์",
  submitted: "ส่งเข้าเครื่องพิมพ์แล้ว",
  paused: "หยุดรอตรวจสอบ",
  completed: "ออกจากคิวพิมพ์แล้ว",
  failed: "ดำเนินการไม่สำเร็จ",
  uncertain: "ส่งงานแล้ว ต้องตรวจผลที่เครื่อง",
  cancelled: "ยกเลิก",
};
export function validateOriginalFiles(shopFiles) {
  const files = Object.values(shopFiles).flat();
  if (!files.length) return "กรุณาเลือกไฟล์ต้นฉบับ";
  if (files.length > 100) return "เลือกได้ไม่เกิน 100 ไฟล์ต่อชุด";
  if (files.some((file) => !/\.(pdf|xlsx)$/i.test(file.name)))
    return "รองรับไฟล์ PDF และ Excel (.xlsx)";
  if (files.some((file) => file.size > 20 * 1024 * 1024))
    return "ไฟล์แต่ละฉบับต้องไม่เกิน 20 MB";
  if (files.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024)
    return "ชุดงานต้องไม่เกิน 100 MB";
  return "";
}
export function BatchDetails({
  batch,
  busy,
  onApprove,
  onResolve,
  readOnly = false,
}) {
  const [reviewed, setReviewed] = useState(false);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState("retry");
  const failed = batch.items.find((item) =>
    ["failed", "uncertain"].includes(item.status),
  );
  useEffect(() => {
    setReviewed(false);
  }, [batch.id, batch.digest]);
  return (
    <section className="panel accounting-bundle-panel">
      <h2>{batch.title}</h2>
      <p role="status">
        {STATUS[batch.status]} · {batch.items.length} ไฟล์ · {batch.totalPages}{" "}
        หน้าที่สร้างตัวอย่างแล้ว
      </p>
      <p>
        เครื่องพิมพ์ {batch.printerName} · เครื่องสาขา {batch.agentHost} · พิมพ์
        A4 หน้าเดียว 1 ชุด
      </p>
      <p>
        ออกจากคิวพิมพ์แล้ว {batch.completedCount}/{batch.items.length} ไฟล์
      </p>
      <p className="panel-copy">
        เรียงรายงานการเงิน → Seller Balance → รายละเอียดรายรับ → คำสั่งซื้อ
        ในแต่ละสัปดาห์ แล้วต่อร้านถัดไป
        ไฟล์คำสั่งซื้อยกมาพิมพ์ครั้งเดียวที่รอบแรกที่เกี่ยวข้อง
      </p>
      <div className="accounting-table-scroll">
        <table className="accounting-original-table">
          <caption>ลำดับเอกสารต้นฉบับในชุดงาน</caption>
          <thead>
            <tr>
              <th>ลำดับ</th>
              <th>ร้าน / รอบบัญชี</th>
              <th>เอกสาร</th>
              <th>หน้า</th>
              <th>สถานะ / เปิดไฟล์</th>
            </tr>
          </thead>
          <tbody>
            {batch.items.map((item) => (
              <tr key={item.id} data-status={item.status}>
                <td>{item.sequence}</td>
                <td>
                  <strong>{item.shop}</strong>
                  <br />
                  {item.periodStart}
                  <br />
                  ถึง {item.periodEnd}
                </td>
                <td>
                  {item.documentType}
                  {item.carryOver ? " (คำสั่งซื้อยกมา)" : ""}
                  <small>{item.filename}</small>
                  {item.carryOver && (
                    <small>
                      วันสร้างคำสั่งซื้อ {item.start} ถึง {item.end}
                    </small>
                  )}
                  {item.relatedPeriods?.length > 1 && (
                    <small>
                      ใช้ประกอบรอบรายรับ: {item.relatedPeriods.join(", ")}
                    </small>
                  )}
                  {item.warnings?.map((warning) => (
                    <small className="accounting-warning" key={warning}>
                      {warning}
                    </small>
                  ))}
                  {item.printLayout && (
                    <details>
                      <summary>รูปแบบพิมพ์ A4 แนวนอน · กว้าง 1 หน้า</summary>
                      {item.printLayout.columns && <p>คอลัมน์ที่พิมพ์: {item.printLayout.columns.join(" · ")}</p>}
                      {item.printLayout.omittedColumns?.length > 0 && <details>
                        <summary>คอลัมน์ Income ที่ไม่แสดงในฉบับพิมพ์</summary>
                        <ul>{item.printLayout.omittedColumns.map(column => (
                          <li key={column.column}>{column.column} {column.label || "(ไม่มีชื่อ)"}: {column.reason}</li>
                        ))}</ul>
                      </details>}
                    </details>
                  )}
                  {item.error && (
                    <small className="accounting-warning">{item.error}</small>
                  )}
                </td>
                <td>{item.pageCount ?? "รอ"}</td>
                <td>
                  {STATUS[item.status]}
                  <br />
                  <a
                    href={accountingFileUrl(item.originalUrl)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ต้นฉบับ
                  </a>
                  {item.previewUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={accountingFileUrl(item.previewUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ตัวอย่างที่จะพิมพ์
                      </a>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {batch.status === "review" && (
        <div className="accounting-approval">
          <p>
            ตรวจตัวอย่างทุกประเภทและคอลัมน์บัญชีที่เลือกไว้ ตาราง Excel เป็น A4
            แนวนอน กว้างหนึ่งหน้า และต่อหลายหน้าได้ตามจำนวนแถว
            ก่อนอนุมัติพิมพ์ {batch.totalPages} หน้า
          </p>
          <label>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            ฉันตรวจไฟล์ ร้านค้า รอบวันที่ ลำดับ และจำนวนหน้าแล้ว
          </label>
          <button
            disabled={readOnly || busy || !reviewed}
            onClick={() => onApprove(batch.digest)}
          >
            อนุมัติและสั่งพิมพ์ {batch.items.length} ไฟล์ / {batch.totalPages}{" "}
            หน้า พร้อมแจ้ง LINE
          </button>
        </div>
      )}
      {batch.status === "paused" && failed && (
        <div className="accounting-approval">
          <h3>
            หยุดที่ลำดับ {failed.sequence}: {failed.filename}
          </h3>
          <p>{batch.pauseReason}</p>
          {failed.status === "uncertain" && (
            <p>
              ไฟล์นี้อาจพิมพ์ไปแล้วบางส่วนหรือครบแล้ว
              กรุณาตรวจที่เครื่องและจัดการงานค้างก่อนทำต่อ
            </p>
          )}
          <label>
            ผลตรวจสอบ
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="retry">
                {failed.status === "uncertain"
                  ? "ตรวจแล้ว ต้องพิมพ์ไฟล์นี้ใหม่ทั้งฉบับ"
                  : "ลองไฟล์เดิมอีกครั้ง"}
              </option>
              {failed.status === "uncertain" && (
                <option value="confirm-printed">
                  ตรวจแล้ว กระดาษออกครบฉบับนี้ ให้ไปไฟล์ถัดไป
                </option>
              )}
            </select>
          </label>
          <label>
            รายละเอียดที่ตรวจแล้ว{" "}
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={600}
            />
          </label>
          <button
            disabled={readOnly || busy || !reason.trim()}
            onClick={() => onResolve({ itemId: failed.id, action, reason })}
          >
            บันทึกผลตรวจและทำต่อ
          </button>
        </div>
      )}
      <details className="accounting-line-history">
        <summary>การแจ้งเตือน LINE</summary>
        {readOnly && batch.localNotificationPreview && <div>
          <p>ตัวอย่างข้อความเท่านั้น ยังไม่ได้ส่งเข้า LINE</p>
          <pre>{batch.localNotificationPreview}</pre>
        </div>}
        {!batch.notifications.length && (
          <p>ยังไม่มีข้อความแจ้งเตือนของชุดนี้</p>
        )}
        {batch.notifications.map((notification) => (
          <div key={notification.event_key}>
            <p>
              {notification.sent_at
                ? "LINE รับข้อความแล้ว"
                : notification.last_error
                  ? "ส่งไม่สำเร็จ: " + notification.last_error
                  : "รอส่ง"}
            </p>
            <pre>{notification.message}</pre>
          </div>
        ))}
      </details>
      <p className="panel-copy">
        สถานะออกจากคิวอ้างอิง Windows
        กรุณาตรวจว่ากระดาษออกครบและอ่านได้ที่เครื่องพิมพ์
      </p>
    </section>
  );
}

export default function AccountingPrintBundlePage() {
  const [search, setSearch] = useSearchParams();
  const id = search.get("batch");
  const [shopFiles, setShopFiles] = useState({});
  const [batches, setBatches] = useState([]);
  const [batch, setBatch] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listAccountingPrintBatches()
      .then((result) => {
        if (!cancelled) {
          setBatches(result.batches);
          setCapabilities(result.capabilities);
        }
      })
      .catch((error) => {
        if (!cancelled) setMessage(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  useEffect(() => {
    if (!id) {
      setBatch(null);
      return;
    }
    setBatch(null);
    let cancelled = false;
    const refresh = () =>
      getAccountingPrintBatch(id)
        .then((result) => {
          if (!cancelled) setBatch(result);
        })
        .catch((error) => {
          if (!cancelled) setMessage(error.message);
        });
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);
  async function run(action) {
    setBusy(true);
    setMessage("");
    try {
      const result = await action();
      setBatch(result);
      setSearch({ batch: result.id });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(event) {
    event.preventDefault();
    const error = validateOriginalFiles(shopFiles);
    if (error) {
      setMessage(error);
      return;
    }
    await run(() => uploadAccountingOriginals(shopFiles));
  }
  return (
    <main className="shell shell-single-column accounting-bundle-shell">
      {capabilities?.localReviewOnly && (
        <section className="panel accounting-bundle-panel" role="status">
          <h2>โหมดตรวจในเครื่อง — ยังไม่ใช่ระบบจริง</h2>
          <p>
            เปิดดูรายการและไฟล์ได้ แต่หน้านี้ปิดการอัปโหลด สั่งพิมพ์ และส่ง LINE
            จริงไว้ ต้องเปิดคอมเครื่องนี้ไว้ระหว่างดูตัวอย่าง
          </p>
        </section>
      )}
      <Hero
        title="ชุดเอกสารบัญชี Shopee"
        intro="ส่งไฟล์ต้นฉบับแยกตามร้าน ระบบตรวจรอบและคำสั่งซื้อยกมา แล้วสร้างตัวอย่างให้ตรวจ โดยยังไม่สั่งปริ้นจนกว่าจะอนุมัติชุดงาน"
      />
      <section className="panel accounting-bundle-panel">
        <h2>เลือกไฟล์ต้นฉบับของแต่ละร้าน</h2>
        <p>
          เลือก PDF รายงานการเงิน และ Excel อีก 3 ประเภท
          รวมคำสั่งซื้อยกมาที่เกี่ยวข้อง ระบบรักษาไฟล์เดิมทุกฉบับ
          ฉบับพิมพ์คำสั่งซื้อใช้คอลัมน์ตามแบบบัญชีเดิม ส่วน Income เลือกคอลัมน์บัญชี
          โดยคงทุกรายการเงินที่มีค่าจริงและข้อมูลชีต Summary ครบ
        </p>
        <form onSubmit={upload}>
          <div className="accounting-shop-inputs">
            {SHOPS.map((shop) => (
              <label key={shop.code} className="field">
                <span>{shop.name}</span>
                <input
                  type="file"
                  accept=".pdf,.xlsx"
                  multiple
                  disabled={busy || capabilities?.localReviewOnly}
                  onChange={(event) =>
                    setShopFiles((previous) => ({
                      ...previous,
                      [shop.code]: Array.from(event.target.files || []),
                    }))
                  }
                />
                <small>
                  เลือกแล้ว {shopFiles[shop.code]?.length || 0} ไฟล์
                </small>
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={busy || capabilities?.localReviewOnly}
          >
            {busy ? "กำลังดำเนินการ..." : "ตรวจไฟล์และสร้างตัวอย่าง"}
          </button>
        </form>
        <p>
          เมื่อเปิดใช้ระบบจริงและอัปโหลดครบแล้ว ปิดคอมผู้ส่งได้
          เครื่องสาขาจะสร้างตัวอย่างและดูแลคิวต่อ
          การกดอนุมัติภายหลังจะเริ่มพิมพ์และแจ้ง LINE
        </p>
        {capabilities && (
          <p>
            ปลายทาง:{" "}
            {capabilities.printerName || "ยังไม่ได้ตั้งค่าเครื่องพิมพ์"} · LINE{" "}
            {capabilities.lineConfigured ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้งค่า"}
          </p>
        )}
        <p role="alert" className="accounting-warning">
          {message}
        </p>
        {batches.length > 0 && (
          <label className="field">
            เปิดชุดงานที่บันทึกไว้
            <select
              disabled={busy}
              value={id || ""}
              onChange={(event) =>
                setSearch(
                  event.target.value ? { batch: event.target.value } : {},
                )
              }
            >
              <option value="">เลือกชุดงาน</option>
              {batches.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title} — {STATUS[row.status]}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {batch && (
        <BatchDetails
          batch={batch}
          busy={busy}
          readOnly={capabilities?.localReviewOnly}
          onApprove={(digest) =>
            run(() => approveAccountingPrintBatch(batch.id, digest))
          }
          onResolve={(body) =>
            run(() => resolveAccountingPrintBatch(batch.id, body))
          }
        />
      )}
    </main>
  );
}
