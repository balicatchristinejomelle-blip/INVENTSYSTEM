import React, { useState } from 'react';
import { useApp } from '../store';

export default function Profile() {
  const { currentUser, currentPage, navigate, clockedIn, currentShift, clockInTime } = useApp();
  const [mode, setMode] = useState<'view' | 'edit' | 'password'>('view');
  const [firstName, setFirstName] = useState(currentUser?.name.split(' ')[0] || '');
  const [lastName, setLastName] = useState(currentUser?.name.split(' ').slice(1).join(' ') || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState(false);

  const roleLabel: Record<string, string> = {
    OWNER_SUPER_ADMIN: 'Owner / Super Admin',
    accounting: 'Accounting',
    marketing: 'Marketing',
    management: 'Management',
    plantmanager: 'Plant Manager',
    production: 'Production',
  };

  const handleSaveProfile = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); setMode('view'); }, 1200);
  };

  const handleChangePassword = () => {
    setPassError('');
    if (!currentPass || !newPass || !confirmPass) { setPassError('All fields are required.'); return; }
    if (newPass !== confirmPass) { setPassError('New passwords do not match.'); return; }
    if (newPass.length < 8) { setPassError('Password must be at least 8 characters.'); return; }
    setPassSuccess(true);
    setTimeout(() => { setPassSuccess(false); setMode('view'); setCurrentPass(''); setNewPass(''); setConfirmPass(''); }, 1500);
  };

  if (!currentUser) return null;

  if (mode === 'edit') return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="app-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Edit Profile</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>First Name</label>
            <input className="app-input" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Last Name</label>
            <input className="app-input" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Email Address</label>
          <input className="app-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="your.email@hpai.com" />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Phone Number</label>
          <input className="app-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 9XX XXX XXXX" />
        </div>
        <div className="mt-4 form-actions">
          {saved && <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 500 }}>Saved successfully.</span>}
          <button className="btn-secondary" onClick={() => setMode('view')}>Cancel</button>
          <button className="btn-primary" onClick={handleSaveProfile}>Save Changes</button>
        </div>
      </div>
    </div>
  );

  if (mode === 'password') return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div className="app-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>Change Password</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Current Password</label>
          <input className="app-input" type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>New Password</label>
          <input className="app-input" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>Confirm New Password</label>
          <input className="app-input" type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
        </div>
        {passError && <div className="alert-error" style={{ marginBottom: 12, fontSize: 12 }}>{passError}</div>}
        {passSuccess && <div className="alert-success" style={{ marginBottom: 12, fontSize: 12 }}>Password updated successfully.</div>}
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => setMode('view')}>Cancel</button>
          <button className="btn-primary" onClick={handleChangePassword}>Update Password</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="app-card" style={{ padding: 24 }}>
        <div className="flex items-center gap-4" style={{ marginBottom: 24 }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#1a3a6b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#93c5fd', fontSize: 22, fontWeight: 700 }}>
            {currentUser.name.split(' ').map(w => w[0]).slice(0,2).join('')}
          </div>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 3px' }}>{currentUser.name}</h2>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currentUser.employeeId}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {[
            ['Username', currentUser.username],
            ['Role', roleLabel[currentUser.role] || currentUser.role],
            ['Location / Plant', currentUser.plant],
            ['Account Status', 'Active'],
            ['Last Login', currentUser.lastLogin || 'N/A'],
            ...(currentUser.role === 'production' ? [
              ['Default Shift', currentUser.defaultShift || 'Day'],
              ...(clockedIn ? [['Current Status', 'Clocked In — ' + currentShift + ' Shift (' + clockInTime + ')']] : []),
            ] : []),
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: label === 'Account Status' ? 600 : 400, color: label === 'Account Status' ? '#16a34a' : 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="pt-4 button-group" style={{ borderTop: '1px solid var(--card-border)' }}>
          <button className="btn-secondary" onClick={() => navigate('profile')}>Back</button>
          <button className="btn-secondary" onClick={() => setMode('password')}>Change Password</button>
          <button className="btn-secondary" onClick={() => setMode('edit')}>Edit Profile</button>
        </div>
      </div>
    </div>
  );
}
