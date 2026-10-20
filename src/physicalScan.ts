import type { PelletInventory, Transfer, MaterialRequest } from './types';

export type PhysicalScanMeta = { shift: string; scannerMode: string; barcode?: string; orderId?: string };
const canonical = (value: string) => value.trim().toUpperCase();
/** Evidence must be the exact active physical barcode, never an ID or legacy alias. */
export function exactPhysicalScan(meta: PhysicalScanMeta | undefined, item: { id: string; barcode: string }, records: readonly { id: string; barcode: string }[]) {
  const value = canonical(meta?.barcode || '');
  return !!value && value === canonical(item.barcode) && records.filter(record => canonical(record.barcode) === value).length === 1;
}
export function expectedPelletError(bag: PelletInventory, transfers: readonly Transfer[], requests: readonly MaterialRequest[]) {
  const transfer = transfers.find(item => item.refNo === bag.transferRef && item.batchNo === bag.batchNo);
  const request = requests.find(item => item.refNo === transfer?.requestRef);
  if (!transfer || !request || request.status !== 'Approved') return 'An Approved Material Request and matching expected transfer are required.';
  if (!['In Transit', 'Receiving Discrepancy'].includes(transfer.status)) return 'This delivery is not In Transit / awaiting physical receiving.';
  if (bag.inventoryStatus !== 'Pending Receipt' || bag.availableKg !== 0 || bag.receivedAt) return 'This bag has already been received or is not an expected bag.';
  if (bag.originalKg !== 25 || transfer.weightKg !== (transfer.numberOfBags || 0) * 25 || request.requestedKg !== (request.requestedBags ?? request.requestedKg / 25) * 25) return 'Expected bag weight must be 25 kg.';
  if (bag.type !== request.pelletType || bag.type !== transfer.pelletType || bag.grade !== request.grade || bag.grade !== transfer.grade || bag.color !== transfer.color || bag.color !== request.color) return 'Barcode does not match the approved material, grade or color.';
  return null;
}
