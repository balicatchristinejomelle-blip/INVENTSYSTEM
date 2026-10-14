import React, { useEffect, useState } from 'react';
import { useApp } from '../store';
import { canViewRequest, metadataFor, type ReprintRequest } from '../reprintWorkflow';
import { documentFor, printableRecords } from '../printableRecords';
import Modal, { ConfirmModal } from './Modal';
import AccessRestricted from './AccessRestricted';
import Pagination, { pageRecords } from './Pagination';
import SearchableSelect from './SearchableSelect';
import { matchesRecord } from './RecordSearch';
import { RecordHistory } from './RecordContext';
import BarcodeLabel from './BarcodeLabel';
import DocumentViewer from './DocumentViewer';

export default function ReprintApprovals({ monitor = false, search: pageSearch }: { monitor?: boolean; search?: string }) {
  const app = useApp();
  const [localSearch, setSearch] = useState('');
  const search = pageSearch ?? localSearch;
  const [status, setStatus] = useState('All');
  const [kind, setKind] = useState('All');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, status, kind]);
  if (app.currentUser?.status !== 'active' || (monitor ? app.currentUser?.role !== 'OWNER_SUPER_ADMIN' : app.currentUser?.role !== 'management')) return <AccessRestricted />;
  const filtered = app.reprintRequests.filter(request => (status === 'All' || request.status === status) && (kind === 'All' || request.printable.kind === kind) && matchesRecord(request, search));
  const safePage = Math.max(1, Math.min(page, Math.ceil(filtered.length / 10)));
  return <section className="page-stack reprint-section">
    <div className="section-title">{monitor ? 'Reprint Requests & History — read-only' : 'Reprint Approvals'}</div>
    <div className="reprint-filters">{pageSearch === undefined && <input className="app-input" aria-label="Search reprint requests" placeholder="Search request, barcode, PO, employee, reason, status, date…" value={search} onChange={event => setSearch(event.target.value)} />}<SearchableSelect value={status} onChange={setStatus} options={['All', 'PENDING', 'APPROVED', 'REJECTED', 'USED']} placeholder="Status" ariaLabel="Reprint status" /><SearchableSelect value={kind} onChange={setKind} options={['All', 'Barcode', 'Document']} placeholder="Type" ariaLabel="Printable type" /></div>
    <div className="table-container"><table className="app-table"><thead><tr><th>Request ID</th><th>Record Type / Reference</th><th>Requested By / Role</th><th>Reason</th><th>Previous Count</th><th>Requested At</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageRecords(filtered, safePage).map(request => <tr key={request.id}><td>{request.id}</td><td>{request.printable.recordType}<br />{request.printable.reference}{request.printable.value && <div>{request.printable.value}</div>}</td><td>{request.requesterName}<br />{request.requesterRole}</td><td>{request.reason}</td><td>{request.printCountBefore}</td><td>{new Date(request.requestedAt).toLocaleString()}</td><td>{request.status}</td><td><button className="btn-secondary btn-compact" onClick={() => app.openReprintRequest(request.id)}>{!monitor && request.status === 'PENDING' ? 'Review' : 'View Request'}</button></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state">No matching Reprint Requests.</div>}</div>
    <Pagination page={safePage} totalRecords={filtered.length} onPageChange={setPage} noun="requests" />
  </section>;
}

