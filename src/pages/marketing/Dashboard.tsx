import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import React from "react"

import StatusBadge from "../../components/StatusBadge"

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="app-card statistic-card" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </div>
    </div>
  )
}

function MarketingDashboard() {
  const { orders, finishedGoods, manufacturingOrders, navigate } =
    useSearchableApp()

  return (
    <div className="page-stack">
      {/* Orders */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Orders</h3>
        <div className="kpi-grid">
          <Stat label="New" value={orders.filter(o=>o.status==='New').length} color="#2563eb" />
          <Stat label="Active" value={orders.filter(o=>o.status==='Active').length} color="#2563eb" />
          <Stat label="In Production" value={orders.filter(o=>o.status==='In Production').length} color="#d97706" />
          <Stat label="Ready for Release" value={orders.filter(o=>o.status==='Ready for Release').length} color="#16a34a" />
          <Stat label="Completed" value={orders.filter(o=>o.status==='Completed').length} color="var(--text-muted)" />
        </div>
      </section>

      {/* Finished Goods */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Finished Goods</h3>
        <div className="kpi-grid">
          <Stat label="Available" value={finishedGoods.filter(f=>f.status==='Available').length + ' batches'} color="#16a34a" />
          <Stat label="Reserved" value={finishedGoods.filter(f=>f.status==='Reserved').length + ' batches'} color="#d97706" />
          <Stat label="Low Stock" value={finishedGoods.filter(f=>f.status==='Low Stock').length} color="#dc2626" />
        </div>
      </section>

      {/* Manufacturing */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Manufacturing Orders</h3>
        <div className="kpi-grid">
          <Stat label="New" value={manufacturingOrders.filter(m=>m.status==='New').length} color="#2563eb" />
          <Stat label="In Production" value={manufacturingOrders.filter(m=>m.status==='In Production').length} color="#d97706" />
          <Stat label="Completed" value={manufacturingOrders.filter(m=>m.status==='Completed').length} color="#16a34a" />
        </div>
      </section>

      {/* Recent Orders */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Orders</h3>
          <button className="btn-secondary" onClick={() => navigate('mkt-orders')}>View All</button>
        </div>
        <div className="app-card" style={{ overflow: "hidden" }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>Order No.</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Size</th>
                <th>Qty</th>
                <th>Required Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o) => (
                <tr key={o.id} className="table-row-hover" onClick={() => navigate('mkt-orders')}>
                  <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                    {o.orderNo}
                  </td>
                  <td style={{ fontSize: 12 }}>{o.customerName}</td>
                  <td style={{ fontSize: 12 }}>{o.product}</td>
                  <td style={{ fontSize: 12 }}>
                    {o.diameter} × {o.length}
                  </td>
                  <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                    {o.quantity}
                  </td>
                  <td style={{ fontSize: 12 }}>{o.requiredDate}</td>
                  <td>
                    <StatusBadge status={o.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Quick Actions</h3>
        <div className="button-group">
          <button className="btn-primary" onClick={() => navigate('mkt-orders')}>Create Order</button>
          <button className="btn-secondary" onClick={() => navigate('mkt-finished-goods')}>Check Stock</button>
          <button className="btn-secondary" onClick={() => navigate('mkt-mo-tracking')}>View MO</button>
          <button className="btn-secondary" onClick={() => navigate('mkt-orders')}>Track Order</button>
        </div>
      </section>
    </div>
  )
}

export default withRecordSearch(MarketingDashboard, [
  "orders",
  "finishedGoods",
  "manufacturingOrders",
  "customers",
])
