import assert from 'node:assert/strict';
import test from 'node:test';
import { allocationPolicyLabel } from '../src/components/shopeeAdaSmartCopy.js';

const policy = { type: 'bundle', method: 'primary_component_with_nominal_secondary_lines', primarySku: 'IC-004131',
  components: [
    { sku: 'IC-001230', factor: 2, weight: 0, nominalLineCentsPerSale: 10 },
    { sku: 'IC-004131', factor: 1, weight: 1 },
    { sku: 'IC-006009', factor: 1, weight: 0, nominalLineCentsPerSale: 10 },
  ] };
const label = next => allocationPolicyLabel({ policy: next });

test('main SKU is explicit and a two-box secondary line costs 0.10 per set, not per box', () => {
  const text = label(policy);
  assert.match(text, /^ต่อชุด: IC-004131 ×1 หน่วย POS รับยอดคงเหลือ/u);
  assert.match(text, /IC-001230 ×2 หน่วย POS รวม ฿0\.10 ต่อชุด/u);
  assert.match(text, /IC-006009 ×1 หน่วย POS รวม ฿0\.10 ต่อชุด/u);
  assert.doesNotMatch(text, /ของแถม|Dr\.Morepen|350|0\.00/u);
  assert.equal(label({ ...policy, components: [...policy.components].reverse() }).split('; ')[0], text.split('; ')[0]);
});

test('positive gift prices describe ERP base units instead of the whole secondary line', () => {
  const text = label({ type: 'bundle', method: 'paid_component_with_nominal_gift_price', components: [
    { sku: 'IC-005185', factor: 2, weight: 1 },
    { sku: 'IC-005557', factor: 2, weight: 0, freeGift: true, giftUnitPriceCents: 10 },
  ] });
  assert.match(text, /IC-005557 ×2 หน่วย POS ของแถม ฿0\.10 ต่อหน่วย POS/u);
  assert.doesNotMatch(text, /รวม ฿0\.10 ต่อชุด|Dr\.Morepen|350|0\.00/u);
});

test('legacy free gifts and equal allocations use actual SKUs and source amount', () => {
  const components = [{ sku: 'FIRST', factor: 2, weight: 1 }, { sku: 'SECOND', factor: 1, weight: 0, freeGift: true }];
  assert.match(label({ type: 'bundle', method: 'paid_component_and_free_gift', components }), /SECOND ×1 หน่วย POS ของแถม ราคา 0\.00/u);
  const equal = label({ type: 'bundle', method: 'equal_components', sourcePriceCentsPerSale: 40101,
    components: components.map(({ freeGift, ...part }) => ({ ...part, weight: 1 })) });
  assert.match(equal, /ชุด ฿401\.01 แบ่งยอดเท่ากันระหว่าง FIRST ×2 หน่วย POS \+ SECOND ×1 หน่วย POS/u);
  assert.doesNotMatch(equal, /Dr\.Morepen|350|175/u);
});

test('unknown, incomplete or conflicting policies do not invent brand, amounts or zero prices', () => {
  for (const next of [null, {}, { ...policy, method: 'future_method' }, { ...policy, primarySku: 'MISSING' },
    { ...policy, components: policy.components.map((part, index) => index === 0 ? { ...part, factor: 0 } : part) },
    ...[undefined, null, 0, -1, '10', NaN, Infinity, 0.1].map(nominalLineCentsPerSale => ({ ...policy,
      components: policy.components.map((part, index) => index === 0 ? { ...part, nominalLineCentsPerSale } : part) })),
    { ...policy, components: policy.components.map((part, index) => index === 0 ? { ...part, freeGift: true } : part) },
  ]) assert.equal(label(next), 'กติกาแบ่งราคาชุดที่เจ้าของร้านอนุมัติ');
});

test('seller voucher description is used only for the supported proportional method', () => {
  assert.match(label({ type: 'seller_voucher', method: 'proportional_net_merchandise_largest_remainder' }), /ส่วนลดร้านค้า: แบ่งตามสัดส่วน/u);
  assert.equal(label({ type: 'seller_voucher', method: 'unknown' }), 'กติกาแบ่งราคาชุดที่เจ้าของร้านอนุมัติ');
});
