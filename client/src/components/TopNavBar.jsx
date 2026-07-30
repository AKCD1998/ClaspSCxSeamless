import { NavLink } from 'react-router-dom';

export default function TopNavBar({ onLogout }) {
  return (
    <header className="top-navbar">
      <div className="top-navbar-inner">
        <div className="top-navbar-brand">
          <span className="top-navbar-logo">SC</span>
          <div className="top-navbar-brand-text">
            <span className="top-navbar-brand-title">ระบบจัดการเอกสารหน้าร้าน-บัญชี</span>
            <span className="top-navbar-brand-subtitle">Excel Formatter</span>
          </div>
        </div>

        <nav className="top-navbar-nav" aria-label="เมนูหลัก">
          <NavLink className="top-navbar-link" to="/" end>
            อัปโหลด Seamless X GAS
          </NavLink>
          <NavLink className="top-navbar-link" to="/history">
            ประวัติ
          </NavLink>
        </nav>

        <div className="top-navbar-actions">
          {onLogout ? (
            <button className="top-navbar-logout" onClick={onLogout} type="button">
              ออกจากระบบ
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
