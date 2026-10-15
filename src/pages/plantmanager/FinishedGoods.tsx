import { finishedGoodsSummary, finishedPipeInventory, generalStockStatus } from '../../finishedGoodsInventory';
import StoragePurposeFilter, { type StoragePurposeSelection } from '../../components/StoragePurposeFilter';
import LocationStockBreakdown from '../../components/LocationStockBreakdown';
import { matchesLocation } from '../../locationMaster';
import MetricCards from '../../components/MetricCards';
import LegacyBarcodeNotice from '../../components/LegacyBarcodeNotice';
import FinishedPipeDetails from '../../components/FinishedPipeDetails';
import BatchTraceability from '../../components/BatchTraceability';
import { batchOriginTrace } from '../../productionGroups';
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';
import { pipeSearchRecord, readPipeSpecifications, resolveFinishedPipe } from '../../finishedPipeRelations';
import RecordList from "../../components/RecordList"

import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useEffect, useMemo, useState } from "react"

import { useApp } from "../../store"

import Modal from "../../components/Modal"

import StatusBadge from "../../components/StatusBadge"

import BarcodeLabel, { printBarcodeBatch } from '../../components/BarcodeLabel';
import { BatchPrintAction } from '../../components/PrintAction';
import { metadataFor, printState } from '../../reprintWorkflow';
import { printableRecords } from '../../printableRecords';

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

import { normalizedProductType, type PipeProductType } from '../../inventoryCategories';

import type { FinishedGood, ProductSpecification, StockTarget } from '../../types';

import {
  normalizeProductSpecification,
  specificationKey,
  specificationKeyFromRecord,
  specificationLength,
} from "../../productMaster"

type Destination = 'All Statuses' | 'Awaiting Label / Storage' | 'Available' | 'Reserved' | 'Temporary Storage' | 'Ready for Ship Out' | 'Released / Shipped Out';

const DESTINATIONS: readonly Destination[] = ['All Statuses', 'Awaiting Label / Storage', 'Available', 'Reserved', 'Temporary Storage', 'Ready for Ship Out', 'Released / Shipped Out'];

const matchesDestination = (item: FinishedGood, destination: Destination) => {
  if (destination === 'All Statuses') return true;
  if (destination === 'Released / Shipped Out') return item.releaseStatus === 'Released';
  if (item.releaseStatus === 'Released') return false;
  if (destination === 'Awaiting Label / Storage') return item.locationStatus === 'Awaiting Storage';
  if (destination === 'Reserved') return finishedPipeInventory(item).bucket === 'Reserved';
  if (destination === 'Temporary Storage') return finishedPipeInventory(item).bucket === 'Temporary Storage';
  if (destination === 'Ready for Ship Out') return item.status === 'Ready for Release';
  return item.status === 'Available';
};

