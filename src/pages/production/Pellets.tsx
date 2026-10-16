import { pelletColorLabel } from '../../pelletColors';
import RecordReference from '../../components/RecordReference';
import { DismissButton } from '../../components/ActionButton';
import ActionButton from '../../components/ActionButton';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import MaterialLocationFilters from '../../components/MaterialLocationFilters';
import { matchesLocation, locationQuantity, inventoryLocationLabel } from '../../locationMaster';
import { matchesInventoryColor } from '../../productFilters';
import React, { useState } from "react"

import { isSupportedMaterialGrade, normalizeMaterialGrade, useApp } from '../../store';

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import type { PelletInventory, ProductionOrder } from '../../types';

import CategoryTabs from "../../components/CategoryTabs"

import { MATERIAL_CATEGORIES, MATERIAL_GRADES, type MaterialCategoryTab } from '../../inventoryCategories';

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

import Pagination, { pageRecords } from '../../components/Pagination';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

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

// ─── VIEW DETAIL MODAL ────────────────────────────────────────────────────────

interface DetailModalProps {
  pellet: PelletInventory | null;
  onClose: () => void;
}

function PelletDetailModal({ pellet, onClose }: DetailModalProps) {
  if (!pellet) return null;
  const lowStock = pellet.availableKg < 100;
  return (
    <Modal open={!!pellet} onClose={onClose} title="Pellet Batch Detail" width="520px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="app-card detail-card">
          <div className="section-title">Barcode</div>
          <div className="field-value font-mono"><RecordReference value={pellet.barcode} /></div>
          <div className="helper-text">The system assigned this barcode automatically. Production scans the label during authorized operations.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <LabelValue label="Batch No." value={pellet.batchNo} mono />
          <LabelValue label="Type" value={
            <span className={pellet.type === 'Virgin' ? 'badge-blue' : 'badge-green'} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'inline-block' }}>
              {pellet.type}
            </span>
          } />
          <LabelValue label="Grade" value={pellet.grade} />
          <LabelValue label="Color" value={pelletColorLabel(pellet.type, pellet.color)} />
          <LabelValue label="Received Date" value={pellet.receivedDate} mono />
          <LabelValue label="Transfer Ref" value={pellet.transferRef || '—'} mono />
          <LabelValue label="Current Location" value={pellet.currentLocation || 'Not Yet Assigned'} />
        </div>

        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Available Stock</div>
          <div className="font-mono" style={{ fontSize: 32, fontWeight: 700, color: lowStock ? '#d97706' : 'var(--accent-blue)', lineHeight: 1 }}>
            {fmt(pellet.availableKg)} kg
          </div>
          {lowStock && (
            <div className="alert-warning" style={{ marginTop: 8, padding: '6px 10px', fontSize: 12, borderRadius: 6 }}>
              Low stock — below 100 kg threshold.
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── LOAD TO PRODUCTION MODAL ─────────────────────────────────────────────────

interface LoadModalProps {
  pellet: PelletInventory | null;
  activePO: ProductionOrder | null;
  onClose: () => void;
  onLoad: (kg: number) => void;
}

function LoadModal({ pellet, activePO, onClose, onLoad }: LoadModalProps) {
  const [kgInput, setKgInput] = useState("")

  const [error, setError] = useState("")

  const [success, setSuccess] = useState(false)

  if (!pellet || !activePO) return null

  const parsedKg = parseFloat(kgInput)

  function handleConfirm() {
    setError('');
    if (!kgInput || isNaN(parsedKg) || parsedKg <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    if (parsedKg > pellet!.availableKg) {
      setError(`Cannot exceed available stock (${fmt(pellet!.availableKg)} kg).`);
      return;
    }
    onLoad(parsedKg);
    setSuccess(true);
  }

  function handleClose() {
    setKgInput('');
    setError('');
    setSuccess(false);
    onClose();
  }

  if (success) {
    return (
      <Modal open onClose={handleClose} title="Load to Production" width="480px">
        <div className="alert-success" style={{ padding: '14px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          Successfully loaded {fmt(parsedKg)} kg from batch <RecordReference value={pellet.batchNo} /> to{" "}
          <RecordReference value={activePO.poNo} />.
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={handleClose}>Done</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={handleClose} title="Load Pellets to Production" width="520px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Pellet info */}
        <div className="app-card" style={{ background: 'var(--app-bg)', padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Selected Batch</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <LabelValue label="Batch No." value={pellet.batchNo} mono />
            <LabelValue label="Grade" value={pellet.grade} />
            <LabelValue label="Color" value={pelletColorLabel(pellet.type, pellet.color)} />
            <LabelValue
              label="Available"
              value={
                <span className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-blue)' }}>
                  {fmt(pellet.availableKg)} kg
                </span>
              }
            />
          </div>
        </div>

        {/* Active PO info */}
        <div className="app-card" style={{ background: 'var(--app-bg)', padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Active Production Order</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <LabelValue label="PO Number" value={activePO.poNo} mono />
            <LabelValue label="Product" value={activePO.product} />
            <LabelValue label="Usage Basis" value="Actual successful loads" />
            <LabelValue label="Loaded" value={<span className="font-mono">{fmt(activePO.loadedKg)} kg</span>} />
            <LabelValue label="Expected Usage" value="No BOM defined" />
          </div>
        </div>

        {/* Note for preferred pellet */}
        {pellet.type === 'Virgin' && pellet.grade === activePO.grade && (
          <div className="alert-info" style={{ padding: '8px 12px', fontSize: 12, borderRadius: 6 }}>
            Virgin {pellet.grade} pellets are White. Pipe color is supplied separately by colorants for <RecordReference value={activePO.poNo} />.
          </div>
        )}

        {/* kg input */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            kg to Load{" "}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(max {fmt(pellet.availableKg)} kg)</span>
          </label>
          <input
            type="number"
            className="app-input"
            style={{ width: '100%' }}
            min={1}
            max={pellet.availableKg}
            step={0.1}
            value={kgInput}
            onChange={e => { setKgInput(e.target.value); setError(''); }}
            placeholder="Enter kg to load"
            autoFocus
          />
          {error && (
            <div className="alert-error" style={{ marginTop: 6, padding: '6px 10px', fontSize: 12, borderRadius: 6 }}>
              {error}
            </div>
          )}
        </div>

        <div className="form-actions">
          <DismissButton className="btn-secondary" onClick={handleClose}>Cancel</DismissButton>
          <ActionButton className="btn-primary" onClick={handleConfirm}>Confirm Pellet Load</ActionButton>
        </div>
      </div>
    </Modal>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Pellets() {
  const { pellets, colorants, materialUsageTransactions, activeProductionOrder: activePO, navigate } = useApp();

  const totalVirgin = pellets.filter(p => p.type === 'Virgin' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const totalRecycled = pellets.filter(p => p.type === 'Recycled' && p.inventoryStatus === 'Available').reduce((s, p) => s + p.availableKg, 0);

  const loaded = activePO ? pellets.filter(p => p.loadedForPOId === activePO.id && ['Loaded', 'Partially Consumed'].includes(p.inventoryStatus)).reduce((sum, p) => sum + p.availableKg, 0) : 0;

  const [detailPellet, setDetailPellet] = useState<PelletInventory | null>(null);

  const [category, setCategory] = useViewState<MaterialCategoryTab>("production/Pellets:category", 'Virgin Pellets');

  const [grade, setGrade] = useViewState("production/Pellets:grade", "All")

  const [lifecycle, setLifecycle] = useViewState<'All' | 'Available' | 'Open / WIP' | 'Fully Consumed'>("production/Pellets:lifecycle", 'Available');

  const [location, setLocation] = useViewState("production/Pellets:location", 'All');
  const [color, setColor] = useViewState("production/Pellets:color", '');
  const [colorantType, setColorantType] = useViewState<'All' | 'Base Colorant' | 'Stripe Colorant'>("production/Pellets:colorantType", 'All');

  const [search, setSearch] = useViewState("production/Pellets:search", "")
  const period = usePeriod('all', search);

  const [page, setPage] = useViewState("production/Pellets:page", 1)


  const selectedType = category === 'Virgin Pellets' ? 'Virgin' : 'Recycled';

  const filteredPellets = pellets.filter(
    (pellet) =>
      pellet.type === selectedType
    && (lifecycle === 'All' || (lifecycle === 'Available'
      ? pellet.inventoryStatus === 'Available'
      : lifecycle === 'Open / WIP'
        ? ['Loaded', 'Partially Consumed'].includes(pellet.inventoryStatus)
        : pellet.inventoryStatus === 'Fully Consumed'))
    && matchesLocation(pellet, location) && matchesInventoryColor(pellet.color, color)
    && (grade === 'All' || pellet.grade === grade)
    && dateInPeriod(pellet.receivedDate, period.range) &&
      ([pellet.barcode, pellet.batchNo, pellet.grade].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(pellet, search)),
  )

  const filteredColorants = colorants.filter(
    (colorant) =>
      matchesLocation(colorant, location) && matchesInventoryColor(colorant.color, color) && (colorantType === 'All' || colorant.usageType === (colorantType === 'Base Colorant' ? 'BASE_COLORANT' : 'STRIPE_COLORANT'))
    && dateInPeriod(colorant.lastUpdated, period.range) &&
      ([colorant.colorantId, colorant.name, colorant.color].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(colorant, search)),
  )

  const colorantUsed = (id: string) => materialUsageTransactions
    .filter(item => item.materialId === id && item.productionOrderId === activePO?.id)
    .reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Production Materials</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Pellet bags and kg-based colorants are managed separately</div>
        </div>
        {activePO && (
          <span className="badge-blue" style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
            Active PO: <RecordReference value={activePO.poNo} />
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="app-card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total Virgin Available</div>
          <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>
            {fmt(totalVirgin)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            kg across {pellets.filter((p) => p.type === "Virgin").length}{" "}
            batches
          </div>
        </div>
        <div className="app-card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total Recycled Available</div>
          <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: '#16a34a', lineHeight: 1 }}>
            {fmt(totalRecycled)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            kg across {pellets.filter((p) => p.type === "Recycled").length}{" "}
            batches
          </div>
        </div>
        <div className="app-card" style={{ padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Active PO Pellet Gap</div>
          <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>
            {fmt(loaded)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            kg actually loaded for {activePO?.poNo ?? "No active PO"}
          </div>
        </div>
      </div>

      {/* Progress bar for active PO */}
      {activePO && (
        <div className="app-card" style={{ padding: '14px 16px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Actual Pellet Usage — <RecordReference value={activePO.poNo} />
            </div>
            <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {fmt(loaded)} kg
            </div>
          </div>
          <div className="progress-bar" style={{ height: 10, borderRadius: 5 }}>
            <div
              className="progress-fill"
              style={{
                width: `${loaded > 0 ? 100 : 0}%`,
                background: 'var(--accent-blue)',
                borderRadius: 5,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Successful load transactions only</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>No BOM quantity defined</div>
          </div>
        </div>
      )}

      <div className="app-card detail-card page-stack">
        <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => setPage(1)} placeholder="Search barcode, batch, product, PO, reference, or location..." />
        <CategoryTabs items={MATERIAL_CATEGORIES} value={category} onChange={next => { setCategory(next); setPage(1); }} label="Production material category" />
        {category === 'Colorants' && <CategoryTabs items={['All', 'Base Colorant', 'Stripe Colorant'] as const} value={colorantType} onChange={value => { setColorantType(value); setPage(1); }} label="Colorant usage type" />}
        <MaterialLocationFilters pelletType={category === 'Colorants' ? 'Colorant' : selectedType} records={(category === 'Colorants' ? colorants.filter(item => dateInPeriod(item.lastUpdated, period.range) && (colorantType === 'All' || item.usageType === (colorantType === 'Base Colorant' ? 'BASE_COLORANT' : 'STRIPE_COLORANT')) && matchesRecord(item, search)) : pellets.filter(item => item.type === selectedType && item.inventoryStatus !== 'Pending Receipt' && dateInPeriod(item.receivedDate, period.range) && matchesRecord(item, search)))} status={lifecycle} onStatusChange={category === 'Colorants' ? undefined : value => { setLifecycle(value as typeof lifecycle); setPage(1); }} statusFor={item => ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus) ? 'Open / WIP' : item.inventoryStatus === 'Fully Consumed' ? 'Fully Consumed' : 'Available'} grade={grade} onGradeChange={category === 'Colorants' ? undefined : value => { setGrade(value); setPage(1); }} color={color} location={location} onColorChange={value => { setColor(value); setPage(1); }} onLocationChange={value => { setLocation(value); setPage(1); }} />
      </div>

      {!activePO && (
        <div className="alert-info" style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
          No active production order. Pellet loading is disabled until a PO is In Production.
        </div>
      )}

      {/* Category-specific inventory table */}
      <div className="app-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {category}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {category === 'Colorants' ? `${filteredColorants.length} kg-balance records` : `${filteredPellets.length} physical bag records`}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          {category === "Colorants" ? (
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Colorant ID</th>
                  <th>Color</th>
                  <th>Usage Type</th>
                  <th>Available kg</th>
                  <th>Location</th>
                  <th>Current PO Usage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filteredColorants, page).map((colorant) => (
                  <tr key={colorant.id}>
                    <td className="font-mono">{colorant.colorantId}</td>
                    <td>
                      {colorant.color} ({colorant.colorCode})
                    </td>
                    <td>
                      {colorant.usageType === 'BASE_COLORANT' ? 'Base Colorant' : 'Stripe Colorant'}
                    </td>
                    <td className="font-mono">
                      {locationQuantity(colorant, location).toFixed(3)}
                    </td>
                    <td>{inventoryLocationLabel(colorant)}</td>
                    <td className="font-mono">
                      {colorantUsed(colorant.id).toFixed(3)} kg
                    </td>
                    <td>
                      <StatusBadge status={colorant.status} />
                    </td>
                  </tr>
                ))}
              </TableBody>
            </table>
          ) : (
            <table className="app-table" style={{ width: "100%" }}>
              <thead>
              <tr>
                <th>Batch No.</th>
                <th>Type</th>
                <th>Grade</th>
                <th>Color</th>
                <th>Location</th>
                <th style={{ textAlign: 'right' }}>Available (kg)</th>
                <th>Barcode</th>
                <th>Received Date</th>
                <th>Transfer Ref</th>
                <th data-actions>Actions</th>
              </tr>
            </thead>
              <TableBody>
                {pageRecords(filteredPellets, page).map((pellet) => {
                  const lowStock = pellet.availableKg < 100

                  const validGrade = isSupportedMaterialGrade(pellet.grade)

                  const compatibleGrade = !!activePO && validGrade && isSupportedMaterialGrade(activePO.grade)
                  && normalizeMaterialGrade(pellet.grade) === normalizeMaterialGrade(activePO.grade);

                  const canLoad = pellet.availableKg === 25 && pellet.inventoryStatus === 'Available' && compatibleGrade && !!pellet.barcode;

                  return (
                    <tr
                    key={pellet.id}
                    className="table-row-hover"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setDetailPellet(pellet)}
                  >
                      <td>
                      <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>
                        <RecordReference value={pellet.batchNo} />
                      </span>
                    </td>
                      <td>
                      <span
                        className={pellet.type === 'Virgin' ? 'badge-blue' : 'badge-green'}
                        style={{ padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, display: 'inline-block' }}
                      >
                        {pellet.type}
                      </span>
                    </td>
                      <td style={{ fontSize: 13 }}>{pellet.grade}</td>
                      <td style={{ fontSize: 13 }}>{pelletColorLabel(pellet.type, pellet.color)}</td>
                      <td>{inventoryLocationLabel(pellet)}</td>
                      <td style={{ textAlign: 'right' }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: lowStock ? '#d97706' : 'var(--text-primary)',
                        }}
                      >
                        {fmt(pellet.availableKg)}
                      </span>
                      {lowStock && (
                        <span className="badge-amber" style={{ marginLeft: 6, padding: '1px 5px', fontSize: 10, borderRadius: 4 }}>Low</span>
                      )}
                    </td>
                      <td>
                        <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          <RecordReference value={pellet.barcode} />
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {pellet.receivedDate}
                      </td>
                      <td>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {pellet.transferRef ?? '—'}
                      </span>
                    </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                        className="btn-primary btn-compact"
                        disabled={!canLoad}
                        aria-describedby={!canLoad ? `load-reason-${pellet.id}` : undefined}
                        onClick={() => canLoad && navigate('prod-barcode')}
                      >
                        Scan with Honeywell
                      </button>
                        {!canLoad && (
                          <div className="button-reason" id={`load-reason-${pellet.id}`}>
                            {!validGrade
                              ? "INVALID PELLET GRADE — Select a supported material grade."
                              : !activePO ? 'An active production order is required.' : !compatibleGrade ? `${pellet.grade} cannot be substituted for ${activePO.grade}.` : !pellet.barcode ? 'Physical barcode registration is incomplete.' : 'No available pellets in this batch.'}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </TableBody>
            </table>
          )}
        </div>
        {!(category === 'Colorants' ? filteredColorants.length : filteredPellets.length) && (
          <div className="empty-state empty-state-action">
            <strong>NO RECORDS FOUND</strong>
            <span>No records match the selected search, date, or filters.</span>
            <button className="btn-secondary btn-compact" onClick={() => { setSearch(''); period.setDate(''); setPage(1); }}>Clear Filters</button>
          </div>
        )}
        <Pagination page={page} totalRecords={category === 'Colorants' ? filteredColorants.length : filteredPellets.length} onPageChange={setPage} />
      </div>

      {/* Modals */}
      <PelletDetailModal pellet={detailPellet} onClose={() => setDetailPellet(null)} />
    </div>
  )
}
