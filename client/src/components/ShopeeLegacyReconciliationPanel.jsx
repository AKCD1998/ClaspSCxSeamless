import { useEffect, useState } from 'react';
import {
  applyShopeeLegacyTimeline,
  getSession,
  getShopeeLegacyApplyPlan,
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
const PRODUCT_EVIDENCE_LABELS = {
  product_match: 'สินค้าทุกรายการตรงกับร้านเดียว',
  product_partial: 'สินค้าบางรายการตรงกับร้านเดียว',
  product_conflict: 'ข้อมูลสินค้าตรงมากกว่าหนึ่งร้าน',
  product_unknown: 'ยังจับคู่สินค้ากับ catalog ไม่ได้',
};
const MAILBOX_EVIDENCE_LABELS = {
  mailbox_match: 'พบจากกล่องอีเมลของร้านเดียว',
  mailbox_conflict: 'พบอีเมลจากทั้งสองร้าน — ต้องตรวจเอง',
  mailbox_unknown: 'ระบุร้านจากกล่องที่ sync ไม่ได้',
};

export function ShopeeLegacyReconciliationView({
  applyPlan,
  applyStatus,
  error,
  isApplying,
  isLoading,
  nextCursor,
  onLoadMore,
  onApply,
  onRefresh,
  onReview,
  onSelectionChange,
  onStatusChange,
  orders,
  savingOrderNumber,
  selections,
  status,
}) {
  const automaticOrderCount = orders.filter((order) => (
    order.evidence?.classification?.status === 'auto_classified'
  )).length;
  const manualOrderCount = orders.length - automaticOrderCount;

  return (
    <section className="card shopee-legacy-review" aria-labelledby="legacy-review-heading">
      <div className="shopee-legacy-review__heading">
        <div>
          <p className="eyebrow">ADMIN REVIEW · CONTROLLED APPLY</p>
          <h2 id="legacy-review-heading">ตรวจร้านของข้อมูล Shopee เก่า</h2>
          <p>
            ถ้าพบอีเมลจากกล่องของร้านเดียวและหลักฐานไม่ขัดกัน ระบบจะจัดร้านให้อัตโนมัติ
            เฉพาะรายการที่ไม่ชัดเจนเท่านั้นที่ต้องเลือกเอง โดยไม่แสดงหัวเรื่อง เนื้อหาเมล Gmail ID หรือข้อมูลผู้ซื้อ
            เมื่อหลักฐานครบทุกแถว ผู้ดูแลสามารถนำข้อมูลเข้า Timeline ด้วยแผนล่าสุดได้ในครั้งเดียว
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

      <section className="shopee-legacy-review__apply" aria-label="นำข้อมูลเก่าเข้า Timeline">
        <div>
          <strong>นำข้อมูลที่ยืนยันแล้วเข้า Timeline</strong>
          {applyPlan ? (
            <small>
              พร้อม {applyPlan.automaticCount + applyPlan.reviewedCount} รายการ
              {' · '}ต้องตรวจเอง {applyPlan.manualReviewRequiredCount} รายการ
              {' · '}สร้างใหม่ {applyPlan.targetNewOrderCount || 0} รายการ
              {' · '}รวมกับเดิม {applyPlan.targetExistingOrderCount || 0} รายการ
            </small>
          ) : <small>กำลังตรวจแผนแบบ read-only...</small>}
          {applyStatus?.message ? (
            <p className="status" data-state={applyStatus.state}>{applyStatus.message}</p>
          ) : null}
        </div>
        {applyPlan?.legacyOrderCount ? (
          <button
            className="button"
            disabled={isApplying || !applyPlan.readyToApply}
            onClick={onApply}
            type="button"
          >
            {isApplying ? 'กำลังนำเข้า Timeline...' : `นำ ${applyPlan.legacyOrderCount} รายการเข้า Timeline`}
          </button>
        ) : (
          <span className="shopee-legacy-review__automatic-note">ไม่มีข้อมูลเก่ารอนำเข้า</span>
        )}
      </section>

      {error ? <p className="status" data-state="error">{error}</p> : null}
      {isLoading && !orders.length ? <p className="status" data-state="working">กำลังตรวจ routing metadata...</p> : null}
      {!isLoading && !orders.length && !error ? (
        <p className="status" data-state="success">ไม่มีรายการในสถานะนี้</p>
      ) : null}

      {orders.length ? (
        <p className="shopee-legacy-review__summary">
          ชุดที่โหลดแล้ว: จัดให้อัตโนมัติ {automaticOrderCount} รายการ · ต้องตรวจเอง {manualOrderCount} รายการ
        </p>
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
                <th>หลักฐานแนะนำร้าน</th>
                <th>เลือกร้าน</th>
                <th>บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const evidence = order.evidence || {};
                const classification = evidence.classification || {};
                const mailboxEvidence = evidence.mailboxEvidence || {};
                const productEvidence = evidence.productEvidence || {};
                const suggested = evidence.suggestedShopCode;
                const selected = selections[order.orderNumber] || '';
                const isSaving = savingOrderNumber === order.orderNumber;
                const isAutomatic = classification.status === 'auto_classified';
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
                      <span
                        className="shopee-legacy-review__mailbox-evidence"
                        data-evidence={mailboxEvidence.evidenceStatus}
                      >
                        {MAILBOX_EVIDENCE_LABELS[mailboxEvidence.evidenceStatus] || 'ยังไม่มีหลักฐานจากกล่องที่ sync'}
                      </span>
                      <small>
                        ตรวจกล่องที่ sync ได้ {mailboxEvidence.matchedEventCount || 0}/{mailboxEvidence.totalEventCount || order.eventCount || 0} อีเมล
                      </small>
                      <span
                        className="shopee-legacy-review__product-evidence"
                        data-evidence={productEvidence.evidenceStatus}
                      >
                        {PRODUCT_EVIDENCE_LABELS[productEvidence.evidenceStatus] || 'ยังไม่มีหลักฐานสินค้า'}
                      </span>
                      {(productEvidence.items || []).slice(0, 3).map((item, index) => {
                        const recognized = (item.matches || []).filter((match) => match.status !== 'unmapped');
                        return (
                          <small className="shopee-legacy-review__product" key={`${item.name}-${item.variant}-${index}`}>
                            {item.name || 'ไม่พบชื่อสินค้า'}{item.variant ? ` · ${item.variant}` : ''}
                            {recognized.length ? ` → ${recognized.map((match) => (
                              `${SHOP_LABELS[match.shopCode]}${match.companySku ? ` (${match.companySku})` : ''}`
                            )).join(', ')}` : ' → ยังไม่ตรง catalog'}
                          </small>
                        );
                      })}
                      {(productEvidence.items || []).length > 3 ? (
                        <small>และอีก {(productEvidence.items || []).length - 3} รายการ</small>
                      ) : null}
                      {evidence.recommendationStatus === 'evidence_conflict' ? (
                        <small className="shopee-legacy-review__conflict">
                          หลักฐานจากกล่อง ผู้รับ หรือสินค้าชี้คนละร้าน — ระบบไม่เลือกให้
                        </small>
                      ) : null}
                      {isAutomatic ? (
                        <span className="shopee-legacy-review__automatic" data-classification="auto_classified">
                          จัดร้านอัตโนมัติ: {SHOP_LABELS[classification.shopCode]}
                        </span>
                      ) : null}
                      {!isAutomatic && suggested ? <small>แนะนำ: {SHOP_LABELS[suggested]}</small> : null}
                    </td>
                    <td>
                      {isAutomatic ? (
                        <strong>{SHOP_LABELS[classification.shopCode]}</strong>
                      ) : (
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
                      )}
                    </td>
                    <td data-review-action={isAutomatic ? 'automatic' : 'manual'}>
                      {isAutomatic ? (
                        <span className="shopee-legacy-review__automatic-note">ไม่ต้องยืนยัน</span>
                      ) : (
                        <button
                          className="button secondary"
                          disabled={!selected || isSaving}
                          onClick={() => onReview(order.orderNumber)}
                          type="button"
                        >
                          {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเลือก'}
                        </button>
                      )}
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
  const [applyPlan, setApplyPlan] = useState(null);
  const [applyStatus, setApplyStatus] = useState({ message: '', state: 'success' });
  const [isApplying, setIsApplying] = useState(false);
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

  async function refreshApplyPlan() {
    const plan = await getShopeeLegacyApplyPlan();
    setApplyPlan(plan);
    return plan;
  }

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((session) => {
        if (cancelled || session?.role !== 'admin') return;
        setIsAdmin(true);
        loadPage({ reviewStatus: 'pending' });
        refreshApplyPlan().catch((planError) => {
          if (!cancelled) {
            setApplyStatus({
              message: planError?.message || 'ตรวจแผนนำเข้า Timeline ไม่สำเร็จ',
              state: 'error',
            });
          }
        });
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
      await Promise.all([
        loadPage({ reviewStatus: status }),
        refreshApplyPlan(),
      ]);
    } catch (reviewError) {
      setError(reviewError?.message || 'บันทึกการเลือกร้านไม่สำเร็จ');
    } finally {
      setSavingOrderNumber('');
    }
  }

  async function handleApply() {
    if (isApplying) return;
    setIsApplying(true);
    setApplyStatus({ message: 'กำลังตรวจแผนล่าสุด...', state: 'working' });
    try {
      const freshPlan = await refreshApplyPlan();
      if (!freshPlan?.readyToApply) {
        throw new Error('ยังมีรายการที่ต้องตรวจเอง จึงยังไม่นำข้อมูลเข้า Timeline');
      }
      const result = await applyShopeeLegacyTimeline(freshPlan.planDigest);
      setApplyStatus({
        message: `นำเข้า Timeline สำเร็จ ${result.orderCount || 0} รายการ (${result.eventCount || 0} เหตุการณ์)`,
        state: 'success',
      });
      await Promise.all([
        loadPage({ reviewStatus: status }),
        refreshApplyPlan(),
      ]);
    } catch (applyError) {
      setApplyStatus({
        message: applyError?.message || 'นำข้อมูลเก่าเข้า Timeline ไม่สำเร็จ',
        state: 'error',
      });
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <ShopeeLegacyReconciliationView
      applyPlan={applyPlan}
      applyStatus={applyStatus}
      error={error}
      isApplying={isApplying}
      isLoading={isLoading}
      nextCursor={nextCursor}
      onLoadMore={() => loadPage({ append: true, cursor: nextCursor })}
      onApply={handleApply}
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
