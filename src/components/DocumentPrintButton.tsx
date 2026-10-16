import React from 'react';
import { useApp } from '../store';
import { printableRecords } from '../printableRecords';
import { activeRequest, metadataFor, canPrint } from '../reprintWorkflow';

/** Entry points open the existing viewer, whose PrintAction enforces the same guard. */
export default function DocumentPrintButton({ recordId, recordType, onClick, className = 'btn-primary' }: { recordId: string; recordType: string; onClick: () => void; className?: string }) {
  const app = useApp();
  const record = printableRecords(app).find(item => item.kind === 'Document' && item.recordId === recordId && item.recordType === recordType);
  if (!record || !canPrint(app.currentUser, record)) return null;
  const request = activeRequest(app, record.key);
  const label = metadataFor(app, record).printCount === 0 ? 'Print' : request?.status === 'APPROVED' && request.requestedBy === app.currentUser?.employeeId ? 'Reprint' : request ? 'View Request' : 'Request Reprint';
  return <span className="reprint-document-entry">{request && <span className={request.status === 'PENDING' ? 'badge-amber' : 'badge-green'}>{request.status === 'PENDING' ? 'Reprint Pending' : 'Reprint Approved'}</span>}<button className={className} onClick={() => request && label === 'View Request' ? app.openReprintRequest(request.id) : onClick()}>{label}</button></span>;
}
