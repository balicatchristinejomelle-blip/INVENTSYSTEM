import type { User, Notification, AuditLog } from './types';
import { printableRecords, type PrintableSource } from './printableRecords';
import { hydratePrintWorkflow } from './printableRecords';
import { printAuditRole, type ReprintRequest, type PrintWorkflowState } from './reprintWorkflow';

/** Fresh demo state only. Existing saved application data is never reseeded or reset. */
export function seedReprintSamples(source: PrintableSource, users: User[]): PrintWorkflowState & { notifications: Notification[]; auditLogs: AuditLog[] } {
  const workflow = hydratePrintWorkflow(source, {});
  const records = printableRecords(source);
  const manager = users.find(user => user.role === 'management')!;
  const definitions = [
    { type: 'PRODUCTION ORDER', status: 'PENDING', role: 'plantmanager', reason: 'Printer issue' },
    { type: 'Finished Pipe', status: 'APPROVED', role: 'plantmanager', reason: 'Unreadable Barcode' },
    { type: 'RECEIVING REPORT', status: 'USED', role: 'accounting', reason: 'Damaged printout' },
    { type: 'CUSTOMER ORDER', status: 'REJECTED', role: 'marketing', reason: 'Additional authorized copy' },
  ] as const;
  const notifications: Notification[] = [];
  const auditLogs: AuditLog[] = [];
  for (const [index, definition] of definitions.entries()) {
    const record = records.find(item => item.recordType === definition.type);
    const user = users.find(item => item.role === definition.role);
    if (!record || !user || !manager) continue;
    const initialAt = '2026-10-13T09:00:00+08:00';
    const requestedAt = '2026-10-13T10:00:00+08:00';
    const reviewedAt = '2026-10-13T10:15:00+08:00';
    const usedAt = '2026-10-13T10:30:00+08:00';
    const request: ReprintRequest = { id: `RP-DEMO-2026-000${index + 1}`, printable: record, requestedBy: user.employeeId, requesterName: user.name, requesterRole: user.role, requestedAt, reason: definition.reason, status: definition.status, printCountBefore: 1 };
    if (definition.status === 'APPROVED' || definition.status === 'USED') Object.assign(request, { approvedBy: manager.name, approvedAt: reviewedAt });
    if (definition.status === 'USED') Object.assign(request, { usedBy: user.name, usedAt, printCountAfter: 2 });
    if (definition.status === 'REJECTED') Object.assign(request, { rejectedBy: manager.name, rejectedAt: reviewedAt, rejectionReason: 'Existing authorized copy is still usable. Please confirm the need before requesting another copy.' });
    workflow.reprintRequests.push(request);
    workflow.printMetadata[record.key] = { printCount: definition.status === 'USED' ? 2 : 1, firstPrintedBy: user.name, firstPrintedAt: initialAt, lastPrintedBy: user.name, lastPrintedAt: definition.status === 'USED' ? usedAt : initialAt };
    const events = [
      { action: 'Initial Print', at: initialAt, actor: user },
      { action: 'Reprint Requested', at: requestedAt, actor: user },
      ...(definition.status !== 'PENDING' ? [{ action: definition.status === 'REJECTED' ? 'Reprint Rejected' : 'Reprint Approved', at: reviewedAt, actor: manager }] : []),
      ...(definition.status === 'USED' ? [{ action: `${record.kind} Reprinted`, at: usedAt, actor: user }] : []),
    ];
    events.forEach((event, eventIndex) => auditLogs.push({ id: `print-demo-${index}-${eventIndex}`, date: event.at.slice(0, 10), time: event.at.slice(11, 19), user: event.actor.name, employeeId: event.actor.employeeId, role: printAuditRole(event.actor.role), action: event.action, reference: record.reference, newValue: `${record.key} · ${request.id} · ${request.reason}` }));
    if (definition.status === 'PENDING') notifications.push({ id: 'reprint-demo-pending', title: 'Reprint Approval Requested', description: `${record.reference} · Requested by ${user.name} · ${request.reason}`, datetime: requestedAt, priority: 'Action Required', read: false, roles: ['management'], reference: record.reference, reprintRequestId: request.id });
    if (definition.status === 'APPROVED' || definition.status === 'REJECTED') notifications.push({ id: `reprint-demo-${definition.status}`, title: definition.status === 'APPROVED' ? 'Reprint Approved' : 'Reprint Request Rejected', description: `${record.reference} · ${definition.status === 'APPROVED' ? 'Management approved one Reprint.' : request.rejectionReason}`, datetime: reviewedAt, priority: 'Information', read: false, roles: [user.role], recipientEmployeeId: user.employeeId, reference: record.reference, reprintRequestId: request.id });
  }
  return { ...workflow, notifications, auditLogs };
}
