import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import RecordRows from "../../components/RecordRows"

import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import { finishedGoodsSummary, finishedPipeInventory } from '../../finishedGoodsInventory';
import React, { useState } from "react"

import { DonutChart, LineChart, HorizontalBar, ReportCard } from '../../components/MiniChart';

import StatusBadge from "../../components/StatusBadge"

import PeriodSelector, { dateInPeriod, usePeriod, type PeriodRange } from '../../components/PeriodSelector';

type Tab = "sales" | "orders" | "production" | "finished"

type OrderFilter = 'All' | 'Active' | 'In Production' | 'Ready for Release' | 'Completed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sales', label: 'Sales Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'production', label: 'Production Status' },
  { id: 'finished', label: 'Finished Goods' },
];

const ORDER_FILTERS: OrderFilter[] = ['All', 'Active', 'In Production', 'Ready for Release', 'Completed'];

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 10,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 style={SECTION_LABEL}>{children}</h3>;
}

function SalesOverviewTab({ period }: { period: PeriodRange }) {
  const { orders } = useSearchableApp()

  const periodOrders = orders.filter(item => dateInPeriod(item.orderDate, period));

  const totalOrders = periodOrders.length

  const activeOrders = periodOrders.filter(o => o.status !== 'Completed').length;

  const unitsOrdered = periodOrders.reduce((s, o) => s + o.quantity, 0);

  // Completed + Ready for Release = fulfilled

  const unitsCompleted = periodOrders.filter(o => o.status === 'Completed').reduce((s, o) => s + o.quantity, 0);

  const statusSegments = [
    { label: 'In Production', value: periodOrders.filter(o => o.status === 'In Production').length, color: '#d97706' },
    { label: 'Active', value: periodOrders.filter(o => o.status === 'Active').length, color: '#2563eb' },
    { label: 'Ready for Release', value: periodOrders.filter(o => o.status === 'Ready for Release').length, color: '#16a34a' },
    { label: 'Completed', value: periodOrders.filter(o => o.status === 'Completed').length, color: 'var(--text-muted)' },
  ];

  const orderTrend = Array.from(new Map(periodOrders.map(item => [item.orderDate, periodOrders.filter(order => order.orderDate === item.orderDate).length])).entries())
    .map(([date, value]) => ({ label: date.slice(5), value }));

  return (
    <div className="page-stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <ReportCard label="Orders During Period" value={totalOrders} sub={period.label} color="var(--accent-blue)" />
        <ReportCard label="Active Orders" value={activeOrders} sub="Not yet completed" color="#d97706" />
        <ReportCard label="Units Ordered" value={unitsOrdered.toLocaleString()} sub="Across all orders" color="var(--text-primary)" />
        <ReportCard label="Units Completed" value={unitsCompleted} sub="Completed orders in period" color="#16a34a" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="app-card" style={{ padding: 16 }}>
          <SectionLabel>Monthly Orders Trend</SectionLabel>
          <LineChart
            points={orderTrend.length ? orderTrend : [{ label: 'No activity', value: 0 }]}
            color="var(--accent-blue)"
            height={90}
            unit=" orders"
          />
        </div>
        <div className="app-card" style={{ padding: 16 }}>
          <SectionLabel>Order Status Breakdown</SectionLabel>
          <DonutChart segments={statusSegments} size={110} />
        </div>
      </div>
    </div>
  );
}

