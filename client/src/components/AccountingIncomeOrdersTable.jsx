import { useEffect, useState } from "react";
import {
  getAccountingIncomeOrdersPreview,
  getAccountingIncomeOrdersBundle,
  listAccountingIncomeOrders,
} from "../services/api.js";
import AccountingIncomeExportPreview from "./AccountingIncomeExportPreview.jsx";

export const PAGE_SIZE = 10;
export const SHOP_LABELS = Object.freeze({
  "dr-morepen": "DR.Morepen",
  "sc-drug-store": "SC Drug Store",
});
export const SELLER_BALANCE_STATUS = Object.freeze({
  amount_mismatch: { label: "พบข้อมูลแต่ยอดไม่ตรง", tone: "warning" },
  credited: { label: "เงินเข้าแล้ว", tone: "success" },
  not_covered: { label: "ยังไม่มีรายงานครอบคลุม", tone: "neutral" },
  not_found_in_covered_report: { label: "รายงานครอบคลุม แต่ไม่พบ", tone: "warning" },
  outflow_or_reversed: { label: "มีเงินออกหรือย้อนรายการ", tone: "error" },
});
const DATE_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Bangkok",
  year: "numeric",
});
const MONEY_FORMATTER = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

export function formatIncomeDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "-";
  return DATE_FORMATTER.format(new Date(`${value}T00:00:00+07:00`));
}

export function formatIncomeAmount(value) {
  return Number.isFinite(Number(value)) ? MONEY_FORMATTER.format(Number(value)) : "-";
}

export function formatIncomeShop(shopCode) {
  return SHOP_LABELS[shopCode] || "ไม่ทราบร้าน";
}

export function SellerBalanceStatusBadge({ status }) {
  const presentation = SELLER_BALANCE_STATUS[status]
    || { label: "ไม่ทราบสถานะ", tone: "neutral" };
  return (
    <span className="accounting-balance-status" data-state={presentation.tone}>
      {presentation.label}
    </span>
  );
}

