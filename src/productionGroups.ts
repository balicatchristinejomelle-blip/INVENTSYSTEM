import { productionOriginGroup, resolveFinishedPipe, resolveProductionSource, type PipeRelationships } from './finishedPipeRelations';
import type { FinishedGood, ProductionOrder, RejectedMaterial } from './types';

export interface ProductionGroup {
  reference: string;
  type: 'MO' | 'Replenishment';
  orders: ProductionOrder[];
  pipes: FinishedGood[];
  rejects: RejectedMaterial[];
}
/** Read-only aggregation. No generated entities, references, or dataset writes. */
export function buildProductionGroups(data: PipeRelationships & { finishedGoods: FinishedGood[]; rejectedMaterials: RejectedMaterial[] }) {
  const groups = new Map<string, ProductionGroup>();
  const get = (reference: string, type: ProductionGroup['type']) => {
    const key = `${type}|${reference}`;
    if (!groups.has(key)) groups.set(key, { reference, type, orders: [], pipes: [], rejects: [] });
    return groups.get(key)!;
  };
  data.productionOrders.forEach(po => {
    const source = resolveProductionSource(po, data);
    const reference = productionOriginGroup(po, data);
    if (reference && source) get(reference, source === 'Manufacturing Order' ? 'MO' : 'Replenishment').orders.push(po);
  });
  data.finishedGoods.forEach(pipe => {
    const resolved = resolveFinishedPipe(pipe, data);
    if (resolved.originGroup && (pipe.source || resolved.source)) {
      const group = get(resolved.originGroup, (pipe.source || resolved.source) === 'Manufacturing Order' ? 'MO' : 'Replenishment');
      group.pipes.push(pipe);
      if (resolved.po && !group.orders.some(po => po.id === resolved.po!.id)) group.orders.push(resolved.po);
    }
  });
  data.rejectedMaterials.forEach(reject => {
    const po = data.productionOrders.find(po => po.poNo === reject.poRef);
    const reference = po && productionOriginGroup(po, data);
    const source = resolveProductionSource(po, data);
    if (reference && source) get(reference, source === 'Manufacturing Order' ? 'MO' : 'Replenishment').rejects.push(reject);
  });
  return [...groups.values()].sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }));
}
export function productionGroupSummary(group: ProductionGroup, data: PipeRelationships) {
  const good = group.pipes.filter(pipe => pipe.qualityStatus !== 'Reject');
  const rejected = group.rejects.reduce((sum, reject) => sum + reject.quantity, 0);
  const statuses = new Set(group.orders.map(po => po.status));
  return {
    target: group.orders.reduce((sum, po) => sum + po.targetQty, 0),
    produced: good.reduce((sum, pipe) => sum + pipe.quantity, 0) + rejected,
    good: good.reduce((sum, pipe) => sum + pipe.quantity, 0), rejected,
    available: good.reduce((sum, pipe) => sum + resolveFinishedPipe(pipe, data).availableQty, 0),
    reserved: good.filter(pipe => pipe.releaseStatus !== 'Released').reduce((sum, pipe) => sum + pipe.reservedQty, 0),
    temporary: good.filter(pipe => pipe.releaseStatus !== 'Released' && pipe.storageStatus === 'Stored' && resolveFinishedPipe(pipe, data).purpose === 'Temporary Storage').reduce((sum, pipe) => sum + pipe.quantity, 0),
    ready: good.filter(pipe => pipe.status === 'Ready for Release' && pipe.releaseStatus !== 'Released').reduce((sum, pipe) => sum + pipe.quantity, 0),
    shipped: good.filter(pipe => pipe.releaseStatus === 'Released').reduce((sum, pipe) => sum + pipe.quantity, 0),
    batches: [...new Set([...group.pipes.map(pipe => pipe.batch), ...group.rejects.map(reject => reject.batch)])].filter(Boolean),
    status: statuses.size === 1 ? [...statuses][0] : statuses.size ? 'Mixed Statuses' : 'Historical Output',
  };
}
