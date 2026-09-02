import {
  SHOPEE_CANCELLATION_REASON_LABELS,
  SHOPEE_ORDER_STATUS_LABELS,
  formatShopeeEmailReceivedAt,
  formatShopeeMoney,
  formatShopeeOrderDate,
} from './shopeeEmailLabels.js';

const STATUS_OPTIONS = Object.entries(SHOPEE_ORDER_STATUS_LABELS);
const SHOP_OPTIONS = [
  ['all', 'ทุกร้าน'],
  ['sc-drug-store', 'SC Drug Store'],
  ['dr-morepen', 'DR.Morepen'],
];
const SHOP_LABELS = Object.fromEntries(SHOP_OPTIONS);

export function getShopeePaginationItems(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const visible = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  if (currentPage <= 4) [2, 3, 4, 5].forEach((page) => visible.add(page));
  if (currentPage >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1]
      .forEach((page) => visible.add(page));
  }
  const pages = [...visible]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const items = [];
  pages.forEach((page, index) => {
    if (index && page - pages[index - 1] > 1) items.push(`ellipsis-${pages[index - 1]}`);
    items.push(page);
  });
  return items;
}

function StatusBadge({ status }) {
  return (
    <span className="shopee-email-category" data-category={status}>
      {SHOPEE_ORDER_STATUS_LABELS[status] || status || '-'}
    </span>
  );
}

export function formatShopeeProductMatch(productMatch) {
  if (productMatch?.status === 'matched') return productMatch.companySku || 'รอตรวจสอบ SKU';
  if (productMatch?.status === 'bundle') {
    const components = (productMatch.components || []).map((component) => (
      component.quantityPerSale
        ? `${component.companySku} ×${component.quantityPerSale}`
        : component.companySku
    ));
    return components.length ? components.join(' + ') : 'ชุดหลาย SKU';
  }
  if (productMatch?.status === 'visibility_only') return 'สินค้าเพิ่มการมองเห็น';
  if (productMatch?.status === 'unmapped') return 'รอตรวจสอบ SKU';
  return '-';
}

