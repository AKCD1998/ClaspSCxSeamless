export const SHOPEE_EMAIL_CATEGORY_LABELS = {
  order_confirmed: 'ยืนยันคำสั่งซื้อ COD',
  shipment_due: 'ถึงเวลาจัดส่ง',
  order_cancelled: 'ยกเลิกคำสั่งซื้อ',
  out_of_stock: 'สินค้าหมด',
  security_alert: 'ความปลอดภัยบัญชี',
  seller_return_delivery: 'พัสดุส่งคืนผู้ขาย',
  other: 'อื่น ๆ',
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
