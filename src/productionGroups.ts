import { finishedGoodsSummary } from './finishedGoodsInventory';
import { productionOriginGroup, resolveFinishedPipe, resolveProductionSource, type PipeRelationships } from './finishedPipeRelations';
import type { FinishedGood, ProductionOrder, RejectedMaterial } from './types';

export interface ProductionGroup {
  reference: string;
  type: 'MO' | 'Replenishment';
  orders: ProductionOrder[];
  pipes: FinishedGood[];
  rejects: RejectedMaterial[];
}
/** Batch trace keeps production origin separate from later customer allocation. */
export function batchOriginTrace(pipes: readonly FinishedGood[], data: PipeRelationships) {
  const resolved = pipes.map(pipe => resolveFinishedPipe(pipe, data));
  const values = (items: Array<string | undefined>, fallback = 'N/A') => [...new Set(items.filter((item): item is string => !!item))].join(', ') || fallback;
  const types = resolved.map(result => (result.pipe.source || result.source) === 'Manufacturing Order' ? 'MO' : (result.pipe.source || result.source) === 'Stock Replenishment' ? 'Replenishment' : 'Not Resolved');
  return {
    originGroup: values(resolved.map(result => result.originGroup), 'Not Resolved'),
    groupType: values(types),
    po: values(resolved.map(result => result.po?.poNo || result.pipe.poRef), 'Not Resolved'),
    mo: values(resolved.filter((_, index) => types[index] === 'MO').map(result => result.mo?.moNo)),
    order: values(resolved.filter((_, index) => types[index] === 'MO').map(result => result.order?.orderNo)),
    buyer: values(resolved.filter((_, index) => types[index] === 'MO').map(result => result.buyer)),
    purpose: values(types.map(type => type === 'MO' ? 'Temporary Storage' : type === 'Replenishment' ? 'Inventory Storage' : 'Not Resolved')),
    itemCode: values(resolved.map(result => result.itemCode), 'Not Configured'),
    productBarcode: values(resolved.map(result => result.productBarcode), 'Not Configured'),
    seasonal: resolved.some(result => result.seasonal),
    shift: values(pipes.map(pipe => pipe.shift)),
    temporary: finishedGoodsSummary(pipes, data).temporary,
  };
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
  const inventory = finishedGoodsSummary(group.pipes, data);
  return {
    target: group.orders.reduce((sum, po) => sum + po.targetQty, 0),
    produced: good.reduce((sum, pipe) => sum + pipe.quantity, 0) + rejected,
    good: good.reduce((sum, pipe) => sum + pipe.quantity, 0), rejected,
    available: inventory.available,
    reserved: inventory.reserved,
    temporary: inventory.temporary,
    ready: inventory.ready,
    shipped: good.filter(pipe => pipe.releaseStatus === 'Released').reduce((sum, pipe) => sum + pipe.quantity, 0),
    batches: [...new Set([...group.pipes.map(pipe => pipe.batch), ...group.rejects.map(reject => reject.batch)])].filter(Boolean),
    status: statuses.size === 1 ? [...statuses][0] : statuses.size ? 'Mixed Statuses' : 'Historical Output',
  };
}
