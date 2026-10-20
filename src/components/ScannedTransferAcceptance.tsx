import React, { useRef, useState } from 'react';
import { useApp } from '../store';
import { exactPhysicalScan, expectedPelletError } from '../physicalScan';
import LocationSelect from './LocationSelect';
import ActionButton from './ActionButton';

/** Scans stage physical evidence only; Accept Transfer commits just those bags. */
export default function ScannedTransferAcceptance({ transferId }: { transferId: string }) {
  const app = useApp();
  const [barcode, setBarcode] = useState(''), [location, setLocation] = useState(''), [scans, setScans] = useState<string[]>([]), [feedback, setFeedback] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const transfer = app.transfers.find(item => item.id === transferId);
  const request = app.materialRequests.find(item => item.refNo === transfer?.requestRef);
  if (app.currentUser?.role !== 'plantmanager' || !transfer || request?.status !== 'Approved' || !['In Transit', 'Receiving Discrepancy'].includes(transfer.status)) return null;
  const scan = () => {
    const bag = app.pellets.find(item => exactPhysicalScan({ shift: app.currentShift, scannerMode: 'Receive Pellets', barcode }, item, app.pellets));
    const error = !bag || bag.transferRef !== transfer.refNo || bag.batchNo !== transfer.batchNo ? 'Barcode does not belong to this expected delivery.' : expectedPelletError(bag, app.transfers, app.materialRequests);
    if (error) setFeedback(error);
    else if (scans.includes(bag!.barcode)) setFeedback('Duplicate scan. This bag is already in the scanned list.');
    else { setScans(current => [...current, bag!.barcode]); setFeedback('Expected bag scanned. Stock is unchanged until Accept Transfer.'); }
    setBarcode(''); input.current?.focus();
  };
  const accept = () => {
    const result = app.acceptScannedPelletTransfer(transferId, scans, location);
    setFeedback(result.success ? `${scans.length} scanned bags accepted (${scans.length * 25} kg) at ${location}. Unscanned bags remain pending.` : result.error || 'Receipt blocked.');
    if (result.success) setScans([]);
    input.current?.focus();
  };
  return <div className="page-stack" style={{ whiteSpace: 'normal' }}>
    <p className="helper-text">Scan bags individually, select Location A-I, then Accept Transfer. Zero scans cannot be accepted. A short delivery remains Partially Received / Receiving Discrepancy; Sent Quantity is unchanged.</p>
    <label className="block-label">Scan Pellet Bag Barcode<input ref={input} className="app-input font-mono" aria-label="Scan Pellet Bag Barcode" autoComplete="off" value={barcode} onChange={event => setBarcode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); scan(); } }} placeholder="Scan one physical bag + Enter" /></label>
    <button className="btn-secondary" onClick={scan}>Validate Bag Scan</button>
    <div className="helper-text">Scanned this delivery: {scans.length} bags / {scans.length * 25} kg</div>
    {scans.map(value => <div key={value} className="button-group"><span className="font-mono">{value}</span><button className="btn-secondary btn-compact" onClick={() => setScans(current => current.filter(item => item !== value))} aria-label={`Remove scanned ${value}`}>Remove</button></div>)}
    <LocationSelect value={location} onChange={setLocation} />
    <ActionButton className="btn-success" confirmMessage={`Accept ${scans.length} scanned bags at ${location || 'an unselected location'}? Only these bags become Stock In.`} onClick={accept}>Accept Transfer</ActionButton>
    {!scans.length && <div className="helper-text">Scan at least one expected bag before Accept Transfer.</div>}
    {feedback && <div className="alert-info" role="status">{feedback}</div>}
  </div>;
}
