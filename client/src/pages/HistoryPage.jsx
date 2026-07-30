import Hero from '../components/Hero.jsx';
import HistoryPanel from '../components/HistoryPanel.jsx';

export default function HistoryPage({ onLogout }) {
  return (
    <main className="shell shell-single-column">
      <Hero
        onLogout={onLogout}
        title="ประวัติการดำเนินการและสถานะการปริ้นท์เอกสาร"
        intro="ติดตามไฟล์ที่อัปโหลด สถานะการปริ้นท์ส่งพี่เอ คิวปริ้นท์ปัจจุบัน และการแจ้งเตือนผ่าน LINE/อีเมลของแต่ละไฟล์"
      />
      <HistoryPanel reloadKey={0} />
    </main>
  );
}
