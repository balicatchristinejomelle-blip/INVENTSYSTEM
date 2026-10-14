import FinishedPipeDetails from '../../components/FinishedPipeDetails';
import { pipeSearchRecord, readPipeSpecifications } from '../../finishedPipeRelations';
import { matchesRecord } from "../../components/RecordSearch"

import React, { useState, useMemo } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import type { FinishedGood } from "../../types"

import CategoryTabs from "../../components/CategoryTabs"

import { MATERIAL_GRADES, PIPE_PRODUCT_TYPES, normalizedProductType, type PipeProductType } from '../../inventoryCategories';

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

import Pagination, { pageRecords } from '../../components/Pagination';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

type FilterTab = 'Awaiting Label / Storage' | 'Available' | 'Reserved' | 'Ready for Ship Out' | 'Shipped Out / Released';

const FILTER_TABS: FilterTab[] = ['Awaiting Label / Storage', 'Available', 'Reserved', 'Ready for Ship Out', 'Shipped Out / Released'];

const matchesDestination = (item: FinishedGood, destination: FilterTab) => {
  if (destination === 'Shipped Out / Released') return item.releaseStatus === 'Released';
  if (item.releaseStatus === 'Released') return false;
  if (destination === 'Awaiting Label / Storage') return item.locationStatus === 'Awaiting Storage';
  if (destination === 'Reserved') return item.status === 'Reserved';
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="app-card detail-card">
          <div className="section-title">Barcode</div>
          <div className="field-value font-mono">{fg.barcode}</div>
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

function RecordStorageModal({ open, onClose, currentShift, activePOProduct }: {
  open: boolean;
  onClose: () => void;
  currentShift: string;
  activePOProduct: string;
}) {
  const today = new Date().toISOString().slice(0, 10)

  // Generate a mock batch number

  const batchCounter = useMemo(() => String(Math.floor(Math.random() * 900) + 100), [open]);

  const autoBatch = `BATCH-2026-0${batchCounter}`

  const [location, setLocation] = useState("")

  const [qty, setQty] = useState("")

  const [error, setError] = useState("")

  const [success, setSuccess] = useState(false)

  function handleSubmit() {
    setError('');
    if (!location.trim()) { setError('Storage location is required.'); return; }
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) { setError('Enter a valid quantity greater than 0.'); return; }
    setSuccess(true);
  }

  function handleClose() {
    setLocation('');
    setQty('');
    setError('');
    setSuccess(false);
    onClose();
  }

  if (!open) return null

  if (success) {
    return (
      <Modal open onClose={handleClose} title="Record Storage" width="480px">
        <div className="alert-success" style={{ padding: '14px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          Storage recorded — {qty} units of {activePOProduct} logged to{" "}
          {location} (Batch {autoBatch}).
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={handleClose}>Done</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={handleClose} title="Record Finished Pipe Storage" width="500px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Product Description</label>
          <div
            style={{
              background: 'var(--app-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            {activePOProduct || 'No active production order'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Batch No. (Auto-generated)</label>
            <div
              style={{
                background: 'var(--app-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--accent-blue)',
              }}
            >
              {autoBatch}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Production Date</label>
            <div
              style={{
                background: 'var(--app-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'var(--text-secondary)',
              }}
            >
              {today}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Shift</label>
            <div
              style={{
                background: 'var(--app-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              {currentShift} Shift
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Quantity Recorded</label>
            <input
              type="number"
              className="app-input"
              style={{ width: '100%' }}
              min={1}
              step={1}
              value={qty}
              onChange={e => { setQty(e.target.value); setError(''); }}
              placeholder="Enter qty (pipes)"
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Storage Location</label>
          <input
            type="text"
            className="app-input"
            style={{ width: '100%' }}
            value={location}
            onChange={e => { setLocation(e.target.value); setError(''); }}
            placeholder="e.g. Section B / B-04"
          />
        </div>

        {error && (
          <div className="alert-error" style={{ padding: '8px 12px', fontSize: 12, borderRadius: 6 }}>
            {error}
          </div>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={handleClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>Confirm Storage</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function FinishedPipes() {
  const app = useApp();
  const { finishedGoods, activeProductionOrder: activePO, currentShift, navigate } = app;

  const activePOProduct = activePO
    ? `${activePO.product} ${activePO.diameter} ${activePO.length} ${activePO.sdr} ${activePO.grade} ${activePO.color}`
    : '';

  const totalUnits = finishedGoods.filter(fg => fg.releaseStatus !== 'Released' && fg.qualityStatus === 'Pass').reduce((s, fg) => s + fg.quantity, 0);

  const totalAvailable = finishedGoods.reduce((s, fg) => s + fg.availableQty, 0);

  const totalReserved = finishedGoods.reduce((s, fg) => s + fg.reservedQty, 0);

  const totalReleased = finishedGoods
    .filter(fg => fg.status === 'Released')
    .reduce((s, fg) => s + fg.quantity, 0);

  const [activeTab, setActiveTab] = useState<FilterTab>('Awaiting Label / Storage');

  const [productType, setProductType] = useState<'All' | PipeProductType>('All');

  const [grade, setGrade] = useState("All")

  const [search, setSearch] = useState("")

  const [detailFG, setDetailFG] = useState<FinishedGood | null>(null);

  const [showRecordStorage, setShowRecordStorage] = useState(false);

  const [page, setPage] = useState(1)

  const period = usePeriod()

  const filtered = useMemo(() => {
    return finishedGoods.filter(
      (fg) =>
        (productType === 'All' || normalizedProductType(fg.product) === productType)
      && (grade === 'All' || fg.grade === grade)
      && matchesDestination(fg, activeTab)
      && dateInPeriod(fg.productionDate, period.range) &&
        ([fg.barcode, fg.fgId, fg.poRef, fg.currentLocation, fg.product].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
          matchesRecord(pipeSearchRecord(fg, { ...app, specifications: readPipeSpecifications() }), search)),
    )
  }, [finishedGoods, activeTab, grade, productType, search, period.range, app.productionOrders, app.manufacturingOrders, app.orders])

  const productTabs: readonly ('All' | PipeProductType)[] = ['All', ...PIPE_PRODUCT_TYPES];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Physical On-Hand', value: totalUnits, color: 'var(--text-primary)' },
          { label: 'Total Available', value: totalAvailable, color: '#16a34a' },
          { label: 'Total Reserved', value: totalReserved, color: '#2563eb' },
          { label: 'Total Released', value: totalReleased, color: 'var(--text-muted)' },
        ].map((card) => (
          <div key={card.label} className="app-card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {card.label}
            </div>
            <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>units</div>
          </div>
        ))}
      </div>

      <div className="app-card detail-card page-stack">
        <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => setPage(1)} placeholder="Search barcode, pipe ID, PO, product, or storage location..." />
        <CategoryTabs items={productTabs} value={productType} onChange={value => { setProductType(value); setPage(1); }} label="Finished pipe product type" />
        <CategoryTabs items={['All', ...MATERIAL_GRADES] as const} value={grade} onChange={value => { setGrade(value); setPage(1); }} label="Finished pipe material grade" />
      </div>

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
              <button className="btn-secondary btn-compact" onClick={() => { setSearch(''); period.setDate(''); setPage(1); }}>Clear Filters</button>
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
              <tbody>
                {pageRecords(filtered, page).map((fg) => (
                  <tr
                    key={fg.id}
                    className="table-row-hover"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDetailFG(fg)}
                  >
                    <td>
                      <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>
                        {fg.fgId}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {fg.barcode}
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
                        {fg.availableQty}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
                        {fg.reservedQty}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={fg.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>

      {/* Modals */}
      <DetailModal fg={detailFG} onClose={() => setDetailFG(null)} />
      <RecordStorageModal
        open={showRecordStorage}
        onClose={() => setShowRecordStorage(false)}
        currentShift={currentShift}
        activePOProduct={activePOProduct}
      />
    </div>
  )
}
