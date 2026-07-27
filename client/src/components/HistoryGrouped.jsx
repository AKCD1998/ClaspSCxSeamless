import HistoryActions from './HistoryActions.jsx';
import {
  formatHistoryDate,
  formatHistoryTimestamp,
  formatPrintedStatus,
  formatReportType,
  groupRecordsByReportDate,
  normalizeBranchCodeList,
} from '../utils/historyFormatting.js';

function SummaryPill({ label, isAvailable }) {
  return (
    <span className="history-summary-pill" data-kind={isAvailable ? 'available' : 'missing'}>
      {label}: {isAvailable ? 'มีไฟล์แล้ว' : 'ยังไม่มีไฟล์'}
    </span>
  );
}

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

export default function HistoryGrouped({ busyRecordId, onPrintAction, onRequestPrint, onSendEmail, records }) {
  const groups = groupRecordsByReportDate(records);

  return (
    <div className="history-grouped-wrap">
      <div className="history-grouped-body">
        {groups.map((group) => (
          <section className="history-group" key={group.reportDate}>
            <div className="history-group-header">
              <div>
                <h3 className="history-group-title">{formatHistoryDate(group.reportDate)}</h3>
                <div className="history-group-meta">{group.records.length} ไฟล์</div>
              </div>
              <div className="history-group-summary">
                <SummaryPill label="Summary" isAvailable={group.hasSummary} />
                <SummaryPill label="Individual" isAvailable={group.hasIndividual} />
                <span className="history-summary-pill">ปริ้นท์แล้ว {group.printedCount} ไฟล์</span>
                <span className="history-summary-pill">ยังไม่ได้ปริ้นท์ {group.notPrintedCount} ไฟล์</span>
              </div>
            </div>

            <div className="history-group-records">
              {group.records.map((record) => (
                <div className="history-group-record" key={record.id}>
                  <div className="history-group-main">
                    <div className="history-group-label">ชื่อไฟล์</div>
                    <div className="history-filename">{record.filename || '-'}</div>
                    <div className="history-group-links">
                      {record.driveFileUrl ? (
                        <a href={record.driveFileUrl} target="_blank" rel="noopener noreferrer">
                          เปิดไฟล์
                        </a>
                      ) : (
                        <span className="history-muted">ไม่มีลิงค์ไฟล์</span>
                      )}
                    </div>
                  </div>

                  <div className="history-group-detail">
                    <div className="history-group-label">ประเภทรายงาน</div>
                    <div>{formatReportType(record.reportType)}</div>
                    <div className="history-group-label">เอกสารของสาขา</div>
                    <BranchCodes value={record.branchCodes || record.branchCode} />
                    <div className="history-group-label">แหล่งเก็บไฟล์</div>
                    <div>{record.sourceUploadName || <span className="history-muted">-</span>}</div>
                  </div>

                  <div className="history-group-detail">
                    <div className="history-group-label">อัปโหลดเมื่อ</div>
                    <div>{formatHistoryTimestamp(record.uploadedAt)}</div>
                    <div className="history-group-label">ปริ้นท์ส่งพี่เอเมื่อ</div>
                    <div>{formatHistoryTimestamp(record.printedAt)}</div>
                  </div>

                  <div className="history-group-detail">
                    <div className="history-group-label">ปริ้นท์ส่งพี่เอแล้ว</div>
                    <div>
                      <span className="history-pill" data-printed={String(!!record.printed)}>
                        {formatPrintedStatus(record.printed)}
                      </span>
                    </div>
                    <HistoryActions
                      busyRecordId={busyRecordId}
                      onPrintAction={onPrintAction}
                      onRequestPrint={onRequestPrint}
                      onSendEmail={onSendEmail}
                      record={record}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
