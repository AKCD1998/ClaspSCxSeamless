export const DEFAULT_USER_FINANCIAL_VISIBILITY = Object.freeze({
  itemSubtotal: true,
  shippingFee: false,
  totalAmount: false,
  unitPrice: false,
});

export const ALL_FINANCIAL_FIELDS_VISIBLE = Object.freeze({
  itemSubtotal: true,
  shippingFee: true,
  totalAmount: true,
  unitPrice: true,
});

export function normalizeShopeeFinancialVisibility(value) {
  return {
    itemSubtotal: true,
    shippingFee: value?.shippingFee === true,
    totalAmount: value?.totalAmount === true,
    unitPrice: value?.unitPrice === true,
  };
}
