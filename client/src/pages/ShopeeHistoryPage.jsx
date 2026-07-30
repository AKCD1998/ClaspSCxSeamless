import Hero from '../components/Hero.jsx';

export default function ShopeeHistoryPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="ประวัติยอดขาย Shopee"
        intro="หน้านี้อยู่ระหว่างการพัฒนา — ประวัติการอัปโหลดยอดขาย Shopee จะแสดงที่นี่เมื่อฟีเจอร์พร้อมใช้งาน"
      />
      <section className="panel">
        <p className="panel-eyebrow">กำลังพัฒนา</p>
        <p className="panel-copy">ยังไม่มีข้อมูลประวัติ Shopee ในตอนนี้</p>
      </section>
    </main>
  );
}
