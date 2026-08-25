import { useEffect, useState } from 'react';
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
  const emptyCount = payload?.unconfirmedEmptyCycles?.length || 0;

  if (missingCount) {
    return {
      message: `พบ ${missingCount} รอบที่ขาด ระบบจะไม่เลื่อน checkpoint ข้ามรอบ`,
      state: 'warning',
    };
  }
  if (emptyCount) {
    return {
      message: `มี ${emptyCount} รอบที่ไม่พบรายการสำเร็จและต้องตรวจสอบก่อนปิดรอบ`,
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
      <UploadPanel
        bootstrap={bootstrap}
        copy="รองรับไฟล์ .xlsx ที่ดาวน์โหลดจากเมนูคำสั่งซื้อ Shopee ระบบจะเก็บไฟล์ต้นฉบับเพื่อ audit แต่ไฟล์ผลลัพธ์จะมีเฉพาะข้อมูลที่บัญชีต้องใช้ งานนี้จะยังไม่พิมพ์จนกว่า admin กดสั่งพิมพ์จากหน้าประวัติ"
        eyebrow="อัปโหลดรายงานคำสั่งซื้อ Shopee"
        formatterMode="shopee"
        onProcessingComplete={refreshAccountingCycle}
      />
    </main>
  );
}
