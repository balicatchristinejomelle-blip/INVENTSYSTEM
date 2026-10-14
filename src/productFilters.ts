import { HPAI_PRODUCT_MASTER, normalizeProductType, sizesForProduct, specificationKey, specificationKeyFromRecord } from './productMaster';
import { pipeSearchRecord, type PipeRelationships } from './finishedPipeRelations';
import type { FinishedGood, ProductSpecification } from './types';

export interface ProductFilter { size: string; sdr: string; product: string; grade: string; length: string }
export const emptyProductFilter: ProductFilter = { size: '', sdr: '', product: '', grade: '', length: '' };
/** Options come from the master, never the records being filtered. */
export function productFilterSizes(product: string, specifications: readonly ProductSpecification[] = []) {
  const polytube = specifications.filter(spec => spec.productType === 'Polytube' && spec.active).map(spec => spec.size);
  return product && product !== 'All' ? sizesForProduct(product, polytube)
    : [...new Set([...HPAI_PRODUCT_MASTER.standardDiameters, ...HPAI_PRODUCT_MASTER.ctsSizes, ...HPAI_PRODUCT_MASTER.spiralPipeSizes, ...polytube])];
}
/** Enrich only the supplied, already-authorized record. Relationships provide specification context, not new result records. */
export function productFilterRecord(record: unknown, data: PipeRelationships & { finishedGoods?: FinishedGood[] }): Record<string, unknown> {
  if (!record || typeof record !== 'object') return {};
  const value = record as Record<string, unknown>;
  if ('fgId' in value) return pipeSearchRecord(record as FinishedGood, data);
  const pipe = data.finishedGoods?.find(pipe => pipe.id === value.id || (!!value.barcode && pipe.barcode === value.barcode));
  if (pipe) return { ...pipeSearchRecord(pipe, data), ...value };
  const reference = value.poRef || value.sourcePO || value.reference;
  const po = data.productionOrders.find(po => po.poNo === reference || po.id === value.poId);
  const resolved = po ? { ...po, ...value, product: HPAI_PRODUCT_MASTER.products.includes(normalizeProductType(String(value.product || ''))) ? value.product : po.product, diameter: value.diameter || po.diameter, sdr: value.sdr || po.sdr, grade: value.grade || po.grade, length: value.length || po.length, originGroup: po.originGroup } : value;
  if (!resolved.product || !resolved.diameter || !resolved.productForm) return resolved;
  const matches = (data.specifications || []).filter(spec => specificationKey(spec) === specificationKeyFromRecord(resolved as unknown as FinishedGood) && spec.pipeConstruction === resolved.construction);
  const configured = matches.length === 1 ? matches[0] : undefined;
  const itemCode = resolved.itemCode || configured?.itemCode;
  return { ...resolved, itemCode, productBarcode: resolved.productBarcode || (typeof itemCode === 'string' && itemCode.startsWith('PEP-') ? `${itemCode}|${resolved.product}|${resolved.diameter}x${resolved.length}|${resolved.sdr}` : undefined), seasonal: (resolved.seasonal ?? configured?.seasonal) === true };
}
export function matchesProductFilter(record: unknown, filter: ProductFilter, data?: PipeRelationships & { finishedGoods?: FinishedGood[] }) {
  const value = data ? productFilterRecord(record, data) : record as Record<string, unknown>;
  return (!filter.product || normalizeProductType(String(value.productType || value.product || '')) === normalizeProductType(filter.product))
    && (!filter.grade || (value.materialGrade || value.grade) === filter.grade)
    && (!filter.size || (value.size || value.diameter) === filter.size)
    && (!filter.sdr || value.sdr === filter.sdr)
    && (!filter.length || (value.length || value.straightLength || value.coilLength) === filter.length);
}
