import HistoryActions from './HistoryActions.jsx';
import {
  formatHistoryDate,
  formatHistoryTimestamp,
  formatPrintedStatus,
  formatReportType,
  normalizeBranchCodeList,
} from '../utils/historyFormatting.js';

function BranchCodes({ value }) {
  const branchCodes = normalizeBranchCodeList(value);

  if (!branchCodes.length) {
    return <span className="history-muted">-</span>;
  }

  return (
    <div className="history-branch-list">
      {branchCodes.map((branchCode) => (
        <span className="history-summary-pill" key={branchCode}>
          สาขา {branchCode}
        </span>
      ))}
    </div>
  );
}

export default function HistoryTable({ busyRecordId, onPrintAction, records }) {
  return (
    <div className="history-table-wrap">
      <table className="history-table">
        <thead>
          <tr>
            <th>ชื่อไฟล์</th>
            <th>ประเภทรายงาน</th>
            <th>วันที่รายงาน</th>
            <th>เอกสารของสาขา</th>
            <th>อัปโหลดเมื่อ</th>
            <th>ปริ้นท์ส่งพี่เอแล้ว</th>
            <th>ปริ้นท์ส่งพี่เอเมื่อ</th>
            <th>ลิงค์ดูไฟล์</th>
            <th>แหล่งเก็บไฟล์</th>
            <th>การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <div className="history-filename">{record.filename || '-'}</div>
              </td>
              <td>{formatReportType(record.reportType)}</td>
              <td>{formatHistoryDate(record.reportDate)}</td>
              <td>
                <BranchCodes value={record.branchCodes || record.branchCode} />
              </td>
              <td>{formatHistoryTimestamp(record.uploadedAt)}</td>
              <td>
                <span className="history-pill" data-printed={String(!!record.printed)}>
                  {formatPrintedStatus(record.printed)}
                </span>
              </td>
              <td>{formatHistoryTimestamp(record.printedAt)}</td>
              <td>
                {record.driveFileUrl ? (
                  <a href={record.driveFileUrl} target="_blank" rel="noopener noreferrer">
                    เปิดไฟล์
                  </a>
                ) : (
                  <span className="history-muted">-</span>
                )}
              </td>
              <td>
                {record.sourceUploadName || <span className="history-muted">-</span>}
              </td>
              <td className="history-actions-cell">
                <HistoryActions
                  busyRecordId={busyRecordId}
                  onPrintAction={onPrintAction}
                  record={record}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
