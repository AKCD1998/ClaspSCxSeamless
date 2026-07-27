import { formatPrintedStatus } from '../utils/historyFormatting.js';

function generatedFileIdForRecord(record) {
  return record?.metadata?.outputFileId || record?.driveFileId || '';
}

export default function HistoryActions({ busyRecordId, onPrintAction, onRequestPrint, onSendEmail, record }) {
  const isBusy = busyRecordId === record.id;
  const fileId = generatedFileIdForRecord(record);

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
      {onRequestPrint ? (
        <button
          className="history-action-button secondary"
          disabled={isBusy}
          type="button"
          onClick={() => onRequestPrint(record)}
        >
          {isBusy ? 'กำลังส่งคำขอ...' : 'สั่งปริ้น / ขอปริ้นใหม่'}
        </button>
      ) : null}
      {onSendEmail ? (
        <button
          className="history-action-button secondary"
          disabled={isBusy || !fileId}
          type="button"
          onClick={() => onSendEmail(record, fileId)}
          title={fileId ? '' : 'ยังไม่มีไฟล์เอกสารสำหรับรายการนี้'}
        >
          {isBusy ? 'กำลังส่ง...' : 'ส่งเอกสารเข้าอีเมล'}
        </button>
      ) : null}
      <span className="sr-only">{formatPrintedStatus(record.printed)}</span>
    </div>
  );
}
