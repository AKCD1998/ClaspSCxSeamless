const DATE_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Bangkok",
  year: "numeric",
});
const MONEY_FORMATTER = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value || "")) return "-";
  return DATE_FORMATTER.format(new Date(`${value}T00:00:00+07:00`));
}

function formatMoney(value) {
  return Number.isFinite(Number(value)) ? MONEY_FORMATTER.format(Number(value)) : "-";
}

export default function AccountingIncomeExportPreview({
  downloadLoading,
  onClose,
  onDownload,
  onPrint,
  preview,
}) {
  if (!preview) return null;

  return (
    <div className="accounting-income-preview-backdrop" role="presentation">
      <section
        aria-labelledby="accounting-income-preview-title"
        aria-modal="true"
        className="accounting-income-preview-dialog"
        role="dialog"
      >
        <header className="accounting-income-preview-toolbar">
          <div>
            <h2 id="accounting-income-preview-title">ตัวอย่างเอกสารรายรับสำหรับบัญชี</h2>
            <p>ตรวจสอบร้าน ช่วงวันที่ และยอดรวมก่อนดาวน์โหลดหรือสั่งพิมพ์</p>
          </div>
          <div className="accounting-income-preview-actions">
            <button type="button" className="secondary" onClick={onClose}>ปิด</button>
            <button type="button" className="secondary" onClick={onPrint}>พิมพ์เอกสาร</button>
            <button type="button" disabled={downloadLoading} onClick={onDownload}>
              {downloadLoading ? "กำลังสร้าง Excel..." : "ดาวน์โหลด Excel"}
            </button>
          </div>
        </header>

        <div className="accounting-income-preview-scroll">
          <article className="accounting-income-preview-document">
            <section className="accounting-income-preview-sheet accounting-income-preview-cover">
              <h3>ชุดข้อมูลรายรับสำหรับบัญชี</h3>
              <dl className="accounting-income-preview-metadata">
                <div><dt>ร้าน</dt><dd>{preview.filters.shopLabel}</dd></div>
                <div>
                  <dt>ช่วงวันที่โอนชำระเงินสำเร็จ</dt>
                  <dd>{formatDate(preview.filters.dateFrom)} ถึง {formatDate(preview.filters.dateTo)}</dd>
                </div>
                <div><dt>เขตเวลา</dt><dd>{preview.timezone}</dd></div>
                <div><dt>เลขคำสั่งซื้อ</dt><dd>{preview.filters.orderNumber || "ทั้งหมด"}</dd></div>
              </dl>

              <div className="accounting-income-preview-summary">
                <div><span>จำนวนรายการ</span><strong>{preview.summary.orderCount.toLocaleString("th-TH")}</strong></div>
                <div><span>ยอด Income รวม</span><strong>{formatMoney(preview.summary.totalIncome)}</strong></div>
                <div><span>เงินเข้า Seller Balance แล้ว</span><strong>{preview.summary.creditedCount.toLocaleString("th-TH")}</strong></div>
              </div>

              <h4>เอกสาร Shopee ต้นฉบับที่อ้างอิง</h4>
              <div className="accounting-income-preview-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ประเภทเอกสาร</th>
                      <th>ร้าน</th>
                      <th>ช่วงวันที่</th>
                      <th>ชื่อไฟล์ต้นฉบับ</th>
                      <th>สถานะไฟล์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!preview.documents.length && (
                      <tr><td colSpan="5" className="accounting-income-preview-empty">ไม่พบเอกสารอ้างอิงในช่วงนี้</td></tr>
                    )}
                    {preview.documents.map((document) => (
                      <tr key={`${document.shopCode}-${document.kind}-${document.filename}`}>
                        <td>{document.kindLabel}</td>
                        <td>{document.shopLabel}</td>
                        <td>{formatDate(document.startDate)} ถึง {formatDate(document.endDate)}</td>
                        <td>{document.filename}</td>
                        <td>{document.originalAvailable ? "มีไฟล์ต้นฉบับในเว็บ" : "ระบบเก็บเฉพาะข้อมูลที่อ่านได้"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="accounting-income-preview-sheet accounting-income-preview-orders">
              <h3>รายการรายรับจาก Income</h3>
              <p>
                ร้าน {preview.filters.shopLabel} | วันที่โอนชำระเงินสำเร็จ {formatDate(preview.filters.dateFrom)} ถึง {formatDate(preview.filters.dateTo)}
              </p>
              <div className="accounting-income-preview-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>หมายเลขคำสั่งซื้อ</th>
                      <th>ร้าน</th>
                      <th>วันที่สั่งซื้อ</th>
                      <th>วันที่โอนชำระเงินสำเร็จ</th>
                      <th>จำนวนเงินทั้งหมด</th>
                      <th>สถานะ Seller Balance</th>
                      <th>วันที่เงินเข้า Seller Balance</th>
                      <th>ยอดสุทธิ Seller Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!preview.orders.length && (
                      <tr><td colSpan="8" className="accounting-income-preview-empty">ไม่พบรายการตามเงื่อนไข</td></tr>
                    )}
                    {preview.orders.map((order, index) => (
                      <tr key={`${order.shopCode}-${order.orderNumber}-${order.transferDate}-${index}`}>
                        <td>{order.orderNumber}</td>
                        <td>{order.shopLabel}</td>
                        <td>{formatDate(order.orderDate)}</td>
                        <td>{formatDate(order.transferDate)}</td>
                        <td className="accounting-income-preview-number">{formatMoney(order.amount)}</td>
                        <td>{order.sellerBalanceStatusLabel}</td>
                        <td>{formatDate(order.sellerBalanceInflowDate)}</td>
                        <td className="accounting-income-preview-number">
                          {order.sellerBalanceNetAmount === null || order.sellerBalanceNetAmount === undefined
                            ? "-"
                            : formatMoney(order.sellerBalanceNetAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </article>
        </div>
      </section>
    </div>
  );
}
