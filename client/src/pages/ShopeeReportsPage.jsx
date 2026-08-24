import Hero from '../components/Hero.jsx';
import ShopeeEmailInboxPanel from '../components/ShopeeEmailInboxPanel.jsx';

export default function ShopeeReportsPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="รายงานอีเมล์จาก Shopee"
        intro="ติดตามอีเมลคำสั่งซื้อ การจัดส่ง การยกเลิก สินค้าหมด และความปลอดภัยจาก Shopee แบบอ่านอย่างเดียว"
      />
      <ShopeeEmailInboxPanel />
    </main>
  );
}
