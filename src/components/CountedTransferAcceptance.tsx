import React, { useState } from 'react';
import { useApp } from '../store';
import type { Transfer } from '../types';
import LocationSelect from './LocationSelect';
import SearchableDropdown from './SearchableDropdown';
import ActionButton from './ActionButton';

/** Plant Manager counts unloaded bags; Production scans their labels later for WIP. */
export default function CountedTransferAcceptance({ transferId }: { transferId: string }) {
  const app = useApp();
  const transfer = app.transfers.find(item => item.id === transferId);
  const [count, setCount] = useState(''), [location, setLocation] = useState('');
  const [reason, setReason] = useState<Transfer['discrepancyReason'] | ''>(''), [notes, setNotes] = useState(''), [feedback, setFeedback] = useState('');
  const [receiptError, setReceiptError] = useState(false);
  const request = app.materialRequests.find(item => item.refNo === transfer?.requestRef);
  if (app.currentUser?.role !== 'plantmanager' || !transfer || request?.status !== 'Approved' || !['In Transit', 'Receiving Discrepancy'].includes(transfer.status)) return null;
  const sent = transfer.sentQuantity ?? transfer.numberOfBags ?? 0, received = transfer.receivedQuantity || 0;
  const total = count === '' ? NaN : Number(count), missing = Number.isFinite(total) ? sent - total : sent - received;
  const short = Number.isInteger(total) && total >= received && total < sent;
  const accept = () => {
    const result = app.acceptCountedPelletTransfer(transferId, total, location, reason || undefined, notes);
    setReceiptError(!result.success);
    setFeedback(result.success ? `${total} / ${sent} bags received. Missing: ${missing} bags / ${missing * 25} kg. Accepted bags are in inventory with labels ready to view/print.` : result.error || 'Receipt blocked.');
    if (result.success) setCount('');
  };
  return <section className="page-stack" style={{ whiteSpace: 'normal' }}>
    <h3 className="section-title">Count Physical Bags / Accept Transfer</h3>
    <p className="helper-text">Unload and count the bags. No receiving scan is required. Enter the cumulative received total; already accepted bags remain unchanged. Labels are generated only for accepted bags. Production scans their labels when loading WIP.</p>
    <div className="helper-text">Sent: {sent} bags · Already accepted: {received} bags · Missing after this acceptance: {missing} bags</div>
    <label className="block-label">Received Bags (Cumulative Total)<input className="app-input" aria-label="Received Bags (Cumulative Total)" autoFocus type="number" min={received} max={sent} step="1" value={count} onChange={event => { setCount(event.target.value); setFeedback(''); }} placeholder={`Enter counted total (${received}-${sent})`} /></label>
    <LocationSelect value={location} onChange={value => { setLocation(value); setFeedback(''); }} />
    {short && <><label className="block-label">Discrepancy Reason<SearchableDropdown className="app-select" aria-label="Discrepancy Reason" value={reason} onChange={event => { setReason(event.target.value as typeof reason); setFeedback(''); }}><option value="">Required when short</option>{['Missing', 'Damaged', 'Wrong Item', 'Quantity Error', 'Other'].map(value => <option key={value}>{value}</option>)}</SearchableDropdown></label>
    <label className="block-label">Discrepancy Notes<textarea className="app-input" value={notes} onChange={event => { setNotes(event.target.value); setFeedback(''); }} /></label></>}
    <ActionButton className="btn-success" confirmMessage={`Accept a cumulative ${count || 'unentered'} of ${sent} bags at ${location || 'an unselected location'}? Only newly accepted bags become stock and receive labels.`} onClick={accept}>Accept Transfer</ActionButton>
    {feedback && <div className={receiptError ? 'alert-error' : 'alert-info'} role={receiptError ? 'alert' : 'status'}>{feedback}</div>}
  </section>;
}
