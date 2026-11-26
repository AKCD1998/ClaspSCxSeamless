import assert from 'node:assert/strict';
import test from 'node:test';
import { creditSaleDateDefaults, prepareCreditSaleFile } from '../src/components/shopeeCreditSaleFile.js';

const date = '2026-11-25';
const documentDate = '2026-11-26';
const plan = {
  shopCode: 'sc-drug-store', startDate: date, endDate: date, timezone: 'Asia/Bangkok', dateBasis: 'paid_at',
  status: 'ready', issues: [], targetCents: 7210, totalCents: 7210, varianceCents: 0,
  confirmedSales: { orderCount: 1 }, orderCount: 1, rowCount: 1, sellerCents: 50, supportCents: 10,
  policyVersion: 'synthetic-policy', matchingAlgorithmVersion: 'synthetic-matching', copyIdentityReadStatus: 'available',
  dailyReconciliation: [{ date, status: 'ready', issueCount: 0, orderCount: 1, confirmedOrderCount: 1,
    targetCents: 7210, totalCents: 7210, cohortTotalCents: 7210, varianceCents: 0 }],
  rows: [{ sku: 'SYNTHETIC', unit: 'กล่อง', quantity: 2, unitPrice: '36.05', amountCents: 7210,
    sources: [{ orderNumber: 'SYNTHETIC01', businessDate: date, sourceRow: 2, sourceSha256: 'a'.repeat(64),
      listingQuantity: 2, quantityPerSale: 1, amountCents: 7210 }] }],
};

test('creates a Connector SR file for each shop with stable shop-scoped identifiers', async () => {
  const dr = { ...plan, shopCode: 'dr-morepen', copyIdentityReadStatus: 'not_requested' };
  const { file, filename } = await prepareCreditSaleFile(plan, plan, documentDate);
  const other = await prepareCreditSaleFile(dr, dr, documentDate);
  assert.equal(filename, 'sr-sc-drug-store-2026-11-25-to-2026-11-25.scconnect.json');
  assert.equal(other.filename, 'sr-dr-morepen-2026-11-25-to-2026-11-25.scconnect.json');
  assert.equal(file.schemaVersion, 'sc-connect-004-review/v1');
  assert.equal(file.nativeStatus, 'held');
  assert.equal(file.intent.purpose, 'aggregate_credit_sale');
  assert.deepEqual(file.intent.customer, { kind: 'aggregate', customerCode: 'AR004-000118' });
  assert.equal(file.intent.targetState, 'awaiting_human_approval');
  assert.equal(file.intent.sourceOrders[0].buyerTaxInvoiceRequested, null);
  assert.equal(file.intent.totalCents, 7210);
  assert.equal(file.intent.lines[0].unitPriceCents, 3605);
  assert.match(file.exportDigest, /^[a-f0-9]{64}$/u);
  assert.notEqual(file.intent.operationKey, other.file.intent.operationKey);
  assert.deepEqual({ file, filename }, await prepareCreditSaleFile(plan, plan, documentDate));
});

test('blocks export if shop, dates, ERP mapping or daily order proof does not match', async () => {
  assert.equal(creditSaleDateDefaults(date).documentDate, documentDate);
  await assert.rejects(prepareCreditSaleFile(plan, { ...plan, shopCode: 'dr-morepen' }, documentDate), /ยังไม่ผ่าน/u);
  await assert.rejects(prepareCreditSaleFile(plan, plan, '2026-11-24'), /วันที่เอกสาร SR/u);
  await assert.rejects(prepareCreditSaleFile({ ...plan, copyIdentityReadStatus: 'not_requested' }, plan, documentDate), /ยังไม่ผ่าน/u);
  await assert.rejects(prepareCreditSaleFile({ ...plan, dailyReconciliation: [] }, plan, documentDate), /รายวันยังไม่ครบ/u);
  const row = { ...plan.rows[0], sources: [{ ...plan.rows[0].sources[0], businessDate: '2026-11-24' }] };
  await assert.rejects(prepareCreditSaleFile({ ...plan, rows: [row] }, plan, documentDate), /ต้นทางไม่ครบ/u);
});
