import Hero from '../components/Hero.jsx';
import ShopeeLegacyReconciliationPanel from '../components/ShopeeLegacyReconciliationPanel.jsx';
import ShopeeOrderTimelinePanel from '../components/ShopeeOrderTimelinePanel.jsx';

export default function ShopeeOrdersPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="ไทม์ไลน์คำสั่งซื้อ Shopee"
        intro="เชื่อมเหตุการณ์จากอีเมลเป็นสถานะของแต่ละคำสั่งซื้อ โดยเก็บเฉพาะข้อมูลธุรกิจที่จำเป็นและไม่แสดงข้อมูลผู้ซื้อ"
      />
      <ShopeeOrderTimelinePanel />
      <ShopeeLegacyReconciliationPanel />
    </main>
  );
}
