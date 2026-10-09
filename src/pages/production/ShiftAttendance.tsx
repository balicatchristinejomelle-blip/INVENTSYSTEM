import React, { useState, useEffect } from 'react';
import { useApp } from '../../store';
import hpaiLogo from '../../assets/hpai-logo.png';

export default function ShiftAttendance() {
  const { currentUser, employees, clockIn } = useApp();
  const [now, setNow] = useState(new Date());
  const [employeeName, setEmployeeName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const shift = now.getHours() >= 6 && now.getHours() < 18 ? 'Day' : 'Night';
  const normalizedName = employeeName.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const matchedEmployee = employees.find(employee =>
    employee.role === 'production'
    && employee.status === 'Active'
    && `${employee.firstName} ${employee.lastName}`.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName
  );
  const employeeMatchesAccount = !!matchedEmployee
    && matchedEmployee.employeeId === currentUser?.employeeId
    && matchedEmployee.username === currentUser?.username;

  return (
    <div className="auth-screen" style={{
      minHeight: '100vh',
      background: 'var(--app-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div className="attendance-card" style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 12,
        padding: '36px 40px',
        width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={hpaiLogo} alt="HPAI" style={{ height: 48, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Shift Attendance</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Branch Plant — Production</p>
        </div>

        <div className="clockin-details">
          <div className="clockin-grid">
            <div>
              <div className="clockin-label">Employee Name</div>
              <input
                className="app-input"
                value={employeeName}
                onChange={event => {
                  setEmployeeName(event.target.value);
                  setError('');
                }}
                placeholder="Enter employee name"
                autoComplete="off"
                autoFocus
              />
            </div>
            <div>
              <div className="clockin-label">Employee ID <span>AUTO</span></div>
              <div className="clockin-value font-mono">{employeeMatchesAccount ? matchedEmployee.employeeId : '—'}</div>
            </div>
            <div>
              <div className="clockin-label">Date <span>AUTO</span></div>
              <div className="clockin-value">{dateStr}</div>
            </div>
            <div>
              <div className="clockin-label">Current Time <span>LIVE</span></div>
              <div className="clockin-value font-mono">{timeStr}</div>
            </div>
            <div className="clockin-shift">
              <div className="clockin-label">Shift <span>AUTO</span></div>
              <div className="clockin-value">{shift} Shift ({shift === 'Day' ? '6AM–6PM' : '6PM–6AM'})</div>
            </div>
          </div>
        </div>

        {error && <div className="alert-error mb-4">{error}</div>}

        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={() => {
            setError('');
            const result = clockIn(employeeName);
            if (!result.success) setError(result.error || 'Clock In could not be saved.');
          }}
          disabled={!employeeName.trim()}
        >
          CLOCK IN
        </button>
      </div>
    </div>
  );
}
