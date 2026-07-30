import { formatHistoryTimestamp } from '../utils/historyFormatting.js';

const IN_PROGRESS_STATUSES = ['downloading', 'sent_to_spooler', 'printing'];

export default function PrintQueueStatus({ record }) {
  const status = record.printJobStatus;
  const scheduledFor = record.printScheduledFor;

  if (!status || status === 'completed' || status === 'failed') {
    return <span className="history-muted">-</span>;
  }

  if (IN_PROGRESS_STATUSES.includes(status)) {
    return (
      <span className="history-queue-badge" data-state="ok">
        กำลังปริ้น...
      </span>
    );
  }

  if (status === 'queued') {
    const isDue = scheduledFor && new Date(scheduledFor) <= new Date();

    if (isDue) {
      return (
        <span className="history-queue-badge" data-state="ok">
          ถึงคิวแล้ว รอเครื่องรับงาน
        </span>
      );
    }

    return (
      <span className="history-queue-badge" data-state="pending" title={scheduledFor}>
        รอคิว จะปริ้น {formatHistoryTimestamp(scheduledFor)}
      </span>
    );
  }

  return <span className="history-muted">-</span>;
}
