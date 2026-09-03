import {
  SHOPEE_EMAIL_CATEGORY_LABELS,
  formatShopeeEmailReceivedAt,
  formatShopeeOrderDate,
} from './shopeeEmailLabels.js';

const FILTERABLE_CATEGORIES = Object.entries(SHOPEE_EMAIL_CATEGORY_LABELS).filter(
  ([value]) => value !== 'other',
);
const SHOP_OPTIONS = [
  ['all', 'ทั้งหมด'],
  ['sc-drug-store', 'SC Drug Store'],
  ['dr-morepen', 'DR.Morepen'],
];
const SHOP_LABELS = Object.fromEntries(SHOP_OPTIONS);

const SELLER_CENTRE_TASKS = [
  {
    href: 'https://seller.shopee.co.th/portal/shipment',
    label: 'ที่ต้องจัดส่ง',
    reason: 'อีเมลบอกยอดงานค้างปัจจุบันไม่ได้',
  },
  {
    href: 'https://seller.shopee.co.th/portal/shipment',
    label: 'เตรียมจัดส่งแล้ว',
    reason: 'ไม่มีอีเมลเมื่อร้านเปลี่ยนเป็นสถานะนี้',
  },
  {
    href: 'https://seller.shopee.co.th/portal/sale/returnrefundcancel',
    label: 'คำขอคืนเงิน/คืนสินค้า/ยกเลิก',
    reason: 'อีเมลไม่ครอบคลุมคิวปัจจุบันทั้งหมด',
  },
  {
    href: 'https://seller.shopee.co.th/portal/product/list/banned/action',
    label: 'สินค้าที่ละเมิดนโยบาย',
    reason: 'ยังไม่มีข้อมูลสถานะปัจจุบันจากอีเมล',
  },
  {
    href: 'https://seller.shopee.co.th/portal/marketing/realtime-bidding/list',
    label: 'เข้าร่วมแคมเปญเสนอราคา',
    reason: 'ยังไม่มีข้อมูลสถานะปัจจุบันจากอีเมล',
  },
];

const EMAIL_ACTIVITY_METRICS = [
  { key: 'ordersToday', label: 'ออเดอร์ที่พบวันนี้' },
  { key: 'shipmentDueToday', label: 'ออเดอร์ที่ได้รับอีเมลแจ้งจัดส่ง' },
  { key: 'confirmedCodToday', label: 'ออเดอร์ที่ได้รับอีเมลยืนยัน COD' },
  { key: 'cancelledToday', label: 'ออเดอร์ที่ได้รับอีเมลยกเลิก' },
  { key: 'returnedToday', label: 'ออเดอร์ที่ได้รับอีเมลตีกลับ' },
];

