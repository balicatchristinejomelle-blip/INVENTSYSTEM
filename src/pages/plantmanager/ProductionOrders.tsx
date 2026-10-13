import { matchesRecord } from "../../components/RecordSearch"

import React, { useEffect, useMemo, useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import ManufacturingOrderDetails from '../../components/ManufacturingOrderDetails';

import DocumentViewer from "../../components/DocumentViewer"

import { productionOrderDocument } from '../../documentPrint';

import SearchableSelect from '../../components/SearchableSelect';

import Pagination, { pageRecords } from '../../components/Pagination';

import {
  constructionForProduct,
  HPAI_PRODUCT_MASTER,
  lengthsForForm,
  normalizeProductSpecification,
  sizeLabelForProduct,
  sizesForProduct,
} from "../../productMaster"

import type { MaterialGrade, ProductSpecification, ProductType, ProductionOrder } from '../../types';

export default function PMProductionOrders() {
  const { productionOrders, manufacturingOrders, pellets, orders, materialRequests, createProductionOrder, createStockReplenishmentPO, navigate } = useApp();

  const [viewId, setViewId] = useState<string | null>(null)

  const [showMO, setShowMO] = useState<string | null>(null)

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  const [search, setSearch] = useState("")

  const [moPage, setMoPage] = useState(1)

  const [poPage, setPoPage] = useState(1)

  const [showReplenishment, setShowReplenishment] = useState(false);

  const [replenishmentError, setReplenishmentError] = useState('');

  const [replenishment, setReplenishment] = useState({ productType: '' as '' | ProductType, materialGrade: '' as '' | MaterialGrade, size: '', sdr: '', productForm: '' as '' | ProductSpecification['productForm'], length: '', color: '', stripe: '', pipeConstruction: '' as '' | ProductSpecification['pipeConstruction'], targetQty: '', requiredDate: '', productionLine: 'To Be Assigned', priority: 'Normal' as ProductionOrder['priority'], reason: '' });

  const viewPO = productionOrders.find((p) => p.id === viewId)

  const viewMO = manufacturingOrders.find(m => m.id === showMO);

  const documentPO = productionOrders.find(p => p.id === documentAction?.id);

  const relatedPO = viewMO ? productionOrders.find(order => order.moRef === viewMO.moNo) : undefined;

  const relatedOrder = viewMO ? orders.find(order => order.orderNo === viewMO.orderRef) : undefined;

  const relatedRequest = viewMO ? materialRequests.find(request => request.moRef === viewMO.moNo) : undefined;

  const virgin = pellets.filter(p => p.type === 'Virgin' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const configuredSpecifications = useMemo(() => {
    try { return (JSON.parse(window.localStorage.getItem('hpai:product-specifications-v1') || '[]') as unknown[]).map(normalizeProductSpecification).filter((item): item is ProductSpecification => item !== null && item.active); }
    catch { return []; }
  }, [showReplenishment]);

  const configuredPolytubeSizes = configuredSpecifications.filter(item => item.productType === 'Polytube').map(item => item.size);

  const sizeOptions = replenishment.productType ? sizesForProduct(replenishment.productType, configuredPolytubeSizes) : [];

  const lengthOptions = lengthsForForm(replenishment.productForm);

  const query = search.trim().toLowerCase()

  const filteredMOs = manufacturingOrders.filter(
    (item) =>
      !query || [item.moNo, item.orderRef, item.poRef || '', item.product, item.grade, item.diameter, item.sdr, item.length, item.color, item.stripe, item.status, item.requiredDate].some(value => String(value).toLowerCase().includes(query)) ||
        matchesRecord(item, query),
  )

  const filteredPOs = productionOrders.filter(
    (item) =>
      !query || [item.poNo, item.source || 'Manufacturing Order', item.moRef, item.product, item.grade, item.diameter, item.sdr, item.length, item.priority, item.requiredDate, item.status, item.replenishmentReason || ''].some(value => String(value).toLowerCase().includes(query)) ||
        matchesRecord(item, query),
  )

  const submitReplenishment = () => {
    if (!replenishment.productType || !replenishment.materialGrade || !replenishment.size || !replenishment.sdr || !replenishment.productForm || !replenishment.length || !replenishment.color || !replenishment.stripe || !replenishment.pipeConstruction || Number(replenishment.targetQty) <= 0 || !replenishment.requiredDate || !replenishment.reason.trim()) { setReplenishmentError('Complete every required Stock Replenishment field.'); return; }
    const specification: ProductSpecification = { id: `adhoc-${Date.now()}`, productType: replenishment.productType, materialGrade: replenishment.materialGrade, size: replenishment.size, sizeUnit: replenishment.productType === 'CTS HDPE Pipe' || replenishment.productType === 'Spiral Pipe' ? 'in' : replenishment.productType === 'Polytube' ? 'configured' : 'mm', sdr: replenishment.sdr, productForm: replenishment.productForm, straightLength: replenishment.productForm === 'Straight Length' ? replenishment.length : undefined, coilLength: replenishment.productForm === 'Coil' ? replenishment.length : undefined, color: replenishment.color, stripe: replenishment.stripe, pipeConstruction: replenishment.pipeConstruction, active: true };
    const result = createStockReplenishmentPO({ specification, targetQty: Number(replenishment.targetQty), requiredDate: replenishment.requiredDate, productionLine: replenishment.productionLine, priority: replenishment.priority, reason: replenishment.reason });
    if (!result.success) { setReplenishmentError(result.error || 'Unable to create Stock Replenishment PO.'); return; }
    setShowReplenishment(false); setReplenishmentError('');
  };

  useEffect(() => {
    const requestedId = window.sessionStorage.getItem('hpai:production-order-view-v1');
    if (requestedId) { setViewId(requestedId); window.sessionStorage.removeItem('hpai:production-order-view-v1'); }
  }, []);

  return (
    <div>
      <div className="record-filter-bar">
        <input className="app-input record-search" type="search" value={search} onChange={event => { setSearch(event.target.value); setMoPage(1); setPoPage(1); }} placeholder="Search PO, source, MO, product, grade, size, SDR / Thickness, priority, date, or status" />
        <button className="btn-primary" onClick={() => setShowReplenishment(true)}>Create Stock Replenishment PO</button>
      </div>
      {/* MO Review */}
      {manufacturingOrders.filter(m => m.status === 'New').length > 0 && (
        <div className="alert-info mb-4" style={{ fontSize: 12 }}>
          <strong>New Manufacturing Orders pending review:</strong>{" "}
          {manufacturingOrders.filter(m => m.status === 'New').map(m => m.moNo).join(', ')}
        </div>
      )}

      {/* New MOs to act on */}
      <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Manufacturing Orders — Pending Action</h3>
        <div className="app-card" style={{ overflow: "hidden" }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>MO No.</th>
                <th>Product</th>
                <th>Size</th>
                <th>To Mfr.</th>
                <th>Expected Usage</th>
                <th>Avail. Pellets</th>
                <th>Status</th>
                <th data-actions>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords(filteredMOs, moPage).map((mo) => {
                const existingPO = productionOrders.find(order => order.moRef === mo.moNo);

                return (
                  <tr key={mo.id} className="table-row-hover">
                    <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                      {mo.moNo}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {mo.product} {mo.diameter}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {mo.length} {mo.sdr}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 600 }}>
                      {mo.toManufactureQty}
                    </td>
                    <td style={{ fontSize: 12 }}>No BOM defined</td>
                    <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                      {virgin.toFixed(0)} kg
                    </td>
                    <td>
                      <StatusBadge status={mo.status} size="sm" />
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="button-group">
                        {mo.status === 'New' && !existingPO && <button className="btn-primary btn-compact" onClick={() => createProductionOrder(mo.id)}>Create Production Order</button>}
                        <button className="btn-secondary btn-compact" onClick={() => setShowMO(mo.id)}>View MO</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination page={moPage} totalRecords={filteredMOs.length} onPageChange={setMoPage} noun="manufacturing orders" />
        </div>
      </section>

      {/* Production Orders */}
      <section>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Production Orders</h3>
        <div className="app-card" style={{ overflow: "hidden" }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>PO No.</th>
                <th>MO Ref</th>
                <th>Product</th>
                <th>Progress</th>
                <th>Pellet</th>
                <th>Priority</th>
                <th>Req. Date</th>
                <th>Status</th>
                <th data-actions>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords(filteredPOs, poPage).map((po) => {
                const pct = po.targetQty > 0 ? Math.round(po.completedQty / po.targetQty * 100) : 0;

                return (
                  <tr key={po.id} className="table-row-hover" onClick={() => setViewId(po.id)}>
                    <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                      {po.poNo}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--accent-blue)" }}>
                      {po.moRef}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {po.product} {po.diameter}
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                        {po.completedQty} / {po.targetQty} ({pct}%)
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#2563eb' }} />
                      </div>
                    </td>
                    <td style={{ fontSize: 11 }}>{po.pelletType}</td>
                    <td>
                      <span className={`badge-${po.priority === 'Urgent' ? 'red' : po.priority === 'High' ? 'amber' : 'gray'} px-2 py-0.5 text-[11px] rounded font-medium`}>
                        {po.priority}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{po.requiredDate}</td>
                    <td>
                      <StatusBadge status={po.status} size="sm" />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="button-group">
                        <button className="btn-secondary btn-compact" onClick={() => setViewId(po.id)}>View Details</button>
                        <button className="btn-secondary btn-compact" onClick={() => setDocumentAction({ id: po.id, autoPrint: true })}>Print</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <Pagination page={poPage} totalRecords={filteredPOs.length} onPageChange={setPoPage} noun="production orders" />
        </div>
      </section>

      {/* PO Detail Modal */}
      {showMO && viewMO && (
        <Modal open title="" onClose={() => setShowMO(null)} width="900px">
          <ManufacturingOrderDetails
            mo={viewMO}
            customerOrder={relatedOrder}
            productionOrder={relatedPO}
            pellets={pellets}
            materialRequest={relatedRequest}
            role="plantmanager"
            onBack={() => setShowMO(null)}
            onViewProductionOrder={relatedPO ? () => {
              setViewId(relatedPO.id);
              setShowMO(null);
            } : undefined}
            onCreateProductionOrder={() => createProductionOrder(viewMO.id)}
            onRequestPellets={() => {
              setShowMO(null);
              navigate('pm-requests');
            }}
          />
        </Modal>
      )}

      {viewId && viewPO && (
        <Modal open title={`Production Order — ${viewPO.poNo}`} onClose={() => setViewId(null)} width="620px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[['PO No.', viewPO.poNo], ['Source', viewPO.source || 'Manufacturing Order'], ['MO Reference', viewPO.moRef], ['Product', viewPO.product], ['Diameter', viewPO.diameter], ['Length', viewPO.length], ['SDR / Thickness', viewPO.sdr], ['Grade', viewPO.grade], ['Color', viewPO.color], ['Stripe', viewPO.stripe], ['Target Qty', viewPO.targetQty], ['Completed Qty', viewPO.completedQty], ['Expected Material', 'No BOM defined'], ['Actual Pellet Loaded', `${viewPO.loadedKg} kg`], ['Production Line', viewPO.productionLine], ['Priority', viewPO.priority], ['Required Date', viewPO.requiredDate], ['Replenishment Reason', viewPO.replenishmentReason || '—']].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {l}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {String(v)}
                </div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Status</div>
              <StatusBadge status={viewPO.status} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Progress</div>
            <div className="progress-bar" style={{ height: 10 }}>
              <div className="progress-fill" style={{ width: `${viewPO.targetQty > 0 ? Math.round(viewPO.completedQty/viewPO.targetQty*100) : 0}%`, background: '#2563eb' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {viewPO.completedQty} / {viewPO.targetQty} units (
              {viewPO.targetQty > 0 ? Math.round(viewPO.completedQty/viewPO.targetQty*100) : 0}
              %)
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setViewId(null)}>Close</button>
            <button className="btn-secondary" onClick={() => setDocumentAction({ id: viewPO.id, autoPrint: false })}>View Document</button>
            <button className="btn-primary" onClick={() => setDocumentAction({ id: viewPO.id, autoPrint: true })}>Print</button>
          </div>
        </Modal>
      )}
      <Modal open={showReplenishment} title="Create Production Order · Stock Replenishment" onClose={() => setShowReplenishment(false)} width="760px">
        <div className="page-stack">
          <div className="alert-info">
            <strong>Production Source: Stock Replenishment</strong>
            <div>Choose from the authoritative Product Master. Creating this PO does not increase Finished Goods stock.</div>
          </div>
          <div className="form-grid">
            <label>
              Product Type *
              <SearchableSelect value={replenishment.productType} options={HPAI_PRODUCT_MASTER.products} ariaLabel="Replenishment Product Type" placeholder="Search product type..." onChange={productType => setReplenishment(value => ({ ...value, productType: productType as ProductType, materialGrade: '', size: '', sdr: '', productForm: '', length: '', color: '', stripe: '', pipeConstruction: productType ? constructionForProduct(productType) : '' }))} />
            </label>
            <label>
              Material Grade *
              <SearchableSelect value={replenishment.materialGrade} options={HPAI_PRODUCT_MASTER.materialGrades} disabled={!replenishment.productType} ariaLabel="Replenishment Material Grade" placeholder="Search material grade..." onChange={materialGrade => setReplenishment(value => ({ ...value, materialGrade: materialGrade as MaterialGrade, size: '', sdr: '', productForm: '', length: '' }))} />
            </label>
            <label>
              {sizeLabelForProduct(replenishment.productType)} *
              <SearchableSelect
                value={replenishment.size}
                options={sizeOptions}
                disabled={!replenishment.productType || !sizeOptions.length}
                ariaLabel={`Replenishment ${sizeLabelForProduct(replenishment.productType)}`}
                placeholder="Search size..."
                onChange={size => setReplenishment(value => ({ ...value, size, sdr: '', productForm: '', length: '' }))}
              />
            </label>
            <label>
              SDR / Thickness *
              <SearchableSelect value={replenishment.sdr} options={HPAI_PRODUCT_MASTER.sdrRatings} disabled={!replenishment.size} ariaLabel="Replenishment SDR / Thickness" placeholder="Search SDR / Thickness..." onChange={sdr => setReplenishment(value => ({ ...value, sdr, productForm: '', length: '' }))} />
            </label>
            <label>
              Product Form *
              <SearchableSelect value={replenishment.productForm} options={HPAI_PRODUCT_MASTER.productForms} disabled={!replenishment.sdr} ariaLabel="Replenishment Product Form" placeholder="Search product form..." onChange={productForm => setReplenishment(value => ({ ...value, productForm: productForm as ProductSpecification['productForm'], length: '' }))} />
            </label>
            <label>
              {replenishment.productForm === 'Coil' ? 'Coil Length' : 'Straight Pipe Length'}{" "}
              *
              <SearchableSelect value={replenishment.length} options={lengthOptions} disabled={!replenishment.productForm} ariaLabel="Replenishment Length" placeholder="Search length..." onChange={length => setReplenishment(value => ({ ...value, length }))} />
            </label>
            <label>
              Product Color *
              <SearchableSelect value={replenishment.color} options={HPAI_PRODUCT_MASTER.pipeColors} disabled={!replenishment.length} ariaLabel="Replenishment Product Color" placeholder="Search product color..." onChange={color => setReplenishment(value => ({ ...value, color, stripe: '' }))} />
            </label>
            <label>
              Stripe Color *
              <SearchableSelect value={replenishment.stripe} options={HPAI_PRODUCT_MASTER.stripeColors} disabled={!replenishment.color} ariaLabel="Replenishment Stripe Color" placeholder="Search stripe color..." onChange={stripe => setReplenishment(value => ({ ...value, stripe }))} />
            </label>
            <label>
              Pipe Construction *
              <SearchableSelect value={replenishment.pipeConstruction} options={HPAI_PRODUCT_MASTER.constructions} disabled={!replenishment.productType} ariaLabel="Replenishment Pipe Construction" placeholder="Search pipe construction..." onChange={pipeConstruction => setReplenishment(value => ({ ...value, pipeConstruction: pipeConstruction as ProductSpecification['pipeConstruction'] }))} />
            </label>
            <label>
              Target Quantity *
              <input className="app-input" type="number" min="1" value={replenishment.targetQty} onChange={event => setReplenishment(value => ({ ...value, targetQty: event.target.value }))} />
            </label>
            <label>
              Required Date *
              <input className="app-input" type="date" value={replenishment.requiredDate} onChange={event => setReplenishment(value => ({ ...value, requiredDate: event.target.value }))} />
            </label>
            <label>
              Production Line
              <SearchableSelect value={replenishment.productionLine} options={['To Be Assigned', 'Line 1', 'Line 2']} ariaLabel="Production Line" placeholder="Search production line..." clearable={false} onChange={productionLine => setReplenishment(value => ({ ...value, productionLine }))} />
            </label>
            <label>
              Priority
              <SearchableSelect value={replenishment.priority} options={['Normal', 'High', 'Urgent']} ariaLabel="Priority" placeholder="Search priority..." clearable={false} onChange={priority => setReplenishment(value => ({ ...value, priority: priority as ProductionOrder['priority'] }))} />
            </label>
            <label className="form-grid-span-2">
              Reason *
              <textarea className="app-input" value={replenishment.reason} onChange={event => setReplenishment(value => ({ ...value, reason: event.target.value }))} />
            </label>
          </div>
          {replenishmentError && <div className="alert-error">{replenishmentError}</div>}
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowReplenishment(false)}>Cancel</button>
            <button className="btn-primary" onClick={submitReplenishment}>Create Stock Replenishment PO</button>
          </div>
        </div>
      </Modal>
      <DocumentViewer open={!!documentAction} document={documentPO ? productionOrderDocument(documentPO) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
    </div>
  )
}
