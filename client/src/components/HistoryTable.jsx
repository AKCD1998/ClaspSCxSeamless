import HistoryActions from './HistoryActions.jsx';
import NotifyStatus from './NotifyStatus.jsx';
import PrintQueueStatus from './PrintQueueStatus.jsx';
import {
  formatHistoryDate,
  formatHistoryTimestamp,
  formatPrintedStatus,
  formatReportType,
  getHistoryDisplayFilename,
  getHistoryDocumentUrl,
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

export default function HistoryTable({ busyRecordId, onPrintAction, onRequestPrint, onSendEmail, records }) {
  return (
    <div className="history-table-wrap">
      <table className="history-table">
        <colgroup>
          <col className="history-col-filename" />
          <col className="history-col-type" />
          <col className="history-col-date" />
          <col className="history-col-branch" />
          <col className="history-col-timestamp" />
          <col className="history-col-printed" />
          <col className="history-col-queue" />
          <col className="history-col-timestamp" />
          <col className="history-col-notify" />
          <col className="history-col-link" />
          <col className="history-col-source" />
          <col className="history-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th>ชื่อไฟล์</th>
            <th>ประเภทรายงาน</th>
            <th>วันที่รายงาน</th>
            <th>เอกสารของสาขา</th>
            <th>อัปโหลดเมื่อ</th>
            <th>ปริ้นท์ส่งพี่เอแล้ว</th>
            <th>คิวปริ้น</th>
            <th>ปริ้นท์ส่งพี่เอเมื่อ</th>
            <th>แจ้งเตือน</th>
            <th>ลิงก์พรีวิว/ดาวน์โหลด</th>
            <th>ไฟล์ต้นทาง</th>
            <th>การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <div className="history-filename">{getHistoryDisplayFilename(record) || '-'}</div>
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
              <td>
                <PrintQueueStatus record={record} />
              </td>
              <td>{formatHistoryTimestamp(record.printedAt)}</td>
              <td>
                <NotifyStatus record={record} />
              </td>
              <td>
                {getHistoryDocumentUrl(record) ? (
                  <a href={getHistoryDocumentUrl(record)} target="_blank" rel="noopener noreferrer">
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
                  onRequestPrint={onRequestPrint}
                  onSendEmail={onSendEmail}
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
