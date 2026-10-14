import type { FinishedGood, ManufacturingOrder, ProductionOrder, StorageLocation, Transaction } from './types';

export type StoragePurpose = 'Inventory Storage' | 'Temporary Storage';
export type PipeInventoryBucket = 'Available' | 'Reserved' | 'Temporary Storage' | 'Ready for Ship Out' | 'Awaiting Storage' | 'Quality Pending' | 'Rejected' | 'Shipped';
export const STORAGE_PURPOSES: readonly StoragePurpose[] = ['Inventory Storage', 'Temporary Storage'];
export const STORAGE_LOCATION_TYPES: readonly StorageLocation['locationType'][] = ['Production Area', 'Finished Goods Inventory', 'Temporary Finished Goods', 'Ready for Ship Out', 'Raw Material Area', 'WIP', 'Rejected Materials', 'Recycling', 'Finished Goods Area', 'Staging Area'];
export const DEFAULT_STORAGE_LOCATIONS: readonly StorageLocation[] = [
  { id: 'loc-a', name: 'Section A', plant: 'Branch Plant', locationType: 'Finished Goods Area', description: 'General pipe storage', status: 'Active' },
  { id: 'loc-b', name: 'Section B', plant: 'Branch Plant', locationType: 'Finished Goods Area', description: 'Large-diameter pipe storage', status: 'Active' },
  { id: 'loc-c', name: 'Section C', plant: 'Branch Plant', locationType: 'Raw Material Area', description: 'Pellet and raw-material staging', status: 'Active' },
  { id: 'loc-d', name: 'Section D', plant: 'Branch Plant', locationType: 'Finished Goods Inventory', status: 'Active' },
  { id: 'loc-temp-1', name: 'TMP-BAY-01', plant: 'Branch Plant', locationType: 'Temporary Finished Goods', status: 'Active' },
  { id: 'loc-temp-2', name: 'Customer Order Staging', plant: 'Branch Plant', locationType: 'Temporary Finished Goods', status: 'Active' },
  { id: 'loc-reserved', name: 'Reserved Order Area', plant: 'Branch Plant', locationType: 'Temporary Finished Goods', status: 'Active' },
  { id: 'loc-ship', name: 'Ready for Ship-Out Area', plant: 'Branch Plant', locationType: 'Ready for Ship Out', status: 'Active' },
];
export function readStorageLocations(): StorageLocation[] {
  try {
    const saved = window.localStorage.getItem('hpai:storage-locations-v1');
    if (saved) { const parsed: unknown = JSON.parse(saved); if (Array.isArray(parsed)) return parsed.filter((location): location is StorageLocation => !!location && typeof location === 'object' && typeof location.name === 'string' && typeof location.locationType === 'string'); }
  } catch { /* Use existing default locations when no readable master is available. */ }
  return DEFAULT_STORAGE_LOCATIONS.map(location => ({ ...location }));
}
type SourceContext = { productionOrders: readonly ProductionOrder[]; manufacturingOrders: readonly ManufacturingOrder[] };
export function pipeProductionSource(pipe: FinishedGood, data?: SourceContext): ProductionOrder['source'] {
  const po = data?.productionOrders.find(po => pipe.productionOrderId ? po.id === pipe.productionOrderId && (!pipe.poRef || po.poNo === pipe.poRef) : po.poNo === pipe.poRef);
  return po?.source || pipe.source || (po && data?.manufacturingOrders.some(mo => mo.moNo === po.moRef) ? 'Manufacturing Order' : undefined);
}
export const storagePurposeFromSource = (source: ProductionOrder['source']): StoragePurpose | undefined => source === 'Stock Replenishment' ? 'Inventory Storage' : source === 'Manufacturing Order' ? 'Temporary Storage' : undefined;
const inventoryType = (location: StorageLocation) => ['Finished Goods Inventory', 'Finished Goods Area'].includes(location.locationType);
export function compatibleStorageLocations(purpose: StoragePurpose | undefined, locations = readStorageLocations()) {
  return locations.filter(location => location.status === 'Active' && location.plant === 'Branch Plant' && (purpose === 'Inventory Storage' ? inventoryType(location) : purpose === 'Temporary Storage' && location.locationType === 'Temporary Finished Goods'));
}
export function storageLocationFor(name: string, locations = readStorageLocations()) {
  return locations.find(location => name === location.name || name.startsWith(`${location.name} / `));
}
export function validStorageLocation(name: string, purpose: StoragePurpose | undefined, locations = readStorageLocations()) {
  return !!name.trim() && compatibleStorageLocations(purpose, locations).some(location => name === location.name || name.startsWith(`${location.name} / `));
}
/** Historical confirmations survive master deactivation; new moves require active compatible locations. */
export function hasConfirmedPipeStorage(pipe: FinishedGood, purpose: StoragePurpose | undefined) {
  if (!purpose || pipe.storageStatus !== 'Stored' || !['Stored', 'Quality Pending'].includes(pipe.locationStatus)) return false;
  if (pipe.locationStatus === 'Quality Pending' && !pipe.storedAt) return false;
  const name = pipe.currentLocation || pipe.storageLocation;
  const location = storageLocationFor(name, [...readStorageLocations(), ...DEFAULT_STORAGE_LOCATIONS]);
  if (location) return purpose === 'Inventory Storage' ? inventoryType(location) || (!!pipe.reservedForOrderId && ['Ready for Ship Out', 'Temporary Finished Goods'].includes(location.locationType)) : ['Temporary Finished Goods', 'Ready for Ship Out', 'Staging Area'].includes(location.locationType);
  // Unknown historical locations/IDs/history are retained, but compatibility must be configured before availability is granted.
  return false;
}
/** Allocation is a relationship, not an additional physical bucket. */
export function finishedPipeInventory(pipe: FinishedGood, data?: SourceContext) {
  const source = pipeProductionSource(pipe, data);
  const purpose = storagePurposeFromSource(source);
  const quantity = Number.isFinite(pipe.quantity) ? Math.max(0, pipe.quantity) : 0;
  const allocated = source === 'Manufacturing Order' || !!pipe.reservedForOrderId || !!pipe.reservedForOrderRef;
  let bucket: PipeInventoryBucket;
  if (pipe.releaseStatus === 'Released' || pipe.locationStatus === 'Released' || pipe.fulfillmentStatus === 'Shipped') bucket = 'Shipped';
  else if (pipe.qualityStatus === 'Reject' || pipe.status === 'Quality Reject' || pipe.locationStatus === 'Rejected Material') bucket = 'Rejected';
  else if (pipe.qualityStatus !== 'Pass') bucket = 'Quality Pending';
  else if (!hasConfirmedPipeStorage(pipe, purpose)) bucket = 'Awaiting Storage';
  else if (allocated && (pipe.status === 'Ready for Release' || pipe.reservationStatus === 'Ready for Ship Out' || pipe.fulfillmentStatus === 'Loaded')) bucket = 'Ready for Ship Out';
  else if (source === 'Manufacturing Order') bucket = 'Temporary Storage';
  else if (allocated || pipe.reservedQty > 0) bucket = 'Reserved';
  else if (source === 'Stock Replenishment') bucket = 'Available';
  else bucket = 'Awaiting Storage';
  const onHand = bucket !== 'Shipped' ? quantity : 0;
  return { source, purpose, bucket, quantity, allocated, onHand,
    available: bucket === 'Available' ? quantity : 0, reserved: bucket === 'Reserved' ? quantity : 0,
    temporary: bucket === 'Temporary Storage' ? quantity : 0, ready: bucket === 'Ready for Ship Out' ? quantity : 0,
    awaiting: bucket === 'Awaiting Storage' ? quantity : 0, qualityPending: bucket === 'Quality Pending' ? quantity : 0,
    shipped: bucket === 'Shipped' ? quantity : 0, rejected: bucket === 'Rejected' ? quantity : 0,
    allocatedQuantity: allocated && onHand > 0 && bucket !== 'Rejected' ? quantity : 0 };
}
export function finishedGoodsSummary(pipes: readonly FinishedGood[], data?: SourceContext) {
  const summary = { available: 0, reserved: 0, temporary: 0, ready: 0, awaiting: 0, qualityPending: 0, shipped: 0, rejected: 0, onHand: 0, allocatedQuantity: 0 };
  const seen = new Set<string>();
  for (const pipe of pipes) {
    const identity = pipe.barcode || pipe.fgId || pipe.id;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const state = finishedPipeInventory(pipe, data);
    for (const key of Object.keys(summary) as Array<keyof typeof summary>) summary[key] += state[key];
  }
  return summary;
}
export const generalStockStatus = (available: number, minimum: number) => available === 0 ? 'Out of Stock' : available <= minimum ? 'Low Stock' : 'Normal';
/** Company FG stock enters once at good production output and leaves only on shipment/release. */
export function finishedGoodsStockEffect(transaction: Transaction, pipes: readonly FinishedGood[] = []) {
  const finished = transaction.materialCategory === 'Finished Pipe' || /Finished Pipe|Finished Goods|Production Output/.test(transaction.transactionType);
  if (!finished) return { stockIn: Math.max(0, transaction.qtyChanged), stockOut: Math.max(0, -transaction.qtyChanged), internal: false };
  if (/Released|Shipped|Shipment/.test(transaction.transactionType)) return { stockIn: 0, stockOut: Math.abs(transaction.qtyChanged), internal: false };
  if (transaction.transactionType === 'Production Output') {
    const output = pipes.filter(pipe => pipe.batch === transaction.batch && (!transaction.productionOrderId || !pipe.productionOrderId || pipe.productionOrderId === transaction.productionOrderId));
    const good = transaction.finishedGoodsQuantity ?? (output.length ? output.reduce((sum, pipe) => sum + pipe.quantity, 0) : Math.max(0, transaction.qtyChanged));
    return { stockIn: good, stockOut: 0, internal: false };
  }
  return { stockIn: 0, stockOut: 0, internal: true };
}
export function finishedGoodsStockCard(transactions: readonly Transaction[], pipes: readonly FinishedGood[]) {
  const seen = new Set<string>();
  const movements = transactions.filter(transaction => {
    const identity = transaction.txId || transaction.id;
    const finished = transaction.materialCategory === 'Finished Pipe' || /Finished Pipe|Finished Goods|Production Output/.test(transaction.transactionType);
    if (!finished || seen.has(identity)) return false;
    seen.add(identity); return true;
  }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const effects = movements.map(transaction => finishedGoodsStockEffect(transaction, pipes));
  const net = effects.reduce((sum, effect) => sum + effect.stockIn - effect.stockOut, 0);
  const physical = finishedGoodsSummary(pipes).onHand;
  const inferredOpening = physical - net;
  let balance = Math.max(0, inferredOpening);
  const rows = movements.map((transaction, index) => { const effect = effects[index]; const before = balance; balance += effect.stockIn - effect.stockOut; return { transaction, ...effect, before, balance }; });
  return { rows, opening: Math.max(0, inferredOpening), ending: balance, physical, needsReconciliation: inferredOpening < 0 || balance < 0 };
}
