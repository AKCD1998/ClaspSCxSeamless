import { useEffect, useRef, useState } from 'react';
import { copyScopeIsValid, copyFiltersMatch, copyDailyReconciliationIsValid, verifiedCopyColumns } from './shopeeAdaSmartCopy.js';

const LABELS = { sku: 'รหัส IC/SKU', quantity: 'จำนวนสินค้า', unitPrice: 'ราคาต่อหน่วย' };
const SHOPS = { 'sc-drug-store': 'SC Drug Store', 'dr-morepen': 'DR.Morepen' };
const money = cents => cents == null ? 'ยังสรุปไม่ได้' : new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(cents / 100);
const dateLabel = date => date?.split('-').reverse().join('/') || '-';
const periodLabel = plan => plan.startDate === plan.endDate ? dateLabel(plan.startDate)
  : `${dateLabel(plan.startDate)} ถึง ${dateLabel(plan.endDate)}`;

export default function ShopeeAdaSmartCopyTable({ filters, plan, isLoading, error, isStale }) {
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [manualColumn, setManualColumn] = useState('');
  const copyRequest = useRef(0);
  const copyBusy = useRef(false);
  useEffect(() => {
    copyRequest.current += 1;
    copyBusy.current = false;
    setCopyFeedback(null);
    setManualColumn('');
    return () => { copyRequest.current += 1; };
  }, [plan, isStale, isLoading]);
  useEffect(() => {
    if (copyFeedback?.state !== 'copied') return undefined;
    const timer = setTimeout(() => setCopyFeedback(current => current === copyFeedback ? null : current), 2500);
    return () => clearTimeout(timer);
  }, [copyFeedback]);
  const columns = !isLoading && !isStale ? verifiedCopyColumns(plan, filters) : null;
  const emptyVerified = !isLoading && !isStale && plan?.status === 'ready'
    && copyScopeIsValid(filters) && copyFiltersMatch(plan, filters) && copyDailyReconciliationIsValid(plan)
    && !plan.issues?.length && plan.targetCents === 0 && plan.totalCents === 0
    && plan.orderCount === 0 && plan.confirmedSales?.orderCount === 0 && plan.rows.length === 0;
  const dateCorrections = (plan?.businessDateCorrections || []).filter(correction => correction.applied);
  const lineEvidence = (plan?.lineFinancialEvidence || []).filter(evidence => evidence.applied);
  const allocations = plan?.allocationPolicies || [];
  const restoredVouchers = plan?.sellerVoucherRestorations || [];

  async function copyColumn(key) {
    if (!columns || copyBusy.current) return;
    const id = ++copyRequest.current;
    copyBusy.current = true;
    setCopyFeedback({ key, state: 'copying' });
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(columns[key]);
      if (id !== copyRequest.current) return;
      setManualColumn('');
      setCopyFeedback({ key, state: 'copied', message: `✓ คัดลอก${LABELS[key]}แล้ว · ${plan.rowCount} แถว พร้อมวาง` });
    } catch {
      if (id !== copyRequest.current) return;
      setManualColumn(key);
      setCopyFeedback({ key, state: 'error', message: 'คัดลอกอัตโนมัติไม่สำเร็จ เลือกข้อความด้านล่างแล้วกด Ctrl+C' });
    } finally {
      if (id === copyRequest.current) copyBusy.current = false;
    }
  }

  return (
    <section className="shopee-adasmart-copy" aria-label="ตารางคัดลอกเข้า AdaSmart">
      <h3>คัดลอกเข้า AdaSmart</h3>
      <p>เลือกหนึ่งร้านและวันที่หรือช่วงวันที่ แล้วคัดลอกทีละคอลัมน์ตามลำดับ รหัส → จำนวน → ราคา</p>
      {!copyScopeIsValid(filters) ? <p className="status" data-state="error">เลือกหนึ่งร้านและช่วงวันที่ที่ถูกต้อง วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น</p> : null}
      {isStale ? <p className="status" data-state="error">ร้านหรือวันที่เปลี่ยนแล้ว กด “แสดงยอดขาย” เพื่อโหลดข้อมูลที่ตรงกับตัวเลือก</p> : null}
      {isLoading ? <p role="status">กำลังตรวจออเดอร์และยอด Business Insights...</p> : null}
      {error ? <p role="alert" className="status" data-state="error">{error}</p> : null}
      {plan && !isLoading ? <>
        <div className="shopee-copy-context">
          <strong>{SHOPS[plan.shopCode] || plan.shopCode} · {periodLabel(plan)}</strong>
          <span>{dateCorrections.length ? 'วันที่ตาม Business Insights' : 'วันที่ชำระสินค้า'} · เวลาไทย</span>
        </div>
        <div className="shopee-copy-totals">
          <div><span>Business Insights · ยอดขายยืนยันแล้ว</span><strong>฿{money(plan.targetCents)}</strong></div>
          <div><span>ยอดตาราง · จำนวน × ราคา</span><strong>฿{money(plan.totalCents)}</strong></div>
          <div><span>ส่วนต่าง</span><strong>฿{money(plan.varianceCents)}</strong></div>
        </div>
        <p>{plan.orderCount} / {plan.confirmedSales?.orderCount ?? '-'} ออเดอร์ · {plan.sourceLineCount} รายการต้นทาง · {plan.rowCount} แถวคัดลอก</p>
        {plan.dailyReconciliation ? <details className="shopee-copy-evidence">
          <summary>ตรวจยอดรายวัน ({plan.dailyReconciliation.filter(day => day.status === 'ready').length} / {plan.dailyReconciliation.length} วันผ่าน)</summary>
          <p>รวมสินค้าเป็นตารางเดียวตลอดช่วงที่เลือก ทุกวันต้องมีรายงาน Business Insights และยอดกับจำนวนออเดอร์ตรงกัน วันยอดศูนย์ต้องมีรายงานยืนยันด้วย</p>
          <div className="history-table-wrap"><table className="history-table" aria-label="ผลตรวจยอด Business Insights รายวัน">
            <thead><tr><th>วันที่</th><th>ออเดอร์ / BI</th><th>ยอดตาราง</th><th>ยอด BI</th><th>ส่วนต่าง</th><th>ผลตรวจ</th></tr></thead>
            <tbody>{plan.dailyReconciliation.map(day => <tr key={day.date}>
              <td>{dateLabel(day.date)}</td><td>{day.orderCount} / {day.confirmedOrderCount ?? '-'}</td>
              <td>{money(day.totalCents)}</td><td>{money(day.targetCents)}</td><td>{money(day.varianceCents)}</td>
              <td>{day.status === 'ready' ? 'ผ่าน' : `ต้องตรวจ: ${(day.reasons || []).join(' · ')}`}</td>
            </tr>)}</tbody>
          </table></div>
        </details> : null}
        {dateCorrections.length ? <p>จัดวันที่ให้ {dateCorrections.length} ออเดอร์ตามรายงานสินค้า Business Insights ที่ตรวจแล้ว ดูรายละเอียดในหลักฐานด้านล่าง</p> : null}
        {plan.issues.length ? <p><strong>ยอดออเดอร์ทั้งหมด ฿{money(plan.cohortTotalCents)}</strong> · ตารางด้านล่างแสดงเฉพาะรายการที่เตรียมได้ ยังขาดรายการที่ต้องตรวจสอบ</p> : null}
        <p>ค่าสินค้า ฿{money(plan.merchandiseCents)} − ส่วนลดผู้ขาย ฿{money(plan.sellerCents)} + ส่วนลดสินค้าที่ Shopee สนับสนุน ฿{money(plan.supportCents)}</p>
        {allocations.length ? <p>ตารางนี้มีรายการที่แบ่งส่วนลดหรือราคาชุดตามกติกาที่คุณอนุมัติ ดูรายละเอียดในหลักฐานด้านล่าง</p> : null}
        {restoredVouchers.length ? <p>ใช้โค้ดในออเดอร์และหลักฐานแคมเปญร้านค้าคืนส่วนลดที่หายจากไฟล์หลังยกเลิก {restoredVouchers.length} ออเดอร์</p> : null}
        <p className="status" data-state={columns || emptyVerified ? 'success' : 'error'}>
          {emptyVerified ? `Business Insights ยืนยันว่าไม่มีออเดอร์ใน${plan.startDate === plan.endDate ? 'วันนี้' : 'ช่วงวันที่เลือก'} ไม่มีข้อมูลให้คัดลอก`
            : columns ? 'ยอดและรายการผ่านการตรวจ พร้อมคัดลอก' : 'ยังไม่พร้อมคัดลอก ต้องตรวจรายการหรือยอดที่ระบุด้านล่าง'}
        </p>
        <p>รวม SKU เดียวกันแล้ว ราคาอาจแยกสองแถวเพื่อรักษายอดถึงสตางค์ ให้คัดลอกครบทุกแถวตามลำดับ</p>
        <div className="history-table-wrap">
          <table className="history-table shopee-copy-table">
            <caption>รหัส จำนวน และราคาของ {SHOPS[plan.shopCode]} วันที่ {periodLabel(plan)}</caption>
            <thead><tr>
              {Object.entries(LABELS).map(([key, label]) => <th key={key}>
                <span>{label}</span>
                <button type="button" className="secondary" aria-label={`คัดลอก${label}`}
                  data-copy-state={copyFeedback?.key === key ? copyFeedback.state : undefined}
                  disabled={!columns || copyFeedback?.state === 'copying'} onClick={() => copyColumn(key)}>
                  {copyFeedback?.key === key && copyFeedback.state === 'copied' ? '✓ คัดลอกแล้ว'
                    : copyFeedback?.key === key && copyFeedback.state === 'copying' ? 'กำลังคัดลอก...' : `คัดลอก${label}`}
                </button>
              </th>)}
              <th>สินค้า / หน่วย ERP</th><th>จำนวนเงิน</th>
            </tr></thead>
            <tbody>{plan.rows.map((row, index) => <tr key={`${row.sku}:${index}`}>
              <td className="shopee-copy-value">{row.sku}</td>
              <td className="shopee-copy-value">{row.quantity}</td>
              <td className="shopee-copy-value">{row.unitPrice}</td>
              <td>{row.productName}<small>{row.unit}{row.freeGift ? ' · ของแถม ราคา 0.00' : ''}{row.splitPrice ? ' · แยกราคาเพื่อรักษาสตางค์' : ''}</small></td>
              <td>{money(row.amountCents)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!plan.rows.length ? <p>ไม่มีแถวสินค้าที่เตรียมได้ในช่วงวันที่เลือก</p> : null}
        <p className="shopee-copy-feedback" data-state={copyFeedback?.state} role="status" aria-live="polite" aria-atomic="true">{copyFeedback?.message}</p>
        {manualColumn && columns ? <label className="shopee-copy-manual">
          <span>{LABELS[manualColumn]} — เลือกทั้งหมดแล้วคัดลอก</span>
          <textarea readOnly value={columns[manualColumn]} onFocus={event => event.target.select()} rows={Math.min(plan.rowCount, 12)} />
        </label> : null}
        {plan.issues.length ? <div className="shopee-copy-issues" role="alert">
          <h4>รายการที่ต้องตรวจสอบ ({plan.issues.length})</h4>
          <ul>{plan.issues.map((issue, index) => <li key={index}>
            <strong>{issue.reason}</strong>
            {issue.date ? <span>วันที่ {dateLabel(issue.date)}</span> : null}
            {issue.productName ? <span>
              {issue.components?.length
                ? `จับคู่แล้ว: ${issue.components.map(component => `${component.sku} ×${component.factor} ${component.unit}`).join(' + ')} ต่อชุด`
                : issue.sku || 'ยังไม่มีรหัส'}
              {' · '}{issue.productName} {issue.variant}
            </span> : null}
            {issue.orderNumber ? <small>ออเดอร์ {issue.orderNumber}{issue.sourceRow ? ` · แถวต้นทาง ${issue.sourceRow}` : ''}</small> : null}
          </li>)}</ul>
        </div> : null}
        <details className="shopee-copy-evidence"><summary>หลักฐานและออเดอร์ที่ใช้คำนวณ</summary>
          <p>ใช้กลุ่มออเดอร์ของช่วงวันที่เลือกตามยอดขายยืนยันแล้วตั้งต้นของ Business Insights รวมคำสั่งซื้อที่ยกเลิกหรือคืนภายหลัง</p>
          {allocations.length ? <div>
            <h4>กติกาแบ่งเงินที่เจ้าของร้านอนุมัติ</h4>
            <p>ราคาแยกส่วนนี้คำนวณตามกติกาที่อนุมัติ ไม่ใช่ราคาขายแยกที่ Shopee ระบุ</p>
            {allocations.map(record => <p key={record.policyKey}>
              {record.policy.type === 'seller_voucher' ? 'ส่วนลดร้านค้า: แบ่งตามสัดส่วนค่าสินค้าเดิม รักษายอดถึงสตางค์'
                : record.policy.method === 'paid_component_and_free_gift' ? 'Polar: ลงราคาทั้งชุดที่ฟ้า 2 ขวด; ขาว 1 ขวดแถม ราคา 0.00'
                  : 'Dr.Morepen: ชุด 350 บาท → เครื่อง 175.00 + แผ่นตรวจ 175.00'}
              {' · '}อนุมัติ {dateLabel(record.approvedAt?.slice(0,10))}
            </p>)}
          </div> : null}
          {restoredVouchers.length ? <div>
            <h4>ส่วนลดร้านค้าจากโค้ดและหลักฐานแคมเปญ</h4>
            {restoredVouchers.map(record => <p key={record.orderNumber}>
              {record.orderNumber} · {record.campaignEvidence.voucherId} · คืนส่วนลด ฿{money(Math.round(record.restoredAmount * 100))}
              {' · '}<a href={record.campaignEvidence.sourceUrl} target="_blank" rel="noreferrer">หลักฐานแคมเปญ</a>
            </p>)}
          </div> : null}
          {dateCorrections.length ? <div>
            <h4>ออเดอร์ที่จัดวันที่ตามหลักฐาน Business Insights</h4>
            <ul>{dateCorrections.map(correction => <li key={`${correction.shopCode}:${correction.orderNumber}`}>
              {correction.orderNumber} · วันชำระในต้นทาง {dateLabel(correction.paidBusinessDate)}
              {' → '}วันที่ตามรายงาน {dateLabel(correction.businessDate)}
            </li>)}</ul>
            {[...new Map(dateCorrections.flatMap(correction => correction.evidence?.sources || [])
              .map(source => [source.sourceSha256, source])).values()].map(source => <p key={source.sourceSha256}>
              {source.sourceFilename}<br /><code>{source.sourceSha256}</code>
            </p>)}
          </div> : null}
          {lineEvidence.length ? <div>
            <h4>หลักฐานส่วนลด Shopee แยกตามสินค้า</h4>
            {lineEvidence.map(record => <p key={`${record.shopCode}:${record.orderNumber}`}>
              ออเดอร์ {record.orderNumber} · ตรวจราคาทั้ง {record.lineFinancials.length} รายการกับรายงานสินค้า Business Insights แล้ว
            </p>)}
            {[...new Map(lineEvidence.flatMap(record => record.evidence?.sources || [])
              .map(source => [source.sourceSha256,source])).values()].map(source => <p key={source.sourceSha256}>
              {source.sourceFilename}<br /><code>{source.sourceSha256}</code>
            </p>)}
          </div> : null}
          {[...(plan.sourceEvidence || []), ...(plan.confirmedSales?.shops?.[0]?.sources || [])].map(source => <p key={source.sourceSha256}>
            {source.sourceFilename}<br /><code>{source.sourceSha256}</code>
          </p>)}
          <p>หน่วย ERP: {plan.masterEvidence?.filename} · ตรวจหลักฐาน {plan.masterEvidence?.verifiedOn}</p>
          {(plan.additionalMasterEvidence || []).map(source => <p key={source.id}>
            หน่วย ERP เพิ่มเติม: {source.filename} · ตรวจหลักฐาน {source.verifiedOn}<br /><code>{source.sha256}</code>
          </p>)}
          {plan.rows.map((row, index) => <details key={`${row.sku}:${index}`}>
            <summary>{row.sku} · {row.quantity} × {row.unitPrice}</summary>
            <ul>{row.sources.map((source, sourceIndex) => <li key={sourceIndex}>
              {source.orderNumber} · แถว {source.sourceRow} · {source.productName} {source.variant}
              {' · '}{source.listingQuantity} ชุด × {source.quantityPerSale} {row.unit} · ฿{money(source.amountCents)}
            </li>)}</ul>
          </details>)}
        </details>
      </> : null}
    </section>
  );
}
