import RecordReference from '../../components/RecordReference';
import ActionButton from '../../components/ActionButton';
import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import React, { useState } from "react"

import {
  TEST_BASE_COLORANT_RATE,
  TEST_STRIPE_COLORANT_RATE,
  formatProductionTime,
} from "../../store"

function ProductionDashboard() {
  const {
    activeAttendance, activeProductionOrder: activePO, currentMaterialUsage,
    currentSessionTransactions, pendingTurnover, navigate, acceptTurnover,
  } = useSearchableApp()

  const pct = activePO && activePO.targetQty > 0 ? Math.round(activePO.completedQty / activePO.targetQty * 100) : 0;

  const [showTurnover, setShowTurnover] = useState(!!pendingTurnover);

  const currentSessionOutput = currentSessionTransactions
    .filter(transaction => transaction.transactionType === 'Production Output' && transaction.reference === activePO?.poNo)
    .reduce((sum, transaction) => sum + Math.max(0, transaction.qtyChanged), 0);

  const materialUsageMissing = currentSessionOutput > 0 && currentMaterialUsage.totalPelletWeightKg === 0;

  const displayedBaseColorant = currentMaterialUsage.baseColorantWeightKg;

  const displayedStripeColorant = activePO?.stripe === 'No Stripe'
    ? 0
    : currentMaterialUsage.stripeColorantWeightKg;

  const displayedColorantTotal = displayedBaseColorant + displayedStripeColorant;

  const reviewMaterials = () => {
    if (!activePO) return;
    sessionStorage.setItem('hpai:material-review-request', JSON.stringify({ poId: activePO.id, returnPage: 'production-dashboard' }));
    navigate('prod-orders');
  };

  return (
    <div className="production-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Pending turnover banner */}
      {pendingTurnover && !showTurnover && (
        <div style={{ background: '#fef3c7', border: '1px solid #d97706', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4 }}>PENDING SHIFT TURNOVER</div>
          <div style={{ fontSize: 12, color: "#78350f" }}>
            Previous: {pendingTurnover.outgoingShift} Shift ·{" "}
            {pendingTurnover.outgoingEmployee} · <RecordReference value={pendingTurnover.poRef} />
          </div>
          <div className="mt-3 button-group">
            <button className="btn-secondary" onClick={() => navigate('prod-turnover')}>View Shift Turnover</button>
            <ActionButton className="btn-success" onClick={() => { acceptTurnover(); setShowTurnover(false); }}>Accept & Continue</ActionButton>
          </div>
        </div>
      )}

      {/* Current Shift info */}
      <div className="app-card" style={{ padding: "14px 16px" }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Current Shift</h3>
        <div className="shift-summary-grid">
          <div>
            <div className="field-label">Employee</div>
            <div className="field-value">
              {activeAttendance?.employeeName || "—"}
            </div>
          </div>
          <div>
            <div className="field-label">Employee ID</div>
            <div className="field-value font-mono">
              {activeAttendance?.employeeId || "—"}
            </div>
          </div>
          <div>
            <div className="field-label">Shift</div>
            <div className="field-value text-blue">
              {activeAttendance ? `${activeAttendance.shift} Shift` : "—"}
            </div>
          </div>
          <div>
            <div className="field-label">Clock In</div>
            <div className="field-value font-mono">
              {formatProductionTime(activeAttendance?.clockIn)}
            </div>
          </div>
          <div>
            <div className="field-label">Status</div>
            <div className="field-value text-success">
              {activeAttendance ? "Clocked In" : "—"}
            </div>
          </div>
          <div>
            <div className="field-label">Active PO</div>
            <div className="field-value font-mono">{activePO?.poNo || '—'}</div>
          </div>
        </div>
      </div>

      <div className="app-card" style={{ padding: "14px 16px" }}>
        <div className="section-heading material-usage-heading">
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Automatic Material Usage</h3>
        </div>
        {materialUsageMissing && <div className="alert-warning mb-3">
          <strong>MATERIAL USAGE MISSING</strong>
          <div>Load production materials before recording output.</div>
          <div className="button-group mt-3">
            <button className="btn-secondary btn-compact" onClick={reviewMaterials}>Review Materials</button>
          </div>
        </div>}
        <div className="material-usage-grid">
          <div className="material-usage-group">
            <div className="section-title">Virgin Pellets</div>
            <div className="field-label">Bags Used</div>
            <div className="field-value font-mono">
              {currentMaterialUsage.virginBags}
            </div>
            <div className="field-label mt-3">Weight</div>
            <div className="field-value font-mono">
              {currentMaterialUsage.virginWeightKg} kg
            </div>
          </div>
          <div className="material-usage-group">
            <div className="section-title">Recycled Pellets</div>
            <div className="field-label">Bags Used</div>
            <div className="field-value font-mono">
              {currentMaterialUsage.recycledBags}
            </div>
            <div className="field-label mt-3">Weight</div>
            <div className="field-value font-mono">
              {currentMaterialUsage.recycledWeightKg} kg
            </div>
          </div>
          <div className="material-usage-group">
            <div className="section-title">Base Colorant</div>
            <div className="field-label">Color</div>
            <div className="field-value">{activePO?.color || "—"}</div>
            <div className="field-label mt-3">Used</div>
            <div className="field-value font-mono">
              {displayedBaseColorant} kg
            </div>
          </div>
          <div className="material-usage-group">
            <div className="section-title">Stripe Colorant</div>
            <div className="field-label">Stripe</div>
            <div className="field-value">{activePO?.stripe || "—"}</div>
            <div className="field-label mt-3">Used</div>
            <div className="field-value font-mono">
              {activePO?.stripe === 'No Stripe' ? 'Not Required' : `${displayedStripeColorant} kg`}
            </div>
          </div>
        </div>
        <div className="material-usage-group material-summary">
          <div className="section-title">Summary</div>
          <div className="material-summary-metrics">
            <div><div className="field-label">Total Pellet Weight</div><div className="field-value font-mono">{currentMaterialUsage.totalPelletWeightKg} kg</div></div>
            <div><div className="field-label">Total Colorant Weight</div><div className="field-value font-mono">{displayedColorantTotal} kg</div></div>
            <div><div className="field-label">Total Material Weight</div><div className="field-value font-mono">{currentMaterialUsage.totalPelletWeightKg + displayedColorantTotal}{" "}kg</div></div>
          </div>
        </div>
        <div className="helper-text material-usage-note">
          PO color and stripe select matching colorants automatically at output. Current configurable TEST / PROTOTYPE rates: base {" "}
          {(TEST_BASE_COLORANT_RATE * 100).toFixed(2)}%, stripe{" "}
          {(TEST_STRIPE_COLORANT_RATE * 100).toFixed(2)}%. These are not
          official HPAI formulas.
        </div>
      </div>

      {/* Active PO */}
      {activePO ? (
        <div className="app-card" style={{ padding: "14px 16px" }}>
          <div className="section-heading mb-3">
            <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Production Order</h3>
            <span className="badge-blue px-2 py-0.5 text-[11px] rounded font-medium">
              {activePO.status}
            </span>
          </div>
          <div className="po-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>PO Number</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)', fontFamily: 'JetBrains Mono, monospace' }}>
                <RecordReference value={activePO.poNo} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Product</div>
              <div style={{ fontSize: 13 }}>{activePO.product}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Diameter</div>
              <div style={{ fontSize: 13 }}>{activePO.diameter}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Length</div>
              <div style={{ fontSize: 13 }}>{activePO.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                SDR / Thickness
              </div>
              <div style={{ fontSize: 13 }}>{activePO.sdr}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Grade</div>
              <div style={{ fontSize: 13 }}>{activePO.grade}</div>
            </div>
          </div>

          <div className="po-progress-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            {[['Target', activePO.targetQty, '#2563eb'], ['Completed', activePO.completedQty, '#16a34a'], ['Remaining', activePO.targetQty - activePO.completedQty, '#d97706']].map(([label, val, color]) => (
              <div key={label as string} className="app-card" style={{ padding: '10px 12px', background: 'var(--app-bg)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>
                  {label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: color as string, fontFamily: 'JetBrains Mono, monospace' }}>
                  {val}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#2563eb' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {pct}% complete
            </div>
          </div>
        </div>
      ) : (
        <div className="app-card" style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No active production order assigned.</div>
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => navigate('prod-orders')}>View Production Orders</button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="app-card quick-actions" style={{ padding: '14px 16px' }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Quick Actions</h3>
        <div className="production-actions quick-action-grid">
          <button className="btn-primary" onClick={() => navigate('prod-orders')}>Continue Production</button>
          <button className="btn-primary" onClick={() => navigate('prod-barcode')}>Open Barcode Scanner</button>
          <button className="btn-primary" onClick={() => navigate('prod-finished-pipes')}>Record Output</button>
          <button className="btn-danger" onClick={() => navigate('prod-recycling')}>Record Rejection</button>
          <button className="btn-secondary" onClick={() => navigate('prod-turnover')}>Shift Turnover</button>
          <button className="btn-warning" onClick={() => navigate('prod-clockout')}>Clock Out</button>
        </div>
      </div>
    </div>
  )
}

export default withRecordSearch(ProductionDashboard, [
  "productionOrders",
  "finishedGoods",
  "rejectedMaterials",
  "transactions",
], false, false)
