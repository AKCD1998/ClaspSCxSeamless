import Hero from '../components/Hero.jsx';

export default function PharmCareUploadPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="อัปโหลดข้อมูล Pharm Care"
        intro="หน้านี้อยู่ระหว่างการพัฒนา — ฟีเจอร์อัปโหลดข้อมูล Pharm Care จะเปิดใช้งานเร็วๆ นี้"
      />
      <section className="panel">
        <p className="panel-eyebrow">กำลังพัฒนา</p>
        <p className="panel-copy">
          ยังไม่มีระบบอัปโหลดข้อมูล Pharm Care ในตอนนี้ — เมนูนี้เตรียมไว้สำหรับการเชื่อมต่อในอนาคต
        </p>
      </section>
    </main>
  );
}
