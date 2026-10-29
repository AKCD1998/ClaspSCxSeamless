# Order-screen SKU and stock units

SC004 stock mapping is stored in the existing versioned identity/evidence
registry owned by SC-official-website. The order screen previously displayed
only the accounting matcher. An approved stock mapping could therefore resolve
StockDay while Seamless still displayed “รอตรวจสอบ SKU”.

This UI consumes the additive `items[].stockProductMatch` response from the
order list and detail endpoints. A verified result shows each canonical stock
SKU, quantity per sale and POS smallest unit, labelled “สต็อก 004”. For example,
one pink Gummy Plus sale is `IC-001510 ×24 ซอง`, while one 100-piece Tigerplast
box is `IC-000060 ×1 กล่อง`. Order quantity remains the number of sale packages.
These labels do not attest dispatch, availability, cancellation or return.

Verified components must have a nonempty SKU/unit and a positive safe integer
factor. Blocked or unavailable stock evidence displays its own unknown state.
It cannot fall back to an accounting SKU. A missing sale quantity remains
“ยังไม่ทราบ”. When an older backend omits the field, the existing accounting
display remains compatible. Other shops retain their existing response/display.

The backend uses one bounded read-only snapshot from the existing canonical
identityStore and stock-line validator. It does not change `productMatch`,
prices, financial visibility, AdaSmart copy/export, reservations or lifecycle
proof. There is no frontend registry, new credential, migration or background
task. The companion backend resolves exact company SKU searches through these
same validated aliases before all-page pagination. Ordinary name/date/amount
search and the accounting search text remain unchanged. An unavailable canonical
SKU lookup returns a temporary error rather than a false empty search result.

Validation: all 148 client tests pass and Vite production build succeeds.
Coverage includes factors 24 and 1, bundles/shared master components, unknown
quantities, unavailable reads, malformed factors and older backend responses.
The rendered local sample uses synthetic orders and is not a production result.

The 29 October evidence package `sc004-seller-pos-20261029-r1` separately records
15 production rule revisions with exact listing/variation/Seller SKU, POS units
and source hashes in SC-official-website's
`docs/shopee004-mapping-review-20261029.md`. No frontend or backend code has been
merged/deployed for this display change. Review and release the additive backend
response before this frontend. Hourly, Full Sync, Transfer Delta, opening balances
and the permanent cutover remain outside this patch.
