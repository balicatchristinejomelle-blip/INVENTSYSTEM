import type { MaterialRequest, PelletInventory, Transfer } from './types';
import { linkedMaterialRequest, approvedMaterialRequest } from './materialRequestLink';

type Source = { materialRequests: MaterialRequest[]; pellets: PelletInventory[]; transfers: Transfer[] };
export function requestPelletBags(source: Source, request: MaterialRequest) {
  const transfers = source.transfers.filter(item => linkedMaterialRequest(source.materialRequests, item.requestRef)?.id === request.id);
  return source.pellets.filter(bag => linkedMaterialRequest(source.materialRequests, bag.materialRequestRef)?.id === request.id
    || transfers.some(transfer => bag.transferRef === transfer.refNo && bag.batchNo === transfer.batchNo));
}

/** Read-only plan: never infer ownership from material alone or repair conflicting history. */
export function expectedPelletPlan(source: Source, requestId: string) {
  const request = source.materialRequests.find(item => item.id === requestId);
  const bags = request ? requestPelletBags(source, request) : [];
  const expected = request?.requestedBags ?? (request?.requestedKg || 0) / 25;
  const transfers = request ? source.transfers.filter(item => linkedMaterialRequest(source.materialRequests, item.requestRef)?.id === request.id) : [];
  const transfer = transfers[0];
  const batchNo = transfer?.batchNo || bags[0]?.batchNo || `EXPECTED-${request?.refNo || ''}`;
  let error = '';
  if (!request || !approvedMaterialRequest(request)) error = 'Only Approved Material Requests have printable expected bag labels.';
  else if (request.materialCategory === 'Colorant') error = 'Colorant requests do not use 25 kg pellet bag labels.';
  else if (request.materialCategory && request.materialCategory !== `${request.pelletType} Pellet`) error = 'Approved material category and pellet type conflict. No labels were added.';
  else if (linkedMaterialRequest(source.materialRequests, request.refNo)?.id !== request.id || transfers.length > 1) error = 'Ambiguous request/transfer references. Existing records were preserved; reconcile the references first.';
  else if (!Number.isInteger(expected) || expected < 1 || request.requestedKg !== expected * 25) error = 'Approved bag count must match complete 25 kg bags. Existing quantities were not changed.';
  else if (bags.length > expected) error = 'Existing bag count exceeds the approved quantity. No bags were replaced or deleted.';
  else if (bags.some(bag => !bag.barcode || bag.batchNo !== batchNo || bag.type !== request.pelletType || bag.grade !== request.grade || bag.color !== request.color
    || (bag.originalKg !== undefined && bag.originalKg !== 25)
    || (bag.transferRef && bag.transferRef !== transfer?.refNo)
    || source.pellets.filter(item => item.id === bag.id || item.barcode.trim().toUpperCase() === bag.barcode.trim().toUpperCase()).length !== 1)) error = 'Existing bag identity, material or batch conflicts with this request. No barcode was replaced.';
  else if (transfer && ((transfer.numberOfBags !== undefined && transfer.numberOfBags !== expected) || transfer.weightKg !== request.requestedKg)) error = 'Transfer quantities differ from the approved request. Existing quantities were preserved.';
  else if (transfer?.status === 'Received' && bags.length < expected) error = 'Completed transfer has missing physical bag records. Restore its canonical history before adding labels.';
  return { request, bags, expected, missing: Math.max(0, expected - bags.length), transfer, batchNo, error };
}
