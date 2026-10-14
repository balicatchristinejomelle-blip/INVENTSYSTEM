import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { activeRequest, canPrint, metadataFor, printState, REPRINT_REASONS, type PrintableRecord } from '../reprintWorkflow';
import Modal, { ConfirmModal } from './Modal';
import SearchableSelect from './SearchableSelect';

/** A print session is locked before opening the browser dialog and completed only by explicit success confirmation. */
function usePrintSession(records: PrintableRecord[], onPreview: () => boolean | void, approvalId?: string) {
  const { beginPrint, finishPrint } = useApp();
  const ticket = useRef<string | null>(null);
  const starting = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [awaitingResult, setAwaitingResult] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (ticket.current) finishPrint(ticket.current, false); }; }, []);
  const start = async () => {
    if (ticket.current || starting.current) return;
    starting.current = true;
    setBusy(true);
    const result = await beginPrint(records.map(record => record.key), approvalId);
    starting.current = false;
    if (!mounted.current) { if (result.ticket) finishPrint(result.ticket, false); return; }
    if (!result.success) { setBusy(false); setError(result.error || 'Print could not start.'); return; }
    ticket.current = result.ticket!;
    setBusy(true);
    setError('');
    try {
      if (onPreview() === false) { finishPrint(ticket.current, false); ticket.current = null; setBusy(false); setError('Print preview was blocked or could not be prepared. Nothing was recorded.'); }
      else setAwaitingResult(true);
    } catch {
      if (ticket.current) finishPrint(ticket.current, false); ticket.current = null; setBusy(false); setError('Printer issue. Nothing was recorded; the approval remains unused.');
    }
  };
  const complete = (successful: boolean) => {
    if (!ticket.current) return;
    const result = finishPrint(ticket.current, successful);
    ticket.current = null;
    setBusy(false);
    setAwaitingResult(false);
    if (!result.success) setError(result.error || 'Print could not be recorded.');
  };
  const dialog = <Modal open={awaitingResult} title="Confirm actual print result" onClose={() => complete(false)}>
    <p className="helper-text">Opening preview does not record a print. Confirm only after the physical print completed successfully. A cancelled or failed print keeps approval unused.</p>
    <div className="form-actions"><button className="btn-secondary" onClick={() => complete(false)}>Cancelled / failed</button><button className="btn-primary" onClick={() => complete(true)}>Print completed successfully</button></div>
  </Modal>;
  return { start, busy, error, dialog };
}

export default function PrintAction({ record, onPreview, autoStart = false }: { record: PrintableRecord; onPreview: () => boolean | void; autoStart?: boolean }) {
  const app = useApp();
  const [requestOpen, setRequestOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [error, setError] = useState('');
  const sent = useRef(false);
  const autoOpened = useRef(false);
  const metadata = metadataFor(app, record);
  const active = activeRequest(app, record.key);
  const status = printState(app, record);
  const session = usePrintSession([record], onPreview, active?.status === 'APPROVED' ? active.id : undefined);
  const authorized = canPrint(app.currentUser, record);
  const actionableApproval = active?.status === 'APPROVED' && active.requestedBy === app.currentUser?.employeeId;
  const action = () => {
    if (session.busy || !authorized) return;
    if (metadata.printCount === 0) session.start();
    else if (actionableApproval) setConfirm(true);
    else if (active) app.openReprintRequest(active.id);
    else { setReason(''); setOtherReason(''); setError(''); sent.current = false; setRequestOpen(true); }
  };
  useEffect(() => {
    if (autoStart && !autoOpened.current) { autoOpened.current = true; action(); }
  }, [autoStart]);
  const submit = () => {
    if (sent.current) return;
    const detail = reason === 'Other' ? otherReason.trim() : reason.trim();
    if (!detail) { setError('Reason for Reprint is required.'); return; }
    sent.current = true;
    const result = app.submitReprintRequest(record.key, detail);
    if (result.success) setRequestOpen(false);
    else { sent.current = false; setError(result.error || 'Request could not be submitted.'); }
  };
  const lastRejected = app.reprintRequests.find(item => item.printable.key === record.key && item.status === 'REJECTED');
  return <div className="reprint-action print-hidden">
    <div className="helper-text">{status.replace(/_/g, ' ')} · Print count: {metadata.printCount}{metadata.lastPrintedAt && ` · Last printed: ${new Date(metadata.lastPrintedAt).toLocaleString()}`}</div>
    {authorized && <button className="btn-primary" disabled={session.busy} onClick={action}>{session.busy ? 'Preparing Print…' : metadata.printCount === 0 ? 'Print' : actionableApproval ? 'Reprint' : active ? 'View Request' : 'Request Reprint'}</button>}
    {active && !actionableApproval && <div className="helper-text">{active.status === 'PENDING' ? 'Reprint Pending — Management approval required.' : 'Reprint approved for the original requester only.'}</div>}
    {!active && lastRejected && <div className="helper-text">Last request rejected: {lastRejected.rejectionReason}</div>}
    {(error || session.error) && <div role="alert" className="alert-error">{error || session.error}</div>}
    <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="REPRINT REQUEST">
      <div className="reprint-fields"><span>Record Type: {record.recordType}</span><span>Reference: {record.reference}</span>{record.value && <span>Barcode: {record.value}</span>}<span>Original Print Date: {metadata.firstPrintedAt || 'Not recorded in legacy data'}</span><span>Previous Print Count: {metadata.printCount}</span><span>Requested By: {app.currentUser?.name}</span><span>Requester Role: {app.currentUser?.role}</span><span>Requested At: recorded on submission</span></div>
      <label className="form-label">Reason for Reprint *</label><SearchableSelect value={reason} onChange={setReason} options={REPRINT_REASONS.map(value => ({ value, label: value }))} placeholder="Select reason" ariaLabel="Reason for Reprint" menuClassName="reprint-select-menu" />
      {reason === 'Other' && <label className="form-label">Specify Reason *<textarea className="app-input" value={otherReason} onChange={event => setOtherReason(event.target.value)} /></label>}
      {error && <div role="alert" className="alert-error">{error}</div>}
      <div className="form-actions"><button className="btn-secondary" onClick={() => setRequestOpen(false)}>Cancel</button><button className="btn-primary" onClick={submit}>Submit Request</button></div>
    </Modal>
    <ConfirmModal open={confirm} title={`REPRINT ${record.kind.toUpperCase()}?`} message={`${record.value || record.reference}. Management Approval: Approved. This approval may be used for one Reprint only.`} confirmLabel="Reprint" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); session.start(); }} />
    {session.dialog}
  </div>;
}

export function BatchPrintAction({ records, onPreview, label }: { records: PrintableRecord[]; onPreview: () => boolean; label: string }) {
  const session = usePrintSession(records, onPreview);
  return <div className="reprint-action"><button className="btn-primary" disabled={!records.length || session.busy} onClick={session.start}>{session.busy ? 'Preparing Print…' : `${label} (${records.length})`}</button>{session.error && <div role="alert" className="alert-error">{session.error}</div>}{session.dialog}</div>;
}
