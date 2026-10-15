import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import RecordRows from "../../components/RecordRows"

import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import React, { useEffect, useState } from "react"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import type { ShiftAttendance } from "../../types"

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

// Compute duration string between two HH:MM strings (handles overnight)

function computeDuration(clockIn: string, clockOut?: string): string {
  const parseMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const inMin = parseMinutes(clockIn);
  let outMin: number;
  if (clockOut) {
    outMin = parseMinutes(clockOut);
    if (outMin < inMin) outMin += 24 * 60; // overnight
  } else {
    // use a fixed "now" reference for demo consistency
    const now = new Date();
    outMin = now.getHours() * 60 + now.getMinutes();
    if (outMin < inMin) outMin += 24 * 60;
  }
  const diff = outMin - inMin;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h} hr ${m} min`;
}

const TABS = ["All", "Day Shift", "Night Shift"] as const

type Tab = typeof TABS[number]

function PMAttendance() {
  const { attendance, productionOrders } = useSearchableApp()


  const period = usePeriod("week")

  const [activeTab, setActiveTab] = useViewState<Tab>("plantmanager/Attendance:activeTab", "All")

  const [viewRec, setViewRec] = useState<ShiftAttendance | null>(null);

  const [, setClockTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(value => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // Filter by date then tab

  const filtered = attendance.filter(a => {
    if (!dateInPeriod(a.date, period.range)) return false;
    if (activeTab === 'Day Shift') return a.shift === 'Day';
    if (activeTab === 'Night Shift') return a.shift === 'Night';
    return true;
  });

  // Summary counts (over ALL records for selected date, ignoring tab)

  const dateRecords = attendance.filter(a => dateInPeriod(a.date, period.range));

  const activeCount = dateRecords.filter(a => a.status === 'Active').length;

  const clockedOutCount = dateRecords.filter(a => a.status === 'Completed').length;

  const dayCount = dateRecords.filter(a => a.shift === 'Day' && a.status === 'Active').length;

  const nightCount = dateRecords.filter(a => a.shift === 'Night' && a.status === 'Active').length;

  const activePOFor = (record: ShiftAttendance) => productionOrders.find(po =>
    po.status === 'In Production' && (!po.assignedShift || po.assignedShift === record.shift)
  )?.poNo || '—';

  return (
    <div className="page-stack">
      {/* View-only notice */}
      <div className="alert-info" style={{ fontSize: 12 }}>
        <strong>View Only.</strong> This page displays shift attendance records. Attendance entries are recorded by production employees at clock-in and clock-out.
      </div>

      {/* Filters row */}
      <div className="attendance-toolbar">
        <PeriodSelector period={period} compact />
        <div className="shift-filter-group" role="group" aria-label="Shift filter">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: activeTab === tab ? 600 : 400,
                borderRadius: 5,
                border: `1px solid ${activeTab === tab ? 'var(--accent-blue)' : 'var(--card-border)'}`,
                background: activeTab === tab ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="kpi-grid">
        {[
          { label: 'Clocked In Now', value: activeCount, color: '#16a34a' },
          { label: 'Clocked Out Today', value: clockedOutCount, color: 'var(--text-primary)' },
          { label: 'Day Shift Active', value: dayCount, color: 'var(--accent-blue)' },
          { label: 'Night Shift Active', value: nightCount, color: '#7c3aed' },
        ].map(({ label, value, color }) => (
          <div key={label} className="app-card statistic-card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
              {label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee ID</th>
              <th>Shift</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Active PO</th>
              <th data-actions>View</th>
            </tr>
          </thead>
          <TableBody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '24px 0' }}>
                  No attendance records for the selected date and shift.
                </td>
              </tr>
            ) : (
              <RecordRows
                records={filtered}
                render={(rec) => (
                  <tr
                  key={rec.id}
                  className="table-row-hover"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setViewRec(rec)}
                >
                    <td style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {rec.employeeName}
                    </td>
                    <td className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {rec.employeeId}
                    </td>
                    <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: rec.shift === 'Day' ? 'var(--accent-blue)' : '#7c3aed',
                      }}
                    >
                      {rec.shift}
                    </span>
                  </td>
                    <td className="font-mono" style={{ fontSize: 12 }}>
                      {rec.clockIn}
                    </td>
                    <td className="font-mono" style={{ fontSize: 12 }}>
                      {rec.clockOut || "—"}
                    </td>
                    <td className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {computeDuration(rec.clockIn, rec.clockOut)}
                    {!rec.clockOut && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>(ongoing)</span>
                    )}
                  </td>
                    <td>
                      <StatusBadge status={rec.status === 'Active' ? 'Clocked In' : 'Clocked Out'} size="sm" />
                    </td>
                    <td className="font-mono po-column">
                      {rec.status === "Active" ? activePOFor(rec) : "—"}
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      <button className="btn-secondary btn-compact" onClick={() => setViewRec(rec)}>View</button>
                    </td>
                  </tr>
                )}
              />
            )}
          </TableBody>
        </table>
      </div>

      {/* Detail Modal (view-only) */}
      {viewRec && (
        <Modal open title="Attendance Record" onClose={() => setViewRec(null)} width="480px">
          <div style={{ background: 'rgba(37,99,235,0.05)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Employee Name', viewRec.employeeName],
                ['Employee ID', viewRec.employeeId],
                ['Shift', viewRec.shift],
                ['Date', viewRec.date],
                ['Clock In', viewRec.clockIn],
                ['Clock Out', viewRec.clockOut || '—'],
                ['Duration', computeDuration(viewRec.clockIn, viewRec.clockOut) + (!viewRec.clockOut ? ' (ongoing)' : '')],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: label === 'Employee ID' || label === 'Clock In' || label === 'Clock Out' || label === 'Duration' ? 'JetBrains Mono, monospace' : undefined }}>
                    {val}
                  </div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                <StatusBadge status={viewRec.status === 'Active' ? 'Clocked In' : 'Clocked Out'} />
              </div>
            </div>
          </div>
          <div className="alert-info" style={{ fontSize: 12, marginBottom: 16 }}>
            This record is read-only. Attendance entries can only be modified by system administrators.
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setViewRec(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default withRecordSearch(PMAttendance, ["attendance"], false, false)
