function copyDates(filters) {
  const start = filters?.startDate; const end = filters?.endDate || start;
  const valid = date => /^\d{4}-\d{2}-\d{2}$/u.test(date || '')
    && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!valid(start) || !valid(end)) return [];
  const count = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 3660) return [];
  return Array.from({ length: count }, (_, index) => new Date(Date.parse(start) + index * 86400000).toISOString().slice(0, 10));
}

export function copyScopeIsValid(filters) {
  return ['sc-drug-store', 'dr-morepen'].includes(filters?.shopCode) && copyDates(filters).length > 0;
}

export function copyDailyReconciliationIsValid(plan) {
  const dates = copyDates(plan);
  if (!dates.length) return false;
  if (dates.length === 1) return true;
  if (plan.dailyReconciliation?.length !== dates.length) return false;
  let total = 0; let orders = 0;
  for (const [index, day] of plan.dailyReconciliation.entries()) {
    if (day.date !== dates[index] || day.status !== 'ready' || day.issueCount !== 0
      || !Number.isSafeInteger(day.targetCents) || day.targetCents < 0
      || day.totalCents !== day.targetCents || day.cohortTotalCents !== day.targetCents
      || day.varianceCents !== 0 || !Number.isSafeInteger(day.orderCount) || day.orderCount < 0
      || day.orderCount !== day.confirmedOrderCount) return false;
    total += day.targetCents; orders += day.orderCount;
  }
  return Number.isSafeInteger(total) && Number.isSafeInteger(orders)
    && total === plan.targetCents && orders === plan.orderCount;
}

export function copyFiltersMatch(left, right) {
  return Boolean(left && right && left.shopCode === right.shopCode
    && left.startDate === right.startDate
    && (left.endDate || left.startDate) === (right.endDate || right.startDate));
}

function satang(value) {
  if (!/^\d+\.\d{2}$/u.test(String(value))) return null;
  const [whole, fraction] = String(value).split('.');
  const result = Number(whole) * 100 + Number(fraction);
  return Number.isSafeInteger(result) ? result : null;
}

// Rebuild all three columns from the same immutable row order. Fail closed on
// malformed/stale responses instead of independently sorting or trusting strings.
export function verifiedCopyColumns(plan, filters) {
  if (!copyScopeIsValid(filters) || !copyFiltersMatch(plan, filters) || !copyDailyReconciliationIsValid(plan) || plan.status !== 'ready'
    || plan.issues?.length || !plan.rows?.length || plan.rows.length !== plan.rowCount
    || !Number.isSafeInteger(plan.targetCents) || plan.targetCents < 0
    || plan.orderCount !== plan.confirmedSales?.orderCount) return null;
  let total = 0;
  for (const row of plan.rows) {
    const price = satang(row.unitPrice);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u.test(row.sku || '')
      || !Number.isSafeInteger(row.quantity) || row.quantity < 1 || price == null
      || row.amountCents !== row.quantity * price) return null;
    total += row.quantity * price;
  }
  if (!Number.isSafeInteger(total) || total !== plan.totalCents || total !== plan.targetCents) return null;
  return { sku: plan.rows.map(row => row.sku).join('\n'),
    quantity: plan.rows.map(row => String(row.quantity)).join('\n'),
    unitPrice: plan.rows.map(row => row.unitPrice).join('\n') };
}
