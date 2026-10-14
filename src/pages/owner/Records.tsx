import { withPrintSearch } from '../../printableRecords';
import { finishedPipeInventory } from '../../finishedGoodsInventory';
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';
import DocumentPrintButton from '../../components/DocumentPrintButton';
import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useMemo, useState } from "react"

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

import StatusBadge from "../../components/StatusBadge"

import { useApp } from "../../store"
import ReprintApprovals from '../../components/ReprintApprovals';

import { MATERIAL_GRADES } from "../../inventoryCategories"

import DocumentViewer, { type PrintableDocument } from '../../components/DocumentViewer';

import { matchesRecord, searchableText } from "../../components/RecordSearch"

import {
  customerOrderDocument,
  manufacturingOrderDocument,
  materialRequestDocument,
  productionOrderDocument,
  receivingReportDocument,
  recyclingDocument,
  transferDocument,
} from '../../documentPrint';

const AREAS = ['Company Records', 'Inventory & Finished Goods', 'Production & Recycling'] as const;

const SECTIONS = {
  'Company Records': ['All Documents', 'RR / Requests / Transfers', 'Orders', 'Inventory Transactions'],
  'Inventory & Finished Goods': ['All Inventory', 'Pellet Inventory', 'Colorants', 'Finished Pipes', 'Inventory Transactions'],
  'Production & Recycling': ['All Production', 'Production Orders', 'Rejected Material', 'Recycling Batches', 'Shift Turnover'],
} as const;

type Area = typeof AREAS[number]

type RecordRow = {
  id: string
  date: string
  reference: string
  module: string
  detail: string
  quantity: string
  status: string
  grade?: string
  location?: string
  searchText?: string
  specification?: unknown
}

