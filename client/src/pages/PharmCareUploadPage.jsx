import Hero from '../components/Hero.jsx';

export default function PharmCareUploadPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="อัปโหลดข้อมูล Pharm Care"
        intro="หน้านี้อยู่ระหว่างการพัฒนา — การอัปโหลดข้อมูล Pharm Care จะแสดงที่นี่เมื่อฟีเจอร์พร้อมใช้งาน ตอนนี้รายงานอีเมล์จาก Pharm Care ย้ายไปอยู่ที่เมนู 'รายงานอีเมล์จาก Pharm Care' แล้ว"
      />
      <section className="panel">
        <p className="panel-eyebrow">กำลังพัฒนา</p>
        <p className="panel-copy">ยังไม่มีการอัปโหลดข้อมูล Pharm Care ในตอนนี้</p>
      </section>
    </main>
  );
}
