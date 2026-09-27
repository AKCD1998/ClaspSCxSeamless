# Shopee sales-summary: AdaSmart copy mode

The `/shopee/sales-summary` page offers “ตารางสินค้าเดิม” and “คัดลอกเข้า AdaSmart”.
The existing product table and Excel export keep their existing creation-date behavior.
Copy mode requires one shop and one Bangkok business date, and loads its own admin-only
`GET /api/app/shopee/orders/sales-summary/adasmart-copy` response from the shared SC backend.

The three header buttons copy IC/SKU, quantity, and two-decimal unit price separately,
without headers or descriptions. All columns derive from the same ordered rows; numeric
SKUs and repeated SKU rows are preserved. A failed clipboard permission reveals a selectable
plain-text column instead of claiming success. Changing shop/date disables copying until a
matching response is loaded. Superseded requests cannot replace the current result.

The page shows independent Business Insights gross confirmed sales, prepared-row total,
variance, paid-order count, and actual merchandise/support components. Unresolved product,
ERP-unit, financial or report evidence prevents copying every column. For a review plan,
the displayed table is explicitly partial; the complete order amount and excluded issues
are shown separately. Evidence details retain order IDs, source rows, hashes and pack factors.

## Verification (2026-09-27)

- Client suite: 143 tests pass; Vite production build passes.
- Actual clipboard: 18 values in each column for SC Drug Store 2026-09-01;
  quantity × price totals exactly 1,220,800 satang, including 18,900 satang Shopee support.
- Browser checks: switch back to original table, edited filters disable stale copy,
  and 2026-09-04 Gaviscon unit review disables all three copy buttons.
- Horizontal table scrolling verified at the browser's 800px effective viewport.

Deploy the shared backend before the frontend. No database migration or AdaSmart document
write is introduced. Roll back by reverting this frontend change and the matching backend
feature; the original table still uses its existing API.
