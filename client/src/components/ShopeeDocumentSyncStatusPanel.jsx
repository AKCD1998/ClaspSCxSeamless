import { useCallback, useEffect, useMemo, useState } from 'react';
import { getShopeeDocumentSyncStatus } from '../services/api.js';

const SHOP_OPTIONS = [
  ['all', 'ทุกร้าน'],
  ['sc-drug-store', 'SC Drug Store'],
  ['dr-morepen', 'DR.Morepen'],
];

const GROUP_OPTIONS = [
  ['all', 'เอกสารทั้งหมด'],
  ['daily', 'รายงานรายวัน/ย้อนหลัง'],
  ['weekly', 'เอกสารรอบการเงินรายสัปดาห์'],
];

const STATUS_META = {
  ingested: { icon: '✅', label: 'ดาวน์โหลดและนำเข้าแล้ว' },
  no_file: { icon: '○', label: 'ตรวจแล้ว: Shopee ไม่มีเอกสารวันที่นี้' },
  missing: { icon: '❌', label: 'ยังไม่มีข้อมูลในเว็บ' },
  waiting: { icon: '🕘', label: 'รอรอบดาวน์โหลดตามเวลาของร้าน' },
  processing: { icon: '🔄', label: 'อยู่ในรอบดาวน์โหลดหรือนำเข้า' },
  not_due: { icon: '💤', label: 'ยังไม่ถึงรอบที่ Shopee ออกรายงาน' },
  unavailable: { icon: '⚪', label: 'Shopee ยังไม่เปิดให้ดาวน์โหลด' },
};
const OUTSIDE_WINDOW_META = { icon: '◷', label: 'ตรวจแล้ว: Shopee ไม่เปิดให้เลือกวันที่นี้ (นอกช่วงย้อนหลัง)' };
function cellMeta(cell) {
  return cell.status === 'unavailable' && cell.evidence?.reasonCode === 'SHOPEE_ETAX_DATE_OUTSIDE_AVAILABLE_WINDOW'
    ? OUTSIDE_WINDOW_META : STATUS_META[cell.status] || STATUS_META.missing;
}

function formatDate(value, options = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value || '')) return '-';
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: options.long ? 'short' : 'numeric',
    ...(options.year ? { year: 'numeric' } : {}),
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function rowStatusLabel(row) {
  if (row.status === 'complete') return row.outsideWindowCount
    ? `ตรวจครบ · นอกช่วงย้อนหลัง ${row.outsideWindowCount} วัน${row.noFileCount ? ` · ไม่มีเอกสาร ${row.noFileCount} วัน` : ''}`
    : row.noFileCount ? `ตรวจครบ · ไม่มีเอกสาร ${row.noFileCount} วัน` : 'ครบ';
  if (row.status === 'waiting') return `รอรอบ ${row.scheduleTime || ''} น.`;
  if (row.status === 'processing') return 'กำลังดาวน์โหลด/นำเข้า';
  if (row.status === 'unavailable') return 'Shopee ยังไม่เปิดให้ดาวน์โหลด';
  if (row.status === 'not_due') return 'ยังไม่ถึงรอบ';
  return `ขาด ${row.missingCount} วัน`;
}

function evidenceTitle(cell) {
  const meta = cellMeta(cell);
  if (!cell.evidence) return `${formatDate(cell.date, { long: true, year: true })}: ${meta.label}`;
  if (cell.status === 'no_file' || (cell.status === 'unavailable' && cell.evidence.reasonCode === 'SHOPEE_ETAX_DATE_OUTSIDE_AVAILABLE_WINDOW')) return [
    `${formatDate(cell.date, { long: true, year: true })}: ${meta.label}`,
    `ตรวจเมื่อ: ${formatTime(cell.evidence.observedAt)}`,
    `บันทึกหลักฐาน: ${formatTime(cell.evidence.importedAt)}`,
    `งาน: ${cell.evidence.jobId}`,
    ...(cell.evidence.earliestAvailableDate ? [`เลือกย้อนหลังได้ตั้งแต่: ${formatDate(cell.evidence.earliestAvailableDate, { long: true, year: true })}`] : []),
  ].join('\n');
  return [
    `${formatDate(cell.date, { long: true, year: true })}: ${meta.label}`,
    `ไฟล์: ${cell.evidence.sourceFilename}`,
    `ครอบคลุม: ${cell.evidence.dateFrom} ถึง ${cell.evidence.dateTo}`,
    `นำเข้า: ${formatTime(cell.evidence.importedAt)}`,
    `SHA-256: ${cell.evidence.sourceSha256}`,
  ].join('\n');
}

function StatusCell({ cell }) {
  const meta = cellMeta(cell);
  return (
    <td className="shopee-sync-cell" data-state={cell.status} title={evidenceTitle(cell)}>
      <span aria-label={`${formatDate(cell.date, { long: true, year: true })} ${meta.label}`} role="img">
        {meta.icon}
      </span>
    </td>
  );
}

