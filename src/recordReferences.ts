import type { SearchResult } from './components/UniversalSearch';

const identityFields = ['fgId','barcode','bagNo','refNo','rrNumber','poNo','moNo','orderNo','txId','transactionId','turnoverNo','rejectionId'];
const recordGroups = new Set(['PRODUCTION ORDERS','MANUFACTURING ORDERS','CUSTOMER ORDERS','FINISHED PIPES','MATERIAL REQUESTS','TRANSFERS','RECEIVING REPORTS','PELLET BAGS','RECYCLING BATCHES','REJECTED MATERIAL','INVENTORY MOVEMENTS','MATERIAL USAGE','SHIFT TURNOVERS']);
/** A permanent Record ID can equal a former barcode; never present it as an active label. */
export function legacyReferenceMessage(record: object, reference: string): string | undefined {
  const pipe = record as { barcode?: string; barcodeMigrations?: { oldBarcode: string }[] };
  return pipe.barcode && pipe.barcode !== reference && pipe.barcodeMigrations?.some(item => item.oldBarcode === reference)
    ? `Legacy barcode. This Pipe has been migrated to: ${pipe.barcode}` : undefined;
}
/** Input must already be the existing role-scoped universal index. No new access policy. */
export function referenceTargets(index: readonly SearchResult[], reference: string): SearchResult[] {
  const value = reference.trim();
  if (!value || value === '—') return [];
  const expected = /^SO-/.test(value) ? 'CUSTOMER ORDERS' : /^MO-/.test(value) ? 'MANUFACTURING ORDERS' : /^PO-/.test(value) ? 'PRODUCTION ORDERS' : /^RR-/.test(value) ? 'RECEIVING REPORTS' : /^MR-/.test(value) ? 'MATERIAL REQUESTS' : undefined;
  const allowed = index.filter(result => recordGroups.has(result.group) && (!expected || result.group === expected));
  const direct = allowed.filter(result => result.id === value || result.title === value || identityFields.some(key => (result.record as Record<string,unknown>)[key] === value));
  if (direct.length || expected) return direct;
  return allowed.filter(result => ['FINISHED PIPES','PELLET BAGS','RECYCLING BATCHES'].includes(result.group)
    && ['batch','batchNo','originGroup','shipmentReference'].some(key => (result.record as Record<string,unknown>)[key] === value));
}
export function relatedReferenceValues(record: object): string[] {
  const fields = ['orderRef','moRef','poRef','productionOrderRef','batch','batchNo','originGroup','rrRef','transferRef','recyclingBatchRef','reference','shipmentReference','releaseReference','reservedForOrderId','customerOrderId','manufacturingOrderId','productionOrderId'];
  return [...new Set(fields.map(key => (record as Record<string,unknown>)[key]).filter((value): value is string => typeof value === 'string' && !!value))];
}
export function reverseReferenceValues(index: readonly SearchResult[], record: object): string[] {
  const current = record as Record<string, unknown>;
  const identities = new Set(['id', ...identityFields].map(key => current[key]).filter((value): value is string => typeof value === 'string' && !!value));
  return [...new Set(index.filter(result => recordGroups.has(result.group) && result.id !== current.id && relatedReferenceValues(result.record).some(value => identities.has(value))).map(result => result.title))];
}
