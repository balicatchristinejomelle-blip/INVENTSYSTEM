import {
  withRecordSearch,
  useSearchableApp,
  useSearchPaginationReset,
} from "../../components/RecordSearch"

import { finishedGoodsSummary } from '../../finishedGoodsInventory';
import React, { useMemo, useState } from "react"

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

const ALERT_TABS = ['All', 'Urgent', 'Action Required'] as const;

type AlertTab = typeof ALERT_TABS[number]

function Metric({ label, value, tone = 'default', onClick }: { label: string; value: string | number; tone?: string; onClick?: () => void }) {
  return (
    <button className={`app-card owner-metric owner-metric-${tone}`} onClick={onClick} disabled={!onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  )
}

function OwnerDashboard() {
  const app = useSearchableApp()

  const [alertTab, setAlertTab] = useState<AlertTab>("All")

  const [alertPage, setAlertPage] = useState(1)

  useSearchPaginationReset(setAlertPage)

  const availablePellets = app.pellets.filter(item => item.inventoryStatus === 'Available');

  const pe80Kg = availablePellets.filter(item => item.grade === 'PE80').reduce((sum, item) => sum + item.availableKg, 0);

  const pe100Kg = availablePellets.filter(item => item.grade === 'PE100').reduce((sum, item) => sum + item.availableKg, 0);

  const recycledKg = availablePellets.filter(item => item.type === 'Recycled').reduce((sum, item) => sum + item.availableKg, 0);

  const colorantKg = app.colorants.reduce((sum, item) => sum + item.availableKg, 0);

  const inventory = finishedGoodsSummary(app.finishedGoods, app);
  const availablePipes = inventory.available;

  const reserved = inventory.reserved;

  const ready = inventory.ready;

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

  const today = new Date().toISOString().slice(0, 10)

  const goRecords = () => app.navigate("owner-records")

  return (
    <div className="page-stack">
      <div className="owner-hero">
        <div>
          <span className="eyebrow">Current company snapshot</span>
          <h2>Owner / Super Admin Dashboard</h2>
          <p>What is happening right now across Main Plant, Branch Plant, and every department.</p>
        </div>
        <div className="owner-hero-badge">
          <span>System scope</span>
          <strong>Live · All plants &amp; departments</strong>
        </div>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <span>Current operating position</span>
            <strong>Live shared records</strong>
          </div>
          <p>Current balances and open work only. Historical trends are kept in Reports &amp; Analytics.</p>
        </div>
        <div className="owner-metric-grid">
        <Metric label="PE80 Stock" value={`${pe80Kg.toFixed(1)} kg`} tone="blue" onClick={goRecords} />
        <Metric label="PE100 Stock" value={`${pe100Kg.toFixed(1)} kg`} tone="blue" onClick={goRecords} />
        <Metric label="Active Production Orders" value={app.productionOrders.filter(item => !['Completed', 'Cancelled'].includes(item.status)).length} tone="blue" />
        <Metric label="Rejected Today" value={`${app.rejectedMaterials.filter(item => item.date === today).reduce((sum, item) => sum + item.quantity, 0)} pipes`} tone={app.rejectedMaterials.some(item => item.date === today) ? 'red' : 'green'} />
      </div>
      <div className="owner-metric-grid inventory-metrics" aria-label="Finished Goods inventory summary">
        <Metric label="Available" value={availablePipes} tone="green" onClick={goRecords} />
        <Metric label="Reserved" value={reserved} tone="amber" onClick={goRecords} />
        <Metric label="Temporary Storage" value={inventory.temporary} tone="amber" onClick={goRecords} />
        <Metric label="Ready for Ship Out" value={ready} tone="green" />
        <Metric label="On Hand" value={inventory.onHand} tone="blue" onClick={goRecords} />
      </div>
      </section>
      <section className="app-card detail-card">
        <div className="section-heading">
          <div>
            <span>Current operations</span>
            <strong>Live supporting status</strong>
          </div>
          <button className="btn-secondary btn-compact" onClick={goRecords}>View All Records</button>
        </div>
        <div className="responsive-grid">
          <div>
            <div className="field-label">Recycled Pellet Stock</div>
            <div className="field-value">{recycledKg.toFixed(1)} kg</div>
          </div>
          <div>
            <div className="field-label">Colorant Stock</div>
            <div className="field-value">{colorantKg.toFixed(2)} kg</div>
          </div>
          <div>
            <div className="field-label">Pending Turnovers</div>
            <div className="field-value">
              {app.turnovers.filter(item => item.status === 'Pending').length}
            </div>
          </div>
          <div>
            <div className="field-label">Today's Attendance</div>
            <div className="field-value">
              {app.attendance.filter((item) => item.date === today).length}
            </div>
          </div>
          <div>
            <div className="field-label">Open Requests / Transfers</div>
            <div className="field-value">
              {app.materialRequests.filter(item => !['Approved', 'Rejected'].includes(item.status)).length}{" "}
              /{" "}
              {app.transfers.filter(item => item.status !== 'Received').length}
            </div>
          </div>
        </div>
      </section>
      <section className="app-card detail-card">
        <div className="alerts-header">
          <div>
            <div className="table-title alerts-title">Important Alerts</div>
            <p>Active operational issues requiring attention.</p>
          </div>
          <CategoryTabs items={ALERT_TABS} value={alertTab} counts={alertCounts} onChange={value => { setAlertTab(value); setAlertPage(1); }} label="Alert priority" />
        </div>
        <div className="owner-alert-list">
          {pageRecords(filteredAlerts, alertPage).map((item) => (
            <div className={`owner-alert-row owner-alert-${item.priority === 'Urgent' ? 'urgent' : 'action'}`} key={item.id}>
              <div className="owner-alert-badge-col">
                <span className={item.priority === 'Urgent' ? 'badge-red' : 'badge-amber'}>
                  {item.priority}
                </span>
              </div>
              <div className="owner-alert-content-col">
                <strong>{item.title}</strong>
                {item.description && <p className="owner-alert-desc">{item.description}</p>}
              </div>
              <time className="owner-alert-time">{item.datetime}</time>
            </div>
          ))}
          {!filteredAlerts.length && (
            <div className="empty-state">
              No active{" "}
              {alertTab === "All" ? "important" : alertTab.toLowerCase()}{" "}
              alerts.
            </div>
          )}
        </div>
        <Pagination page={alertPage} totalRecords={filteredAlerts.length} onPageChange={setAlertPage} noun="alerts" />
      </section>
    </div>
  )
}

export default withRecordSearch(OwnerDashboard, [
  "productionOrders",
  "pellets",
  "colorants",
  "finishedGoods",
  "materialRequests",
  "transfers",
  "attendance",
  "turnovers",
], false, false)
