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

export default function ShopeeAccountingCycleNotice({ payload, status }) {
  const nextCycle = payload?.nextCycle;
  const missingCycles = payload?.missingCycles || [];
  const futureCompletedCycles = payload?.futureCompletedCycles || [];
  const showCycleDetails = nextCycle && status.state !== 'error';

  return (
    <section className="panel shopee-cycle-panel" aria-labelledby="shopee-cycle-title">
      <p className="panel-eyebrow" id="shopee-cycle-title">รอบบัญชี Shopee ถัดไป</p>
      <p className="panel-copy">
        ระบบใช้รอบที่กำหนดล่าสุดหรือต่อจากประวัติที่ประมวลผลสำเร็จ โดยไม่บังคับย้อนทำรอบเก่า และสร้างชื่อชีตกับสีให้อัตโนมัติ
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

          <div className="shopee-cycle-summary">
            <div className="shopee-cycle-card" data-kind="next">
              <span>{payload?.hasGaps ? 'รอบที่ต้องทำให้ครบก่อน' : 'รอบบัญชีถัดไป'}</span>
              <strong>{formatThaiAccountingRange(nextCycle)}</strong>
              <small>ระบบเลือกข้อมูลด้วยวันที่ทำการสั่งซื้อ 00:00–23:59 (เวลาไทย)</small>
            </div>
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
