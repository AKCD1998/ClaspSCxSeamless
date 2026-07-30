export default function Hero({ onLogout }) {
  return (
    <section className="hero">
      <div className="hero-top-row">
        <p className="eyebrow">เว็บแอปปรับรูปแบบเอกสาร Seamless for DMIS</p>
        {onLogout ? (
          <button className="logout-button" onClick={onLogout} type="button">
            ออกจากระบบ
          </button>
        ) : null}
      </div>
      <h3>อัปโหลดไฟล์จาก Seamless เพื่อปรับรูปแบบเอกสารและติดตามประวัติการทำงานผ่าน backend/database ใหม่</h3>
      <p className="intro">
        ผู้ใช้งานต้องอัปโหลดเอกสารจาก Seamless for DMIS ของ สปสช.ทั้งหมด 2 ไฟล์ต่อสัปดาห์ ได้แก่เอกสารแจกแจงการชดเชยรายบุคคล
        (individual) และเอกสารสรุปการชดเชยทั้งหมด (summary) ผ่านหน้าเว็บนี้โดยตรง ระบบจะสร้างไฟล์ที่ปรับรูปแบบแล้วและบันทึกประวัติการดำเนินการไว้ใน backend/database
        โดยไม่ต้องพึ่งหน้าเว็บ GAS เดิมอีกต่อไป หากเกิดความผิดพลาดจากการอัปโหลดผิดไฟล์หรืออัปโหลดซ้ำ กรุณาติดต่อผู้ดูแลระบบ
      </p>
    </section>
  );
}
