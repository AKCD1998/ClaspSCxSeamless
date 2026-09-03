import { useEffect, useReducer, useRef, useState } from 'react';
import ShopeeEmailInboxView from './ShopeeEmailInboxView.jsx';
import { getShopeeEmailInbox, getShopeeInboxOverview } from '../services/api.js';

export const DEFAULT_SHOPEE_INBOX_FILTERS = Object.freeze({
  category: '',
  receivedFrom: '',
  receivedTo: '',
  shopCode: 'all',
});

const DEFAULT_SOURCE = 'info@mail.shopee.co.th';

export function getBangkokTodayString(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getShopeeEmailIdentity(email) {
  return `${email?.shopCode || ''}:${email?.id || ''}`;
}

export const INITIAL_SHOPEE_INBOX_STATE = {
  emails: [],
  generation: 0,
  isLoading: false,
  isLoadingMore: false,
  nextCursor: null,
  source: DEFAULT_SOURCE,
  status: { message: 'กำลังโหลด', state: 'idle' },
};

export function shopeeInboxReducer(state, action) {
  if (
    action.type !== 'replacement_started' &&
    action.generation !== state.generation
  ) {
    return state;
  }

  switch (action.type) {
    case 'replacement_started':
      return {
        ...state,
        emails: [],
        generation: action.generation,
        isLoading: true,
        isLoadingMore: false,
        nextCursor: null,
        status: { message: 'กำลังโหลดอีเมล Shopee จาก Gmail...', state: 'working' },
      };
    case 'replacement_succeeded': {
      const emails = action.response?.emails || [];
      return {
        ...state,
        emails,
        isLoading: false,
        nextCursor: action.response?.nextCursor || null,
        source: action.response?.source || DEFAULT_SOURCE,
        status: {
          message: emails.length ? `พบอีเมล ${emails.length} รายการ` : 'ไม่พบอีเมล',
          state: emails.length ? 'success' : 'warning',
        },
      };
    }
    case 'replacement_failed':
      return {
        ...state,
        isLoading: false,
        status: { message: action.message || 'โหลดอีเมล Shopee ไม่สำเร็จ', state: 'error' },
      };
    case 'load_more_started':
      return { ...state, isLoadingMore: true };
    case 'load_more_succeeded': {
      const existingIds = new Set(state.emails.map(getShopeeEmailIdentity));
      const appended = (action.response?.emails || []).filter(
        (email) => !existingIds.has(getShopeeEmailIdentity(email)),
      );
      return {
        ...state,
        emails: [...state.emails, ...appended],
        isLoadingMore: false,
        nextCursor: action.response?.nextCursor || null,
        status: {
          message: appended.length ? `โหลดเพิ่มแล้ว ${appended.length} รายการ` : 'ไม่มีรายการใหม่ในหน้านี้',
          state: appended.length ? 'success' : 'warning',
        },
      };
    }
    case 'load_more_failed':
      return {
        ...state,
        isLoadingMore: false,
        status: { message: action.message || 'โหลดเพิ่มไม่สำเร็จ', state: 'error' },
      };
    default:
      return state;
  }
}

export function applyShopeeEmailFilterChange(current, name, value) {
  const next = { ...current, [name]: value };
  if (name === 'receivedFrom' && value && next.receivedTo && value > next.receivedTo) {
    next.receivedTo = value;
  }
  if (name === 'receivedTo' && value && next.receivedFrom && value < next.receivedFrom) {
    next.receivedFrom = value;
  }
  return next;
}

export default function ShopeeEmailInboxPanel() {
  const [filters, setFilters] = useState(DEFAULT_SHOPEE_INBOX_FILTERS);
  const [inboxState, dispatch] = useReducer(shopeeInboxReducer, INITIAL_SHOPEE_INBOX_STATE);
  const [overview, setOverview] = useState(null);
  const [overviewStatus, setOverviewStatus] = useState({
    message: 'กำลังสรุปภาพรวมวันนี้...',
    state: 'working',
  });
  const { emails, isLoading, isLoadingMore, nextCursor, source, status } = inboxState;
  const overviewRequestSequenceRef = useRef(0);
  const requestSequenceRef = useRef(0);

  async function loadInbox(activeFilters) {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    dispatch({ type: 'replacement_started', generation: requestSequence });

    try {
      const response = await getShopeeEmailInbox(activeFilters);
      if (requestSequenceRef.current !== requestSequence) return;
      dispatch({ type: 'replacement_succeeded', generation: requestSequence, response });
    } catch (error) {
      if (requestSequenceRef.current !== requestSequence) return;
      dispatch({ type: 'replacement_failed', generation: requestSequence, message: error?.message });
    }
  }

  async function loadMoreInbox() {
    if (!nextCursor || isLoading || isLoadingMore) return;
    const requestSequence = requestSequenceRef.current;
    const activeCursor = nextCursor;
    dispatch({ type: 'load_more_started', generation: requestSequence });

    try {
      const response = await getShopeeEmailInbox({ ...filters, cursor: activeCursor });
      if (requestSequenceRef.current !== requestSequence) return;
      dispatch({ type: 'load_more_succeeded', generation: requestSequence, response });
    } catch (error) {
      if (requestSequenceRef.current !== requestSequence) return;
      dispatch({ type: 'load_more_failed', generation: requestSequence, message: error?.message });
    }
  }

  async function loadOverview(shopCode) {
    const requestSequence = overviewRequestSequenceRef.current + 1;
    overviewRequestSequenceRef.current = requestSequence;
    setOverview(null);
    setOverviewStatus({ message: 'กำลังสรุปภาพรวมวันนี้...', state: 'working' });
    try {
      const response = await getShopeeInboxOverview({
        date: getBangkokTodayString(),
        shopCode,
      });
      if (overviewRequestSequenceRef.current !== requestSequence) return;
      setOverview(response);
      setOverviewStatus({ message: 'อัปเดตภาพรวมแล้ว', state: 'success' });
    } catch (error) {
      if (overviewRequestSequenceRef.current !== requestSequence) return;
      setOverviewStatus({
        message: error?.message || 'โหลดภาพรวม Shopee ไม่สำเร็จ',
        state: 'error',
      });
    }
  }

  useEffect(() => {
    loadInbox(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    loadOverview(filters.shopCode);
    // Overview is always for today and only follows the selected shop, not the inbox category/date.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.shopCode]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    // Invalidate any in-flight page/load-more request immediately, before useEffect starts the
    // replacement fetch. Clearing rows/cursor prevents the previous filter's page from being
    // shown or paginated under the newly selected controls if that replacement later fails.
    const invalidationSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = invalidationSequence;
    dispatch({ type: 'replacement_started', generation: invalidationSequence });
    setFilters((current) => applyShopeeEmailFilterChange(current, name, value));
  }

  return (
    <ShopeeEmailInboxView
      emails={emails}
      filters={filters}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      nextCursor={nextCursor}
      onFilterChange={handleFilterChange}
      onLoadMore={loadMoreInbox}
      onRetry={() => loadInbox(filters)}
      onRetryOverview={() => loadOverview(filters.shopCode)}
      overview={overview}
      overviewStatus={overviewStatus}
      source={source}
      status={status}
    />
  );
}
