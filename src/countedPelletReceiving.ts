import type { MaterialRequest, PelletInventory, Transfer, BarcodeRegistryRecord } from './types';
import { expectedPelletPlan } from './incomingPelletBarcodes';

type Source = { materialRequests: MaterialRequest[]; pellets: PelletInventory[]; transfers: Transfer[]; barcodeRegistry: BarcodeRegistryRecord[] };
/** Read-only validation. A receipt count is cumulative, never an additional count. */
export function countedReceiptPlan(source: Source, transferId: string, total: number, reason?: Transfer['discrepancyReason']) {
  const transfer = source.transfers.find(item => item.id === transferId);
  const request = source.materialRequests.find(item => item.refNo === transfer?.requestRef);
  const plan = request ? expectedPelletPlan(source, request.id) : undefined;
  const bags = plan?.bags || [];
  const received = bags.filter(bag => bag.inventoryStatus !== 'Pending Receipt');
  const pending = bags.filter(bag => bag.inventoryStatus === 'Pending Receipt').sort((a, b) => a.barcode.localeCompare(b.barcode));
  const sent = transfer?.sentQuantity ?? transfer?.numberOfBags ?? 0;
  const delta = total - received.length;
  let error = plan?.error || '';
  if (!transfer || !request || request.status !== 'Approved' || plan?.transfer?.id !== transferId) error = 'An Approved Material Request and matching transfer are required.';
  else if (transfer.pelletType !== request.pelletType || transfer.grade !== request.grade || transfer.color !== request.color) error = 'Transfer material, grade and color must match the approved request.';
  else if (!['In Transit', 'Receiving Discrepancy'].includes(transfer.status)) error = 'Only an In Transit or Partially Received delivery can be accepted.';
  else if (!error && (!Number.isInteger(sent) || sent < 1 || sent * 25 !== transfer.weightKg || sent !== plan?.expected)) error = 'Sent Quantity conflicts with approved 25 kg bags. Existing quantities were preserved.';
  else if (!error && (!Number.isInteger(total) || total < 0 || total > sent)) error = `Received Bags must be a whole cumulative bag count from 0 to ${sent}.`;
  else if (!error && (received.length !== (transfer.receivedQuantity ?? received.length) || delta < 0)) error = 'Existing received quantities/history cannot be reduced or overwritten. Restore canonical references if they conflict.';
  else if (!error && total < sent && !['Missing', 'Damaged', 'Wrong Item', 'Quantity Error', 'Other'].includes(reason || '')) error = 'Select a discrepancy reason for a short delivery.';
  else if (!error && delta === 0 && (received.length > 0 || transfer.status === 'Receiving Discrepancy')) error = 'This received count is already accepted. Enter an increased cumulative total only when more physical bags arrive.';
  else if (!error && pending.some(bag => bag.availableKg !== 0 || bag.originalKg !== 25 || bag.receivedAt || bag.locationStatus !== 'Awaiting Receipt')) error = 'Existing pending bags conflict with receiving history. No records were overwritten.';
  else if (!error && bags.some(bag => bag.materialRequestRef && bag.materialRequestRef !== request.refNo)) error = 'An existing bag references another request. No references were overwritten.';
  else if (!error && bags.some(bag => source.barcodeRegistry.some(item => item.barcode.trim().toUpperCase() === bag.barcode.trim().toUpperCase() && item.itemId !== bag.id))) error = 'An existing barcode belongs to another item. No barcode was replaced.';
  return { transfer, request, received, pending, sent, delta, error };
}
