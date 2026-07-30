import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { getSession, logout } from './services/api.js';

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

  return (
    <>
      <button className="logout-button" onClick={handleLogout} type="button">
        ออกจากระบบ
      </button>
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="history" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
