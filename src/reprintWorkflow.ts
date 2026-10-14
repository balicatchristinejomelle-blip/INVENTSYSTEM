import type { User, Role } from './types';

export type PrintableKind = 'Barcode' | 'Document';
export interface PrintableRecord {
  key: string;
  kind: PrintableKind;
  recordType: string;
  recordId: string;
  reference: string;
  value?: string;
  context?: string;
  allowedRoles: Role[];
}
export interface PrintMetadata {
  printCount: number;
  firstPrintedBy?: string;
  firstPrintedAt?: string;
  lastPrintedBy?: string;
  lastPrintedAt?: string;
}
export interface ReprintRequest {
  id: string;
  printable: PrintableRecord;
  requestedBy: string;
  requesterName: string;
  requesterRole: Role;
  requestedAt: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'USED';
  printCountBefore: number;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  usedBy?: string;
  usedAt?: string;
  printCountAfter?: number;
}
export interface PrintWorkflowState {
  printMetadata: Record<string, PrintMetadata>;
  reprintRequests: ReprintRequest[];
}
export const REPRINT_REASONS = ['Damaged printout', 'Lost copy', 'Unreadable Barcode', 'Printer issue', 'Additional authorized copy', 'Document damaged', 'Other'];
export const printAuditRole = (role: Role) => ({ OWNER_SUPER_ADMIN: 'Owner / Super Admin', accounting: 'Accounting', marketing: 'Marketing', management: 'Management', plantmanager: 'Plant Manager', production: 'Production' })[role];
export const printableKey = (kind: PrintableKind, type: string, id: string) => `${kind}:${type}:${id}`;
export const canPrint = (user: User | null, record: PrintableRecord) => !!user && user.status === 'active' && record.allowedRoles.includes(user.role);
export const canViewRequest = (user: User | null, request: ReprintRequest) => !!user && user.status === 'active' && (['management', 'OWNER_SUPER_ADMIN'].includes(user.role) || request.requestedBy === user.employeeId);
export function metadataFor(state: PrintWorkflowState, record: PrintableRecord, legacyPrinted = false): PrintMetadata {
  const stored = state.printMetadata?.[record.key];
  return { ...stored, printCount: stored?.printCount ?? (legacyPrinted ? 1 : 0) };
}
export function activeRequest(state: PrintWorkflowState, key: string) {
  return state.reprintRequests?.find(request => request.printable.key === key && ['PENDING', 'APPROVED'].includes(request.status));
}
export function printState(state: PrintWorkflowState, record: PrintableRecord, legacyPrinted = false) {
  const active = activeRequest(state, record.key);
  return active?.status === 'PENDING' ? 'REPRINT_PENDING' : active?.status === 'APPROVED' ? 'REPRINT_APPROVED' : metadataFor(state, record, legacyPrinted).printCount > 0 ? 'PRINTED' : 'NEVER_PRINTED';
}
type Result = { success: true; state: PrintWorkflowState; request?: ReprintRequest } | { success: false; error: string };
export function requestReprint(state: PrintWorkflowState, user: User | null, record: PrintableRecord, reason: string, now: string, id: string): Result {
  if (!canPrint(user, record)) return { success: false, error: 'Access Restricted' };
  if (!reason.trim()) return { success: false, error: 'Reason for Reprint is required.' };
  if (!metadataFor(state, record).printCount) return { success: false, error: 'Print the original first.' };
  if (activeRequest(state, record.key)) return { success: false, error: 'This record already has a pending or unused approved request.' };
  const request: ReprintRequest = { id, printable: record, requestedBy: user!.employeeId, requesterName: user!.name, requesterRole: user!.role, requestedAt: now, reason: reason.trim(), status: 'PENDING', printCountBefore: metadataFor(state, record).printCount };
  return { success: true, state: { printMetadata: state.printMetadata, reprintRequests: [request, ...state.reprintRequests] }, request };
}
export function reviewReprint(state: PrintWorkflowState, user: User | null, id: string, decision: 'APPROVED' | 'REJECTED', reason: string, now: string): Result {
  const request = state.reprintRequests.find(item => item.id === id);
  if (!user || user.status !== 'active' || user.role !== 'management') return { success: false, error: 'Access Restricted' };
  if (!request || request.status !== 'PENDING') return { success: false, error: 'Only a Pending request can be reviewed.' };
  if (request.requestedBy === user.employeeId) return { success: false, error: 'Approval must be completed by another authorized Management account.' };
  if (decision === 'REJECTED' && !reason.trim()) return { success: false, error: 'Rejection Reason is required.' };
  const updated: ReprintRequest = decision === 'APPROVED'
    ? { ...request, status: decision, approvedBy: user.name, approvedAt: now }
    : { ...request, status: decision, rejectedBy: user.name, rejectedAt: now, rejectionReason: reason.trim() };
  return { success: true, state: { printMetadata: state.printMetadata, reprintRequests: state.reprintRequests.map(item => item.id === id ? updated : item) }, request: updated };
}
export function validatePrint(state: PrintWorkflowState, user: User | null, record: PrintableRecord, approvalId?: string): string | null {
  if (!canPrint(user, record)) return 'Access Restricted';
  if (!metadataFor(state, record).printCount) return approvalId ? 'Approval does not match this first print.' : null;
  const request = activeRequest(state, record.key);
  if (!request || request.status !== 'APPROVED' || request.id !== approvalId || request.requestedBy !== user!.employeeId || request.printable.value !== record.value || request.printable.reference !== record.reference || request.printCountBefore !== metadataFor(state, record).printCount) return 'A specific unused Management approval for this record and requester is required.';
  return null;
}
/** Called only after the user confirms physical success, never on preview/afterprint. */
export function completePrint(state: PrintWorkflowState, user: User | null, record: PrintableRecord, now: string, approvalId?: string): Result {
  const error = validatePrint(state, user, record, approvalId);
  if (error) return { success: false, error };
  const previous = metadataFor(state, record);
  const metadata: PrintMetadata = { ...previous, printCount: previous.printCount + 1, firstPrintedBy: previous.firstPrintedBy ?? (previous.printCount === 0 ? user!.name : undefined), firstPrintedAt: previous.firstPrintedAt ?? (previous.printCount === 0 ? now : undefined), lastPrintedBy: user!.name, lastPrintedAt: now };
  const request = approvalId ? state.reprintRequests.find(item => item.id === approvalId) : undefined;
  const used = request ? { ...request, status: 'USED' as const, usedBy: user!.name, usedAt: now, printCountAfter: metadata.printCount } : undefined;
  return { success: true, state: { printMetadata: { ...state.printMetadata, [record.key]: metadata }, reprintRequests: state.reprintRequests.map(item => item.id === approvalId ? used! : item) }, request: used };
}