function ShopeeInboxOperationsOverview({
  isLoading,
  onRetry,
  overview,
  shopCode,
  status,
}) {
  const numberFormatter = new Intl.NumberFormat('th-TH');
  const shopLabel = shopCode === 'all' ? 'ทุกร้าน' : SHOP_LABELS[shopCode] || shopCode;
  return (
    <section
      aria-busy={isLoading}
      aria-labelledby="shopee-inbox-overview-title"
      className="shopee-inbox-overview"
    >
      <div className="shopee-inbox-overview__heading">
        <div>
          <h3 id="shopee-inbox-overview-title">งานที่ต้องทำใน Shopee Seller Centre</h3>
          <p>
            {overview?.date ? formatShopeeOrderDate(overview.date) : 'วันนี้'}
            {' · '}
            {shopLabel}
          </p>
        </div>
        <span className="shopee-inbox-overview__source">สถานะจริงอยู่ใน Seller Centre</span>
      </div>

      <p className="shopee-inbox-overview__scope-note">
        {shopCode === 'all'
          ? 'กรุณาเปิดตรวจแยกบัญชี SC Drug Store และ DR.Morepen'
          : `กรุณาตรวจว่า Seller Centre อยู่ในบัญชี ${shopLabel}`}
      </p>

      <div className="shopee-inbox-overview__tasks">
        {SELLER_CENTRE_TASKS.map((task) => (
          <a
            className="shopee-inbox-overview__task"
            href={task.href}
            key={task.label}
            rel="noreferrer"
            target="_blank"
          >
            <strong aria-label={`${task.label}: ไม่มีตัวเลขที่ยืนยันได้จากอีเมล`}>—</strong>
            <span>{task.label}</span>
            <small>{task.reason}</small>
            <em>เปิดดูใน Seller Centre ↗</em>
          </a>
        ))}
      </div>

      <div className="shopee-inbox-overview__email-summary">
        <div className="shopee-inbox-overview__email-heading">
          <div>
            <h4>ข้อมูลประกอบจากอีเมลวันนี้</h4>
            <p>เป็นจำนวนเหตุการณ์รายวัน ไม่ใช่ยอดงานค้างใน Seller Centre</p>
          </div>
          <span>จากอีเมลที่เข้า Timeline</span>
        </div>

        {status?.state === 'error' ? (
          <div className="shopee-inbox-overview__error">
            <p className="status" data-state="error">{status.message}</p>
            <button className="history-view-button secondary" onClick={onRetry} type="button">
              ลองใหม่
            </button>
          </div>
        ) : (
          <dl className="shopee-inbox-overview__email-metrics">
            {EMAIL_ACTIVITY_METRICS.map((metric) => (
              <div key={metric.key}>
                <dt>{metric.label}</dt>
                <dd>{isLoading ? '…' : numberFormatter.format(overview?.[metric.key] || 0)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="shopee-inbox-overview__footer">
        <span>
          Timeline อัปเดตล่าสุด: {overview?.lastUpdatedAt
            ? formatShopeeEmailReceivedAt(overview.lastUpdatedAt)
            : isLoading ? 'กำลังตรวจสอบ...' : '-'}
        </span>
        <span>การ์ดงานด้านบนตั้งใจเว้นตัวเลขไว้จนกว่าจะเชื่อมข้อมูลสถานะจาก Shopee</span>
      </div>
    </section>
  );
}

export default function ShopeeEmailInboxView({
  emails,
  filters,
  isLoading,
  isLoadingMore,
  nextCursor,
  onFilterChange,
  onLoadMore,
  onRetry,
  onRetryOverview,
  overview,
  overviewStatus,
  source,
  status,
}) {
  return (
    <section className="panel">
      <p className="panel-eyebrow">Shopee Email Inbox</p>
      <p className="panel-copy">
        รายการอีเมลที่ดึงสดจาก Gmail เฉพาะผู้ส่ง {source || 'info@mail.shopee.co.th'}
        {' '}— อ่านอย่างเดียว ระบบจะไม่เปลี่ยนสถานะอีเมลใน Gmail
      </p>

      <form className="history-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="history-filter-field">
          <span>ร้าน Shopee</span>
          <select name="shopCode" onChange={onFilterChange} value={filters.shopCode}>
            {SHOP_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="history-filter-field">
          <span>ประเภทอีเมล</span>
          <select name="category" onChange={onFilterChange} value={filters.category}>
            <option value="">ทั้งหมด</option>
            {FILTERABLE_CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="history-filter-field">
          <span>ได้รับจากวันที่</span>
          <input
            name="receivedFrom"
            onChange={onFilterChange}
            type="date"
            value={filters.receivedFrom || ''}
          />
        </label>
        <label className="history-filter-field">
          <span>ถึงวันที่</span>
          <input
            name="receivedTo"
            onChange={onFilterChange}
            type="date"
            value={filters.receivedTo || ''}
          />
        </label>
      </form>

      <ShopeeInboxOperationsOverview
        isLoading={overviewStatus?.state === 'working'}
        onRetry={onRetryOverview}
        overview={overview}
        shopCode={filters.shopCode}
        status={overviewStatus}
      />

      <section className="status-panel history-status-panel" aria-live="polite">
        <p className="status" data-state={status.state}>
          {status.message}
        </p>
        {status.state === 'error' ? (
          <button className="history-view-button secondary" onClick={onRetry} type="button">
            ลองใหม่
          </button>
        ) : null}
      </section>

      {isLoading ? (
        <div className="history-empty">กำลังโหลด...</div>
      ) : emails.length ? (
        <div className="history-table-wrap">
          <table className="history-table shopee-email-table">
            <colgroup>
              <col className="shopee-email-col-shop" />
              <col className="shopee-email-col-received" />
              <col className="shopee-email-col-category" />
              <col className="shopee-email-col-order" />
              <col className="shopee-email-col-subject" />
              <col className="shopee-email-col-from" />
              <col className="shopee-email-col-state" />
            </colgroup>
            <thead>
              <tr>
                <th>ร้าน</th>
                <th>ได้รับเมื่อ</th>
                <th>ประเภท</th>
                <th>เลขคำสั่งซื้อ</th>
                <th>หัวเรื่อง</th>
                <th>ผู้ส่ง</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={`${email.shopCode || filters.shopCode}:${email.id}`}>
                  <td>{SHOP_LABELS[email.shopCode || filters.shopCode] || '-'}</td>
                  <td>{formatShopeeEmailReceivedAt(email.receivedAt)}</td>
                  <td>
                    <span className="shopee-email-category" data-category={email.category}>
                      {SHOPEE_EMAIL_CATEGORY_LABELS[email.category] || email.category}
                    </span>
                  </td>
                  <td>{email.orderNumber || '-'}</td>
                  <td>{email.subject || '-'}</td>
                  <td>{email.from || '-'}</td>
                  <td>
                    <span
                      className="history-summary-pill"
                      data-kind={email.unread ? 'missing' : 'available'}
                    >
                      {email.unread ? 'ยังไม่อ่าน' : 'อ่านแล้ว'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="history-empty">ไม่พบอีเมล Shopee ตามเงื่อนไขที่เลือก</div>
      )}
      {!isLoading && nextCursor ? (
        <div className="history-dashboard-pagination">
          <button
            className="history-view-button secondary"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            type="button"
          >
            {isLoadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
