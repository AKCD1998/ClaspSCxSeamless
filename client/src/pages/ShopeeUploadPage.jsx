import { useEffect, useState } from 'react';
import Hero from '../components/Hero.jsx';
import UploadPanel from '../components/UploadPanel.jsx';
import { getBootstrap } from '../services/api.js';

const DEFAULT_BOOTSTRAP = {
  maxUploadMb: 20,
  maxBatchFiles: 20,
};

export default function ShopeeUploadPage() {
  const [bootstrap, setBootstrap] = useState(DEFAULT_BOOTSTRAP);
  const [bootstrapStatus, setBootstrapStatus] = useState({
    message: 'กำลังเชื่อมต่อ backend...',
    state: 'working',
  });

  useEffect(() => {
    let cancelled = false;

    getBootstrap()
      .then((payload) => {
        if (!cancelled) {
          setBootstrap({ ...DEFAULT_BOOTSTRAP, ...payload });
          setBootstrapStatus({ message: 'พร้อมรับไฟล์ Shopee', state: 'success' });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBootstrapStatus({
            message: error?.message || 'เชื่อมต่อ backend ไม่สำเร็จ',
            state: 'error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell shell-single-column">
      <Hero
        title="อัปโหลดยอดขาย Shopee"
        intro="อัปโหลดไฟล์ Order.all จาก Shopee เพื่อแปลงข้อความวันที่และจำนวนเงินให้เป็นชนิดข้อมูลที่ใช้งานได้ สร้างหน้าสรุปสำหรับบัญชี และตัดข้อมูลชื่อ โทรศัพท์ และที่อยู่ออกจากเอกสารที่พิมพ์"
      >
        <p className="api-status status" data-state={bootstrapStatus.state}>
          {bootstrapStatus.message}
        </p>
      </Hero>
      <UploadPanel
        bootstrap={bootstrap}
        copy="รองรับไฟล์ .xlsx ที่ดาวน์โหลดจากเมนูคำสั่งซื้อ Shopee ระบบจะเก็บไฟล์ต้นฉบับเพื่อ audit แต่ไฟล์ผลลัพธ์จะมีเฉพาะข้อมูลที่บัญชีต้องใช้ งานนี้จะยังไม่พิมพ์จนกว่า admin กดสั่งพิมพ์จากหน้าประวัติ"
        eyebrow="อัปโหลดรายงานคำสั่งซื้อ Shopee"
        formatterMode="shopee"
      />
    </main>
  );
}
