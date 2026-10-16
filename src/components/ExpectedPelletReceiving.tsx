import React, { useState } from 'react';
import { useApp } from '../store';
import { exactPhysicalScan, expectedPelletError } from '../physicalScan';
import LocationSelect from './LocationSelect';
import PrintAction from './PrintAction';
import { printableRecords } from '../printableRecords';
import { printBarcodeBatch } from './BarcodeLabel';

/** Same expected bag records used for approved labels and physical receiving. */
export default function ExpectedPelletReceiving({ transferId }: { transferId: string }) {
  const app = useApp();
  const [barcode, setBarcode] = useState(''), [verified, setVerified] = useState('');
  const [location, setLocation] = useState(''), [feedback, setFeedback] = useState('');
  const transfer = app.transfers.find(item => item.id === transferId);
  if (!transfer || !['Preparing', 'In Transit', 'Received'].includes(transfer.status)) return null;
  const bags = app.pellets.filter(item => item.transferRef === transfer.refNo && item.batchNo === transfer.batchNo);
  const scan = () => {
    const bag = bags.find(item => exactPhysicalScan({ shift: app.currentShift, scannerMode: 'Receive Pellets', barcode }, item, app.pellets));
    const error = bag ? expectedPelletError(bag, app.transfers, app.materialRequests) : 'Barcode is not an expected bag for this delivery.';
    setVerified(error ? '' : barcode);setFeedback(error || 'Expected bag verified. Confirm its physical receiving location.');
  };
  const receive = () => {
    const bag = bags.find(item => exactPhysicalScan({ shift: app.currentShift, scannerMode: 'Receive Pellets', barcode: verified }, item, app.pellets));
    const saved = bag && app.receivePellet(bag.id, { shift: app.currentShift, scannerMode: 'Receive Pellets', barcode: verified }, location);
    setFeedback(saved ? `${bag.barcode}: 25 kg received at ${location}.` : 'Receipt blocked. Re-scan an approved, unreceived bag and select Location A–I.');
    if (saved) { setBarcode('');setVerified(''); }
  };
  return <section className="page-stack">
    <h3 className="section-title">Expected Pellet Bags / Physical Receiving</h3>
    <p className="helper-text">{bags.filter(bag => bag.inventoryStatus !== 'Pending Receipt').length} / {bags.length} bags received. Approval and labels do not add stock.</p>
    <div className="table-scroll"><table className="app-table"><thead><tr><th>Physical barcode</th><th>Weight</th><th>Status</th><th>Label</th></tr></thead><tbody>{bags.map(bag => {
      const printable = printableRecords(app).find(record => record.kind === 'Barcode' && record.recordId === bag.id);
      return <tr key={bag.id}><td>{bag.barcode}</td><td>25 kg</td><td>{bag.inventoryStatus === 'Pending Receipt' ? 'Expected / Awaiting Receiving' : bag.inventoryStatus}</td><td>{printable && <PrintAction record={printable} onPreview={() => printBarcodeBatch([{ value: bag.barcode, recordId: bag.id, recordLabel: bag.bagNo }]).length === 1} />}</td></tr>;
    })}</tbody></table></div>
    {transfer.status === 'In Transit' && <><label className="block-label">Scan Pellet Bag Barcode<input className="app-input font-mono" aria-label="Scan Pellet Bag Barcode" autoComplete="off" value={barcode} onChange={event => { setBarcode(event.target.value);setVerified(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault();scan(); } }} placeholder="Scan one physical bag + Enter" /></label><button className="btn-secondary" onClick={scan}>Validate Bag Scan</button><LocationSelect value={location} onChange={setLocation} /><button className="btn-success" disabled={!verified || !location} onClick={receive}>Confirm Scanned Bag Receipt</button></>}
    {feedback && <div role="status" className="alert-info">{feedback}</div>}
  </section>;
}
