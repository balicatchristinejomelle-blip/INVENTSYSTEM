import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useMemo, useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

import type { FinishedGood } from "../../types"

import { MATERIAL_GRADES, PIPE_PRODUCT_TYPES, normalizedProductType, type PipeProductType } from '../../inventoryCategories';

type ViewMode = "By Batch" | "Individual Pipes"

export default function MarketingFG() {
  const { finishedGoods, productionOrders } = useApp()

  const [productType, setProductType] = useState<'All' | PipeProductType>('All');

  const [status, setStatus] = useState<'Available' | 'Reserved' | 'Ready for Release' | 'Shipped Out / Released'>('Available');

  const [grade, setGrade] = useState("All")

  const [search, setSearch] = useState("")

  const [viewMode, setViewMode] = useState<ViewMode>('By Batch');

  const [selected, setSelected] = useState<FinishedGood | null>(null);

  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  const [page, setPage] = useState(1)

  const [batchPipePage, setBatchPipePage] = useState(1)

  const productTabs: readonly ('All' | PipeProductType)[] = ['All', ...PIPE_PRODUCT_TYPES];

  const visible = useMemo(
    () =>
      finishedGoods.filter(
        (item) =>
          item.qualityStatus !== 'Reject'
    && (productType === 'All' || normalizedProductType(item.product) === productType)
    && (grade === 'All' || item.grade === grade)
    && (status === 'Shipped Out / Released' ? item.releaseStatus === 'Released' : item.releaseStatus !== 'Released' && item.status === status) &&
          ([item.barcode, item.fgId, item.poRef, item.moRef || '', item.batch, item.product, item.grade, item.reservedForOrderRef || ''].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
            matchesRecord(item, search)),
      ),
    [finishedGoods, grade, productType, search, status],
  )

  const visibleBatchIds = useMemo(() => new Set(visible.map(item => item.batch)), [visible]);

  const batches = useMemo(() => Array.from(finishedGoods
    .filter(item => item.qualityStatus !== 'Reject' && visibleBatchIds.has(item.batch))
    .reduce((groups, item) => {
      const group = groups.get(item.batch) || { item, pipes: [] as FinishedGood[] };
      group.pipes.push(item);
      groups.set(item.batch, group);
      return groups;
    }, new Map<string, { item: FinishedGood; pipes: FinishedGood[] }>()).values())
    .sort((a, b) => b.item.productionDate.localeCompare(a.item.productionDate) || b.item.batch.localeCompare(a.item.batch, undefined, { numeric: true })),
  [finishedGoods, visibleBatchIds]);

  const selectedGroup = productType === 'All' ? finishedGoods : finishedGoods.filter(item => normalizedProductType(item.product) === productType);

  const openBatch = batches.find(group => group.item.batch === selectedBatch);

  const currentPipes = pageRecords(visible, page)

  const currentBatches = pageRecords(batches, page)

  const resetPage = () => setPage(1)

  const moFor = (item: FinishedGood) => item.moRef || productionOrders.find(order => order.poNo === item.poRef)?.moRef || '—';

  const batchStatus = (pipes: FinishedGood[]) => {
    const statuses = new Set(pipes.map(item => item.releaseStatus === 'Released' ? 'Shipped Out' : item.status));
    return statuses.size === 1 ? Array.from(statuses)[0] : 'Mixed Statuses';
  };

  return (
    <div className="page-stack">
      <div>
        <div className="section-title">Finished Goods Availability</div>
        <div className="helper-text">Read-only stock visibility calculated from individual physical pipe records.</div>
      </div>
      <CategoryTabs items={productTabs} value={productType} onChange={value => { setProductType(value); resetPage(); }} label="Finished goods product type" />
      <div className="kpi-grid">
        {[
        ['Available', selectedGroup.filter(item => item.status === 'Available').length],
        ['Reserved', selectedGroup.filter(item => item.status === 'Reserved').length],
        ['Ready for Release', selectedGroup.filter(item => item.status === 'Ready for Release').length],
      ].map(([label, value]) => (
          <div className="app-card kpi-card" key={label}>
            <div>{label}</div>
            <strong>{value}</strong>
            <small>individual physical pipes</small>
          </div>
        ))}
      </div>
      <div className="toolbar">
        <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} placeholder="Search barcode, batch, PO, MO, order, or product" />
        <SearchableDropdown
          className="app-select" value={status} onChange={event => { setStatus(event.target.value as typeof status); resetPage(); }}
        >
          <option>Available</option>
          <option>Reserved</option>
          <option>Ready for Release</option>
          <option>Shipped Out / Released</option>
        </SearchableDropdown>
        <SearchableDropdown
          className="app-select" value={grade} onChange={event => { setGrade(event.target.value); resetPage(); }}
        >
          <option>All</option>
          {MATERIAL_GRADES.map(item => <option key={item}>{item}</option>)}
        </SearchableDropdown>
      </div>
      <CategoryTabs items={['By Batch', 'Individual Pipes'] as const} value={viewMode} onChange={value => { setViewMode(value); resetPage(); }} label="Finished goods view mode" />

      {viewMode === "By Batch" ? (
        <>
          <div className="app-card table-scroll desktop-record-table">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>PO / MO</th>
                  <th>Product</th>
                  <th>Grade / Specifications</th>
                  <th>Good</th>
                  <th>Available</th>
                  <th>Reserved</th>
                  <th>Ready</th>
                  <th>Shipped</th>
                  <th>Status</th>
                  <th data-actions>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentBatches.map((group) => {
                  const available = group.pipes.filter(item => item.status === 'Available' && item.releaseStatus !== 'Released').length;

                  const reserved = group.pipes.filter(item => item.status === 'Reserved').length;

                  const ready = group.pipes.filter(item => item.status === 'Ready for Release').length;

                  const shipped = group.pipes.filter(item => item.releaseStatus === 'Released').length;

                  return (
                    <tr key={group.item.batch}>
                      <td className="font-mono">{group.item.batch}</td>
                      <td className="font-mono">
                        {group.item.poRef}
                        <br />
                        <small>{moFor(group.item)}</small>
                      </td>
                      <td>{normalizedProductType(group.item.product)}</td>
                      <td>
                        {group.item.grade} · {group.item.diameter} ·{" "}
                        {group.item.sdr} · {group.item.length}
                      </td>
                      <td>{group.pipes.length}</td>
                      <td>{available}</td>
                      <td>{reserved}</td>
                      <td>{ready}</td>
                      <td>{shipped}</td>
                      <td>
                        <StatusBadge status={batchStatus(group.pipes)} />
                      </td>
                      <td>
                        <button className="btn-secondary btn-compact" onClick={() => { setSelectedBatch(group.item.batch); setBatchPipePage(1); }}>View Batch</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mobile-record-list">
            {currentBatches.map((group) => {
              const available = group.pipes.filter(item => item.status === 'Available' && item.releaseStatus !== 'Released').length;

              const reserved = group.pipes.filter(item => item.status === 'Reserved').length;

              return (
                <article className="app-card mobile-record-card" key={group.item.batch}>
                  <div className="mobile-record-heading">
                    <strong className="font-mono">{group.item.batch}</strong>
                    <StatusBadge status={batchStatus(group.pipes)} />
                  </div>
                  <div className="mobile-record-grid">
                    <Info label="PO / MO" value={`${group.item.poRef} / ${moFor(group.item)}`} />
                    <Info label="Product" value={normalizedProductType(group.item.product)} />
                    <Info label="Grade / Size" value={`${group.item.grade} · ${group.item.diameter} · ${group.item.sdr}`} />
                    <Info label="Good Pipes" value={group.pipes.length} />
                    <Info label="Available" value={available} />
                    <Info label="Reserved" value={reserved} />
                  </div>
                  <button className="btn-primary" onClick={() => { setSelectedBatch(group.item.batch); setBatchPipePage(1); }}>View Batch</button>
                </article>
              )
            })}
          </div>
          {!batches.length && <div className="app-card empty-state">NO FINISHED PIPE BATCHES MATCH THE SELECTED FILTERS</div>}
          <Pagination page={page} totalRecords={batches.length} onPageChange={setPage} noun="batches" />
        </>
      ) : (
        <>
          <div className="app-card table-scroll desktop-record-table">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Pipe ID</th>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>Specifications</th>
                  <th>Location</th>
                  <th>PO</th>
                  <th>Status</th>
                  <th data-actions>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentPipes.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono">{item.fgId}</td>
                    <td className="font-mono">{item.barcode}</td>
                    <td>{normalizedProductType(item.product)}</td>
                    <td>
                      {item.grade} · {item.diameter} · {item.sdr} ·{" "}
                      {item.length}
                    </td>
                    <td>{item.currentLocation || "Not Yet Assigned"}</td>
                    <td className="font-mono">{item.poRef}</td>
                    <td>
                      <StatusBadge status={item.releaseStatus === 'Released' ? 'Shipped Out' : item.status} />
                    </td>
                    <td>
                      <button className="btn-secondary btn-compact" onClick={() => setSelected(item)}>View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-record-list">
            {currentPipes.map((item) => (
              <article className="app-card mobile-record-card" key={item.id}>
                <div className="mobile-record-heading">
                  <strong className="font-mono">{item.barcode}</strong>
                  <StatusBadge status={item.releaseStatus === 'Released' ? 'Shipped Out' : item.status} />
                </div>
                <div className="mobile-record-grid">
                  <Info label="Product" value={normalizedProductType(item.product)} />
                  <Info label="Grade / Size" value={`${item.grade} · ${item.diameter} · ${item.sdr}`} />
                  <Info label="Location" value={item.currentLocation || 'Not Yet Assigned'} />
                  <Info label="Customer Order" value={item.reservedForOrderRef || '—'} />
                </div>
                <button className="btn-secondary" onClick={() => setSelected(item)}>View Details</button>
              </article>
            ))}
          </div>
          {!visible.length && <div className="app-card empty-state">NO FINISHED PIPES MATCH THE SELECTED FILTERS</div>}
          <Pagination page={page} totalRecords={visible.length} onPageChange={setPage} noun="pipes" />
        </>
      )}

      {openBatch && (
        <Modal open title={`Finished Pipe Batch — ${openBatch.item.batch}`} onClose={() => setSelectedBatch(null)} width="900px">
          <div className="page-stack">
            <div className="app-card detail-card">
              <div className="section-title">Batch Summary</div>
              <div className="responsive-grid">
                <Info label="Batch" value={openBatch.item.batch} />
                <Info label="PO / MO" value={`${openBatch.item.poRef} / ${moFor(openBatch.item)}`} />
                <Info label="Product" value={normalizedProductType(openBatch.item.product)} />
                <Info label="Grade" value={openBatch.item.grade} />
                <Info label="Specifications" value={`${openBatch.item.diameter} · ${openBatch.item.sdr} · ${openBatch.item.length}`} />
                <Info label="Good Pipes" value={openBatch.pipes.length} />
              </div>
            </div>
            <div className="mobile-record-list always-visible-mobile">
              {pageRecords(openBatch.pipes, batchPipePage).map((item) => (
                <article className="app-card mobile-record-card" key={item.id}>
                  <div className="mobile-record-heading">
                    <strong className="font-mono">{item.barcode}</strong>
                    <StatusBadge status={item.releaseStatus === 'Released' ? 'Shipped Out' : item.status} />
                  </div>
                  <div className="mobile-record-grid">
                    <Info label="Product / Grade" value={`${normalizedProductType(item.product)} · ${item.grade}`} />
                    <Info label="Size" value={`${item.diameter} · ${item.sdr} · ${item.length}`} />
                    <Info label="Location" value={item.currentLocation || 'Not Yet Assigned'} />
                    <Info label="Customer Order" value={item.reservedForOrderRef || '—'} />
                  </div>
                  <button className="btn-secondary" onClick={() => { setSelectedBatch(null); setSelected(item); }}>View Details</button>
                </article>
              ))}
            </div>
            <div className="app-card table-scroll desktop-record-table">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>Product / Grade</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Customer Order</th>
                    <th data-actions>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords(openBatch.pipes, batchPipePage).map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono">{item.barcode}</td>
                      <td>
                        {normalizedProductType(item.product)} · {item.grade}
                      </td>
                      <td>
                        {item.diameter} · {item.sdr} · {item.length}
                      </td>
                      <td>
                        <StatusBadge status={item.releaseStatus === 'Released' ? 'Shipped Out' : item.status} />
                      </td>
                      <td>{item.currentLocation || "Not Yet Assigned"}</td>
                      <td>{item.reservedForOrderRef || "—"}</td>
                      <td>
                        <button className="btn-secondary btn-compact" onClick={() => { setSelectedBatch(null); setSelected(item); }}>View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={batchPipePage} totalRecords={openBatch.pipes.length} onPageChange={setBatchPipePage} noun="pipes" />
          </div>
        </Modal>
      )}

      {selected && (
        <Modal open title={`Finished Pipe — ${selected.fgId}`} onClose={() => setSelected(null)} width="620px">
          <div className="page-stack">
            <DetailSection title="Identification">
              <Info label="Pipe ID" value={selected.fgId} />
              <Info label="Barcode" value={selected.barcode} />
              <Info label="Batch" value={selected.batch} />
            </DetailSection>
            <DetailSection title="Product Specification">
              <Info label="Product" value={normalizedProductType(selected.product)} />
              <Info label="Grade" value={selected.grade} />
              <Info label="Size / SDR-Thickness / Length" value={`${selected.diameter} · ${selected.sdr} · ${selected.length}`} />
              <Info label="Color / Stripe" value={`${selected.color} · ${selected.stripe}`} />
            </DetailSection>
            <DetailSection title="Production & Inventory">
              <Info label="PO / MO" value={`${selected.poRef} / ${moFor(selected)}`} />
              <Info label="Production Date" value={selected.productionDate} />
              <Info label="Inventory Status" value={selected.releaseStatus === 'Released' ? 'Shipped Out' : selected.status} />
              <Info label="Current Location" value={selected.currentLocation || 'Not Yet Assigned'} />
            </DetailSection>
            <DetailSection title="Customer / Shipment">
              <Info label="Customer Order" value={selected.reservedForOrderRef || '—'} />
              <Info label="Buyer" value={selected.buyer || "—"} />
              <Info label="Released At" value={selected.releasedAt ? new Date(selected.releasedAt).toLocaleString('en-PH') : 'Not released'} />
              <Info label="Shipment Reference" value={selected.shipmentReference || selected.releaseReference || '—'} />
            </DetailSection>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="app-card detail-card">
      <div className="section-title">{title}</div>
      <div className="responsive-grid">{children}</div>
    </section>
  )
}

function Info({ label, value }: { label: string ; value: React.ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  )
}
