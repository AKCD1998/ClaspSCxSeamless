import { NavLink } from 'react-router-dom';

export default function Hero({ onLogout, title, intro }) {
  return (
    <section className="hero">
      <div className="hero-top-row">
        <p className="eyebrow">เว็บแอปปรับรูปแบบเอกสาร Seamless for DMIS</p>
        <div className="hero-top-actions">
          <nav className="hero-nav" aria-label="เมนูหลัก">
            <NavLink className="hero-nav-link" to="/" end>
              อัปโหลด
            </NavLink>
            <NavLink className="hero-nav-link" to="/history">
              ประวัติ
            </NavLink>
          </nav>
          {onLogout ? (
            <button className="logout-button" onClick={onLogout} type="button">
              ออกจากระบบ
            </button>
          ) : null}
        </div>
      </div>
      <h3>{title}</h3>
      <p className="intro">{intro}</p>
    </section>
  );
}
