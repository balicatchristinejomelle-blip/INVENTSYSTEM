import {
  withRecordSearch,
  useSearchableApp,
  useSearchPaginationReset,
  useRecordQuery,
  matchesRecord,
} from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"
import { HPAI_PRODUCT_MASTER } from '../../productMaster';
import { productFilterRecord } from '../../productFilters';
import { useApp } from '../../store';

import { finishedGoodsSummary, finishedPipeInventory } from '../../finishedGoodsInventory';
import React, { useEffect, useState } from "react"

import { BarChart, DonutChart, LineChart, HorizontalBar, ReportCard } from '../../components/MiniChart';

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

import Pagination, { pageRecords } from '../../components/Pagination';

const TABS = ['Executive Overview', 'Production', 'Inventory', 'Workforce', 'Quality'] as const;

type Tab = typeof TABS[number]

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
    {children}
  </h3>
);

function Reports() {
  const fullApp = useApp();
  const {
    pellets,
    colorants,
    materialUsageTransactions,
    productionOrders,
    finishedGoods,
    attendance,
    turnovers,
    rejectedMaterials,
    totalRejectedKg,
    employees,
  } = useSearchableApp()

  const [activeTab, setActiveTab] = useState<Tab>('Executive Overview');

  const [viewByBatch, setViewByBatch] = useState(false)

  const qualitySearch = useRecordQuery()

  const [qualityStaff, setQualityStaff] = useState('All Staff');

  const [qualityProduct, setQualityProduct] = useState('All Products');

  const [qualityResult, setQualityResult] = useState('All Results');

  const [detailPage, setDetailPage] = useState(1)

  useSearchPaginationReset(setDetailPage)

  const period = usePeriod("month")

  const periodUsage = materialUsageTransactions.filter(item => dateInPeriod(item.dateTime, period.range));

  const periodAttendance = attendance.filter(item => dateInPeriod(item.date, period.range));

  const periodTurnovers = turnovers.filter(item => dateInPeriod(item.date, period.range));

  const periodRejected = rejectedMaterials.filter(item => dateInPeriod(item.date, period.range));

  const productionStaff = employees.filter(employee => employee.role === 'production');

  const qualityProducts = HPAI_PRODUCT_MASTER.products;

  const filteredQuality = periodRejected.filter((item) => {
    const query = qualitySearch.trim().toLowerCase()

    const result = item.quantity > 0 ? "Rejected" : "Good"

    return (
      (qualityStaff === 'All Staff' || item.employee === qualityStaff)
      && (qualityProduct === 'All Products' || productFilterRecord(item, fullApp).product === qualityProduct)
      && (qualityResult === 'All Results' || result === qualityResult) &&
      ((!query || [item.employee, item.poRef, item.product, item.rejectionId, item.reason]
        .some(value => value?.toLowerCase().includes(query))) ||
          matchesRecord(item, query))
    )
  })

  useEffect(() => setDetailPage(1), [activeTab, qualitySearch, qualityStaff, qualityProduct, qualityResult, period.range.start, period.range.end, viewByBatch]);

  // ── Derived values ──────────────────────────────────────────────────────────

  const activePO = productionOrders.find((p) => p.id === "po1") // PO-2026-0012

  const completedPO = productionOrders.find(p => p.status === 'Completed');

  const scheduledPO = productionOrders.find(p => p.status === 'Scheduled');

  const totalTarget = productionOrders.reduce((s, p) => s + p.targetQty, 0);

  const totalCompleted = productionOrders.reduce((s, p) => s + p.completedQty, 0);

  const activeTarget = 500

  const activeCompleted = 325

  const activeRemaining = 175

  const completionRate = Math.round((activeCompleted / activeTarget) * 100);

  const virginKg = pellets.filter(p => p.type === 'Virgin' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const recycledKg = pellets.filter(p => p.type === 'Recycled' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const totalPelletKg = virginKg + recycledKg

  const pelletUtilPct = totalPelletKg > 0 ? Math.round((recycledKg / totalPelletKg) * 100) : 0;

  const totalRejectedPcs = periodRejected.reduce((s, r) => s + r.quantity, 0);

  const rejectedRatePct = activeCompleted + totalRejectedPcs > 0
    ? Math.round((totalRejectedPcs / (activeCompleted + totalRejectedPcs)) * 100)
    : 0;

  const inventory = finishedGoodsSummary(finishedGoods);
  const fgAvailable = inventory.available;

  const fgReserved = inventory.reserved;

  const dayPresent = periodAttendance.filter(a => a.shift === 'Day').length;

  const nightPresent = periodAttendance.filter(a => a.shift === 'Night').length;

  const pendingTurnovers = periodTurnovers.filter(t => t.status === 'Pending').length;

  const usedVirginKg = periodUsage.filter(transaction => transaction.materialType === 'VIRGIN_PELLET').reduce((sum, transaction) => sum + transaction.quantity, 0);

  const usedRecycledKg = periodUsage.filter(transaction => transaction.materialType === 'RECYCLED_PELLET').reduce((sum, transaction) => sum + transaction.quantity, 0);

  const usedColorantKg = periodUsage.filter(transaction => transaction.materialType === 'COLORANT').reduce((sum, transaction) => sum + transaction.quantity, 0);

  const usedBaseColorantKg = periodUsage.filter(transaction => transaction.materialType === 'COLORANT' && (transaction.usageType || 'BASE_COLORANT') === 'BASE_COLORANT').reduce((sum, transaction) => sum + transaction.quantity, 0);

  const usedStripeColorantKg = periodUsage.filter(transaction => transaction.materialType === 'COLORANT' && transaction.usageType === 'STRIPE_COLORANT').reduce((sum, transaction) => sum + transaction.quantity, 0);

  const colorantUsed = (colorantId: string) => periodUsage
    .filter(transaction => transaction.materialType === 'COLORANT' && transaction.materialId === colorantId)
    .reduce((sum, transaction) => sum + transaction.quantity, 0);

  const rejectedLimit = 50

  const rejectedRemaining = rejectedLimit - totalRejectedKg

  // Mock daily production trend (last 7 days)

  const dailyTrend = [
    { label: 'Sep 24', value: 0 },
    { label: 'Sep 25', value: 0 },
    { label: 'Sep 26', value: 300 },
    { label: 'Sep 27', value: 0 },
    { label: 'Sep 28', value: 400 },
    { label: 'Sep 29', value: 125 },
    { label: 'Sep 30', value: 325 },
  ];

  // Shift output bar chart

  const shiftOutput = [
    { label: 'Day Sep 26', value: 300, color: '#2563eb' },
    { label: 'Night Sep 28', value: 400, color: '#7c3aed' },
    { label: 'Night Sep 29', value: 125, color: '#7c3aed' },
    { label: 'Day Sep 30', value: 325, color: '#2563eb' },
  ];

  // PO completion horizontal bars

  const poCompletionData = [
    { label: 'PO-2026-0012 (Active)', value: 65, max: 100, color: '#d97706', unit: '%' },
    { label: 'PO-2026-0011 (Completed)', value: 100, max: 100, color: '#16a34a', unit: '%' },
    { label: 'PO-2026-0013 (Scheduled)', value: 0, max: 100, color: '#94a3b8', unit: '%' },
  ];

  // Pellet stock horizontal bars

  const pelletStockData = pellets.map(p => ({
    label: `${p.batchNo} — ${p.grade}`,
    value: p.availableKg,
    max: Math.max(...pellets.map(x => x.availableKg), 1),
    color: p.type === 'Recycled' ? '#7c3aed' : '#2563eb',
    unit: ' kg',
  }));

  // Virgin vs Recycled donut

  const pelletDonut = [
    { label: `Virgin (${virginKg.toFixed(0)} kg)`, value: Math.round(virginKg), color: '#2563eb' },
    { label: `Recycled (${recycledKg.toFixed(1)} kg)`, value: Math.round(recycledKg), color: '#7c3aed' },
  ];

  // Finished goods donut

  const fgDonut = [
    { label: `Available (${fgAvailable})`, value: fgAvailable, color: '#16a34a' },
    { label: `Reserved (${fgReserved})`, value: fgReserved, color: '#d97706' },
    { label: `Temporary (${inventory.temporary})`, value: inventory.temporary, color: '#7c3aed' },
    { label: `Ready (${inventory.ready})`, value: inventory.ready, color: '#2563eb' },
    { label: `Awaiting (${inventory.awaiting + inventory.qualityPending})`, value: inventory.awaiting + inventory.qualityPending, color: '#64748b' },
  ];

  // Rejected progress width

  const rejectedPct = Math.min(100, Math.round((totalRejectedKg / rejectedLimit) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Reports &amp; Analytics</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Branch Plant · authorized reporting and analytics</p>
      </div>
      <PeriodSelector period={period} />

      {/* Tabs */}
      <div className="report-tabs" style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--card-border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: activeTab === tab ? 700 : 500,
              color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-gold)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── EXECUTIVE OVERVIEW ─────────────────────────────────────────────── */}
      {activeTab === "Executive Overview" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Alert */}
          <div className="alert-warning" style={{ fontSize: 12 }}>
            <strong>WARNING:</strong> Rejected materials at{" "}
            <strong>{totalRejectedKg} kg</strong> — only{" "}
            <strong>{rejectedRemaining} kg</strong> from the 50 kg limit. Recycling batch RP-2026-0009 is active.
          </div>

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <ReportCard
              label="Production Completion Rate"
              value={`${completionRate}%`}
              sub={`${activeCompleted} / ${activeTarget} units — PO-2026-0012`}
              color={completionRate >= 80 ? '#16a34a' : completionRate >= 50 ? '#d97706' : '#dc2626'}
            />
            <ReportCard
              label="Total Output Today"
              value={activeCompleted}
              sub="units produced (Day shift)"
              color="#2563eb"
            />
            <ReportCard
              label="Recycled Pellet Share"
              value={`${pelletUtilPct}%`}
              sub={`${recycledKg.toFixed(1)} kg recycled of ${totalPelletKg.toFixed(0)} kg total`}
              color="#7c3aed"
            />
            <ReportCard
              label="Rejected Rate"
              value={`${rejectedRatePct}%`}
              sub={`${totalRejectedPcs} pcs / ${totalRejectedKg} kg rejected`}
              color={totalRejectedKg >= 40 ? '#d97706' : 'var(--text-primary)'}
            />
          </div>

          {/* Summary table */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Key Metrics at a Glance</SectionHeader>
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-row-hover">
                  <td>Production</td>
                  <td>Active PO Completion</td>
                  <td className="font-mono">{completionRate}%</td>
                  <td>
                    <span className="badge-amber">Behind</span>
                  </td>
                </tr>
                <tr className="table-row-hover">
                  <td>Production</td>
                  <td>Output Today</td>
                  <td className="font-mono">{activeCompleted} units</td>
                  <td>
                    <span className="badge-blue">Active</span>
                  </td>
                </tr>
                <tr className="table-row-hover">
                  <td>Inventory</td>
                  <td>Virgin Pellet Stock</td>
                  <td className="font-mono">{virginKg.toFixed(0)} kg</td>
                  <td>
                    <span className={virginKg < 500 ? 'badge-amber' : 'badge-green'}>
                    {virginKg < 500 ? 'Low' : 'OK'}
                  </span>
                  </td>
                </tr>
                <tr className="table-row-hover">
                  <td>Inventory</td>
                  <td>Finished Goods Available</td>
                  <td className="font-mono">{fgAvailable} pcs</td>
                  <td>
                    <span className="badge-green">OK</span>
                  </td>
                </tr>
                <tr className="table-row-hover">
                  <td>Quality</td>
                  <td>Rejected Materials</td>
                  <td className="font-mono">{totalRejectedKg} kg / 50 kg</td>
                  <td>
                    <span className="badge-amber">Nearing Limit</span>
                  </td>
                </tr>
                <tr className="table-row-hover">
                  <td>Workforce</td>
                  <td>Employees Present Today</td>
                  <td className="font-mono">{dayPresent} (Day)</td>
                  <td>
                    <span className="badge-green">Active</span>
                  </td>
                </tr>
                <tr className="table-row-hover">
                  <td>Workforce</td>
                  <td>Pending Turnovers</td>
                  <td className="font-mono">{pendingTurnovers}</td>
                  <td>
                    <span className={pendingTurnovers > 0 ? 'badge-amber' : 'badge-green'}>
                    {pendingTurnovers > 0 ? 'Pending' : 'Clear'}
                  </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Daily output trend */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Daily Production Output — Last 7 Days</SectionHeader>
            <LineChart points={dailyTrend} color="#2563eb" height={100} unit=" pcs" />
          </div>
        </div>
      )}

      {/* ── EXECUTIVE OVERVIEW ─────────────────────────────────────────────── */}
      {activeTab === "Production" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* PO progress cards */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Production Order Progress</SectionHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* PO-2026-0012 */}
              <div style={{ padding: '10px 12px', border: '1px solid var(--card-border)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>PO-2026-0012</span>
                    <span className="badge-blue" style={{ marginLeft: 8 }}>In Production</span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-gold)', fontWeight: 700 }}>
                    {activeCompleted} / {activeTarget} units — 65%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  HDPE Pipe 110mm 6m SDR17 — Remaining: {activeRemaining} units
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: '65%', background: '#d97706' }} />
                </div>
              </div>

              {/* PO-2026-0011 */}
              <div style={{ padding: '10px 12px', border: '1px solid var(--card-border)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>PO-2026-0011</span>
                    <span className="badge-green" style={{ marginLeft: 8 }}>Completed</span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#16a34a', fontWeight: 700 }}>
                    400 / 400 units — 100%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  HDPE Pipe 75mm 6m SDR17 — All units completed
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: '100%', background: '#16a34a' }} />
                </div>
              </div>

              {/* PO-2026-0013 */}
              <div style={{ padding: '10px 12px', border: '1px solid var(--card-border)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>PO-2026-0013</span>
                    <span className="badge-gray" style={{ marginLeft: 8 }}>Scheduled</span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', fontWeight: 700 }}>
                    0 / 550 units — 0%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  HDPE Pipe 63mm 6m SDR11 — Not yet started
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: '2px', background: '#94a3b8' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Shift output bar chart */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Production Output by Shift (Last 4 Shifts)</SectionHeader>
            <BarChart data={shiftOutput} height={120} showValues unit=" pcs" />
          </div>

          {/* PO completion horizontal bar */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>PO Completion Overview</SectionHeader>
            <HorizontalBar data={poCompletionData} />
          </div>
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Actual Production Material Usage</SectionHeader>
            <div className="responsive-grid mb-4">
              <ReportCard label="Virgin Pellet Used" value={`${usedVirginKg.toFixed(2)} kg`} />
              <ReportCard label="Recycled Pellet Used" value={`${usedRecycledKg.toFixed(2)} kg`} />
              <ReportCard label="Base Colorant Used" value={`${usedBaseColorantKg.toFixed(2)} kg`} />
              <ReportCard label="Stripe Colorant Used" value={`${usedStripeColorantKg.toFixed(2)} kg`} />
              <ReportCard label="Total Pellet Weight" value={`${(usedVirginKg + usedRecycledKg).toFixed(2)} kg`} />
              <ReportCard label="Total Colorant Weight" value={`${usedColorantKg.toFixed(2)} kg`} />
              <ReportCard label="Total Material Consumption" value={`${(usedVirginKg + usedRecycledKg + usedColorantKg).toFixed(2)} kg`} />
            </div>
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Material Type</th>
                  <th>Material</th>
                  <th>Quantity</th>
                  <th>Shift</th>
                  <th>Employee</th>
                  <th>Date / Time</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(periodUsage, detailPage).map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="font-mono">
                      {transaction.productionOrderRef}
                    </td>
                    <td>{transaction.materialType.replace(/_/g, " ")}</td>
                    <td>{transaction.materialName}</td>
                    <td className="font-mono">
                      {transaction.quantity.toFixed(2)} kg
                    </td>
                    <td>{transaction.shift}</td>
                    <td>{transaction.employeeName}</td>
                    <td>
                      {new Date(transaction.dateTime).toLocaleString("en-PH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={detailPage} totalRecords={periodUsage.length} onPageChange={setDetailPage} />
          </div>
        </div>
      )}

      {/* ── EXECUTIVE OVERVIEW ─────────────────────────────────────────────── */}
      {activeTab === "Inventory" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="kpi-grid">
            <div className="app-card kpi-card">
              <div>Virgin Pellets — Current Balance</div>
              <strong>{virginKg.toFixed(1)} kg</strong>
              <small>
                {usedVirginKg.toFixed(1)} kg consumed during selected period
              </small>
            </div>
            <div className="app-card kpi-card">
              <div>Recycled Pellets — Current Balance</div>
              <strong>{recycledKg.toFixed(1)} kg</strong>
              <small>
                {usedRecycledKg.toFixed(1)} kg consumed during selected period
              </small>
            </div>
            <div className="app-card kpi-card">
              <div>Colorants — Current Balance</div>
              <strong>
                {colorants.reduce((sum, item) => sum + item.availableKg, 0).toFixed(1)}{" "}
                kg
              </strong>
              <small>
                {usedColorantKg.toFixed(1)} kg consumed during selected period
              </small>
            </div>
            <div className="app-card kpi-card">
              <div>Finished Pipes — Current Balance</div>
              <strong>{inventory.onHand} pcs On Hand</strong>
              <small>{fgAvailable} available · {fgReserved} reserved · {inventory.temporary} temporary · {inventory.ready} ready · {inventory.awaiting + inventory.qualityPending} awaiting/quality pending</small>
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="app-card" style={{ padding: 14 }}>
              <SectionHeader>Virgin vs Recycled Split</SectionHeader>
              <DonutChart segments={pelletDonut} size={110} />
            </div>
            <div className="app-card" style={{ padding: 14 }}>
              <SectionHeader>Finished Goods Status</SectionHeader>
              <DonutChart segments={fgDonut} size={110} />
            </div>
          </div>

          <div className="category-panel-header">
            <div>
              <SectionHeader>Pellet Traceability</SectionHeader>
              <p className="helper-text">Batch and RR details remain available as an optional traceability drill-down.</p>
            </div>
            <button className="btn-secondary" onClick={() => setViewByBatch(value => !value)}>
              {viewByBatch ? "Hide Batch Details" : "View by Batch"}
            </button>
          </div>

          {viewByBatch && (
            <div className="app-card" style={{ padding: 14 }}>
              <SectionHeader>Pellet Stock by Batch</SectionHeader>
              <HorizontalBar data={pelletStockData} />
              <table className="app-table" style={{ width: "100%" }}>
                <thead>
                <tr>
                  <th>Batch No</th>
                  <th>Type</th>
                  <th>Grade</th>
                  <th>Available (kg)</th>
                  <th>Color</th>
                  <th>Status</th>
                </tr>
              </thead>
                <tbody>
                  {pageRecords(pellets, detailPage).map((p) => (
                    <tr key={p.id} className="table-row-hover">
                      <td className="font-mono">{p.batchNo}</td>
                      <td>
                        <span className={p.type === 'Recycled' ? 'badge-blue' : 'badge-green'}>
                          {p.type}
                        </span>
                      </td>
                      <td>{p.grade}</td>
                      <td className="font-mono">
                        {p.availableKg.toFixed(1)} kg
                      </td>
                      <td>{p.color}</td>
                      <td>
                        <span className="badge-green">Available</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={detailPage} totalRecords={pellets.length} onPageChange={setDetailPage} />
            </div>
          )}

          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Colorant Inventory</SectionHeader>
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Colorant ID</th>
                  <th>Name</th>
                  <th>Usage Type</th>
                  <th>Color</th>
                  <th>Available</th>
                  <th>Used</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(colorants, detailPage).map((colorant) => (
                  <tr key={colorant.id}>
                    <td className="font-mono">{colorant.colorantId}</td>
                    <td>{colorant.name}</td>
                    <td>{colorant.usageType}</td>
                    <td>
                      {colorant.color} ({colorant.colorCode})
                    </td>
                    <td className="font-mono">
                      {colorant.availableKg.toFixed(2)} kg
                    </td>
                    <td className="font-mono">
                      {colorantUsed(colorant.id).toFixed(2)} kg
                    </td>
                    <td>{colorant.status}</td>
                    <td>{colorant.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={detailPage} totalRecords={colorants.length} onPageChange={setDetailPage} />
          </div>

          {/* Finished goods table */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Finished Goods Summary</SectionHeader>
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>FG ID</th>
                  <th>Product</th>
                  <th>Spec</th>
                  <th>Available</th>
                  <th>Reserved</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(finishedGoods, detailPage).map((fg) => (
                  <tr key={fg.id} className="table-row-hover">
                    <td className="font-mono">{fg.fgId}</td>
                    <td>{fg.product}</td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {fg.diameter} {fg.length} {fg.sdr}
                    </td>
                    <td className="font-mono">{finishedPipeInventory(fg).available}</td>
                    <td className="font-mono">{finishedPipeInventory(fg).reserved}</td>
                    <td style={{ fontSize: 11 }}>
                      {fg.currentLocation || "Not Yet Assigned"}
                    </td>
                    <td>
                      <span className={fg.status === 'Available' ? 'badge-green' : fg.status === 'Reserved' ? 'badge-amber' : 'badge-gray'}>
                        {fg.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={detailPage} totalRecords={finishedGoods.length} onPageChange={setDetailPage} />
          </div>
        </div>
      )}

      {/* ── EXECUTIVE OVERVIEW ─────────────────────────────────────────────── */}
      {activeTab === "Workforce" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Employee count cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <ReportCard label="Total Employees" value={employees.length} sub="Branch Plant" color="var(--text-primary)" />
            <ReportCard label="Active Today" value={attendance.filter(a => a.status === 'Active').length} sub="Clocked in" color="#16a34a" />
            <ReportCard label="Day Shift" value={dayPresent} sub="Currently active" color="#2563eb" />
            <ReportCard label="Night Shift" value={nightPresent} sub="Previous shift" color="#7c3aed" />
          </div>

          {/* Attendance table */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Attendance Records</SectionHeader>
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>ID</th>
                  <th>Shift</th>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(attendance, detailPage).map((a) => (
                  <tr key={a.id} className="table-row-hover">
                    <td>{a.employeeName}</td>
                    <td className="font-mono">{a.employeeId}</td>
                    <td>
                      <span className={a.shift === 'Day' ? 'badge-blue' : 'badge-gray'}>
                        {a.shift}
                      </span>
                    </td>
                    <td className="font-mono">{a.date}</td>
                    <td className="font-mono">{a.clockIn}</td>
                    <td className="font-mono">{a.clockOut || "—"}</td>
                    <td>
                      <span className={a.status === 'Active' ? 'badge-green' : 'badge-gray'}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={detailPage} totalRecords={attendance.length} onPageChange={setDetailPage} />
          </div>

          {/* Employee list */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Branch Plant Employees</SectionHeader>
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Employee ID</th>
                  <th>Role</th>
                  <th>Default Shift</th>
                  <th>Last Login</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(employees, detailPage).map((e) => (
                  <tr key={e.id} className="table-row-hover">
                    <td>
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="font-mono">{e.employeeId}</td>
                    <td style={{ textTransform: "capitalize" }}>{e.role}</td>
                    <td>{e.defaultShift}</td>
                    <td className="font-mono" style={{ fontSize: 11 }}>
                      {e.lastLogin || "—"}
                    </td>
                    <td>
                      <span className={e.status === 'Active' ? 'badge-green' : 'badge-gray'}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={detailPage} totalRecords={employees.length} onPageChange={setDetailPage} />
          </div>

          {/* Turnover summary */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Shift Turnover Summary</SectionHeader>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <ReportCard label="Total Turnovers" value={turnovers.length} sub="All records" />
              <ReportCard
                label="Pending Review"
                value={pendingTurnovers}
                sub="Awaiting acceptance"
                color={pendingTurnovers > 0 ? '#d97706' : '#16a34a'}
              />
              <ReportCard
                label="Accepted"
                value={turnovers.filter(t => t.status === 'Accepted').length}
                sub="Completed handoffs"
                color="#16a34a"
              />
            </div>
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Turnover No</th>
                  <th>Outgoing Employee</th>
                  <th>Shift Out</th>
                  <th>Shift In</th>
                  <th>PO Ref</th>
                  <th>Completed This Shift</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(turnovers, detailPage).map((t) => (
                  <tr key={t.id} className="table-row-hover">
                    <td className="font-mono">{t.turnoverNo}</td>
                    <td>{t.outgoingEmployee}</td>
                    <td>
                      <span className={t.outgoingShift === 'Day' ? 'badge-blue' : 'badge-gray'}>
                        {t.outgoingShift}
                      </span>
                    </td>
                    <td>
                      <span className={t.incomingShift === 'Day' ? 'badge-blue' : 'badge-gray'}>
                        {t.incomingShift}
                      </span>
                    </td>
                    <td className="font-mono">{t.poRef}</td>
                    <td className="font-mono">{t.completedThisShift}</td>
                    <td>
                      <span className={t.status === 'Pending' ? 'badge-amber' : 'badge-green'}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={detailPage} totalRecords={turnovers.length} onPageChange={setDetailPage} />
          </div>
        </div>
      )}

      {/* ── EXECUTIVE OVERVIEW ─────────────────────────────────────────────── */}
      {activeTab === "Quality" && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="app-card detail-card">
            <div className="form-grid">
              <label>
                Production Staff
                <SearchableDropdown
                  className="app-select" value={qualityStaff} onChange={event => setQualityStaff(event.target.value)}
                >
                  <option>All Staff</option>
                  {productionStaff.map((employee) => (
                    <option key={employee.id}>
                      {employee.firstName} {employee.lastName}
                    </option>
                  ))}
                </SearchableDropdown>
              </label>
              <label>
                Product Type
                <SearchableDropdown
                  className="app-select" value={qualityProduct} onChange={event => setQualityProduct(event.target.value)}
                >
                  <option>All Products</option>
                  {qualityProducts.map(product => <option key={product}>{product}</option>)}
                </SearchableDropdown>
              </label>
              <label>
                Quality Result
                <SearchableDropdown
                  className="app-select" value={qualityResult} onChange={event => setQualityResult(event.target.value)}
                >
                  <option>All Results</option>
                  <option>Good</option>
                  <option>Rejected</option>
                </SearchableDropdown>
              </label>
            </div>
          </div>
          {/* Critical alert */}
          <div className="alert-warning" style={{ fontSize: 12 }}>
            <strong>NEARING LIMIT:</strong> Rejected materials at{" "}
            <strong>{totalRejectedKg} kg</strong> of the 50 kg limit (
            {rejectedPct}% used). Only <strong>{rejectedRemaining} kg</strong>{" "}
            remaining before mandatory recycling halt.
          </div>

          {/* Rejection progress tracker */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Rejected Material Tracker</SectionHeader>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Rejected Weight</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: rejectedPct >= 80 ? '#dc2626' : '#d97706' }}>
                {totalRejectedKg} kg / 50 kg
              </span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <div style={{
                height: 18,
                borderRadius: 9,
                background: 'var(--input-bg)',
                border: '1px solid var(--card-border)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${rejectedPct}%`,
                  background: rejectedPct >= 80 ? '#dc2626' : '#d97706',
                  borderRadius: 9,
                  transition: 'width 0.4s',
                }} />
                {/* Recycling trigger marker at 40kg = 80% */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '80%',
                  width: 2,
                  height: '100%',
                  background: '#7c3aed',
                  opacity: 0.8,
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>0 kg</span>
              <span style={{ color: '#7c3aed' }}>40 kg — Recycling Trigger</span>
              <span>50 kg — LIMIT</span>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div style={{ textAlign: 'center', padding: '8px', background: 'var(--input-bg)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#dc2626' }}>
                  {totalRejectedKg} kg
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Total Rejected</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: 'var(--input-bg)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#d97706' }}>
                  {rejectedPct}%
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Of 50 kg Limit Used</div>
              </div>
              <div style={{ textAlign: 'center', padding: '8px', background: 'var(--input-bg)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#2563eb' }}>
                  {rejectedRemaining} kg
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Remaining Before Limit</div>
              </div>
            </div>
          </div>

          {/* Recycling notice */}
          <div className="alert-info" style={{ fontSize: 12 }}>
            <strong>Recycling Triggered:</strong> 40 kg threshold crossed — Batch <strong>RP-2026-0009</strong> initiated on 2026-09-30. Status: Collecting.
          </div>

          {/* Rejected materials table */}
          <div className="app-card" style={{ padding: 14 }}>
            <SectionHeader>Rejected Material Records</SectionHeader>
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Rejection ID</th>
                  <th>PO Ref</th>
                  <th>Product</th>
                  <th>Qty (pcs)</th>
                  <th>Weight (kg)</th>
                  <th>Reason</th>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(filteredQuality, detailPage).map((r) => (
                  <tr key={r.id} className="table-row-hover">
                    <td className="font-mono">{r.rejectionId}</td>
                    <td className="font-mono">{r.poRef}</td>
                    <td>{r.product}</td>
                    <td className="font-mono">{r.quantity}</td>
                    <td className="font-mono">{r.weightKg} kg</td>
                    <td>{r.reason}</td>
                    <td>{r.employee}</td>
                    <td>
                      <span className={r.shift === 'Day' ? 'badge-blue' : 'badge-gray'}>
                        {r.shift}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: 11 }}>
                      {r.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredQuality.length && (
              <div className="empty-state">
                <strong>NO RECORDS FOUND</strong>
                <div>No records match the selected period, search, or filters.</div>
                <button
                  className="btn-secondary btn-compact"
                  onClick={() => {
                    setQualityStaff("All Staff")
                    setQualityProduct("All Products")
                    setQualityResult("All Results")
                  }}
                >
                  Clear Filters
                </button>
              </div>
            )}
            <Pagination page={detailPage} totalRecords={filteredQuality.length} onPageChange={setDetailPage} />
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
              Filtered total:{" "}
              {filteredQuality.reduce((s, r) => s + r.quantity, 0)} pcs —{" "}
              {filteredQuality.reduce((s, r) => s + r.weightKg, 0).toFixed(2)}{" "}
              kg
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default withRecordSearch(Reports, [
  "pellets",
  "colorants",
  "materialUsageTransactions",
  "productionOrders",
  "finishedGoods",
  "attendance",
  "turnovers",
  "rejectedMaterials",
  "employees",
], true)
