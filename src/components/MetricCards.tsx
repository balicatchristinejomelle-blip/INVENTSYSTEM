import React from 'react';
import { TermHelp } from './UXFeedback';

/** Presentation only: callers retain ownership of values, calculations and eligibility. */
export default function MetricCards({ items, inventory = false, label }: {
  items: readonly (readonly [string, React.ReactNode, React.ReactNode?])[];
  inventory?: boolean;
  label?: string;
}) {
  return <div className={`kpi-grid${inventory ? ' inventory-metrics' : ''}`} aria-label={label}>
    {items.map(([title, value, detail]) => <div className="app-card kpi-card" key={title}>
      <div className="metric-label">{title}{inventory && <TermHelp term={title} />}</div>
      <strong>{value}</strong>
      {detail !== undefined && <small>{detail}</small>}
    </div>)}
  </div>;
}
