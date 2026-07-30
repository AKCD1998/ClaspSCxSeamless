import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const MENU_ITEMS = [
  { to: '/', end: true, label: 'อัปโหลด Seamless X GAS' },
  { to: '/history', end: false, label: 'ประวัติ' },
];

export default function TopNavBar({ onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const location = useLocation();

  const isActive = MENU_ITEMS.some((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

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
          <div className="top-navbar-dropdown" ref={containerRef}>
            <button
              className="top-navbar-link top-navbar-dropdown-trigger"
              aria-expanded={isOpen}
              aria-haspopup="true"
              data-active={isActive}
              type="button"
              onClick={() => setIsOpen((value) => !value)}
            >
              Seamless X GAS
              <span className="top-navbar-dropdown-caret" aria-hidden="true">
                ▾
              </span>
            </button>

            {isOpen ? (
              <div className="top-navbar-dropdown-menu" role="menu">
                {MENU_ITEMS.map((item) => (
                  <NavLink
                    className="top-navbar-dropdown-item"
                    end={item.end}
                    key={item.to}
                    role="menuitem"
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ) : null}
          </div>
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
