import React from 'react';
import { TermHelp } from './UXFeedback';

/** Presentation only: callers retain ownership of values, calculations and eligibility. */
export default function MetricCards({ items, inventory = false, label }: {
  items: readonly (readonly [string, React.ReactNode, React.ReactNode?])[];
  inventory?: boolean;
  label?: string;
}) {
  return <div className={`kpi-grid${inventory ? ' inventory-metrics' : ''}`} aria-label={label}>
    {items.map(([title, value, detail]) => <div className="app-card kpi-card metric-card" key={title}>
      <div className="metric-label"><span>{title}</span>{inventory && <TermHelp term={title} compact />}</div>
      <strong>{value}</strong>
      {detail !== undefined && <small>{detail}</small>}
    </div>)}
  </div>;
}