export default function PMFinishedGoods() {
  const app = useApp();
  const { finishedGoods, rejectedMaterials, productionOrders, rejectFinishedGood, createStockReplenishmentPO, navigate } = app;
  const printable = printableRecords(app);
  const printRecord = (id: string) => printable.find(record => record.kind === 'Barcode' && record.recordType === 'Finished Pipe' && record.recordId === id);

  const [search, setSearch] = useState("")

  const [status, setStatus] = useState<Destination>('All Statuses');

  const [productType, setProductType] = useState<'All' | PipeProductType>('All');

  const [grade, setGrade] = useState("All")

  const [purpose, setPurpose] = useState<StoragePurposeSelection>('All');

  const [viewMode, setViewMode] = useState<'Stock Levels' | 'By Batch' | 'Individual Pipes'>('By Batch');

  const [page, setPage] = useState(1)
  const productFilters = useProductFilters(() => setPage(1));

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





  const filtered = useMemo(
    () =>
      finishedGoods.filter(
        (f) =>
          f.qualityStatus !== 'Reject'
    &&
    (productType === 'All' || normalizedProductType(f.product) === productType)
    && (purpose === 'All' || finishedPipeInventory(f, app).purpose === purpose)
    && matchesDestination(f, status)
    && (grade === 'All' || f.grade === grade)
    && productFilters.matches(f)
    &&
          ([f.barcode, f.fgId, f.poRef, f.moRef || '', f.product, f.grade, f.diameter, f.sdr, f.length, f.productForm, f.color, f.stripe, f.reservedForOrderRef || '', f.currentLocation].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
            matchesRecord({ ...pipeSearchRecord(f, { ...app, specifications: readPipeSpecifications() }), printStatus: printRecord(f.id) ? printState(app, printRecord(f.id)!) : '', reprintStatus: app.reprintRequests.find(request => request.printable.key === printRecord(f.id)?.key)?.status }, search)),
      ),
    [finishedGoods, grade, purpose, productType, search, productFilters.value, status, app.printMetadata, app.reprintRequests, app.productionOrders, app.manufacturingOrders, app.orders],
  )

  const visibleBatchIds = useMemo(() => new Set(filtered.map(item => item.batch)), [filtered]);

  const batches = useMemo(() => Array.from(finishedGoods
    .filter(item => item.qualityStatus !== 'Reject' && visibleBatchIds.has(item.batch) && matchesLocation(item, productFilters.value.location || ''))
    .reduce((groups, item) => {
      const existing = groups.get(item.batch) || { item, pipes: [] as FinishedGood[] };
      existing.pipes.push(item);
      groups.set(item.batch, existing);
      return groups;
    }, new Map<string, { item: FinishedGood; pipes: FinishedGood[] }>()).values())
    .sort((a, b) => a.item.batch.localeCompare(b.item.batch, undefined, { numeric: true })), [finishedGoods, visibleBatchIds]);

  const batchSummary = (group: { item: FinishedGood; pipes: FinishedGood[] }) => {
    const rejected = rejectedMaterials.filter(item => item.batch === group.item.batch).reduce((sum, item) => sum + item.quantity, 0);
    const inventory = finishedGoodsSummary(group.pipes, app);
    const available = inventory.available;
    const reserved = inventory.reserved;
    const ready = inventory.ready;
    const shipped = group.pipes.filter(item => item.releaseStatus === 'Released').length;
    const statuses = new Set(group.pipes.map(item => item.releaseStatus === 'Released' ? 'Shipped Out' : item.status));
    const locations = new Set(group.pipes.map(item => item.currentLocation).filter(Boolean));
    return {
      rejected, available, reserved, ready, shipped, temporary: inventory.temporary, onHand: inventory.onHand,
      produced: group.pipes.length + rejected,
      status: statuses.size === 1 ? Array.from(statuses)[0] : 'Mixed Statuses',
      location: locations.size > 1 ? 'Multiple Locations' : Array.from(locations)[0] || 'Not Yet Assigned',
    };
  };

  const manufacturingOrderFor = (item: FinishedGood) =>
    resolveFinishedPipe(item, app).mo?.moNo || 'N/A';

  const selectedBatch = batches.find(group => group.item.batch === selectedBatchId);

  const inventory = finishedGoodsSummary(finishedGoods, app);
  const total = inventory.onHand;

  const available = inventory.available;

  const reserved = inventory.reserved;

  const unprinted = filtered.filter(item => printRecord(item.id) && metadataFor(app, printRecord(item.id)!).printCount === 0);

  const currentRecords = pageRecords(filtered, page)

  const currentBatches = pageRecords(batches, page)

  const resetPage = () => setPage(1)

  const exactOnHand = (spec: ProductSpecification) => finishedGoodsSummary(finishedGoods.filter(item => specificationKeyFromRecord(item) === specificationKey(spec)), app).available;

  const stockTargetRows = stockTargets.flatMap(target => {
    if (target.inventoryType !== 'Finished Pipe') return [];
    const spec = productSpecifications.find(item => item.id === target.productSpecificationId && item.active);
    if (!spec || target.status !== 'Active' || target.plant !== 'Branch Plant') return [];
    const onHand = exactOnHand(spec);
    const openPO = productionOrders.find(item => item.source === 'Stock Replenishment' && !['Completed', 'Cancelled'].includes(item.status) && specificationKeyFromRecord(item) === specificationKey(spec));
    const stockStatus = openPO ? 'Replenishment In Progress' : generalStockStatus(onHand, target.minimumStock);
    return [{ target, spec, onHand, openPO, stockStatus }];
  });

  const visibleStockTargetRows = stockTargetRows.filter(
    ({ spec, openPO, stockStatus }) =>
      productFilters.matches(spec, { location: '' }) && (productType === 'All' || spec.productType === productType) && (grade === 'All' || spec.materialGrade === grade) &&
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
    setSearch(''); setProductType('All'); setGrade('All'); productFilters.reset(); setPurpose('All'); setStatus('All Statuses'); resetPage();
  };

  const printAllUnprinted = () => {
    const printedIds = printBarcodeBatch(unprinted.map(item => ({
      value: item.barcode,
      recordId: item.id,
      recordLabel: item.fgId,
    })));
    return printedIds.length === unprinted.length;
  };

  return (
    <div className="page-stack">
      <MetricCards inventory label="Finished Goods inventory summary" items={[
        ['Available', available], ['Reserved', reserved], ['Temporary Storage', inventory.temporary],
        ['Ready for Ship Out', inventory.ready], ['On Hand', total],
      ]} />
      <MetricCards items={[
        ['Awaiting Storage', inventory.awaiting],
        ['Shipped Out', finishedGoods.filter(f => f.releaseStatus === 'Released').length],
      ]} />
      <div className="filter-panel product-filter-panel">
          <input className="app-input record-search" type="search" aria-label="Search finished goods" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search product, grade, size, SDR / Thickness, length, barcode, batch, origin group, PO, MO, customer, status, or location" />
        <ProductFilters value={productFilters.value} onChange={productFilters.change} product={productType} onProductChange={value => { setProductType(value as 'All' | PipeProductType); resetPage(); }} grade={grade} onGradeChange={value => { setGrade(value); resetPage(); }} includeColor includeLocation />
        {(viewMode === 'By Batch' || viewMode === 'Individual Pipes') && <div className="product-operational-filters">
          <StoragePurposeFilter value={purpose} onChange={value => { setPurpose(value); resetPage(); }} />
          <SearchableDropdown
            className="app-select" aria-label="Status" value={status} onChange={e => { setStatus(e.target.value as Destination); resetPage(); }}
          >
            {DESTINATIONS.map(item => <option key={item}>{item}</option>)}
          </SearchableDropdown>
        </div>}
      </div>
        <LegacyBarcodeNotice query={search} pipes={finishedGoods} />
      <CategoryTabs items={['Stock Levels', 'By Batch', 'Individual Pipes'] as const} value={viewMode} onChange={value => { setViewMode(value); resetPage(); }} label="Finished pipe inventory view" />
        <div className="product-view-actions">
        {(viewMode === 'By Batch' || viewMode === 'Individual Pipes') && <BatchPrintAction records={unprinted.map(item => printRecord(item.id)!)} onPreview={printAllUnprinted} label="Print All Unprinted Barcodes" />}
      </div>
      {viewMode === 'Stock Levels' && <LocationStockBreakdown pipes={finishedGoods.filter(pipe => productFilters.matches(pipe, { product: productType === 'All' ? '' : productType, grade: grade === 'All' ? '' : grade }) && matchesRecord(pipeSearchRecord(pipe, app), search))} />}
      {viewMode === 'Stock Levels' && (
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
      {(viewMode === 'By Batch' || viewMode === 'Individual Pipes') && <>
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
                  <th>Batch / Origin Group</th>
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
                  const trace = batchOriginTrace(group.pipes, { ...app, specifications: readPipeSpecifications() });

                  return (
                    <tr key={group.item.batch}>
                      <td className="font-mono">{group.item.batch}<br /><small>{trace.groupType} · {trace.originGroup}</small></td>
                      <td>
                        <span className="font-mono">{group.item.poRef}</span>
                        <br />
                        <small>{manufacturingOrderFor(group.item)}</small>
                      </td>
                      <td>{normalizedProductType(group.item.product)}<br /><small>{trace.itemCode}</small>{trace.seasonal && <span className="badge-amber">SEASONAL</span>}</td>
                      <td>{group.item.grade}</td>
                      <td>
                        {group.item.diameter} · {group.item.sdr} ·{" "}
                        {group.item.length}
                      </td>
                      <td>
                        {group.item.color} · {group.item.stripe}
                      </td>
                      <td>{group.item.productionDate}<br /><small>{trace.shift}</small></td>
                      <td>
                        {summary.produced} / {group.pipes.length} /{" "}
                        {summary.rejected}
                      </td>
                      <td>{summary.available}</td>
                      <td>{summary.reserved}<br /><small>{trace.temporary} Temporary Storage</small></td>
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
                    <td>{finishedPipeInventory(f, app).purpose || "Source Not Resolved"}</td>
                    <td>
                      <StatusBadge status={f.releaseStatus === 'Released' ? 'Shipped Out' : f.status}/>
                    </td>
                    <td>{f.currentLocation || "Not Yet Assigned"}</td>
                    <td className="font-mono">{f.poRef}</td>
                    <td className="font-mono">
                      {f.reservedForOrderRef || "—"}
                    </td>
                    <td>{printRecord(f.id) ? printState(app, printRecord(f.id)!).replace(/_/g, ' ') : f.printStatus}</td>
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
              <Info label="Origin Group / Type" value={`${batchOriginTrace(group.pipes, app).originGroup} · ${batchOriginTrace(group.pipes, app).groupType}`} />
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
      </>}
      {selectedBatch &&
        (() => {
          const summary = batchSummary(selectedBatch)

          return (
            <Modal open title={`Finished Pipe Batch — ${selectedBatch.item.batch}`} onClose={() => setSelectedBatchId(null)} width="1100px">
              <div className="page-stack">
                <div className="app-card detail-card">
                  <div className="section-title">Batch Summary</div>
                  <BatchTraceability pipes={selectedBatch.pipes} />
                  <div className="responsive-grid">
                    {Object.entries({ Batch: selectedBatch.item.batch, 'Production Order': selectedBatch.item.poRef, 'Manufacturing Order': manufacturingOrderFor(selectedBatch.item), Product: normalizedProductType(selectedBatch.item.product), 'Material Grade': selectedBatch.item.grade, Size: selectedBatch.item.diameter, 'SDR / Thickness': selectedBatch.item.sdr, Length: selectedBatch.item.length, Color: selectedBatch.item.color, Stripe: selectedBatch.item.stripe, Produced: summary.produced, Rejected: summary.rejected, 'Good Pipes': selectedBatch.pipes.length, Available: summary.available, Reserved: summary.reserved, Temporary: summary.temporary, 'On Hand': summary.onHand, 'Ready for Ship Out': summary.ready, Shipped: summary.shipped, Location: summary.location, Status: summary.status }).map(([label, value]) => (
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
          />
            <FinishedPipeDetails pipe={selected} onOpenBatch={() => { setSelectedId(null); setSelectedBatchId(selected.batch); setBatchPipePage(1); }} />
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
