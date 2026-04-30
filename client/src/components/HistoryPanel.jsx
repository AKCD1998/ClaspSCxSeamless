import { useEffect, useMemo, useState } from 'react';
import HistoryDashboard from './HistoryDashboard.jsx';
import HistoryGrouped from './HistoryGrouped.jsx';
import HistoryTable from './HistoryTable.jsx';
import {
  fetchProcessingHistory,
  markProcessingHistoryPrinted,
  markProcessingHistoryUnprinted,
} from '../services/api.js';

const emptyFilters = {
  reportType: '',
  reportDate: '',
  printed: '',
};

function normalizeHistoryFilterBoolean(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }

  return String(value).toLowerCase() === 'true';
}

function filterProcessingHistoryRecords(records, filters) {
  const printedFilter = normalizeHistoryFilterBoolean(filters.printed);

  return (records || []).filter((record) => {
    if (filters.reportType && record.reportType !== filters.reportType) {
      return false;
    }

    if (filters.reportDate && record.reportDate !== filters.reportDate) {
      return false;
    }

    if (printedFilter !== null && !!record.printed !== printedFilter) {
      return false;
    }

    return true;
  });
}

export default function HistoryPanel({ reloadKey }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [records, setRecords] = useState([]);
  const [currentView, setCurrentView] = useState('table');
  const [status, setStatus] = useState({ message: 'กำลังโหลด', state: 'idle' });
  const [isLoading, setIsLoading] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState('');

  const filteredRecords = useMemo(
    () => filterProcessingHistoryRecords(records, filters),
    [filters, records],
  );

  async function loadProcessingHistory(options = {}) {
    setIsLoading(true);
    setStatus({ message: 'กำลังโหลดประวัติการจัดการไฟล์...', state: 'working' });

    try {
      const response = await fetchProcessingHistory({});
      const nextRecords = Array.isArray(response) ? response : response.records || [];

      setRecords(nextRecords);
      const nextFilteredRecords = filterProcessingHistoryRecords(nextRecords, filters);
      setStatus({
        message:
          options.successMessage ||
          (nextFilteredRecords.length
            ? `พบประวัติการดำเนินการ ${nextFilteredRecords.length} รายการ`
            : 'ไม่พบประวัติการดำเนินการ'),
        state: options.successMessage ? 'success' : nextFilteredRecords.length ? 'success' : 'warning',
      });
    } catch (error) {
      setStatus({
        message: error?.message || 'โหลดประวัติการดำเนินการไม่สำเร็จ',
        state: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProcessingHistory();
  }, [reloadKey]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    const nextValue = name === 'reportDate'
      ? String(value || '').replace(/[^0-9]/g, '').slice(0, 8)
      : value;

    setFilters((current) => ({ ...current, [name]: nextValue }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextFilteredRecords = filterProcessingHistoryRecords(records, filters);
    setStatus({
      message: nextFilteredRecords.length
        ? `พบประวัติการดำเนินการ ${nextFilteredRecords.length} รายการ`
        : 'ไม่พบประวัติการดำเนินการ',
      state: nextFilteredRecords.length ? 'success' : 'warning',
    });
  }

  function handleClearFilters() {
    setFilters(emptyFilters);
    setStatus({ message: 'ล้างการกรองแล้ว', state: 'success' });
  }

  function handleSelectReportDate(reportDate) {
    setFilters((current) => ({ ...current, reportDate }));
    setStatus({
      message: `กรองประวัติการดำเนินการสำหรับวันที่ ${reportDate.slice(0, 4)}-${reportDate.slice(4, 6)}-${reportDate.slice(6, 8)} แล้ว`,
      state: 'success',
    });
  }

  async function handlePrintAction(action, record) {
    const isPrintedAction = action === 'printed';
    const confirmMessage = isPrintedAction
      ? `ยืนยันว่าปริ้นท์ไฟล์นี้ส่งพี่เอแล้ว?\n\n${record.filename || ''}`
      : `ยืนยันเปลี่ยนสถานะเป็นยังไม่ได้ปริ้นท์?\n\n${record.filename || ''}`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setBusyRecordId(record.id);
    setStatus({
      message: isPrintedAction
        ? 'กำลังบันทึกสถานะว่าปริ้นท์ส่งพี่เอแล้ว...'
        : 'กำลังบันทึกสถานะว่ายังไม่ได้ปริ้นท์...',
      state: 'working',
    });

    try {
      const response = isPrintedAction
        ? await markProcessingHistoryPrinted(record.id)
        : await markProcessingHistoryUnprinted(record.id);

      await loadProcessingHistory({
        successMessage:
          response?.message ||
          (isPrintedAction
            ? 'บันทึกสถานะว่าปริ้นท์ส่งพี่เอแล้ว'
            : 'บันทึกสถานะว่ายังไม่ได้ปริ้นท์แล้ว'),
      });
    } catch (error) {
      setStatus({
        message: error?.message || 'อัปเดตสถานะการปริ้นท์ไม่สำเร็จ',
        state: 'error',
      });
    } finally {
      setBusyRecordId('');
    }
  }

  return (
    <section className="panel history-panel">
      <p className="panel-eyebrow">ประวัติการจัดการไฟล์</p>
      <div className="history-heading">
        <div>
          <h2>รายการประวัติการดำเนินการ</h2>
        </div>
        <button disabled={isLoading} type="button" onClick={() => loadProcessingHistory()}>
          รีเฟรช
        </button>
      </div>

      <form className="history-filters" onSubmit={handleSubmit}>
        <label className="history-filter-field">
          <span>Report Type</span>
          <select name="reportType" value={filters.reportType} onChange={handleFilterChange}>
            <option value="">ทั้งหมด</option>
            <option value="summary">สรุปจำนวนการชดชยทั้งหมดในรอบนั้นๆ(Summary)</option>
            <option value="individual">แจกแจงการชดเชยรายคน(Individual)</option>
          </select>
        </label>

        <label className="history-filter-field">
          <span>วันที่ของรายงาน</span>
          <input
            inputMode="numeric"
            name="reportDate"
            onChange={handleFilterChange}
            placeholder="YYYYMMDD"
            type="text"
            value={filters.reportDate}
          />
        </label>

        <label className="history-filter-field">
          <span>ปริ้นท์ส่งพี่เอแล้ว</span>
          <select name="printed" value={filters.printed} onChange={handleFilterChange}>
            <option value="">ทั้งหมด</option>
            <option value="true">ปริ้นท์ส่งพี่เอแล้ว</option>
            <option value="false">ยังไม่ได้ปริ้นท์ส่งพี่เอ</option>
          </select>
        </label>

        <button disabled={isLoading} type="submit">
          เริ่มกรองการค้นหา
        </button>
        <button disabled={isLoading} id="history-clear-button" type="button" onClick={handleClearFilters}>
          ล้างการกรองเพิ่อค้นหา
        </button>
      </form>

      <HistoryDashboard
        activeReportDate={filters.reportDate}
        onSelectReportDate={handleSelectReportDate}
        records={records}
      />

      <div className="history-view-toggle" role="tablist" aria-label="History View">
        <button
          aria-pressed={currentView === 'table'}
          className={`history-view-button${currentView === 'table' ? '' : ' secondary'}`}
          type="button"
          onClick={() => setCurrentView('table')}
        >
          Table View
        </button>
        <button
          aria-pressed={currentView === 'grouped'}
          className={`history-view-button${currentView === 'grouped' ? '' : ' secondary'}`}
          type="button"
          onClick={() => setCurrentView('grouped')}
        >
          Grouped View
        </button>
      </div>

      <section className="status-panel history-status-panel" aria-live="polite">
        <p className="status" data-state={status.state}>
          {status.message}
        </p>

        {!filteredRecords.length ? (
          <div className="history-empty">ไม่พบการค้นหาที่ตรงกับการกรองนี้</div>
        ) : currentView === 'table' ? (
          <HistoryTable
            busyRecordId={busyRecordId}
            onPrintAction={handlePrintAction}
            records={filteredRecords}
          />
        ) : (
          <HistoryGrouped
            busyRecordId={busyRecordId}
            onPrintAction={handlePrintAction}
            records={filteredRecords}
          />
        )}
      </section>
    </section>
  );
}
