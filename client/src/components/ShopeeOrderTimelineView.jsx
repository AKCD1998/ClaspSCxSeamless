import {
  SHOPEE_CANCELLATION_REASON_LABELS,
  SHOPEE_ORDER_STATUS_LABELS,
  formatShopeeEmailReceivedAt,
  formatShopeeMoney,
  formatShopeeOrderDate,
} from './shopeeEmailLabels.js';

const STATUS_OPTIONS = Object.entries(SHOPEE_ORDER_STATUS_LABELS);
const SHOP_OPTIONS = [
  ['sc-drug-store', 'SC Drug Store'],
  ['dr-morepen', 'DR.Morepen'],
];

function StatusBadge({ status }) {
  return (
    <span className="shopee-email-category" data-category={status}>
      {SHOPEE_ORDER_STATUS_LABELS[status] || status || '-'}
    </span>
  );
}

function ShopeeOrderDetail({ detail, detailStatus, onRetry }) {
  if (detailStatus.state === 'working') {
    return <div className="shopee-order-detail-state">กำลังโหลดรายละเอียด...</div>;
  }
  if (detailStatus.state === 'error') {
    return (
      <div className="shopee-order-detail-state">
        <p className="status" data-state="error">{detailStatus.message}</p>
        <button className="history-view-button secondary" onClick={onRetry} type="button">
          ลองใหม่
        </button>
      </div>
    );
  }
  if (!detail?.order) return null;

  const { order, events = [] } = detail;
  return (
    <div className="shopee-order-detail">
      <section className="shopee-order-detail-card">
        <h3>สินค้าและยอดชำระ</h3>
        {order.items?.length ? (
          <ol className="shopee-order-items">
            {order.items.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                <strong>{item.name}</strong>
                {item.variant ? <span>ตัวเลือก: {item.variant}</span> : null}
                <span>จำนวน {item.quantity || 0} × {formatShopeeMoney(item.unitPrice)}</span>
              </li>
            ))}
          </ol>
        ) : <p className="result-meta">อีเมลเหตุการณ์นี้ไม่มีรายละเอียดสินค้า</p>}
        <dl className="shopee-order-amounts">
          <div><dt>ค่าสินค้า</dt><dd>{formatShopeeMoney(order.itemSubtotal)}</dd></div>
          <div><dt>ค่าจัดส่ง</dt><dd>{formatShopeeMoney(order.shippingFee)}</dd></div>
          <div><dt>ยอดรวม</dt><dd>{formatShopeeMoney(order.totalAmount)}</dd></div>
        </dl>
      </section>

      <section className="shopee-order-detail-card">
        <h3>เหตุการณ์ตามลำดับเวลา</h3>
        <ol className="shopee-order-timeline">
          {events.map((event) => (
            <li key={event.id}>
              <span className="shopee-order-timeline-dot" aria-hidden="true" />
              <div>
                <StatusBadge status={event.eventType} />
                <p>{formatShopeeEmailReceivedAt(event.occurredAt)}</p>
                {event.details?.shippingDeadline ? (
                  <p>กำหนดส่งถึงลูกค้า: {formatShopeeOrderDate(event.details.shippingDeadline)}</p>
                ) : null}
                {event.details?.cancellationReasonCode ? (
                  <p>เหตุผล: {SHOPEE_CANCELLATION_REASON_LABELS[event.details.cancellationReasonCode] || 'ไม่ได้ระบุ'}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default function ShopeeOrderTimelineView({
  appRole,
  detailStatus,
  filters,
  isLoading,
  isLoadingMore,
  isSyncing,
  nextCursor,
  onFilterChange,
  onLoadMore,
  onRetry,
  onRetryDetail,
  onSyncLatest,
  onSyncOlder,
  onToggleDetail,
  orderDetail,
  orders,
  selectedOrderNumber,
  status,
  syncCursor,
  syncStatus,
}) {
  return (
    <section className="panel">
      <div className="shopee-order-heading">
        <div>
          <p className="panel-eyebrow">Shopee Order Timeline</p>
          <p className="panel-copy">
            แยกข้อมูลด้วยร้านและเลขคำสั่งซื้อ พร้อมกันอีเมลซ้ำข้ามกล่องด้วย canonical hash — ไม่เก็บหัวเรื่อง เนื้อหาอีเมล หรือข้อมูลผู้ซื้อ
          </p>
        </div>
        {appRole === 'admin' ? (
          <div className="shopee-order-sync-actions">
            <button disabled={isSyncing || !filters.shopCode} onClick={onSyncLatest} type="button">
              {isSyncing ? 'กำลังซิงก์...' : 'ซิงก์อีเมลล่าสุด'}
            </button>
            {syncCursor ? (
              <button
                className="history-view-button secondary"
                disabled={isSyncing || !filters.shopCode}
                onClick={onSyncOlder}
                type="button"
              >
                ซิงก์อีเมลหน้าก่อนหน้า
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {appRole === 'admin' && syncStatus.message ? (
        <p className="status shopee-order-sync-status" data-state={syncStatus.state} aria-live="polite">
          {syncStatus.message}
        </p>
      ) : null}

      <form className="history-filters shopee-order-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="history-filter-field">
          <span>ร้าน Shopee</span>
          <select name="shopCode" onChange={onFilterChange} value={filters.shopCode}>
            <option value="">เลือกร้าน</option>
            {SHOP_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="history-filter-field">
          <span>สถานะล่าสุด</span>
          <select name="status" onChange={onFilterChange} value={filters.status}>
            <option value="">ทั้งหมด</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </form>

      <section className="status-panel history-status-panel" aria-live="polite">
        <p className="status" data-state={status.state}>{status.message}</p>
        {status.state === 'error' ? (
          <button className="history-view-button secondary" onClick={onRetry} type="button">
            ลองใหม่
          </button>
        ) : null}
      </section>

      {isLoading ? (
        <div className="history-empty">กำลังโหลด...</div>
      ) : orders.length ? (
        <div className="history-table-wrap">
          <table className="history-table shopee-order-table">
            <colgroup>
              <col className="shopee-order-col-number" />
              <col className="shopee-order-col-status" />
              <col className="shopee-order-col-item" />
              <col className="shopee-order-col-quantity" />
              <col className="shopee-order-col-total" />
              <col className="shopee-order-col-deadline" />
              <col className="shopee-order-col-updated" />
              <col className="shopee-order-col-detail" />
            </colgroup>
            <thead>
              <tr>
                <th>เลขคำสั่งซื้อ</th>
                <th>สถานะล่าสุด</th>
                <th>สินค้า</th>
                <th>จำนวน</th>
                <th>ยอดรวม</th>
                <th>กำหนดส่ง</th>
                <th>อัปเดตล่าสุด</th>
                <th>เหตุการณ์</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const isOpen = selectedOrderNumber === order.orderNumber;
                return [
                  <tr key={order.orderNumber}>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td><StatusBadge status={order.currentStatus} /></td>
                    <td>{order.items?.[0]?.name || '-'}{order.itemCount > 1 ? ` +${order.itemCount - 1}` : ''}</td>
                    <td>{order.totalQuantity || 0}</td>
                    <td>{formatShopeeMoney(order.totalAmount)}</td>
                    <td>{formatShopeeOrderDate(order.shippingDeadline)}</td>
                    <td>{formatShopeeEmailReceivedAt(order.lastEventAt)}</td>
                    <td>
                      <button
                        aria-expanded={isOpen}
                        className="history-view-button secondary"
                        onClick={() => onToggleDetail(order)}
                        type="button"
                      >
                        {isOpen ? 'ปิด' : `ดู ${order.eventCount || 0}`}
                      </button>
                    </td>
                  </tr>,
                  isOpen ? (
                    <tr className="shopee-order-detail-row" key={`${order.orderNumber}-detail`}>
                      <td colSpan="8">
                        <ShopeeOrderDetail
                          detail={orderDetail}
                          detailStatus={detailStatus}
                          onRetry={onRetryDetail}
                        />
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
          {nextCursor ? (
            <div className="history-dashboard-pagination">
              <button
                className="history-view-button secondary"
                disabled={isLoadingMore}
                onClick={onLoadMore}
                type="button"
              >
                {isLoadingMore ? 'กำลังโหลด...' : 'โหลดคำสั่งซื้อเพิ่ม'}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="history-empty">ยังไม่มีไทม์ไลน์ตามสถานะที่เลือก</div>
      )}
    </section>
  );
}
