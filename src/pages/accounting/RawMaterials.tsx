import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import { LastUpdated } from '../../components/UXFeedback';
import { matchesRecord } from "../../components/RecordSearch"

import MaterialLocationFilters from '../../components/MaterialLocationFilters';
import { matchesLocation, locationQuantity, inventoryLocationLabel } from '../../locationMaster';
import { matchesInventoryColor } from '../../productFilters';
import React, { useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

import { MATERIAL_CATEGORIES, MATERIAL_GRADES, materialGradeFilterLabel, type MaterialCategoryTab } from '../../inventoryCategories';

export default function RawMaterials() {
  const { pellets, colorants, materialUsageTransactions } = useApp();

  const [category, setCategory] = useViewState<MaterialCategoryTab>("accounting/RawMaterials:category", 'Virgin Pellets');

  const [grade, setGrade] = useViewState("accounting/RawMaterials:grade", "All")
  const [location, setLocation] = useViewState("accounting/RawMaterials:location", 'All');
  const [color, setColor] = useViewState("accounting/RawMaterials:color", '');

  const [search, setSearch] = useViewState("accounting/RawMaterials:search", "")

  const [lifecycle, setLifecycle] = useViewState<'Available' | 'Open / WIP' | 'Fully Consumed'>("accounting/RawMaterials:lifecycle", 'Available');

  const [colorantType, setColorantType] = useState<'All' | 'Base Colorant' | 'Stripe Colorant'>('All');

  const [page, setPage] = useViewState("accounting/RawMaterials:page", 1)

  const pelletType = category === 'Virgin Pellets' ? 'Virgin' : 'Recycled';

  const filteredPellets = pellets.filter(
    (item) =>
      item.type === pelletType
    && (lifecycle === 'Available'
      ? ['Available', 'Pending Receipt'].includes(item.inventoryStatus)
      : lifecycle === 'Open / WIP'
        ? ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus)
        : item.inventoryStatus === 'Fully Consumed')
    && matchesLocation(item, location) && matchesInventoryColor(item.color, color)
    && (grade === 'All' || item.grade === grade) &&
      ([item.barcode, item.batchNo, item.grade].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(item, search)),
  )

  const filteredColorants = colorants.filter(
    (item) =>
      matchesLocation(item, location) && matchesInventoryColor(item.color, color) && (colorantType === 'All' || item.usageType === (colorantType === 'Base Colorant' ? 'BASE_COLORANT' : 'STRIPE_COLORANT')) &&
      ([item.colorantId, item.name, item.color].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(item, search)),
  )

  const used = (id: string) => materialUsageTransactions.filter(item => item.materialId === id).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="page-stack">
      <LastUpdated records={[...pellets, ...colorants]} />
      <div>
        <div className="section-title">Raw Materials</div>
        <div className="helper-text">Pellet physical bags and colorant kg balances are presented in distinct inventories.</div>
      </div>
      <CategoryTabs items={MATERIAL_CATEGORIES} value={category} onChange={next => { setCategory(next); setSearch(''); setPage(1); }} label="Raw material category" />
      <div className="app-card detail-card page-stack">
      {category !== 'Colorants' && <CategoryTabs items={['All', ...MATERIAL_GRADES] as const} value={grade} onChange={v => { setGrade(v); setPage(1); }} label={`${category} material grade`} displayLabel={materialGradeFilterLabel} groupLabel="Material Grade" />}
      {category !== 'Colorants' && <CategoryTabs items={['Available', 'Open / WIP', 'Fully Consumed'] as const} value={lifecycle} onChange={v => { setLifecycle(v); setPage(1); }} label="Pellet lifecycle destination" groupLabel="Status" />}
      {category === 'Colorants' && <CategoryTabs items={['All', 'Base Colorant', 'Stripe Colorant'] as const} value={colorantType} onChange={v => { setColorantType(v); setPage(1); }} label="Colorant usage type" />}
      <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={category === 'Colorants' ? 'Search color or colorant ID' : 'Search barcode, batch, or grade'} />
      <MaterialLocationFilters color={color} location={location} onColorChange={value => { setColor(value); setPage(1); }} onLocationChange={value => { setLocation(value); setPage(1); }} />
    </div>
      <div className="app-card table-scroll">
        {category === "Colorants" ? (
          <>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Colorant ID</th>
                  <th>Color</th>
                  <th>Usage Type</th>
                  <th>Available kg</th>
                  <th>Used kg</th>
                  <th>Status</th>
                  <th>Location</th><th>Last Updated</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filteredColorants, page).map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono">{item.colorantId}</td>
                    <td>
                      {item.color} ({item.colorCode})
                    </td>
                    <td>
                      {item.usageType === 'BASE_COLORANT' ? 'Base Colorant' : 'Stripe Colorant'}
                    </td>
                    <td className="font-mono">{locationQuantity(item, location).toFixed(3)}</td>
                    <td className="font-mono">{used(item.id).toFixed(3)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{inventoryLocationLabel(item)}</td><td>{item.lastUpdated}</td>
                  </tr>
                ))}
                {!filteredColorants.length && (
                  <tr>
                    <td colSpan={8} className="empty-state">No records match the selected search or filters.</td>
                  </tr>
                )}
              </TableBody>
            </table>
            <Pagination page={page} totalRecords={filteredColorants.length} onPageChange={setPage} />
          </>
        ) : (
          <>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Bag Barcode</th>
                  <th>Batch</th>
                  <th>Grade</th>
                  <th>Remaining Weight</th>
                  <th>Status</th>
                  <th>Current PO</th>
                  <th>Location</th>
                  <th>Received</th>
                  <th>Transfer</th>
                </tr>
              </thead>
              <TableBody>
                {pageRecords(filteredPellets, page).map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono"><RecordReference value={item.barcode} /></td>
                    <td className="font-mono"><RecordReference value={item.batchNo} /></td>
                    <td>{item.grade}</td>
                    <td className="font-mono">
                      {item.availableKg.toFixed(3)} kg
                    </td>
                    <td>
                      <StatusBadge status={item.inventoryStatus} />
                    </td>
                    <td className="font-mono">{item.loadedForPORef || "—"}</td>
                    <td>{item.currentLocation}</td>
                    <td>{item.receivedDate}</td>
                    <td className="font-mono">{item.transferRef || "—"}</td>
                  </tr>
                ))}
                {!filteredPellets.length && (
                  <tr>
                    <td colSpan={9} className="empty-state">No records match the selected search or filters.</td>
                  </tr>
                )}
              </TableBody>
            </table>
            <Pagination page={page} totalRecords={filteredPellets.length} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  )
}
