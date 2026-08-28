import { useEffect, useState } from 'react';
import {
  getSession,
  getShopeeLegacyReconciliations,
  reviewShopeeLegacyOrder,
} from '../services/api.js';
import {
  SHOPEE_ORDER_STATUS_LABELS,
  formatShopeeEmailReceivedAt,
} from './shopeeEmailLabels.js';
import './shopee-legacy-reconciliation.css';

const SHOP_OPTIONS = [
  ['sc-drug-store', 'SC Drug Store'],
  ['dr-morepen', 'DR.Morepen'],
];
const SHOP_LABELS = Object.fromEntries(SHOP_OPTIONS);
const EVIDENCE_LABELS = {
  recipient_match: 'พบผู้รับเดิมตรงกับร้าน',
  recipient_conflict: 'ผู้รับเดิมขัดแย้งกัน — ต้องตัดสินใจเอง',
  recipient_unknown: 'ระบุร้านจากผู้รับเดิมไม่ได้',
  message_not_found: 'อีเมลต้นทางไม่อยู่ใน Gmail แล้ว',
  metadata_unavailable: 'อ่าน routing metadata ไม่สำเร็จ',
};

export function ShopeeLegacyReconciliationView({
  error,
  isLoading,
  nextCursor,
  onLoadMore,
  onRefresh,
  onReview,
  onSelectionChange,
  onStatusChange,
  orders,
  savingOrderNumber,
  selections,
  status,
}) {
  return (
    <section className="card shopee-legacy-review" aria-labelledby="legacy-review-heading">
      <div className="shopee-legacy-review__heading">
        <div>
          <p className="eyebrow">ADMIN REVIEW · REVIEW-ONLY</p>
          <h2 id="legacy-review-heading">ตรวจร้านของข้อมูล Shopee เก่า</h2>
          <p>
            ระบบเสนอร้านจาก From/To metadata เท่านั้น ไม่อ่านหรือแสดงหัวเรื่อง เนื้อหาเมล
            Gmail ID หรือข้อมูลผู้ซื้อ การบันทึกหน้านี้ยังไม่ย้าย legacy rows
          </p>
        </div>
        <button className="button secondary" disabled={isLoading} onClick={onRefresh} type="button">
          โหลดใหม่
        </button>
      </div>

      <label className="shopee-legacy-review__filter">
        สถานะการตรวจ
        <select name="legacyReviewStatus" onChange={onStatusChange} value={status}>
          <option value="pending">รอตรวจ</option>
          <option value="reviewed">ตรวจแล้ว</option>
          <option value="all">ทั้งหมด</option>
        </select>
      </label>

      {error ? <p className="status" data-state="error">{error}</p> : null}
      {isLoading && !orders.length ? <p className="status" data-state="working">กำลังตรวจ routing metadata...</p> : null}
      {!isLoading && !orders.length && !error ? (
        <p className="status" data-state="success">ไม่มีรายการในสถานะนี้</p>
      ) : null}

      {orders.length ? (
        <div className="table-scroll">
          <table className="shopee-legacy-review__table">
            <thead>
              <tr>
                <th>เลขคำสั่งซื้อ</th>
                <th>สถานะเดิม</th>
                <th>อีเมลเหตุการณ์</th>
                <th>อัปเดตล่าสุด</th>
                <th>หลักฐานผู้รับเดิม</th>
                <th>เลือกร้าน</th>
                <th>บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const evidence = order.evidence || {};
                const suggested = evidence.suggestedShopCode;
                const selected = selections[order.orderNumber] || '';
                const isSaving = savingOrderNumber === order.orderNumber;
                return (
                  <tr key={order.orderNumber}>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td>{SHOPEE_ORDER_STATUS_LABELS[order.currentStatus] || order.currentStatus}</td>
                    <td>{order.eventCount || 0}</td>
                    <td>{formatShopeeEmailReceivedAt(order.lastEventAt)}</td>
                    <td>
                      <span className="shopee-legacy-review__evidence" data-evidence={evidence.evidenceStatus}>
                        {EVIDENCE_LABELS[evidence.evidenceStatus] || 'ยังไม่มีหลักฐาน'}
                      </span>
                      <small>
                        ยืนยันผู้รับเดิม {evidence.matchedEventCount || 0}/{evidence.totalEventCount || order.eventCount || 0} อีเมล
                      </small>
                      {suggested ? <small>แนะนำ: {SHOP_LABELS[suggested]}</small> : null}
                    </td>
                    <td>
                      <select
                        aria-label={`เลือกร้านสำหรับ ${order.orderNumber}`}
                        onChange={(event) => onSelectionChange(order.orderNumber, event.target.value)}
                        value={selected}
                      >
                        <option value="">เลือก...</option>
                        {SHOP_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        className="button secondary"
                        disabled={!selected || isSaving}
                        onClick={() => onReview(order.orderNumber)}
                        type="button"
                      >
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเลือก'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {nextCursor ? (
        <button className="button secondary shopee-legacy-review__more" disabled={isLoading} onClick={onLoadMore} type="button">
          {isLoading ? 'กำลังโหลด...' : 'โหลดรายการเก่าเพิ่ม'}
        </button>
      ) : null}
    </section>
  );
}

export default function ShopeeLegacyReconciliationPanel() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [status, setStatus] = useState('pending');
  const [selections, setSelections] = useState({});
  const [savingOrderNumber, setSavingOrderNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadPage({ append = false, cursor = null, reviewStatus = status } = {}) {
    setIsLoading(true);
    setError('');
    try {
      const response = await getShopeeLegacyReconciliations({
        cursor,
        limit: 10,
        status: reviewStatus,
      });
      const incoming = response?.orders || [];
      setOrders((current) => (append ? [...current, ...incoming] : incoming));
      setNextCursor(response?.nextCursor || null);
      setSelections((current) => {
        const next = { ...current };
        incoming.forEach((order) => {
          next[order.orderNumber] = order.decision?.selectedShopCode
            || order.evidence?.suggestedShopCode
            || '';
        });
        return next;
      });
    } catch (loadError) {
      setError(loadError?.message || 'โหลดรายการ legacy ไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        if (cancelled || session?.role !== 'admin') return;
        setIsAdmin(true);
        loadPage({ reviewStatus: 'pending' });
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAdmin) return null;

  async function handleReview(orderNumber) {
    const shopCode = selections[orderNumber];
    if (!shopCode || savingOrderNumber) return;
    setSavingOrderNumber(orderNumber);
    setError('');
    try {
      await reviewShopeeLegacyOrder(orderNumber, shopCode);
      await loadPage({ reviewStatus: status });
    } catch (reviewError) {
      setError(reviewError?.message || 'บันทึกการเลือกร้านไม่สำเร็จ');
    } finally {
      setSavingOrderNumber('');
    }
  }

  return (
    <ShopeeLegacyReconciliationView
      error={error}
      isLoading={isLoading}
      nextCursor={nextCursor}
      onLoadMore={() => loadPage({ append: true, cursor: nextCursor })}
      onRefresh={() => loadPage({ reviewStatus: status })}
      onReview={handleReview}
      onSelectionChange={(orderNumber, shopCode) => setSelections((current) => ({
        ...current,
        [orderNumber]: shopCode,
      }))}
      onStatusChange={(event) => {
        const nextStatus = event.target.value;
        setStatus(nextStatus);
        setOrders([]);
        setNextCursor(null);
        loadPage({ reviewStatus: nextStatus });
      }}
      orders={orders}
      savingOrderNumber={savingOrderNumber}
      selections={selections}
      status={status}
    />
  );
}
