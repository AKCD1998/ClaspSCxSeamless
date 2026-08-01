import Hero from '../components/Hero.jsx';
import PharmCareInboxPanel from '../components/PharmCareInboxPanel.jsx';

export default function PharmCareUploadPage() {
  return (
    <main className="shell shell-single-column">
      <Hero
        title="PharmCare Inbox"
        intro="เอกสารการเงินจาก PharmCare ที่ระบบดึงจากอีเมลและจัดประเภทอัตโนมัติ — เวอร์ชันนี้ยังเป็นแบบอ่านอย่างเดียว"
      />
      <PharmCareInboxPanel />
    </main>
  );
}
