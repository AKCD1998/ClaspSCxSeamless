import { verifiedCopyColumns } from './shopeeAdaSmartCopy.js';

const VERSION = 'shopee-adasmart-sales-draft-v1';
const PURPOSE = 'aggregate_credit_sale';
const BRANCH = '004';
const DAY = 86400000;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/u.test(value || '')
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const positive = value => Number.isSafeInteger(value) && value > 0;
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
const visible = (value, limit) => typeof value === 'string' && value.trim()
  && value.length <= limit && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
const encoder = new TextEncoder();

function requireProof(condition, message) {
  if (!condition) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

async function digest(value) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(canonical(value))));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function creditSaleDateDefaults(endDate) {
  const end = Date.parse(endDate);
  return {
    documentDate: new Date(end + DAY).toISOString().slice(0, 10),
    lastDocumentDate: new Date(end + 93 * DAY).toISOString().slice(0, 10),
  };
}

export async function prepareCreditSaleFile(plan, filters, documentDate) {
  const period = Date.parse(plan?.endDate) - Date.parse(plan?.startDate);
  requireProof(Number.isFinite(period) && period >= 0 && period <= 92 * DAY,
    'ไฟล์ SR รองรับช่วงยอดขายไม่เกิน 93 วัน');
  const { lastDocumentDate } = creditSaleDateDefaults(plan.endDate);
  requireProof(validDate(documentDate) && documentDate >= plan.endDate && documentDate <= lastDocumentDate,
    'วันที่เอกสาร SR ต้องอยู่ระหว่างวันสิ้นสุดช่วงยอดขายและ 93 วันถัดไป');
  requireProof(verifiedCopyColumns(plan, filters) && plan.timezone === 'Asia/Bangkok' && plan.dateBasis === 'paid_at'
    && (plan.copyIdentityReadStatus === 'available'
      || (plan.shopCode === 'dr-morepen' && plan.copyIdentityReadStatus === 'not_requested'))
    && Array.isArray(plan.issues) && plan.issues.length === 0 && plan.varianceCents === 0
    && positive(plan.targetCents) && positive(plan.orderCount) && plan.orderCount <= 10000 && plan.rows.length <= 2000
    && visible(plan.policyVersion, 160) && visible(plan.matchingAlgorithmVersion, 160)
    && nonnegative(plan.sellerCents) && nonnegative(plan.supportCents),
  'ตารางยังไม่ผ่านการตรวจสำหรับไฟล์ SR กรุณาตรวจหลักฐานและยอดขายก่อนดาวน์โหลด');

  const daily = new Map();
  const dailyProofError = 'หลักฐานยอดขายหรือจำนวนออเดอร์รายวันยังไม่ครบ';
  requireProof(plan.dailyReconciliation?.length === 1 + period / DAY, dailyProofError);
  for (const day of plan.dailyReconciliation) {
    requireProof(validDate(day.date) && day.date >= plan.startDate && day.date <= plan.endDate
      && !daily.has(day.date) && day.status === 'ready' && day.issueCount === 0
      && day.varianceCents === 0 && nonnegative(day.totalCents)
      && day.totalCents === day.targetCents && day.totalCents === day.cohortTotalCents
      && nonnegative(day.orderCount) && day.orderCount === day.confirmedOrderCount, dailyProofError);
    daily.set(day.date, { total: day.totalCents, orderCount: day.orderCount, found: 0 });
  }

  const orders = new Map();
  const stagedLines = plan.rows.map((row, index) => {
    const unitPriceCents = Number(String(row.unitPrice).replace('.', ''));
    requireProof(visible(row.unit, 50) && positive(unitPriceCents) && positive(row.amountCents)
      && String(row.sku).length <= 20 && Array.isArray(row.sources) && row.sources.length > 0,
    'มีแถวที่ไฟล์ SR ใช้ไม่ได้ กรุณาตรวจ SKU หน่วย ราคา และหลักฐานออเดอร์');
    for (const source of row.sources) {
      const day = daily.get(source.businessDate);
      requireProof(day && /^[A-Z0-9]{8,40}$/u.test(source.orderNumber || '')
        && /^[a-f0-9]{64}$/u.test(source.sourceSha256 || '') && positive(source.sourceRow)
        && positive(source.listingQuantity) && positive(source.quantityPerSale) && positive(source.amountCents),
      'หลักฐานออเดอร์ต้นทางไม่ครบ');
      if (!orders.has(source.orderNumber)) {
        orders.set(source.orderNumber, { date: source.businessDate, keys: new Map() });
        day.found += 1;
      }
      const evidence = orders.get(source.orderNumber);
      requireProof(evidence.date === source.businessDate, 'วันที่ของออเดอร์ต้นทางขัดกัน');
      const key = [source.sourceSha256, source.sourceRow, source.businessDate];
      evidence.keys.set(JSON.stringify(key), key);
    }
    return {
      sequence: index + 1, sku: row.sku, unit: row.unit, quantity: row.quantity, unitPriceCents,
      amountCents: row.amountCents, freeGift: row.freeGift === true,
    };
  });
  const days = [...daily.values()];
  requireProof(orders.size === plan.orderCount && days.every(day => day.found === day.orderCount)
    && days.reduce((sum, day) => sum + day.total, 0) === plan.totalCents, dailyProofError);
  requireProof(globalThis.crypto?.subtle, 'เบราว์เซอร์นี้สร้าง SHA-256 ไม่ได้ กรุณาเปิด Seamless ผ่าน HTTPS');

  const sortedOrders = [...orders.keys()].sort();
  const [lines, sourceOrders, operationKey] = await Promise.all([
    Promise.all(stagedLines.map(async (line, index) => ({
      ...line, sourceProofDigest: await digest(plan.rows[index].sources),
    }))),
    Promise.all(sortedOrders.map(async orderNumber => {
      const { date, keys } = orders.get(orderNumber);
      const fingerprints = await Promise.all([...keys.values()].map(digest));
      return {
        orderNumber, businessDate: date,
        sourceFactFingerprint: await digest([orderNumber, date, fingerprints.sort()]),
        buyerTaxInvoiceRequested: null,
      };
    })),
    digest([VERSION, BRANCH, plan.shopCode, PURPOSE, sortedOrders]),
  ]);
  const intent = {
    version: VERSION, purpose: PURPOSE, branchCode: BRANCH, shopCode: plan.shopCode,
    operationKey, documentDate, sourceOrders,
    sourcePolicyVersion: plan.policyVersion, matchingVersion: plan.matchingAlgorithmVersion,
    customer: { kind: 'aggregate', customerCode: 'AR004-000118' },
    paymentType: 'credit', targetState: 'awaiting_human_approval', totalCents: plan.totalCents, lines,
  };
  intent.intentDigest = await digest(intent);
  const file = {
    schemaVersion: 'sc-connect-004-review/v1', intent, nativeStatus: 'held',
    reconciliation: {
      startDate: plan.startDate, endDate: plan.endDate, orderCount: plan.orderCount, totalCents: plan.totalCents,
      sellerDiscountCents: plan.sellerCents, shopeeItemSupportCents: plan.supportCents,
      priceBasis: 'verified_business_insights_satang',
    },
  };
  file.exportDigest = await digest(file);
  return {
    file,
    filename: `sr-${plan.shopCode}-${plan.startDate}-to-${plan.endDate}.scconnect.json`,
  };
}
