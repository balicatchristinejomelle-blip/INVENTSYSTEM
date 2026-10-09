import React, { useEffect, useMemo, useState } from 'react';
import { formatProductionTime, useApp } from '../../store';

export default function ClockOut() {
  const {
    currentUser, currentShift, activeAttendance, activeProductionOrder: activePO,
    currentSessionTurnover, currentSessionTransactions, clockOut, navigate,
  } = useApp();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const turnoverCompleted = !!currentSessionTurnover
    && (!activePO || currentSessionTurnover.productionOrderId === activePO.id);
  const turnoverRequired = !!activePO
    && activePO.completedQty < activePO.targetQty
    && activePO.status !== 'Completed'
    && activePO.status !== 'Cancelled'
    && !turnoverCompleted;
  const durationMinutes = activeAttendance
    ? Math.max(0, Math.floor((now.getTime() - new Date(`${activeAttendance.date}T${activeAttendance.clockIn}:00`).getTime()) / 60000))
    : 0;
  const productionActivity = useMemo(() => {
    const outputs = currentSessionTransactions.filter(transaction => transaction.transactionType === 'Production Output');
    const produced = outputs.reduce((sum, transaction) => sum + Math.max(0, transaction.qtyChanged), 0);
    const loadedBags = new Set(
      currentSessionTransactions
        .filter(transaction => transaction.transactionType === 'Pellet Loaded')
        .map(transaction => transaction.barcode || transaction.id)
    ).size;
    if (!outputs.length && !loadedBags) return 'No production activity recorded this shift.';
    return [
      produced ? `${produced} pipe${produced === 1 ? '' : 's'} produced` : '',
      loadedBags ? `${loadedBags} pellet bag${loadedBags === 1 ? '' : 's'} loaded` : '',
    ].filter(Boolean).join(' · ');
  }, [currentSessionTransactions]);
  const duration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;

  if (turnoverRequired) return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <div className="app-card" style={{ padding: '24px 28px' }}>
        <div style={{ borderLeft: '4px solid #d97706', paddingLeft: 14, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>SHIFT TURNOVER REQUIRED</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This Production Order is still in progress. Complete the Shift Turnover before Clock Out so the next shift can continue the same Production Order.</p>
        </div>
        {activePO && (
          <div style={{ background: 'var(--app-bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
            <div className="responsive-grid">
              <div><div className="field-label">Production Order</div><div className="field-value text-blue">{activePO.poNo}</div></div>
              <div><div className="field-label">Product</div><div className="field-value">{`${activePO.product} ${activePO.diameter} ${activePO.length}`}</div></div>
              <div><div className="field-label">Target</div><div className="field-value">{activePO.targetQty}</div></div>
              <div><div className="field-label">Completed</div><div className="field-value text-success">{activePO.completedQty}</div></div>
              <div><div className="field-label">Remaining</div><div className="field-value" style={{ color: '#d97706' }}>{Math.max(0, activePO.targetQty - activePO.completedQty)}</div></div>
            </div>
          </div>
        )}
        <div className="button-group">
          <button className="btn-secondary" onClick={() => navigate('production-dashboard')}>Cancel</button>
          <button className="btn-primary" onClick={() => navigate('prod-turnover')}>Complete Shift Turnover</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 460, margin: '0 auto' }}>
      <div className="app-card" style={{ padding: '24px 28px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>CLOCK OUT SUMMARY</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          {turnoverCompleted
            ? `Shift Turnover ${currentSessionTurnover.turnoverNo} is already saved. No duplicate turnover will be created.`
            : 'No unfinished Production Order requires handover.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[['Employee', activeAttendance?.employeeName || currentUser?.name || ''], ['Shift', `${activeAttendance?.shift || currentShift} Shift`], ['Clock In', formatProductionTime(activeAttendance?.clockIn)], ['Current Time', now.toLocaleTimeString('en-PH')], ['Duration', duration]].map(([l, v]) => (
            <div key={l}><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div></div>
          ))}
        </div>
        <div style={{ background: 'var(--app-bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
          <div className="field-label">Production Activity</div>
          <div className="field-value">{productionActivity}</div>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => navigate('production-dashboard')}>Cancel</button>
          <button className="btn-warning" onClick={() => clockOut()}>Confirm Clock Out</button>
        </div>
      </div>
    </div>
  );
}
