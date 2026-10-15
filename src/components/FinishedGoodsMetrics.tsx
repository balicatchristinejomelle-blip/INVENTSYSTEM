import React from 'react';
import { useApp } from '../store';
import { finishedGoodsSummary } from '../finishedGoodsInventory';
import type { FinishedGood } from '../types';
import MetricCards from './MetricCards';
export default function FinishedGoodsMetrics({ pipes }: { pipes?: readonly FinishedGood[] }) {
  const app = useApp();
  const counts = finishedGoodsSummary(pipes || app.finishedGoods, app);
  return <div className="inventory-summary page-stack">
    <MetricCards inventory label="Finished Goods inventory summary" items={[
      ['Available', counts.available], ['Reserved', counts.reserved], ['Temporary Storage', counts.temporary],
      ['Ready for Ship Out', counts.ready], ['On Hand', counts.onHand],
    ]} />
    <MetricCards label="Additional inventory conditions" items={[
    ['Awaiting Storage / Quality', counts.awaiting + counts.qualityPending],
    ['Held Rejected Pipe Records', counts.rejected],
    ]} />
  </div>;
}
