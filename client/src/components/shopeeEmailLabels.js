export const SHOPEE_EMAIL_CATEGORY_LABELS = {
  order_confirmed: 'ยืนยันคำสั่งซื้อ COD',
  shipment_due: 'ถึงเวลาจัดส่ง',
  order_cancelled: 'ยกเลิกคำสั่งซื้อ',
  out_of_stock: 'สินค้าหมด',
  security_alert: 'ความปลอดภัยบัญชี',
  seller_return_delivery: 'พัสดุส่งคืนผู้ขาย',
  other: 'อื่น ๆ',
};

export const SHOPEE_ORDER_STATUS_LABELS = {
  order_confirmed: 'ยืนยันคำสั่งซื้อ COD',
  shipment_due: 'ถึงเวลาจัดส่ง',
  seller_return_delivery: 'พัสดุส่งคืนผู้ขาย',
  order_cancelled: 'ยกเลิกคำสั่งซื้อ',
};

export const SHOPEE_CANCELLATION_REASON_LABELS = {
  shipping_deadline_missed: 'จัดส่งสินค้าไม่ทันเวลาที่กำหนด',
};

export function formatShopeeEmailReceivedAt(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

export function formatShopeeOrderDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

export function formatShopeeMoney(value) {
  if (value === null || value === undefined || value === '') return '-';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
