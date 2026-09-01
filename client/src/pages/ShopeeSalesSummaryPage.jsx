import Hero from '../components/Hero.jsx';
import ShopeeSalesSummaryPanel from '../components/ShopeeSalesSummaryPanel.jsx';

export default function ShopeeSalesSummaryPage() {
  return (
    <main className="shell shell-single-column shopee-sales-summary-shell">
      <Hero
        title="สรุปยอดขายสินค้า Shopee"
        intro="เลือกช่วงวันที่เพื่อดูว่าสินค้าแต่ละรายการขายออกไปเท่าไร และขยายดูเลขคำสั่งซื้อ จำนวน และวันที่สั่งซื้อได้ในแถวเดียวกัน"
      />
      <ShopeeSalesSummaryPanel />
    </main>
  );
}
