import { useEffect, useState } from 'react';
import drMorepenLogo from '../assets/shopee-shops/dr-morepen.jpg';
import scDrugStoreLogo from '../assets/shopee-shops/sc-drug-store.jpg';
import Hero from '../components/Hero.jsx';
import ShopeeAccountingCycleNotice from '../components/ShopeeAccountingCycleNotice.jsx';
import UploadPanel from '../components/UploadPanel.jsx';
import { getBootstrap, getShopeeAccountingCycleStatus } from '../services/api.js';

const DEFAULT_BOOTSTRAP = {
  maxUploadMb: 20,
  maxBatchFiles: 20,
};

export function cycleStatusFromPayload(payload) {
  const missingCount = payload?.missingCycles?.length || 0;

  if (missingCount) {
    return {
      message: `พบ ${missingCount} รอบที่ขาด ระบบจะไม่เลื่อน checkpoint ข้ามรอบ`,
      state: 'warning',
    };
  }
  if (payload?.hasHistory) {
    return { message: 'คำนวณรอบถัดไปจากประวัติที่ต่อเนื่องแล้ว', state: 'success' };
  }
  return { message: 'ยังไม่พบประวัติ ระบบแสดงรอบอ้างอิงเริ่มต้น', state: 'warning' };
}

export function cycleErrorState(error) {
  return {
    payload: null,
    status: {
      message: error?.message || 'ตรวจสอบรอบบัญชีไม่สำเร็จ แต่ยังเลือกไฟล์ได้',
      state: 'error',
    },
  };
}

export default function ShopeeUploadPage() {
  const [bootstrap, setBootstrap] = useState(DEFAULT_BOOTSTRAP);
  const [bootstrapStatus, setBootstrapStatus] = useState({
    message: 'กำลังเชื่อมต่อ backend...',
    state: 'working',
  });
  const [cyclePayload, setCyclePayload] = useState(null);
  const [cycleStatus, setCycleStatus] = useState({
    message: 'กำลังตรวจสอบรอบล่าสุด...',
    state: 'working',
  });

  async function refreshAccountingCycle() {
    setCyclePayload(null);
    setCycleStatus({ message: 'กำลังตรวจสอบรอบล่าสุด...', state: 'working' });

    try {
      const payload = await getShopeeAccountingCycleStatus();
      setCyclePayload(payload);
      setCycleStatus(cycleStatusFromPayload(payload));
    } catch (error) {
      const failure = cycleErrorState(error);
      setCyclePayload(failure.payload);
      setCycleStatus(failure.status);
    }
  }

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

    getShopeeAccountingCycleStatus()
      .then((payload) => {
        if (!cancelled) {
          setCyclePayload(payload);
          setCycleStatus(cycleStatusFromPayload(payload));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const failure = cycleErrorState(error);
          setCyclePayload(failure.payload);
          setCycleStatus(failure.status);
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
      <ShopeeAccountingCycleNotice payload={cyclePayload} status={cycleStatus} />
      <section aria-label="เลือกร้าน Shopee สำหรับอัปโหลด" className="shopee-shop-upload-grid">
        <UploadPanel
          bootstrap={bootstrap}
          className="shop-upload-card"
          copy="ใช้ช่องนี้เฉพาะไฟล์ .xlsx ที่ดาวน์โหลดจากบัญชีร้าน SC Drug Store ระบบจะติดชื่อร้านในไฟล์ผลลัพธ์และ metadata สำหรับ audit โดยอัตโนมัติ"
          eyebrow="อัปโหลด Order.all — SC Drug Store"
          formatterMode="shopee"
          logoAlt="โลโก้ร้านศิริชัยเภสัช SC Drug Store"
          logoSrc={scDrugStoreLogo}
          onProcessingComplete={refreshAccountingCycle}
          shopCode="sc-drug-store"
          shopName="SC Drug Store"
        />
        <UploadPanel
          bootstrap={bootstrap}
          className="shop-upload-card"
          copy="ใช้ช่องนี้เฉพาะไฟล์ .xlsx ที่ดาวน์โหลดจากบัญชีร้าน DR.Morepen ระบบจะติดชื่อร้านในไฟล์ผลลัพธ์และ metadata สำหรับ audit โดยอัตโนมัติ"
          eyebrow="อัปโหลด Order.all — DR.Morepen"
          formatterMode="shopee"
          logoAlt="โลโก้ร้าน Dr. Morepen HomeHealth"
          logoSrc={drMorepenLogo}
          onProcessingComplete={refreshAccountingCycle}
          shopCode="dr-morepen"
          shopName="DR.Morepen"
        />
      </section>
    </main>
  );
}
