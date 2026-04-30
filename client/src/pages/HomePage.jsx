import { useEffect, useState } from 'react';
import Hero from '../components/Hero.jsx';
import HistoryPanel from '../components/HistoryPanel.jsx';
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

export default function HomePage() {
  const [bootstrap, setBootstrap] = useState(DEFAULT_BOOTSTRAP);
  const [bootstrapStatus, setBootstrapStatus] = useState({
    message: 'กำลังเชื่อมต่อ backend...',
    state: 'working',
  });
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

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
      <Hero />
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
          onProcessingComplete={() => setHistoryReloadKey((value) => value + 1)}
        />
      ))}
      <HistoryPanel reloadKey={historyReloadKey} />
    </main>
  );
}
