import RecordRows from "../../components/RecordRows"

import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import React from "react"

import StatusBadge from "../../components/StatusBadge"

import { ReportCard } from "../../components/MiniChart"

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

function MaterialUsage() {
  const { materialUsageTransactions, productionOrders } = useSearchableApp()

  const period = usePeriod("month")

  const periodTransactions = materialUsageTransactions.filter(item => dateInPeriod(item.dateTime, period.range));

  const pelletLoadedTxns = periodTransactions.filter(tx => tx.materialType !== 'COLORANT');

  const colorantTxns = periodTransactions.filter(tx => tx.materialType === 'COLORANT');

  const pelletConsumption = pelletLoadedTxns.reduce((sum, transaction) => sum + transaction.quantity, 0);

  const colorantConsumption = colorantTxns.reduce((sum, transaction) => sum + transaction.quantity, 0);

  // Active/In Production POs

  const activePOs = productionOrders.filter(po => po.status === 'In Production' || po.status === 'Scheduled');

  const mainPO = productionOrders.find(po => po.status === 'In Production') || productionOrders[0];

  const completedQty = mainPO?.completedQty ?? 0

  const targetQty = mainPO?.targetQty ?? 500

  const remainingQty = targetQty - completedQty

  return (
    <div>
      <PeriodSelector period={period} />
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        <ReportCard
          label="Recorded Pellet Consumption"
          value={`${pelletConsumption.toFixed(1)} kg`}
          sub={`${pelletLoadedTxns.length} successful bag load(s)`}
          color="var(--accent-blue)"
        />
        <div className="app-card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Production Output — {mainPO?.poNo}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
              {completedQty}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {targetQty} units</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 4 }}>
            <div className="progress-fill" style={{ width: `${targetQty > 0 ? Math.round(completedQty / targetQty * 100) : 0}%`, background: '#2563eb' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {targetQty > 0 ? Math.round(completedQty / targetQty * 100) : 0}% complete &mdash; {remainingQty} remaining
          </div>
        </div>
        <ReportCard label="Colorant Used" value={`${colorantConsumption.toFixed(2)} kg`} sub={`${colorantTxns.length} usage transaction(s)`} color="var(--accent-gold)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, marginBottom: 14 }}>
        {/* Pellet Load Transactions Table */}
        <div className="app-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: '12px 14px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Shared Material Usage Transactions
            </h3>
          </div>
          {periodTransactions.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No material usage transactions recorded.</div>
          ) : (
            <table className="app-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Batch</th>
                  <th>Item</th>
                  <th>Qty Used (kg)</th>
                  <th>PO Reference</th>
                  <th>Employee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {
                  <RecordRows
                    records={periodTransactions}
                    render={(tx) => (
                      <tr key={tx.id} className="table-row-hover">
                        <td style={{ fontSize: 12 }}>
                          {tx.dateTime.slice(0, 10)}
                        </td>
                        <td className="font-mono" style={{ fontSize: 11 }}>
                          {tx.dateTime.slice(11, 16)}
                        </td>
                        <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                          {tx.sourceReference || "—"}
                        </td>
                        <td style={{ fontSize: 12 }}>{tx.materialName}</td>
                        <td>
                      <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>
                        {tx.quantity.toFixed(2)}
                      </span>
                    </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)' }}>
                            {tx.productionOrderRef}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{tx.employeeName}</td>
                        <td>
                          <StatusBadge status="Completed" size="sm" />
                        </td>
                      </tr>
                    )}
                  />
                }
              </tbody>
            </table>
          )}
        </div>

        {/* Material totals */}
        <div className="app-card" style={{ padding: "14px" }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, marginTop: 0 }}>
            Actual Material Totals
          </h3>
          <div className="metric-row">
            <div>
              <strong>Total Pellet Weight</strong>
              <span>Virgin + Recycled</span>
            </div>
            <strong>{pelletConsumption.toFixed(2)} kg</strong>
          </div>
          <div className="metric-row">
            <div>
              <strong>Colorant Used</strong>
              <span>Recorded kilogram consumption</span>
            </div>
            <strong>{colorantConsumption.toFixed(2)} kg</strong>
          </div>
          <div className="metric-row">
            <div>
              <strong>Total Material Weight</strong>
              <span>Pellets + Colorant</span>
            </div>
            <strong>
              {(pelletConsumption + colorantConsumption).toFixed(2)} kg
            </strong>
          </div>
        </div>
      </div>

      {/* Production Order Material Breakdown */}
      <div className="app-card" style={{ padding: "14px" }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14, marginTop: 0 }}>
          Production Order Material Usage
        </h3>
        {productionOrders.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>No production orders.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {productionOrders.map((po) => {
              const poTransactions = periodTransactions.filter(transaction => transaction.productionOrderId === po.id);

              const pelletKg = poTransactions.filter(transaction => transaction.materialType !== 'COLORANT').reduce((sum, transaction) => sum + transaction.quantity, 0);

              const colorantKg = poTransactions.filter(transaction => transaction.materialType === 'COLORANT').reduce((sum, transaction) => sum + transaction.quantity, 0);

              return (
                <div key={po.id} style={{ padding: '12px 14px', background: 'var(--app-bg)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                    <span className="font-mono" style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
                      {po.poNo}
                    </span>
                    <StatusBadge status={po.status} size="sm" />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                    {po.product} {po.diameter} &mdash; {po.pelletType}
                  </div>
                  <div className="responsive-grid">
                    <div>
                      <div className="field-label">Actual Pellet Usage</div>
                      <div className="field-value font-mono">{pelletKg} kg</div>
                    </div>
                    <div>
                      <div className="field-label">Actual Colorant Usage</div>
                      <div className="field-value font-mono">
                        {colorantKg} kg
                      </div>
                    </div>
                    <div>
                      <div className="field-label">Total Actual Material</div>
                      <div className="field-value font-mono">
                        {pelletKg + colorantKg} kg
                      </div>
                    </div>
                    <div>
                      <div className="field-label">Expected Usage</div>
                      <div className="field-value">No BOM defined</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default withRecordSearch(MaterialUsage, [
  "materialUsageTransactions",
  "productionOrders",
])
