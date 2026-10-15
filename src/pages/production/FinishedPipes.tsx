import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import { finishedGoodsSummary, finishedPipeInventory } from '../../finishedGoodsInventory';
import MetricCards from '../../components/MetricCards';
import StoragePurposeFilter, { type StoragePurposeSelection } from '../../components/StoragePurposeFilter';
import LegacyBarcodeNotice from '../../components/LegacyBarcodeNotice';
import FinishedPipeDetails from '../../components/FinishedPipeDetails';
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';
import { pipeSearchRecord, readPipeSpecifications } from '../../finishedPipeRelations';
import { matchesRecord } from "../../components/RecordSearch"

import React, { useState, useMemo } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import type { FinishedGood } from "../../types"


import { normalizedProductType, type PipeProductType } from '../../inventoryCategories';

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

import Pagination, { pageRecords } from '../../components/Pagination';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

type FilterTab = 'Awaiting Label / Storage' | 'Available' | 'Reserved' | 'Temporary Storage' | 'Ready for Ship Out' | 'Shipped Out / Released';

const FILTER_TABS: FilterTab[] = ['Awaiting Label / Storage', 'Available', 'Reserved', 'Temporary Storage', 'Ready for Ship Out', 'Shipped Out / Released'];

const matchesDestination = (item: FinishedGood, destination: FilterTab) => {
  if (destination === 'Shipped Out / Released') return item.releaseStatus === 'Released';
  if (item.releaseStatus === 'Released') return false;
  if (destination === 'Awaiting Label / Storage') return item.locationStatus === 'Awaiting Storage';
  if (destination === 'Reserved') return finishedPipeInventory(item).bucket === 'Reserved';
  if (destination === 'Temporary Storage') return finishedPipeInventory(item).bucket === 'Temporary Storage';
  if (destination === 'Ready for Ship Out') return item.status === 'Ready for Release';
  return item.status === 'Available';
};

function LabelValue({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: mono ? 'JetBrains Mono, monospace' : undefined }}>
        {value}
      </div>
    </div>
  )
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────

