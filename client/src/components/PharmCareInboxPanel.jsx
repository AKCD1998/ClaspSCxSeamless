import { useEffect, useState } from 'react';
import PharmCareInboxView from './PharmCareInboxView.jsx';
import { getPharmcareInbox } from '../services/api.js';

const emptyFilters = {
  status: '',
  documentType: '',
  duplicate: '',
};

export default function PharmCareInboxPanel() {
  const [filters, setFilters] = useState(emptyFilters);
  const [documents, setDocuments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState({ message: 'กำลังโหลด', state: 'idle' });
  const [isLoading, setIsLoading] = useState(false);

  async function loadInbox(activeFilters) {
    setIsLoading(true);
    setStatus({ message: 'กำลังโหลด PharmCare Inbox...', state: 'working' });

    try {
      const response = await getPharmcareInbox(activeFilters);
      const nextDocuments = response?.documents || [];
      setDocuments(nextDocuments);
      setSummary(response?.summary || null);
      setStatus({
        message: nextDocuments.length ? `พบเอกสาร ${nextDocuments.length} รายการ` : 'ไม่พบเอกสาร',
        state: nextDocuments.length ? 'success' : 'warning',
      });
    } catch (error) {
      setStatus({
        message: error?.message || 'โหลด PharmCare Inbox ไม่สำเร็จ',
        state: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadInbox(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleRetry() {
    loadInbox(filters);
  }

  return (
    <PharmCareInboxView
      documents={documents}
      filters={filters}
      isLoading={isLoading}
      onFilterChange={handleFilterChange}
      onRetry={handleRetry}
      status={status}
      summary={summary}
    />
  );
}
