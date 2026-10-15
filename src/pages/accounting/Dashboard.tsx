import { TableBody } from '../../components/UXFeedback';
import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import React from "react"

import StatusBadge from "../../components/StatusBadge"

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="app-card statistic-card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function AccountingDashboard() {
  const { pellets, materialRequests, transfers, transactions, navigate } =
    useSearchableApp()

  const rawPellets = pellets.filter(p => p.inventoryStatus === 'Available');

  const totalKg = rawPellets.reduce((s, p) => s + p.availableKg, 0);

  const virginKg = rawPellets.filter(p => p.type === 'Virgin').reduce((s, p) => s + p.availableKg, 0);

  const recycledKg = rawPellets.filter(p => p.type === 'Recycled').reduce((s, p) => s + p.availableKg, 0);

  const lowStock = rawPellets.filter(p => p.availableKg < 25).length;

  const reqNew = materialRequests.filter(r => r.status === 'New').length;

  const reqPending = materialRequests.filter(r => r.status === 'Pending').length;

  const reqApproved = materialRequests.filter(r => r.status === 'Approved').length;

  const reqRejected = materialRequests.filter(r => r.status === 'Rejected').length;

  const trPreparing = transfers.filter(t => t.status === 'Preparing').length;

  const trTransit = transfers.filter(t => t.status === 'In Transit').length;

  const trReceived = transfers.filter(t => t.status === 'Received').length;

  return (
    <div className="page-stack">
      {/* Raw Material Inventory */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Raw Material Inventory</h3>
        <div className="kpi-grid">
          <StatCard label="Total Pellets" value={`${totalKg.toFixed(0)} kg`} />
          <StatCard label="Virgin Pellet" value={`${virginKg.toFixed(0)} kg`} color="var(--accent-blue)" />
          <StatCard label="Recycled Pellet" value={`${recycledKg.toFixed(1)} kg`} color="#7c3aed" />
          <StatCard label="Low Stock Batches" value={lowStock} color={lowStock > 0 ? '#dc2626' : 'var(--text-primary)'} sub="Below 200 kg" />
        </div>
      </section>

      {/* Branch Requests & Transfers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <section>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Branch Requests</h3>
          <div className="kpi-grid">
            <StatCard label="New" value={reqNew} color="#2563eb" />
            <StatCard label="Pending" value={reqPending} color="#d97706" />
            <StatCard label="Approved" value={reqApproved} color="#16a34a" />
            <StatCard label="Rejected" value={reqRejected} color="#dc2626" />
          </div>
        </section>
        <section>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Transfers</h3>
          <div className="kpi-grid">
            <StatCard label="Preparing" value={trPreparing} color="#d97706" />
            <StatCard label="In Transit" value={trTransit} color="#2563eb" />
            <StatCard label="Received" value={trReceived} color="#16a34a" />
          </div>
        </section>
      </div>

      {/* Recent Transactions */}
      <section>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Material Transactions</h3>
          <button className="btn-secondary" onClick={() => navigate('acc-transactions')}>View All</button>
        </div>
        <div className="app-card" style={{ overflow: "hidden" }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>TX ID</th>
                <th>Date</th>
                <th>Type</th>
                <th>Item</th>
                <th>Qty Changed</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <TableBody>
              {transactions.slice(0, 5).map((tx) => (
                <tr key={tx.id} className="table-row-hover">
                  <td className="font-mono" style={{ fontSize: 11 }}>
                    {tx.txId}
                  </td>
                  <td style={{ fontSize: 11 }}>{tx.date}</td>
                  <td style={{ fontSize: 12 }}>{tx.transactionType}</td>
                  <td style={{ fontSize: 12 }}>{tx.item}</td>
                  <td className="font-mono" style={{ fontSize: 12, color: tx.qtyChanged > 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {tx.qtyChanged > 0 ? "+" : ""}
                    {tx.qtyChanged} {tx.item.includes("Pellet") ? "kg" : "pcs"}
                  </td>
                  <td style={{ fontSize: 11, color: "var(--accent-blue)" }}>
                    {tx.reference}
                  </td>
                  <td>
                    <StatusBadge status={tx.status} size="sm" />
                  </td>
                </tr>
              ))}
            </TableBody>
          </table>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Quick Actions</h3>
        <div className="button-group">
          <button className="btn-warning" onClick={() => navigate('acc-branch-requests')}>Review Requests</button>
          <button className="btn-primary" onClick={() => navigate('acc-transfers')}>Create Transfer</button>
          <button className="btn-secondary" onClick={() => navigate('acc-raw-materials')}>View Materials</button>
        </div>
      </section>
    </div>
  )
}

export default withRecordSearch(AccountingDashboard, [
  "rrRecords",
  "materialRequests",
  "transfers",
  "pellets",
  "colorants",
], false, false)
