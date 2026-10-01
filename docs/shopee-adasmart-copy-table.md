# Shopee sales-summary: AdaSmart copy mode

The `/shopee/sales-summary` page offers “ตารางสินค้าเดิม” and “คัดลอกเข้า AdaSmart”.
The existing product table and Excel export keep their existing creation-date behavior.
Copy mode requires one shop and one Bangkok business date or inclusive date range, and loads its own admin-only
`GET /api/app/shopee/orders/sales-summary/adasmart-copy` response from the shared SC backend.

The three header buttons copy IC/SKU, quantity, and two-decimal unit price separately,
without headers or descriptions. All columns derive from the same ordered rows; numeric
SKUs and repeated SKU rows are preserved. A failed clipboard permission reveals a selectable
plain-text column instead of claiming success. Changing shop/date disables copying until a
matching response is loaded. Superseded requests cannot replace the current result.

The page shows independent Business Insights gross confirmed sales, prepared-row total,
variance, cohort order count, and actual merchandise/support components. Unresolved product,
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

## Verified business-date and line evidence (2026-09-28)

The copy API can now supply private, source-bound business-date corrections and
product-level financial attribution. Its backend requires migrations 029 and 030
before deployment. The copy panel labels a corrected cohort as the Business
Insights date and shows the original paid date, exact affected orders and hashed
product-report references in its evidence section. A correction's source drift or
unresolved allocation keeps copying disabled. Original product views and AdaSmart
documents are not changed.
## Owner-approved allocations

The copy table labels free gifts at 0.00 and shows the accounting allocation
methods approved by the shop owner in its evidence panel. These are distinct
from per-product prices documented by Shopee. Seller discounts use proportional
original merchandise weights, Polar bundles put the bundle price on two blue
cans and zero on the white gift, and approved 350-baht Dr.Morepen bundles split
175/175 between the meter and strip box. A gift is not averaged into paid sales
of the same SKU.

The table also identifies seller vouchers restored from original order codes
and existing campaign evidence after a later cancellation. Every change still
requires the same shop/day Business Insights total, order count and all three
aligned columns to pass the existing copy validation.

## Inclusive date ranges (2026-10-01)

Select the start and end dates for one shop, then press “แสดงยอดขาย” in copy mode.
The table combines SKU quantities and original amounts over the complete period,
using the existing exact-cent price split and keeping free gifts separate. Its BI
target covers the same period; the original product view and Excel export are unchanged.

Every day must independently pass BI money, order count, mapping and source-evidence
checks. Missing BI is not treated as zero. Opposite daily errors cannot cancel out
inside a matching range total. “ตรวจยอดรายวัน” expands the day-by-day results,
including the date of a missing or failed report. The client also validates all
range daily results before enabling its aligned copy columns; changes to either
date disable stale data until a matching response arrives.

Verification: 144 client tests pass, including date-range guards, missing-day
blocking, stale end dates, period labels and daily-result rendering. Shared backend
validation and the 122 preserved day plans are documented in
`backend/docs/shopee-copy-date-range-20261001.md` of SC-official-website. Deploy that
backend before this frontend; no database migration is required.
