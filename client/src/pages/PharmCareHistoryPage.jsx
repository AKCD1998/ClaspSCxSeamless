import Hero from '../components/Hero.jsx';

export default function PharmCareHistoryPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="ประวัติ Pharm Care"
        intro="หน้านี้อยู่ระหว่างการพัฒนา — ประวัติการอัปโหลดข้อมูล Pharm Care จะแสดงที่นี่เมื่อฟีเจอร์พร้อมใช้งาน"
      />
      <section className="panel">
        <p className="panel-eyebrow">กำลังพัฒนา</p>
        <p className="panel-copy">ยังไม่มีข้อมูลประวัติ Pharm Care ในตอนนี้</p>
      </section>
    </main>
  );
}
