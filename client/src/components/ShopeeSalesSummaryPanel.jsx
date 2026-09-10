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

export function formatShopeeReportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value || '')) return value || '-';
  return `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}`;
}

export function formatShopeeEvidenceTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
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

function financeStatusLabel(status) {
  if (status === 'source_backed') return 'ตรงกัน';
  if (status === 'mismatch') return 'ยอดหรือรายการไม่ตรงกัน';
  return 'เอกสารยังไม่ครบ';
}

function reconciliationStatusLabel(status) {
  if (status === 'reconciled') return 'ตรงกัน ส่วนต่าง ฿0.00';
  if (status === 'unresolved') return 'ยังมีส่วนต่างที่ต้องสืบย้อน';
  return 'หลักฐานยังไม่ครบ';
}

function ReconciliationAmount({ stage }) {
  if (!stage) return '-';
  return (
    <>
      <strong>{stage.officialAmount == null ? '-' : formatShopeeMoney(stage.officialAmount)}</strong>
      <small>จากรายออเดอร์: {stage.reconstructedAmount == null ? '-' : formatShopeeMoney(stage.reconstructedAmount)}</small>
      <small>ส่วนต่าง: {stage.variance == null ? '-' : formatShopeeMoney(stage.variance)}</small>
      <small>{stage.officialOrderCount ?? '-'} / {stage.reconstructedOrderCount ?? '-'} คำสั่งซื้อ</small>
    </>
  );
}

function EvidenceRefs({ evidence = [] }) {
  const unique = [...new Map(evidence.map((row) => [row.sourceSha256, row])).values()];
  if (!unique.length) return <small>ยังไม่มีหลักฐานไฟล์ต้นฉบับ</small>;
  return unique.map((row) => (
    <small key={row.sourceSha256} className="shopee-source-evidence">
      {row.sourceFilename} · SHA-256 <code title={row.sourceSha256}>{row.sourceSha256.slice(0, 12)}…</code>
      {' · '}{row.observedAt}
    </small>
  ));
}

