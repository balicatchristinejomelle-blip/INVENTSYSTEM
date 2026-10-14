import React from 'react';
import { useApp } from '../store';
import { finishedGoodsSummary } from '../finishedGoodsInventory';
import type { FinishedGood } from '../types';
export default function FinishedGoodsMetrics({ pipes }: { pipes?: readonly FinishedGood[] }) {
  const app = useApp();
  const counts = finishedGoodsSummary(pipes || app.finishedGoods, app);
  return <div className="kpi-grid">{[
    ['Available General Inventory', counts.available], ['Reserved General Inventory', counts.reserved],
    ['Temporary Buyer Stock', counts.temporary], ['Ready for Ship Out', counts.ready], ['Physical On Hand', counts.onHand],
    ['Awaiting Storage / Quality', counts.awaiting + counts.qualityPending],
    ['Held Rejected Pipe Records', counts.rejected],
  ].map(([label, count]) => <div className="app-card kpi-card" key={label}><div>{label}</div><strong>{count}</strong></div>)}</div>;
}
