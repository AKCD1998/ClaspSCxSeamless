import Hero from '../components/Hero.jsx';
import ShopeeOrderTimelinePanel from '../components/ShopeeOrderTimelinePanel.jsx';

export default function ShopeeOrdersPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="ไทม์ไลน์คำสั่งซื้อ Shopee"
        intro="สถานะจาก Seller Centre พร้อมเวลาที่ตรวจพบและเหตุการณ์จากอีเมล การชำระของผู้ซื้อแยกจากรายรับที่โอนให้ร้านและการคืนเงิน"
      />
      <ShopeeOrderTimelinePanel />
    </main>
  );
}
