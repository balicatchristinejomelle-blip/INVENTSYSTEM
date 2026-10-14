import { withPrintSearch } from '../../printableRecords';
import MaterialLocationFilters from '../../components/MaterialLocationFilters';
import LegacyBarcodeNotice from '../../components/LegacyBarcodeNotice';
import { matchesLocation, inventoryLocationLabel, locationQuantity } from '../../locationMaster';
import { matchesInventoryColor } from '../../productFilters';
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';
import DocumentPrintButton from '../../components/DocumentPrintButton';
import { finishedPipeInventory } from '../../finishedGoodsInventory';
import React, { useEffect, useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import CategoryTabs from "../../components/CategoryTabs"

import { MATERIAL_CATEGORIES, MATERIAL_GRADES, materialGradeFilterLabel, normalizedProductType, type MaterialCategoryTab, type PipeProductType } from '../../inventoryCategories';

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

import Pagination, { pageRecords } from '../../components/Pagination';

import DocumentViewer from "../../components/DocumentViewer"

import { productionOrderDocument } from '../../documentPrint';

import { matchesRecord } from "../../components/RecordSearch"
import ReprintApprovals from '../../components/ReprintApprovals';

type ProductionView = 'Active / Ready' | 'In Progress' | 'Pending Turnover' | 'Completed';

type PelletView = 'All' | 'Available' | 'Open / WIP' | 'Fully Consumed';

export default function Operations() {
  const app = useApp();
  const { productionOrders, pellets, colorants, materialUsageTransactions, finishedGoods, attendance } = app;

  const [tab, setTab] = useState<'inventory' | 'production' | 'orders' | 'attendance' | 'reprints'>('inventory');

  const [materialCategory, setMaterialCategory] = useState<MaterialCategoryTab>('Virgin Pellets');

  const [productType, setProductType] = useState<'All' | PipeProductType>('All');

  const [grade, setGrade] = useState("All")

  const [pelletView, setPelletView] = useState<PelletView>('All');

  const [productionView, setProductionView] = useState<ProductionView>('Active / Ready');

  const [search, setSearch] = useState("")
  const [materialLocation, setMaterialLocation] = useState('All');
  const [materialColor, setMaterialColor] = useState('');

  const [page, setPage] = useState(1)
  const productFilters = useProductFilters(() => setPage(1));

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  const period = usePeriod("month")

  const query = search.trim().toLowerCase()

  const selectedPellets = pellets.filter(
    (item) =>
      dateInPeriod(item.receivedDate, period.range) &&
      matchesLocation(item, materialLocation) && matchesInventoryColor(item.color, materialColor) &&
      matchesRecord(item, query) &&
      item.type === (materialCategory === 'Virgin Pellets' ? 'Virgin' : 'Recycled') &&
      (grade === "All" || item.grade === grade) &&
      (pelletView === 'All'
      || (pelletView === 'Available' && ['Available', 'Pending Receipt'].includes(item.inventoryStatus))
      || (pelletView === 'Open / WIP' && ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus))
      || (pelletView === 'Fully Consumed' && item.inventoryStatus === 'Fully Consumed')),
  )

  const selectedProductionOrders = productionOrders.filter(
    (po) =>
      dateInPeriod(po.requiredDate, period.range) &&
      productFilters.matches(po) &&
      matchesRecord(withPrintSearch(app, po), query) &&
      (productionView === 'Active / Ready'
      ? ['Scheduled', 'Ready'].includes(po.status)
      : productionView === 'In Progress'
        ? ['In Production', 'Partially Completed'].includes(po.status)
        : productionView === 'Pending Turnover'
          ? po.status === 'Awaiting Shift Turnover'
          : po.status === 'Completed'),
  )

  const documentPO = productionOrders.find(po => po.id === documentAction?.id);


  const selectedFinishedGoods = finishedGoods.filter(
    (item) =>
      dateInPeriod(item.productionDate, period.range) &&
      productFilters.matches(item, { product: '' }) &&
      matchesRecord(withPrintSearch(app, item), query) &&
      (productType === 'All' || normalizedProductType(item.product) === productType),
  )

  const selectedAttendance = attendance.filter(
    (item) =>
      dateInPeriod(item.date, period.range) && matchesRecord(item, query),
  )

  const selectedColorants = colorants.filter(
    (item) =>
      dateInPeriod(item.lastUpdated, period.range) &&
      matchesLocation(item, materialLocation) && matchesInventoryColor(item.color, materialColor) &&
      matchesRecord(item, query),
  )

  const consumedKg = (type: 'VIRGIN_PELLET' | 'RECYCLED_PELLET' | 'COLORANT') => materialUsageTransactions.filter(item => item.materialType === type && dateInPeriod(item.dateTime, period.range)).reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => setPage(1), [tab, materialCategory, productType, grade, pelletView, productionView, search, period.range.start, period.range.end]);

  return (
    <div>
      <div className="page-stack">
        <PeriodSelector period={period} search={search} onSearchChange={setSearch} onDateChange={() => setPage(1)} placeholder="Search authorized records..." filters={(tab === 'production' || tab === 'orders') ? <ProductFilters value={productFilters.value} onChange={productFilters.change} product={tab === 'orders' ? productType : ''} onProductChange={tab === 'orders' ? value => { setProductType(value as 'All' | PipeProductType); setPage(1); } : undefined} includeProduct={tab === 'production'} includeGrade includeColor includeLocation /> : undefined} />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {[['inventory', 'Inventory'], ['production', 'Production'], ['orders', 'Orders'], ['attendance', 'Attendance'], ['reprints', 'Reprint Approvals']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{
            padding: '6px 14px', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: tab === k ? 600 : 400,
            border: `1px solid ${tab === k ? 'var(--accent-blue)' : 'var(--card-border)'}`,
            background: tab === k ? 'var(--accent-blue)' : 'transparent', color: tab === k ? '#fff' : 'var(--text-secondary)',
          }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'reprints' && <ReprintApprovals search={search} />}
      {tab === 'orders' && <LegacyBarcodeNotice query={search} pipes={finishedGoods} />}

      {tab === "inventory" && (
        <div className="page-stack">
          <div className="kpi-grid">
            <div className="app-card kpi-card">
              <div>Virgin Pellets</div>
              <strong>
                {pellets.filter(item => item.type === 'Virgin').reduce((sum, item) => sum + item.availableKg, 0).toFixed(1)}{" "}
                kg
              </strong>
              <small>
                {consumedKg("VIRGIN_PELLET").toFixed(1)} kg consumed
              </small>
            </div>
            <div className="app-card kpi-card">
              <div>Recycled Pellets</div>
              <strong>
                {pellets.filter(item => item.type === 'Recycled').reduce((sum, item) => sum + item.availableKg, 0).toFixed(1)}{" "}
                kg
              </strong>
              <small>
                {consumedKg("RECYCLED_PELLET").toFixed(1)} kg consumed
              </small>
            </div>
            <div className="app-card kpi-card">
              <div>Colorants</div>
              <strong>
                {colorants.reduce((sum, item) => sum + item.availableKg, 0).toFixed(1)}{" "}
                kg
              </strong>
              <small>{consumedKg('COLORANT').toFixed(1)} kg consumed</small>
            </div>
            <div className="app-card kpi-card">
              <div>Production Consumption</div>
              <strong>
                {materialUsageTransactions.reduce((sum, item) => sum + item.quantity, 0).toFixed(1)}{" "}
                kg
              </strong>
              <small>pellets + colorants</small>
            </div>
          </div>
          <CategoryTabs items={MATERIAL_CATEGORIES} value={materialCategory} onChange={setMaterialCategory} label="Management material category" />
          <MaterialLocationFilters color={materialColor} location={materialLocation} onColorChange={value => { setMaterialColor(value); setPage(1); }} onLocationChange={value => { setMaterialLocation(value); setPage(1); }} />
          {materialCategory !== 'Colorants' && <CategoryTabs items={['All', ...MATERIAL_GRADES] as const} value={grade} onChange={setGrade} label={`${materialCategory} material grade`} displayLabel={materialGradeFilterLabel} />}
          {materialCategory !== 'Colorants' && <CategoryTabs items={['All', 'Available', 'Open / WIP', 'Fully Consumed'] as const} value={pelletView} onChange={setPelletView} label="Pellet lifecycle" />}
          <div className="app-card" style={{ overflow: "hidden" }}>
            {materialCategory === "Colorants" ? (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Colorant ID</th>
                    <th>Color</th>
                    <th>Usage Type</th>
                    <th>Available kg</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords(selectedColorants, page).map((item) => (
                    <tr key={item.id}>
                      <td className="font-mono">{item.colorantId}</td>
                      <td>{item.color}</td>
                      <td>
                        {item.usageType === 'BASE_COLORANT' ? 'Base Colorant' : 'Stripe Colorant'}
                      </td>
                      <td className="font-mono">
                        {locationQuantity(item, materialLocation).toFixed(3)}
                      </td>
                      <td>{inventoryLocationLabel(item)}</td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Batch</th>
                    <th>Grade</th>
                    <th>Color</th>
                    <th>Available kg</th>
                    <th>Received Date</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords(selectedPellets, page).map((p, i) => (
                    <tr key={i} className="table-row-hover">
                      <td>
                        <span className={`${p.type === 'Virgin' ? 'badge-blue' : 'badge-purple'} px-2 py-0.5 text-[11px] rounded font-medium`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontSize: 11 }}>
                        {p.batchNo}
                      </td>
                      <td style={{ fontSize: 12 }}>{p.grade}</td>
                      <td style={{ fontSize: 12 }}>{p.color}</td>
                      <td className="font-mono" style={{ fontWeight: 700, color: p.availableKg < 200 ? '#dc2626' : 'var(--text-primary)' }}>
                        {p.availableKg.toFixed(1)} kg
                      </td>
                      <td style={{ fontSize: 12 }}>{p.receivedDate}</td>
                      <td>{inventoryLocationLabel(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {materialCategory !== "Colorants" && !selectedPellets.length && (
              <div className="empty-state">
                {materialCategory === 'Virgin Pellets' && grade === 'PE100' ? 'NO PE100 VIRGIN PELLETS' : `NO ${materialCategory.toUpperCase()} MATCH THE SELECTED FILTERS`}
              </div>
            )}
            <Pagination page={page} totalRecords={materialCategory === 'Colorants' ? selectedColorants.length : selectedPellets.length} onPageChange={setPage} />
          </div>
        </div>
      )}

      {tab === "production" && (
        <div className="page-stack">
          <CategoryTabs items={['Active / Ready', 'In Progress', 'Pending Turnover', 'Completed'] as const} value={productionView} onChange={setProductionView} label="Production lifecycle" />
          <div className="app-card" style={{ overflow: "hidden" }}>
            <table className="app-table">
              <thead>
                <tr>
                  <th>PO No.</th>
                  <th>Product</th>
                  <th>Target</th>
                  <th>Completed</th>
                  <th>Progress</th>
                  <th>Line</th>
                  <th>Status</th>
                  <th data-actions>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(selectedProductionOrders, page).map((po) => {
                  const pct = po.targetQty > 0 ? Math.round(po.completedQty / po.targetQty * 100) : 0;

                  return (
                    <tr key={po.id} className="table-row-hover">
                      <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                        {po.poNo}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {po.product} {po.diameter}
                      </td>
                      <td className="font-mono">{po.targetQty}</td>
                      <td className="font-mono" style={{ color: '#16a34a', fontWeight: 600 }}>
                        {po.completedQty}
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%`, background: '#2563eb' }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {pct}%
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{po.productionLine}</td>
                      <td>
                        <StatusBadge status={po.status} size="sm" />
                      </td>
                      <td>
                        <div className="button-group">
                          <button className="btn-secondary btn-compact" onClick={() => setDocumentAction({ id: po.id, autoPrint: false })}>View Document</button>
                          <DocumentPrintButton className="btn-secondary btn-compact" recordId={po.id} recordType="PRODUCTION ORDER" onClick={() => setDocumentAction({ id: po.id, autoPrint: true })} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!selectedProductionOrders.length && (
              <div className="empty-state">
                {productionView === 'Completed' ? 'NO COMPLETED PRODUCTION ORDERS' : `NO ${productionView.toUpperCase()} PRODUCTION ORDERS`}
              </div>
            )}
            <Pagination page={page} totalRecords={selectedProductionOrders.length} onPageChange={setPage} />
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div className="page-stack">
          <div className="app-card" style={{ overflow: "hidden" }}>
            <table className="app-table">
              <thead>
                <tr>
                  <th>FG ID</th>
                  <th>Product</th>
                  <th>Size</th>
                  <th>Available</th>
                  <th>Reserved</th>
                  <th>Storage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(selectedFinishedGoods, page).map((fg) => (
                  <tr key={fg.id} className="table-row-hover">
                    <td className="font-mono" style={{ fontSize: 11, color: '#16a34a' }}>
                      {fg.fgId}
                    </td>
                    <td style={{ fontSize: 12 }}>{fg.product}</td>
                    <td style={{ fontSize: 12 }}>
                      {fg.diameter} × {fg.length}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700, color: '#16a34a' }}>
                      {finishedPipeInventory(fg).available}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 600, color: '#d97706' }}>
                      {finishedPipeInventory(fg).reserved}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {fg.currentLocation || "Not Yet Assigned"}
                    </td>
                    <td>
                      <StatusBadge status={fg.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalRecords={selectedFinishedGoods.length} onPageChange={setPage} />
          </div>
        </div>
      )}

      {tab === "attendance" && (
        <div className="app-card" style={{ overflow: "hidden" }}>
          <table className="app-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>ID</th>
                <th>Shift</th>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords(selectedAttendance, page).map((a) => (
                <tr key={a.id} className="table-row-hover">
                  <td style={{ fontSize: 13, fontWeight: 500 }}>
                    {a.employeeName}
                  </td>
                  <td className="font-mono" style={{ fontSize: 11 }}>
                    {a.employeeId}
                  </td>
                  <td>
                    <span className={`badge-${a.shift === 'Day' ? 'blue' : 'gray'} px-2 py-0.5 text-[11px] rounded font-medium`}>
                      {a.shift}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{a.date}</td>
                  <td className="font-mono" style={{ fontSize: 12 }}>
                    {a.clockIn}
                  </td>
                  <td className="font-mono" style={{ fontSize: 12 }}>
                    {a.clockOut || "—"}
                  </td>
                  <td>
                    <StatusBadge status={a.status === 'Active' ? 'Active' : 'Completed'} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} totalRecords={selectedAttendance.length} onPageChange={setPage} />
        </div>
      )}
      <DocumentViewer open={!!documentAction} document={documentPO ? productionOrderDocument(documentPO) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
    </div>
  )
}
