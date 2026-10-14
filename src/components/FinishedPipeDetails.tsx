import React, { useState } from 'react';
import type { FinishedGood } from '../types';
import { useApp } from '../store';
import { readPipeSpecifications, resolveFinishedPipe } from '../finishedPipeRelations';
import { metadataFor, printableKey } from '../reprintWorkflow';
import DocumentViewer, { type PrintableDocument } from './DocumentViewer';
import { customerOrderDocument, manufacturingOrderDocument, productionOrderDocument } from '../documentPrint';

export default function FinishedPipeDetails({ pipe, compact = false, onOpenBatch }: { pipe: FinishedGood; compact?: boolean; onOpenBatch?: () => void }) {
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
    Buyer: result.buyer || '—', [result.source === 'Stock Replenishment' ? 'Replenishment Group' : 'MO Group']: result.source === 'Manufacturing Order' ? moLink : result.originGroup || '—',
    'Inventory Purpose': result.purpose, 'Inventory Status': result.inventoryStatus,
  };
  const values: Record<string, React.ReactNode> = compact ? trace : {
    'Pipe Record ID': live.fgId, 'Physical Barcode': live.barcode,
    Product: result.product.product, 'Size / Diameter': result.product.diameter, Length: result.product.length, 'SDR / Thickness': result.product.sdr,
    Grade: result.product.grade, Color: result.product.color, Stripe: result.product.stripe, Construction: result.product.construction, Form: result.product.productForm,
    ...trace, Batch: onOpenBatch ? <button className="btn-secondary btn-compact" onClick={onOpenBatch}>{live.batch}</button> : live.batch,
    'Production Date': live.productionDate, Shift: live.shift, 'Quality Status': live.qualityStatus || 'Pending',
    'Current Location': live.currentLocation || 'Not Yet Assigned', 'Release Status': live.releaseStatus,
    'Allocation / Reservation': live.reservationStatus || (live.reservedQty > 0 ? 'Reserved' : 'Unassigned'),
    'Total Qty': live.quantity, 'Available General Inventory': result.availableQty, Reserved: live.reservedQty,
  };
  const printRecord = { key: printableKey('Barcode', 'Finished Pipe', live.id), kind: 'Barcode' as const, recordType: 'Finished Pipe', recordId: live.id, reference: live.fgId, value: live.barcode, allowedRoles: [] };
  const count = metadataFor(app, printRecord, live.printStatus === 'Printed').printCount;
  return <>
    <div className="app-card detail-card">
      <div className="section-title">System Record Details {result.seasonal && <span className="badge-amber">SEASONAL</span>}</div>
      {!compact && <div className="helper-text">{count === 0 ? 'NOT PRINTED' : `PRINTED · ${count} print event${count === 1 ? '' : 's'}`}</div>}
      <div className="responsive-grid">{Object.entries(values).map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value" style={{ overflowWrap: 'anywhere' }}>{value}</div></div>)}</div>
      {!!result.issues.length && <div className="alert-info mt-3">{result.issues.join(' · ')}</div>}
    </div>
    <DocumentViewer open={!!document} document={document} onClose={() => setDocument(null)} />
  </>;
}
