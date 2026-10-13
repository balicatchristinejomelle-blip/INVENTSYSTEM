import React from 'react';
import type { LifecycleStep, LinkedRecord, RecordHistoryEvent } from '../types';
import StatusBadge from './StatusBadge';

export function Lifecycle({ steps, label = 'Record lifecycle' }: { steps: LifecycleStep[]; label?: string }) {
  return <div className="lifecycle" aria-label={label}>{steps.map((step, index) => <React.Fragment key={step.label}>
    <div className={`lifecycle-step is-${step.state}`} aria-current={step.state === 'current' ? 'step' : undefined}><span>{index + 1}</span><strong>{step.label}</strong></div>
    {index < steps.length - 1 && <div className={`lifecycle-line${step.state === 'complete' ? ' is-complete' : ''}`} />}
  </React.Fragment>)}</div>;
}

export function RecordHistory({ events }: { events: RecordHistoryEvent[] }) {
  return <section className="record-context-card"><div className="section-title">Record History</div>
    {events.length ? <ol className="record-timeline">{events.map(event => <li key={event.id}><time>{event.datetime}</time><div><strong>{event.title}</strong>{event.description && <span>{event.description}</span>}{event.actor && <small>{event.actor}</small>}</div></li>)}</ol> : <div className="empty-state"><strong>NO RECORD HISTORY</strong><div>No history events are available for this record.</div></div>}
  </section>;
}

export function LinkedRecords({ records, onOpen }: { records: LinkedRecord[]; onOpen: (record: LinkedRecord) => void }) {
  return <section className="record-context-card"><div className="section-title">Linked Records</div>
    {records.length ? <div className="linked-records">{records.map(record => <button key={record.id} className="linked-record" onClick={() => onOpen(record)}><span>{record.label}</span><strong>{record.reference}</strong>{record.status && <StatusBadge status={record.status} size="sm" />}</button>)}</div> : <div className="empty-state"><strong>NO LINKED RECORDS</strong><div>No authorized linked records are available.</div></div>}
  </section>;
}
