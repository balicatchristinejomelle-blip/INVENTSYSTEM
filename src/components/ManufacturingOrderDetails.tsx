import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import type { CustomerOrder, ManufacturingOrder, MaterialRequest, PelletInventory, ProductionOrder } from '../types';
import DocumentViewer from './DocumentViewer';
import { manufacturingOrderDocument } from '../documentPrint';
import { Lifecycle, LinkedRecords, RecordHistory } from './RecordContext';
import type { LifecycleStep, LinkedRecord, RecordHistoryEvent } from '../types';

interface ManufacturingOrderDetailsProps {
  mo: ManufacturingOrder;
  customerOrder?: CustomerOrder;
  productionOrder?: ProductionOrder;
  pellets: PelletInventory[];
  materialRequest?: MaterialRequest;
  role: 'marketing' | 'plantmanager' | 'management';
  onBack: () => void;
  onViewProductionOrder?: () => void;
  onCreateProductionOrder?: () => void;
  onRequestPellets?: () => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="field-label">{label}</div><div className="field-value">{value}</div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mo-section"><div className="section-title">{title}</div><div className="mo-field-grid">{children}</div></section>;
}

export default function ManufacturingOrderDetails({
  mo,
  customerOrder,
  productionOrder,
  pellets,
  materialRequest,
  role,
  onBack,
  onViewProductionOrder,
  onCreateProductionOrder,
  onRequestPellets,
}: ManufacturingOrderDetailsProps) {
  const [showCustomerOrder, setShowCustomerOrder] = useState(false);
  const [documentAction, setDocumentAction] = useState<'view' | 'print' | null>(null);
  const progress = productionOrder && productionOrder.targetQty > 0 ? Math.round(productionOrder.completedQty / productionOrder.targetQty * 100) : 0;
  const availablePellets = pellets
    .filter(item => item.grade === mo.grade && item.availableKg > 0)
    .reduce((sum, item) => sum + item.availableKg, 0);
  const shortage = Math.max(0, mo.requestedQty - mo.availableQty);
  const reserved = Math.min(mo.availableQty, mo.requestedQty);
  const canCreatePO = role === 'plantmanager' && !productionOrder;
  const lifecycleLabels = ['Created', 'Scheduled', 'In Production', 'Completed'];
  const currentLifecycleIndex = productionOrder?.status === 'Completed' || mo.status === 'Completed'
    ? 3
    : productionOrder && ['In Production', 'Partially Completed', 'Awaiting Shift Turnover'].includes(productionOrder.status)
      ? 2
      : productionOrder
        ? 1
        : 0;
  const lifecycle: LifecycleStep[] = lifecycleLabels.map((label, index) => ({ label, state: index < currentLifecycleIndex ? 'complete' : index === currentLifecycleIndex ? 'current' : 'upcoming' }));
  const history: RecordHistoryEvent[] = [
    { id: `${mo.id}-created`, datetime: mo.createdDate, title: 'Manufacturing Order created', description: `${mo.moNo} created from ${mo.orderRef}.`, actor: mo.createdBy },
    ...(productionOrder ? [{ id: `${productionOrder.id}-created`, datetime: productionOrder.requiredDate, title: 'Production Order linked', description: `${productionOrder.poNo} · ${productionOrder.status}` }] : []),
  ];
  const linkedRecords: LinkedRecord[] = [
    ...(customerOrder ? [{ id: customerOrder.id, label: 'Customer Order', reference: customerOrder.orderNo, page: 'customer-order', status: customerOrder.status }] : []),
    ...(productionOrder ? [{ id: productionOrder.id, label: 'Production Order', reference: productionOrder.poNo, page: 'production-order', status: productionOrder.status }] : []),
  ];

  return <div className="mo-detail page-stack">
    <div className="mo-detail-header">
      <div>
        <div className="section-title">Manufacturing Order Details</div>
        <div className="mo-number font-mono">{mo.moNo}</div>
        <div className="helper-text">Linked to {mo.orderRef} · production tracking record</div>
      </div>
      <StatusBadge status={mo.status} />
    </div>

    <Section title="MO Information">
      <Field label="MO Number" value={mo.moNo} />
      <Field label="Customer Order Reference" value={mo.orderRef} />
      <Field label="Customer" value={customerOrder?.customerName || '—'} />
      <Field label="Date Created" value={mo.createdDate} />
      <Field label="Created By" value={mo.createdBy} />
      <Field label="Required Date" value={mo.requiredDate} />
      <Field label="Priority" value={productionOrder?.priority || 'Normal'} />
      <Field label="Status" value={<StatusBadge status={mo.status} size="sm" />} />
    </Section>

    <section className="mo-section">
      <div className="section-title">Lifecycle</div>
      <Lifecycle steps={lifecycle} label={`${mo.moNo} lifecycle`} />
    </section>

    <Section title="Product Specifications">
      <Field label="Product" value={mo.product} />
      <Field label="Diameter / Size" value={mo.diameter} />
      <Field label="Length" value={mo.length} />
      <Field label="SDR / Thickness" value={mo.sdr} />
      <Field label="Grade" value={mo.grade} />
      <Field label="Color" value={mo.color} />
      <Field label="Stripe" value={mo.stripe} />
      <Field label="Construction" value={mo.construction} />
      <Field label="Form" value={mo.productForm} />
    </Section>

    <Section title="Quantity">
      <Field label="Customer Requested Quantity" value={mo.requestedQty} />
      <Field label="Finished Goods Available" value={mo.availableQty} />
      <Field label="Finished Goods Reserved" value={reserved} />
      <Field label="Shortage" value={shortage} />
      <Field label="Quantity to Manufacture" value={mo.toManufactureQty} />
    </Section>

    <Section title="Production">
      <Field label="Production Order Reference" value={productionOrder?.poNo || 'Not created'} />
      <Field label="Production Line" value={productionOrder?.productionLine || 'To be assigned'} />
      <Field label="Target Quantity" value={productionOrder?.targetQty ?? mo.toManufactureQty} />
      <Field label="Completed Quantity" value={productionOrder?.completedQty ?? 0} />
      <Field label="Remaining Quantity" value={productionOrder ? Math.max(0, productionOrder.targetQty - productionOrder.completedQty) : mo.toManufactureQty} />
      <Field label="Progress" value={`${progress}%`} />
      <Field label="Production Status" value={productionOrder?.status || 'Awaiting Production Order'} />
      <div className="mo-progress"><div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div></div>
    </Section>

    {role !== 'marketing' && <Section title="Material Requirement">
      <Field label="Material Grade" value={mo.grade} />
      <Field label="Expected Pellet Requirement" value="No BOM defined — actual usage only" />
      <Field label="Available Pellet Inventory" value={`${availablePellets.toLocaleString()} kg`} />
      <Field label="Material Request Reference" value={materialRequest?.refNo || 'None'} />
    </Section>}

    <section className="mo-section">
      <div className="section-title">Tracking</div>
      <div className="tracking-flow">
        {[
          ['Customer Order', mo.orderRef],
          ['Manufacturing Order', mo.moNo],
          ['Production Order', productionOrder?.poNo || 'Pending'],
          ['Production', productionOrder ? `${progress}% Complete` : 'Not Started'],
          ['Finished Goods', productionOrder?.completedQty ? `${productionOrder.completedQty} Recorded` : 'Pending'],
          ['Release', customerOrder?.status === 'Released' ? 'Released' : 'Pending'],
        ].map(([label, value], index) => <React.Fragment key={label}>
          <div className="tracking-step"><span>{label}</span><strong>{value}</strong></div>
          {index < 5 && <div className="tracking-arrow" aria-hidden="true">→</div>}
        </React.Fragment>)}
      </div>
    </section>

    {showCustomerOrder && customerOrder && <section className="mo-section">
      <div className="section-title">Customer Order</div>
      <div className="mo-field-grid">
        <Field label="Order Number" value={customerOrder.orderNo} />
        <Field label="Customer" value={customerOrder.customerName} />
        <Field label="Order Date" value={customerOrder.orderDate} />
        <Field label="Required Date" value={customerOrder.requiredDate} />
        <Field label="Quantity" value={customerOrder.quantity} />
        <Field label="Status" value={<StatusBadge status={customerOrder.status} size="sm" />} />
      </div>
    </section>}

    <LinkedRecords records={linkedRecords} onOpen={record => {
      if (record.page === 'customer-order') setShowCustomerOrder(true);
      if (record.page === 'production-order') onViewProductionOrder?.();
    }} />

    <RecordHistory events={history} />

    <div className="mo-actions">
      <button className="btn-secondary" onClick={onBack}>Back</button>
      <button className="btn-secondary" onClick={() => setDocumentAction('view')}>View Document</button>
      <button className="btn-primary" onClick={() => setDocumentAction('print')}>Print</button>
      {customerOrder && <button className="btn-secondary" onClick={() => setShowCustomerOrder(value => !value)}>
        {showCustomerOrder ? 'Hide Customer Order' : 'View Customer Order'}
      </button>}
      {productionOrder && onViewProductionOrder && <button className="btn-secondary" onClick={onViewProductionOrder}>View Production Order</button>}
      {canCreatePO && <button className="btn-primary" onClick={onCreateProductionOrder}>Create Production Order</button>}
      {role === 'plantmanager' && onRequestPellets && <button className="btn-secondary" onClick={onRequestPellets}>Request Pellets</button>}
    </div>
    <DocumentViewer
      open={documentAction !== null}
      document={manufacturingOrderDocument(mo, customerOrder?.customerName)}
      autoPrint={documentAction === 'print'}
      onClose={() => setDocumentAction(null)}
    />
  </div>;
}
