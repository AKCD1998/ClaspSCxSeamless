import { useEffect, useState } from "react";
import { listAccountingIncomeOrders } from "../services/api.js";

export const PAGE_SIZE = 10;
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

export default function AccountingIncomeOrdersTable() {
  const [filters, setFilters] = useState({
    dateColumn: "transferredAt",
    dateFrom: "",
    dateTo: "",
    orderNumber: "",
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({
    orders: [],
    page: 1,
    totalCount: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const invalidRange = filters.dateFrom && filters.dateTo
    && filters.dateFrom > filters.dateTo;

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
    invalidRange,
    page,
  ]);

  function updateFilter(name, value) {
    setPage(1);
    setResult({ orders: [], page: 1, totalCount: 0, totalPages: 1 });
    setFilters((previous) => ({ ...previous, [name]: value }));
  }

  return (
    <section className="panel accounting-bundle-panel accounting-income-panel">
      <div className="accounting-income-heading">
        <div>
          <h2>รายการรายรับจาก Income</h2>
          <p className="panel-copy">
            รวมข้อมูลจากไฟล์ Income ที่อัปโหลด โดยวันที่อ้างอิงเขตเวลา Asia/Bangkok
          </p>
        </div>
        <span className="accounting-income-count">
          {result.totalCount.toLocaleString("th-TH")} รายการ
        </span>
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

      <p className="accounting-warning accounting-income-message" role="status" aria-live="polite">
        {message}
      </p>
      <div className="accounting-income-table-wrap">
        <table className="accounting-income-table">
          <thead>
            <tr>
              <th>หมายเลขคำสั่งซื้อ</th>
              <th>วันที่ทำการสั่งซื้อ</th>
              <th>วันที่โอนชำระเงิน</th>
              <th>จำนวนเงินทั้งหมด</th>
            </tr>
          </thead>
          <tbody>
            {loading && !result.orders.length && (
              <tr><td colSpan="4" className="accounting-income-empty">กำลังโหลดข้อมูล...</td></tr>
            )}
            {!loading && !result.orders.length && !message && (
              <tr><td colSpan="4" className="accounting-income-empty">ไม่พบรายการตามเงื่อนไข</td></tr>
            )}
            {result.orders.map((order, index) => (
              <tr key={`${order.orderNumber}-${order.transferDate}-${order.amount}-${index}`}>
                <td data-label="หมายเลขคำสั่งซื้อ" className="accounting-income-order-number">
                  {order.orderNumber}
                </td>
                <td data-label="วันที่ทำการสั่งซื้อ">{formatIncomeDate(order.orderDate)}</td>
                <td data-label="วันที่โอนชำระเงิน">{formatIncomeDate(order.transferDate)}</td>
                <td data-label="จำนวนเงินทั้งหมด" className="accounting-income-amount">
                  {formatIncomeAmount(order.amount)}
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
    </section>
  );
}