function OrdersTab({ period }: { period: PeriodRange }) {
  const { orders } = useSearchableApp()

  const [filter, setFilter] = useViewState<OrderFilter>("marketing/Reports:filter", "All")

  const periodOrders = orders.filter(item => dateInPeriod(item.orderDate, period));

  const filtered = filter === 'All' ? periodOrders : periodOrders.filter(o => o.status === filter);

  return (
    <div className="page-stack">
      {/* Filter Pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ORDER_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: filter === f ? 600 : 400,
              color: filter === f ? '#fff' : 'var(--text-secondary)',
              background: filter === f ? 'var(--accent-blue)' : 'var(--input-bg)',
              border: '1px solid',
              borderColor: filter === f ? 'var(--accent-blue)' : 'var(--input-border)',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="app-card" style={{ padding: 16 }}>
        <table className="app-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Order No.</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Required Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <TableBody>
            {
              <RecordRows
                records={filtered}
                render={(o) => (
                  <tr key={o.id} className="table-row-hover">
                    <td className="font-mono">{o.orderNo}</td>
                    <td>{o.orderDate}</td>
                    <td>{o.customerName}</td>
                    <td>{o.product}</td>
                    <td>
                      {o.diameter} / {o.sdr}
                    </td>
                    <td className="font-mono" style={{ textAlign: "right" }}>
                      {o.quantity}
                    </td>
                    <td>{o.requiredDate}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                )}
              />
            }
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                  No orders match this filter.
                </td>
              </tr>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  )
}

function ProductionStatusTab() {
  const { productionOrders } = useSearchableApp()

  // Use exact seed values

  const poData = [
    { poNo: 'PO-2026-0012', target: 500, completed: 325, remaining: 175, status: 'In Production' },
    { poNo: 'PO-2026-0011', target: 400, completed: 400, remaining: 0, status: 'Completed' },
    { poNo: 'PO-2026-0013', target: 550, completed: 0, remaining: 550, status: 'Scheduled' },
  ];

  const onTrack = productionOrders.filter(p => p.status === 'In Production').length;

  const behind = productionOrders.filter(p => p.status === 'Scheduled').length;

  const completedThisMonth = productionOrders.filter(p => p.status === 'Completed').length;

  const completionPct = poData.map(p => ({
    label: p.poNo,
    value: p.target > 0 ? Math.round((p.completed / p.target) * 100) : 0,
    max: 100,
    color: p.status === 'Completed' ? '#16a34a' : p.status === 'In Production' ? 'var(--accent-blue)' : 'var(--text-muted)',
    unit: '%',
  }));

  return (
    <div className="page-stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <ReportCard label="On Track Orders" value={onTrack} color="#16a34a" sub="Currently in production" />
        <ReportCard label="Behind Schedule" value={behind} sub="Scheduled, not started" color="#ef4444" />
        <ReportCard label="Completed This Month" value={completedThisMonth} color="var(--text-muted)" sub="Fully manufactured" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {poData.map((p) => {
          const pct = p.target > 0 ? Math.round((p.completed / p.target) * 100) : 0;

          const barColor = p.status === 'Completed' ? '#16a34a' : p.status === 'In Production' ? 'var(--accent-blue)' : 'var(--text-muted)';

          return (
            <div key={p.poNo} className="app-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    <RecordReference value={p.poNo} />
                  </span>
                  <span style={{ marginLeft: 10, display: "inline-block" }}>
                    <StatusBadge status={p.status} />
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: barColor, fontFamily: 'JetBrains Mono, monospace' }}>
                  {pct}%
                </span>
              </div>
              <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>TARGET</div>
                  <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {p.target}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>COMPLETED</div>
                  <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>
                    {p.completed}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>REMAINING</div>
                  <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: p.remaining > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                    {p.remaining}
                  </div>
                </div>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="app-card" style={{ padding: 16 }}>
        <SectionLabel>Completion % by Production Order</SectionLabel>
        <HorizontalBar data={completionPct} />
      </div>
    </div>
  )
}

function FinishedGoodsTab() {
  const { finishedGoods } = useSearchableApp()

  const inventory = finishedGoodsSummary(finishedGoods);
  const totalAvailable = inventory.available;

  const totalReserved = inventory.reserved;

  return (
    <div className="page-stack">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ReportCard label="Total Available" value={totalAvailable} sub="General inventory for new orders" color="#16a34a" />
          <ReportCard label="Total Reserved" value={totalReserved} sub="Reserved general inventory" color="#d97706" />
          <ReportCard label="Temporary Buyer Stock" value={inventory.temporary} sub="Not available to other buyers" color="#7c3aed" />
          <ReportCard label="Ready for Ship Out" value={inventory.ready} sub="Loaded remains On Hand" color="#2563eb" />
          <ReportCard label="On Hand" value={inventory.onHand} sub="Unique physical pipes, including awaiting storage" color="#64748b" />
        </div>
        <div className="app-card" style={{ padding: 16 }}>
          <SectionLabel>Stock Status Breakdown</SectionLabel>
          <DonutChart
            segments={[
              { label: 'Available', value: totalAvailable, color: '#16a34a' },
              { label: 'Reserved', value: totalReserved, color: '#d97706' },
            ]}
            size={100}
          />
        </div>
      </div>

      <div className="app-card" style={{ padding: 16 }}>
        <SectionLabel>Finished Goods Inventory</SectionLabel>
        <table className="app-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>FG ID</th>
              <th>Product</th>
              <th>Size</th>
              <th>Total Qty</th>
              <th>Available</th>
              <th>Reserved</th>
              <th>Storage</th>
              <th>Status</th>
            </tr>
          </thead>
          <TableBody>
            {
              <RecordRows
                records={finishedGoods}
                render={(fg) => (
                  <tr key={fg.id} className="table-row-hover">
                    <td className="font-mono">{fg.fgId}</td>
                    <td>{fg.product}</td>
                    <td>
                      {fg.diameter} / {fg.sdr}
                    </td>
                    <td className="font-mono" style={{ textAlign: "right" }}>
                      {fg.quantity}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                      {finishedPipeInventory(fg).available}
                    </td>
                    <td className="font-mono" style={{ textAlign: 'right', color: '#d97706', fontWeight: 600 }}>
                      {finishedPipeInventory(fg).reserved}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {fg.currentLocation || "Not Yet Assigned"}
                    </td>
                    <td>
                      <StatusBadge status={fg.status} />
                    </td>
                  </tr>
                )}
              />
            }
          </TableBody>
        </table>
      </div>
    </div>
  )
}

function MarketingReports() {
  const [activeTab, setActiveTab] = useViewState<Tab>("marketing/Reports:activeTab", 'sales');
  const period = usePeriod('month');

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
          Reports &amp; Analytics
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Main Plant — Marketing</p>
      </div>
      <PeriodSelector period={period} />

      {/* Tabs */}
      <div className="report-tabs" style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--card-border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s',
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'sales' && <SalesOverviewTab period={period.range} />}
      {activeTab === 'orders' && <OrdersTab period={period.range} />}
      {activeTab === 'production' && <ProductionStatusTab />}
      {activeTab === 'finished' && <FinishedGoodsTab />}
    </div>
  );
}

export default withRecordSearch(MarketingReports, [
  "orders",
  "manufacturingOrders",
  "productionOrders",
  "finishedGoods",
], true)
