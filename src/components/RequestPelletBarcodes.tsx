import React, { useState } from 'react';
import type { MaterialRequest, PelletInventory } from '../types';
import { useApp } from '../store';
import { expectedPelletPlan } from '../incomingPelletBarcodes';
import { printableRecords } from '../printableRecords';
import { canPrint, metadataFor } from '../reprintWorkflow';
import PrintAction, { BatchPrintAction } from './PrintAction';
import { printBarcodeBatch } from './BarcodeLabel';
import Modal from './Modal';

export function RequestPelletBarcodes({ requestId }: { requestId: string }) {
  const app = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const plan = expectedPelletPlan(app, requestId);
  if (!plan.request || plan.error) return <div className="alert-error" role="alert">{plan.error}</div>;
  const { request, bags, expected } = plan;
  const received = bags.filter(bag => bag.inventoryStatus !== 'Pending Receipt').length;
  const records = printableRecords(app).filter(record => record.kind === 'Barcode' && record.recordType === 'Pellet' && bags.some(bag => bag.id === record.recordId));
  const firstPrints = records.filter(record => canPrint(app.currentUser, record) && metadataFor(app, record).printCount === 0);
  const selectedRecords = records.filter(record => selected.includes(record.recordId));
  const selectedFirstPrints = selectedRecords.every(record => firstPrints.includes(record)) ? selectedRecords : [];
  const preview = (items: PelletInventory[]) => printBarcodeBatch(items.map(bag => ({ value: bag.barcode, recordId: bag.id, recordLabel: bag.bagNo }))).length === items.length;
  return <section className="page-stack">
    <div className="responsive-grid">
      {Object.entries({ 'Request Reference': request.refNo, Material: `${request.pelletType} Pellets · ${request.grade} · ${request.color}`, 'Approved Quantity': `${request.requestedKg} kg`, 'Bag Count': expected, 'Received Count': received, 'Remaining Count': Math.max(0, expected - received) }).map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value">{value}</div></div>)}
    </div>
    <div className="alert-info">Labels do not receive inventory. Print All covers never-printed labels only. Printed labels use the individual Management-approved Reprint action below, with the SAME barcode.</div>
    {plan.missing > 0 && <div className="alert-warning">{plan.missing} expected labels are missing. Close and reopen View Barcodes to safely add only missing records.</div>}
    <div className="button-group">
      <BatchPrintAction label="Print All" records={firstPrints} onPreview={() => preview(bags.filter(bag => firstPrints.some(record => record.recordId === bag.id)))} />
      <BatchPrintAction label="Print Selected" records={selectedFirstPrints} onPreview={() => preview(bags.filter(bag => selectedFirstPrints.some(record => record.recordId === bag.id)))} />
    </div>
    {selectedRecords.length > 0 && !selectedFirstPrints.length && <div className="helper-text" role="status">Selection contains a printed/restricted label. Use its individual reprint approval action, or select only never-printed labels.</div>}
    <div className="table-scroll"><table className="app-table">
      <thead><tr><th>Select</th><th>Barcode</th><th>Weight</th><th>Receiving Status</th><th>Print / Reprint</th></tr></thead>
      <tbody>{bags.map(bag => {
        const record = records.find(item => item.recordId === bag.id);
        return <tr key={bag.id}>
          <td><input type="checkbox" aria-label={`Select barcode ${bag.barcode}`} checked={selected.includes(bag.id)} onChange={event => setSelected(current => event.target.checked ? [...current, bag.id] : current.filter(id => id !== bag.id))} /></td>
          <td className="font-mono">{bag.barcode}</td><td>25 kg</td>
          <td>{bag.inventoryStatus === 'Pending Receipt' ? 'Expected / Not Received' : 'Received'}{bag.receivedAt && <div className="helper-text">{bag.currentLocation}</div>}</td>
          <td style={{ whiteSpace: 'normal' }}>{record && <PrintAction record={record} onPreview={() => preview([bag])} />}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}

/** Explicit view action; no mount-time generation or inventory hydration. */
export default function RequestPelletBarcodeButton({ request }: { request?: MaterialRequest }) {
  const app = useApp();
  const [open, setOpen] = useState(false), [error, setError] = useState('');
  if (app.currentUser?.role !== 'plantmanager' || !request || request.status !== 'Approved' || request.materialCategory === 'Colorant') return null;
  const show = () => {
    const result = app.ensureExpectedPelletBags(request.id);
    setError(result.success ? '' : result.error || 'Expected labels could not be prepared.');
    if (result.success) setOpen(true);
  };
  return <div style={{ display: 'contents', whiteSpace: 'normal' }}>
    <button className="btn-secondary btn-compact" onClick={show}>View Barcodes</button>
    {error && <div className="helper-text" role="alert">{error}</div>}
    <Modal open={open} title={`Incoming Pellet Barcodes — ${request.refNo}`} onClose={() => setOpen(false)} width="900px">
      <RequestPelletBarcodes key={request.id} requestId={request.id} />
    </Modal>
  </div>;
}
