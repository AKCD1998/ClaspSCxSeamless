import Hero from '../components/Hero.jsx';

export default function ShopeeUploadPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="อัปโหลดยอดขาย Shopee"
        intro="หน้านี้อยู่ระหว่างการพัฒนา — ฟีเจอร์อัปโหลดยอดขาย Shopee จะเปิดใช้งานเร็วๆ นี้"
      />
      <section className="panel">
        <p className="panel-eyebrow">กำลังพัฒนา</p>
        <p className="panel-copy">
          ยังไม่มีระบบอัปโหลดยอดขาย Shopee ในตอนนี้ — เมนูนี้เตรียมไว้สำหรับการเชื่อมต่อในอนาคต
        </p>
      </section>
    </main>
  );
}
