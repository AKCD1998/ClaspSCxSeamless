import { useId, useRef, useState } from 'react';
import { processWorkbookPayload } from '../services/api.js';

const idleMessage = 'กรุณาเลือกไฟล์เพื่อเริ่ม';

function filterWorkbookFiles(files) {
  return files.filter((file) => /\.xlsx$/i.test(file.name || ''));
}

function getSelectedFilesLabel(files) {
  if (!files.length) {
    return 'ยังไม่มีการอัปโหลดไฟล์ลง';
  }

  if (files.length === 1) {
    return `เลือกไฟล์แล้ว: ${files[0].name}`;
  }

  const previewNames = files.slice(0, 3).map((file) => file.name).join(', ');
  const remainingCount = files.length - 3;

  return remainingCount > 0
    ? `เลือกแล้ว ${files.length} ไฟล์: ${previewNames}, +${remainingCount} ไฟล์เพิ่มเติม`
    : `เลือกแล้ว ${files.length} ไฟล์: ${previewNames}`;
}

function collectWarningItems(successes, failures) {
  const items = [];

  successes.forEach((success) => {
    (success.warnings || []).forEach((warning) => {
      items.push(`${success.filename}: ${warning}`);
    });
  });

  failures.forEach((failure) => {
    items.push(`ไม่สำเร็จ ${failure.fileName}: ${failure.message}`);
  });

  return items;
}

function buildBatchStatus(successes, failures, warningCount) {
  const successCount = successes.length;
  const failureCount = failures.length;

  if (!successCount) {
    return 'ไม่มีไฟล์ที่ประมวลผลสำเร็จ';
  }

  if (!failureCount && !warningCount) {
    return `เสร็จสิ้น มีไฟล์พร้อมใช้งาน ${successCount} ไฟล์ด้านล่าง`;
  }

  return (
    `เสร็จสิ้น มีไฟล์พร้อมใช้งาน ${successCount} ไฟล์` +
    (warningCount ? ` คำเตือน: ${warningCount} รายการ` : '') +
    (failureCount ? ` ไม่สำเร็จ: ${failureCount} ไฟล์` : '')
  );
}

function getBatchState(successes, failures, warningCount) {
  if (!successes.length) {
    return 'error';
  }

  if (failures.length || warningCount) {
    return 'warning';
  }

  return 'success';
}

export default function UploadPanel({
  bootstrap,
  copy,
  eyebrow,
  formatterMode,
  onProcessingComplete,
}) {
  const inputId = useId();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState({ message: idleMessage, state: 'idle' });
  const [warnings, setWarnings] = useState([]);
  const [result, setResult] = useState(null);

  function clearFeedback() {
    setWarnings([]);
    setResult(null);
    setStatus({ message: idleMessage, state: 'idle' });
  }

  function handleFileChange(event) {
    setFiles(filterWorkbookFiles(Array.from(event.target.files || [])));
    setWarnings([]);
    setResult(null);
  }

  async function processFilesSequentially(selectedFiles) {
    const successes = [];
    const failures = [];
    const previewState = {
      spreadsheetId: '',
      url: '',
      batchId: '',
    };

    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];

      try {
        setStatus({
          message: `กำลังประมวลผลไฟล์ที่ ${index + 1} จาก ${selectedFiles.length}: ${file.name}`,
          state: 'working',
        });

        const payload = await processWorkbookPayload({
          file,
          formatterMode,
          previewSpreadsheetId: previewState.spreadsheetId || '',
          batchId: previewState.batchId || '',
          batchFileCount: selectedFiles.length,
        });

        if (payload.previewSpreadsheetId) {
          previewState.spreadsheetId = payload.previewSpreadsheetId;
          previewState.url = payload.previewUrl;
        }

        if (payload.batchId) {
          previewState.batchId = payload.batchId;
        }

        successes.push(payload);
      } catch (error) {
        failures.push({
          fileName: file.name,
          message: error?.message || 'ประมวลผลไฟล์ไม่สำเร็จ',
        });
      }
    }

    return { successes, failures, previewState };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!files.length) {
      setStatus({ message: 'กรุณาเลือกไฟล์ .xlsx อย่างน้อย 1 ไฟล์ก่อนอัปโหลด', state: 'error' });
      return;
    }

    if (files.length > (bootstrap.maxBatchFiles || 20)) {
      setStatus({
        message: `กรุณาเลือกไฟล์ไม่เกิน ${bootstrap.maxBatchFiles || 20} ไฟล์ต่อครั้ง`,
        state: 'error',
      });
      return;
    }

    setIsBusy(true);
    setWarnings([]);
    setResult(null);
    setStatus({ message: `กำลังเตรียมพรีวิว ${files.length} ไฟล์...`, state: 'working' });

    try {
      const batchResult = await processFilesSequentially(files);
      const warningItems = collectWarningItems(batchResult.successes, batchResult.failures);

      setWarnings(warningItems);
      setResult(batchResult);
      setStatus({
        message: buildBatchStatus(batchResult.successes, batchResult.failures, warningItems.length),
        state: getBatchState(batchResult.successes, batchResult.failures, warningItems.length),
      });
      onProcessingComplete?.();
    } catch (error) {
      setStatus({ message: error?.message || 'ประมวลผลไฟล์ไม่สำเร็จ', state: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="panel">
      <p className="panel-eyebrow">{eyebrow}</p>
      <p className="panel-copy">{copy}</p>

      <form className="upload-form" onSubmit={handleSubmit}>
        <input name="formatterMode" type="hidden" value={formatterMode} />

        <label className="field" htmlFor={inputId}>
          <span>Workbook files (.xlsx)</span>
          <input
            accept=".xlsx"
            disabled={isBusy}
            id={inputId}
            multiple
            name={`workbook-${formatterMode}`}
            onChange={handleFileChange}
            ref={fileInputRef}
            required
            type="file"
          />
        </label>

        <p className="selected-file">{getSelectedFilesLabel(files)}</p>

        <button type="submit" disabled={isBusy}>
          {isBusy
            ? `กำลังเตรียม${files.length > 1 ? ` ${files.length} ไฟล์...` : 'พรีวิว...'}`
            : 'เตรียมพร้อมพรีวิว'}
        </button>
      </form>

      <section className="status-panel" aria-live="polite">
        <p className="status" data-state={status.state}>
          {status.message}
        </p>

        {!!warnings.length && (
          <ul className="warnings">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}

        {result?.successes?.length > 0 && (
          <div className="result">
            <p>
              {result.successes.length}
              {' '}
              ไฟล์พร้อมใช้งาน กรุณาเปิดพรีวิวเวิร์คบุ๊คก่อน หากต้องการไฟล์แยกสาขาสามารถใช้ลิงก์ดาวน์โหลดด้านล่างได้
              {result.failures.length ? ` มีไฟล์ไม่สำเร็จ ${result.failures.length} ไฟล์` : ''}
            </p>
            <p>
              <a href={result.previewState.url || '#'} target="_blank" rel="noopener noreferrer">
                ดาวน์โหลดพรีวิวเวิร์คบุ๊ค
              </a>
            </p>
            <ul className="results-list">
              {result.successes.map((payload) => (
                <li key={`${payload.driveFileId}-${payload.filename}`}>
                  <a href={payload.downloadUrl || '#'} target="_blank" rel="noopener noreferrer">
                    {payload.filename}
                  </a>
                  <div className="result-meta">
                    รูปแบบ: {payload.variant}. ตรวจพบ: {payload.detectedVariant}. รหัสไฟล์:{' '}
                    {payload.driveFileId}.
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </section>
  );
}
