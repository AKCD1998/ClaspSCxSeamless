import {
  SHOPEE_EMAIL_CATEGORY_LABELS,
  formatShopeeEmailReceivedAt,
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

export default function ShopeeEmailInboxView({
  emails,
  filters,
  isLoading,
  isLoadingMore,
  nextCursor,
  onFilterChange,
  onLoadMore,
  onRetry,
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
