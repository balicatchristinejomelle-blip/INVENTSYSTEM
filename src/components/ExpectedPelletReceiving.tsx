import React from 'react';
import { useApp } from '../store';
import PrintAction from './PrintAction';
import { printableRecords } from '../printableRecords';
import { printBarcodeBatch } from './BarcodeLabel';
import ScannedTransferAcceptance from './ScannedTransferAcceptance';

/** Same expected bag records used for approved labels and physical receiving. */
export default function ExpectedPelletReceiving({ transferId }: { transferId: string }) {
  const app = useApp();
  const transfer = app.transfers.find(item => item.id === transferId);
  if (!transfer || !['Preparing', 'In Transit', 'Receiving Discrepancy', 'Received'].includes(transfer.status)) return null;
  const bags = app.pellets.filter(item => item.transferRef === transfer.refNo && item.batchNo === transfer.batchNo);
  const received = bags.filter(bag => bag.inventoryStatus !== 'Pending Receipt').length;
  const remaining = Math.max(0, (transfer.sentQuantity ?? transfer.numberOfBags ?? bags.length) - received);
  return <section className="page-stack">
    <h3 className="section-title">Expected Pellet Bags / Physical Receiving</h3>
    <p className="helper-text">{received} / {bags.length} bags received ({received * 25} kg). Remaining: {remaining} bags / {remaining * 25} kg. Approval and labels do not add stock.</p>
    <div className="table-scroll"><table className="app-table"><thead><tr><th>Physical barcode</th><th>Weight</th><th>Status</th><th>Label</th></tr></thead><tbody>{bags.map(bag => {
      const printable = printableRecords(app).find(record => record.kind === 'Barcode' && record.recordId === bag.id);
      return <tr key={bag.id}><td>{bag.barcode}</td><td>25 kg</td><td>{bag.inventoryStatus === 'Pending Receipt' ? 'Expected / Awaiting Receiving' : bag.inventoryStatus}</td><td>{printable && <PrintAction record={printable} onPreview={() => printBarcodeBatch([{ value: bag.barcode, recordId: bag.id, recordLabel: bag.bagNo }]).length === 1} />}</td></tr>;
    })}</tbody></table></div>
    <ScannedTransferAcceptance key={transfer.id} transferId={transfer.id} />
  </section>;
}
