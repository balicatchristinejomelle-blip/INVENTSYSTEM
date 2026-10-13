import RecordList from "../../components/RecordList"

import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useEffect, useMemo, useState } from "react"

import { useApp } from "../../store"

import Modal from "../../components/Modal"

import StatusBadge from "../../components/StatusBadge"

import BarcodeLabel, { printBarcodeBatch } from '../../components/BarcodeLabel';

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

import { MATERIAL_GRADES, PIPE_PRODUCT_TYPES, normalizedProductType, type PipeProductType } from '../../inventoryCategories';

import type { FinishedGood, ProductSpecification, StockTarget } from '../../types';

import {
  normalizeProductSpecification,
  sortSizes,
  specificationKey,
  specificationKeyFromRecord,
  specificationLength,
} from "../../productMaster"

type Destination = 'All Statuses' | 'Awaiting Label / Storage' | 'Available' | 'Reserved' | 'Ready for Ship Out' | 'Released / Shipped Out';

const DESTINATIONS: readonly Destination[] = ['All Statuses', 'Awaiting Label / Storage', 'Available', 'Reserved', 'Ready for Ship Out', 'Released / Shipped Out'];

const matchesDestination = (item: FinishedGood, destination: Destination) => {
  if (destination === 'All Statuses') return true;
  if (destination === 'Released / Shipped Out') return item.releaseStatus === 'Released';
  if (item.releaseStatus === 'Released') return false;
  if (destination === 'Awaiting Label / Storage') return item.locationStatus === 'Awaiting Storage';
  if (destination === 'Reserved') return item.status === 'Reserved';
  if (destination === 'Ready for Ship Out') return item.status === 'Ready for Release';
  return item.status === 'Available';
};