export default function OwnerRecords() {
  const app = useApp()
  const [monitorReprints, setMonitorReprints] = useState(false);

  const period = usePeriod("month")

  const [area, setArea] = useState<Area>("Company Records")

  const [section, setSection] = useState<string>('All Documents');

  const [page, setPage] = useState(1)
  const productFilters = useProductFilters(() => setPage(1));
  const productArea = !['RR / Requests / Transfers', 'Pellet Inventory', 'Colorants', 'Inventory Transactions'].includes(section);

  const [status, setStatus] = useState("All Statuses")

  const [grade, setGrade] = useState("All Grades")

  const [location, setLocation] = useState("All Locations")

  const [search, setSearch] = useState("")

  const [documentAction, setDocumentAction] = useState<{ module: string; id: string; autoPrint: boolean } | null>(null);

  const sourceRows = useMemo<RecordRow[]>(() => {
    const orders: RecordRow[] = [
      ...app.rrRecords.map((item) => ({
        searchText: searchableText(item),
        id: item.id,
        date: item.date,
        reference: item.rrNumber,
        module: "Receiving Report",
        detail: `${item.material} · ${item.supplier}`,
        quantity: `${item.weightKg} kg`,
        status: item.status,
        grade: item.grade,
        location: item.destination,
      })),

      ...app.materialRequests.map((item) => ({
        searchText: searchableText(item),
        id: item.id,
        date: item.date,
        reference: item.refNo,
        module: "Material Request",
        detail: `${item.materialCategory || item.pelletType} · ${item.requestedBy}`,
        quantity: `${item.requestedKg} kg`,
        status: item.status,
        grade: item.grade,
      })),

      ...app.transfers.map((item) => ({
        searchText: searchableText(item),
        id: item.id,
        date: item.date,
        reference: item.refNo,
        module: "Transfer",
        detail: `${item.source} → ${item.destination}`,
        quantity: `${item.weightKg} kg`,
        status: item.status,
        grade: item.grade,
        location: item.destination,
      })),

      ...app.orders.map((item) => ({
        specification: item,
        searchText: searchableText(item),
        id: item.id,
        date: item.orderDate,
        reference: item.orderNo,
        module: "Customer Order",
        detail: `${item.customerName} · ${item.product} ${item.diameter}`,
        quantity: `${item.quantity} pcs`,
        status: item.status,
        grade: item.grade,
      })),

      ...app.manufacturingOrders.map((item) => ({
        specification: item,
        searchText: searchableText(item),
        id: item.id,
        date: item.createdDate,
        reference: item.moNo,
        module: "Manufacturing Order",
        detail: `${item.orderRef} · ${item.product} ${item.diameter}`,
        quantity: `${item.toManufactureQty} pcs`,
        status: item.status,
        grade: item.grade,
      })),
    ]

    const transactions = app.transactions.map((item) => ({
      searchText: searchableText(item),
      id: item.id,
      date: item.date,
      reference: item.txId,
      module: "Inventory Transaction",
      detail: `${item.item} · ${item.source} → ${item.destination}`,
      quantity: `${item.qtyChanged} ${item.materialCategory === 'Finished Pipe' ? 'pcs' : 'kg'}`,
      status: item.status,
      location: item.destination,
    }))

    const inventory: RecordRow[] = [
      ...app.pellets.map((item) => ({
        searchText: searchableText(item),
        id: item.id,
        date: item.receivedDate,
        reference: item.barcode,
        module: `${item.type} Pellet`,
        detail: `${item.batchNo} · ${item.color}`,
        quantity: `${item.availableKg} kg`,
        status: item.inventoryStatus,
        grade: item.grade,
        location: item.currentLocation,
      })),

      ...app.colorants.map((item) => ({
        searchText: searchableText(item),
        id: item.id,
        date: item.lastUpdated.slice(0, 10),
        reference: item.colorantId,
        module: "Colorant",
        detail: `${item.name} · ${item.usageType === 'BASE_COLORANT' ? 'Base' : 'Stripe'}`,
        quantity: `${item.availableKg} kg`,
        status: item.status,
        location: "Colorant Storage",
      })),

      ...app.finishedGoods.map((item) => ({
        specification: item,
        searchText: searchableText(item),
        id: item.id,
        date: item.productionDate,
        reference: item.barcode,
        module: "Finished Pipe",
        detail: `${item.product} ${item.diameter} · ${finishedPipeInventory(item, app).purpose || 'Source Not Resolved'}`,
        quantity: "1 pc",
        status: item.releaseStatus === 'Released' ? 'Shipped Out' : item.status,
        grade: item.grade,
        location: item.currentLocation,
      })),

      ...transactions,
    ]

    const production: RecordRow[] = [
      ...app.productionOrders.map((item) => ({
        specification: item,
        searchText: searchableText(item),
        id: item.id,
        date: item.requiredDate,
        reference: item.poNo,
        module: "Production Order",
        detail: `${item.product} ${item.diameter} · ${item.productionLine}`,
        quantity: `${item.completedQty} / ${item.targetQty} pcs`,
        status: item.status,
        grade: item.grade,
      })),

      ...app.rejectedMaterials.map((item) => ({
        specification: item,
        searchText: searchableText(item),
        id: item.id,
        date: item.date,
        reference: item.rejectionId,
        module: "Rejected Material",
        detail: `${item.product} · ${item.reason}`,
        quantity: `${item.quantity} pcs / ${item.weightKg} kg`,
        status: item.allocationStatus || "Pending",
      })),

      ...app.recyclingBatches.map((item) => ({
        specification: item,
        searchText: searchableText(item),
        id: item.id,
        date: item.date,
        reference: item.batchNo,
        module: "Recycling Batch",
        detail: `${item.sourcePO || 'No PO'} · ${item.product || 'Mixed material'}`,
        quantity: `${item.originalKg} kg input`,
        status: item.status,
      })),

      ...app.turnovers.map((item) => ({
        specification: item,
        searchText: searchableText(item),
        id: item.id,
        date: item.date,
        reference: item.turnoverNo,
        module: "Shift Turnover",
        detail: `${item.outgoingEmployee} · ${item.poRef}`,
        quantity: `${item.completedThisShift} pcs`,
        status: item.status,
      })),
    ]

    let rows = area === 'Company Records' ? [...orders, ...transactions] : area === 'Inventory & Finished Goods' ? inventory : production;

    if (section === 'RR / Requests / Transfers') rows = rows.filter(item => ['Receiving Report', 'Material Request', 'Transfer'].includes(item.module));

    if (section === 'Orders') rows = rows.filter(item => ['Customer Order', 'Manufacturing Order'].includes(item.module));

    if (section === 'Inventory Transactions') rows = rows.filter(item => item.module === 'Inventory Transaction');

    if (section === 'Pellet Inventory') rows = rows.filter(item => item.module.includes('Pellet'));

    if (section === 'Colorants') rows = rows.filter(item => item.module === 'Colorant');

    if (section === 'Finished Pipes') rows = rows.filter(item => item.module === 'Finished Pipe');

    if (section === 'Production Orders') rows = rows.filter(item => item.module === 'Production Order');

    if (section === 'Rejected Material') rows = rows.filter(item => item.module === 'Rejected Material');

    if (section === 'Recycling Batches') rows = rows.filter(item => item.module === 'Recycling Batch');

    if (section === 'Shift Turnover') rows = rows.filter(item => item.module === 'Shift Turnover');

    return rows
  }, [app, area, section])

  const rows = sourceRows
    .filter(
      (item) =>
        dateInPeriod(item.date, period.range)
    && (!productArea || !Object.values(productFilters.value).some(Boolean) || (!!item.specification && productFilters.matches(item.specification)))
    && (status === 'All Statuses' || item.status === status)
    && (grade === 'All Grades' || item.grade === grade)
    && (location === 'All Locations' || item.location === location) &&
        matchesRecord(withPrintSearch(app, item), search),
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  const statuses = Array.from(new Set(sourceRows.map(item => item.status))).sort();

  const grades = MATERIAL_GRADES

  const locations = Array.from(new Set(sourceRows.map(item => item.location).filter(Boolean))).sort() as string[];

  const inventoryArea = area === "Inventory & Finished Goods"

  const selectedDocument = useMemo<PrintableDocument | null>(() => {
    if (!documentAction) return null;
    const { module, id } = documentAction;
    if (module === 'Receiving Report') {
      const item = app.rrRecords.find(record => record.id === id);
      return item ? receivingReportDocument(item) : null;
    }
    if (module === 'Material Request') {
      const item = app.materialRequests.find(record => record.id === id);
      return item ? materialRequestDocument(item) : null;
    }
    if (module === 'Transfer') {
      const item = app.transfers.find(record => record.id === id);
      return item ? transferDocument(item) : null;
    }
    if (module === 'Customer Order') {
      const item = app.orders.find(record => record.id === id);
      return item ? customerOrderDocument(item) : null;
    }
    if (module === 'Manufacturing Order') {
      const item = app.manufacturingOrders.find(record => record.id === id);
      const order = item ? app.orders.find(record => record.orderNo === item.orderRef) : undefined;
      return item ? manufacturingOrderDocument(item, order?.customerName) : null;
    }
    if (module === 'Production Order') {
      const item = app.productionOrders.find(record => record.id === id);
      return item ? productionOrderDocument(item) : null;
    }
    if (module === 'Recycling Batch') {
      const item = app.recyclingBatches.find(record => record.id === id);
      return item ? recyclingDocument(item) : null;
    }
    return null;
  }, [app, documentAction]);

  const printableModules = ['Receiving Report', 'Material Request', 'Transfer', 'Customer Order', 'Manufacturing Order', 'Production Order', 'Recycling Batch'];

  const resetFilters = () => {
    setPage(1);
    setStatus('All Statuses');
    setGrade('All Grades');
    setLocation('All Locations');
  };

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Detailed operational records</span>
          <h2>Operations &amp; Records</h2>
          <p>Search individual documents, physical inventory, production activity, and recycling history without duplicating dashboard summaries.</p>
        </div>
        <span className="badge-blue">Read-only owner view</span>
      </div>
      <div className="button-group"><button className="btn-secondary" onClick={() => setMonitorReprints(value => !value)}>{monitorReprints ? 'Hide Reprint History' : 'Reprint Requests & History'}</button></div>
      {monitorReprints && <ReprintApprovals monitor search={search} />}
      <CategoryTabs items={AREAS} value={area} onChange={value => { setArea(value); setSection(SECTIONS[value][0]); resetFilters(); }} label="Operations record area" />
      <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => setPage(1)} placeholder="Search reference, PO, MO, barcode, product, employee..." filters={productArea ? <ProductFilters value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade /> : undefined} />
      <CategoryTabs items={SECTIONS[area]} value={section as never} onChange={value => { setSection(value); resetFilters(); }} label={`${area} record type`} />
      <div className="filter-panel">
        <div className="filter-row">
          <SearchableDropdown
            className="app-select" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}
          >
            <option>All Statuses</option>
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SearchableDropdown>
          {inventoryArea && !productArea && (
            <SearchableDropdown
              className="app-select" value={grade} onChange={event => { setGrade(event.target.value); setPage(1); }}
            >
              <option value="All Grades">All Material Grades</option>
              {grades.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SearchableDropdown>
          )}
          {inventoryArea && (
            <SearchableDropdown
              className="app-select" value={location} onChange={event => { setLocation(event.target.value); setPage(1); }}
            >
              <option>All Locations</option>
              {locations.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </SearchableDropdown>
          )}
        </div>
      </div>
      <div className="app-card table-scroll">
        <div className="table-title">
          {section} · {period.range.label}
        </div>
        <table className="app-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Record Type</th>
              <th>Details</th>
              <th>Quantity / Activity</th>
              <th>Status</th>
              <th data-actions>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords(rows, page).map((item) => (
              <tr key={`${item.module}-${item.id}`}>
                <td>{item.date}</td>
                <td className="font-mono">{item.reference}</td>
                <td>{item.module}</td>
                <td>{item.detail}</td>
                <td>{item.quantity}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>
                  {printableModules.includes(item.module) && (
                    <div className="button-group">
                      <button className="btn-secondary btn-compact" onClick={() => setDocumentAction({ module: item.module, id: item.id, autoPrint: false })}>View Document</button>
                      <DocumentPrintButton className="btn-secondary btn-compact" recordId={item.id} recordType={item.module === 'Recycling Batch' ? 'RECYCLING RECORD' : item.module === 'Transfer' ? 'MATERIAL TRANSFER' : item.module.toUpperCase()} onClick={() => setDocumentAction({ module: item.module, id: item.id, autoPrint: true })} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty-state">No authorized records match the selected date and filters.</div>}
        <Pagination page={page} totalRecords={rows.length} onPageChange={setPage} />
      </div>
      <DocumentViewer open={!!documentAction} document={selectedDocument} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
    </div>
  )
}
