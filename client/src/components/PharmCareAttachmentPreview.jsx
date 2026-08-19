import { useEffect, useRef } from 'react';
import { getPharmcareAttachmentDownloadUrl } from '../services/api.js';

// Overlay that previews one PharmCare attachment in-app. The blob is fetched by the panel via
// fetchPharmcareAttachmentBlob (the endpoint's Content-Disposition: attachment would force a
// download on direct navigation), wrapped in an object URL and rendered by the browser's
// built-in PDF viewer inside an iframe. Print delegates to the iframe's own print dialog so
// the PDF prints with its native viewer chrome; download keeps using the original
// authenticated proxy URL so the save flow is identical to the previous direct link.
export default function PharmCareAttachmentPreview({
  attachment,
  status,
  previewUrl,
  isPdf,
  onClose,
  onRetry,
}) {
  const iframeRef = useRef(null);
  const overlayRef = useRef(null);

  // Focus the dialog itself (not a control inside it) so the Escape handler below actually
  // receives key events right after opening, instead of focus staying on the trigger button
  // behind the overlay.
  useEffect(() => {
    overlayRef.current?.focus?.();
  }, [attachment?.id]);

  if (!attachment) {
    return null;
  }

  function handlePrint() {
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.print();
    }
  }

  return (
    <div
      aria-label={`พรีวิว ${attachment.filename}`}
      aria-modal="true"
      className="pharmcare-preview-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
      ref={overlayRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className="pharmcare-preview">
        <div className="pharmcare-preview-header">
          <span className="pharmcare-preview-filename">{attachment.filename}</span>
          <div className="pharmcare-preview-actions">
            {isPdf && previewUrl ? (
              <button className="history-view-button secondary" onClick={handlePrint} type="button">
                พิมพ์
              </button>
            ) : null}
            <a
              className="history-view-button secondary"
              href={getPharmcareAttachmentDownloadUrl(attachment.id)}
            >
              ดาวน์โหลด
            </a>
            <button className="history-view-button secondary" onClick={onClose} type="button">
              ปิด
            </button>
          </div>
        </div>
        <div className="pharmcare-preview-body">
          {status.state === 'working' ? (
            <p className="pharmcare-preview-message">กำลังเปิดพรีวิว...</p>
          ) : status.state === 'error' ? (
            <div className="pharmcare-preview-message">
              <p className="status" data-state="error">
                {status.message}
              </p>
              <button className="history-view-button secondary" onClick={onRetry} type="button">
                ลองใหม่
              </button>
            </div>
          ) : isPdf && previewUrl ? (
            <iframe
              ref={iframeRef}
              src={previewUrl}
              title={`พรีวิว ${attachment.filename}`}
            />
          ) : (
            <div className="pharmcare-preview-message">
              <p>ไม่สามารถพรีวิวไฟล์ชนิดนี้ในหน้าเว็บได้</p>
              <p className="pharmcare-detail-muted">
                กด "ดาวน์โหลด" ด้านบนเพื่อบันทึกไฟล์ไปเปิดในโปรแกรมของเครื่องแทน
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