function IncomeStateBridge({ label, state }) {
  if (!state?.factCount) return null;
  const bridge = state.componentBridge;
  const populated = (bridge?.components || []).filter((row) => row.amount != null && row.amount !== 0);
  return (
    <details className="shopee-income-bridge">
      <summary>{label}: {formatShopeeMoney(state.payoutAmount)} ({state.linkedOrderCount} คำสั่งซื้อ)</summary>
      <p>
        ผลรวมองค์ประกอบที่มีเครื่องหมาย: {bridge.additiveComponentTotal == null ? '-' : formatShopeeMoney(bridge.additiveComponentTotal)}
        {' · '}ส่วนที่ยังอธิบายไม่ได้: {bridge.unexplainedResidual == null ? '-' : formatShopeeMoney(bridge.unexplainedResidual)}
      </p>
      {populated.length ? (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead><tr><th>องค์ประกอบรายรับ</th><th>จำนวนเงิน</th><th>บทบาท</th></tr></thead>
            <tbody>{populated.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td>{formatShopeeMoney(row.amount)}</td>
                <td>{row.additive ? 'รวมในยอดโอน' : 'รายละเอียดเงินคืน (ไม่บวกซ้ำ)'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
      <EvidenceRefs evidence={bridge?.evidence} />
    </details>
  );
}

function PayoutAndDownstreamBridge({ shop }) {
  const latest = shop.payoutBridge?.income?.latestState;
  const downstream = shop.downstreamControls;
  if (!latest && !downstream) return null;
  return (
    <section className="shopee-payout-bridge" aria-label={`สะพานรายรับและเงินโอน ${SHOP_LABELS[shop.shopCode] || shop.shopCode}`}>
      <h4>{SHOP_LABELS[shop.shopCode] || shop.shopCode}: รายรับและเงินโอน</h4>
      <p>สถานะรอดำเนินการและโอนสำเร็จแสดงแยกกัน และยอดสถานะล่าสุดไม่นับคำสั่งซื้อเดิมซ้ำ</p>
      <IncomeStateBridge label="สถานะล่าสุด: รอดำเนินการ" state={latest?.pending} />
      <IncomeStateBridge label="สถานะล่าสุด: โอนสำเร็จ" state={latest?.transferred} />
      {downstream ? (
        <details>
          <summary>หลักฐานปลายทาง Financial Statement และ Seller Balance</summary>
          <p>แสดงเป็นตัวควบคุมแยกตามรอบรายรับ และยังไม่อ้างว่าเท่ากันจนกว่าจะพิสูจน์การเชื่อมรอบครบ</p>
          {(downstream.financialStatements || []).map((row) => (
            <div key={row.evidence.sourceSha256}>
              <strong>Financial Statement {row.periodStart}–{row.periodEnd}: </strong>
              {row.transferredTotal == null ? '-' : formatShopeeMoney(row.transferredTotal)}
              <EvidenceRefs evidence={[row.evidence]} />
            </div>
          ))}
          {(downstream.sellerBalanceAdjustments || []).map((row) => (
            <div key={row.evidence.sourceSha256}>
              <strong>Seller Balance adjustments {row.periodStart}–{row.periodEnd}: </strong>
              {row.adjustmentAmount == null ? '-' : formatShopeeMoney(row.adjustmentAmount)} ({row.adjustmentCount ?? '-'} รายการ)
              <EvidenceRefs evidence={[row.evidence]} />
            </div>
          ))}
          {(downstream.unlinkedSources || []).map((row) => (
            <div key={row.evidence.sourceSha256}>
              <strong>ยังไม่เชื่อมกับรอบ Income: {row.reportType} {row.periodStart}–{row.periodEnd}</strong>
              <EvidenceRefs evidence={[row.evidence]} />
            </div>
          ))}
          {!(downstream.financialStatements || []).length && !(downstream.sellerBalanceAdjustments || []).length
            ? <p>ยังไม่มีเอกสารปลายทางที่เชื่อมกับรอบรายรับของคำสั่งซื้อในช่วงนี้</p> : null}
        </details>
      ) : null}
    </section>
  );
}

function SellerVoucherRestorationEvidence({ shop }) {
  const restoration = shop.sellerVoucherRestoration;
  if (!restoration?.restoredOrderCount) return null;
  return (
    <details className="shopee-income-bridge">
      <summary>
        {SHOP_LABELS[shop.shopCode] || shop.shopCode}: กู้คืนค่า “โค้ดส่วนลดชำระโดยผู้ขาย” จากหลักฐาน{' '}
        {formatShopeeMoney(restoration.restoredAmount)} ({restoration.restoredOrderCount} คำสั่งซื้อ)
      </summary>
      <p>
        คำนวณรายคำสั่งซื้อจาก voucher code ใน Order All และหลักฐาน campaign ที่ใช้ได้ ณ เวลาชำระสินค้า
        ค่านี้นำไปหักจากยอดขายตั้งต้นและยอดขายที่ยกเลิก ไม่ใช่เงินคืนให้ลูกค้า
      </p>
      {(restoration.campaigns || []).map((campaign) => (
        <div key={`${campaign.voucherId}:${campaign.validFrom}`}>
          <strong>{campaign.voucherId} · {campaign.voucherName}</strong>
          <p>
            {campaign.discountRate * 100}% · สูงสุด {formatShopeeMoney(campaign.maxDiscount)} ·
            ขั้นต่ำ {formatShopeeMoney(campaign.minSpend)} · {campaign.appliesToAllProducts ? 'สินค้าทั้งหมด' : 'สินค้าตามเงื่อนไข'}
          </p>
          <small>
            ใช้ได้ {formatShopeeEvidenceTime(campaign.validFrom)} – {formatShopeeEvidenceTime(campaign.validTo)} ·
            ตรวจหลักฐาน {formatSalesOrderDate(campaign.sourceObservedAt)} ({campaign.sourceObservedPrecision === 'date' ? 'ความละเอียดระดับวัน' : 'เวลาที่บันทึก'})
          </small>
          <small className="shopee-source-evidence">
            <a href={campaign.sourceUrl} target="_blank" rel="noreferrer">เปิดหลักฐาน Seller Centre</a>
            {' · '}{campaign.sourceNotes}
          </small>
        </div>
      ))}
      <p>คำสั่งซื้อ: {restoration.orderNumbers.join(', ')}</p>
    </details>
  );
}

function FinancialReconciliation({ reconciliation }) {
  if (!reconciliation) return null;
  const dailyExceptions = (reconciliation.aggregates?.daily || [])
    .filter((row) => row.status !== 'reconciled');
  return (
    <section className="status-panel history-status-panel shopee-reconciliation" aria-label="การสืบย้อนยอดการเงิน Shopee">
      <h3>การสืบย้อนยอดการเงิน</h3>
      <p>
        ใช้ <strong>เวลาการชำระสินค้า</strong> จัดวันให้ตรงกับ Business Insights;
        คำสั่งซื้อที่ยกเลิกภายหลังยังอยู่ใน Sales batch ตั้งต้น และไปลดหนี้แยกในขั้นตอนถัดไป
      </p>
      <p className="status" data-state={reconciliation.status === 'reconciled' ? 'success' : 'error'}>
        {reconciliationStatusLabel(reconciliation.status)}
      </p>
      <div className="history-table-wrap">
        <table className="history-table shopee-reconciliation-table">
          <thead><tr>
            <th>ร้าน</th>
            <th>ยอดขาย (คำสั่งซื้อที่ได้รับการยืนยัน)</th>
            <th>ยอดขายที่ยกเลิก</th>
            <th>ยอดขายที่คืนเงิน/คืนสินค้า</th>
            <th>ยอดขายยืนยันแล้วสุทธิ</th>
            <th>ผลตรวจ</th>
          </tr></thead>
          <tbody>{reconciliation.shops.map((shop) => (
            <tr key={shop.shopCode}>
              <td>{SHOP_LABELS[shop.shopCode] || shop.shopCode}</td>
              <td><ReconciliationAmount stage={shop.salesBatch} /></td>
              <td><ReconciliationAmount stage={shop.creditNotes} /></td>
              <td><ReconciliationAmount stage={shop.returns} /></td>
              <td><ReconciliationAmount stage={shop.confirmedNet} /></td>
              <td><strong>{reconciliationStatusLabel(shop.status)}</strong></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {reconciliation.shops.map((shop) => <SellerVoucherRestorationEvidence key={shop.shopCode} shop={shop} />)}
      {reconciliation.shops.map((shop) => <PayoutAndDownstreamBridge key={shop.shopCode} shop={shop} />)}
      <p>
        รายรับ Income, ค่าธรรมเนียม, รายการปรับยอด, Seller Balance และรายงานการเงิน
        เป็นสะพานอธิบายเงินที่ Shopee โอน ไม่ได้ถูกบังคับให้เท่ากับยอดขาย
      </p>
      {dailyExceptions.length ? (
        <details>
          <summary>ดูวันที่ยังไม่ตรง/หลักฐานไม่ครบ ({dailyExceptions.length} วัน-ร้าน)</summary>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead><tr><th>ร้าน</th><th>วันที่</th><th>ส่วนต่าง Sales batch</th><th>สาเหตุ/เลขคำสั่งซื้อที่ต้องตรวจ</th></tr></thead>
              <tbody>{dailyExceptions.map((row) => (
                <tr key={`${row.shopCode}:${row.date}`}>
                  <td>{SHOP_LABELS[row.shopCode] || row.shopCode}</td>
                  <td>{formatShopeeReportDate(row.date)}</td>
                  <td>{row.salesBatch.variance == null ? '-' : formatShopeeMoney(row.salesBatch.variance)}</td>
                  <td>{row.unresolved.length ? row.unresolved.map((item) => (
                    <span className="shopee-reconciliation-reason" key={item.reasonCode}>
                      {item.message}{item.orderNumbers?.length ? `: ${item.orderNumbers.join(', ')}` : ''}
                    </span>
                  )) : reconciliationStatusLabel(row.status)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      ) : <p><strong>รายวันตรงกันครบทุกวันในช่วงที่เลือก</strong></p>}
    </section>
  );
}

function OfficialFinanceEvidence({ periods = [] }) {
  if (!periods.length) return null;
  return (
    <section className="status-panel history-status-panel" aria-label="ตรวจเอกสารการเงินรายสัปดาห์">
      <h3>ตรวจเอกสารการเงินรายสัปดาห์</h3>
      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>ร้าน</th>
              <th>รอบรายงานการเงิน</th>
              <th>รายงานการเงิน<br />จำนวนเงินที่โอนแล้วทั้งหมด</th>
              <th>รายละเอียดรายรับของฉัน<br />โอนเงินแล้ว</th>
              <th>Seller Balance<br />รายการที่มีหมายเลขคำสั่งซื้อ</th>
              <th>รายการปรับยอดใน Seller Balance</th>
              <th>ผลตรวจ</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={`${period.shopCode}:${period.startDate}:${period.endDate}`}>
                <td>{SHOP_LABELS[period.shopCode] || period.shopCode}</td>
                <td>{formatShopeeReportDate(period.startDate)} ถึง {formatShopeeReportDate(period.endDate)}</td>
                <td>{period.statementTotal == null ? '-' : formatShopeeMoney(period.statementTotal)}</td>
                <td>
                  {period.incomeTransferredTotal == null ? '-' : formatShopeeMoney(period.incomeTransferredTotal)}
                  {period.incomeTransferredOrderCount == null ? null : <small>{period.incomeTransferredOrderCount} รายการ</small>}
                  {period.zeroPayoutOrderCount > 0 ? <small>ยอดโอน ฿0 จำนวน {period.zeroPayoutOrderCount} รายการ</small> : null}
                </td>
                <td>
                  {period.sellerBalanceOrderTotal == null ? '-' : formatShopeeMoney(period.sellerBalanceOrderTotal)}
                  {period.sellerBalanceOrderCount == null ? null : <small>{period.sellerBalanceOrderCount} รายการ</small>}
                </td>
                <td>
                  {period.sellerBalanceAdjustmentTotal == null ? '-' : formatShopeeMoney(period.sellerBalanceAdjustmentTotal)}
                  {period.sellerBalanceAdjustmentCount == null ? null : <small>{period.sellerBalanceAdjustmentCount} รายการ</small>}
                </td>
                <td><strong>{financeStatusLabel(period.status)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OfficialReturnEvidence({ shops = [] }) {
  if (!shops.length) return null;
  return (
    <section className="status-panel history-status-panel" aria-label="คำสั่งซื้อที่ยกเลิก คืนเงินหรือคืนสินค้า และจัดส่งไม่สำเร็จ">
      <h3>คำสั่งซื้อที่ยกเลิก / คืนเงินหรือคืนสินค้า / จัดส่งไม่สำเร็จ</h3>
      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>ร้าน</th>
              <th>ช่วงวันที่สร้างคำสั่งซื้อ</th>
              <th>คำสั่งซื้อที่ยกเลิก<br />ราคาขายสุทธิ</th>
              <th>จัดส่งไม่สำเร็จ<br />ราคาขายสุทธิ</th>
              <th>คืนเงิน/คืนสินค้า<br />จำนวนเงินคืนทั้งหมด</th>
              <th>วันที่มีข้อมูล</th>
              <th>สถานะข้อมูล</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => (
              <tr key={shop.shopCode}>
                <td>{SHOP_LABELS[shop.shopCode] || shop.shopCode}</td>
                <td>{formatShopeeReportDate(shop.startDate)} ถึง {formatShopeeReportDate(shop.endDate)}</td>
                <td>{shop.coveredDayCount === 0 ? 'ยังสรุปไม่ได้' : <>{shop.cancelledOrderCount} คำสั่งซื้อ<br /><strong>{formatShopeeMoney(shop.cancelledNetSales)}</strong></>}</td>
                <td>{shop.coveredDayCount === 0 ? 'ยังสรุปไม่ได้' : <>{shop.failedDeliveryOrderCount} คำสั่งซื้อ<br /><strong>{formatShopeeMoney(shop.failedDeliveryNetSales)}</strong></>}</td>
                <td>{shop.coveredDayCount === 0 ? 'ยังสรุปไม่ได้' : <>{shop.returnRefundRequestCount} คำขอ<br /><strong>{formatShopeeMoney(shop.totalRefundAmount)}</strong></>}</td>
                <td>{shop.coveredDayCount}/{shop.expectedDayCount} วัน</td>
                <td><strong>{shop.status === 'source_backed' ? 'ครบ' : 'ไม่ครบ'}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
  const accounting = summary?.accounting;
  const confirmed = summary?.confirmedSales;
  const officialDocuments = summary?.officialDocuments;
  const reconciliation = summary?.reconciliation;
  const hasBundleProducts = products.some((product) => product.isBundle === true);
  return (
    <section className="panel shopee-sales-summary-panel">
      <div className="shopee-order-heading">
        <div>
          <p className="panel-eyebrow">Shopee Product Sales Summary</p>
          <p className="panel-copy">
            เลือกช่วงวันที่เพื่อดูรายงาน Shopee และรายละเอียดสินค้า
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
      <section className="status-panel history-status-panel" aria-live="polite">
        <p className="status" data-state={status.state}>{status.message}</p>
      </section>

      {summary ? (
        <>
          {confirmed ? (
            <section className="status-panel history-status-panel" aria-label="Business Insights ของ Shopee">
              <h3>Business Insights — ภาพรวมยอดขาย</h3>
              <p>วันที่: {formatShopeeReportDate(confirmed.startDate)} ถึง {formatShopeeReportDate(confirmed.endDate)}</p>
              <p><strong>ยอดขาย (คำสั่งซื้อที่ได้รับการยืนยัน) (THB): {confirmed.salesTotal == null ? 'ยังสรุปไม่ได้ รายงานต้นทางไม่ครบ' : formatShopeeMoney(confirmed.salesTotal)}</strong></p>
              {confirmed.status === 'incomplete' ? <p role="alert">รายงานต้นทางไม่ครบ {confirmed.missingDays.length} วัน-ร้าน</p> : null}
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead><tr><th>ร้าน</th><th>ยอดขาย (คำสั่งซื้อที่ได้รับการยืนยัน) (THB)</th><th>คำสั่งซื้อ(ได้รับการยืนยัน)</th><th>คำสั่งซื้อที่ยกเลิก</th><th>ยอดขายที่ยกเลิก</th><th>วันที่มีข้อมูล</th></tr></thead>
                  <tbody>{confirmed.shops.map(shop => <tr key={shop.shopCode}>
                    <td>{SHOP_LABELS[shop.shopCode]}</td>
                    <td><strong>{shop.salesTotal == null ? 'ยังสรุปไม่ได้' : formatShopeeMoney(shop.salesTotal)}</strong></td>
                    <td>{shop.orderCount == null ? 'ยังสรุปไม่ได้' : new Intl.NumberFormat('th-TH').format(shop.orderCount)}</td>
                    <td>{shop.cancelledOrderCount == null ? (shop.status === 'source_backed' ? 'ไม่มีในไฟล์รูปแบบนี้' : 'ยังสรุปไม่ได้') : new Intl.NumberFormat('th-TH').format(shop.cancelledOrderCount)}</td>
                    <td>{shop.cancelledSales == null ? (shop.status === 'source_backed' ? 'ไม่มีในไฟล์รูปแบบนี้' : 'ยังสรุปไม่ได้') : formatShopeeMoney(shop.cancelledSales)}</td>
                    <td>{shop.coveredDays}/{shop.expectedDays} วัน</td>
                  </tr>)}</tbody>
                </table>
              </div>
              {confirmed.status === 'source_backed' && confirmed.shops.some(shop => shop.cancelledSales == null) ? (
                <p>ไฟล์ Business Insights รูปแบบปัจจุบันไม่มีคอลัมน์ “คำสั่งซื้อที่ยกเลิก” และ “ยอดขายที่ยกเลิก” ระบบจึงเว้นข้อมูลไว้ ไม่ตีความเป็น 0</p>
              ) : null}
              <h4>หลักฐานไฟล์ต้นทางและความสดของข้อมูล</h4>
              <div className="history-table-wrap">
                <table className="history-table">
                  <thead><tr><th>ร้าน</th><th>ข้อมูลล่าสุด</th><th>ไฟล์ต้นฉบับ</th><th>ตรวจพบไฟล์</th><th>นำเข้าระบบ</th><th>SHA-256</th></tr></thead>
                  <tbody>{confirmed.shops.flatMap(shop => {
                    const sources = shop.sources || [];
                    if (!sources.length) return [<tr key={`${shop.shopCode}:missing`}>
                      <td>{SHOP_LABELS[shop.shopCode]}</td>
                      <td>{formatShopeeReportDate(shop.latestDataDate)}</td>
                      <td colSpan="4">ยังไม่มีหลักฐานไฟล์ต้นทางในช่วงที่เลือก</td>
                    </tr>];
                    return sources.map(source => <tr key={`${shop.shopCode}:${source.sourceSha256}`}>
                      <td>{SHOP_LABELS[shop.shopCode]}</td>
                      <td>{formatShopeeReportDate(shop.latestDataDate)}</td>
                      <td>{source.sourceFilename}<br /><small>{formatShopeeReportDate(source.coveredStartDate)} ถึง {formatShopeeReportDate(source.coveredEndDate)} ({source.coveredDays} วัน)</small></td>
                      <td>{formatShopeeEvidenceTime(source.observedAt)}</td>
                      <td>{formatShopeeEvidenceTime(source.importedAt)}</td>
                      <td><code title={source.sourceSha256}>{source.sourceSha256.slice(0, 12)}…</code></td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            </section>
          ) : null}
          {officialDocuments ? (
            <>
              <OfficialFinanceEvidence periods={officialDocuments.finance} />
              <OfficialReturnEvidence shops={officialDocuments.returns} />
            </>
          ) : null}
          <FinancialReconciliation reconciliation={reconciliation} />
          <h3>รายละเอียดสินค้าและคำสั่งซื้อจากไฟล์คำสั่งซื้อ</h3>
          <div className="shopee-sales-summary-metrics">
            <SummaryMetric label="ชนิดสินค้า" value={summary.productCount} />
            <SummaryMetric label="คำสั่งซื้อในรายละเอียด" value={summary.orderCount} />
            <SummaryMetric label="จำนวนหน่วยสินค้ารวม" value={summary.totalQuantity} />
          </div>
          {accounting ? (
            <section className="status-panel history-status-panel" aria-label="ยอดขายและความครบถ้วนของหลักฐาน">
              <p>
                <strong>ยอดรายละเอียดสินค้าตามวันที่สร้างคำสั่งซื้อ หลังตัดรายการยกเลิก/พัสดุตีกลับ: </strong>
                {accounting.calculatedSalesTotal === null
                  ? 'ยังรวมยอดไม่ได้ มีออเดอร์ขาดยอดเงิน'
                  : formatShopeeMoney(accounting.calculatedSalesTotal)}
                {accounting.status === 'provisional' ? ' (ประมาณการบางส่วน)' : ''}
              </p>
              {accounting.quantityReviewOrderCount > 0 ? <p role="alert">จำนวนสินค้าจากอีเมลไม่ตรงกับไฟล์คำสั่งซื้อ {accounting.quantityReviewOrderCount} ออเดอร์ ต้องตรวจสอบก่อนคีย์สินค้า</p> : null}
            </section>
          ) : null}

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
                                      <th>ค่าสินค้าทั้งออเดอร์ (ห้ามรวมซ้ำตามสินค้า)</th>
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
