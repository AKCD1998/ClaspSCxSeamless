import { formatPrintedStatus } from '../utils/historyFormatting.js';

export default function HistoryActions({ busyRecordId, onPrintAction, record }) {
  const isBusy = busyRecordId === record.id;

  return (
    <div className="history-actions">
      <button
        className="history-action-button"
        disabled={isBusy || !!record.printed}
        type="button"
        onClick={() => onPrintAction('printed', record)}
      >
        {isBusy ? 'กำลังบันทึก...' : 'ปริ้นท์ส่งพี่เอแล้ว'}
      </button>
      <button
        className="history-action-button secondary"
        disabled={isBusy || !record.printed}
        type="button"
        onClick={() => onPrintAction('unprinted', record)}
      >
        {isBusy ? 'กำลังอัปเดต...' : 'ยังไม่ได้ปริ้นท์'}
      </button>
      <span className="sr-only">{formatPrintedStatus(record.printed)}</span>
    </div>
  );
}
