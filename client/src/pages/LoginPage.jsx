import { useState } from 'react';
import { login } from '../services/api.js';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ message: '', state: 'idle' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!username || !password) {
      setStatus({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', state: 'error' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ message: 'กำลังเข้าสู่ระบบ...', state: 'working' });

    try {
      await login(username, password);
      onLoginSuccess();
    } catch (error) {
      setStatus({
        message: error?.message || 'เข้าสู่ระบบไม่สำเร็จ',
        state: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="panel login-panel">
        <p className="panel-eyebrow">Seamless X GAS Excel Formatter</p>
        <h2>เข้าสู่ระบบ</h2>
        <form className="upload-form" onSubmit={handleSubmit}>
          <label className="field">
            ชื่อผู้ใช้
            <input
              autoComplete="username"
              disabled={isSubmitting}
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              type="text"
              value={username}
            />
          </label>
          <label className="field">
            รหัสผ่าน
            <input
              autoComplete="current-password"
              disabled={isSubmitting}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          <button disabled={isSubmitting} type="submit">
            เข้าสู่ระบบ
          </button>
        </form>
        {status.message ? (
          <p className="status" data-state={status.state}>
            {status.message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
