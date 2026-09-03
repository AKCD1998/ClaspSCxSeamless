import { useEffect, useState } from 'react';
import { getShopeeSalesSummary, getShopeeSalesSummaryExcel } from '../services/api.js';
import { formatShopeeMoney } from './shopeeEmailLabels.js';

const SHOP_OPTIONS = [
  ['all', 'ทุกร้าน'],
  ['sc-drug-store', 'SC Drug Store'],
  ['dr-morepen', 'DR.Morepen'],
];
const SHOP_LABELS = Object.fromEntries(SHOP_OPTIONS);

export function getBangkokTodayString(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatSalesOrderDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function SummaryMetric({ label, value }) {
  return (
    <div className="shopee-sales-summary-metric">
      <span>{label}</span>
      <strong>{new Intl.NumberFormat('th-TH').format(value || 0)}</strong>
    </div>
  );
}

export function ShopeeSalesSummaryView({
  filters,
  isExporting,
  isLoading,
  onExport,
  onFilterChange,
  onSubmit,
  onToggleProduct,
  openProductId,
  status,
  summary,
}) {
  const products = summary?.products || [];
  const hasBundleProducts = products.some((product) => product.isBundle === true);
  return (
    <section className="panel shopee-sales-summary-panel">
      <div className="shopee-order-heading">
        <div>
          <p className="panel-eyebrow">Shopee Product Sales Summary</p>
          <p className="panel-copy">
            สรุปตามวันที่สั่งซื้อ (เวลาไทย) และไม่นับออเดอร์ที่ยกเลิกหรือพัสดุตีกลับ
          </p>
        </div>
      </div>

      <form className="history-filters shopee-sales-summary-filters" onSubmit={onSubmit}>
        <label className="history-filter-field">
          <span>ร้าน Shopee</span>
          <select name="shopCode" onChange={onFilterChange} value={filters.shopCode}>
            {SHOP_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="history-filter-field">
          <span>วันที่เริ่มต้น</span>
          <input name="startDate" onChange={onFilterChange} required type="date" value={filters.startDate} />
        </label>
        <label className="history-filter-field">
          <span>วันที่สิ้นสุด</span>
          <input
            min={filters.startDate}
            name="endDate"
            onChange={onFilterChange}
            type="date"
            value={filters.endDate}
          />
        </label>
        <button disabled={isLoading || isExporting} type="submit">
          {isLoading ? 'กำลังสรุป...' : 'แสดงยอดขาย'}
        </button>
        <button
          className="secondary"
          disabled={isLoading || isExporting || !summary}
          onClick={onExport}
          type="button"
        >
          {isExporting ? 'กำลังสร้าง Excel...' : 'Export Excel'}
        </button>
      </form>
      <p className="shopee-sales-export-help">
        Excel จะแยกรายการที่พร้อมใช้กับโปรแกรมพิมพ์อัตโนมัติไว้ในชีต “พร้อมคีย์”
        และแยกรายการที่ยังต้องยืนยัน SKU หรือหน่วยฐานไว้ในชีต “ต้องตรวจสอบ”
      </p>

      <section className="status-panel history-status-panel" aria-live="polite">
        <p className="status" data-state={status.state}>{status.message}</p>
      </section>

      {summary ? (
        <>
          <div className="shopee-sales-summary-metrics">
            <SummaryMetric label="ชนิดสินค้า" value={summary.productCount} />
            <SummaryMetric label="จำนวนออเดอร์" value={summary.orderCount} />
            <SummaryMetric label="จำนวนหน่วยสินค้ารวม" value={summary.totalQuantity} />
          </div>

          {products.length ? (
            <>
              {hasBundleProducts ? (
                <div className="shopee-sales-bundle-legend" role="note">
                  <span aria-hidden="true" className="shopee-sales-bundle-legend__swatch" />
                  <span>
                    แถวพื้นหลังสีเหลืองคือ <strong>Bundle</strong> — ต้องแกะชุดสินค้าและหยิบตามจำนวนหน่วยที่ระบุ
                  </span>
                </div>
              ) : null}
              <div className="history-table-wrap shopee-sales-summary-table-wrap">
              <table className="history-table shopee-sales-summary-table">
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>ตัวเลือกสินค้า</th>
                    <th>Company SKU</th>
                    <th>จำนวนหน่วยสินค้า</th>
                    <th>ออเดอร์</th>
                    <th>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isOpen = openProductId === product.id;
                    const isBundle = product.isBundle === true;
                    const hasVerifiedBundleQuantity = isBundle
                      && product.quantityRuleStatus === 'verified'
                      && Number.isSafeInteger(product.unitsPerSale)
                      && product.unitsPerSale > 0;
                    const bundleLabel = hasVerifiedBundleQuantity
                      ? `BUNDLE · ต้องแกะ 1 ชุด = ${product.unitsPerSale} หน่วย`
                      : 'BUNDLE · รอตรวจสอบจำนวนต่อชุด';
                    return [
                      <tr
                        className={`shopee-sales-product-row${isBundle ? ' shopee-sales-product-row--bundle' : ''}`}
                        data-bundle={isBundle}
                        data-open={isOpen}
                        key={product.id}
                        onClick={() => onToggleProduct(product.id)}
                      >
                        <td>
                          <strong>{product.name}</strong>
                          {isBundle ? (
                            <span className="shopee-sales-bundle-badge">{bundleLabel}</span>
                          ) : null}
                        </td>
                        <td>{product.variant || '-'}</td>
                        <td>{product.companySkus?.length ? product.companySkus.join(', ') : '-'}</td>
                        <td className="shopee-sales-number">
                          {new Intl.NumberFormat('th-TH').format(product.totalQuantity)}
                          {hasVerifiedBundleQuantity ? (
                            <small>{`1 ชุด = ${product.unitsPerSale} หน่วย`}</small>
                          ) : isBundle ? <small>รอตรวจสอบจำนวนต่อชุด</small> : null}
                        </td>
                        <td>{new Intl.NumberFormat('th-TH').format(product.orderCount)}</td>
                        <td>
                          <button
                            aria-expanded={isOpen}
                            className="history-view-button secondary"
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleProduct(product.id);
                            }}
                            type="button"
                          >
                            {isOpen ? 'ปิด' : 'ดูออเดอร์'}
                          </button>
                        </td>
                      </tr>,
                      isOpen ? (
                        <tr
                          className={`shopee-sales-orders-row${isBundle ? ' shopee-sales-orders-row--bundle' : ''}`}
                          data-bundle={isBundle}
                          key={`${product.id}-orders`}
                        >
                          <td colSpan="6">
                            <div className="shopee-sales-orders-detail">
                              <h3>ออเดอร์ที่ขายสินค้านี้</h3>
                              <p className="shopee-sales-orders-help">
                                ค่าสินค้าของแต่ละออเดอร์สำหรับคีย์ขายและตัดสต๊อก โดยไม่รวมค่าจัดส่ง
                              </p>
                              <div className="history-table-wrap">
                                <table className="history-table shopee-sales-orders-table">
                                  <thead>
                                    <tr>
                                      <th>ร้าน</th>
                                      <th>เลขคำสั่งซื้อ</th>
                                      <th>จำนวนหน่วยสินค้า</th>
                                      <th>ค่าสินค้า</th>
                                      <th>วันที่ออเดอร์</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {product.orders.map((order) => (
                                      <tr
                                        className={isBundle ? 'shopee-sales-order-row--bundle' : undefined}
                                        data-bundle={isBundle}
                                        key={`${order.shopCode}:${order.orderNumber}`}
                                      >
                                        <td>{SHOP_LABELS[order.shopCode] || order.shopCode || '-'}</td>
                                        <td><strong>{order.orderNumber}</strong></td>
                                        <td>
                                          {new Intl.NumberFormat('th-TH').format(order.quantity)}
                                          {order.unitsPerSale > 1 ? (
                                            <small className="shopee-sales-quantity-note">
                                              {`${new Intl.NumberFormat('th-TH').format(order.listingQuantity)} ชุด × ${new Intl.NumberFormat('th-TH').format(order.unitsPerSale)}`}
                                            </small>
                                          ) : null}
                                        </td>
                                        <td className="shopee-sales-order-subtotal">
                                          {formatShopeeMoney(order.itemSubtotal)}
                                        </td>
                                        <td>{formatSalesOrderDate(order.orderedAt)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
              </div>
            </>
          ) : (
            <div className="history-empty">ไม่พบยอดขายในช่วงวันที่ที่เลือก</div>
          )}
        </>
      ) : null}
    </section>
  );
}

export default function ShopeeSalesSummaryPanel() {
  const today = getBangkokTodayString();
  const [filters, setFilters] = useState({ endDate: today, shopCode: 'all', startDate: today });
  const [summary, setSummary] = useState(null);
  const [openProductId, setOpenProductId] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState({ state: 'working', message: 'กำลังสรุปยอดขาย...' });

  async function loadSummary(nextFilters) {
    setIsLoading(true);
    setStatus({ state: 'working', message: 'กำลังสรุปยอดขาย...' });
    setOpenProductId('');
    try {
      const payload = await getShopeeSalesSummary(nextFilters);
      setSummary(payload);
      setStatus({
        state: 'success',
        message: `พบสินค้า ${payload.productCount || 0} รายการ จาก ${payload.orderCount || 0} ออเดอร์`,
      });
    } catch (error) {
      setSummary(null);
      setStatus({ state: 'error', message: error.message || 'โหลดสรุปยอดขายไม่สำเร็จ' });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSummary(filters);
    // Initial load intentionally uses today's Bangkok date captured for this mounted page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const endDate = filters.endDate || filters.startDate;
    if (endDate < filters.startDate) {
      setStatus({ state: 'error', message: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น' });
      return;
    }
    const effectiveFilters = { ...filters, endDate };
    setFilters(effectiveFilters);
    loadSummary(effectiveFilters);
  }

  async function handleExport() {
    const endDate = filters.endDate || filters.startDate;
    if (endDate < filters.startDate) {
      setStatus({ state: 'error', message: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น' });
      return;
    }

    setIsExporting(true);
    setStatus({ state: 'working', message: 'กำลังสร้างไฟล์ Excel สำหรับคีย์ข้อมูล...' });
    try {
      const exported = await getShopeeSalesSummaryExcel({ ...filters, endDate });
      const objectUrl = URL.createObjectURL(exported.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = exported.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setStatus({
        state: 'success',
        message: 'ดาวน์โหลด Excel แล้ว — ใช้ชีต “พร้อมคีย์” กับโปรแกรมพิมพ์อัตโนมัติ',
      });
    } catch (error) {
      setStatus({ state: 'error', message: error.message || 'สร้างไฟล์ Excel ไม่สำเร็จ' });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <ShopeeSalesSummaryView
      filters={filters}
      isExporting={isExporting}
      isLoading={isLoading}
      onExport={handleExport}
      onFilterChange={handleFilterChange}
      onSubmit={handleSubmit}
      onToggleProduct={(productId) => setOpenProductId((current) => (
        current === productId ? '' : productId
      ))}
      openProductId={openProductId}
      status={status}
      summary={summary}
    />
  );
}
