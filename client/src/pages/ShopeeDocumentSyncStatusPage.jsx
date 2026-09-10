import Hero from '../components/Hero.jsx';
import ShopeeDocumentSyncStatusPanel from '../components/ShopeeDocumentSyncStatusPanel.jsx';

export default function ShopeeDocumentSyncStatusPage() {
  return (
    <main className="shell shell-single-column shopee-document-sync-shell">
      <Hero
        title="สถานะเอกสาร Shopee"
        intro="ตรวจว่ารายงานทางการของแต่ละร้านถูกดาวน์โหลดและนำเข้าเว็บครบถึงวันใด พร้อมหลักฐานชื่อไฟล์และเวลานำเข้า"
      />
      <ShopeeDocumentSyncStatusPanel />
    </main>
  );
}
