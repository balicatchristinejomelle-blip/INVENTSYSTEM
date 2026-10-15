import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import ActionButton from '../../components/ActionButton';
import RecordList from "../../components/RecordList"

import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import MaterialLocationFilters from '../../components/MaterialLocationFilters';
import LocationSelect from '../../components/LocationSelect';
import { matchesLocation, locationQuantity, inventoryLocationLabel } from '../../locationMaster';
import { matchesInventoryColor } from '../../productFilters';
import React, { useMemo, useState } from "react"

import { useApp } from "../../store"

import Modal from "../../components/Modal"

import BarcodeLabel, { printBarcodeBatch } from '../../components/BarcodeLabel';
import { BatchPrintAction } from '../../components/PrintAction';
import { metadataFor, printState } from '../../reprintWorkflow';
import { printableRecords } from '../../printableRecords';

import StatusBadge from "../../components/StatusBadge"

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

import { MATERIAL_CATEGORIES, MATERIAL_GRADES, materialGradeFilterLabel, type MaterialCategoryTab } from '../../inventoryCategories';

import type { StockTarget } from "../../types"

export default function PelletInventory() {
  const app = useApp();
  const { pellets, colorants, recyclingBatches, materialUsageTransactions, materialRequests, transfers, navigate } = app;
  const printable = printableRecords(app);
  const printRecord = (id: string) => printable.find(record => record.kind === 'Barcode' && record.recordType === 'Pellet' && record.recordId === id);

  const [category, setCategory] = useViewState<MaterialCategoryTab>("plantmanager/PelletInventory:category", 'Virgin Pellets');

  const [grade, setGrade] = useViewState("plantmanager/PelletInventory:grade", "All")

  const [recycledView, setRecycledView] = useViewState<'All' | 'Complete 25 kg Bags' | 'Loose Recycled Pellet'>("plantmanager/PelletInventory:recycledView", 'All');

  const [lifecycle, setLifecycle] = useViewState<'All' | 'Available' | 'Open / WIP' | 'Fully Consumed'>("plantmanager/PelletInventory:lifecycle", 'All');

  const [search, setSearch] = useViewState("plantmanager/PelletInventory:search", "")

  const [location, setLocation] = useViewState("plantmanager/PelletInventory:location", "All")
  const [color, setColor] = useViewState("plantmanager/PelletInventory:color", '');

  const [colorantType, setColorantType] = useViewState<'All' | 'Base Colorant' | 'Stripe Colorant'>("plantmanager/PelletInventory:colorantType", 'All');

  const [stockFilter, setStockFilter] = useViewState<'All' | 'Normal' | 'Low Stock' | 'Out of Stock' | 'Request Pending'>("plantmanager/PelletInventory:stockFilter", 'All');

  const [page, setPage] = useViewState("plantmanager/PelletInventory:page", 1)

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveLocation, setMoveLocation] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moveError, setMoveError] = useState('');

  const selected = pellets.find(item => item.id === selectedId);

  const pelletType = category === 'Virgin Pellets' ? 'Virgin' : 'Recycled';

  const filtered = pellets.filter(
    (item) =>
      item.type === pelletType
    && (lifecycle === 'All' || (lifecycle === 'Available'
      ? ['Available', 'Pending Receipt'].includes(item.inventoryStatus)
      : lifecycle === 'Open / WIP'
        ? ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus)
        : item.inventoryStatus === 'Fully Consumed'))
    && (grade === 'All' || item.grade === grade)
    && matchesLocation(item, location) && matchesInventoryColor(item.color, color) &&
      ([item.barcode, item.batchNo, item.grade].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord({ ...item, printStatus: printRecord(item.id) ? printState(app, printRecord(item.id)!) : '', reprintStatus: app.reprintRequests.find(request => request.printable.key === printRecord(item.id)?.key)?.status }, search)),
  )

  const visibleColorants = colorants.filter(
    (item) =>
      matchesLocation(item, location) && matchesInventoryColor(item.color, color) && (colorantType === 'All' || item.usageType === (colorantType === 'Base Colorant' ? 'BASE_COLORANT' : 'STRIPE_COLORANT')) &&
      ([item.colorantId, item.name, item.color].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(item, search)),
  )

  const colorantUsed = (id: string) => materialUsageTransactions
    .filter(item => item.materialId === id)
    .reduce((sum, item) => sum + item.quantity, 0);

  const looseRecycledKg = recyclingBatches.reduce((sum, item) => sum + (item.looseKg || 0), 0);

  const bagUsage = (id: string) => materialUsageTransactions.filter(item => item.physicalBagId === id);

  const unprinted = filtered.filter(item => printRecord(item.id) && metadataFor(app, printRecord(item.id)!).printCount === 0);

  const currentPellets = pageRecords(filtered, page)

  const currentColorants = pageRecords(visibleColorants, page)

  const resetPage = () => setPage(1)

  const counts = useMemo(() => ({
    'Virgin Pellets': pellets.filter(item => item.type === 'Virgin').length,
    'Recycled Pellets': pellets.filter(item => item.type === 'Recycled').length,
    Colorants: colorants.length,
  }), [pellets, colorants]);

  const stockTargets = useMemo(() => {
    try { return JSON.parse(window.localStorage.getItem('hpai:stock-targets-v1') || '[]') as StockTarget[]; }
    catch { return []; }
  }, []);

  const materialStockRows = stockTargets.flatMap(target => {
    if (target.status !== 'Active' || target.plant !== 'Branch Plant' || target.inventoryType === 'Finished Pipe') return [];
    const current = target.inventoryType === 'Colorant'
      ? colorants.filter(item => item.color === target.color && item.usageType === target.colorantUsageType).reduce((sum, item) => sum + item.availableKg, 0)
      : pellets.filter(item => item.type === (target.inventoryType === 'Virgin Pellet' ? 'Virgin' : 'Recycled') && item.grade === target.materialGrade && item.availableKg > 0).reduce((sum, item) => sum + item.availableKg, 0);
    const openRequest = materialRequests.find(item => {
      const replenishmentReceived = transfers.some(transfer => transfer.requestRef === item.refNo && transfer.status === 'Received');
      if (replenishmentReceived || !['New', 'Pending', 'Approved'].includes(item.status) || (item.destination || 'Branch Plant') !== 'Branch Plant') return false;
      if (target.inventoryType === 'Colorant') return item.materialCategory === 'Colorant' && item.color === target.color && item.colorantUsageType === target.colorantUsageType;
      return item.materialCategory === target.inventoryType && item.grade === target.materialGrade;
    });
    const stockStatus = openRequest ? 'Request Pending' : current === 0 ? 'Out of Stock' : current <= target.minimumStock ? 'Low Stock' : 'Normal';
    return [{ target, current, openRequest, stockStatus }];
  });

  const visibleMaterialStockRows = materialStockRows.filter(
    ({ target, openRequest, stockStatus }) => {
      const label = target.inventoryType === 'Colorant' ? `${target.color} ${target.colorantUsageType}` : `${target.inventoryType} ${target.materialGrade}`;

      return (
        (stockFilter === "All" || stockStatus === stockFilter) &&
        ([label, stockStatus, openRequest?.refNo || ''].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
          matchesRecord(openRequest, search))
      )
    },
  )

  const createMaterialRequest = (target: StockTarget, current: number) => {
    const suggestedKg = Math.max(0, target.targetStock - current);
    window.sessionStorage.setItem('hpai:material-request-intent-v1', JSON.stringify({
      category: target.inventoryType,
      grade: target.materialGrade,
      color: target.color,
      usageType: target.colorantUsageType,
      current,
      minimum: target.minimumStock,
      target: target.targetStock,
      suggestedKg,
      bags: target.inventoryType === 'Colorant' ? undefined : Math.ceil(suggestedKg / 25),
    }));
    navigate('pm-requests');
  };

  const printAll = () => {
    const printedIds = printBarcodeBatch(unprinted.map(item => ({
      value: item.barcode,
      recordId: item.id,
      recordLabel: item.bagNo,
    })));
    return printedIds.length === unprinted.length;
  };

  return (
    <div className="page-stack">
      <div className="category-panel-header">
        <div>
          <div className="section-title">Material Monitoring & Barcode Management</div>
          <div className="helper-text">One permanent barcode per complete 25 kg pellet bag. Colorants remain kg-balance records.</div>
        </div>
        {category !== 'Colorants' && <BatchPrintAction records={unprinted.map(item => printRecord(item.id)!)} onPreview={printAll} label="Print Unprinted" />}
      </div>

      {materialStockRows.length > 0 && (
        <div className="low-stock-panel">
          <div className="section-title">Material Stock Targets & Replenishment</div>
          <CategoryTabs items={['All', 'Normal', 'Low Stock', 'Out of Stock', 'Request Pending'] as const} value={stockFilter} onChange={value => { setStockFilter(value); resetPage(); }} label="Material stock target state" />
          {
            <RecordList
              emptyMessage={false}
              records={visibleMaterialStockRows}
              query={search + stockFilter}
              render={({ target, current, openRequest, stockStatus }) => {
                const label = target.inventoryType === 'Colorant' ? `${target.color} · ${target.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe Colorant' : 'Base Colorant'}` : `${target.inventoryType} · ${target.materialGrade}`;

                const suggestedKg = Math.max(0, target.targetStock - current);

                return (
                  <div className="low-stock-row" key={target.id}>
                    <div>
                      <StatusBadge status={stockStatus.toUpperCase()} />
                      <strong>{label}</strong>
                      <span>
                        {current.toFixed(3)} kg available · minimum{" "}
                        {target.minimumStock.toFixed(3)} kg · target{" "}
                        {target.targetStock.toFixed(3)} kg
                        {current <= target.minimumStock ? ` · suggested ${suggestedKg.toFixed(3)} kg${target.inventoryType !== 'Colorant' ? ` (${Math.ceil(suggestedKg / 25)} × 25 kg bags)` : ''}` : ''}
                        {openRequest ? ` · ${openRequest.refNo}` : ""}
                      </span>
                    </div>
                    {openRequest ? <button className="btn-secondary" onClick={() => { window.sessionStorage.setItem('hpai:material-request-view-v1', openRequest.id); navigate('pm-requests'); }}>View Request</button> : current <= target.minimumStock ? <button className="btn-primary" onClick={() => createMaterialRequest(target, current)}>Create Material Request</button> : <span className="helper-text">No action required</span>}
                  </div>
                )
              }}
            />
          }
          {!visibleMaterialStockRows.length && <div className="empty-state">No material stock targets match this filter or search.</div>}
        </div>
      )}

      <CategoryTabs items={MATERIAL_CATEGORIES} value={category} onChange={next => { setCategory(next); setSearch(''); resetPage(); }} counts={counts} label="Material inventory category" />

      <div className="app-card detail-card page-stack">
        {category !== 'Colorants' && <CategoryTabs items={['All', ...MATERIAL_GRADES] as const} value={grade} onChange={value => { setGrade(value); resetPage(); }} label={`${category} grade`} displayLabel={materialGradeFilterLabel} groupLabel="Material Grade" />}
        {category === 'Recycled Pellets' && <CategoryTabs items={['All', 'Complete 25 kg Bags', 'Loose Recycled Pellet'] as const} value={recycledView} onChange={value => { setRecycledView(value); resetPage(); }} label="Recycled pellet form" />}
        {category === 'Colorants' && <CategoryTabs items={['All', 'Base Colorant', 'Stripe Colorant'] as const} value={colorantType} onChange={value => { setColorantType(value); resetPage(); }} label="Colorant usage type" />}
        {category !== 'Colorants' && <CategoryTabs items={['All', 'Available', 'Open / WIP', 'Fully Consumed'] as const} value={lifecycle} onChange={value => { setLifecycle(value); resetPage(); }} label="Pellet lifecycle destination" groupLabel="Status" />}
        <div className="filter-panel">
          <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} placeholder={category === 'Colorants' ? 'Search color or colorant ID' : 'Search barcode, batch, or grade'} />
          <MaterialLocationFilters color={color} location={location} onColorChange={value => { setColor(value); resetPage(); }} onLocationChange={value => { setLocation(value); resetPage(); }} />
        </div>
      </div>

      {category === 'Recycled Pellets' && recycledView === 'Loose Recycled Pellet' ? (
        <div className="app-card detail-card">
          <div className="section-title">Loose Recycled Pellet</div>
          <div className="kpi-card">
            <strong>{looseRecycledKg.toFixed(3)} kg</strong>
            <small>No standard bag barcode until 25 kg is accumulated and bagged.</small>
          </div>
        </div>
      ) : category === "Colorants" ? (
        <div className="app-card table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th>Colorant ID</th>
                <th>Color</th>
                <th>Usage Type</th>
                <th>Available kg</th>
                <th>Used kg</th>
                <th>Status</th>
                <th>Location</th><th>Source</th>
              </tr>
            </thead>
            <TableBody>
              {currentColorants.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono">{item.colorantId}</td>
                  <td>
                    {item.color} ({item.colorCode})
                  </td>
                  <td>
                    {item.usageType === 'BASE_COLORANT' ? 'Base Colorant' : 'Stripe Colorant'}
                  </td>
                  <td className="font-mono">{locationQuantity(item, location).toFixed(3)}</td>
                  <td className="font-mono">
                    {colorantUsed(item.id).toFixed(3)}
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{inventoryLocationLabel(item)}</td><td className="font-mono">{item.sourceReference || "—"}</td>
                </tr>
              ))}
            </TableBody>
          </table>
          <Pagination page={page} totalRecords={visibleColorants.length} onPageChange={setPage} />
        </div>
      ) : (
        <div className="app-card table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th>Bag Barcode</th>
                <th>Physical Bag</th>
                <th>Batch</th>
                <th>Grade</th>
                <th>Original / Remaining</th>
                <th>Status</th>
                <th>PO Usage History</th>
                <th>Lifecycle Date</th>
                <th>Location</th>
                <th>Print Status / Count</th>
                <th data-actions>Action</th>
              </tr>
            </thead>
            <TableBody>
              {currentPellets.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono"><RecordReference value={item.barcode} /></td>
                  <td className="font-mono">{item.bagNo}</td>
                  <td className="font-mono"><RecordReference value={item.batchNo} /></td>
                  <td>{item.grade}</td>
                  <td className="font-mono">
                    {(item.originalKg || 25).toFixed(3)} /{" "}
                    {item.availableKg.toFixed(3)} kg
                  </td>
                  <td>
                    <StatusBadge status={item.inventoryStatus} />
                  </td>
                  <td>
                    {bagUsage(item.id).length ? Array.from(new Set(bagUsage(item.id).map(usage => usage.productionOrderRef))).join(', ') : item.loadedForPORef || '—'}
                  </td>
                  <td>
                    {item.fullyConsumedAt ? new Date(item.fullyConsumedAt).toLocaleString('en-PH') : item.loadedAt ? new Date(item.loadedAt).toLocaleString('en-PH') : item.receivedDate}
                  </td>
                  <td>{item.currentLocation || "Not Yet Assigned"}</td>
                  <td>{printRecord(item.id) ? `${printState(app, printRecord(item.id)!).replace(/_/g, ' ')} / ${metadataFor(app, printRecord(item.id)!).printCount}` : 'Not printable'}</td>
                  <td>
                    <button className="btn-secondary btn-compact" onClick={() => { setSelectedId(item.id); setMoveLocation(''); setMoveReason(''); setMoveError(''); }}>View</button>
                  </td>
                </tr>
              ))}
            </TableBody>
          </table>
          <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
        </div>
      )}

      {selected && (
        <Modal draft={{ moveLocation, moveReason }} open title={`Pellet Bag — ${selected.bagNo}`} onClose={() => setSelectedId(null)} width="620px">
          <div className="page-stack">
            <BarcodeLabel
          value={selected.barcode}
          recordId={selected.id}
          recordLabel={selected.bagNo}
        />
            <div className="app-card detail-card">
              <div className="section-title">System Record Details · Not Printed</div>
              <div className="responsive-grid">
                {[
              ['Physical Item', selected.bagNo], ['Parent Batch', selected.batchNo], ['Pellet Type', selected.type],
              ['Original Weight', '25 kg'], ['Remaining Weight', `${selected.availableKg.toFixed(3)} kg`], ['Grade', selected.grade],
              ['Inventory Status', selected.inventoryStatus], ['Current Location', selected.currentLocation || 'Not Yet Assigned'],
            ].map(([label, value]) => (
                  <div key={label}>
                    <div className="field-label">{label}</div>
                    <div className="field-value">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            {app.currentUser?.role === 'plantmanager' && selected.locationStatus === 'Stored' && !['Loaded', 'Partially Consumed', 'Fully Consumed'].includes(selected.inventoryStatus) && <div className="app-card detail-card page-stack">
              <div className="section-title">Internal Location Movement</div>
              <LocationSelect value={moveLocation} onChange={setMoveLocation} />
              <input className="app-input" aria-label="Movement reason" value={moveReason} onChange={event => setMoveReason(event.target.value)} placeholder="Movement reason" />
              {moveError && <div className="alert-warning">{moveError}</div>}
              <ActionButton className="btn-primary" confirmMessage={moveLocation && moveReason.trim() ? `Move ${selected.barcode} to Location ${moveLocation}? Inventory quantity will not change.` : undefined} onClick={() => { if (!moveLocation) { setMoveError('Storage Location is required.'); return; } if (!moveReason.trim()) { setMoveError('Movement reason is required.'); return; } if (!app.relocatePhysicalItem('Pellet', selected.id, moveLocation, moveReason)) { setMoveError('Movement could not be saved.'); return; } setMoveError(''); setMoveLocation(''); setMoveReason(''); }}>Confirm Internal Movement (quantity unchanged)</ActionButton>
            </div>}
            {!!selected.locationHistory?.length && <div className="app-card detail-card"><div className="section-title">Location History</div>{selected.locationHistory.map((movement, index) => <div key={index} className="helper-text">{movement.from} → {movement.to} · {movement.action} · {movement.dateTime} · {movement.employee}</div>)}</div>}
          </div>
        </Modal>
      )}
    </div>
  )
}
