import { TableBody } from '../../components/UXFeedback';
import { useViewState } from '../../uiViewState';
import RecordRows from "../../components/RecordRows"

import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import React, { useState } from "react"

import { BarChart, DonutChart, LineChart, HorizontalBar, ReportCard } from '../../components/MiniChart';

import StatusBadge from "../../components/StatusBadge"

import PeriodSelector, { dateInPeriod, usePeriod, type PeriodRange } from '../../components/PeriodSelector';

type Tab = 'overview' | 'inventory' | 'transfers' | 'requests';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'requests', label: 'Requests' },
];

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 10,
};

const CARD_GRID4: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
};

const TWO_COL: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 style={SECTION_LABEL}>{children}</h3>;
}

function OverviewTab({ period }: { period: PeriodRange }) {
  const { pellets, transfers, materialRequests, rrRecords } = useSearchableApp()

  const totalKg = pellets.filter(p => p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const activeTransfers = transfers.filter(t => dateInPeriod(t.date, period) && (t.status === 'Preparing' || t.status === 'In Transit')).length;

  const pendingRequests = materialRequests.filter(r => dateInPeriod(r.date, period) && (r.status === 'New' || r.status === 'Pending')).length;

  const verifiedRRs = rrRecords.filter(r => dateInPeriod(r.date, period) && (r.status === 'Completed' || r.status === 'Ready for Transfer')).length;

  const virginKg = pellets.filter(p => p.type === 'Virgin' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const recycledKg = pellets.filter(p => p.type === 'Recycled' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const intakeData = rrRecords.filter(item => dateInPeriod(item.date, period)).map(item => ({
    label: item.date.slice(5),
    value: item.weightKg,
    color: 'var(--accent-blue)',
  }));

  return (
    <div className="page-stack">
      <div style={CARD_GRID4}>
        <ReportCard label="Current Pellet Stock" value={`${totalKg.toFixed(1)} kg`} sub={`Balance as of ${period.end}`} color="var(--accent-blue)" />
        <ReportCard label="Active Transfers" value={activeTransfers} sub="Preparing + In Transit" color="var(--accent-gold)" />
        <ReportCard label="Pending Requests" value={pendingRequests} sub="New + Pending" color="#ef4444" />
        <ReportCard label="Verified RRs" value={verifiedRRs} sub="Completed or Ready" color="#16a34a" />
      </div>

      <div style={TWO_COL}>
        <div className="app-card" style={{ padding: 16 }}>
          <SectionLabel>Monthly Material Intake (kg)</SectionLabel>
          <BarChart
            data={intakeData}
            height={110}
            showValues={true}
            unit=" kg"
          />
        </div>
        <div className="app-card" style={{ padding: 16 }}>
          <SectionLabel>Pellet Stock by Type</SectionLabel>
          <DonutChart
            segments={[
              { label: 'Virgin', value: virginKg, color: 'var(--accent-blue)' },
              { label: 'Recycled', value: recycledKg, color: '#7c3aed' },
            ]}
            size={110}
          />
        </div>
      </div>
    </div>
  );
}

function InventoryTab() {
  const { pellets } = useSearchableApp()

  const virginKg = pellets.filter(p => p.type === 'Virgin' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const recycledKg = pellets.filter(p => p.type === 'Recycled' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  return (
    <div className="page-stack">
      <div className="app-card" style={{ padding: 16 }}>
        <SectionLabel>Pellet Batch Stock Levels</SectionLabel>
        <HorizontalBar
          data={pellets.map(p => ({
            label: p.batchNo,
            value: p.availableKg,
            max: 1200,
            color: p.type === 'Virgin' ? 'var(--accent-blue)' : '#7c3aed',
            unit: ' kg',
          }))}
        />
      </div>

      <div className="app-card" style={{ padding: 16 }}>
        <SectionLabel>Pellet Batch Details</SectionLabel>
        <table className="app-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Batch No.</th>
              <th>Type</th>
              <th>Grade</th>
              <th>Color</th>
              <th>Available (kg)</th>
              <th>Current Location</th>
              <th>Received Date</th>
            </tr>
          </thead>
          <TableBody>
            {
              <RecordRows
                records={pellets}
                render={(p) => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="font-mono">{p.batchNo}</td>
                    <td>
                  <span className={p.type === 'Virgin' ? 'badge-blue' : 'badge-gray'}>
                    {p.type}
                  </span>
                </td>
                    <td>{p.grade}</td>
                    <td>{p.color}</td>
                    <td className="font-mono" style={{ textAlign: "right" }}>
                      {p.availableKg.toFixed(1)}
                    </td>
                    <td>{p.currentLocation || "Not Yet Assigned"}</td>
                    <td>{p.receivedDate}</td>
                  </tr>
                )}
              />
            }
          </TableBody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ReportCard label="Total Virgin kg" value={`${virginKg.toFixed(1)} kg`} color="var(--accent-blue)" sub="3 active batches" />
        <ReportCard label="Total Recycled kg" value={`${recycledKg.toFixed(1)} kg`} color="#7c3aed" sub="1 active batch" />
      </div>
    </div>
  )
}

function TransfersTab({ period }: { period: PeriodRange }) {
  const { transfers } = useSearchableApp()

  const periodTransfers = transfers.filter(item => dateInPeriod(item.date, period));

  const statusCounts: Record<string, number> = {}

  periodTransfers.forEach(t => {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  });

  const statusColors: Record<string, string> = {
    Preparing: '#d97706',
    'In Transit': '#2563eb',
    Received: '#16a34a',
  };

  const transferTrend = periodTransfers.map(item => ({ label: item.date.slice(5), value: item.weightKg }));

  return (
    <div className="page-stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <ReportCard
            key={status}
            label={status}
            value={count}
            sub={`transfer${count !== 1 ? 's' : ''}`}
            color={statusColors[status] || 'var(--text-primary)'}
          />
        ))}
      </div>

      <div className="app-card" style={{ padding: 16 }}>
        <SectionLabel>Transfer Records</SectionLabel>
        <table className="app-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Transfer No.</th>
              <th>Date</th>
              <th>Batch</th>
              <th>Weight (kg)</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
            </tr>
          </thead>
          <TableBody>
            {
              <RecordRows
                records={periodTransfers}
                render={(t) => (
                  <tr key={t.id} className="table-row-hover">
                    <td className="font-mono">{t.refNo}</td>
                    <td>{t.date}</td>
                    <td className="font-mono">{t.batchNo}</td>
                    <td className="font-mono" style={{ textAlign: "right" }}>
                      {t.weightKg}
                    </td>
                    <td>{t.source}</td>
                    <td>{t.destination}</td>
                    <td>
                  <StatusBadge status={t.status} />
                </td>
                  </tr>
                )}
              />
            }
          </TableBody>
        </table>
      </div>

      <div className="app-card" style={{ padding: 16 }}>
        <SectionLabel>Monthly Transfer Volume (kg)</SectionLabel>
          <LineChart
          points={transferTrend.length ? transferTrend : [{ label: 'No activity', value: 0 }]}
          color="var(--accent-blue)"
          height={80}
          unit=" kg"
        />
      </div>
    </div>
  )
}

function RequestsTab({ period }: { period: PeriodRange }) {
  const { materialRequests } = useSearchableApp()

  const periodRequests = materialRequests.filter(item => dateInPeriod(item.date, period));

  const counts = {
    New: periodRequests.filter(r => r.status === 'New').length,
    Pending: periodRequests.filter(r => r.status === 'Pending').length,
    Approved: periodRequests.filter(r => r.status === 'Approved').length,
    Rejected: periodRequests.filter(r => r.status === 'Rejected').length,
  };

  return (
    <div className="page-stack">
      <div style={CARD_GRID4}>
        <ReportCard label="New" value={counts.New} color="#2563eb" />
        <ReportCard label="Pending" value={counts.Pending} color="#d97706" />
        <ReportCard label="Approved" value={counts.Approved} color="#16a34a" />
        <ReportCard label="Rejected" value={counts.Rejected} color="#dc2626" />
      </div>

      <div className="app-card" style={{ padding: 16 }}>
        <SectionLabel>Material Request Log</SectionLabel>
        <table className="app-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Ref No.</th>
              <th>Date</th>
              <th>Material</th>
              <th>Weight (kg)</th>
              <th>Status</th>
              <th>Approved By</th>
            </tr>
          </thead>
          <TableBody>
            {
              <RecordRows
                records={periodRequests}
                render={(r) => (
                  <tr key={r.id} className="table-row-hover">
                    <td className="font-mono">{r.refNo}</td>
                    <td>{r.date}</td>
                    <td>
                      {r.pelletType} {r.grade} — {r.color}
                    </td>
                    <td className="font-mono" style={{ textAlign: "right" }}>
                      {r.requestedKg}
                    </td>
                    <td>
                  <StatusBadge status={r.status} />
                </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {r.approvedBy || "—"}
                    </td>
                  </tr>
                )}
              />
            }
          </TableBody>
        </table>
      </div>

      <div className="app-card" style={{ padding: 16 }}>
        <ReportCard
          label="Avg. Approval Turnaround"
          value="1.5 days"
          sub="Based on approved requests this month"
          color="var(--accent-gold)"
        />
      </div>
    </div>
  )
}

function AccountingReports() {
  const [activeTab, setActiveTab] = useViewState<Tab>("accounting/Reports:activeTab", 'overview');
  const period = usePeriod('month');

  return (
    <div className="page-stack">
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
          Reports &amp; Analytics
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Main Plant — Accounting</p>
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
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab period={period.range} />}
      {activeTab === 'inventory' && <InventoryTab />}
      {activeTab === 'transfers' && <TransfersTab period={period.range} />}
      {activeTab === 'requests' && <RequestsTab period={period.range} />}
    </div>
  );
}

export default withRecordSearch(AccountingReports, [
  "rrRecords",
  "pellets",
  "colorants",
  "transfers",
  "materialRequests",
], false, false)