/** Mounted once in the shell: notifications and all authorized views open the exact request. */
export function ReprintRequestDialog() {
  const app = useApp();
  const request = app.reprintRequests.find(item => item.id === app.selectedReprintRequestId);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  useEffect(() => { setDecision(null); setReason(''); setError(''); setPrinting(false); setConfirmation(false); }, [app.selectedReprintRequestId]);
  if (!request || !canViewRequest(app.currentUser, request)) return null;
  const record = printableRecords(app).find(item => item.key === request.printable.key);
  const metadata = metadataFor(app, request.printable);
  const self = request.requestedBy === app.currentUser?.employeeId;
  const management = app.currentUser?.role === 'management';
  const review = () => {
    if (!decision) return;
    const result = app.decideReprintRequest(request.id, decision, reason);
    if (!result.success) { setError(result.error || 'Review failed.'); setDecision(null); setConfirmation(false); }
    else { setDecision(null); setConfirmation(false); setError(''); }
  };
  const history = app.auditLogs.filter(log => log.newValue === request.printable.key || log.newValue?.startsWith(`${request.printable.key} ·`)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).map(log => ({ id: log.id, datetime: `${log.date} ${log.time}`, title: log.action, description: log.newValue, actor: log.user }));
  const close = () => { app.openReprintRequest(null); setPrinting(false); };
  return <div className="reprint-dialog">
    <Modal open={!printing && !decision} onClose={close} title="REPRINT REQUEST" width="680px">
      <RequestFields request={request} firstPrintedAt={metadata.firstPrintedAt} lastPrintedAt={metadata.lastPrintedAt} count={metadata.printCount} />
      {request.rejectionReason && <div className="alert-error">Rejection Reason: {request.rejectionReason}</div>}
      {management && self && request.status === 'PENDING' && <div className="alert-error">Approval must be completed by another authorized Management account.</div>}
      {error && <div className="alert-error" role="alert">{error}</div>}
      {management && !self && request.status === 'PENDING' && <div className="form-actions"><button className="btn-danger" onClick={() => { setReason(''); setDecision('REJECTED'); }}>Reject</button><button className="btn-primary" onClick={() => { setDecision('APPROVED'); setConfirmation(true); }}>Approve Reprint</button></div>}
      {self && request.status === 'APPROVED' && record?.allowedRoles.includes(app.currentUser!.role) && <button className="btn-primary" onClick={() => setPrinting(true)}>Reprint Now</button>}
      <RecordHistory events={history} />
    </Modal>
    <Modal open={decision === 'REJECTED' && !confirmation} title="Reject Reprint" onClose={() => setDecision(null)}>
      <label className="form-label">Rejection Reason *<textarea className="app-input" value={reason} onChange={event => setReason(event.target.value)} /></label>
      <div className="form-actions"><button className="btn-secondary" onClick={() => setDecision(null)}>Cancel</button><button className="btn-danger" disabled={!reason.trim()} onClick={() => setConfirmation(true)}>Review Rejection</button></div>
    </Modal>
    <ConfirmModal open={confirmation} title={decision === 'APPROVED' ? 'APPROVE REPRINT?' : 'REJECT REPRINT?'} message={`${request.printable.reference} · Requested by ${request.requesterName} · Reason: ${decision === 'REJECTED' ? reason : request.reason}. ${decision === 'APPROVED' ? 'This approval authorizes ONE Reprint. Nothing will print now.' : 'The requester cannot Reprint.'}`} confirmLabel={decision === 'APPROVED' ? 'Approve' : 'Reject'} onCancel={() => { setConfirmation(false); setDecision(null); }} onConfirm={review} />
    {printing && record?.kind === 'Document' && <DocumentViewer open document={documentFor(app, record)} onClose={close} />}
    {printing && record?.kind === 'Barcode' && <Modal open onClose={close} title={`Approved label · ${record.reference}`}><BarcodeLabel value={record.value!} recordId={record.recordId} recordLabel={record.reference} /></Modal>}
  </div>;
}
function RequestFields({ request, firstPrintedAt, lastPrintedAt, count }: { request: ReprintRequest; firstPrintedAt?: string; lastPrintedAt?: string; count: number }) {
  return <div className="reprint-fields"><span>Request ID: {request.id}</span><span>Record Type: {request.printable.recordType} ({request.printable.kind})</span><span>Reference: {request.printable.reference}</span>{request.printable.value && <span>Barcode: {request.printable.value}</span>}<span>Requested By: {request.requesterName} ({request.requestedBy})</span><span>Requester Role: {request.requesterRole}</span><span>Requested At: {new Date(request.requestedAt).toLocaleString()}</span><span>First Printed At: {firstPrintedAt || 'Not recorded in legacy data'}</span><span>Last Printed At: {lastPrintedAt || 'Not recorded in legacy data'}</span><span>Current Print Count: {count}</span><span>Reason: {request.reason}</span><span>Status: {request.status}</span>{request.approvedBy && <span>Approved By: {request.approvedBy} · {request.approvedAt}</span>}{request.rejectedBy && <span>Rejected By: {request.rejectedBy} · {request.rejectedAt}</span>}{request.usedBy && <span>Reprint Used By: {request.usedBy} · {request.usedAt} · Print Count After: {request.printCountAfter}</span>}</div>;
}