export default function PMFinishedGoods() {
  const { finishedGoods, rejectedMaterials, productionOrders, markFinishedGoodBarcodePrinted, rejectFinishedGood, createStockReplenishmentPO, navigate } = useApp();

  const [search, setSearch] = useState("")

  const [status, setStatus] = useState<Destination>('All Statuses');

  const [productType, setProductType] = useState<'All' | PipeProductType>('All');

  const [grade, setGrade] = useState("All")

  const [location, setLocation] = useState("All")

  const [size, setSize] = useState("All")

  const [viewMode, setViewMode] = useState<'By Batch' | 'Individual Pipes'>('By Batch');

  const [page, setPage] = useState(1)

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const [batchPipePage, setBatchPipePage] = useState(1)

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [rejecting, setRejecting] = useState(false)

  const [rejectWeight, setRejectWeight] = useState("")

  const [rejectReason, setRejectReason] = useState("")

  const [qualityError, setQualityError] = useState("")

  const [replenishmentTarget, setReplenishmentTarget] = useState<StockTarget | null>(null);

  const [replenishmentForm, setReplenishmentForm] = useState({ targetQty: '', requiredDate: new Date().toISOString().slice(0, 10), productionLine: 'To Be Assigned', priority: 'Normal' as 'Normal' | 'High' | 'Urgent', reason: 'Available stock is below the configured minimum.' });

  const [replenishmentFeedback, setReplenishmentFeedback] = useState('');

  const [creatingReplenishment, setCreatingReplenishment] = useState(false);

  const [targetStockFilter, setTargetStockFilter] = useState<'All' | 'Normal' | 'Low Stock' | 'Out of Stock' | 'Replenishment In Progress'>('All');

  useEffect(() => {
    const requestedId = window.sessionStorage.getItem('hpai:finished-pipe-view-v1');
    if (requestedId) { setSelectedId(requestedId); window.sessionStorage.removeItem('hpai:finished-pipe-view-v1'); }
  }, []);

  const productSpecifications = useMemo(() => {
    try { return (JSON.parse(window.localStorage.getItem('hpai:product-specifications-v1') || '[]') as unknown[]).map(normalizeProductSpecification).filter((spec): spec is ProductSpecification => spec !== null); }
    catch { return []; }
  }, []);

  const stockTargets = useMemo(() => {
    try { return JSON.parse(window.localStorage.getItem('hpai:stock-targets-v1') || '[]') as StockTarget[]; }
    catch { return []; }
  }, []);

  const selected = finishedGoods.find(item => item.id === selectedId);

  const productTabs: readonly ('All' | PipeProductType)[] = ['All', ...PIPE_PRODUCT_TYPES];

  const productEligible = useMemo(() => finishedGoods.filter(item => productType === 'All' || normalizedProductType(item.product) === productType), [finishedGoods, productType]);

  const gradeOptions = MATERIAL_GRADES

  const sizeOptions = useMemo(
    () => sortSizes(productEligible.map((item) => item.diameter)),
    [productEligible],
  )

  const locationOptions = useMemo(() => Array.from(new Set(productEligible.map(item => item.currentLocation))).filter(Boolean).sort(), [productEligible]);

  const filtered = useMemo(
    () =>
      finishedGoods.filter(
        (f) =>
          f.qualityStatus !== 'Reject'
    &&
    (productType === 'All' || normalizedProductType(f.product) === productType)
    && matchesDestination(f, status)
    && (grade === 'All' || f.grade === grade)
    && (size === 'All' || f.diameter === size)
    && (location === 'All' || f.currentLocation === location) &&
          ([f.barcode, f.fgId, f.poRef, f.moRef || '', f.product, f.grade, f.diameter, f.sdr, f.length, f.productForm, f.color, f.stripe, f.reservedForOrderRef || '', f.currentLocation].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
            matchesRecord(f, search)),
      ),
    [finishedGoods, grade, location, productType, search, size, status],
  )

  const visibleBatchIds = useMemo(() => new Set(filtered.map(item => item.batch)), [filtered]);

  const batches = useMemo(() => Array.from(finishedGoods
    .filter(item => item.qualityStatus !== 'Reject' && visibleBatchIds.has(item.batch))
    .reduce((groups, item) => {
      const existing = groups.get(item.batch) || { item, pipes: [] as FinishedGood[] };
      existing.pipes.push(item);
      groups.set(item.batch, existing);
      return groups;
    }, new Map<string, { item: FinishedGood; pipes: FinishedGood[] }>()).values())
    .sort((a, b) => a.item.batch.localeCompare(b.item.batch, undefined, { numeric: true })), [finishedGoods, visibleBatchIds]);

  const batchSummary = (group: { item: FinishedGood; pipes: FinishedGood[] }) => {
    const rejected = rejectedMaterials.filter(item => item.batch === group.item.batch).reduce((sum, item) => sum + item.quantity, 0);
    const available = group.pipes.filter(item => item.status === 'Available' && item.releaseStatus !== 'Released').length;
    const reserved = group.pipes.filter(item => item.status === 'Reserved').length;
    const ready = group.pipes.filter(item => item.status === 'Ready for Release').length;
    const shipped = group.pipes.filter(item => item.releaseStatus === 'Released').length;
    const statuses = new Set(group.pipes.map(item => item.releaseStatus === 'Released' ? 'Shipped Out' : item.status));
    const locations = new Set(group.pipes.map(item => item.currentLocation).filter(Boolean));
    return {
      rejected, available, reserved, ready, shipped,
      produced: group.pipes.length + rejected,
      status: statuses.size === 1 ? Array.from(statuses)[0] : 'Mixed Statuses',
      location: locations.size > 1 ? 'Multiple Locations' : Array.from(locations)[0] || 'Not Yet Assigned',
    };
  };

  const manufacturingOrderFor = (item: FinishedGood) =>
    item.moRef || productionOrders.find(order => order.poNo === item.poRef)?.moRef || '—';

  const selectedBatch = batches.find(group => group.item.batch === selectedBatchId);

  const total = finishedGoods.filter(f => f.releaseStatus !== 'Released' && f.qualityStatus === 'Pass').reduce((sum, f) => sum + f.quantity, 0);

  const available = finishedGoods.reduce((sum, f) => sum + f.availableQty, 0);

  const reserved = finishedGoods.reduce((sum, f) => sum + f.reservedQty, 0);

  const unprinted = filtered.filter(item => item.printStatus === 'Not Printed');

  const currentRecords = pageRecords(filtered, page)

  const currentBatches = pageRecords(batches, page)

  const resetPage = () => setPage(1)

  const exactOnHand = (spec: ProductSpecification) => finishedGoods
    .filter(item => item.status === 'Available' && item.releaseStatus !== 'Released' && item.qualityStatus !== 'Reject' && specificationKeyFromRecord(item) === specificationKey(spec))
    .reduce((sum, item) => sum + item.quantity, 0);

  const stockTargetRows = stockTargets.flatMap(target => {
    if (target.inventoryType !== 'Finished Pipe') return [];
    const spec = productSpecifications.find(item => item.id === target.productSpecificationId && item.active);
    if (!spec || target.status !== 'Active' || target.plant !== 'Branch Plant') return [];
    const onHand = exactOnHand(spec);
    const openPO = productionOrders.find(item => item.source === 'Stock Replenishment' && !['Completed', 'Cancelled'].includes(item.status) && specificationKeyFromRecord(item) === specificationKey(spec));
    const stockStatus = openPO ? 'Replenishment In Progress' : onHand === 0 ? 'Out of Stock' : onHand <= target.minimumStock ? 'Low Stock' : 'Normal';
    return [{ target, spec, onHand, openPO, stockStatus }];
  });

  const visibleStockTargetRows = stockTargetRows.filter(
    ({ spec, openPO, stockStatus }) =>
      (targetStockFilter === 'All' || stockStatus === targetStockFilter) &&
      ([spec.productType, spec.materialGrade, spec.size, spec.sdr, specificationLength(spec), spec.color, spec.stripe, openPO?.poNo || '', stockStatus].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(spec, search)),
  )

  const beginReplenishment = (target: StockTarget, spec: ProductSpecification, onHand: number) => {
    setReplenishmentTarget(target);
    setReplenishmentFeedback('');
    setReplenishmentForm(value => ({ ...value, targetQty: String(Math.max(1, target.targetStock - onHand)) }));
  };

  const clearFilters = () => {
    setSearch(''); setProductType('All'); setGrade('All'); setSize('All'); setLocation('All'); setStatus('All Statuses'); resetPage();
  };

  const printAllUnprinted = () => {
    const printedIds = printBarcodeBatch(unprinted.map(item => ({
      value: item.barcode,
      recordId: item.id,
      recordLabel: item.fgId,
    })));
    printedIds.forEach(markFinishedGoodBarcodePrinted);
  };

  return (
    <div className="page-stack">
      <div className="kpi-grid">
        {[['Physical On-Hand', total], ['Available for New Orders', available], ['Reserved', reserved], ['Ready for Ship Out', finishedGoods.filter(f => f.status === 'Ready for Release' && f.releaseStatus !== 'Released').length], ['Shipped Out', finishedGoods.filter(f => f.releaseStatus === 'Released').length]].map(([label, value]) => (
          <div className="app-card kpi-card" key={label}>
            <div>{label}</div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {stockTargetRows.length > 0 && (
        <div className="low-stock-panel">
          <div className="section-title">Finished Pipe Stock Targets</div>
          <CategoryTabs items={['All', 'Normal', 'Low Stock', 'Out of Stock', 'Replenishment In Progress'] as const} value={targetStockFilter} onChange={value => { setTargetStockFilter(value); resetPage(); }} label="Finished pipe stock target state" />
          {
            <RecordList
              records={visibleStockTargetRows}
              query={search + targetStockFilter}
              render={({ target, spec, onHand, openPO, stockStatus }) => (
                <div className="low-stock-row" key={target.id}>
                  <div>
                    <StatusBadge status={stockStatus.toUpperCase()} />
                    <strong>
                      {spec.productType} · {spec.materialGrade} · {spec.size} ·{" "}
                      {spec.sdr} · {specificationLength(spec)}
                    </strong>
                    <span>
                      {onHand.toLocaleString()} available · minimum{" "}
                      {target.minimumStock.toLocaleString()} · target{" "}
                      {target.targetStock.toLocaleString()} units
                      {onHand <= target.minimumStock ? ` · suggested ${Math.max(0, target.targetStock - onHand).toLocaleString()} units` : ''}
                      {openPO ? ` · ${openPO.poNo}` : ""}
                    </span>
                  </div>
                  {openPO ? <button className="btn-secondary" onClick={() => { window.sessionStorage.setItem('hpai:production-order-view-v1', openPO.id); navigate('pm-production-orders'); }}>View PO</button> : onHand <= target.minimumStock ? <button className="btn-primary" onClick={() => beginReplenishment(target, spec, onHand)}>Create Replenishment PO</button> : <span className="helper-text">No action required</span>}
                </div>
              )}
            />
          }
          {!visibleStockTargetRows.length && <div className="empty-state">No finished-pipe targets match this filter or search.</div>}
        </div>
      )}
      <CategoryTabs items={productTabs} value={productType} onChange={value => { setProductType(value); setGrade('All'); setSize('All'); resetPage(); }} label="Finished pipe product type" />
      <div className="filter-panel">
        <div className="filter-row">
          <input className="app-input" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search product, grade, size, SDR / Thickness, length, barcode, batch, PO, MO, customer, status, or location" />
          <SearchableDropdown
            className="app-select" aria-label="Material grade" value={grade} onChange={e => { setGrade(e.target.value); resetPage(); }}
          >
            <option value="All">All Material Grades</option>
            {gradeOptions.map(item => <option key={item}>{item}</option>)}
          </SearchableDropdown>
          <SearchableDropdown
            className="app-select" aria-label="Size or diameter" value={size} onChange={e => { setSize(e.target.value); resetPage(); }}
          >
            <option value="All">All Sizes / Diameters</option>
            {sizeOptions.map(item => <option key={item}>{item}</option>)}
          </SearchableDropdown>
        </div>
        <div className="filter-row">
          <SearchableDropdown
            className="app-select" aria-label="Status" value={status} onChange={e => { setStatus(e.target.value as Destination); resetPage(); }}
          >
            {DESTINATIONS.map(item => <option key={item}>{item}</option>)}
          </SearchableDropdown>
          <SearchableDropdown
            className="app-select" aria-label="Location" value={location} onChange={e => { setLocation(e.target.value); resetPage(); }}
          >
            <option value="All">All Locations</option>
            {locationOptions.map(item => <option key={item}>{item}</option>)}
          </SearchableDropdown>
        </div>
        <div className="filter-actions">
        <CategoryTabs items={['By Batch', 'Individual Pipes'] as const} value={viewMode} onChange={value => { setViewMode(value); resetPage(); }} label="Finished pipe inventory view" />
        <button className="btn-primary" disabled={!unprinted.length} onClick={printAllUnprinted}>Print All Unprinted Barcodes ({unprinted.length})</button>
      </div>
      </div>
      <div className="app-card table-scroll desktop-record-table">
        {filtered.length === 0 ? (
          <div className="empty-state empty-state-action">
            <strong>No finished pipes found</strong>
            <span>No pipe records match the selected product type, filters, status, or search.</span>
            <button className="btn-secondary" onClick={clearFilters}>Clear Filters</button>
          </div>
        ) : viewMode === "By Batch" ? (
          <>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>PO / MO</th>
                  <th>Product Type</th>
                  <th>Grade</th>
                  <th>Size / SDR-Thickness / Length</th>
                  <th>Color / Stripe</th>
                  <th>Production Date</th>
                  <th>Produced / Good / Rejected</th>
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
                  const summary = batchSummary(group)

                  return (
                    <tr key={group.item.batch}>
                      <td className="font-mono">{group.item.batch}</td>
                      <td>
                        <span className="font-mono">{group.item.poRef}</span>
                        <br />
                        <small>{manufacturingOrderFor(group.item)}</small>
                      </td>
                      <td>{normalizedProductType(group.item.product)}</td>
                      <td>{group.item.grade}</td>
                      <td>
                        {group.item.diameter} · {group.item.sdr} ·{" "}
                        {group.item.length}
                      </td>
                      <td>
                        {group.item.color} · {group.item.stripe}
                      </td>
                      <td>{group.item.productionDate}</td>
                      <td>
                        {summary.produced} / {group.pipes.length} /{" "}
                        {summary.rejected}
                      </td>
                      <td>{summary.available}</td>
                      <td>{summary.reserved}</td>
                      <td>{summary.ready}</td>
                      <td>{summary.shipped}</td>
                      <td>
                        <StatusBadge status={summary.status} />
                      </td>
                      <td>
                        <button className="btn-secondary btn-compact" onClick={() => { setSelectedBatchId(group.item.batch); setBatchPipePage(1); }}>View Batch</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination page={page} totalRecords={batches.length} onPageChange={setPage} noun="batches" />
          </>
        ) : (
          <>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>Grade / Size</th>
                  <th>Purpose</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>PO</th>
                  <th>Customer Order</th>
                  <th>Print</th>
                  <th data-actions>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.map((f) => (
                  <tr key={f.id}>
                    <td className="font-mono">{f.barcode}</td>
                    <td>{f.product}</td>
                    <td>
                      {f.grade} · {f.diameter} · {f.sdr} · {f.length}
                    </td>
                    <td>{f.inventoryPurpose || "Unassigned"}</td>
                    <td>
                      <StatusBadge status={f.releaseStatus === 'Released' ? 'Shipped Out' : f.status}/>
                    </td>
                    <td>{f.currentLocation || "Not Yet Assigned"}</td>
                    <td className="font-mono">{f.poRef}</td>
                    <td className="font-mono">
                      {f.reservedForOrderRef || "—"}
                    </td>
                    <td>{f.printStatus}</td>
                    <td>
                      <button className="btn-secondary btn-compact" onClick={() => setSelectedId(f.id)}>View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} noun="pipes" />
          </>
        )}
      </div>
      <div className="mobile-record-list">
        {!filtered.length ? (
          <div className="app-card empty-state empty-state-action">
            <strong>No finished pipes found</strong>
            <span>No pipe records match the selected filters.</span>
            <button className="btn-secondary" onClick={clearFilters}>Clear Filters</button>
          </div>
        ) : viewMode === "By Batch" ? (
          currentBatches.map((group) => {
            const summary = batchSummary(group)

            return (
              <article className="app-card mobile-record-card" key={group.item.batch}>
                <div className="mobile-record-heading">
                  <strong className="font-mono">{group.item.batch}</strong>
                  <StatusBadge status={summary.status} />
                </div>
                <div className="mobile-record-grid">
              <Info label="PO / MO" value={`${group.item.poRef} / ${manufacturingOrderFor(group.item)}`} />
              <Info label="Product / Grade" value={`${normalizedProductType(group.item.product)} · ${group.item.grade}`} />
              <Info label="Good / Rejected" value={`${group.pipes.length} / ${summary.rejected}`} />
              <Info label="Available / Reserved" value={`${summary.available} / ${summary.reserved}`} />
            </div>
                <button className="btn-primary" onClick={() => { setSelectedBatchId(group.item.batch); setBatchPipePage(1); }}>View Batch</button>
              </article>
            )
          })
        ) : (
          currentRecords.map((pipe) => (
            <article className="app-card mobile-record-card" key={pipe.id}>
              <div className="mobile-record-heading">
                <strong className="font-mono">{pipe.barcode}</strong>
                <StatusBadge status={pipe.releaseStatus === 'Released' ? 'Shipped Out' : pipe.status} />
              </div>
              <div className="mobile-record-grid">
                <Info label="Product / Grade" value={`${normalizedProductType(pipe.product)} · ${pipe.grade}`} />
                <Info label="Size" value={`${pipe.diameter} · ${pipe.sdr} · ${pipe.length}`} />
                <Info label="Location" value={pipe.currentLocation || 'Not Yet Assigned'} />
                <Info label="Customer Order" value={pipe.reservedForOrderRef || '—'} />
              </div>
              <button className="btn-secondary" onClick={() => setSelectedId(pipe.id)}>View Details</button>
            </article>
          ))
        )}
      </div>
      <div className="mobile-pagination-only">
        {viewMode === 'By Batch' ? <Pagination page={page} totalRecords={batches.length} onPageChange={setPage} noun="batches" /> : <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} noun="pipes" />}
      </div>
      {selectedBatch &&
        (() => {
          const summary = batchSummary(selectedBatch)

          return (
            <Modal open title={`Finished Pipe Batch — ${selectedBatch.item.batch}`} onClose={() => setSelectedBatchId(null)} width="1100px">
              <div className="page-stack">
                <div className="app-card detail-card">
                  <div className="section-title">Batch Summary</div>
                  <div className="responsive-grid">
                    {Object.entries({ Batch: selectedBatch.item.batch, 'Production Order': selectedBatch.item.poRef, 'Manufacturing Order': manufacturingOrderFor(selectedBatch.item), Product: normalizedProductType(selectedBatch.item.product), 'Material Grade': selectedBatch.item.grade, Size: selectedBatch.item.diameter, 'SDR / Thickness': selectedBatch.item.sdr, Length: selectedBatch.item.length, Color: selectedBatch.item.color, Stripe: selectedBatch.item.stripe, Produced: summary.produced, Rejected: summary.rejected, 'Good Pipes': selectedBatch.pipes.length, Available: summary.available, Reserved: summary.reserved, 'Ready for Ship Out': summary.ready, Shipped: summary.shipped, Location: summary.location, Status: summary.status }).map(([label, value]) => (
                      <div key={label}>
                        <div className="field-label">{label}</div>
                        <div className="field-value">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mobile-record-list">
                  {pageRecords([...selectedBatch.pipes].sort((a, b) => a.barcode.localeCompare(b.barcode, undefined, { numeric: true })), batchPipePage).map((pipe) => (
                    <article className="app-card mobile-record-card" key={pipe.id}>
                      <div className="mobile-record-heading">
                        <strong className="font-mono">{pipe.barcode}</strong>
                        <StatusBadge status={pipe.releaseStatus === 'Released' ? 'Shipped Out' : pipe.status} />
                      </div>
                      <div className="mobile-record-grid">
                        <Info label="Product / Grade" value={`${normalizedProductType(pipe.product)} · ${pipe.grade}`} />
                        <Info label="Size" value={`${pipe.diameter} · ${pipe.sdr} · ${pipe.length}`} />
                        <Info label="Location" value={pipe.currentLocation || 'Not Yet Assigned'} />
                        <Info label="Customer Order" value={pipe.reservedForOrderRef || '—'} />
                      </div>
                      <button className="btn-secondary" onClick={() => { setSelectedBatchId(null); setSelectedId(pipe.id); }}>View Details</button>
                    </article>
                  ))}
                </div>
                <div className="app-card table-scroll desktop-record-table">
                  <div className="table-title">Individual Good Pipes in This Batch</div>
                  <table className="app-table">
                    <thead>
                      <tr>
                        <th>Barcode</th>
                        <th>Product / Grade</th>
                        <th>Size / SDR-Thickness / Length</th>
                        <th>Color / Stripe</th>
                        <th>Unit Weight</th>
                        <th>PO / MO</th>
                        <th>Quality</th>
                        <th>Inventory Status</th>
                        <th>Location</th>
                        <th>Customer / Buyer</th>
                        <th>Production / Storage</th>
                        <th>Release</th>
                        <th data-actions>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRecords([...selectedBatch.pipes].sort((a, b) => a.barcode.localeCompare(b.barcode, undefined, { numeric: true })), batchPipePage).map((pipe) => (
                        <tr key={pipe.id}>
                          <td className="font-mono">{pipe.barcode}</td>
                          <td>
                            {normalizedProductType(pipe.product)} · {pipe.grade}
                          </td>
                          <td>
                            {pipe.diameter} · {pipe.sdr} · {pipe.length}
                          </td>
                          <td>
                            {pipe.color} · {pipe.stripe}
                          </td>
                          <td>
                            {pipe.unitWeightKg
                              ? `${pipe.unitWeightKg} kg`
                              : "—"}
                          </td>
                          <td>
                            <span className="font-mono">{pipe.poRef}</span>
                            <br />
                            <small>{manufacturingOrderFor(pipe)}</small>
                          </td>
                          <td>{pipe.qualityStatus || "Pass"}</td>
                          <td>
                            <StatusBadge status={pipe.releaseStatus === 'Released' ? 'Shipped Out' : pipe.status} />
                          </td>
                          <td>{pipe.currentLocation || "Not Yet Assigned"}</td>
                          <td>
                            {pipe.reservedForOrderRef || "—"}
                            <br />
                            <small>{pipe.buyer || "—"}</small>
                          </td>
                          <td>
                            {pipe.productionDate}
                            <br />
                            <small>
                              {pipe.storedAt ? new Date(pipe.storedAt).toLocaleString('en-PH') : 'Not stored'}
                            </small>
                          </td>
                          <td>
                            {pipe.releasedAt ? new Date(pipe.releasedAt).toLocaleString('en-PH') : 'Not released'}
                            <br />
                            <small>
                              {pipe.shipmentReference ||
                                pipe.releaseReference ||
                                "—"}
                            </small>
                          </td>
                          <td>
                            <button className="btn-secondary btn-compact" onClick={() => { setSelectedBatchId(null); setSelectedId(pipe.id); }}>View Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination page={batchPipePage} totalRecords={selectedBatch.pipes.length} onPageChange={setBatchPipePage} noun="pipes" />
                </div>
              </div>
            </Modal>
          )
        })()}
      {selected && (
        <Modal open title={`Finished Goods — ${selected.fgId}`} onClose={() => setSelectedId(null)} width="620px">
          <div className="page-stack">
            <div className="alert-success">
          <strong>Barcode Assigned Automatically</strong>
          <div>Use Print or Reprint for the same permanent physical label.</div>
        </div>
            <BarcodeLabel
            value={selected.barcode}
            recordId={selected.id}
            recordLabel={selected.fgId}
            onPrint={() => markFinishedGoodBarcodePrinted(selected.id)}
          />
            <div className="app-card detail-card">
              <div className="section-title">System Record Details · Not Printed</div>
              <div className="responsive-grid">
                {Object.entries({ Product: selected.product, Diameter: selected.diameter, Length: selected.length, 'SDR / Thickness': selected.sdr, Grade: selected.grade, Color: selected.color, Stripe: selected.stripe, Construction: selected.construction, Form: selected.productForm, 'Unit Weight': selected.unitWeightKg ? `${selected.unitWeightKg} kg` : '—', Batch: selected.batch, 'Production Order': selected.poRef, 'Manufacturing Order': selected.moRef || '—', 'Production Date': selected.productionDate, Shift: selected.shift, 'Quality Status': selected.qualityStatus || 'Pending', 'Inventory Purpose': selected.inventoryPurpose || 'Unassigned', 'Inventory Status': selected.status, 'Current Location': selected.currentLocation || 'Not Yet Assigned', 'Customer Order': selected.reservedForOrderRef || '—', Buyer: selected.buyer || '—', 'Release Status': selected.releaseStatus, Available: selected.availableQty, Reserved: selected.reservedQty }).map(([label, value]) => (
                  <div key={label}>
                    <div className="field-label">{label}</div>
                    <div className="field-value">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            {rejecting && (
              <div className="app-card detail-card">
                <div className="section-title">Quality Rejection</div>
                <div className="form-grid">
                  <label>
                    Actual Pipe Weight (kg)
                    <input className="app-input" type="number" min="0.001" step="0.001" value={rejectWeight} onChange={event => setRejectWeight(event.target.value)} />
                  </label>
                  <label>
                    Reason
                    <SearchableDropdown
                      className="app-select" value={rejectReason} onChange={event => setRejectReason(event.target.value)}
                    >
                      <option value="">Select reason</option>
                      {['Surface Defect', 'Incorrect Diameter', 'Incorrect Thickness', 'Incorrect Length', 'Cracked', 'Deformed', 'Color Problem', 'Stripe Problem', 'Weight Problem', 'Other'].map(reason => <option key={reason}>{reason}</option>)}
                    </SearchableDropdown>
                  </label>
                </div>
                <div className="helper-text">Rejecting this barcode immediately removes it from available, reservation, storage, and release eligibility without changing total completed output.</div>
                {qualityError && <div className="alert-error mt-3">{qualityError}</div>}
                <div className="form-actions mt-3">
                  <button className="btn-secondary" onClick={() => setRejecting(false)}>Cancel</button>
                  <button className="btn-primary" onClick={() => {
            const result = rejectFinishedGood(selected.id, Number(rejectWeight), rejectReason);
            if (!result.success) return setQualityError(result.error || 'Quality rejection could not be saved.');
            setRejecting(false); setRejectWeight(''); setRejectReason(''); setQualityError('');
          }}>Confirm Quality Reject</button>
                </div>
              </div>
            )}
            <div className="app-card detail-card">
              <div className="section-title">Location History</div>
              {selected.locationHistory?.length ? (
                selected.locationHistory.map((entry, index) => (
                  <div className="metric-row" key={`${entry.dateTime}-${index}`}>
                    <div>
                      <strong>
                        {entry.action}: {entry.from} → {entry.to}
                      </strong>
                      <span>
                        {entry.employee}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </span>
                    </div>
                    <small>
                      {new Date(entry.dateTime).toLocaleString("en-PH")}
                    </small>
                  </div>
                ))
              ) : (
                <div className="empty-state">No location changes yet.</div>
              )}
            </div>
            {!rejecting && selected.qualityStatus === 'Pass' && selected.releaseStatus !== 'Released' && (
                <div className="form-actions">
                  <button className="btn-secondary" onClick={() => setRejecting(true)}>Record Quality Reject</button>
                </div>
              )}
          </div>
        </Modal>
      )}
      {replenishmentTarget &&
        (() => {
          const spec = productSpecifications.find(item => item.id === replenishmentTarget.productSpecificationId);

          if (!spec) return null

          return (
            <Modal open title="Create Production Order · Stock Replenishment" onClose={() => !creatingReplenishment && setReplenishmentTarget(null)} width="680px">
              <div className="page-stack">
                <div className="alert-warning">
                  <strong>Source: Stock Replenishment</strong>
                  <div>This PO is not tied to a Manufacturing Order. Review the exact specification and permitted values before creating it.</div>
                </div>
                <div className="app-card detail-card">
                  <div className="section-title">Prefilled Product Specification</div>
                  <div className="responsive-grid">
                    <Info label="Product Type" value={spec.productType} />
                    <Info label="Material Grade" value={spec.materialGrade} />
                    <Info label="Size / Diameter" value={spec.size} />
                    <Info label="SDR / Thickness" value={spec.sdr} />
                    <Info label="Form / Length" value={`${spec.productForm} · ${specificationLength(spec)}`} />
                    <Info label="Construction" value={spec.pipeConstruction} />
                    <Info label="Color / Stripe" value={`${spec.color} · ${spec.stripe}`} />
                    <Info label="Current / Minimum / Target" value={`${exactOnHand(spec)} / ${replenishmentTarget.minimumStock} / ${replenishmentTarget.targetStock} units`} />
                  </div>
                </div>
                <div className="form-grid">
                  <label>
                    Target Quantity *
                    <input className="app-input" type="number" min="1" value={replenishmentForm.targetQty} onChange={event => setReplenishmentForm(value => ({ ...value, targetQty: event.target.value }))} />
                  </label>
                  <label>
                    Required Date *
                    <input className="app-input" type="date" value={replenishmentForm.requiredDate} onChange={event => setReplenishmentForm(value => ({ ...value, requiredDate: event.target.value }))} />
                  </label>
                  <label>
                    Production Line
                    <SearchableDropdown
                      className="app-select" value={replenishmentForm.productionLine} onChange={event => setReplenishmentForm(value => ({ ...value, productionLine: event.target.value }))}
                    >
                      <option>To Be Assigned</option>
                      <option>Line 1</option>
                      <option>Line 2</option>
                    </SearchableDropdown>
                  </label>
                  <label>
                    Priority
                    <SearchableDropdown
                      className="app-select" value={replenishmentForm.priority} onChange={event => setReplenishmentForm(value => ({ ...value, priority: event.target.value as typeof value.priority }))}
                    >
                      <option>Normal</option>
                      <option>High</option>
                      <option>Urgent</option>
                    </SearchableDropdown>
                  </label>
                  <label className="form-grid-span-2">
                    Reason *
                    <textarea className="app-input" value={replenishmentForm.reason} onChange={event => setReplenishmentForm(value => ({ ...value, reason: event.target.value }))} />
                  </label>
                </div>
                {replenishmentFeedback && (
                  <div className="alert-error" role="alert">
                    {replenishmentFeedback}
                  </div>
                )}
                <div className="form-actions">
                  <button className="btn-secondary" disabled={creatingReplenishment} onClick={() => setReplenishmentTarget(null)}>Back</button>
                  <button className="btn-primary" disabled={creatingReplenishment || !replenishmentForm.reason.trim() || Number(replenishmentForm.targetQty) <= 0 || !replenishmentForm.requiredDate} onClick={() => {
          setCreatingReplenishment(true);
          const result = createStockReplenishmentPO({ specification: spec, targetQty: Number(replenishmentForm.targetQty), requiredDate: replenishmentForm.requiredDate, productionLine: replenishmentForm.productionLine, priority: replenishmentForm.priority, reason: replenishmentForm.reason });
          setCreatingReplenishment(false);
          if (!result.success) return setReplenishmentFeedback(result.error || 'Unable to create Production Order.');
          setReplenishmentFeedback(''); setReplenishmentTarget(null);
        }}>Confirm & Create PO</button>
                </div>
              </div>
            </Modal>
          )
        })()}
    </div>
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
