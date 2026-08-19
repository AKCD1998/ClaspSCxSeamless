import { useEffect, useRef, useState } from 'react';
import PharmCareInboxView from './PharmCareInboxView.jsx';
import { getPharmcareInbox, getPharmcareMessage } from '../services/api.js';

const emptyFilters = {
  status: '',
  documentType: '',
  duplicate: '',
};

export default function PharmCareInboxPanel() {
  const [filters, setFilters] = useState(emptyFilters);
  const [documents, setDocuments] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState({ message: 'กำลังโหลด', state: 'idle' });
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [messageDetail, setMessageDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState({ message: '', state: 'idle' });

  // Message content never changes once ingested, so fetched details are cached for the lifetime
  // of the panel — reopening a row is instant and only ever hits the API once.
  const detailCacheRef = useRef({});
  // Guards against applying a detail response after the user has already switched rows.
  const selectedMessageIdRef = useRef(null);

  async function loadInbox(activeFilters) {
    setIsLoading(true);
    setStatus({ message: 'กำลังโหลด PharmCare Inbox...', state: 'working' });

    try {
      const response = await getPharmcareInbox(activeFilters);
      const nextDocuments = response?.documents || [];
      setDocuments(nextDocuments);
      setSummary(response?.summary || null);
      setNextCursor(response?.nextCursor || null);
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

  async function loadMoreInbox() {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const response = await getPharmcareInbox({ ...filters, cursor: nextCursor });
      const page = response?.documents || [];
      const existingIds = new Set(documents.map((document) => document.id));
      const appended = page.filter((document) => !existingIds.has(document.id));

      if (appended.length) {
        setDocuments((current) => [...current, ...appended]);
      }
      setNextCursor(response?.nextCursor || null);
      setStatus({
        message: `แสดง ${documents.length + appended.length} รายการ`,
        state: 'success',
      });
    } catch (error) {
      setStatus({
        message: error?.message || 'โหลดเพิ่มไม่สำเร็จ',
        state: 'error',
      });
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function loadMessageDetail(messageId) {
    setDetailStatus({ message: 'กำลังโหลดรายละเอียด...', state: 'working' });

    try {
      const detail = await getPharmcareMessage(messageId);
      if (selectedMessageIdRef.current !== messageId) {
        return;
      }
      detailCacheRef.current[messageId] = detail;
      setMessageDetail(detail);
      setDetailStatus({ message: '', state: 'success' });
    } catch (error) {
      if (selectedMessageIdRef.current !== messageId) {
        return;
      }
      setDetailStatus({
        message: error?.message || 'โหลดรายละเอียดไม่สำเร็จ',
        state: 'error',
      });
    }
  }

  useEffect(() => {
    // A filter change refetches page 1 and swaps the whole list — any open detail row would then
    // point at a document that may no longer be visible, so close it.
    closeMessageDetail();
    loadInbox(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  function closeMessageDetail() {
    selectedMessageIdRef.current = null;
    setSelectedMessageId(null);
    setMessageDetail(null);
    setDetailStatus({ message: '', state: 'idle' });
  }

  function handleToggleMessageDetail(document) {
    const messageId = document?.messageId;
    if (!messageId) {
      return;
    }

    if (selectedMessageIdRef.current === messageId) {
      closeMessageDetail();
      return;
    }

    selectedMessageIdRef.current = messageId;
    setSelectedMessageId(messageId);

    const cached = detailCacheRef.current[messageId];
    if (cached) {
      setMessageDetail(cached);
      setDetailStatus({ message: '', state: 'success' });
      return;
    }

    setMessageDetail(null);
    loadMessageDetail(messageId);
  }

  function handleRetryDetail() {
    if (selectedMessageIdRef.current) {
      loadMessageDetail(selectedMessageIdRef.current);
    }
  }

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
      nextCursor={nextCursor}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMoreInbox}
      selectedMessageId={selectedMessageId}
      messageDetail={messageDetail}
      detailStatus={detailStatus}
      onToggleMessageDetail={handleToggleMessageDetail}
      onRetryDetail={handleRetryDetail}
      onFilterChange={handleFilterChange}
      onRetry={handleRetry}
      status={status}
      summary={summary}
    />
  );
}
