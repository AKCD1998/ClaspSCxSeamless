import Hero from '../components/Hero.jsx';
import HistoryPanel from '../components/HistoryPanel.jsx';

export default function ShopeeHistoryPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="ประวัติเอกสาร Shopee และคิวปริ้นท์"
        intro="ตรวจไฟล์ผลลัพธ์ ดาวน์โหลด ส่งอีเมล และสั่งพิมพ์ไปยังเครื่องพิมพ์สำนักงานใหญ่ งาน Shopee จะไม่เข้าคิวอัตโนมัติจนกว่า admin กดสั่งพิมพ์"
      />
      <HistoryPanel fixedReportType="shopee" reloadKey={0} showDashboard={false} />
    </main>
  );
}
