import { getPharmcareAttachmentDownloadUrl } from '../services/api.js';

export const DOCUMENT_TYPE_LABELS = {
  e_credit_invoice: 'E-Credit Invoice',
  settlement_mrr: 'Settlement (MRR)',
  settlement_sfr: 'Settlement (SFR)',
  receipt_link_pending: 'ใบเสร็จ/ใบกำกับภาษี (รอลิงก์)',
  contract: 'สัญญา',
  unknown: 'ไม่ทราบประเภท',
};

export const REVIEW_STATUS_LABELS = {
  auto_classified: 'จัดประเภทอัตโนมัติแล้ว',
  manual_review: 'ต้องตรวจสอบ',
  duplicate: 'ซ้ำ',
  conflict: 'ขัดแย้ง',
};

export function formatReceivedAt(value) {
  if (!value) {
    return '-';
  }

  try {
    return new Date(value).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (error) {
    return value;
  }
}

export function formatPeriod(document) {
  if (!document.periodStart && !document.periodEnd) {
    return '-';
  }

  const half = document.half ? ` (${document.half})` : '';
  return `${document.periodStart || '?'} – ${document.periodEnd || '?'}${half}`;
}

function RouteBadge({ route }) {
  const isForwarded = route === 'manual_forward';
  return (
    <span className="history-pill" data-printed={String(!isForwarded)}>
      {isForwarded ? 'Forwarded' : 'Direct'}
    </span>
  );
}

function ReviewStatusBadge({ reviewStatus }) {
  return (
    <span className="history-summary-pill" data-kind={reviewStatus === 'auto_classified' ? 'available' : 'missing'}>
      {REVIEW_STATUS_LABELS[reviewStatus] || reviewStatus}
    </span>
  );
}

// Pure, props-driven presentation for the PharmCare Inbox — no fetching, no state. Kept separate
// from PharmCareInboxPanel.jsx so loading/success/empty/error/filter/badge rendering can be
// tested directly (via renderToString with fixed props) without needing a DOM environment to
// exercise React effects.
export default function PharmCareInboxView({
  documents,
  filters,
  isLoading,
  onFilterChange,
  onRetry,
  status,
  summary,
}) {
  return (
    <section className="panel">
      <p className="panel-eyebrow">PharmCare Inbox</p>
      <p className="panel-copy">
        รายการอีเมลการเงินจาก PharmCare ที่ระบบดึงและจัดประเภทอัตโนมัติแล้ว (อ่านอย่างเดียวในเวอร์ชันนี้)
      </p>

      {summary ? (
        <div className="history-branch-list" style={{ marginBottom: '1rem' }}>
          <span className="history-summary-pill" data-kind="available">
            จัดประเภทแล้ว {summary.autoClassified}
          </span>
          <span className="history-summary-pill" data-kind="missing">
            ต้องตรวจสอบ {summary.manualReview}
          </span>
          <span className="history-summary-pill" data-kind="missing">
            ซ้ำ {summary.duplicate}
          </span>
          <span className="history-summary-pill" data-kind="missing">
            ขัดแย้ง {summary.conflict}
          </span>
        </div>
      ) : null}

      <form className="history-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="history-filter-field">
          <span>สถานะ</span>
          <select name="status" onChange={onFilterChange} value={filters.status}>
            <option value="">ทั้งหมด</option>
            {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="history-filter-field">
          <span>ประเภทเอกสาร</span>
          <select name="documentType" onChange={onFilterChange} value={filters.documentType}>
            <option value="">ทั้งหมด</option>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="history-filter-field">
          <span>ซ้ำหรือไม่</span>
          <select name="duplicate" onChange={onFilterChange} value={filters.duplicate}>
            <option value="">ทั้งหมด</option>
            <option value="true">เฉพาะรายการซ้ำ</option>
            <option value="false">ไม่รวมรายการซ้ำ</option>
          </select>
        </label>
      </form>

      <section className="status-panel history-status-panel" aria-live="polite">
        <p className="status" data-state={status.state}>
          {status.message}
        </p>
        {status.state === 'error' ? (
          <button className="history-view-button secondary" onClick={onRetry} type="button">
            ลองใหม่
          </button>
        ) : null}
      </section>

      {isLoading ? (
        <div className="history-empty">กำลังโหลด...</div>
      ) : documents.length ? (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>ได้รับเมื่อ</th>
                <th>หัวเรื่อง</th>
                <th>ผู้ส่งต้นทาง</th>
                <th>เส้นทาง</th>
                <th>ประเภทเอกสาร</th>
                <th>เลขเอกสาร</th>
                <th>ไฟล์แนบ</th>
                <th>รอบ/ช่วงเวลา</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td>{formatReceivedAt(document.receivedAt)}</td>
                  <td>{document.normalizedSubject || '-'}</td>
                  <td>{document.originalFrom || '-'}</td>
                  <td>
                    <RouteBadge route={document.route} />
                  </td>
                  <td>{DOCUMENT_TYPE_LABELS[document.documentType] || document.documentType}</td>
                  <td>{document.documentNumber || '-'}</td>
                  <td>
                    {document.attachmentId && document.attachmentFilename ? (
                      <a
                        href={getPharmcareAttachmentDownloadUrl(document.attachmentId)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {document.attachmentFilename}
                      </a>
                    ) : (
                      document.attachmentFilename || '-'
                    )}
                  </td>
                  <td>{formatPeriod(document)}</td>
                  <td>
                    <ReviewStatusBadge reviewStatus={document.reviewStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="history-empty">ไม่พบเอกสาร PharmCare ตามเงื่อนไขที่เลือก</div>
      )}
    </section>
  );
}
