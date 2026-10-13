import { matchesRecord } from "../../components/RecordSearch"

import React, { useEffect, useMemo, useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import Pagination, { pageRecords } from '../../components/Pagination';

import {
  constructionForProduct,
  HPAI_PRODUCT_MASTER,
  lengthsForForm,
  normalizeProductSpecification,
  normalizeProductType,
  sizeLabelForProduct,
  sizesForProduct,
} from "../../productMaster"

import SearchableSelect from '../../components/SearchableSelect';

import type { ProductSpecification } from "../../types"

import DocumentViewer from "../../components/DocumentViewer"

import { customerOrderDocument } from "../../documentPrint"

export default function Orders() {
  const { orders, finishedGoods, customers, reserveFinishedGoods, createCustomerOrder } = useApp();

  const [showNew, setShowNew] = useState(false)

  const [viewId, setViewId] = useState<string | null>(null)

  const [filter, setFilter] = useState("All")

  const [search, setSearch] = useState("")

  const [page, setPage] = useState(1)

  const [stockCheck, setStockCheck] = useState<{ available: number; shortage: number } | null>(null);

  const [reservationMessage, setReservationMessage] = useState('');

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  useEffect(() => {
    const requestedId = window.sessionStorage.getItem('hpai:customer-order-view-v1');
    if (requestedId) { setViewId(requestedId); window.sessionStorage.removeItem('hpai:customer-order-view-v1'); }
  }, []);

  // New order form

  const [form, setForm] = useState({ customerId: '', product: '', diameter: '', length: '', sdr: '', grade: '', color: '', stripe: '', construction: '', productForm: '', quantity: '', requiredDate: '', notes: '' });

  const statuses = ['All', 'New', 'Active', 'In Production', 'Ready for Release', 'Completed'];

  const filtered = orders.filter(
    (order) =>
      (filter === "All" || order.status === filter) &&
      ([order.orderNo, order.customerName, order.product, order.diameter, order.sdr, order.grade, order.color, order.stripe, order.status].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(order, search)),
  )

  const viewOrder = orders.find((o) => o.id === viewId)

  const documentOrder = orders.find(o => o.id === documentAction?.id);

  const configuredSpecifications = useMemo(() => {
    try { return (JSON.parse(window.localStorage.getItem('hpai:product-specifications-v1') || '[]') as unknown[]).map(normalizeProductSpecification).filter((spec): spec is ProductSpecification => spec !== null && spec.active); }
    catch { return []; }
  }, [showNew]);

  const configuredPolytubeSizes = configuredSpecifications.filter(spec => normalizeProductType(spec.productType) === 'Polytube').map(spec => spec.size);

  const availableSizes = form.product ? sizesForProduct(form.product, configuredPolytubeSizes) : [];

  const availableSdrs = HPAI_PRODUCT_MASTER.sdrRatings

  const availableForms = HPAI_PRODUCT_MASTER.productForms

  const availableLengths = lengthsForForm(form.productForm)

  const availableColors = HPAI_PRODUCT_MASTER.pipeColors

  const availableStripes = HPAI_PRODUCT_MASTER.stripeColors

  const updateProduct = (product: string) => {
    const construction = constructionForProduct(product);
    setForm(current => ({ ...current, product, grade: '', diameter: '', sdr: '', productForm: '', length: '', color: '', stripe: '', construction }));
  };

  const updateProductForm = (productForm: string) => {
    setForm(current => ({ ...current, productForm, length: '' }));
  };

  const handleCheckStock = () => {
    const qty = parseInt(form.quantity);
    if (!qty) return;
    const available = finishedGoods.filter(fg =>
      fg.qualityStatus === 'Pass' && fg.status === 'Available' && fg.availableQty === 1
      && fg.locationStatus === 'Stored'
      && normalizeProductType(fg.product) === normalizeProductType(form.product) && fg.diameter === form.diameter && fg.length === form.length
      && fg.sdr === form.sdr && fg.grade === form.grade && fg.color === form.color
      && fg.stripe === form.stripe && fg.construction === form.construction && fg.productForm === form.productForm
    ).length;
    setStockCheck({ available, shortage: Math.max(0, qty - available) });
  };

  const handleCreateOrder = () => {
    const customer = customers.find(item => item.id === form.customerId);
    const quantity = Number(form.quantity);
    if (!customer || !Number.isInteger(quantity) || quantity < 1 || !form.requiredDate || !form.grade || !form.diameter || !form.sdr || !form.productForm || !form.length || !form.color || !form.stripe) {
      setReservationMessage('Complete Customer, Product Specification, Quantity, and Required Date before creating the order.');
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
      {reservationMessage && !viewId && (
        <div className={reservationMessage.includes('created:') ? 'alert-success mb-3' : 'alert-error mb-3'}>
          {reservationMessage}
        </div>
      )}
      <div className="flex items-center justify-between mb-4 page-toolbar">
        <div className="report-tabs flex gap-1">
          {statuses.map((s) => (
            <button key={s} onClick={() => { setFilter(s); setPage(1); }} style={{
              padding: '5px 10px', borderRadius: 5, border: `1px solid ${filter === s ? 'var(--accent-blue)' : 'var(--card-border)'}`, cursor: 'pointer',
              fontSize: 11.5, fontWeight: filter === s ? 600 : 400,
              background: filter === s ? 'var(--accent-blue)' : 'var(--card-bg)', color: filter === s ? '#fff' : 'var(--text-secondary)',
            }}>
              {s}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>Create Order</button>
      </div>

      <div className="record-filter-bar">
        <input className="app-input record-search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search order, customer, product, size, grade, color, or status" />
      </div>

      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>Order No.</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Size</th>
              <th>SDR / Thickness</th>
              <th>Qty</th>
              <th>Required</th>
              <th>Status</th>
              <th data-actions>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords(filtered, page).map((o) => (
              <tr key={o.id} className="table-row-hover" onClick={() => setViewId(o.id)}>
                <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                  {o.orderNo}
                </td>
                <td style={{ fontSize: 11 }}>{o.orderDate}</td>
                <td style={{ fontSize: 12 }}>{o.customerName}</td>
                <td style={{ fontSize: 12 }}>{o.product}</td>
                <td style={{ fontSize: 12 }}>
                  {o.diameter} × {o.length}
                </td>
                <td style={{ fontSize: 12 }}>{o.sdr}</td>
                <td className="font-mono" style={{ fontWeight: 600 }}>
                  {o.quantity}
                </td>
                <td style={{ fontSize: 12 }}>{o.requiredDate}</td>
                <td>
                  <StatusBadge status={o.status} size="sm" />
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="button-group">
                    <button className="btn-secondary btn-compact" onClick={() => setViewId(o.id)}>View Details</button>
                    <button className="btn-secondary btn-compact" onClick={() => setDocumentAction({ id: o.id, autoPrint: true })}>Print</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-state">No records match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>

      {/* Order detail */}
      {viewId && viewOrder && (
        <Modal open title={`Order — ${viewOrder.orderNo}`} onClose={() => setViewId(null)} width="600px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['Order No.', viewOrder.orderNo], ['Order Date', viewOrder.orderDate], ['Customer', viewOrder.customerName], ['Product', viewOrder.product], ['Diameter', viewOrder.diameter], ['Length', viewOrder.length], ['SDR / Thickness', viewOrder.sdr], ['Grade', viewOrder.grade], ['Color', viewOrder.color], ['Stripe', viewOrder.stripe], ['Construction', viewOrder.construction], ['Form', viewOrder.productForm], ['Quantity', viewOrder.quantity], ['Required Date', viewOrder.requiredDate]].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {l}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {v}
                </div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Status</div>
              <StatusBadge status={viewOrder.status} />
            </div>
            {viewOrder.moRef && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>MO Reference</div>
                <div style={{ fontSize: 13, color: 'var(--accent-blue)', fontWeight: 500 }}>
                  {viewOrder.moRef}
                </div>
              </div>
            )}
          </div>
          <div className="app-card detail-card mt-4">
            <div className="section-title">Order Fulfillment Summary</div>
            <div className="responsive-grid">
              {[['Ordered Quantity', viewOrder.quantity], ['Matched Existing Inventory', viewOrder.matchedInventoryQuantity || 0], ['Reserved Quantity', viewOrder.reservedQuantity || 0], ['Manufacturing Required', viewOrder.manufacturingRequiredQuantity || 0], ['Manufactured Quantity', viewOrder.manufacturedQuantity || 0], ['Ready for Ship Out', finishedGoods.filter(item => item.reservedForOrderId === viewOrder.id && item.status === 'Ready for Release').length], ['Shipped Quantity', viewOrder.releasedQuantity || 0], ['Remaining Quantity', Math.max(0, viewOrder.quantity - (viewOrder.releasedQuantity || 0))], ['Fulfillment Type', viewOrder.fulfillmentType || 'Legacy Order']].map(([label, value]) => (
                <div key={label}>
                  <div className="field-label">{label}</div>
                  <div className="field-value">{value}</div>
                </div>
              ))}
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
          {reservationMessage && (
            <div className={reservationMessage.includes('reserved.') ? 'alert-success mt-3' : 'alert-error mt-3'} style={{ whiteSpace: 'pre-line' }}>
              {reservationMessage.split("|").join("\n")}
            </div>
          )}
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
            <SearchableSelect value={form.customerId} options={customers.map(customer => ({ value: customer.id, label: customer.name, searchText: `${customer.id} ${customer.code} ${customer.contact}` }))} ariaLabel="Customer" placeholder="Search customer..." onChange={customerId => setForm(f => ({ ...f, customerId }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Product</label>
            <SearchableSelect value={form.product} options={HPAI_PRODUCT_MASTER.products} ariaLabel="Product Type" placeholder="Search product type..." onChange={updateProduct} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Material Grade</label>
            <SearchableSelect value={form.grade} options={HPAI_PRODUCT_MASTER.materialGrades} disabled={!form.product} ariaLabel="Material Grade" placeholder="Search material grade..." onChange={grade => setForm(f => ({ ...f, grade, diameter: '', sdr: '', productForm: '', length: '', color: '', stripe: '' }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              {sizeLabelForProduct(form.product)}
            </label>
            <SearchableSelect
              value={form.diameter}
              options={availableSizes}
              disabled={!form.product || !availableSizes.length}
              required
              ariaLabel={sizeLabelForProduct(form.product)}
              placeholder={normalizeProductType(form.product) === 'HDPE Pipe' || normalizeProductType(form.product) === 'Commercial HDPE Pipe (CGPE)' ? 'Select size / diameter' : 'Select size'}
              onChange={diameter => setForm(f => ({ ...f, diameter, sdr: '', productForm: '', length: '', color: '', stripe: '' }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SDR / Thickness</label>
            <SearchableSelect value={form.sdr} options={availableSdrs} disabled={!form.diameter} ariaLabel="SDR / Thickness" placeholder="Search SDR / Thickness..." onChange={sdr => setForm(f => ({ ...f, sdr, productForm: '', length: '', color: '', stripe: '' }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Product Form</label>
            <SearchableSelect value={form.productForm} options={availableForms} disabled={!form.sdr} ariaLabel="Product Form" placeholder="Search product form..." onChange={updateProductForm} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
              {form.productForm === 'Coil' ? 'Coil Length' : 'Straight Pipe Length'}
            </label>
            <SearchableSelect value={form.length} options={availableLengths} disabled={!form.productForm} required ariaLabel={form.productForm === 'Coil' ? 'Coil Length' : 'Straight Pipe Length'} placeholder={form.productForm === 'Coil' ? 'Select coil length' : 'Select straight pipe length'} onChange={length => setForm(f => ({ ...f, length, color: '', stripe: '' }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Color</label>
            <SearchableSelect value={form.color} options={availableColors} disabled={!form.length} ariaLabel="Product Color" placeholder="Search product color..." onChange={color => setForm(f => ({ ...f, color, stripe: '' }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Stripe</label>
            <SearchableSelect value={form.stripe} options={availableStripes} disabled={!form.color} ariaLabel="Stripe Color" placeholder="Search stripe color..." onChange={stripe => setForm(f => ({ ...f, stripe }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Construction</label>
            <SearchableSelect value={form.construction} options={HPAI_PRODUCT_MASTER.constructions} disabled={!form.product} ariaLabel="Pipe Construction" placeholder="Search pipe construction..." onChange={construction => setForm(f => ({ ...f, construction }))} />
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
            <strong>
              {stockCheck.available ? 'PARTIAL INVENTORY' : 'MANUFACTURING REQUIRED'}
            </strong>{" "}
            — Requested: {form.quantity} | Reserve Existing:{" "}
            {Math.min(Number(form.quantity), stockCheck.available)} | Shortage /
            MO Quantity: {stockCheck.shortage}
          </div>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={() => { setShowNew(false); setStockCheck(null); }}>Cancel</button>
          <button className="btn-secondary" onClick={handleCheckStock}>Check Availability</button>
          <button className="btn-primary" onClick={handleCreateOrder}>Create Order & Fulfill</button>
        </div>
      </Modal>
    </div>
  )
}
