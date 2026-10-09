export const LIVE_LABELS = {
  payment: { paid: 'ผู้ซื้อชำระเงินแล้ว', unpaid: 'รอชำระเงิน', cod_pending: 'COD: ยังไม่มีหลักฐานรับเงิน' },
  fulfillment: { to_ship: 'ที่ต้องจัดส่ง', shipping: 'กำลังจัดส่ง', delivered: 'จัดส่งสำเร็จแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิกแล้ว' },
  refund: { requested: 'มีคำขอคืนสินค้า/เงิน', refunded: 'คืนเงินแล้ว', cancel_requested: 'ขอยกเลิก', closed: 'คำขอปิดแล้ว' },
  settlement: { pending: 'รายรับรอโอน', released: 'รายรับโอนแล้ว' },
};
export function liveStatusRows(snapshot, now = Date.now()) {
  if (!snapshot) return [];
  return Object.entries(LIVE_LABELS).flatMap(([axis, labels]) => {
    const proof = axis === 'payment' && snapshot.paidEvidence ? snapshot.paidEvidence : snapshot[axis];
    if (!proof || !labels[proof.value]) return [];
    const age = now - Date.parse(proof.observedAt);
    return [{ axis, text: labels[proof.value], observedAt: proof.observedAt,
      stale: !Number.isFinite(age) || age > (axis === 'payment' ? 30 : axis === 'fulfillment' ? 60 : 120) * 60000 }];
  });
}
