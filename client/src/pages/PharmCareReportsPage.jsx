import Hero from '../components/Hero.jsx';
import PharmCareInboxPanel from '../components/PharmCareInboxPanel.jsx';

export default function PharmCareReportsPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="รายงานอีเมล์จาก Pharm Care"
        intro="เอกสารการเงินจาก PharmCare ที่ระบบดึงจากอีเมลและจัดประเภทอัตโนมัติ — เวอร์ชันนี้ยังเป็นแบบอ่านอย่างเดียว"
      />
      <PharmCareInboxPanel />
    </main>
  );
}
