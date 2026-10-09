import React, { useMemo, useState } from 'react';
import { useApp } from '../../store';
import Modal from '../../components/Modal';
import BarcodeLabel, { printBarcodeBatch } from '../../components/BarcodeLabel';
import StatusBadge from '../../components/StatusBadge';
import CategoryTabs from '../../components/CategoryTabs';
import Pagination, { pageRecords } from '../../components/Pagination';
import { MATERIAL_CATEGORIES, MATERIAL_GRADES, type MaterialCategoryTab } from '../../inventoryCategories';

export default function PelletInventory() {
  const { pellets, colorants, recyclingBatches, materialUsageTransactions, markPelletBarcodePrinted } = useApp();
  const [category, setCategory] = useState<MaterialCategoryTab>('Virgin Pellets');
  const [grade, setGrade] = useState('All');
  const [recycledView, setRecycledView] = useState<'All' | 'Complete 25 kg Bags' | 'Loose Recycled Pellet'>('All');
  const [lifecycle, setLifecycle] = useState<'All' | 'Available' | 'Open / WIP' | 'Fully Consumed'>('All');
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('All');
  const [colorantType, setColorantType] = useState<'All' | 'Base Colorant' | 'Stripe Colorant'>('All');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pellets.find(item => item.id === selectedId);
  const pelletType = category === 'Virgin Pellets' ? 'Virgin' : 'Recycled';
  const filtered = pellets.filter(item =>
    item.type === pelletType
    && (lifecycle === 'All' || (lifecycle === 'Available'
      ? ['Available', 'Pending Receipt'].includes(item.inventoryStatus)
      : lifecycle === 'Open / WIP'
        ? ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus)
        : item.inventoryStatus === 'Fully Consumed'))
    && (grade === 'All' || item.grade === grade)
    && (location === 'All' || item.currentLocation === location)
    && [item.barcode, item.batchNo, item.grade].some(value => value.toLowerCase().includes(search.toLowerCase()))
  );
  const visibleColorants = colorants.filter(item =>
    (colorantType === 'All' || item.usageType === (colorantType === 'Base Colorant' ? 'BASE_COLORANT' : 'STRIPE_COLORANT'))
    &&
    [item.colorantId, item.name, item.color].some(value => value.toLowerCase().includes(search.toLowerCase()))
  );
  const colorantUsed = (id: string) => materialUsageTransactions
    .filter(item => item.materialId === id)
    .reduce((sum, item) => sum + item.quantity, 0);
  const looseRecycledKg = recyclingBatches.reduce((sum, item) => sum + (item.looseKg || 0), 0);
  const bagUsage = (id: string) => materialUsageTransactions.filter(item => item.physicalBagId === id);
  const unprinted = filtered.filter(item => item.printStatus === 'Not Printed');
  const currentPellets = pageRecords(filtered, page);
  const currentColorants = pageRecords(visibleColorants, page);
  const resetPage = () => setPage(1);
  const counts = useMemo(() => ({
    'Virgin Pellets': pellets.filter(item => item.type === 'Virgin').length,
    'Recycled Pellets': pellets.filter(item => item.type === 'Recycled').length,
    Colorants: colorants.length,
  }), [pellets, colorants]);

  const printAll = () => {
    const printedIds = printBarcodeBatch(unprinted.map(item => ({
      value: item.barcode,
      recordId: item.id,
      recordLabel: item.bagNo,
    })));
    printedIds.forEach(markPelletBarcodePrinted);
  };

  return <div className="page-stack">
    <div className="category-panel-header">
      <div><div className="section-title">Material Monitoring & Barcode Management</div><div className="helper-text">One permanent barcode per complete 25 kg pellet bag. Colorants remain kg-balance records.</div></div>
      {category !== 'Colorants' && <button className="btn-primary" disabled={!unprinted.length} onClick={printAll}>Print Unprinted ({unprinted.length})</button>}
    </div>

    <CategoryTabs items={MATERIAL_CATEGORIES} value={category} onChange={next => { setCategory(next); setSearch(''); resetPage(); }} counts={counts} label="Material inventory category" />

    <div className="app-card detail-card page-stack">
      {category !== 'Colorants' && <CategoryTabs items={['All', ...MATERIAL_GRADES] as const} value={grade} onChange={value => { setGrade(value); resetPage(); }} label={`${category} grade`} />}
      {category === 'Recycled Pellets' && <CategoryTabs items={['All', 'Complete 25 kg Bags', 'Loose Recycled Pellet'] as const} value={recycledView} onChange={value => { setRecycledView(value); resetPage(); }} label="Recycled pellet form" />}
      {category === 'Colorants' && <CategoryTabs items={['All', 'Base Colorant', 'Stripe Colorant'] as const} value={colorantType} onChange={value => { setColorantType(value); resetPage(); }} label="Colorant usage type" />}
      {category !== 'Colorants' && <CategoryTabs items={['All', 'Available', 'Open / WIP', 'Fully Consumed'] as const} value={lifecycle} onChange={value => { setLifecycle(value); resetPage(); }} label="Pellet lifecycle destination" />}
      <div className="toolbar">
        <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} placeholder={category === 'Colorants' ? 'Search color or colorant ID' : 'Search barcode, batch, or grade'} />
        {category !== 'Colorants' && <select className="app-select" value={location} onChange={event => { setLocation(event.target.value); resetPage(); }}>
          <option value="All">All Locations</option>
          {Array.from(new Set(pellets.filter(item => item.type === pelletType).map(item => item.currentLocation))).filter(Boolean).map(item => <option key={item}>{item}</option>)}
        </select>}
      </div>
    </div>

    {category === 'Recycled Pellets' && recycledView === 'Loose Recycled Pellet' ? <div className="app-card detail-card">
      <div className="section-title">Loose Recycled Pellet</div>
      <div className="kpi-card"><strong>{looseRecycledKg.toFixed(3)} kg</strong><small>No standard bag barcode until 25 kg is accumulated and bagged.</small></div>
    </div> : category === 'Colorants' ? <div className="app-card table-scroll">
      <table className="app-table">
        <thead><tr><th>Colorant ID</th><th>Color</th><th>Usage Type</th><th>Available kg</th><th>Used kg</th><th>Status</th><th>Source</th></tr></thead>
        <tbody>{currentColorants.map(item => <tr key={item.id}>
          <td className="font-mono">{item.colorantId}</td><td>{item.color} ({item.colorCode})</td>
          <td>{item.usageType === 'BASE_COLORANT' ? 'Base Colorant' : 'Stripe Colorant'}</td>
          <td className="font-mono">{item.availableKg.toFixed(3)}</td><td className="font-mono">{colorantUsed(item.id).toFixed(3)}</td>
          <td><StatusBadge status={item.status} /></td><td className="font-mono">{item.sourceReference || '—'}</td>
        </tr>)}</tbody>
      </table>
      <Pagination page={page} totalRecords={visibleColorants.length} onPageChange={setPage} />
    </div> : <div className="app-card table-scroll">
      <table className="app-table">
        <thead><tr><th>Bag Barcode</th><th>Physical Bag</th><th>Batch</th><th>Grade</th><th>Original / Remaining</th><th>Status</th><th>PO Usage History</th><th>Lifecycle Date</th><th>Location</th><th data-actions>Action</th></tr></thead>
        <tbody>{currentPellets.map(item => <tr key={item.id}>
          <td className="font-mono">{item.barcode}</td><td className="font-mono">{item.bagNo}</td><td className="font-mono">{item.batchNo}</td>
          <td>{item.grade}</td><td className="font-mono">{(item.originalKg || 25).toFixed(3)} / {item.availableKg.toFixed(3)} kg</td><td><StatusBadge status={item.inventoryStatus} /></td>
          <td>{bagUsage(item.id).length ? Array.from(new Set(bagUsage(item.id).map(usage => usage.productionOrderRef))).join(', ') : item.loadedForPORef || '—'}</td>
          <td>{item.fullyConsumedAt ? new Date(item.fullyConsumedAt).toLocaleString('en-PH') : item.loadedAt ? new Date(item.loadedAt).toLocaleString('en-PH') : item.receivedDate}</td>
          <td>{item.currentLocation || 'Not Yet Assigned'}</td>
          <td><button className="btn-secondary btn-compact" onClick={() => setSelectedId(item.id)}>View</button></td>
        </tr>)}</tbody>
      </table>
      <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
    </div>}

    {selected && <Modal open title={`Pellet Bag — ${selected.bagNo}`} onClose={() => setSelectedId(null)} width="620px">
      <div className="page-stack">
        <BarcodeLabel
          value={selected.barcode}
          recordId={selected.id}
          recordLabel={selected.bagNo}
          onPrint={() => markPelletBarcodePrinted(selected.id)}
        />
        <div className="app-card detail-card">
          <div className="section-title">System Record Details · Not Printed</div>
          <div className="responsive-grid">
            {[
              ['Physical Item', selected.bagNo], ['Parent Batch', selected.batchNo], ['Pellet Type', selected.type],
              ['Original Weight', '25 kg'], ['Remaining Weight', `${selected.availableKg.toFixed(3)} kg`], ['Grade', selected.grade],
              ['Inventory Status', selected.inventoryStatus], ['Current Location', selected.currentLocation || 'Not Yet Assigned'],
            ].map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value">{value}</div></div>)}
          </div>
        </div>
      </div>
    </Modal>}
  </div>;
}
