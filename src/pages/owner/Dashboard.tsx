import React, { useMemo, useState } from 'react';
import CategoryTabs from '../../components/CategoryTabs';
import Pagination, { pageRecords } from '../../components/Pagination';
import { useApp } from '../../store';

const ALERT_TABS = ['All', 'Urgent', 'Action Required'] as const;
type AlertTab = typeof ALERT_TABS[number];

function Metric({ label, value, tone = 'default', onClick }: { label: string; value: string | number; tone?: string; onClick?: () => void }) {
  return (
    <button className={`app-card owner-metric owner-metric-${tone}`} onClick={onClick} disabled={!onClick}>
      <span>{label}</span><strong>{value}</strong>
    </button>
  );
}

export default function OwnerDashboard() {
  const app = useApp();
  const [alertTab, setAlertTab] = useState<AlertTab>('All');
  const [alertPage, setAlertPage] = useState(1);
  const availablePellets = app.pellets.filter(item => item.inventoryStatus === 'Available');
  const virginKg = availablePellets.filter(item => item.type === 'Virgin').reduce((sum, item) => sum + item.availableKg, 0);
  const recycledKg = availablePellets.filter(item => item.type === 'Recycled').reduce((sum, item) => sum + item.availableKg, 0);
  const colorantKg = app.colorants.reduce((sum, item) => sum + item.availableKg, 0);
  const availablePipes = app.finishedGoods.filter(item => item.status === 'Available' && item.releaseStatus !== 'Released').length;
  const reserved = app.finishedGoods.filter(item => item.status === 'Reserved').length;
  const ready = app.finishedGoods.filter(item => item.status === 'Ready for Release').length;
  const activeAlerts = app.notifications.filter(item => item.priority !== 'Information' && !item.read);
  const alertCounts = {
    All: activeAlerts.length,
    Urgent: activeAlerts.filter(item => item.priority === 'Urgent').length,
    'Action Required': activeAlerts.filter(item => item.priority === 'Action Required').length,
  };
  const filteredAlerts = useMemo(() => activeAlerts
    .filter(item => alertTab === 'All' || item.priority === alertTab)
    .sort((a, b) => {
      const priority = (value: string) => value === 'Urgent' ? 0 : 1;
      return priority(a.priority) - priority(b.priority) || b.datetime.localeCompare(a.datetime);
    }), [activeAlerts, alertTab]);
  const today = new Date().toISOString().slice(0, 10);
  const goRecords = () => app.navigate('owner-records');

  return <div className="page-stack">
    <div className="owner-hero">
      <div><span className="eyebrow">Current company snapshot</span><h2>Owner / Super Admin Dashboard</h2><p>What is happening right now across Main Plant, Branch Plant, and every department.</p></div>
      <div className="owner-hero-badge"><span>System scope</span><strong>Live · All plants &amp; departments</strong></div>
    </div>
    <section>
      <div className="section-heading"><div><span>Current operating position</span><strong>Live shared records</strong></div><p>Current balances and open work only. Historical trends are kept in Reports &amp; Analytics.</p></div>
      <div className="owner-metric-grid">
        <Metric label="Virgin Pellet Stock" value={`${virginKg.toFixed(1)} kg`} tone="blue" onClick={goRecords} />
        <Metric label="Recycled Pellet Stock" value={`${recycledKg.toFixed(1)} kg`} tone="green" onClick={goRecords} />
        <Metric label="Colorant Stock" value={`${colorantKg.toFixed(2)} kg`} onClick={goRecords} />
        <Metric label="Production WIP" value={`${app.productionOrders.filter(item => item.status === 'In Production').length} orders`} tone="blue" />
        <Metric label="Available Finished Pipes" value={availablePipes} tone="green" onClick={goRecords} />
        <Metric label="Reserved Finished Pipes" value={reserved} tone="amber" onClick={goRecords} />
        <Metric label="Ready for Ship Out" value={ready} tone="amber" onClick={goRecords} />
        <Metric label="Active Production Orders" value={app.productionOrders.filter(item => !['Completed', 'Cancelled'].includes(item.status)).length} tone="blue" />
        <Metric label="Production In Progress" value={app.productionOrders.filter(item => item.status === 'In Production').length} tone="blue" />
        <Metric label="Pending Shift Turnovers" value={app.turnovers.filter(item => item.status === 'Pending').length} tone="amber" />
        <Metric label="Active Recycling Batches" value={app.recyclingBatches.filter(item => item.status !== 'Completed').length} tone="green" />
        <Metric label="Today's Attendance" value={app.attendance.filter(item => item.date === today).length} />
        <Metric label="Open Material Requests" value={app.materialRequests.filter(item => !['Approved', 'Rejected'].includes(item.status)).length} tone="amber" />
        <Metric label="Open Transfers" value={app.transfers.filter(item => item.status !== 'Received').length} tone="blue" />
        <Metric label="Important Alerts" value={activeAlerts.length} tone={activeAlerts.length ? 'red' : 'green'} />
        <Metric label="Urgent Issues" value={alertCounts.Urgent} tone={alertCounts.Urgent ? 'red' : 'green'} />
      </div>
    </section>
    <section className="app-card detail-card">
      <div className="alerts-header">
        <div><div className="table-title alerts-title">Important Alerts</div><p>Active operational issues requiring attention.</p></div>
        <CategoryTabs items={ALERT_TABS} value={alertTab} counts={alertCounts} onChange={value => { setAlertTab(value); setAlertPage(1); }} label="Alert priority" />
      </div>
      <div className="owner-alert-list">
        {pageRecords(filteredAlerts, alertPage).map(item => (
          <div className={`owner-alert-row owner-alert-${item.priority === 'Urgent' ? 'urgent' : 'action'}`} key={item.id}>
            <div className="owner-alert-badge-col"><span className={item.priority === 'Urgent' ? 'badge-red' : 'badge-amber'}>{item.priority}</span></div>
            <div className="owner-alert-content-col"><strong>{item.title}</strong>{item.description && <p className="owner-alert-desc">{item.description}</p>}</div>
            <time className="owner-alert-time">{item.datetime}</time>
          </div>
        ))}
        {!filteredAlerts.length && <div className="empty-state">No active {alertTab === 'All' ? 'important' : alertTab.toLowerCase()} alerts.</div>}
      </div>
      <Pagination page={alertPage} totalRecords={filteredAlerts.length} onPageChange={setAlertPage} noun="alerts" />
    </section>
  </div>;
}
