function NotifyBadge({ label, notifiedAt, notifyError }) {
  if (notifyError) {
    return (
      <span className="history-notify-badge" data-state="error" title={notifyError}>
        {label} ล้มเหลว
      </span>
    );
  }

  if (notifiedAt) {
    return (
      <span className="history-notify-badge" data-state="ok">
        {label} สำเร็จ
      </span>
    );
  }

  return null;
}

export default function NotifyStatus({ record }) {
  const hasAny = record.lineNotifiedAt || record.lineNotifyError || record.emailNotifiedAt || record.emailNotifyError;

  if (!hasAny) {
    return <span className="history-muted">-</span>;
  }

  return (
    <div className="history-notify-list">
      <NotifyBadge label="LINE" notifiedAt={record.lineNotifiedAt} notifyError={record.lineNotifyError} />
      <NotifyBadge label="อีเมล" notifiedAt={record.emailNotifiedAt} notifyError={record.emailNotifyError} />
    </div>
  );
}