export function ShopeeDocumentSyncStatusView({
  data,
  days,
  error,
  groupFilter,
  isLoading,
  onDaysChange,
  onGroupFilterChange,
  onRefresh,
  onShopFilterChange,
  shopFilter,
}) {
  const visibleRows = useMemo(() => (data?.shops || []).flatMap((shop) => (
    shop.rows
      .filter((row) => shopFilter === 'all' || shop.shopCode === shopFilter)
      .filter((row) => groupFilter === 'all'
        || (groupFilter === 'weekly' ? row.cadence === 'weekly' : row.cadence !== 'weekly'))
      .map((row) => ({ ...row, shopCode: shop.shopCode, shopName: shop.shopName }))
  )), [data, groupFilter, shopFilter]);

  return (
    <section className="panel shopee-sync-panel">
      <div className="shopee-sync-heading">
        <div>
          <p className="panel-eyebrow">ประวัติการดาวน์โหลดและนำเข้า</p>
          <p className="panel-copy">
            แสดงไฟล์ที่นำเข้าแล้ว และวันที่ตรวจจาก Shopee แล้วว่าไม่มีเอกสาร
          </p>
        </div>
        <div className="shopee-sync-asof">
          <span>ข้อมูลล่าสุดที่ควรมี</span>
          <strong>{data ? formatDate(data.asOfDate, { long: true, year: true }) : '-'}</strong>
        </div>
      </div>

      <div className="shopee-sync-toolbar">
        <label>
          <span>ร้าน</span>
          <select onChange={(event) => onShopFilterChange(event.target.value)} value={shopFilter}>
            {SHOP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>ประเภทเอกสาร</span>
          <select onChange={(event) => onGroupFilterChange(event.target.value)} value={groupFilter}>
            {GROUP_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>ย้อนหลัง</span>
          <select onChange={(event) => onDaysChange(Number(event.target.value))} value={days}>
            {[14, 31, 90].map((value) => <option key={value} value={value}>{value} วัน</option>)}
          </select>
        </label>
        <button className="secondary" disabled={isLoading} onClick={onRefresh} type="button">
          {isLoading ? 'กำลังตรวจ...' : '🔄 รีเฟรช'}
        </button>
      </div>

      {error ? <p className="status" data-state="error" role="alert">{error}</p> : null}

      {data ? (
        <>
          <div className="shopee-sync-shop-cards">
            {data.shops.map((shop) => (
              <article key={shop.shopCode} data-state={shop.incompleteRowCount ? 'incomplete' : shop.pendingRowCount ? 'processing' : 'complete'}>
                <div>
                  <span>{shop.shopName}</span>
                  <strong>{shop.incompleteRowCount
                    ? `ยังขาด ${shop.incompleteRowCount} ประเภท`
                    : shop.pendingRowCount
                      ? `อยู่ในรอบทำงาน ${shop.pendingRowCount} ประเภท`
                      : shop.rows.some((item) => item.outsideWindowCount)
                        ? 'ตรวจครบ · มีวันนอกช่วงย้อนหลัง'
                        : 'ข้อมูลครบตามรอบ'}</strong>
                </div>
                <small>หลักฐานล่าสุด {formatTime(shop.latestImportedAt)}</small>
              </article>
            ))}
          </div>

          <div className="shopee-sync-table-wrap">
            <table className="shopee-sync-table">
              <thead>
                <tr>
                  <th>ร้าน / เอกสาร</th>
                  <th>สรุป</th>
                  {data.dates.map((date) => <th key={date}>{formatDate(date)}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.shopCode}:${row.reportType}`}>
                    <th scope="row">
                      <span>{row.shopName}</span>
                      <strong>{row.label}</strong>
                    </th>
                    <td className="shopee-sync-row-summary" data-state={row.status}>
                      <strong>{rowStatusLabel(row)}</strong>
                      <small>{row.latestCoveredDate ? `ถึง ${formatDate(row.latestCoveredDate, { long: true })}` : 'ยังไม่มีไฟล์'}</small>
                    </td>
                    {row.cells.map((cell) => <StatusCell cell={cell} key={cell.date} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="shopee-sync-legend" aria-label="คำอธิบายสถานะ">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <span key={key}><b>{meta.icon}</b> {meta.label}</span>
            ))}
            <span><b>{OUTSIDE_WINDOW_META.icon}</b> {OUTSIDE_WINDOW_META.label}</span>
          </div>
          <p className="shopee-sync-note">
            วางเมาส์ที่แต่ละช่องเพื่อดูชื่อไฟล์ ช่วงวันที่ เวลานำเข้า และ SHA-256
            {data.dailyScheduleTime && data.dailySlaTime
              ? ` · รายงานรายวันเริ่มเวลา ${data.dailyScheduleTime} น. และจะแสดงว่าขาดเมื่อเลย ${data.dailySlaTime} น.`
              : ''}
          </p>
        </>
      ) : null}
    </section>
  );
}

export default function ShopeeDocumentSyncStatusPanel() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [shopFilter, setShopFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setData(await getShopeeDocumentSyncStatus(days));
    } catch (loadError) {
      setError(loadError.message || 'โหลดสถานะเอกสาร Shopee ไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <ShopeeDocumentSyncStatusView
      data={data}
      days={days}
      error={error}
      groupFilter={groupFilter}
      isLoading={isLoading}
      onDaysChange={setDays}
      onGroupFilterChange={setGroupFilter}
      onRefresh={load}
      onShopFilterChange={setShopFilter}
      shopFilter={shopFilter}
    />
  );
}
