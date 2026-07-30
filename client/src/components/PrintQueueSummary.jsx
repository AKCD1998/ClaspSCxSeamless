import { formatHistoryTimestamp } from '../utils/historyFormatting.js';

const IN_PROGRESS_STATUSES = ['downloading', 'sent_to_spooler', 'printing'];

export default function PrintQueueSummary({ records }) {
  const printing = (records || []).filter((record) => IN_PROGRESS_STATUSES.includes(record.printJobStatus));

  const queued = (records || [])
    .filter((record) => record.printJobStatus === 'queued')
    .slice()
    .sort((a, b) => new Date(a.printScheduledFor) - new Date(b.printScheduledFor));

  if (!printing.length && !queued.length) {
    return null;
  }

  return (
    <section className="print-queue-summary" aria-live="polite">
      <h3 className="print-queue-summary-title">สถานะคิวปริ้นตอนนี้</h3>

      {printing.length ? (
        <ul className="print-queue-summary-list">
          {printing.map((record) => (
            <li key={record.id} className="print-queue-summary-item" data-state="active">
              <span className="print-queue-summary-badge">กำลังปริ้น</span>
              {record.filename || '-'}
            </li>
          ))}
        </ul>
      ) : null}

      {queued.length ? (
        <ol className="print-queue-summary-list">
          {queued.map((record, index) => {
            const isDue = record.printScheduledFor && new Date(record.printScheduledFor) <= new Date();

            return (
              <li key={record.id} className="print-queue-summary-item" data-state={isDue ? 'due' : 'waiting'}>
                <span className="print-queue-summary-badge">คิวที่ {index + 1}</span>
                {record.filename || '-'}
                <span className="print-queue-summary-time">
                  {isDue ? 'ถึงคิวแล้ว รอเครื่องรับงาน' : `จะปริ้น ${formatHistoryTimestamp(record.printScheduledFor)}`}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
