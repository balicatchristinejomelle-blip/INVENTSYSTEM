import React, { useState } from 'react';
import type { FinishedGood } from '../types';
import { useApp } from '../store';
import { readPipeSpecifications, resolveFinishedPipe } from '../finishedPipeRelations';
import FinishedPipeStorage from './FinishedPipeStorage';
import { metadataFor, printableKey } from '../reprintWorkflow';
import DocumentViewer, { type PrintableDocument } from './DocumentViewer';
import { customerOrderDocument, manufacturingOrderDocument, productionOrderDocument } from '../documentPrint';
import RecordReference, { RelatedRecords } from './RecordReference';
import { TermHelp } from './UXFeedback';
import ActionButton from './ActionButton';

export default function FinishedPipeDetails({ pipe, compact = false, onOpenBatch, readOnly = false }: { pipe: FinishedGood; compact?: boolean; onOpenBatch?: () => void; readOnly?: boolean }) {
  const app = useApp();
  const live = app.finishedGoods.find(item => item.id === pipe.id) || pipe;
  const result = resolveFinishedPipe(live, { ...app, specifications: readPipeSpecifications() });
  const [document, setDocument] = useState<PrintableDocument | null>(null);
  const role = app.currentUser?.role;
  const reference = (value: string | undefined, doc: PrintableDocument | undefined, roles: string[]) => value ? doc && role && roles.includes(role) ? <button className="btn-secondary btn-compact" onClick={() => setDocument(doc)}>{value}</button> : value : '—';
  const moLink = reference(result.mo?.moNo, result.mo ? manufacturingOrderDocument(result.mo, result.buyer) : undefined, ['OWNER_SUPER_ADMIN', 'marketing', 'plantmanager']);
  const trace: Record<string, React.ReactNode> = {
    'Item Code': result.itemCode || 'Not Configured', 'Product Barcode': result.productBarcode || 'Not Configured',
    'Unit Weight': result.unitWeightKg !== undefined ? `${result.unitWeightKg} kg (${result.unitWeightSource})` : result.unitWeightSource,
    'Production Source': result.source === 'Manufacturing Order' ? 'Customer Order / MO' : result.source || 'Not Resolved',
    'Production Order': reference(result.po?.poNo, result.po ? productionOrderDocument(result.po) : undefined, ['OWNER_SUPER_ADMIN', 'management', 'plantmanager', 'production']),
    'Manufacturing Order': moLink,
    'Customer Order': reference(result.order?.orderNo, result.order ? customerOrderDocument(result.order) : undefined, ['OWNER_SUPER_ADMIN', 'marketing']),
    Buyer: result.buyer || '—', 'Group Type': (live.source || result.source) === 'Manufacturing Order' ? 'MO' : (live.source || result.source) === 'Stock Replenishment' ? 'Replenishment' : 'Not Resolved',
    'Origin Group': result.originGroup || 'Not Resolved', [result.source === 'Stock Replenishment' ? 'Replenishment Group' : 'MO Group']: result.originGroup === result.mo?.moNo ? moLink : result.originGroup || '—',
    'Storage Purpose': result.purpose, 'Inventory Status': result.inventoryStatus, 'Current Inventory State': result.inventory.bucket,
  };
  const values: Record<string, React.ReactNode> = compact ? trace : {
    'Pipe Record ID': live.fgId, 'Physical Barcode': live.barcode, Serial: live.serialNumber || 'Legacy / Not Migrated',
    Product: result.product.product, 'Size / Diameter': result.product.diameter, Length: result.product.length, 'SDR / Thickness': result.product.sdr,
    Grade: result.product.grade, Color: result.product.color, Stripe: result.product.stripe, Construction: result.product.construction, Form: result.product.productForm,
    ...trace, Batch: onOpenBatch ? <button className="btn-secondary btn-compact" onClick={onOpenBatch}>{live.batch}</button> : live.batch,
    'Production Date': live.productionDate, Shift: live.shift, 'Quality Status': live.qualityStatus || 'Pending',
    'Current Location': live.currentLocation || 'Not Yet Assigned', 'Release Status': live.releaseStatus,
    'Allocation / Reservation': result.inventory.allocated ? `Allocated${result.order ? ` to ${result.order.orderNo}` : ''}` : 'Unassigned',
    'Shipment / Fulfillment Status': live.fulfillmentStatus || live.reservationStatus || 'Not Released',
    'Total Qty': live.quantity, 'Available General Inventory': result.availableQty, Reserved: result.inventory.reserved, Temporary: result.inventory.temporary, 'Ready for Ship Out': result.inventory.ready,
  };
  const printRecord = { key: printableKey('Barcode', 'Finished Pipe', live.id), kind: 'Barcode' as const, recordType: 'Finished Pipe', recordId: live.id, reference: live.fgId, value: live.barcode, allowedRoles: [] };
  const count = metadataFor(app, printRecord, live.printStatus === 'Printed').printCount;
  return <>
    <div className="app-card detail-card">
      <div className="section-title">System Record Details {result.seasonal && <span className="badge-amber">SEASONAL</span>}</div>
      {!compact && <div className="helper-text">{count === 0 ? 'NOT PRINTED' : `PRINTED · ${count} print event${count === 1 ? '' : 's'}`}</div>}
      {!!live.barcodeMigrations?.length && <div className="alert-warning">Legacy physical labels are obsolete. Print/reprint the current barcode through the existing authorized approval workflow.</div>}
      <div className="responsive-grid">{Object.entries(values).map(([label, value]) => <div key={label}><div className="field-label">{label}<TermHelp term={label} /></div><div className="field-value" style={{ overflowWrap: 'anywhere' }}><RecordReference value={value} /></div></div>)}</div>
      {!compact && <RelatedRecords record={live} />}
      {!!live.barcodeMigrations?.length && <details><summary>Barcode migration history (traceability only)</summary>{live.barcodeMigrations.map((migration, index) => <div key={index} className="helper-text">{migration.oldBarcode} → {migration.newBarcode} · {migration.migratedAt} · {migration.migrationReason}</div>)}</details>}
      {!!result.issues.length && <div className="alert-info mt-3">{result.issues.join(' · ')}</div>}
    </div>
    {!compact && !readOnly && <FinishedPipeStorage pipe={live} />}
    {!compact && !readOnly && role === 'production' && result.inventory.bucket === 'Ready for Ship Out' && live.fulfillmentStatus !== 'Loaded' && <div className="action-row"><ActionButton className="btn-secondary" onClick={() => app.markFinishedGoodLoaded(live.id)}>Confirm Loaded (still On Hand)</ActionButton></div>}
    <DocumentViewer open={!!document} document={document} onClose={() => setDocument(null)} />
  </>;
}
