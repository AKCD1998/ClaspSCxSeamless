import {
  formatHistoryDate,
  groupRecordsByReportDate,
  normalizeBranchCodeList,
} from '../utils/historyFormatting.js';

function SummaryPill({ children, isAvailable }) {
  return (
    <span className="history-summary-pill" data-kind={isAvailable ? 'available' : 'missing'}>
      {children}
    </span>
  );
}

function BranchCodes({ branchCodes }) {
  const codes = Array.isArray(branchCodes) ? branchCodes : normalizeBranchCodeList(branchCodes);

  if (!codes.length) {
    return <span className="history-muted">-</span>;
  }

  return (
    <div className="history-branch-list">
      {codes.map((branchCode) => (
        <span className="history-summary-pill" key={branchCode}>
          สาขา {branchCode}
        </span>
      ))}
    </div>
  );
}

export default function HistoryDashboard({ activeReportDate, onSelectReportDate, records }) {
  const groups = groupRecordsByReportDate(records);

  return (
    <section className="history-dashboard">
      <div className="history-dashboard-heading">
        <div>
          <h3 className="history-subtitle">หน้าสรุปสถานะ</h3>
          <p className="panel-copy">
            สำหรับผู้ใช้งานในการเชตสถานะว่าแอดมินปริ้นเอกสารส่งพี่เอแล้วหรือยัง
          </p>
        </div>
      </div>

      {!groups.length ? (
        <div className="history-empty">ยังไม่มีรายงานสรุป</div>
      ) : (
        <div className="history-table-wrap history-dashboard-wrap">
          <table className="history-dashboard-table">
            <thead>
              <tr>
                <th>วันที่รายงาน</th>
                <th>เอกสารของสาขา</th>
                <th>Summary</th>
                <th>Individual</th>
                <th>การอัปโหลดทั้งหมด</th>
                <th>รายงานที่ปริ้นท์แล้วทั้งหมด</th>
                <th>รายงานที่ย้งไม่ได้ปริ้นท์</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.reportDate}>
                  <td>
                    {/^\d{8}$/.test(group.reportDate) ? (
                      <button
                        className="history-date-filter-button"
                        data-active={String(group.reportDate === activeReportDate)}
                        type="button"
                        onClick={() => onSelectReportDate(group.reportDate)}
                      >
                        {formatHistoryDate(group.reportDate)}
                      </button>
                    ) : (
                      formatHistoryDate(group.reportDate)
                    )}
                  </td>
                  <td>
                    <BranchCodes branchCodes={group.branchCodes} />
                  </td>
                  <td>
                    <SummaryPill isAvailable={group.hasSummary}>
                      {group.hasSummary ? 'มีไฟล์แล้ว' : 'ยังไม่มีไฟล์'}
                    </SummaryPill>
                  </td>
                  <td>
                    <SummaryPill isAvailable={group.hasIndividual}>
                      {group.hasIndividual ? 'มีไฟล์แล้ว' : 'ยังไม่มีไฟล์'}
                    </SummaryPill>
                  </td>
                  <td>{group.records.length}</td>
                  <td>{group.printedCount}</td>
                  <td>{group.notPrintedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
