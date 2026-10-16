import React from 'react';
import type { finishedGoodsSummary } from '../finishedGoodsInventory';

/** Explain the existing physical-stock equation; never alter inventory quantities. */
export default function InventorySummaryNote({ counts }: { counts: ReturnType<typeof finishedGoodsSummary> }) {
  const buckets = [
    ['Available', counts.available], ['Reserved', counts.reserved], ['Temporary Storage', counts.temporary],
    ['Ready for Ship Out', counts.ready], ['Awaiting Storage', counts.awaiting],
    ['Quality Pending', counts.qualityPending], ['Held Rejected', counts.rejected],
  ] as const;
  return <p className="helper-text inventory-summary-equation" aria-label="On Hand breakdown">
    <strong>On Hand ({counts.onHand})</strong> = {buckets.map(([label, value], index) => <React.Fragment key={label}>
      {index > 0 && ' + '}<span>{label} ({value})</span>
    </React.Fragment>)}. Shipped pipes are excluded. All values are individual physical pipes, not kg.
  </p>;
}
