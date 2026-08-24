import { useEffect, useReducer, useRef, useState } from 'react';
import ShopeeOrderTimelineView from './ShopeeOrderTimelineView.jsx';
import {
  getSession,
  getShopeeOrder,
  getShopeeOrders,
  syncShopeeOrders,
} from '../services/api.js';

const EMPTY_FILTERS = { status: '' };

export const INITIAL_SHOPEE_ORDER_STATE = {
  generation: 0,
  isLoading: false,
  isLoadingMore: false,
  nextCursor: null,
  orders: [],
  status: { message: 'กำลังโหลด', state: 'idle' },
};

export function shopeeOrderReducer(state, action) {
  if (action.type !== 'replacement_started' && action.generation !== state.generation) {
    return state;
  }

  switch (action.type) {
    case 'replacement_started':
      return {
        ...state,
        generation: action.generation,
        isLoading: true,
        isLoadingMore: false,
        nextCursor: null,
        orders: [],
        status: { message: 'กำลังโหลดไทม์ไลน์คำสั่งซื้อ...', state: 'working' },
      };
    case 'replacement_succeeded': {
      const orders = action.response?.orders || [];
      return {
        ...state,
        isLoading: false,
        nextCursor: action.response?.nextCursor || null,
        orders,
        status: {
          message: orders.length ? `พบคำสั่งซื้อ ${orders.length} รายการ` : 'ยังไม่มีข้อมูลคำสั่งซื้อ',
          state: orders.length ? 'success' : 'warning',
        },
      };
    }
    case 'replacement_failed':
      return {
        ...state,
        isLoading: false,
        status: { message: action.message || 'โหลดไทม์ไลน์ไม่สำเร็จ', state: 'error' },
      };
    case 'load_more_started':
      return { ...state, isLoadingMore: true };
    case 'load_more_succeeded': {
      const existingNumbers = new Set(state.orders.map((order) => order.orderNumber));
      const appended = (action.response?.orders || []).filter(
        (order) => !existingNumbers.has(order.orderNumber),
      );
      return {
        ...state,
        isLoadingMore: false,
        nextCursor: action.response?.nextCursor || null,
        orders: [...state.orders, ...appended],
        status: {
          message: appended.length
            ? `แสดงคำสั่งซื้อ ${state.orders.length + appended.length} รายการ`
            : 'ไม่มีคำสั่งซื้อเพิ่มในหน้านี้',
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

export async function syncShopeeOrdersAndRefresh({
  cursor,
  filtersRef,
  loadOrders,
  onSynced,
  syncRequest = syncShopeeOrders,
}) {
  const result = await syncRequest({ cursor, limit: 25 });
  if (onSynced) onSynced(result);
  await loadOrders(filtersRef.current);
  return result;
}

export default function ShopeeOrderTimelinePanel() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [orderState, dispatch] = useReducer(shopeeOrderReducer, INITIAL_SHOPEE_ORDER_STATE);
  const [appRole, setAppRole] = useState('user');
  const [selectedOrderNumber, setSelectedOrderNumber] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState({ message: '', state: 'idle' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCursor, setSyncCursor] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ message: '', state: 'idle' });
  const filtersRef = useRef(EMPTY_FILTERS);
  const requestSequenceRef = useRef(0);
  const selectedOrderRef = useRef(null);
  const detailCacheRef = useRef({});
  const { isLoading, isLoadingMore, nextCursor, orders, status } = orderState;

  function closeDetail() {
    selectedOrderRef.current = null;
    setSelectedOrderNumber(null);
    setOrderDetail(null);
    setDetailStatus({ message: '', state: 'idle' });
  }

  async function loadOrders(activeFilters) {
    const generation = requestSequenceRef.current + 1;
    requestSequenceRef.current = generation;
    dispatch({ type: 'replacement_started', generation });

    try {
      const response = await getShopeeOrders(activeFilters);
      if (requestSequenceRef.current !== generation) return;
      dispatch({ type: 'replacement_succeeded', generation, response });
    } catch (error) {
      if (requestSequenceRef.current !== generation) return;
      dispatch({ type: 'replacement_failed', generation, message: error?.message });
    }
  }

  async function loadMoreOrders() {
    if (!nextCursor || isLoading || isLoadingMore) return;
    const generation = requestSequenceRef.current;
    dispatch({ type: 'load_more_started', generation });

    try {
      const response = await getShopeeOrders({ ...filters, cursor: nextCursor });
      if (requestSequenceRef.current !== generation) return;
      dispatch({ type: 'load_more_succeeded', generation, response });
    } catch (error) {
      if (requestSequenceRef.current !== generation) return;
      dispatch({ type: 'load_more_failed', generation, message: error?.message });
    }
  }

  async function loadDetail(orderNumber) {
    setDetailStatus({ message: 'กำลังโหลดรายละเอียด...', state: 'working' });
    try {
      const detail = await getShopeeOrder(orderNumber);
      if (selectedOrderRef.current !== orderNumber) return;
      detailCacheRef.current[orderNumber] = detail;
      setOrderDetail(detail);
      setDetailStatus({ message: '', state: 'success' });
    } catch (error) {
      if (selectedOrderRef.current !== orderNumber) return;
      setDetailStatus({ message: error?.message || 'โหลดรายละเอียดไม่สำเร็จ', state: 'error' });
    }
  }

  function handleToggleDetail(order) {
    const orderNumber = order?.orderNumber;
    if (!orderNumber) return;
    if (selectedOrderRef.current === orderNumber) {
      closeDetail();
      return;
    }

    selectedOrderRef.current = orderNumber;
    setSelectedOrderNumber(orderNumber);
    const cached = detailCacheRef.current[orderNumber];
    if (cached) {
      setOrderDetail(cached);
      setDetailStatus({ message: '', state: 'success' });
      return;
    }
    setOrderDetail(null);
    loadDetail(orderNumber);
  }

  async function handleSync(cursor = null) {
    if (appRole !== 'admin' || isSyncing) return;
    setIsSyncing(true);
    setSyncStatus({ message: 'กำลังอ่านอีเมล Shopee หนึ่งหน้า...', state: 'working' });
    try {
      await syncShopeeOrdersAndRefresh({
        cursor,
        filtersRef,
        loadOrders,
        onSynced: (result) => {
          setSyncCursor(result?.nextCursor || null);
          setSyncStatus({
            message: `บันทึกเหตุการณ์ใหม่ ${result?.storedEvents || 0} รายการ, ซ้ำ ${result?.deduplicatedEvents || 0} รายการ, ข้าม ${result?.skippedMessages || 0} รายการ`,
            state: 'success',
          });
          detailCacheRef.current = {};
          closeDetail();
        },
      });
    } catch (error) {
      setSyncStatus({ message: error?.message || 'ซิงก์อีเมลไม่สำเร็จ', state: 'error' });
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    closeDetail();
    loadOrders(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((payload) => {
        if (!cancelled && payload?.role === 'admin') setAppRole('admin');
      })
      .catch(() => {
        // Safe default: sync controls remain hidden, while the backend enforces the same role.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    const nextFilters = { ...filtersRef.current, [name]: value };
    filtersRef.current = nextFilters;
    const generation = requestSequenceRef.current + 1;
    requestSequenceRef.current = generation;
    dispatch({ type: 'replacement_started', generation });
    setFilters(nextFilters);
  }

  return (
    <ShopeeOrderTimelineView
      appRole={appRole}
      detailStatus={detailStatus}
      filters={filters}
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      isSyncing={isSyncing}
      nextCursor={nextCursor}
      onFilterChange={handleFilterChange}
      onLoadMore={loadMoreOrders}
      onRetry={() => loadOrders(filters)}
      onRetryDetail={() => selectedOrderRef.current && loadDetail(selectedOrderRef.current)}
      onSyncLatest={() => handleSync(null)}
      onSyncOlder={() => handleSync(syncCursor)}
      onToggleDetail={handleToggleDetail}
      orderDetail={orderDetail}
      orders={orders}
      selectedOrderNumber={selectedOrderNumber}
      status={status}
      syncCursor={syncCursor}
      syncStatus={syncStatus}
    />
  );
}
