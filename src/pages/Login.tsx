import React, { useState } from 'react';
import { useApp } from '../store';
import hpaiLogo from '../assets/hpai-logo.png';

export default function Login() {
  const { login, theme, setTheme, navigate } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const result = login(username, password);
      setLoading(false);
      if (!result.success) setError(result.error || 'Login failed.');
    }, 400);
  };

  return (
    <div className="auth-screen" style={{
      minHeight: '100vh',
      background: theme === 'dark' ? '#060d1f' : '#eef2f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      backgroundImage: theme === 'dark'
        ? 'radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(245,158,11,0.04) 0%, transparent 50%)'
        : 'radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(15,31,61,0.05) 0%, transparent 50%)',
    }}>
      {/* Theme toggle - top right */}
      <button
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          border: 'none', borderRadius: 20, padding: '6px 14px',
          cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {theme === 'light' ? (
          <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round"/></svg> Dark Mode</>
        ) : (
          <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" strokeLinejoin="round"/></svg> Light Mode</>
        )}
      </button>

      {/* Login card */}
      {!showForgot ? (
        <div className="auth-card" style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 12,
          padding: '36px 40px',
          width: 380,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src={hpaiLogo} alt="HPAI Logo" style={{ height: 64, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />
            <h1 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Hydro Phil Asia Inc.</h1>
            <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: 0 }}>Inventory & Production Management System</p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Username</label>
              <input
                className="app-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="app-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  style={{ paddingRight: 36 }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2,
                }}>
                  {showPass ? (
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert-error" style={{ marginBottom: 12, fontSize: 12 }}>{error}</div>
            )}

            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ accentColor: 'var(--accent-blue)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Remember Me</span>
              </label>
              <button type="button" onClick={() => setShowForgot(true)} style={{ fontSize: 12, color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Forgot Password
              </button>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing in...' : 'LOGIN'}
            </button>
          </form>

        </div>
      ) : (
        /* Forgot Password */
        <div className="auth-card" style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 12,
          padding: '36px 40px',
          width: 380,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <img src={hpaiLogo} alt="HPAI Logo" style={{ height: 48, objectFit: 'contain', display: 'block', margin: '0 auto 10px' }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Reset Password</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Enter your username to receive a temporary password</p>
          </div>

          {!forgotSent ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Username / Account Identifier</label>
                <input className="app-input" type="text" value={forgotUsername} onChange={e => setForgotUsername(e.target.value)} placeholder="Enter your username" />
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setShowForgot(false)}>Back to Login</button>
                <button className="btn-warning" disabled={!forgotUsername.trim()} onClick={() => { if (forgotUsername) setForgotSent(true); }}>Request Password Reset</button>
              </div>
            </>
          ) : (
            <>
              <div className="alert-success" style={{ marginBottom: 16, fontSize: 12 }}>
                A temporary password reset request has been submitted for <strong>{forgotUsername}</strong>. Please contact your system administrator to receive your temporary password.
              </div>
              <button className="btn-secondary" style={{ width: '100%' }} onClick={() => { setShowForgot(false); setForgotSent(false); setForgotUsername(''); }}>
                Back to Login
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
