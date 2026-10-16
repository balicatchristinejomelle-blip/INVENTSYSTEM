import type { ProductionOrder, RejectedMaterial } from './types';

/** Read-only fallback for older POs. Explicit saved totals, including zero, win. */
export function productionOutputTotals(po: ProductionOrder, rejectedMaterials: RejectedMaterial[]) {
  const rejected = po.totalRejectedQty ?? rejectedMaterials
    .filter(record => record.poRef === po.poNo)
    .reduce((sum, record) => sum + record.quantity, 0);
  return { output: po.completedQty, rejected, good: po.totalGoodQty ?? Math.max(0, po.completedQty - rejected) };
}

export function canRecordProduction(po: ProductionOrder) {
  return ['Scheduled', 'Ready', 'In Production', 'Partially Completed'].includes(po.status)
    && po.completedQty < po.targetQty;
}
