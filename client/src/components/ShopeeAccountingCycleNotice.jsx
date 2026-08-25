const THAI_MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export function formatThaiAccountingDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
  if (!match) return '-';

  return `${Number(match[3])} ${THAI_MONTHS[Number(match[2]) - 1]} ${Number(match[1]) + 543}`;
}

export function formatThaiAccountingRange(cycle) {
  if (!cycle?.periodStart || !cycle?.periodEnd) return '-';
  return `${formatThaiAccountingDate(cycle.periodStart)} – ${formatThaiAccountingDate(cycle.periodEnd)}`;
}

function isoDayFromIct(value) {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(String(value || ''));
  return match ? match[1] : '';
}

export default function ShopeeAccountingCycleNotice({ payload, status }) {
  const nextCycle = payload?.nextCycle;
  const lastCycle = payload?.lastCompletedCycle;
  const missingCycles = payload?.missingCycles || [];
  const futureCompletedCycles = payload?.futureCompletedCycles || [];
  const unconfirmedEmptyCycles = payload?.unconfirmedEmptyCycles || [];
  const downloadGuidance = nextCycle?.downloadGuidance;
  const orderDateRange = nextCycle
    ? {
        periodStart:
          isoDayFromIct(downloadGuidance?.preferredFromIct) || nextCycle.periodStart,
        periodEnd:
          isoDayFromIct(downloadGuidance?.preferredToIct) || nextCycle.periodEnd,
      }
    : null;
  const showCycleDetails = nextCycle && status.state !== 'error';

  return (
    <section className="panel shopee-cycle-panel" aria-labelledby="shopee-cycle-title">
      <p className="panel-eyebrow" id="shopee-cycle-title">รอบบัญชี Shopee ถัดไป</p>
      <p className="panel-copy">
        ระบบต่อรอบจากประวัติที่ประมวลผลสำเร็จครั้งละ 4 สัปดาห์ และสร้างชื่อชีตกับสีตามแบบเดือนมิถุนายนให้อัตโนมัติ
      </p>

      <p className="status shopee-cycle-status" data-state={status.state} aria-live="polite">
        {status.message}
      </p>

      {showCycleDetails && (
        <>
          {missingCycles.length > 0 && (
            <div className="shopee-cycle-alert" data-kind="gap" role="alert">
              <strong>{`พบ ${missingCycles.length} รอบที่ยังขาด — ระบบจะไม่ข้ามรอบ`}</strong>
              <ul>
                {missingCycles.map((cycle) => (
                  <li key={cycle.cycleKey}>{formatThaiAccountingRange(cycle)}</li>
                ))}
              </ul>
              {futureCompletedCycles.length > 0 && (
                <p>
                  {`มีไฟล์รอบถัดไปแล้ว ${futureCompletedCycles.length} รอบ แต่ checkpoint จะรอให้รอบที่ขาดครบก่อน`}
                </p>
              )}
            </div>
          )}

          {unconfirmedEmptyCycles.length > 0 && (
            <div className="shopee-cycle-alert" data-kind="empty" role="alert">
              <strong>มีไฟล์ที่ไม่พบรายการสำเร็จในรอบ จึงยังไม่นับว่าปิดรอบ</strong>
              <ul>
                {unconfirmedEmptyCycles.map((cycle) => (
                  <li key={cycle.cycleKey}>{formatThaiAccountingRange(cycle)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="shopee-cycle-summary">
            <div className="shopee-cycle-card">
              <span>รอบล่าสุดที่ปิดต่อเนื่องแล้ว</span>
              <strong>{lastCycle ? formatThaiAccountingRange(lastCycle) : 'ยังไม่มีประวัติ'}</strong>
            </div>
            <div className="shopee-cycle-card" data-kind="next">
              <span>{payload?.hasGaps ? 'รอบที่ต้องทำให้ครบก่อน' : 'รอบบัญชีถัดไป'}</span>
              <strong>{formatThaiAccountingRange(nextCycle)}</strong>
              <small>ระบบเลือกข้อมูลด้วยวันที่ทำการสั่งซื้อ 00:00–23:59 (เวลาไทย)</small>
            </div>
          </div>

          <div className="shopee-cycle-download">
            <strong>ช่วงวันที่สั่งซื้อที่ต้องเลือกใน Shopee</strong>
            <p>
              ตัวกรอง Order.all และเว็บใช้คอลัมน์ “วันที่ทำการสั่งซื้อ” เป็นเกณฑ์เดียวกัน เลือกช่วงรอบบัญชีนี้ตรง ๆ
            </p>
            {orderDateRange?.periodStart && orderDateRange?.periodEnd && (
              <p>
                <strong>{formatThaiAccountingRange(orderDateRange)}</strong>
              </p>
            )}
            <p>
              รายการยกเลิกหรือรายการที่ยังไม่มีเวลาสั่งซื้อสำเร็จจะไม่อยู่ในเอกสาร และรอบจะยังไม่ปิดจนกว่าจะ export ช่วงวันที่เดิมซ้ำหลังรายการค้างเสร็จ
            </p>
          </div>

          <div className="shopee-cycle-weeks">
            <span>ชีตที่จะสร้าง 4 สัปดาห์</span>
            <ol>
              {(nextCycle.weeks || []).map((week) => (
                <li key={week.name}>
                  <code>{week.name}</code>
                  <span>{formatThaiAccountingRange({ periodStart: week.start, periodEnd: week.end })}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="shopee-cycle-guidance">
            {payload?.dateFieldGuidance?.message ||
              'ตัวแปลง Order.all ใช้วันที่ทำการสั่งซื้อเป็นเกณฑ์ทั้งรอบและชีต; วันที่รายได้เข้าอาจไม่ตรงกัน จึงควรเทียบรายงานรายได้ก่อนปิดบัญชี'}
          </p>
        </>
      )}
    </section>
  );
}
