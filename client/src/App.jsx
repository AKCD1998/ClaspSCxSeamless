import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AnimatedThemeBackground from './components/AnimatedThemeBackground.jsx';
import TopNavBar from './components/TopNavBar.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import PharmCareHistoryPage from './pages/PharmCareHistoryPage.jsx';
import PharmCareReportsPage from './pages/PharmCareReportsPage.jsx';
import PharmCareUploadPage from './pages/PharmCareUploadPage.jsx';
import ShopeeHistoryPage from './pages/ShopeeHistoryPage.jsx';
import ShopeeUploadPage from './pages/ShopeeUploadPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import { getSession, logout } from './services/api.js';

function resolveTheme(pathname) {
  if (pathname.startsWith('/shopee')) {
    return 'shopee';
  }

  if (pathname.startsWith('/pharmcare')) {
    return 'pharmcare';
  }

  return 'default';
}

const COLOR_MODE_STORAGE_KEY = 'colorMode';

function readInitialColorMode() {
  // localStorage can be missing or throw (SSR, privacy modes) — default to light, the look the
  // app has always had.
  try {
    return window.localStorage?.getItem(COLOR_MODE_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch (error) {
    return 'light';
  }
}

function AuthenticatedApp({ onLogout }) {
  const location = useLocation();
  const theme = resolveTheme(location.pathname);
  const [colorMode, setColorMode] = useState(readInitialColorMode);

  useEffect(() => {
    try {
      window.localStorage?.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
    } catch (error) {
      // Persisting the preference is best-effort only.
    }
  }, [colorMode]);

  return (
    <div data-theme={theme} data-color-mode={colorMode}>
      <AnimatedThemeBackground theme={theme} />
      <TopNavBar
        colorMode={colorMode}
        onToggleColorMode={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))}
        onLogout={onLogout}
      />
      <Routes>
        <Route index element={<UploadPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="shopee" element={<Navigate to="/shopee/upload" replace />} />
        <Route path="shopee/upload" element={<ShopeeUploadPage />} />
        <Route path="shopee/history" element={<ShopeeHistoryPage />} />
        <Route path="pharmcare" element={<Navigate to="/pharmcare/inbox" replace />} />
        <Route path="pharmcare/upload" element={<PharmCareUploadPage />} />
        <Route path="pharmcare/inbox" element={<PharmCareReportsPage />} />
        <Route path="pharmcare/history" element={<PharmCareHistoryPage />} />
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