function DetailModal({ fg, onClose }: { fg: FinishedGood | null; onClose: () => void }) {
  if (!fg) return null

  return (
    <Modal open onClose={onClose} title="Finished Good Detail" width="560px">
      <div className="page-stack">
        <div className="app-card detail-card">
          <div className="section-title">Barcode</div>
          <div className="field-value font-mono"><RecordReference value={fg.barcode} /></div>
          <div className="helper-text">The system assigned this barcode after Quality Pass. Use Barcode Scanner for storage and release operations.</div>
        </div>

        <FinishedPipeDetails pipe={fg} />
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── RECORD STORAGE MODAL ─────────────────────────────────────────────────────


export default function FinishedPipes() {
  const app = useApp();
  const { finishedGoods, navigate } = app;
  const inventory = finishedGoodsSummary(finishedGoods, app);

  const totalUnits = inventory.onHand;

  const totalAvailable = inventory.available;

  const totalReserved = inventory.reserved;

  const totalReleased = finishedGoods
    .filter(fg => fg.status === 'Released')
    .reduce((s, fg) => s + fg.quantity, 0);

  const [activeTab, setActiveTab] = useViewState<FilterTab>("production/FinishedPipes:activeTab", 'Awaiting Label / Storage');

  const [productType, setProductType] = useViewState<'All' | PipeProductType>("production/FinishedPipes:productType", 'All');

  const [grade, setGrade] = useViewState("production/FinishedPipes:grade", "All")

  const [search, setSearch] = useViewState("production/FinishedPipes:search", "")
  const period = usePeriod('all', search);

  const [detailFG, setDetailFG] = useState<FinishedGood | null>(null);

  const [purpose, setPurpose] = useViewState<StoragePurposeSelection>("production/FinishedPipes:purpose", 'All');

  const [page, setPage] = useViewState("production/FinishedPipes:page", 1)
  const productFilters = useProductFilters(() => setPage(1));


  const filtered = useMemo(() => {
    return finishedGoods.filter(
      (fg) =>
        (purpose === 'All' || finishedPipeInventory(fg, app).purpose === purpose) &&
        (productType === 'All' || normalizedProductType(fg.product) === productType)
      && productFilters.matches(fg)
      && (grade === 'All' || fg.grade === grade)
      && matchesDestination(fg, activeTab)
      && dateInPeriod(fg.productionDate, period.range) &&
        ([fg.barcode, fg.fgId, fg.poRef, fg.currentLocation, fg.product].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
          matchesRecord(pipeSearchRecord(fg, { ...app, specifications: readPipeSpecifications() }), search)),
    )
  }, [finishedGoods, purpose, activeTab, grade, productType, search, productFilters.value, period.range, app.productionOrders, app.manufacturingOrders, app.orders, period.range.start, period.range.end])


  return (
    <div className="page-stack">
      {/* Page header */}
      <div className="flex items-center justify-between page-toolbar">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Finished Pipes</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Finished goods inventory and storage logging</div>
        </div>
        <button className="btn-primary" onClick={() => navigate('prod-barcode')}>
          Scan with Honeywell</button>
      </div>

      {/* Summary cards */}
      <MetricCards inventory label="Finished Goods inventory summary" items={[
        ['Available', <span style={{ color: '#16a34a' }}>{totalAvailable}</span>, 'units'],
        ['Reserved', <span style={{ color: '#2563eb' }}>{totalReserved}</span>, 'units'],
        ['Temporary Storage', inventory.temporary, 'units'], ['Ready for Ship Out', inventory.ready, 'units'],
        ['On Hand', totalUnits, 'units'],
      ]} />
      <div className="helper-text">Total Released: <strong>{totalReleased}</strong> units</div>

      <div className="app-card detail-card page-stack">
        <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => setPage(1)} placeholder="Search barcode, pipe ID, PO, product, or storage location..." filters={<><ProductFilters value={productFilters.value} onChange={productFilters.change} product={productType} onProductChange={value => { setProductType(value as 'All' | PipeProductType); setPage(1); }} grade={grade} onGradeChange={value => { setGrade(value); setPage(1); }} includeColor includeLocation /><StoragePurposeFilter value={purpose} onChange={value => { setPurpose(value); setPage(1); }} /></>} />
      </div>

      <LegacyBarcodeNotice query={search} pipes={finishedGoods} />
      {/* Filter tabs */}
      <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="report-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--card-border)', padding: '0 16px' }}>
          {FILTER_TABS.map((tab) => {
            const count = finishedGoods.filter(fg => matchesDestination(fg, tab)).length;

            const active = activeTab === tab

            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setPage(1); }}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
                  fontWeight: active ? 700 : 400,
                  fontSize: 12,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
              >
                {tab}{" "}
                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>({count})</span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          {filtered.length === 0 ? (
            <div className="empty-state empty-state-action">
              <strong>NO RECORDS FOUND</strong>
              <span>No records match the selected search, date, or filters.</span>
              <button className="btn-secondary btn-compact" onClick={() => { setSearch(''); setProductType('All'); setGrade('All'); productFilters.reset(); period.setDate(''); setPage(1); }}>Clear Filters</button>
            </div>
          ) : (
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>FG ID</th>
                  <th>Barcode</th>
                  <th>Product</th>
                  <th>Size</th>
                  <th>SDR / Thickness</th>
                  <th>Grade</th>
                  <th>Storage Location</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Available</th>
                  <th style={{ textAlign: "right" }}>Reserved</th>
                  <th>Status</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filtered, page).map((fg) => (
                  <tr
                    key={fg.id}
                    className="table-row-hover"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDetailFG(fg)}
                  >
                    <td>
                      <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>
                        <RecordReference value={fg.fgId} />
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        <RecordReference value={fg.barcode} />
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>{fg.product}</td>
                    <td>
                      <span className="font-mono" style={{ fontSize: 12 }}>
                        {fg.diameter} x {fg.length}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{fg.sdr}</td>
                    <td style={{ fontSize: 12 }}>{fg.grade}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {fg.currentLocation || "Not Yet Assigned"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="font-mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {fg.quantity}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>
                        {finishedPipeInventory(fg, app).available}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
                        {finishedPipeInventory(fg, app).reserved}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={fg.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </TableBody>
            </table>
          )}
        </div>
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>

      {/* Modals */}
      <DetailModal fg={detailFG} onClose={() => setDetailFG(null)} />
    </div>
  )
}
