export function copyScopeIsValid(filters) {
  return Boolean(filters?.shopCode && filters.shopCode !== 'all' && filters.startDate
    && filters.startDate === (filters.endDate || filters.startDate));
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
  if (!copyScopeIsValid(filters) || !copyFiltersMatch(plan, filters) || plan.status !== 'ready'
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
