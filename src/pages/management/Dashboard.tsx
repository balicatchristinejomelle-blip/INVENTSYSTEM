import React from 'react';
import { useApp } from '../../store';
import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

function Metric({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="app-card" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ManagementDashboard() {
  const { productionOrders, pellets, finishedGoods, rejectedMaterials, attendance, totalRejectedKg, turnovers, manufacturingOrders, transactions, materialUsageTransactions } = useApp();
  const period = usePeriod('day');
  const periodTransactions = transactions.filter(item => dateInPeriod(item.date, period.range));
  const periodUsage = materialUsageTransactions.filter(item => dateInPeriod(item.dateTime, period.range));
  const periodRejected = rejectedMaterials.filter(item => dateInPeriod(item.date, period.range));
  const outputDuringPeriod = periodTransactions.filter(item => item.transactionType === 'Production Output').reduce((sum, item) => sum + Math.abs(item.qtyChanged), 0);

  const activePO = productionOrders.find(p => p.status === 'In Production');
  const target = activePO?.targetQty || 0;
  const completed = activePO?.completedQty || 0;
  const pct = target > 0 ? Math.round(completed / target * 100) : 0;

  const virginKg = pellets.filter(p => p.type === 'Virgin' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);
  const recycledKg = pellets.filter(p => p.type === 'Recycled' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);
  const fgTotal = finishedGoods.reduce((s, f) => s + f.availableQty, 0);
  const fgReserved = finishedGoods.reduce((s, f) => s + f.reservedQty, 0);
  const wip = activePO ? activePO.completedQty : 0;

  const dayPresent = attendance.filter(a => a.shift === 'Day' && a.status === 'Active').length;
  const nightPresent = attendance.filter(a => a.shift === 'Night' && a.status === 'Active').length;
  const pendingTurnover = turnovers.filter(t => t.status === 'Pending').length;

  const alerts = [
    virginKg < 500 && { type: 'warning', msg: `Low Virgin Pellet Inventory — ${virginKg.toFixed(0)} kg remaining` },
    totalRejectedKg >= 40 && totalRejectedKg < 50 && { type: 'warning', msg: `Rejected Material Nearing Limit — ${totalRejectedKg} kg / 50 kg` },
    totalRejectedKg >= 50 && { type: 'error', msg: `RECYCLING REQUIRED — ${totalRejectedKg} kg rejected material at/above 50 kg limit` },
    pct < 70 && activePO && { type: 'warning', msg: `Production Behind Schedule — ${pct}% completion on PO-2026-0012` },
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Alerts */}
      {alerts.length > 0 && (
        <section>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Active Alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map((a: any, i) => (
              <div key={i} className={`alert-${a.type === 'error' ? 'error' : 'warning'}`} style={{ fontSize: 12 }}>
                <strong>{a.type === 'error' ? 'URGENT:' : 'WARNING:'}</strong> {a.msg}
              </div>
            ))}
          </div>
        </section>
      )}
      <PeriodSelector period={period} compact />

      {/* Today */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{period.range.label} — Activity</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <Metric label="Production Target" value={target} />
          <Metric label="Produced During Period" value={outputDuringPeriod} color="#2563eb" />
          <Metric label="Material Consumed" value={`${periodUsage.reduce((sum, item) => sum + item.quantity, 0).toFixed(2)} kg`} color="#d97706" />
          <Metric label="Rejected During Period" value={`${periodRejected.reduce((sum, item) => sum + item.weightKg, 0).toFixed(1)} kg`} color="#dc2626" />
        </div>
      </section>

      {/* Inventory */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Inventory</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          <Metric label="Virgin Pellet" value={`${virginKg.toFixed(0)} kg`} color={virginKg < 500 ? '#dc2626' : '#2563eb'} />
          <Metric label="Recycled Pellet" value={`${recycledKg.toFixed(1)} kg`} color="#7c3aed" />
          <Metric label="WIP" value={wip + ' pcs'} color="#d97706" />
          <Metric label="Finished Goods" value={fgTotal + ' pcs'} color="#16a34a" />
          <Metric label="Reserved FG" value={fgReserved + ' pcs'} color="#d97706" />
          <Metric label="Rejected Material" value={`${totalRejectedKg} kg`} color={totalRejectedKg >= 50 ? '#dc2626' : totalRejectedKg >= 40 ? '#d97706' : 'var(--text-primary)'} />
        </div>
      </section>

      {/* Shifts & Orders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <section>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Shifts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Metric label="Day Shift Present" value={dayPresent} color="#2563eb" />
            <Metric label="Night Shift Present" value={nightPresent} color="#2563eb" />
            <Metric label="Active Shift" value="Day" color="#16a34a" />
            <Metric label="Pending Turnover" value={pendingTurnover} color={pendingTurnover > 0 ? '#d97706' : 'var(--text-primary)'} />
          </div>
        </section>
        <section>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Orders</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Metric label="Active MOs" value={manufacturingOrders.filter(m=>m.status==='In Production').length} color="#d97706" />
            <Metric label="In Production" value={productionOrders.filter(p=>p.status==='In Production').length} color="#2563eb" />
            <Metric label="Ready for Release" value={finishedGoods.filter(f=>f.reservedQty>0).length} color="#16a34a" />
            <Metric label="Completed POs" value={productionOrders.filter(p=>p.status==='Completed').length} />
          </div>
        </section>
      </div>

      {/* Rejected progress */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Rejected Material Status</h3>
        <div className="app-card" style={{ padding: '14px 16px' }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{totalRejectedKg} kg / 50 kg</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: totalRejectedKg >= 50 ? '#dc2626' : totalRejectedKg >= 40 ? '#d97706' : 'var(--text-muted)' }}>
              {totalRejectedKg >= 50 ? 'RECYCLING REQUIRED' : totalRejectedKg >= 40 ? 'NEARING LIMIT' : 'COLLECTING'}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min(100, totalRejectedKg / 50 * 100)}%`, background: totalRejectedKg >= 50 ? '#dc2626' : totalRejectedKg >= 40 ? '#d97706' : '#2563eb' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{Math.min(100, Math.round(totalRejectedKg / 50 * 100))}% of limit</div>
        </div>
      </section>
    </div>
  );
}
