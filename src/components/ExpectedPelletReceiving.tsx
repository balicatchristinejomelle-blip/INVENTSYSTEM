import React from 'react';
import { useApp } from '../store';
import PrintAction from './PrintAction';
import { printableRecords } from '../printableRecords';
import { printBarcodeBatch } from './BarcodeLabel';
import CountedTransferAcceptance from './CountedTransferAcceptance';
import RequestPelletBarcodeButton from './RequestPelletBarcodes';
import { linkedMaterialRequest, approvedMaterialRequest } from '../materialRequestLink';

/** Same expected bag records used for approved labels and physical receiving. */
export default function ExpectedPelletReceiving({ transferId }: { transferId: string }) {
  const app = useApp();
  const transfer = app.transfers.find(item => item.id === transferId);
  if (!transfer || !['Preparing', 'In Transit', 'Receiving Discrepancy', 'Received'].includes(transfer.status)) return null;
  const bags = app.pellets.filter(item => item.transferRef === transfer.refNo && item.batchNo === transfer.batchNo && item.inventoryStatus !== 'Pending Receipt');
  const received = transfer.receivedQuantity ?? bags.length;
  const request = linkedMaterialRequest(app.materialRequests, transfer.requestRef);
  const expected = transfer.sentQuantity ?? transfer.numberOfBags ?? bags.length;
  const remaining = Math.max(0, expected - received);
  return <section className="page-stack">
    <CountedTransferAcceptance key={transfer.id} transferId={transfer.id} />
    {!approvedMaterialRequest(request) && <div className="alert-warning" role="status">This delivery needs an Approved Material Request before receiving or label printing. Existing records are unchanged.</div>}
    {approvedMaterialRequest(request) && transfer.status === 'Preparing' && <div className="alert-info" role="status">Waiting for Accounting dispatch. Count and accept this delivery when it is In Transit.</div>}
    {received > 0 ? <>
    <div className="alert-info" role="status">Accepted receipt: {received} of {expected} bags · {received * 25} kg. Remaining: {remaining} bags / {remaining * 25} kg. Labels are available for accepted bags below.</div>
    <div className="button-group"><RequestPelletBarcodeButton request={request} /></div>
    <details><summary>Accepted Bags / Label History ({bags.length})</summary>
    <div className="table-scroll"><table className="app-table"><thead><tr><th>Physical barcode</th><th>Weight</th><th>Status</th><th>Label</th></tr></thead><tbody>{bags.map(bag => {
      const printable = printableRecords(app).find(record => record.kind === 'Barcode' && record.recordId === bag.id);
      return <tr key={bag.id}><td>{bag.inventoryStatus === 'Pending Receipt' ? 'Existing expected record (not received)' : bag.barcode}</td><td>25 kg</td><td>{bag.inventoryStatus === 'Pending Receipt' ? 'Expected / Awaiting Receiving' : bag.inventoryStatus}</td><td style={{ whiteSpace: 'normal' }}>{bag.inventoryStatus !== 'Pending Receipt' && printable && <PrintAction record={printable} onPreview={() => printBarcodeBatch([{ value: bag.barcode, recordId: bag.id, recordLabel: bag.bagNo }]).length === 1} />}</td></tr>;
    })}</tbody></table></div></details>
    </> : <p className="helper-text">Sent: {expected} bags. Count the unloaded delivery and accept the received quantity above. Its labels and inventory are created after acceptance; no pellet scan is required.</p>}
  </section>;
}
