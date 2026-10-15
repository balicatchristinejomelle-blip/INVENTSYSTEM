import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';
import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import { ActiveFilters, LastUpdated } from '../../components/UXFeedback';
import { finishedGoodsSummary, finishedPipeInventory } from '../../finishedGoodsInventory';
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
import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useMemo, useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

import type { FinishedGood } from "../../types"

import { normalizedProductType, type PipeProductType } from '../../inventoryCategories';

type ViewMode = "Stock Levels" | "By Batch" | "Individual Pipes"

export default function MarketingFG() {
  const app = useApp();
  const { finishedGoods } = app;

  const [productType, setProductType] = useViewState<'All' | PipeProductType>("marketing/FinishedGoods:productType", 'All');

  const [status, setStatus] = useViewState<'All Statuses' | 'Available' | 'Reserved' | 'Temporary Storage' | 'Ready for Release' | 'Shipped Out / Released'>("marketing/FinishedGoods:status", 'Available');

  const [purpose, setPurpose] = useViewState<StoragePurposeSelection>("marketing/FinishedGoods:purpose", 'All');
  const [grade, setGrade] = useViewState("marketing/FinishedGoods:grade", "All")

  const [search, setSearch] = useViewState("marketing/FinishedGoods:search", "")
  const period = usePeriod('all', search);

  const [viewMode, setViewMode] = useViewState<ViewMode>("marketing/FinishedGoods:viewMode", 'By Batch');

  const [selected, setSelected] = useState<FinishedGood | null>(null);

  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  const [page, setPage] = useViewState("marketing/FinishedGoods:page", 1)
  const productFilters = useProductFilters(() => setPage(1));

  const [batchPipePage, setBatchPipePage] = useState(1)


  const visible = useMemo(
    () =>
      finishedGoods.filter(
        (item) =>
          dateInPeriod(item.productionDate, period.range) && item.qualityStatus !== 'Reject'
    && (purpose === 'All' || finishedPipeInventory(item, app).purpose === purpose)
    && productFilters.matches(item)
    && (productType === 'All' || normalizedProductType(item.product) === productType)
    && (grade === 'All' || item.grade === grade)
    && (status === 'All Statuses' || (status === 'Shipped Out / Released' ? item.releaseStatus === 'Released' : item.releaseStatus !== 'Released' && (status === 'Temporary Storage' ? finishedPipeInventory(item, app).bucket === status : item.status === status))) &&
          ([item.barcode, item.fgId, item.poRef, item.moRef || '', item.batch, item.product, item.grade, item.reservedForOrderRef || ''].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
            matchesRecord(pipeSearchRecord(item, { ...app, specifications: readPipeSpecifications() }), search)),
      ),
    [finishedGoods, grade, purpose, productType, search, status, productFilters.value, app.productionOrders, app.manufacturingOrders, app.orders, period.range.start, period.range.end],
  )


  const batches = useMemo(() => Array.from(visible
    .reduce((groups, item) => {
      const group = groups.get(item.batch) || { item, pipes: [] as FinishedGood[] };
      group.pipes.push(item);
      groups.set(item.batch, group);
      return groups;
    }, new Map<string, { item: FinishedGood; pipes: FinishedGood[] }>()).values())
    .sort((a, b) => b.item.productionDate.localeCompare(a.item.productionDate) || b.item.batch.localeCompare(a.item.batch, undefined, { numeric: true })),
  [visible]);

  const productSelected = productType === 'All' ? finishedGoods : finishedGoods.filter(item => normalizedProductType(item.product) === productType);
  const selectedGroup = viewMode === 'Stock Levels' ? productSelected.filter(item => dateInPeriod(item.productionDate, period.range) && (purpose === 'All' || finishedPipeInventory(item, app).purpose === purpose) && productFilters.matches(item) && (grade === 'All' || item.grade === grade) && matchesRecord(pipeSearchRecord(item, { ...app, specifications: readPipeSpecifications() }), search)) : productSelected;

  const inventory = finishedGoodsSummary(selectedGroup, app);
  const openBatch = batches.find(group => group.item.batch === selectedBatch);

  const currentPipes = pageRecords(visible, page)

  const currentBatches = pageRecords(batches, page)

  const resetPage = () => setPage(1)

  const moFor = (item: FinishedGood) => resolveFinishedPipe(item, app).mo?.moNo || 'N/A';

  const batchStatus = (pipes: FinishedGood[]) => {
    const statuses = new Set(pipes.map(item => item.releaseStatus === 'Released' ? 'Shipped Out' : item.status));
    return statuses.size === 1 ? Array.from(statuses)[0] : 'Mixed Statuses';
  };

  return (
    <div className="page-stack">
      <LastUpdated records={finishedGoods} />
      <div>
        <div className="section-title">Finished Goods Availability</div>
        <div className="helper-text">Read-only stock visibility calculated from individual physical pipe records.</div>
      </div>
      <MetricCards inventory label="Finished Goods inventory summary" items={[
        ['Available', inventory.available, 'individual physical pipes'],
        ['Reserved', inventory.reserved, 'individual physical pipes'],
        ['Temporary Storage', inventory.temporary, 'individual physical pipes'],
        ['Ready for Ship Out', inventory.ready, 'individual physical pipes'],
        ['On Hand', inventory.onHand, 'individual physical pipes'],
      ]} />
      <div className="filter-panel product-filter-panel">
        <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => { setPage(1); }} />
        <ProductFilters value={productFilters.value} onChange={productFilters.change} product={productType} onProductChange={value => { setProductType(value as 'All' | PipeProductType); resetPage(); }} grade={grade} onGradeChange={value => { setGrade(value); resetPage(); }} includeColor includeLocation
          records={finishedGoods.filter(pipe => pipe.qualityStatus !== 'Reject' && dateInPeriod(pipe.productionDate, period.range) && matchesRecord(pipeSearchRecord(pipe, app), search))}
          purpose={purpose} onPurposeChange={value => { setPurpose(value as StoragePurposeSelection); resetPage(); }}
          status={status} onStatusChange={value => { setStatus(value as typeof status); resetPage(); }}
          statusLabel={value => value === 'Ready for Release' ? 'Ready for Ship Out' : value}
          statusFor={pipe => pipe.releaseStatus === 'Released' ? 'Shipped Out / Released' : finishedPipeInventory(pipe, app).bucket === 'Temporary Storage' ? 'Temporary Storage' : ['Available','Reserved','Ready for Release'].includes(pipe.status) ? pipe.status : ''} />
      </div>
      <LegacyBarcodeNotice query={search} pipes={finishedGoods} />
      {viewMode === 'Stock Levels' && <LocationStockBreakdown pipes={visible} />}
      <CategoryTabs items={['Stock Levels', 'By Batch', 'Individual Pipes'] as const} value={viewMode} onChange={value => { setViewMode(value); resetPage(); }} label="Finished goods view mode" />

      {viewMode === 'Stock Levels' ? <div className="app-card detail-card"><div className="section-title">Stock Levels</div><p className="helper-text">The availability cards above show matching physical stock. Replenishment configuration remains with Plant Manager.</p>{!selectedGroup.length && <div className="empty-state">No matching records. Available = 0.</div>}</div> : viewMode === "By Batch" ? (
        <>
          <div className="app-card table-scroll desktop-record-table">
            <table className="app-table inventory-bucket-table">
              <thead>
                <tr>
                  <th>Batch / Origin Group</th>
                  <th className="po-column">PO / MO</th>
                  <th>Product</th>
                  <th>Grade / Specifications</th>
                  <th>Produced / Good / Rejected</th>
                  <th>Available</th>
                  <th>Reserved</th>
                  <th>Temporary Storage</th>
                  <th>Ready for Ship Out</th>
                  <th>On Hand</th>
                  <th>Shipped</th>
                  <th>Status</th>
                  <th data-actions>Action</th>
                </tr>
              </thead>
              <TableBody>
                {currentBatches.map((group) => {
                  const available = finishedGoodsSummary(group.pipes, app).available;

                  const reserved = finishedGoodsSummary(group.pipes, app).reserved;

                  const ready = finishedGoodsSummary(group.pipes, app).ready;

                  const shipped = group.pipes.filter(item => item.releaseStatus === 'Released').length;
                  const trace = batchOriginTrace(group.pipes, { ...app, specifications: readPipeSpecifications() });
                  const rejected = app.rejectedMaterials.filter(item => item.batch === group.item.batch).reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <tr key={group.item.batch}>
                      <td className="font-mono"><RecordReference value={group.item.batch} /><br /><small>{trace.groupType} · <RecordReference value={trace.originGroup} /></small></td>
                      <td className="font-mono po-column">
                        <RecordReference value={group.item.poRef} />
                        <br />
                        <small>{moFor(group.item)}</small>
                      </td>
                      <td>{normalizedProductType(group.item.product)}<br /><small>{trace.itemCode}</small>{trace.seasonal && <span className="badge-amber">SEASONAL</span>}</td>
                      <td>
                        {group.item.grade} · {group.item.diameter} ·{" "}
                        {group.item.sdr} · {group.item.length}
                      </td>
                      <td>{group.pipes.length + rejected} / {group.pipes.length} / {rejected}</td>
                      <td>{available}</td>
                      <td className="inventory-number">{reserved}</td>
                      <td className="inventory-number">{trace.temporary}</td>
                      <td>{ready}</td>
                      <td className="inventory-number">{finishedGoodsSummary(group.pipes, app).onHand}</td>
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
              </TableBody>
            </table>
          </div>
          <div className="mobile-record-list">
            {currentBatches.map((group) => {
              const available = finishedGoodsSummary(group.pipes, app).available;

              const reserved = finishedGoodsSummary(group.pipes, app).reserved;

              return (
                <article className="app-card mobile-record-card" key={group.item.batch}>
                  <div className="mobile-record-heading">
                    <strong className="font-mono"><RecordReference value={group.item.batch} /></strong>
                    <StatusBadge status={batchStatus(group.pipes)} />
                  </div>
                  <div className="mobile-record-grid">
                    <Info label="PO / MO" value={`${group.item.poRef} / ${moFor(group.item)}`} />
                    <Info label="Origin Group / Type" value={`${batchOriginTrace(group.pipes, app).originGroup} · ${batchOriginTrace(group.pipes, app).groupType}`} />
                    <Info label="Product" value={normalizedProductType(group.item.product)} />
                    <Info label="Grade / Size" value={`${group.item.grade} · ${group.item.diameter} · ${group.item.sdr}`} />
                    <Info label="Good Pipes" value={group.pipes.length} />
                    <Info label="Available" value={available} />
                    <Info label="Reserved" value={reserved} />
                    <Info label="Temporary Storage" value={finishedGoodsSummary(group.pipes, app).temporary} />
                    <Info label="Ready for Ship Out" value={finishedGoodsSummary(group.pipes, app).ready} />
                    <Info label="On Hand" value={finishedGoodsSummary(group.pipes, app).onHand} />
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
                  <th className="po-column">PO</th>
                  <th>Status</th>
                  <th data-actions>Action</th>
                </tr>
              </thead>
              <TableBody>
                {currentPipes.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono"><RecordReference value={item.fgId} /></td>
                    <td className="font-mono"><RecordReference value={item.barcode} /></td>
                    <td>{normalizedProductType(item.product)}</td>
                    <td>
                      {item.grade} · {item.diameter} · {item.sdr} ·{" "}
                      {item.length}
                    </td>
                    <td>{item.currentLocation || "Not Yet Assigned"}</td>
                    <td className="font-mono po-column"><RecordReference value={item.poRef} /></td>
                    <td>
                      <StatusBadge status={item.releaseStatus === 'Released' ? 'Shipped Out' : item.status} />
                    </td>
                    <td>
                      <button className="btn-secondary btn-compact" onClick={() => setSelected(item)}>View Details</button>
                    </td>
                  </tr>
                ))}
              </TableBody>
            </table>
          </div>
          <div className="mobile-record-list">
            {currentPipes.map((item) => (
              <article className="app-card mobile-record-card" key={item.id}>
                <div className="mobile-record-heading">
                  <strong className="font-mono"><RecordReference value={item.barcode} /></strong>
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
              <BatchTraceability pipes={openBatch.pipes} />
              <div className="responsive-grid">
                <Info label="Batch" value={openBatch.item.batch} />
                <Info label="PO / MO" value={`${openBatch.item.poRef} / ${moFor(openBatch.item)}`} />
                <Info label="Product" value={normalizedProductType(openBatch.item.product)} />
                <Info label="Grade" value={openBatch.item.grade} />
                <Info label="Specifications" value={`${openBatch.item.diameter} · ${openBatch.item.sdr} · ${openBatch.item.length}`} />
                <Info label="Good Pipes" value={openBatch.pipes.length} />
                <Info label="Rejected" value={app.rejectedMaterials.filter(item => item.batch === openBatch.item.batch).reduce((sum, item) => sum + item.quantity, 0)} />
                <Info label="Available" value={finishedGoodsSummary(openBatch.pipes, app).available} />
                <Info label="Reserved" value={finishedGoodsSummary(openBatch.pipes, app).reserved} />
                <Info label="Ready for Ship Out" value={finishedGoodsSummary(openBatch.pipes, app).ready} />
                <Info label="Shipped" value={openBatch.pipes.filter(item => item.releaseStatus === 'Released').length} />
              </div>
            </div>
            <div className="mobile-record-list always-visible-mobile">
              {pageRecords(openBatch.pipes, batchPipePage).map((item) => (
                <article className="app-card mobile-record-card" key={item.id}>
                  <div className="mobile-record-heading">
                    <strong className="font-mono"><RecordReference value={item.barcode} /></strong>
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
                <TableBody>
                  {pageRecords(openBatch.pipes, batchPipePage).map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono"><RecordReference value={item.barcode} /></td>
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
                </TableBody>
              </table>
            </div>
            <Pagination page={batchPipePage} totalRecords={openBatch.pipes.length} onPageChange={setBatchPipePage} noun="pipes" />
          </div>
        </Modal>
      )}

      {selected && (
        <Modal open title={`Finished Pipe — ${selected.fgId}`} onClose={() => setSelected(null)} width="620px">
          <div className="page-stack">
            <FinishedPipeDetails pipe={selected} />
            <DetailSection title="Customer / Shipment">
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
