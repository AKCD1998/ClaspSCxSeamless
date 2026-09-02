import { useEffect, useReducer, useRef, useState } from 'react';
import ShopeeOrderTimelineView from './ShopeeOrderTimelineView.jsx';
import {
  getSession,
  getShopeeFinancialVisibility,
  getShopeeOrder,
  getShopeeOrders,
  syncShopeeOrders,
  updateShopeeFinancialVisibility,
} from '../services/api.js';
import {
  DEFAULT_USER_FINANCIAL_VISIBILITY,
  normalizeShopeeFinancialVisibility,
} from './shopeeFinancialVisibility.js';

export const SHOPEE_ALL_SHOPS_SCOPE = 'all';
const DEFAULT_FILTERS = {
  limit: 25,
  page: 1,
  search: '',
  shopCode: SHOPEE_ALL_SHOPS_SCOPE,
  sortBy: 'lastEventAt',
  sortOrder: 'desc',
  status: '',
};
const SYNCABLE_SHOP_CODES = new Set(['sc-drug-store', 'dr-morepen']);

export function normalizeShopeeOrderSearch(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

export function getShopeeOrderIdentity(order) {
  const shopCode = String(order?.shopCode || '').trim();
  const orderNumber = String(order?.orderNumber || '').trim();
  return shopCode && orderNumber ? `${shopCode}:${orderNumber}` : orderNumber;
}

export function isSyncableShopeeShopCode(shopCode) {
  return SYNCABLE_SHOP_CODES.has(shopCode);
}

export const INITIAL_SHOPEE_ORDER_STATE = {
  generation: 0,
  isLoading: false,
  orders: [],
  page: 1,
  pageSize: 25,
  status: { message: 'กำลังโหลด', state: 'idle' },
  totalCount: 0,
  totalPages: 0,
};

export function shopeeOrderReducer(state, action) {
  if (
    !['replacement_started', 'shop_required'].includes(action.type) &&
    action.generation !== state.generation
  ) {
    return state;
  }

  switch (action.type) {
    case 'replacement_started':
      return {
        ...state,
        generation: action.generation,
        isLoading: true,
        orders: [],
        status: { message: 'กำลังโหลดไทม์ไลน์คำสั่งซื้อ...', state: 'working' },
      };
    case 'replacement_succeeded': {
      const orders = action.response?.orders || [];
      return {
        ...state,
        isLoading: false,
        orders,
        page: action.response?.page || 1,
        pageSize: action.response?.pageSize || 25,
        status: {
          message: orders.length
            ? `พบคำสั่งซื้อ ${action.response?.totalCount ?? orders.length} รายการ`
            : 'ยังไม่มีข้อมูลคำสั่งซื้อ',
          state: orders.length ? 'success' : 'warning',
        },
        totalCount: action.response?.totalCount ?? orders.length,
        totalPages: action.response?.totalPages ?? (orders.length ? 1 : 0),
      };
    }
    case 'replacement_failed':
      return {
        ...state,
        isLoading: false,
        status: { message: action.message || 'โหลดไทม์ไลน์ไม่สำเร็จ', state: 'error' },
      };
    case 'shop_required':
      return {
        ...state,
        generation: action.generation,
        isLoading: false,
        orders: [],
        page: 1,
        totalCount: 0,
        totalPages: 0,
        status: { message: 'กรุณาเลือกร้าน Shopee', state: 'warning' },
      };
    default:
      return state;
  }
}

export function isShopeeShopRequestCurrent(filtersRef, shopCode) {
  return filtersRef.current.shopCode === shopCode;
}

export function isShopeeDetailRequestCurrent({
  filtersRef,
  orderNumber,
  selectedOrderRef,
  shopCode,
  viewShopScope,
}) {
  const selectedOrder = selectedOrderRef.current;
  return (
    selectedOrder?.orderNumber === orderNumber &&
    selectedOrder?.shopCode === shopCode &&
    isShopeeShopRequestCurrent(filtersRef, viewShopScope)
  );
}

export async function syncShopeeOrdersAndRefresh({
  cursor,
  filtersRef,
  loadOrders,
  onSynced,
  syncRequest = syncShopeeOrders,
}) {
  const shopCode = filtersRef.current.shopCode;
  if (!isSyncableShopeeShopCode(shopCode)) {
    throw new Error('กรุณาเลือกร้าน SC Drug Store หรือ DR.Morepen ก่อนซิงก์');
  }
  const result = await syncRequest({
    cursor,
    limit: 25,
    shopCode,
  });
  if (isShopeeShopRequestCurrent(filtersRef, shopCode) && onSynced) onSynced(result);
  await loadOrders(filtersRef.current);
  return result;
}

export default function ShopeeOrderTimelinePanel() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState(DEFAULT_FILTERS.search);
  const [orderState, dispatch] = useReducer(shopeeOrderReducer, INITIAL_SHOPEE_ORDER_STATE);
  const [appRole, setAppRole] = useState('user');
  const [financialVisibility, setFinancialVisibility] = useState(
    DEFAULT_USER_FINANCIAL_VISIBILITY,
  );
  const [userFinancialVisibility, setUserFinancialVisibility] = useState(
    DEFAULT_USER_FINANCIAL_VISIBILITY,
  );
  const [financialVisibilityStatus, setFinancialVisibilityStatus] = useState({
    message: '',
    state: 'idle',
  });
  const [isSavingFinancialVisibility, setIsSavingFinancialVisibility] = useState(false);
  const [selectedOrderKey, setSelectedOrderKey] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState({ message: '', state: 'idle' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCursor, setSyncCursor] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ message: '', state: 'idle' });
  const filtersRef = useRef(DEFAULT_FILTERS);
  const requestSequenceRef = useRef(0);
  const selectedOrderRef = useRef(null);
  const detailCacheRef = useRef({});
  const {
    isLoading,
    orders,
    page,
    pageSize,
    status,
    totalCount,
    totalPages,
  } = orderState;

  function closeDetail() {
    selectedOrderRef.current = null;
    setSelectedOrderKey(null);
    setOrderDetail(null);
    setDetailStatus({ message: '', state: 'idle' });
  }

  async function loadOrders(activeFilters) {
    const generation = requestSequenceRef.current + 1;
    requestSequenceRef.current = generation;
    if (!activeFilters.shopCode) {
      dispatch({ type: 'shop_required', generation });
      return;
    }
    dispatch({ type: 'replacement_started', generation });

    try {
      const response = await getShopeeOrders(activeFilters);
      if (requestSequenceRef.current !== generation) return;
      setFinancialVisibility(normalizeShopeeFinancialVisibility(response?.financialVisibility));
      dispatch({ type: 'replacement_succeeded', generation, response });
    } catch (error) {
      if (requestSequenceRef.current !== generation) return;
      dispatch({ type: 'replacement_failed', generation, message: error?.message });
    }
  }

  async function loadDetail(order) {
    const orderNumber = order?.orderNumber;
    const viewShopScope = filtersRef.current.shopCode;
    const shopCode = order?.shopCode
      || (isSyncableShopeeShopCode(viewShopScope) ? viewShopScope : '');
    if (!orderNumber || !shopCode) return;
    setDetailStatus({ message: 'กำลังโหลดรายละเอียด...', state: 'working' });
    try {
      const detail = await getShopeeOrder(orderNumber, { shopCode });
      if (!isShopeeDetailRequestCurrent({
        filtersRef,
        orderNumber,
        selectedOrderRef,
        shopCode,
        viewShopScope,
      })) return;
      detailCacheRef.current[`${shopCode}:${orderNumber}`] = detail;
      setOrderDetail(detail);
      setDetailStatus({ message: '', state: 'success' });
    } catch (error) {
      if (!isShopeeDetailRequestCurrent({
        filtersRef,
        orderNumber,
        selectedOrderRef,
        shopCode,
        viewShopScope,
      })) return;
      setDetailStatus({ message: error?.message || 'โหลดรายละเอียดไม่สำเร็จ', state: 'error' });
    }
  }

  function handleToggleDetail(order) {
    const orderNumber = order?.orderNumber;
    const shopCode = order?.shopCode
      || (isSyncableShopeeShopCode(filtersRef.current.shopCode)
        ? filtersRef.current.shopCode
        : '');
    if (!orderNumber || !shopCode) return;
    const orderIdentity = { orderNumber, shopCode };
    const orderKey = getShopeeOrderIdentity(orderIdentity);
    if (getShopeeOrderIdentity(selectedOrderRef.current) === orderKey) {
      closeDetail();
      return;
    }

    selectedOrderRef.current = orderIdentity;
    setSelectedOrderKey(orderKey);
    const cached = detailCacheRef.current[orderKey];
    if (cached) {
      setOrderDetail(cached);
      setDetailStatus({ message: '', state: 'success' });
      return;
    }
    setOrderDetail(null);
    loadDetail(orderIdentity);
  }

  async function handleSync(cursor = null) {
    if (
      appRole !== 'admin'
      || isSyncing
      || !isSyncableShopeeShopCode(filtersRef.current.shopCode)
    ) return;
    const shopCode = filtersRef.current.shopCode;
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
      if (!isShopeeShopRequestCurrent(filtersRef, shopCode)) return;
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
    const timer = window.setTimeout(() => {
      const search = normalizeShopeeOrderSearch(searchInput);
      if (filtersRef.current.search === search) return;
      const nextFilters = { ...filtersRef.current, page: 1, search };
      filtersRef.current = nextFilters;
      setFilters(nextFilters);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then(async (payload) => {
        if (cancelled || payload?.role !== 'admin') return;
        setAppRole('admin');
        setFinancialVisibilityStatus({ message: 'กำลังโหลดการตั้งค่าสิทธิ์...', state: 'working' });
        try {
          const response = await getShopeeFinancialVisibility();
          if (cancelled) return;
          setUserFinancialVisibility(normalizeShopeeFinancialVisibility(
            response?.userFinancialVisibility,
          ));
          setFinancialVisibilityStatus({ message: '', state: 'success' });
        } catch (error) {
          if (!cancelled) {
            setFinancialVisibilityStatus({
              message: error?.message || 'โหลดการตั้งค่าสิทธิ์ไม่สำเร็จ',
              state: 'error',
            });
          }
        }
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
    const nextFilters = { ...filtersRef.current, [name]: value, page: 1 };
    filtersRef.current = nextFilters;
    const generation = requestSequenceRef.current + 1;
    requestSequenceRef.current = generation;
    dispatch({ type: 'replacement_started', generation });
    if (name === 'shopCode') {
      setSyncCursor(null);
      setSyncStatus({ message: '', state: 'idle' });
      detailCacheRef.current = {};
      closeDetail();
    }
    setFilters(nextFilters);
  }

  function handleSearchChange(event) {
    setSearchInput(event.target.value);
  }

  function handleFinancialVisibilityChange(event) {
    const { checked, name } = event.target;
    setUserFinancialVisibility((current) => ({ ...current, [name]: checked }));
    setFinancialVisibilityStatus({ message: '', state: 'idle' });
  }

  async function handleSaveFinancialVisibility() {
    if (appRole !== 'admin' || isSavingFinancialVisibility) return;
    setIsSavingFinancialVisibility(true);
    setFinancialVisibilityStatus({ message: 'กำลังบันทึกสิทธิ์...', state: 'working' });
    try {
      const settings = {
        shippingFee: userFinancialVisibility.shippingFee,
        totalAmount: userFinancialVisibility.totalAmount,
        unitPrice: userFinancialVisibility.unitPrice,
      };
      const response = await updateShopeeFinancialVisibility(settings);
      setUserFinancialVisibility(normalizeShopeeFinancialVisibility(
        response?.userFinancialVisibility,
      ));
      setFinancialVisibilityStatus({
        message: 'บันทึกแล้ว ผู้ใช้ทั่วไปจะเห็นข้อมูลตามสิทธิ์นี้เมื่อโหลดหน้าใหม่',
        state: 'success',
      });
    } catch (error) {
      setFinancialVisibilityStatus({
        message: error?.message || 'บันทึกการตั้งค่าสิทธิ์ไม่สำเร็จ',
        state: 'error',
      });
    } finally {
      setIsSavingFinancialVisibility(false);
    }
  }

  function handlePageChange(nextPage) {
    if (isLoading || nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    closeDetail();
    const nextFilters = { ...filtersRef.current, page: nextPage };
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
  }

  return (
    <ShopeeOrderTimelineView
      appRole={appRole}
      canSync={isSyncableShopeeShopCode(filters.shopCode)}
      detailStatus={detailStatus}
      financialVisibility={financialVisibility}
      financialVisibilityStatus={financialVisibilityStatus}
      filters={filters}
      isLoading={isLoading}
      isSyncing={isSyncing}
      isSavingFinancialVisibility={isSavingFinancialVisibility}
      onFinancialVisibilityChange={handleFinancialVisibilityChange}
      onFilterChange={handleFilterChange}
      onSearchChange={handleSearchChange}
      onSaveFinancialVisibility={handleSaveFinancialVisibility}
      onPageChange={handlePageChange}
      onRetry={() => loadOrders(filters)}
      onRetryDetail={() => selectedOrderRef.current && loadDetail(selectedOrderRef.current)}
      onSyncLatest={() => handleSync(null)}
      onSyncOlder={() => handleSync(syncCursor)}
      onToggleDetail={handleToggleDetail}
      orderDetail={orderDetail}
      orders={orders}
      page={page}
      pageSize={pageSize}
      selectedOrderKey={selectedOrderKey}
      searchValue={searchInput}
      status={status}
      syncCursor={syncCursor}
      syncStatus={syncStatus}
      totalCount={totalCount}
      totalPages={totalPages}
      userFinancialVisibility={userFinancialVisibility}
    />
  );
}