export default function AccountingIncomeOrdersTable() {
  const [filters, setFilters] = useState({
    dateColumn: "transferredAt",
    dateFrom: "",
    dateTo: "",
    orderNumber: "",
    shopCode: "",
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({
    orders: [],
    page: 1,
    totalCount: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [message, setMessage] = useState("");
  const invalidRange = filters.dateFrom && filters.dateTo
    && filters.dateFrom > filters.dateTo;
  const exportReady = filters.dateColumn === "transferredAt"
    && filters.dateFrom
    && filters.dateTo
    && !invalidRange;

  useEffect(() => {
    if (invalidRange) {
      setLoading(false);
      setMessage("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setMessage("");
      listAccountingIncomeOrders({ ...filters, page, pageSize: PAGE_SIZE })
        .then((payload) => {
          if (!cancelled) setResult(payload);
        })
        .catch((error) => {
          if (!cancelled) setMessage(error.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, filters.orderNumber ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    filters.dateColumn,
    filters.dateFrom,
    filters.dateTo,
    filters.orderNumber,
    filters.shopCode,
    invalidRange,
    page,
  ]);

  function updateFilter(name, value) {
    setPage(1);
    setPreview(null);
    setResult({ orders: [], page: 1, totalCount: 0, totalPages: 1 });
    setFilters((previous) => ({ ...previous, [name]: value }));
  }

  async function openPreview() {
    if (!exportReady || previewLoading) return;
    setPreviewLoading(true);
    setMessage("กำลังเตรียมตัวอย่างเอกสาร...");
    try {
      const payload = await getAccountingIncomeOrdersPreview(filters);
      setPreview(payload);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function downloadBundle() {
    if (!preview || exportLoading) return;
    setExportLoading(true);
    setMessage("กำลังสร้างชุดเอกสารสำหรับบัญชี...");
    try {
      const exported = await getAccountingIncomeOrdersBundle(preview.filters);
      const url = URL.createObjectURL(exported.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exported.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("สร้างชุดเอกสาร ZIP เรียบร้อยแล้ว");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setExportLoading(false);
    }
  }

  function printPreview() {
    if (preview) window.print();
  }

  return (
    <section className="panel accounting-bundle-panel accounting-income-panel">
      <div className="accounting-income-heading">
        <div>
          <h2>รายการรายรับจาก Income</h2>
          <p className="panel-copy">
            รวมข้อมูลจากไฟล์ Income ที่อัปโหลด โดยวันที่อ้างอิงเขตเวลา Asia/Bangkok
          </p>
          <p className="accounting-income-evidence-note">
            สถานะ Seller Balance ยืนยันว่าเงินของออเดอร์เข้าหรือเคลื่อนไหวในยอดคงเหลือร้านแล้ว
            ไม่ใช่หลักฐานการชำระของลูกค้าโดยตรง ซึ่งต้องตรวจจากรายงาน Order All
          </p>
        </div>
        <div className="accounting-income-actions">
          <button
            type="button"
            className="secondary accounting-income-export"
            disabled={!exportReady || previewLoading}
            onClick={openPreview}
          >
            {previewLoading ? "กำลังเตรียมตัวอย่าง..." : "ดูตัวอย่างก่อนดาวน์โหลดหรือพิมพ์"}
          </button>
          <span className="accounting-income-count">
            {result.totalCount.toLocaleString("th-TH")} รายการ
          </span>
        </div>
      </div>

      <div className="accounting-income-filters" role="search">
        <label className="field accounting-income-search">
          <span>ค้นหาเลขคำสั่งซื้อ</span>
          <input
            type="search"
            value={filters.orderNumber}
            maxLength={40}
            autoComplete="off"
            placeholder="เช่น 260829JNKSJXFW"
            onChange={(event) => updateFilter("orderNumber", event.target.value)}
          />
        </label>
        <label className="field">
          <span>ร้าน</span>
          <select
            value={filters.shopCode}
            onChange={(event) => updateFilter("shopCode", event.target.value)}
          >
            <option value="">ทุกร้าน</option>
            <option value="sc-drug-store">SC Drug Store</option>
            <option value="dr-morepen">DR.Morepen</option>
          </select>
        </label>
        <label className="field">
          <span>คอลัมน์วันที่ที่ต้องการหา</span>
          <select
            value={filters.dateColumn}
            onChange={(event) => updateFilter("dateColumn", event.target.value)}
          >
            <option value="orderedAt">วันที่ทำการสั่งซื้อ</option>
            <option value="transferredAt">วันที่โอนชำระเงิน</option>
          </select>
        </label>
        <label className="field">
          <span>จากวันที่</span>
          <input
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(event) => updateFilter("dateFrom", event.target.value)}
          />
        </label>
        <label className="field">
          <span>ถึงวันที่</span>
          <input
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(event) => updateFilter("dateTo", event.target.value)}
          />
        </label>
      </div>

      <p className="accounting-income-export-note">
        เอกสารสำหรับบัญชีใช้ช่วง “วันที่โอนชำระเงินสำเร็จ” เท่านั้น เลือกร้านและช่วงวันที่ให้ครบแล้วกดดูตัวอย่าง
        ระบบจะยังไม่ดาวน์โหลดไฟล์จนกว่าจะกด “ดาวน์โหลด Excel” ภายในหน้าพรีวิว
      </p>

      <p className="accounting-warning accounting-income-message" role="status" aria-live="polite">
        {message}
      </p>
      <div className="accounting-income-table-wrap">
        <table className="accounting-income-table">
          <colgroup>
            <col /><col /><col /><col /><col /><col /><col />
            <col className="accounting-income-balance-net-col" />
          </colgroup>
          <thead>
            <tr>
              <th>หมายเลขคำสั่งซื้อ</th>
              <th>ร้าน</th>
              <th>วันที่ทำการสั่งซื้อ</th>
              <th>วันที่โอนชำระเงิน</th>
              <th>จำนวนเงินทั้งหมด</th>
              <th>สถานะ Seller Balance</th>
              <th>วันที่เงินเข้า Seller Balance</th>
              <th className="accounting-income-balance-net-heading">ยอดสุทธิ Seller Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading && !result.orders.length && (
              <tr><td colSpan="8" className="accounting-income-empty">กำลังโหลดข้อมูล...</td></tr>
            )}
            {!loading && !result.orders.length && !message && (
              <tr><td colSpan="8" className="accounting-income-empty">ไม่พบรายการตามเงื่อนไข</td></tr>
            )}
            {result.orders.map((order, index) => (
              <tr key={`${order.orderNumber}-${order.transferDate}-${order.amount}-${index}`}>
                <td data-label="หมายเลขคำสั่งซื้อ" className="accounting-income-order-number">
                  {order.orderNumber}
                </td>
                <td data-label="ร้าน">{formatIncomeShop(order.shopCode)}</td>
                <td data-label="วันที่ทำการสั่งซื้อ">{formatIncomeDate(order.orderDate)}</td>
                <td data-label="วันที่โอนชำระเงิน">{formatIncomeDate(order.transferDate)}</td>
                <td data-label="จำนวนเงินทั้งหมด" className="accounting-income-amount">
                  {formatIncomeAmount(order.amount)}
                </td>
                <td data-label="สถานะ Seller Balance">
                  <SellerBalanceStatusBadge status={order.sellerBalanceStatus} />
                </td>
                <td data-label="วันที่เงินเข้า Seller Balance">
                  {formatIncomeDate(order.sellerBalanceInflowDate)}
                </td>
                <td data-label="ยอดสุทธิ Seller Balance" className="accounting-income-amount">
                  {order.sellerBalanceNetAmount === null
                    || order.sellerBalanceNetAmount === undefined
                    ? "-"
                    : formatIncomeAmount(order.sellerBalanceNetAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="accounting-income-pagination" aria-label="หน้ารายการ Income">
        <button
          type="button"
          className="secondary"
          disabled={loading || page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          ก่อนหน้า
        </button>
        <span>หน้า {result.page || page} จาก {result.totalPages || 1}</span>
        <button
          type="button"
          className="secondary"
          disabled={loading || page >= result.totalPages}
          onClick={() => setPage((current) => current + 1)}
        >
          ถัดไป
        </button>
      </nav>
      <AccountingIncomeExportPreview
        downloadLoading={exportLoading}
        onClose={() => setPreview(null)}
        onDownload={downloadBundle}
        onPrint={printPreview}
        preview={preview}
      />
    </section>
  );
}
