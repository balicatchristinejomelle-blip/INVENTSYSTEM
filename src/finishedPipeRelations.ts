import type { Customer, CustomerOrder, FinishedGood, ManufacturingOrder, ProductionOrder, ProductSpecification } from './types';
import { normalizeProductSpecification, specificationKey, specificationKeyFromRecord } from './productMaster';
import { finishedPipeInventory, hasConfirmedPipeStorage, storagePurposeFromSource } from './finishedGoodsInventory';

export interface PipeRelationships {
  productionOrders: ProductionOrder[];
  manufacturingOrders: ManufacturingOrder[];
  orders: CustomerOrder[];
  customers: Customer[];
  specifications?: readonly ProductSpecification[];
}
export function readPipeSpecifications(): ProductSpecification[] {
  try { return (JSON.parse(window.localStorage.getItem('hpai:product-specifications-v1') || '[]') as unknown[]).map(normalizeProductSpecification).filter((spec): spec is ProductSpecification => !!spec); }
  catch { return []; }
}
export function resolveProductionSource(po: ProductionOrder | undefined, data: Pick<PipeRelationships, 'manufacturingOrders'>): ProductionOrder['source'] {
  if (!po) return undefined;
  if (po.source) return po.source;
  return data.manufacturingOrders.some(mo => mo.moNo === po.moRef) ? 'Manufacturing Order' : undefined;
}
export const replenishmentGroup = (po: ProductionOrder) => po.originGroup && /^REPLENISH-\d{4}-\d+$/.test(po.originGroup) ? po.originGroup : `REPLENISH-${po.poNo.replace(/^PO-/, '')}`;
export const validOriginGroup = (value: string | undefined, source: ProductionOrder['source']) => !!value && (source === 'Manufacturing Order' ? /^MO-\d{4}-\d+$/.test(value) : source === 'Stock Replenishment' ? /^REPLENISH-\d{4}-\d+$/.test(value) : /^(?:MO|REPLENISH)-\d{4}-\d+$/.test(value));
export function productionOriginGroup(po: ProductionOrder, data: Pick<PipeRelationships, 'manufacturingOrders'>) {
  const source = resolveProductionSource(po, data);
  return validOriginGroup(po.originGroup, source) ? po.originGroup : source === 'Manufacturing Order' ? data.manufacturingOrders.find(mo => mo.moNo === po.moRef)?.moNo : source === 'Stock Replenishment' ? replenishmentGroup(po) : undefined;
}
export function resolveFinishedPipe(pipe: FinishedGood, data: PipeRelationships) {
  const po = pipe.productionOrderId ? data.productionOrders.find(item => item.id === pipe.productionOrderId && (!pipe.poRef || item.poNo === pipe.poRef)) : data.productionOrders.find(item => item.poNo === pipe.poRef);
  const source = resolveProductionSource(po, data) || pipe.source;
  const mo = source === 'Manufacturing Order' ? data.manufacturingOrders.find(item => item.moNo === po?.moRef) : undefined;
  const originOrder = mo ? data.orders.find(item => item.orderNo === mo.orderRef) : undefined;
  const allocatedOrder = pipe.reservedForOrderId ? data.orders.find(item => item.id === pipe.reservedForOrderId) : pipe.reservedForOrderRef ? data.orders.find(item => item.orderNo === pipe.reservedForOrderRef) : undefined;
  const order = source === 'Manufacturing Order' ? originOrder : allocatedOrder;
  const customer = order ? data.customers.find(item => item.id === order.customerId) : undefined;
  const product = { ...pipe, product: pipe.product || po?.product || '', grade: pipe.grade || po?.grade || '', diameter: pipe.diameter || po?.diameter || '', sdr: pipe.sdr || po?.sdr || '', length: pipe.length || po?.length || '', color: pipe.color || po?.color || '', stripe: pipe.stripe || po?.stripe || '', construction: pipe.construction || po?.construction || '', productForm: pipe.productForm || po?.productForm || '' };
  const matches = (data.specifications || []).filter(spec => specificationKey(spec) === specificationKeyFromRecord(product) && spec.pipeConstruction === product.construction);
  const specification = pipe.productSpecificationId ? matches.find(spec => spec.id === pipe.productSpecificationId) : matches.length === 1 ? matches[0] : undefined;
  const positive = (value?: number) => value !== undefined && Number.isFinite(value) && value > 0;
  const unitWeightKg = positive(pipe.unitWeightKg) ? pipe.unitWeightKg : positive(specification?.unitWeightKg) ? specification!.unitWeightKg : positive(po?.unitWeightKg) ? po!.unitWeightKg : undefined;
  const unitWeightSource = positive(pipe.unitWeightKg) ? 'Production snapshot' : positive(specification?.unitWeightKg) ? 'Product Specification' : positive(po?.unitWeightKg) ? 'Configured PO snapshot' : matches.length > 1 ? 'Configuration Conflict' : 'Not Configured';
  const storedParts = pipe.productBarcode?.split('|');
  const storedBarcode = storedParts?.length === 4 && storedParts[0].startsWith('PEP-') && storedParts[1] === product.product && storedParts[2] === `${product.diameter}x${product.length}` && storedParts[3] === product.sdr ? pipe.productBarcode : undefined;
  const itemCode = pipe.itemCode || storedBarcode?.split('|')[0] || specification?.itemCode;
  const productBarcode = storedBarcode || (itemCode ? `${itemCode}|${product.product}|${product.diameter}x${product.length}|${product.sdr}` : undefined);
  const purpose = storagePurposeFromSource(source) || 'Source Not Resolved';
  const rejected = pipe.qualityStatus === 'Reject' || pipe.status === 'Quality Reject' || pipe.locationStatus === 'Rejected Material';
  const released = pipe.releaseStatus === 'Released' || pipe.locationStatus === 'Released';
  const stored = hasConfirmedPipeStorage(pipe, storagePurposeFromSource(source));
  const inventory = finishedPipeInventory(pipe, data);
  const inventoryStatus = rejected ? 'Rejected Material' : released ? 'Released' : pipe.qualityStatus !== 'Pass' ? 'Quality Pending' : stored ? 'Stored' : 'Awaiting Storage';
  const issues = [!po && 'Production Order Not Found', source === 'Manufacturing Order' && !mo && 'Manufacturing Order Not Found', mo && !originOrder && 'Customer Order Not Found', !source && 'Production Source Not Resolved', mo && pipe.moRef && pipe.moRef !== mo.moNo && 'Stored MO reference differs from source PO', originOrder && allocatedOrder && originOrder.id !== allocatedOrder.id && 'Allocation differs from originating Customer Order'].filter(Boolean) as string[];
  return { pipe, product, po, mo, order, customer, source, specification, itemCode, productBarcode, seasonal: (pipe.seasonal ?? specification?.seasonal) === true, unitWeightKg, unitWeightSource, buyer: order?.customerName || customer?.name, originGroup: validOriginGroup(pipe.originGroup, pipe.source || source) ? pipe.originGroup : po ? productionOriginGroup(po, data) : undefined, purpose, inventoryStatus, issues, availableQty: inventory.available, inventory };
}
/** Idempotent hydration: no identity/quantity/print metadata or physical movement changes. */
export function hydrateFinishedPipe(pipe: FinishedGood, data: PipeRelationships): FinishedGood {
  const resolved = resolveFinishedPipe(pipe, data);
  const updates: Partial<FinishedGood> = { ...resolved.product, source: resolved.source ?? pipe.source, productionOrderId: resolved.po?.id ?? pipe.productionOrderId, manufacturingOrderId: resolved.mo?.id ?? pipe.manufacturingOrderId, customerOrderId: resolved.order?.id ?? pipe.customerOrderId, moRef: resolved.mo?.moNo ?? pipe.moRef, orderReference: resolved.order?.orderNo ?? pipe.orderReference, buyer: resolved.buyer ?? pipe.buyer, originGroup: resolved.originGroup ?? pipe.originGroup };
  const inventory = resolved.inventory;
  updates.availableQty = inventory.available;
  updates.reservedQty = inventory.reserved;
  if (resolved.source === 'Stock Replenishment') updates.inventoryPurpose = 'General Inventory';
  else if (resolved.source === 'Manufacturing Order') updates.inventoryPurpose = 'Customer Order';
  updates.status = inventory.bucket === 'Temporary Storage' ? 'Stored' : inventory.bucket === 'Ready for Ship Out' ? 'Ready for Release' : inventory.bucket === 'Shipped' ? 'Released' : inventory.bucket === 'Rejected' ? 'Quality Reject' : inventory.bucket;
  if (inventory.bucket === 'Shipped') { updates.releaseStatus = 'Released'; updates.locationStatus = 'Released'; }
  else if (inventory.bucket === 'Rejected') updates.locationStatus = 'Rejected Material';
  else if (inventory.bucket === 'Awaiting Storage') updates.locationStatus = 'Awaiting Storage';
  else if (inventory.bucket === 'Quality Pending') updates.locationStatus = 'Quality Pending';
  else updates.locationStatus = 'Stored';
  return Object.entries(updates).every(([key, value]) => pipe[key as keyof FinishedGood] === value) ? pipe : { ...pipe, ...updates };
}
export function hydratePipeRelationships<T extends PipeRelationships & { finishedGoods: FinishedGood[] }>(state: T): T {
  const productionOrders = state.productionOrders.map(po => {
    const source = resolveProductionSource(po, state);
    const originGroup = productionOriginGroup(po, state) ?? po.originGroup;
    return po.source === source && po.originGroup === originGroup ? po : { ...po, source, originGroup };
  });
  const context = { ...state, productionOrders };
  const finishedGoods = state.finishedGoods.map(pipe => hydrateFinishedPipe(pipe, context));
  return productionOrders.every((po, index) => po === state.productionOrders[index]) && finishedGoods.every((pipe, index) => pipe === state.finishedGoods[index]) ? state : { ...state, productionOrders, finishedGoods };
}
export function pipeSearchRecord(pipe: FinishedGood, data: PipeRelationships) {
  const result = resolveFinishedPipe(pipe, data);
  return { ...pipe, ...result.product, itemCode: result.itemCode, productBarcode: result.productBarcode, productionSource: result.source, moReference: result.mo?.moNo, customerOrder: result.order?.orderNo, buyer: result.buyer, originGroup: result.originGroup, inventoryPurpose: result.purpose, storagePurpose: result.purpose, inventoryStatus: result.inventoryStatus, currentInventoryBucket: result.inventory.bucket, unitWeightKg: result.unitWeightKg, unitWeightSource: result.unitWeightSource };
}
