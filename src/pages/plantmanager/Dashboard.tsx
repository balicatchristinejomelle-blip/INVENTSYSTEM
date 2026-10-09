import React from 'react';
import { useApp } from '../../store';

function Card({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="app-card" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function PMDashboard() {
  const { productionOrders, pellets, finishedGoods, rejectedMaterials, attendance, turnovers, totalRejectedKg, navigate } = useApp();

  const activePO = productionOrders.find(p => p.status === 'In Production');
  const virgin = pellets.filter(p => p.type === 'Virgin' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);
  const recycled = pellets.filter(p => p.type === 'Recycled' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);
  const finishedTotal = finishedGoods.reduce((s, f) => s + f.availableQty, 0);
  const pending = turnovers.filter(t => t.status === 'Pending').length;

  const pct = Math.min(100, Math.round(totalRejectedKg / 50 * 100));
  const rejStatus = totalRejectedKg >= 50 ? 'RECYCLING REQUIRED' : totalRejectedKg >= 40 ? 'NEARING LIMIT' : 'COLLECTING';
  const rejColor = totalRejectedKg >= 50 ? '#dc2626' : totalRejectedKg >= 40 ? '#d97706' : '#2563eb';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Alerts */}
      {totalRejectedKg >= 40 && (
        <div className={`alert-${totalRejectedKg >= 50 ? 'error' : 'warning'}`} style={{ fontSize: 12 }}>
          <strong>{totalRejectedKg >= 50 ? 'RECYCLING REQUIRED:' : 'WARNING:'}</strong> Rejected material at {totalRejectedKg} kg — {rejStatus}
        </div>
      )}

      {/* Production */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Production</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Card label="Active POs" value={productionOrders.filter(p => p.status === 'In Production').length} color="#2563eb" />
          <Card label="Target" value={activePO?.targetQty || 0} />
          <Card label="Completed" value={activePO?.completedQty || 0} color="#16a34a" />
          <Card label="Remaining" value={activePO ? activePO.targetQty - activePO.completedQty : 0} color="#d97706" />
        </div>
      </section>

      {/* Pellets */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Pellet Inventory</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Card label="Virgin Pellet" value={`${virgin.toFixed(0)} kg`} color={virgin < 300 ? '#dc2626' : '#2563eb'} sub={virgin < 300 ? 'LOW STOCK' : undefined} />
          <Card label="Recycled Pellet" value={`${recycled.toFixed(1)} kg`} color="#7c3aed" />
          <Card label="Actual Loaded (Active)" value={activePO ? `${activePO.loadedKg.toFixed(0)} kg` : '—'} />
          <Card label="Low Stock" value={pellets.filter(p => p.availableKg < 200).length > 0 ? 'YES' : 'NO'} color={pellets.filter(p => p.availableKg < 200).length > 0 ? '#dc2626' : '#16a34a'} />
        </div>
      </section>

      {/* Output + Shifts + Recycling */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <section>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Output</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Card label="Finished Pipes" value={finishedTotal} color="#16a34a" />
            <Card label="Rejected kg" value={`${totalRejectedKg} kg`} color={totalRejectedKg >= 40 ? '#dc2626' : '#d97706'} />
          </div>
        </section>
        <section>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Shifts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Card label="Day Shift" value={attendance.filter(a=>a.shift==='Day'&&a.status==='Active').length + ' present'} color="#2563eb" />
            <Card label="Night Shift" value={attendance.filter(a=>a.shift==='Night'&&a.status==='Active').length + ' present'} />
            <Card label="Pending Turnover" value={pending} color={pending > 0 ? '#d97706' : 'var(--text-muted)'} />
          </div>
        </section>
        <section>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Recycling Status</h3>
          <div className="app-card" style={{ padding: '14px 16px' }}>
            <div className="flex justify-between mb-2">
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{totalRejectedKg} kg</span>
              <span style={{ fontSize: 11, color: rejColor, fontWeight: 700 }}>{rejStatus}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%`, background: rejColor }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>{pct}% of 50 kg limit</div>
          </div>
        </section>
      </div>

      {/* Quick Actions */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Quick Actions</h3>
        <div className="button-group">
          <button className="btn-secondary" onClick={() => navigate('pm-production-orders')}>View MO</button>
          <button className="btn-primary" onClick={() => navigate('pm-production-orders')}>Create Production Order</button>
          <button className="btn-primary" onClick={() => navigate('pm-requests')}>Request Pellets</button>
          <button className="btn-secondary" onClick={() => navigate('pm-turnover')}>View Shift Turnover</button>
        </div>
      </section>
    </div>
  );
}
