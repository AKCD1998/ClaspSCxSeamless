import { useEffect, useState } from 'react';
import Hero from '../components/Hero.jsx';
import UploadPanel from '../components/UploadPanel.jsx';
import { getBootstrap } from '../services/api.js';

const DEFAULT_BOOTSTRAP = {
  appName: 'Seamless X GAS Excel Formatter',
  maxUploadMb: 20,
  retentionHours: 12,
  maxBatchFiles: 20,
};

const uploadPanels = [
  {
    mode: 'individual',
    eyebrow: 'ขั้นตอนที่ 1 อัปโหลดไฟล์แจกแจงการชดเชยรายคน',
    title: 'Individual Formatter',
    copy:
      'สำหรับไฟล์ที่มีรูปแบบชื่อไฟล์ REP_individual_INS_202604..... เท่านั้น (ผู้ใช้สามารถอัปโหลดได้ทีละหลายไฟล์พร้อมกัน)',
  },
  {
    mode: 'summary',
    eyebrow: 'ขั้นตอนที่ 2 อัปโหลดไฟล์สรุปจำนวนการชดชยทั้งหมดในรอบนั้นๆ',
    title: 'Summary Formatter',
    copy:
      'สำหรับไฟล์ที่มีรูปแบบชื่อไฟล์ rep_summary_zone0... เท่านั้น (ผู้ใช้สามารถอัปโหลดได้ทีละหลายไฟล์พร้อมกัน)',
  },
];

export default function UploadPage({ onLogout }) {
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
          setBootstrapStatus({ message: 'เชื่อมต่อ backend แล้ว', state: 'success' });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBootstrap(DEFAULT_BOOTSTRAP);
          setBootstrapStatus({
            message: error?.message || 'เชื่อมต่อ backend ไม่สำเร็จ ใช้ค่า default ชั่วคราว',
            state: 'error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="shell">
      <Hero
        onLogout={onLogout}
        title="อัปโหลดไฟล์จาก Seamless เพื่อปรับรูปแบบเอกสารและติดตามประวัติการทำงานผ่าน backend/database ใหม่"
        intro="ผู้ใช้งานต้องอัปโหลดเอกสารจาก Seamless for DMIS ของ สปสช.ทั้งหมด 2 ไฟล์ต่อสัปดาห์ ได้แก่เอกสารแจกแจงการชดเชยรายบุคคล
        (individual) และเอกสารสรุปการชดเชยทั้งหมด (summary) ผ่านหน้าเว็บนี้โดยตรง ระบบจะสร้างไฟล์ที่ปรับรูปแบบแล้วและบันทึกประวัติการดำเนินการไว้ใน backend/database
        โดยไม่ต้องพึ่งหน้าเว็บ GAS เดิมอีกต่อไป หากเกิดความผิดพลาดจากการอัปโหลดผิดไฟล์หรืออัปโหลดซ้ำ กรุณาติดต่อผู้ดูแลระบบ"
      />
      <p className="api-status status" data-state={bootstrapStatus.state}>
        {bootstrapStatus.message}
      </p>
      {uploadPanels.map((panel) => (
        <UploadPanel
          key={panel.mode}
          bootstrap={bootstrap}
          copy={panel.copy}
          eyebrow={panel.eyebrow}
          formatterMode={panel.mode}
          title={panel.title}
        />
      ))}
    </main>
  );
}
