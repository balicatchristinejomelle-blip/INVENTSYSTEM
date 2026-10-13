import React, { useState } from 'react';
import { useApp } from '../../store';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Pagination, { pageRecords } from '../../components/Pagination';
import { HPAI_PRODUCT_MASTER, lengthsForForm, sizesForProduct } from '../../productMaster';
import DocumentViewer from '../../components/DocumentViewer';
import { customerOrderDocument } from '../../documentPrint';

export default function Orders() {
  const { orders, finishedGoods, customers, reserveFinishedGoods, createCustomerOrder } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [stockCheck, setStockCheck] = useState<{ available: number; shortage: number } | null>(null);
  const [reservationMessage, setReservationMessage] = useState('');
  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  // New order form
  const [form, setForm] = useState({ customerId: '', product: 'HDPE Pipe', diameter: '110mm', length: '6m', sdr: 'SDR17', grade: 'PE100', color: 'Black (BK)', stripe: 'No Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', quantity: '', requiredDate: '', notes: '' });

  const statuses = ['All', 'New', 'Active', 'In Production', 'Ready for Release', 'Completed'];
  const filtered = filter === 'All' ? orders : orders.filter(o => o.status === filter);
  const viewOrder = orders.find(o => o.id === viewId);
  const documentOrder = orders.find(o => o.id === documentAction?.id);
  const availableSizes = sizesForProduct(form.product);
  const availableLengths = lengthsForForm(form.productForm);
  const updateProduct = (product: string) => {
    const sizes = sizesForProduct(product);
    setForm(current => ({ ...current, product, diameter: sizes[0] }));
  };
  const updateProductForm = (productForm: string) => {
    const lengths = lengthsForForm(productForm);
    setForm(current => ({ ...current, productForm, length: lengths[0] }));
  };

  const handleCheckStock = () => {
    const qty = parseInt(form.quantity);
    if (!qty) return;
    const available = finishedGoods.filter(fg =>
      fg.qualityStatus === 'Pass' && fg.status === 'Available' && fg.availableQty === 1
      && fg.locationStatus === 'Stored'
      && fg.product === form.product && fg.diameter === form.diameter && fg.length === form.length
      && fg.sdr === form.sdr && fg.grade === form.grade && fg.color === form.color
      && fg.stripe === form.stripe && fg.construction === form.construction && fg.productForm === form.productForm
    ).length;
    setStockCheck({ available, shortage: Math.max(0, qty - available) });
  };

  const handleCreateOrder = () => {
    const customer = customers.find(item => item.id === form.customerId);
    const quantity = Number(form.quantity);
    if (!customer || !Number.isInteger(quantity) || quantity < 1 || !form.requiredDate) {
      setReservationMessage('Complete Customer, Quantity, and Required Date before creating the order.');
      return;
    }
    const result = createCustomerOrder({
      customerId: customer.id,
      customerName: customer.name,
      product: form.product,
      diameter: form.diameter,
      length: form.length,
      sdr: form.sdr,
      grade: form.grade,
      color: form.color,
      stripe: form.stripe,
      construction: form.construction,
      productForm: form.productForm,
      quantity,
      requiredDate: form.requiredDate,
      notes: form.notes,
    });
    if (!result.success) {
      setReservationMessage(result.error || 'Customer Order could not be created.');
      return;
    }
    setReservationMessage(`${result.orderNo} created: ${result.reserved} physical pipe(s) reserved; ${result.shortage} require manufacturing${result.moNo ? ` under ${result.moNo}` : ' — no MO created'}.`);
    setShowNew(false);
    setStockCheck(null);
  };

  return (
    <div>
      {reservationMessage && !viewId && <div className={reservationMessage.includes('created:') ? 'alert-success mb-3' : 'alert-error mb-3'}>{reservationMessage}</div>}
      <div className="flex items-center justify-between mb-4 page-toolbar">
        <div className="report-tabs flex gap-1">
          {statuses.map(s => (
            <button key={s} onClick={() => { setFilter(s); setPage(1); }} style={{
              padding: '5px 10px', borderRadius: 5, border: `1px solid ${filter === s ? 'var(--accent-blue)' : 'var(--card-border)'}`, cursor: 'pointer',
              fontSize: 11.5, fontWeight: filter === s ? 600 : 400,
              background: filter === s ? 'var(--accent-blue)' : 'var(--card-bg)', color: filter === s ? '#fff' : 'var(--text-secondary)',
            }}>{s}</button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>Create Order</button>
      </div>

      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr><th>Order No.</th><th>Date</th><th>Customer</th><th>Product</th><th>Size</th><th>SDR</th><th>Qty</th><th>Required</th><th>Status</th><th data-actions>Actions</th></tr>
          </thead>
          <tbody>
            {pageRecords(filtered, page).map(o => (
              <tr key={o.id} className="table-row-hover" onClick={() => setViewId(o.id)}>
                <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{o.orderNo}</td>
                <td style={{ fontSize: 11 }}>{o.orderDate}</td>
                <td style={{ fontSize: 12 }}>{o.customerName}</td>
                <td style={{ fontSize: 12 }}>{o.product}</td>
                <td style={{ fontSize: 12 }}>{o.diameter} × {o.length}</td>
                <td style={{ fontSize: 12 }}>{o.sdr}</td>
                <td className="font-mono" style={{ fontWeight: 600 }}>{o.quantity}</td>
                <td style={{ fontSize: 12 }}>{o.requiredDate}</td>
                <td><StatusBadge status={o.status} size="sm" /></td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="button-group">
                    <button className="btn-secondary btn-compact" onClick={() => setViewId(o.id)}>View Details</button>
                    <button className="btn-secondary btn-compact" onClick={() => setDocumentAction({ id: o.id, autoPrint: true })}>Print</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={10} className="empty-state">No records match the selected filters.</td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>

      {/* Order detail */}
      {viewId && viewOrder && (
        <Modal open title={`Order — ${viewOrder.orderNo}`} onClose={() => setViewId(null)} width="600px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['Order No.', viewOrder.orderNo], ['Order Date', viewOrder.orderDate], ['Customer', viewOrder.customerName], ['Product', viewOrder.product], ['Diameter', viewOrder.diameter], ['Length', viewOrder.length], ['SDR', viewOrder.sdr], ['Grade', viewOrder.grade], ['Color', viewOrder.color], ['Stripe', viewOrder.stripe], ['Construction', viewOrder.construction], ['Form', viewOrder.productForm], ['Quantity', viewOrder.quantity], ['Required Date', viewOrder.requiredDate]].map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{l}</div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{v}</div></div>
            ))}
            <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Status</div><StatusBadge status={viewOrder.status} /></div>
            {viewOrder.moRef && <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>MO Reference</div><div style={{ fontSize: 13, color: 'var(--accent-blue)', fontWeight: 500 }}>{viewOrder.moRef}</div></div>}
          </div>
          <div className="app-card detail-card mt-4">
            <div className="section-title">Order Fulfillment Summary</div>
            <div className="responsive-grid">
              {[['Ordered Quantity', viewOrder.quantity], ['Matched Existing Inventory', viewOrder.matchedInventoryQuantity || 0], ['Reserved Quantity', viewOrder.reservedQuantity || 0], ['Manufacturing Required', viewOrder.manufacturingRequiredQuantity || 0], ['Manufactured Quantity', viewOrder.manufacturedQuantity || 0], ['Ready for Ship Out', finishedGoods.filter(item => item.reservedForOrderId === viewOrder.id && item.status === 'Ready for Release').length], ['Shipped Quantity', viewOrder.releasedQuantity || 0], ['Remaining Quantity', Math.max(0, viewOrder.quantity - (viewOrder.releasedQuantity || 0))], ['Fulfillment Type', viewOrder.fulfillmentType || 'Legacy Order']].map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value">{value}</div></div>)}
            </div>
          </div>
          <div className="mt-4 form-actions">
            <button className="btn-secondary" onClick={() => setDocumentAction({ id: viewOrder.id, autoPrint: false })}>View Document</button>
            <button className="btn-primary" onClick={() => setDocumentAction({ id: viewOrder.id, autoPrint: true })}>Print</button>
            <button className="btn-secondary" onClick={() => setViewId(null)}>Close</button>
            {viewOrder.status !== 'Released' && (viewOrder.reservedQuantity || 0) < viewOrder.quantity && <button className="btn-primary" onClick={() => {
              const remaining = Math.max(0, viewOrder.quantity - (viewOrder.reservedQuantity || 0) - (viewOrder.releasedQuantity || 0));
              const result = reserveFinishedGoods(viewOrder.id, remaining);
              setReservationMessage(result.success ? `${remaining} physical item(s) reserved. Physical on-hand is unchanged until Production release scan.` : (result.error || 'Reservation failed.'));
            }}>Reserve Available Stock</button>}
          </div>
          {reservationMessage && <div className={reservationMessage.includes('reserved.') ? 'alert-success mt-3' : 'alert-error mt-3'} style={{ whiteSpace: 'pre-line' }}>{reservationMessage.split('|').join('\n')}</div>}
        </Modal>
      )}
      <DocumentViewer
        open={!!documentAction}
        document={documentOrder ? customerOrderDocument(documentOrder) : null}
        autoPrint={documentAction?.autoPrint}
        onClose={() => setDocumentAction(null)}
      />

      {/* New order modal */}
      <Modal open={showNew} title="New Customer Order" onClose={() => { setShowNew(false); setStockCheck(null); }} width="580px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Customer</label>
            <select className="app-select" style={{ width: '100%' }} value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
              <option value="">Select customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Product</label>
            <select className="app-select" style={{ width: '100%' }} value={form.product} onChange={e => updateProduct(e.target.value)}>
              {HPAI_PRODUCT_MASTER.products.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Diameter</label>
            <select className="app-select" style={{ width: '100%' }} value={form.diameter} onChange={e => setForm(f => ({ ...f, diameter: e.target.value }))}>
              {availableSizes.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Length</label>
            <select className="app-select" style={{ width: '100%' }} value={form.length} onChange={e => setForm(f => ({ ...f, length: e.target.value }))}>
              {availableLengths.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SDR</label>
            <select className="app-select" style={{ width: '100%' }} value={form.sdr} onChange={e => setForm(f => ({ ...f, sdr: e.target.value }))}>
              {HPAI_PRODUCT_MASTER.sdrRatings.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Material Grade</label>
            <select className="app-select" style={{ width: '100%' }} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
              {HPAI_PRODUCT_MASTER.materialGrades.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Color</label>
            <select className="app-select" style={{ width: '100%' }} value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}>
              {HPAI_PRODUCT_MASTER.pipeColors.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Stripe</label>
            <select className="app-select" style={{ width: '100%' }} value={form.stripe} onChange={e => setForm(f => ({ ...f, stripe: e.target.value }))}>
              {HPAI_PRODUCT_MASTER.stripeColors.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Construction</label>
            <select className="app-select" style={{ width: '100%' }} value={form.construction} onChange={e => setForm(f => ({ ...f, construction: e.target.value }))}>
              {HPAI_PRODUCT_MASTER.constructions.map(construction => <option key={construction}>{construction}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Product Form</label>
            <select className="app-select" style={{ width: '100%' }} value={form.productForm} onChange={e => updateProductForm(e.target.value)}>
              {HPAI_PRODUCT_MASTER.productForms.map(productForm => <option key={productForm}>{productForm}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Quantity</label>
            <input className="app-input" type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Required Date</label>
            <input className="app-input" type="date" value={form.requiredDate} onChange={e => setForm(f => ({ ...f, requiredDate: e.target.value }))} />
          </div>
        </div>

        {stockCheck && stockCheck.shortage === 0 && (
          <div className="alert-success mb-3" style={{ fontSize: 12 }}>
            <strong>STOCK AVAILABLE</strong> — Requested: {form.quantity} | Matching Available: {stockCheck.available}
            <br />Fulfillment: FROM INVENTORY / STOCK SALE · Manufacturing Order: NOT REQUIRED
          </div>
        )}
        {stockCheck && stockCheck.shortage > 0 && (
          <div className="alert-warning mb-3" style={{ fontSize: 12 }}>
            <strong>{stockCheck.available ? 'PARTIAL INVENTORY' : 'MANUFACTURING REQUIRED'}</strong> — Requested: {form.quantity} | Reserve Existing: {Math.min(Number(form.quantity), stockCheck.available)} | Shortage / MO Quantity: {stockCheck.shortage}
          </div>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => { setShowNew(false); setStockCheck(null); }}>Cancel</button>
          <button className="btn-secondary" onClick={handleCheckStock}>Check Availability</button>
          <button className="btn-primary" onClick={handleCreateOrder}>Create Order & Fulfill</button>
        </div>
      </Modal>
    </div>
  );
}
