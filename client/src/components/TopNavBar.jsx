import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV_GROUPS = [
  {
    key: 'seamless',
    label: 'Seamless X GAS',
    basePath: '/',
    items: [
      { to: '/', end: true, label: 'อัปโหลด Seamless X GAS' },
      { to: '/history', end: false, label: 'ประวัติ' },
    ],
  },
  {
    key: 'shopee',
    label: 'Shopee',
    basePath: '/shopee',
    items: [
      { to: '/shopee/upload', end: false, label: 'อัปโหลดยอดขาย' },
      { to: '/shopee/history', end: false, label: 'ประวัติ' },
    ],
  },
];

function isGroupActive(group, pathname) {
  if (group.basePath === '/') {
    return pathname === '/' || pathname === '/history';
  }

  return pathname.startsWith(group.basePath);
}

export default function TopNavBar({ onLogout }) {
  const [openGroupKey, setOpenGroupKey] = useState('');
  const containerRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenGroupKey('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setOpenGroupKey('');
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

        <nav className="top-navbar-nav" aria-label="เมนูหลัก" ref={containerRef}>
          {NAV_GROUPS.map((group) => {
            const isActive = isGroupActive(group, location.pathname);
            const isOpen = openGroupKey === group.key;

            return (
              <div className="top-navbar-dropdown" key={group.key}>
                <button
                  className="top-navbar-link top-navbar-dropdown-trigger"
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  data-active={isActive}
                  type="button"
                  onClick={() => setOpenGroupKey((value) => (value === group.key ? '' : group.key))}
                >
                  {group.label}
                  <span className="top-navbar-dropdown-caret" aria-hidden="true">
                    ▾
                  </span>
                </button>

                {isOpen ? (
                  <div className="top-navbar-dropdown-menu" role="menu">
                    {group.items.map((item) => (
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
            );
          })}
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
