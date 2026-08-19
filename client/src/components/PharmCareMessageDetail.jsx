import {
  DOCUMENT_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  formatFileSizeBytes,
  formatPeriod,
  formatReasonCode,
  formatReceivedAt,
} from './pharmcareLabels.js';

// Pure presentation of one message's detail (expanded inline under its inbox row). Row-level
// fields render immediately from the inbox row; the fetched detail (getMessageWithEvidence via
// GET /messages/:id) adds the full picture: every document parsed from the same email, every
// attachment, and ingestion error info — the things the inbox table cannot show.
export default function PharmCareMessageDetail({ row, detail, status, onRetry, onOpenPreview }) {
  const message = detail || {};
  const attachments = detail?.attachments || [];
  const documents = detail?.documents || [];

  return (
    <div className="pharmcare-detail">
      <section className="pharmcare-detail-section">
        <p className="pharmcare-detail-title">เหตุผลการจัดประเภท (เอกสารนี้)</p>
        {row.reasonCodes?.length ? (
          <ul className="pharmcare-detail-reasons">
            {row.reasonCodes.map((code) => (
              <li key={code}>
                <span className="history-pill">{formatReasonCode(code)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pharmcare-detail-muted">ไม่มีรหัสเหตุผล</p>
        )}
        <div className="pharmcare-detail-row">
          <span className="pharmcare-detail-label">รุ่นตัวจัดประเภท</span>
          <span className="pharmcare-detail-value">{row.classifierVersion || '-'}</span>
        </div>
      </section>

      <section className="status-panel history-status-panel" aria-live="polite">
        <p className="status" data-state={status?.state || 'idle'}>
          {status?.message}
        </p>
        {status?.state === 'error' ? (
          <button className="history-view-button secondary" onClick={onRetry} type="button">
            ลองใหม่
          </button>
        ) : null}
      </section>

      {detail ? (
        <>
          <section className="pharmcare-detail-section">
            <p className="pharmcare-detail-title">อีเมลต้นทาง</p>
            <div className="pharmcare-detail-rows">
              <div className="pharmcare-detail-row">
                <span className="pharmcare-detail-label">ผู้ส่งจริง</span>
                <span className="pharmcare-detail-value">{message.originalFrom || '-'}</span>
              </div>
              <div className="pharmcare-detail-row">
                <span className="pharmcare-detail-label">วันที่ในอีเมลต้นฉบับ</span>
                <span className="pharmcare-detail-value">{message.originalDate || '-'}</span>
              </div>
              <div className="pharmcare-detail-row">
                <span className="pharmcare-detail-label">หัวเรื่องเดิม</span>
                <span className="pharmcare-detail-value">{message.rawSubject || '-'}</span>
              </div>
              <div className="pharmcare-detail-row">
                <span className="pharmcare-detail-label">ดึงเข้าระบบเมื่อ</span>
                <span className="pharmcare-detail-value">{formatReceivedAt(message.ingestedAt)}</span>
              </div>
              {message.errorMessage ? (
                <div className="pharmcare-detail-row">
                  <span className="pharmcare-detail-label">ข้อผิดพลาดการดึงเข้า</span>
                  <span className="pharmcare-detail-value">
                    {message.errorCode ? `${message.errorCode}: ` : ''}
                    {message.errorMessage}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="pharmcare-detail-section">
            <p className="pharmcare-detail-title">เอกสารทั้งหมดในอีเมลนี้ ({documents.length})</p>
            {documents.length ? (
              <ul className="pharmcare-detail-list">
                {documents.map((document) => (
                  <li key={document.id} className="pharmcare-detail-item">
                    <div className="pharmcare-detail-row">
                      <span className="pharmcare-detail-label">ประเภท</span>
                      <span className="pharmcare-detail-value">
                        {DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType}
                        {document.documentNumber ? ` — ${document.documentNumber}` : ''}
                      </span>
                    </div>
                    <div className="pharmcare-detail-row">
                      <span className="pharmcare-detail-label">สถานะ</span>
                      <span className="pharmcare-detail-value">
                        {REVIEW_STATUS_LABELS[document.reviewStatus] || document.reviewStatus}
                        {document.duplicateOfDocumentId ? ' (ซ้ำกับฉบับก่อนหน้า)' : ''}
                      </span>
                    </div>
                    <div className="pharmcare-detail-row">
                      <span className="pharmcare-detail-label">รอบ/ช่วงเวลา</span>
                      <span className="pharmcare-detail-value">{formatPeriod(document)}</span>
                    </div>
                    <div className="pharmcare-detail-row">
                      <span className="pharmcare-detail-label">เหตุผล</span>
                      <span className="pharmcare-detail-value">
                        {document.reasonCodes?.length ? (
                          <ul className="pharmcare-detail-reasons">
                            {document.reasonCodes.map((code) => (
                              <li key={code}>
                                <span className="history-pill">{formatReasonCode(code)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '-'
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pharmcare-detail-muted">ไม่พบเอกสารในอีเมลนี้</p>
            )}
          </section>

          <section className="pharmcare-detail-section">
            <p className="pharmcare-detail-title">ไฟล์แนบทั้งหมด ({attachments.length})</p>
            {attachments.length ? (
              <ul className="pharmcare-detail-list">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="pharmcare-detail-item">
                    {attachment.id ? (
                      <button
                        className="pharmcare-preview-link"
                        onClick={() =>
                          onOpenPreview?.({ id: attachment.id, filename: attachment.originalFilename })
                        }
                        type="button"
                      >
                        {attachment.originalFilename}
                      </button>
                    ) : (
                      attachment.originalFilename
                    )}
                    {attachment.fileSizeBytes ? (
                      <span className="pharmcare-detail-muted">
                        {' '}
                        ({formatFileSizeBytes(attachment.fileSizeBytes)})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="pharmcare-detail-muted">ไม่มีไฟล์แนบ</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