function ProductMatchBadge({ productMatch }) {
  if (!productMatch) return null;
  return (
    <span className="shopee-product-match" data-match-status={productMatch.status}>
      {formatShopeeProductMatch(productMatch)}
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
                <ProductMatchBadge productMatch={item.productMatch} />
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
  canSync,
  detailStatus,
  filters,
  isLoading,
  isSyncing,
  onFilterChange,
  onSearchChange,
  onPageChange,
  onRetry,
  onRetryDetail,
  onSyncLatest,
  onSyncOlder,
  onToggleDetail,
  orderDetail,
  orders,
  page,
  pageSize,
  selectedOrderKey,
  searchValue,
  status,
  syncCursor,
  syncStatus,
  totalCount,
  totalPages,
}) {
  const paginationItems = getShopeePaginationItems(page, totalPages);
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
            <button disabled={isSyncing || !canSync} onClick={onSyncLatest} type="button">
              {isSyncing ? 'กำลังซิงก์...' : 'ซิงก์อีเมลล่าสุด'}
            </button>
            {syncCursor ? (
              <button
                className="history-view-button secondary"
                disabled={isSyncing || !canSync}
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

      {appRole === 'admin' && !canSync ? (
        <p className="result-meta">เลือก SC Drug Store หรือ DR.Morepen เพื่อซิงก์ทีละร้าน</p>
      ) : null}

      <form className="history-filters shopee-order-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="history-filter-field shopee-order-search-field">
          <span>ค้นหาทั้งตาราง</span>
          <input
            aria-label="ค้นหาทั้งตาราง"
            autoComplete="off"
            maxLength="120"
            name="search"
            onChange={onSearchChange}
            placeholder="ค้นหาร้าน เลขคำสั่งซื้อ สถานะ สินค้า SKU ยอด หรือวันที่"
            type="search"
            value={searchValue}
          />
          <small className="shopee-order-search-hint">
            พิมพ์ได้เลย ระบบจะค้นหาอัตโนมัติจากทุกคอลัมน์และทุกหน้า
          </small>
        </label>
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
        <label className="history-filter-field">
          <span>เรียงตาม</span>
          <select name="sortBy" onChange={onFilterChange} value={filters.sortBy}>
            <option value="lastEventAt">วันที่อัปเดต</option>
            <option value="orderNumber">เลขคำสั่งซื้อ</option>
          </select>
        </label>
        <label className="history-filter-field">
          <span>ลำดับ</span>
          <select name="sortOrder" onChange={onFilterChange} value={filters.sortOrder}>
            <option value="desc">มากไปน้อย / ล่าสุดก่อน</option>
            <option value="asc">น้อยไปมาก / เก่าก่อน</option>
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
              <col className="shopee-order-col-shop" />
              <col className="shopee-order-col-number" />
              <col className="shopee-order-col-status" />
              <col className="shopee-order-col-item" />
              <col className="shopee-order-col-sku" />
              <col className="shopee-order-col-quantity" />
              <col className="shopee-order-col-total" />
              <col className="shopee-order-col-deadline" />
              <col className="shopee-order-col-updated" />
              <col className="shopee-order-col-detail" />
            </colgroup>
            <thead>
              <tr>
                <th>ร้าน</th>
                <th>เลขคำสั่งซื้อ</th>
                <th>สถานะล่าสุด</th>
                <th>สินค้า</th>
                <th>Company SKU</th>
                <th>จำนวน</th>
                <th>ยอดรวม</th>
                <th>กำหนดส่ง</th>
                <th>อัปเดตล่าสุด</th>
                <th>เหตุการณ์</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const orderKey = `${order.shopCode}:${order.orderNumber}`;
                const isOpen = selectedOrderKey === orderKey;
                return [
                  <tr key={orderKey}>
                    <td>{SHOP_LABELS[order.shopCode] || order.shopCode || '-'}</td>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td><StatusBadge status={order.currentStatus} /></td>
                    <td>{order.items?.[0]?.name || '-'}{order.itemCount > 1 ? ` +${order.itemCount - 1}` : ''}</td>
                    <td>{formatShopeeProductMatch(order.items?.[0]?.productMatch)}</td>
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
                    <tr className="shopee-order-detail-row" key={`${orderKey}-detail`}>
                      <td colSpan="10">
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
          {totalPages > 1 ? (
            <div className="history-dashboard-pagination shopee-order-pagination">
              <span className="shopee-order-pagination__summary">
                หน้า {page} จาก {totalPages} · {totalCount} รายการ · หน้าละ {pageSize}
              </span>
              <nav aria-label="เปลี่ยนหน้าคำสั่งซื้อ" className="shopee-order-pagination__pages">
                <button
                  aria-label="หน้าก่อนหน้า"
                  className="history-view-button secondary"
                  disabled={isLoading || page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  type="button"
                >
                  ก่อนหน้า
                </button>
                {paginationItems.map((item) => (
                  typeof item === 'number' ? (
                    <button
                      aria-current={item === page ? 'page' : undefined}
                      aria-label={item === page ? `หน้าปัจจุบัน ${item}` : `ไปหน้าที่ ${item}`}
                      className={`history-view-button secondary${item === page ? ' is-current' : ''}`}
                      disabled={isLoading || item === page}
                      key={item}
                      onClick={() => onPageChange(item)}
                      type="button"
                    >
                      {item}
                    </button>
                  ) : (
                    <span aria-hidden="true" className="shopee-order-pagination__ellipsis" key={item}>…</span>
                  )
                ))}
                <button
                  aria-label="หน้าถัดไป"
                  className="history-view-button secondary"
                  disabled={isLoading || page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                  type="button"
                >
                  ถัดไป
                </button>
              </nav>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="history-empty">
          {filters.search
            ? 'ไม่พบคำสั่งซื้อที่ตรงกับคำค้นหา'
            : 'ยังไม่มีไทม์ไลน์ตามสถานะที่เลือก'}
        </div>
      )}
    </section>
  );
}
