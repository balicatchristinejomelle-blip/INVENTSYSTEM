import React, { useState } from 'react';
import { useApp } from '../../store';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import type { ShiftTurnover } from '../../types';
import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

const TABS = ['All', 'Pending', 'Accepted'] as const;
type Tab = typeof TABS[number];

function MachineConditionDot({ condition }: { condition: string }) {
  const isNormal = condition === 'Normal';
  const color = isNormal ? '#16a34a' : '#d97706';
  return (
    <span className="flex items-center gap-1.5" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          boxShadow: `0 0 0 2px ${color}33`,
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: 12, color: color, fontWeight: 600 }}>{condition}</span>
    </span>
  );
}

function DetailField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: mono ? 'JetBrains Mono, monospace' : undefined }}>
        {value}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5,
      fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: '1px solid var(--card-border)',
      paddingBottom: 6,
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

export default function PMShiftTurnover() {
  const { turnovers } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [viewRec, setViewRec] = useState<ShiftTurnover | null>(null);
  const period = usePeriod('week');

  const filtered = turnovers.filter(t => {
    if (!dateInPeriod(t.date, period.range)) return false;
    if (activeTab === 'Pending') return t.status === 'Pending';
    if (activeTab === 'Accepted') return t.status === 'Accepted';
    return true;
  });

  const pendingCount = turnovers.filter(t => t.status === 'Pending' && dateInPeriod(t.date, period.range)).length;

  return (
    <div>
      <PeriodSelector period={period} compact />
      {pendingCount > 0 && (
        <div className="alert-warning mb-4" style={{ fontSize: 12 }}>
          <strong>{pendingCount} shift turnover{pendingCount > 1 ? 's' : ''} pending acceptance.</strong> Review the details and confirm that the incoming shift has acknowledged the handover.
        </div>
      )}

      {/* Tab filters */}
      <div className="flex gap-1 mb-4">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '5px 16px',
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
            {tab === 'Pending' && pendingCount > 0 && (
              <span style={{
                marginLeft: 6,
                background: activeTab === tab ? 'rgba(255,255,255,0.25)' : 'var(--accent-blue)',
                color: '#fff',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 5px',
              }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="app-card" style={{ overflow: 'hidden' }}>
        <table className="app-table">
          <thead>
            <tr>
              <th>Turnover No.</th>
              <th>Date / Time</th>
              <th>Outgoing Employee</th>
              <th>Shift</th>
              <th>PO Reference</th>
              <th>Completed / Total</th>
              <th>Machine Condition</th>
              <th>Status</th>
              <th data-actions>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '24px 0' }}>
                  No shift turnover records found.
                </td>
              </tr>
            ) : (
              filtered.map(rec => (
                <tr
                  key={rec.id}
                  className="table-row-hover"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setViewRec(rec)}
                >
                  <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 700 }}>
                    {rec.turnoverNo}
                  </td>
                  <td>
                    <div className="font-mono" style={{ fontSize: 11 }}>{rec.date}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{rec.time}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{rec.outgoingEmployee}</div>
                    <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{rec.outgoingEmployeeId}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <span style={{ color: '#7c3aed', fontWeight: 600 }}>{rec.outgoingShift}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{rec.incomingShift}</span>
                  </td>
                  <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)' }}>{rec.poRef}</td>
                  <td>
                    <div className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                      {rec.completedThisShift} / {rec.totalCompleted}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>of {rec.targetQty} target</div>
                  </td>
                  <td><MachineConditionDot condition={rec.machineCondition} /></td>
                  <td><StatusBadge status={rec.status} size="sm" /></td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-secondary btn-compact"
                      onClick={() => setViewRec(rec)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {viewRec && (
        <Modal
          open
          title={`Shift Turnover — ${viewRec.turnoverNo}`}
          onClose={() => setViewRec(null)}
          width="660px"
        >
          {/* Header strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(37,99,235,0.06)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 20,
              flexWrap: 'wrap',
            }}
          >
            <div className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)', flex: 1 }}>
              {viewRec.turnoverNo}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <span className="font-mono">{viewRec.date}</span>
              <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>at</span>
              <span className="font-mono">{viewRec.time}</span>
            </div>
            <StatusBadge status={viewRec.status} />
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Production Progress</span>
              <span className="font-mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                {viewRec.totalCompleted} / {viewRec.targetQty} ({viewRec.targetQty > 0 ? Math.round(viewRec.totalCompleted / viewRec.targetQty * 100) : 0}%)
              </span>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div
                className="progress-fill"
                style={{
                  width: `${viewRec.targetQty > 0 ? Math.min(100, Math.round(viewRec.totalCompleted / viewRec.targetQty * 100)) : 0}%`,
                  background: viewRec.totalCompleted >= viewRec.targetQty ? '#16a34a' : 'var(--accent-blue)',
                }}
              />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
              {viewRec.remaining} units remaining
            </div>
          </div>

          {/* Auto-filled section */}
          <div style={{ marginBottom: 20 }}>
            <SectionHeader>Shift Handover Details</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <DetailField label="Outgoing Employee" value={viewRec.outgoingEmployee} />
              <DetailField label="Employee ID" value={viewRec.outgoingEmployeeId} mono />
              <DetailField
                label="Shift"
                value={
                  <span>
                    <span style={{ color: '#7c3aed', fontWeight: 600 }}>{viewRec.outgoingShift}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{viewRec.incomingShift}</span>
                  </span>
                }
              />
              <DetailField label="PO Reference" value={<span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{viewRec.poRef}</span>} />
              <DetailField label="Production Line" value={viewRec.productionLine} />
              <DetailField label="Production Stage" value={viewRec.productionStage} />
              <DetailField label="Target Qty" value={viewRec.targetQty} mono />
              <DetailField label="Completed This Shift" value={viewRec.completedThisShift} mono />
              <DetailField label="Good Output" value={viewRec.goodQty ?? Math.max(0, viewRec.completedThisShift - viewRec.rejectedQty)} mono />
              <DetailField label="Total Completed" value={viewRec.totalCompleted} mono />
              <DetailField label="Remaining" value={viewRec.remaining} mono />
            </div>
          </div>

          {/* Pellet section */}
          <div style={{ marginBottom: 20 }}>
            <SectionHeader>Pellet Usage</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <DetailField label="Pellet Type" value={viewRec.pelletType} />
              <DetailField label="Batch No." value={viewRec.pelletBatch} mono />
              <DetailField label="Loaded (kg)" value={`${viewRec.pelletLoaded} kg`} mono />
              <DetailField label="Used (kg)" value={`${viewRec.pelletUsed} kg`} mono />
              <DetailField label="Virgin Bags / Weight" value={`${viewRec.virginBagsUsed ?? 0} / ${viewRec.virginWeightUsed ?? 0} kg`} mono />
              <DetailField label="Recycled Bags / Weight" value={`${viewRec.recycledBagsUsed ?? 0} / ${viewRec.recycledWeightUsed ?? 0} kg`} mono />
              <DetailField label="Base Colorant" value={`${viewRec.baseColorantUsed ?? 0} kg · ${viewRec.baseColorantTypes?.join(', ') || 'None recorded'}`} />
              <DetailField label="Stripe Colorant" value={viewRec.stripeColorantTypes?.length ? `${viewRec.stripeColorantUsed ?? 0} kg · ${viewRec.stripeColorantTypes.join(', ')}` : 'Not Required / None recorded'} />
              <DetailField label="Total Colorant Weight" value={`${viewRec.totalColorantWeight ?? viewRec.colorantUsed ?? 0} kg`} mono />
              <DetailField label="Total Pellet Weight" value={`${viewRec.totalPelletWeight ?? viewRec.pelletUsed} kg`} mono />
              <DetailField label="Total Material Weight" value={`${viewRec.totalMaterialWeight ?? viewRec.pelletUsed} kg`} mono />
            </div>
          </div>

          {/* Quality section */}
          <div style={{ marginBottom: 20 }}>
            <SectionHeader>Quality / Rejections</SectionHeader>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <DetailField label="Rejected Qty" value={viewRec.rejectedQty} mono />
              <DetailField label="Rejected Weight (kg)" value={`${viewRec.rejectedKg} kg`} mono />
              <DetailField label="Reject Reasons" value={viewRec.rejectReasons?.join(', ') || 'None'} />
            </div>
          </div>

          {/* Issues & notes section */}
          <div style={{ marginBottom: 20 }}>
            <SectionHeader>Machine Condition & Issues</SectionHeader>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Machine Condition</div>
              <MachineConditionDot condition={viewRec.machineCondition} />
            </div>
            {viewRec.issueDescription && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Issue Description</div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-primary)',
                    background: 'rgba(220,38,38,0.06)',
                    border: '1px solid rgba(220,38,38,0.15)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    lineHeight: 1.6,
                  }}
                >
                  {viewRec.issueDescription}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Issues Encountered</div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  background: 'var(--input-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  lineHeight: 1.6,
                }}
              >
                {viewRec.issuesEncountered || 'None reported.'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Notes for Incoming Shift</div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  background: 'rgba(37,99,235,0.05)',
                  border: '1px solid rgba(37,99,235,0.15)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  lineHeight: 1.6,
                }}
              >
                {viewRec.notesForIncoming || 'No additional notes.'}
              </div>
            </div>
            {viewRec.importantInstructions && <div style={{ marginTop: 12 }}>
              <div className="field-label">Important Instructions for Next Shift</div>
              <div className="field-value">{viewRec.importantInstructions}</div>
            </div>}
          </div>

          {/* Footer: acceptance status */}
          <div
            style={{
              borderTop: '1px solid var(--card-border)',
              paddingTop: 14,
              marginBottom: 14,
            }}
          >
            {viewRec.status === 'Accepted' && viewRec.acceptedBy ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block', flexShrink: 0,
                  }}
                />
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Accepted by </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{viewRec.acceptedBy}</span>
                  {viewRec.acceptedTime && (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 6px' }}>at</span>
                      <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>{viewRec.acceptedTime}</span>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block', flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12, color: '#d97706', fontWeight: 500 }}>
                  Pending Acceptance — awaiting incoming shift acknowledgment
                </span>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setViewRec(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
