import React, { useMemo, useState } from 'react';
import { calculateRecyclingMetrics, useApp } from '../../store';
import CategoryTabs from '../../components/CategoryTabs';
import Pagination, { pageRecords } from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';
import {
  MATERIAL_CATEGORIES,
  MATERIAL_GRADES,
  PIPE_PRODUCT_TYPES,
  normalizedProductType,
  type MaterialCategoryTab,
  type PipeProductType,
} from '../../inventoryCategories';

const REPORTS = ['Material Inventory', 'Finished Goods', 'Production', 'Material Usage', 'Recycling'] as const;
type Report = typeof REPORTS[number];
type Lifecycle = 'All' | 'Available' | 'Open / WIP' | 'Fully Consumed';
type FinishedStatus = 'All Statuses' | 'Awaiting Label / Storage' | 'Available' | 'Reserved' | 'Ready for Ship Out' | 'Released / Shipped Out';

const lifecycleForPellet = (status: string): Exclude<Lifecycle, 'All'> => {
  if (status === 'Fully Consumed') return 'Fully Consumed';
  if (status === 'Loaded' || status === 'Partially Consumed') return 'Open / WIP';
  return 'Available';
};

export default function PlantManagerReports() {
  const {
    productionOrders,
    pellets,
    colorants,
    finishedGoods,
    materialUsageTransactions,
    rejectedMaterials,
    recyclingBatches,
    turnovers,
    attendance,
    transactions,
  } = useApp();
  const period = usePeriod('month');
  const [report, setReport] = useState<Report>('Material Inventory');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [materialCategory, setMaterialCategory] = useState<MaterialCategoryTab>('Virgin Pellets');
  const [grade, setGrade] = useState('All');
  const [lifecycle, setLifecycle] = useState<Lifecycle>('All');
  const [recycledForm, setRecycledForm] = useState<'All' | 'Complete 25 kg Bags' | 'Loose Recycled Pellet'>('All');
  const [productType, setProductType] = useState<'All' | PipeProductType>('All');
  const [finishedGrade, setFinishedGrade] = useState('All');
  const [finishedSize, setFinishedSize] = useState('All');
  const [finishedStatus, setFinishedStatus] = useState<FinishedStatus>('All Statuses');
  const [finishedLocation, setFinishedLocation] = useState('All');
  const resetPage = () => setPage(1);

  const periodUsage = materialUsageTransactions.filter(item => dateInPeriod(item.dateTime, period.range));
  const periodOutput = transactions.filter(item => item.transactionType === 'Production Output' && dateInPeriod(item.date, period.range));
  const activePeriodPOs = new Set(periodOutput.map(item => item.reference));
  const periodProductionOrders = productionOrders.filter(item => activePeriodPOs.has(item.poNo));
  const target = periodProductionOrders.reduce((sum, item) => sum + item.targetQty, 0);
  const actual = periodOutput.reduce((sum, item) => sum + Math.abs(item.qtyChanged), 0);
  const pelletUsed = periodUsage.filter(item => item.materialType !== 'COLORANT').reduce((sum, item) => sum + item.quantity, 0);
  const colorantUsed = periodUsage.filter(item => item.materialType === 'COLORANT').reduce((sum, item) => sum + item.quantity, 0);
  const virgin = pellets.filter(item => item.type === 'Virgin' && item.inventoryStatus === 'Available').reduce((sum, item) => sum + item.availableKg, 0);
  const recycled = pellets.filter(item => item.type === 'Recycled' && item.inventoryStatus === 'Available').reduce((sum, item) => sum + item.availableKg, 0);
  const periodRejected = rejectedMaterials.filter(item => dateInPeriod(item.date, period.range));
  const periodRecycling = recyclingBatches.filter(item => dateInPeriod(item.date, period.range));
  const rejected = periodRejected.reduce((sum, item) => sum + item.weightKg, 0);
  const recovered = periodRecycling.reduce((sum, item) => sum + (item.recoveredKg || 0), 0);
  const pendingTurnovers = turnovers.filter(item => item.status === 'Pending').length;
  const presentEmployees = attendance.filter(item => item.status === 'Active').length;

  const materialRecords = useMemo(() => {
    if (materialCategory === 'Colorants') {
      return colorants.map(item => ({
        id: item.id,
        reference: item.colorantId,
        category: item.usageType === 'BASE_COLORANT' ? 'Base Colorant' : 'Stripe Colorant',
        grade: '—',
        status: item.status,
        location: 'Not Tracked',
        balance: `${item.availableKg.toFixed(3)} kg`,
        searchable: `${item.colorantId} ${item.name} ${item.color} ${item.status}`,
      }));
    }

    const type = materialCategory === 'Virgin Pellets' ? 'Virgin' : 'Recycled';
    const bags = pellets.filter(item => item.type === type).map(item => ({
      id: item.id,
      reference: `${item.batchNo} · ${item.bagNo}`,
      category: `${item.type} · Complete 25 kg Bag`,
      grade: item.grade || '—',
      status: lifecycleForPellet(item.inventoryStatus),
      location: item.currentLocation || 'Not Yet Assigned',
      balance: `${item.availableKg.toFixed(3)} kg`,
      searchable: `${item.barcode} ${item.batchNo} ${item.bagNo} ${item.grade} ${item.currentLocation}`,
    }));
    const loose = type === 'Recycled' ? recyclingBatches.filter(item => (item.looseKg || 0) > 0).map(item => ({
      id: `loose-${item.id}`,
      reference: item.batchNo,
      category: 'Recycled · Loose Recycled Pellet',
      grade: '—',
      status: item.status === 'Completed' ? 'Available' : 'Open / WIP',
      location: item.status === 'Completed' ? 'Recycling Output' : 'Recycling Area',
      balance: `${(item.looseKg || 0).toFixed(3)} kg`,
      searchable: `${item.batchNo} ${item.status} ${item.sourcePO || ''}`,
    })) : [];
    return [...bags, ...loose];
  }, [colorants, materialCategory, pellets, recyclingBatches]);

  const filteredMaterials = materialRecords.filter(item =>
    (materialCategory === 'Colorants' || grade === 'All' || item.grade === grade)
    && (materialCategory !== 'Recycled Pellets' || recycledForm === 'All'
      || (recycledForm === 'Complete 25 kg Bags' ? item.category.includes('Complete') : item.category.includes('Loose')))
    && (materialCategory === 'Colorants' || lifecycle === 'All' || item.status === lifecycle)
    && item.searchable.toLowerCase().includes(search.toLowerCase())
  );

  const finishedProductEligible = useMemo(() => finishedGoods.filter(item =>
    productType === 'All' || normalizedProductType(item.product) === productType
  ), [finishedGoods, productType]);
  const finishedGradeOptions = MATERIAL_GRADES;
  const finishedSizeOptions = Array.from(new Set(finishedProductEligible.map(item => item.diameter))).sort();
  const finishedLocationOptions = Array.from(new Set(finishedProductEligible.map(item => item.currentLocation))).filter(Boolean).sort();
  const filteredFinished = finishedProductEligible.filter(item => {
    const statusMatches =
      finishedStatus === 'All Statuses'
      || (finishedStatus === 'Awaiting Label / Storage' && item.locationStatus === 'Awaiting Storage')
      || (finishedStatus === 'Available' && item.status === 'Available' && item.releaseStatus !== 'Released')
      || (finishedStatus === 'Reserved' && item.status === 'Reserved')
      || (finishedStatus === 'Ready for Ship Out' && item.status === 'Ready for Release')
      || (finishedStatus === 'Released / Shipped Out' && item.releaseStatus === 'Released');
    return statusMatches
      && (finishedGrade === 'All' || item.grade === finishedGrade)
      && (finishedSize === 'All' || item.diameter === finishedSize)
      && (finishedLocation === 'All' || item.currentLocation === finishedLocation)
      && [item.barcode, item.fgId, item.product, item.grade, item.diameter, item.sdr, item.poRef, item.reservedForOrderRef || '']
        .some(value => value.toLowerCase().includes(search.toLowerCase()));
  });
  const filteredProduction = periodProductionOrders.filter(item =>
    (productType === 'All' || normalizedProductType(item.product) === productType)
    && [item.poNo, item.moRef, item.product, item.grade, item.diameter, item.productionLine, item.status]
      .some(value => value.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredUsage = periodUsage.filter(item =>
    [item.transactionId, item.productionOrderRef, item.materialType, item.materialName, item.employeeName]
      .some(value => value.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredRecycling = periodRecycling.filter(item =>
    [item.batchNo, item.status, item.sourcePO || '', item.product || '']
      .some(value => value.toLowerCase().includes(search.toLowerCase()))
  );

  const recyclingMetrics = periodRecycling
    .filter(item => item.recoveredKg != null)
    .map(item => calculateRecyclingMetrics(item.originalKg, item.cutMaterialKg ?? item.originalKg, item.recoveredKg!));
  const totalRecyclingLoss = recyclingMetrics.reduce((sum, item) => sum + item.totalRecyclingLossKg, 0);

  const changeReport = (next: Report) => {
    setReport(next);
    setSearch('');
    resetPage();
  };

  return (
    <div className="page-stack">
      <PeriodSelector period={period} />
      <CategoryTabs items={REPORTS} value={report} onChange={changeReport} label="Report type" />

      {report === 'Material Inventory' && <>
        <div className="kpi-grid">
          {[['Current Virgin Pellet', `${virgin.toFixed(1)} kg`], ['Current Recycled Pellet', `${recycled.toFixed(1)} kg`], ['Current Open WIP', `${pellets.filter(item => ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus)).reduce((sum, item) => sum + item.availableKg, 0).toFixed(1)} kg`], ['Current Fully Consumed Bags', pellets.filter(item => item.inventoryStatus === 'Fully Consumed').length]].map(([label, value]) => <div className="app-card kpi-card" key={label}><div>{label}</div><strong>{value}</strong></div>)}
        </div>
        <CategoryTabs items={MATERIAL_CATEGORIES} value={materialCategory} onChange={value => { setMaterialCategory(value); setGrade('All'); setLifecycle('All'); setRecycledForm('All'); resetPage(); }} label="Material report category" />
        <div className="app-card detail-card page-stack">
          {materialCategory !== 'Colorants' && <CategoryTabs items={['All', ...MATERIAL_GRADES] as const} value={grade} onChange={value => { setGrade(value); resetPage(); }} label={`${materialCategory} grade`} />}
          {materialCategory === 'Recycled Pellets' && <CategoryTabs items={['All', 'Complete 25 kg Bags', 'Loose Recycled Pellet'] as const} value={recycledForm} onChange={value => { setRecycledForm(value); resetPage(); }} label="Recycled pellet form" />}
          {materialCategory !== 'Colorants' && <CategoryTabs items={['All', 'Available', 'Open / WIP', 'Fully Consumed'] as const} value={lifecycle} onChange={value => { setLifecycle(value); resetPage(); }} label="Material lifecycle" />}
          <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} placeholder="Search barcode, bag, batch, grade, location, or colorant" />
        </div>
        <div className="app-card table-scroll">
          <div className="table-title">{materialCategory} Detail</div>
          <table className="app-table"><thead><tr><th>Reference</th><th>Category / Form</th><th>Material Grade</th><th>Lifecycle</th><th>Location</th><th>Available</th></tr></thead>
            <tbody>{pageRecords(filteredMaterials, page).map(item => <tr key={item.id}><td className="font-mono">{item.reference}</td><td>{item.category}</td><td>{item.grade}</td><td><StatusBadge status={item.status} /></td><td>{item.location}</td><td className="font-mono">{item.balance}</td></tr>)}</tbody>
          </table>
          <Pagination page={page} totalRecords={filteredMaterials.length} onPageChange={setPage} />
        </div>
      </>}

      {report === 'Finished Goods' && <>
        <div className="kpi-grid">
          {[['Matching Pipes', filteredFinished.length], ['Available', filteredFinished.filter(item => item.status === 'Available').length], ['Reserved', filteredFinished.filter(item => item.status === 'Reserved').length], ['Ready for Ship Out', filteredFinished.filter(item => item.status === 'Ready for Release').length]].map(([label, value]) => <div className="app-card kpi-card" key={label}><div>{label}</div><strong>{value}</strong></div>)}
        </div>
        <div className="filter-panel">
          <div className="filter-row">
            <select className="app-select" value={productType} onChange={event => { setProductType(event.target.value as 'All' | PipeProductType); setFinishedGrade('All'); setFinishedSize('All'); resetPage(); }}><option value="All">All Product Types</option>{PIPE_PRODUCT_TYPES.map(item => <option key={item}>{item}</option>)}</select>
            <select className="app-select" value={finishedGrade} onChange={event => { setFinishedGrade(event.target.value); resetPage(); }}><option value="All">All Material Grades</option>{finishedGradeOptions.map(item => <option key={item}>{item}</option>)}</select>
            <select className="app-select" value={finishedSize} onChange={event => { setFinishedSize(event.target.value); resetPage(); }}><option value="All">All Sizes / Diameters</option>{finishedSizeOptions.map(item => <option key={item}>{item}</option>)}</select>
          </div>
          <div className="filter-row">
            <select className="app-select" value={finishedStatus} onChange={event => { setFinishedStatus(event.target.value as FinishedStatus); resetPage(); }}>{(['All Statuses', 'Awaiting Label / Storage', 'Available', 'Reserved', 'Ready for Ship Out', 'Released / Shipped Out'] as const).map(item => <option key={item}>{item}</option>)}</select>
            <select className="app-select" value={finishedLocation} onChange={event => { setFinishedLocation(event.target.value); resetPage(); }}><option value="All">All Locations</option>{finishedLocationOptions.map(item => <option key={item}>{item}</option>)}</select>
          </div>
          <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} placeholder="Search barcode, product, grade, size, PO, or customer order" />
        </div>
        <div className="app-card table-scroll">
          <div className="table-title">Finished Goods / Pipe Inventory</div>
          <table className="app-table"><thead><tr><th>Barcode</th><th>Product Type</th><th>Grade</th><th>Size / SDR / Length</th><th>Status</th><th>Location</th><th>PO</th><th>Customer Order</th></tr></thead>
            <tbody>{pageRecords(filteredFinished, page).map(item => <tr key={item.id}><td className="font-mono">{item.barcode}</td><td>{normalizedProductType(item.product)}</td><td>{item.grade}</td><td>{item.diameter} · {item.sdr} · {item.length}</td><td><StatusBadge status={item.releaseStatus === 'Released' ? 'Released' : item.status} /></td><td>{item.currentLocation}</td><td className="font-mono">{item.poRef}</td><td className="font-mono">{item.reservedForOrderRef || '—'}</td></tr>)}</tbody>
          </table>
          <Pagination page={page} totalRecords={filteredFinished.length} onPageChange={setPage} />
        </div>
      </>}

      {report === 'Production' && <>
        <div className="kpi-grid">{[['Total Production', actual], ['Production Target', target], ['Completion', `${target ? (actual / target * 100).toFixed(1) : 0}%`], ['Active Orders', productionOrders.filter(item => item.status === 'In Production').length]].map(([label, value]) => <div className="app-card kpi-card" key={label}><div>{label}</div><strong>{value}</strong></div>)}</div>
        <div className="toolbar">
          <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} placeholder="Search production order, product, grade, line, or status" />
          <select className="app-select" value={productType} onChange={event => { setProductType(event.target.value as 'All' | PipeProductType); resetPage(); }}><option value="All">All Product Types</option>{PIPE_PRODUCT_TYPES.map(item => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="app-card table-scroll"><div className="table-title">Production Order Detail</div><table className="app-table"><thead><tr><th>Production Order</th><th>MO</th><th>Product Type</th><th>Grade / Size</th><th>Line</th><th>Completed / Target</th><th>Status</th></tr></thead><tbody>{pageRecords(filteredProduction, page).map(item => <tr key={item.id}><td className="font-mono">{item.poNo}</td><td className="font-mono">{item.moRef}</td><td>{normalizedProductType(item.product)}</td><td>{item.grade} · {item.diameter}</td><td>{item.productionLine}</td><td>{item.completedQty} / {item.targetQty}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table><Pagination page={page} totalRecords={filteredProduction.length} onPageChange={setPage} /></div>
      </>}

      {report === 'Material Usage' && <>
        <div className="kpi-grid">{[['Pellet Consumption', `${pelletUsed.toFixed(3)} kg`], ['Colorant Consumption', `${colorantUsed.toFixed(3)} kg`], ['Total Consumption', `${(pelletUsed + colorantUsed).toFixed(3)} kg`], ['Employees Present', presentEmployees]].map(([label, value]) => <div className="app-card kpi-card" key={label}><div>{label}</div><strong>{value}</strong></div>)}</div>
        <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} placeholder="Search transaction, PO, material, or employee" />
        <div className="app-card table-scroll"><div className="table-title">Inventory Transaction Detail</div><table className="app-table"><thead><tr><th>Transaction</th><th>PO</th><th>Material Type</th><th>Material</th><th>Employee</th><th>Used kg</th><th>Date / Time</th></tr></thead><tbody>{pageRecords(filteredUsage, page).map(item => <tr key={item.id}><td className="font-mono">{item.transactionId}</td><td className="font-mono">{item.productionOrderRef}</td><td>{item.materialType.replace(/_/g, ' ')}</td><td>{item.materialName}</td><td>{item.employeeName}</td><td>{item.quantity.toFixed(3)}</td><td>{new Date(item.dateTime).toLocaleString('en-PH')}</td></tr>)}</tbody></table><Pagination page={page} totalRecords={filteredUsage.length} onPageChange={setPage} /></div>
      </>}

      {report === 'Recycling' && <>
        <div className="kpi-grid">{[['Rejected Material', `${rejected.toFixed(3)} kg`], ['Recovered Pellets', `${recovered.toFixed(3)} kg`], ['Total Recycling Loss', `${totalRecyclingLoss.toFixed(3)} kg`], ['Pending Turnovers', pendingTurnovers]].map(([label, value]) => <div className="app-card kpi-card" key={label}><div>{label}</div><strong>{value}</strong></div>)}</div>
        <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} placeholder="Search recycling batch, source PO, product, or status" />
        <div className="app-card table-scroll"><div className="table-title">Recycling Batch Detail</div><table className="app-table"><thead><tr><th>Batch</th><th>Source PO</th><th>Product</th><th>Input kg</th><th>Recovered kg</th><th>Loose kg</th><th>Status</th></tr></thead><tbody>{pageRecords(filteredRecycling, page).map(item => <tr key={item.id}><td className="font-mono">{item.batchNo}</td><td className="font-mono">{item.sourcePO || '—'}</td><td>{item.product || '—'}</td><td>{item.originalKg.toFixed(3)}</td><td>{item.recoveredKg?.toFixed(3) || '—'}</td><td>{item.looseKg?.toFixed(3) || '—'}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table><Pagination page={page} totalRecords={filteredRecycling.length} onPageChange={setPage} /></div>
      </>}
    </div>
  );
}
