import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AnimatedThemeBackground from './components/AnimatedThemeBackground.jsx';
import TopNavBar from './components/TopNavBar.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ShopeeHistoryPage from './pages/ShopeeHistoryPage.jsx';
import ShopeeUploadPage from './pages/ShopeeUploadPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import { getSession, logout } from './services/api.js';

function AuthenticatedApp({ onLogout }) {
  const location = useLocation();
  const theme = location.pathname.startsWith('/shopee') ? 'shopee' : 'default';

  return (
    <div data-theme={theme}>
      <AnimatedThemeBackground theme={theme} />
      <TopNavBar onLogout={onLogout} />
      <Routes>
        <Route index element={<UploadPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="shopee" element={<Navigate to="/shopee/upload" replace />} />
        <Route path="shopee/upload" element={<ShopeeUploadPage />} />
        <Route path="shopee/history" element={<ShopeeHistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    getSession()
      .then((payload) => {
        if (!cancelled) {
          setAuthState(payload?.authenticated ? 'authenticated' : 'anonymous');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthState('anonymous');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setAuthState('checking');
    try {
      await logout();
    } finally {
      setAuthState('anonymous');
    }
  }

  if (authState === 'checking') {
    return null;
  }

  if (authState === 'anonymous') {
    return <LoginPage onLoginSuccess={() => setAuthState('authenticated')} />;
  }

  return <AuthenticatedApp onLogout={handleLogout} />;
}
