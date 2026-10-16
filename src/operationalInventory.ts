import type { FinishedGood, PelletInventory, Transaction } from './types';
import { finishedGoodsStockCard, finishedGoodsStockEffect } from './finishedGoodsInventory';

export function pelletBalances(pellets: readonly PelletInventory[]) {
  const raw = pellets.filter(item => item.inventoryStatus === 'Available' && item.availableKg > 0);
  return {
    virgin: raw.filter(item => item.type === 'Virgin').reduce((sum, item) => sum + item.availableKg, 0),
    recycled: raw.filter(item => item.type === 'Recycled').reduce((sum, item) => sum + item.availableKg, 0),
    wip: pellets.filter(item => ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus) && item.availableKg > 0).reduce((sum, item) => sum + item.availableKg, 0),
  };
}
export const canFinishWip = (item: PelletInventory) => ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus) && item.availableKg === 0;
export function movementCategory(item: Transaction) {
  if (item.materialCategory) return item.materialCategory;
  const text = `${item.item} ${item.transactionType}`.toLowerCase();
  return /colorant/.test(text) ? 'Colorant' : /finished|pipe|production output/.test(text) ? 'Finished Pipe' : /recycled/.test(text) ? 'Recycled Pellet' : 'Virgin Pellet';
}
/** Stock-card effects are read-only. Never rewrite historical transaction deltas. */
export function operationalStockEffect(item: Transaction, pipes: readonly FinishedGood[]) {
  if (movementCategory(item) === 'Finished Pipe') return finishedGoodsStockEffect(item, pipes);
  if (/Loaded|Consum|Relocat|Internal|Transfer|Recycled Pellet Stored/i.test(item.transactionType)
    || /^(MT|TR)-/.test(item.reference)) return { stockIn: 0, stockOut: 0, internal: true };
  return finishedGoodsStockEffect(item, pipes);
}
export function operationalStockCard(transactions: readonly Transaction[], pipes: readonly FinishedGood[]) {
  const seen = new Set<string>();
  // Stored history is newest first; preserve true event order inside one minute.
  const ordered = [...transactions].reverse().filter(item => {
    const key = item.txId || item.id;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const finished = finishedGoodsStockCard([...ordered], [...pipes]);
  const opening = new Map<string, number>(), identities = new Set<string>();
  for (const item of ordered) {
    const category = movementCategory(item);
    if (category === 'Finished Pipe') continue;
    const identity = item.barcode || `${category}|${item.item}|${item.batch}`;
    if (!identities.has(identity)) { identities.add(identity); opening.set(category, (opening.get(category) || 0) + item.qtyBefore); }
  }
  const balances = new Map(opening);
  return ordered.map(transaction => {
    const category = movementCategory(transaction), effect = operationalStockEffect(transaction, pipes);
    const fg = category === 'Finished Pipe' ? finished.rows.find(row => row.transaction.id === transaction.id) : undefined;
    const before = fg?.before ?? balances.get(category) ?? 0;
    const balance = fg?.balance ?? before + effect.stockIn - effect.stockOut;
    balances.set(category, balance);
    return { transaction, category, ...effect, before, balance };
  });
}
