import React, { useMemo, useState } from 'react';
import { useApp } from '../../store';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import BarcodeLabel, { printBarcodeBatch } from '../../components/BarcodeLabel';
import CategoryTabs from '../../components/CategoryTabs';
import Pagination, { pageRecords } from '../../components/Pagination';
import { MATERIAL_GRADES, PIPE_PRODUCT_TYPES, normalizedProductType, type PipeProductType } from '../../inventoryCategories';
import type { FinishedGood } from '../../types';

type Destination = 'All Statuses' | 'Awaiting Label / Storage' | 'Available' | 'Reserved' | 'Ready for Ship Out' | 'Released / Shipped Out';
const DESTINATIONS: readonly Destination[] = ['All Statuses', 'Awaiting Label / Storage', 'Available', 'Reserved', 'Ready for Ship Out', 'Released / Shipped Out'];
const matchesDestination = (item: FinishedGood, destination: Destination) => {
  if (destination === 'All Statuses') return true;
  if (destination === 'Released / Shipped Out') return item.releaseStatus === 'Released';
  if (item.releaseStatus === 'Released') return false;
  if (destination === 'Awaiting Label / Storage') return item.locationStatus === 'Awaiting Storage';
  if (destination === 'Reserved') return item.status === 'Reserved';
  if (destination === 'Ready for Ship Out') return item.status === 'Ready for Release';
  return item.status === 'Available';
};

export default function PMFinishedGoods() {
  const { finishedGoods, rejectedMaterials, productionOrders, markFinishedGoodBarcodePrinted, rejectFinishedGood } = useApp();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Destination>('All Statuses');
  const [productType, setProductType] = useState<'All' | PipeProductType>('All');
  const [grade, setGrade] = useState('All');
  const [location, setLocation] = useState('All');
  const [size, setSize] = useState('All');
  const [viewMode, setViewMode] = useState<'By Batch' | 'Individual Pipes'>('By Batch');
  const [page, setPage] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchPipePage, setBatchPipePage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectWeight, setRejectWeight] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [qualityError, setQualityError] = useState('');
  const selected = finishedGoods.find(item => item.id === selectedId);
  const productTabs: readonly ('All' | PipeProductType)[] = ['All', ...PIPE_PRODUCT_TYPES];
  const productEligible = useMemo(() => finishedGoods.filter(item => productType === 'All' || normalizedProductType(item.product) === productType), [finishedGoods, productType]);
  const gradeOptions = MATERIAL_GRADES;
  const sizeOptions = useMemo(() => Array.from(new Set(productEligible.map(item => item.diameter))).sort(), [productEligible]);
  const locationOptions = useMemo(() => Array.from(new Set(productEligible.map(item => item.currentLocation))).filter(Boolean).sort(), [productEligible]);
  const filtered = useMemo(() => finishedGoods.filter(f =>
    f.qualityStatus !== 'Reject'
    &&
    (productType === 'All' || normalizedProductType(f.product) === productType)
    && matchesDestination(f, status)
    && (grade === 'All' || f.grade === grade)
    && (size === 'All' || f.diameter === size)
    && (location === 'All' || f.currentLocation === location)
    && [f.barcode, f.fgId, f.poRef, f.moRef || '', f.product, f.grade, f.diameter, f.sdr, f.length, f.productForm, f.color, f.stripe, f.reservedForOrderRef || '', f.currentLocation].some(value => value.toLowerCase().includes(search.toLowerCase()))
  ), [finishedGoods, grade, location, productType, search, size, status]);
  const visibleBatchIds = useMemo(() => new Set(filtered.map(item => item.batch)), [filtered]);
  const batches = useMemo(() => Array.from(finishedGoods
    .filter(item => item.qualityStatus !== 'Reject' && visibleBatchIds.has(item.batch))
    .reduce((groups, item) => {
      const existing = groups.get(item.batch) || { item, pipes: [] as FinishedGood[] };
      existing.pipes.push(item);
      groups.set(item.batch, existing);
      return groups;
    }, new Map<string, { item: FinishedGood; pipes: FinishedGood[] }>()).values())
    .sort((a, b) => a.item.batch.localeCompare(b.item.batch, undefined, { numeric: true })), [finishedGoods, visibleBatchIds]);
  const batchSummary = (group: { item: FinishedGood; pipes: FinishedGood[] }) => {
    const rejected = rejectedMaterials.filter(item => item.batch === group.item.batch).reduce((sum, item) => sum + item.quantity, 0);
    const available = group.pipes.filter(item => item.status === 'Available' && item.releaseStatus !== 'Released').length;
    const reserved = group.pipes.filter(item => item.status === 'Reserved').length;
    const ready = group.pipes.filter(item => item.status === 'Ready for Release').length;
    const shipped = group.pipes.filter(item => item.releaseStatus === 'Released').length;
    const statuses = new Set(group.pipes.map(item => item.releaseStatus === 'Released' ? 'Shipped Out' : item.status));
    const locations = new Set(group.pipes.map(item => item.currentLocation).filter(Boolean));
    return {
      rejected, available, reserved, ready, shipped,
      produced: group.pipes.length + rejected,
      status: statuses.size === 1 ? Array.from(statuses)[0] : 'Mixed Statuses',
      location: locations.size > 1 ? 'Multiple Locations' : Array.from(locations)[0] || 'Not Yet Assigned',
    };
  };
  const manufacturingOrderFor = (item: FinishedGood) =>
    item.moRef || productionOrders.find(order => order.poNo === item.poRef)?.moRef || '—';
  const selectedBatch = batches.find(group => group.item.batch === selectedBatchId);
  const total = finishedGoods.filter(f => f.releaseStatus !== 'Released' && f.qualityStatus === 'Pass').reduce((sum, f) => sum + f.quantity, 0);
  const available = finishedGoods.reduce((sum, f) => sum + f.availableQty, 0);
  const reserved = finishedGoods.reduce((sum, f) => sum + f.reservedQty, 0);
  const unprinted = filtered.filter(item => item.printStatus === 'Not Printed');
  const currentRecords = pageRecords(filtered, page);
  const currentBatches = pageRecords(batches, page);
  const resetPage = () => setPage(1);
  const clearFilters = () => {
    setSearch(''); setProductType('All'); setGrade('All'); setSize('All'); setLocation('All'); setStatus('All Statuses'); resetPage();
  };
  const printAllUnprinted = () => {
    const printedIds = printBarcodeBatch(unprinted.map(item => ({
      value: item.barcode,
      recordId: item.id,
      recordLabel: item.fgId,
    })));
    printedIds.forEach(markFinishedGoodBarcodePrinted);
  };
  return <div className="page-stack">
    <div className="kpi-grid">{[['Physical On-Hand', total], ['Available for New Orders', available], ['Reserved', reserved], ['Ready for Ship Out', finishedGoods.filter(f => f.status === 'Ready for Release' && f.releaseStatus !== 'Released').length], ['Shipped Out', finishedGoods.filter(f => f.releaseStatus === 'Released').length]].map(([label, value]) => <div className="app-card kpi-card" key={label}><div>{label}</div><strong>{value}</strong></div>)}</div>
    <CategoryTabs items={productTabs} value={productType} onChange={value => { setProductType(value); setGrade('All'); setSize('All'); resetPage(); }} label="Finished pipe product type" />
    <div className="filter-panel">
      <div className="filter-row">
        <input className="app-input" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search barcode, size, SDR, form, color, stripe, PO, or order" />
        <select className="app-select" aria-label="Material grade" value={grade} onChange={e => { setGrade(e.target.value); resetPage(); }}><option value="All">All Material Grades</option>{gradeOptions.map(item => <option key={item}>{item}</option>)}</select>
        <select className="app-select" aria-label="Size or diameter" value={size} onChange={e => { setSize(e.target.value); resetPage(); }}><option value="All">All Sizes / Diameters</option>{sizeOptions.map(item => <option key={item}>{item}</option>)}</select>
      </div>
      <div className="filter-row">
        <select className="app-select" aria-label="Status" value={status} onChange={e => { setStatus(e.target.value as Destination); resetPage(); }}>{DESTINATIONS.map(item => <option key={item}>{item}</option>)}</select>
        <select className="app-select" aria-label="Location" value={location} onChange={e => { setLocation(e.target.value); resetPage(); }}><option value="All">All Locations</option>{locationOptions.map(item => <option key={item}>{item}</option>)}</select>
      </div>
      <div className="filter-actions">
        <CategoryTabs items={['By Batch', 'Individual Pipes'] as const} value={viewMode} onChange={value => { setViewMode(value); resetPage(); }} label="Finished pipe inventory view" />
        <button className="btn-primary" disabled={!unprinted.length} onClick={printAllUnprinted}>Print All Unprinted Barcodes ({unprinted.length})</button>
      </div>
    </div>
    <div className="app-card table-scroll">{filtered.length === 0 ? <div className="empty-state empty-state-action"><strong>No finished pipes found</strong><span>No pipe records match the selected product type, filters, status, or search.</span><button className="btn-secondary" onClick={clearFilters}>Clear Filters</button></div> : viewMode === 'By Batch' ? <><table className="app-table"><thead><tr><th>Batch ID</th><th>PO / MO</th><th>Product Type</th><th>Grade</th><th>Size / SDR / Length</th><th>Color / Stripe</th><th>Production Date</th><th>Produced / Good / Rejected</th><th>Available</th><th>Reserved</th><th>Ready</th><th>Shipped</th><th>Status</th><th data-actions>Action</th></tr></thead><tbody>{currentBatches.map(group => {
      const summary = batchSummary(group);
      return <tr key={group.item.batch}><td className="font-mono">{group.item.batch}</td><td><span className="font-mono">{group.item.poRef}</span><br/><small>{manufacturingOrderFor(group.item)}</small></td><td>{normalizedProductType(group.item.product)}</td><td>{group.item.grade}</td><td>{group.item.diameter} · {group.item.sdr} · {group.item.length}</td><td>{group.item.color} · {group.item.stripe}</td><td>{group.item.productionDate}</td><td>{summary.produced} / {group.pipes.length} / {summary.rejected}</td><td>{summary.available}</td><td>{summary.reserved}</td><td>{summary.ready}</td><td>{summary.shipped}</td><td><StatusBadge status={summary.status} /></td><td><button className="btn-secondary btn-compact" onClick={() => { setSelectedBatchId(group.item.batch); setBatchPipePage(1); }}>View Batch</button></td></tr>;
    })}</tbody></table><Pagination page={page} totalRecords={batches.length} onPageChange={setPage} noun="batches" /></> : <><table className="app-table"><thead><tr><th>Barcode</th><th>Product</th><th>Grade / Size</th><th>Purpose</th><th>Status</th><th>Location</th><th>PO</th><th>Customer Order</th><th>Print</th><th data-actions>Actions</th></tr></thead><tbody>{currentRecords.map(f => <tr key={f.id}><td className="font-mono">{f.barcode}</td><td>{f.product}</td><td>{f.grade} · {f.diameter} · {f.sdr} · {f.length}</td><td>{f.inventoryPurpose || 'Unassigned'}</td><td><StatusBadge status={f.releaseStatus === 'Released' ? 'Shipped Out' : f.status}/></td><td>{f.currentLocation || 'Not Yet Assigned'}</td><td className="font-mono">{f.poRef}</td><td className="font-mono">{f.reservedForOrderRef || '—'}</td><td>{f.printStatus}</td><td><button className="btn-secondary btn-compact" onClick={() => setSelectedId(f.id)}>View</button></td></tr>)}</tbody></table><Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} noun="pipes" /></>}</div>
    {selectedBatch && (() => {
      const summary = batchSummary(selectedBatch);
      return <Modal open title={`Finished Pipe Batch — ${selectedBatch.item.batch}`} onClose={() => setSelectedBatchId(null)} width="1100px">
        <div className="page-stack">
          <div className="app-card detail-card"><div className="section-title">Batch Summary</div><div className="responsive-grid">
            {Object.entries({ Batch: selectedBatch.item.batch, 'Production Order': selectedBatch.item.poRef, 'Manufacturing Order': manufacturingOrderFor(selectedBatch.item), Product: normalizedProductType(selectedBatch.item.product), 'Material Grade': selectedBatch.item.grade, Size: selectedBatch.item.diameter, SDR: selectedBatch.item.sdr, Length: selectedBatch.item.length, Color: selectedBatch.item.color, Stripe: selectedBatch.item.stripe, Produced: summary.produced, Rejected: summary.rejected, 'Good Pipes': selectedBatch.pipes.length, Available: summary.available, Reserved: summary.reserved, 'Ready for Ship Out': summary.ready, Shipped: summary.shipped, Location: summary.location, Status: summary.status }).map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value">{value}</div></div>)}
          </div></div>
          <div className="app-card table-scroll"><div className="table-title">Individual Good Pipes in This Batch</div><table className="app-table"><thead><tr><th>Barcode</th><th>Product / Grade</th><th>Size / SDR / Length</th><th>Color / Stripe</th><th>Unit Weight</th><th>PO / MO</th><th>Quality</th><th>Inventory Status</th><th>Location</th><th>Customer / Buyer</th><th>Production / Storage</th><th>Release</th><th data-actions>Action</th></tr></thead><tbody>
            {pageRecords([...selectedBatch.pipes].sort((a, b) => a.barcode.localeCompare(b.barcode, undefined, { numeric: true })), batchPipePage).map(pipe => <tr key={pipe.id}><td className="font-mono">{pipe.barcode}</td><td>{normalizedProductType(pipe.product)} · {pipe.grade}</td><td>{pipe.diameter} · {pipe.sdr} · {pipe.length}</td><td>{pipe.color} · {pipe.stripe}</td><td>{pipe.unitWeightKg ? `${pipe.unitWeightKg} kg` : '—'}</td><td><span className="font-mono">{pipe.poRef}</span><br/><small>{manufacturingOrderFor(pipe)}</small></td><td>{pipe.qualityStatus || 'Pass'}</td><td><StatusBadge status={pipe.releaseStatus === 'Released' ? 'Shipped Out' : pipe.status} /></td><td>{pipe.currentLocation || 'Not Yet Assigned'}</td><td>{pipe.reservedForOrderRef || '—'}<br/><small>{pipe.buyer || '—'}</small></td><td>{pipe.productionDate}<br/><small>{pipe.storedAt ? new Date(pipe.storedAt).toLocaleString('en-PH') : 'Not stored'}</small></td><td>{pipe.releasedAt ? new Date(pipe.releasedAt).toLocaleString('en-PH') : 'Not released'}<br/><small>{pipe.shipmentReference || pipe.releaseReference || '—'}</small></td><td><button className="btn-secondary btn-compact" onClick={() => { setSelectedBatchId(null); setSelectedId(pipe.id); }}>View Details</button></td></tr>)}
          </tbody></table><Pagination page={batchPipePage} totalRecords={selectedBatch.pipes.length} onPageChange={setBatchPipePage} noun="pipes" /></div>
        </div>
      </Modal>;
    })()}
    {selected && <Modal open title={`Finished Goods — ${selected.fgId}`} onClose={() => setSelectedId(null)} width="620px">
      <div className="page-stack">
        <div className="alert-success">
          <strong>Barcode Assigned Automatically</strong>
          <div>Use Print or Reprint for the same permanent physical label.</div>
        </div>
        <BarcodeLabel
            value={selected.barcode}
            recordId={selected.id}
            recordLabel={selected.fgId}
            onPrint={() => markFinishedGoodBarcodePrinted(selected.id)}
          />
        <div className="app-card detail-card"><div className="section-title">System Record Details · Not Printed</div><div className="responsive-grid">{Object.entries({ Product: selected.product, Diameter: selected.diameter, Length: selected.length, SDR: selected.sdr, Grade: selected.grade, Color: selected.color, Stripe: selected.stripe, Construction: selected.construction, Form: selected.productForm, 'Unit Weight': selected.unitWeightKg ? `${selected.unitWeightKg} kg` : '—', Batch: selected.batch, 'Production Order': selected.poRef, 'Manufacturing Order': selected.moRef || '—', 'Production Date': selected.productionDate, Shift: selected.shift, 'Quality Status': selected.qualityStatus || 'Pending', 'Inventory Purpose': selected.inventoryPurpose || 'Unassigned', 'Inventory Status': selected.status, 'Current Location': selected.currentLocation || 'Not Yet Assigned', 'Customer Order': selected.reservedForOrderRef || '—', Buyer: selected.buyer || '—', 'Release Status': selected.releaseStatus, Available: selected.availableQty, Reserved: selected.reservedQty }).map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value">{value}</div></div>)}</div></div>
        {rejecting && <div className="app-card detail-card">
          <div className="section-title">Quality Rejection</div>
          <div className="form-grid">
            <label>Actual Pipe Weight (kg)<input className="app-input" type="number" min="0.001" step="0.001" value={rejectWeight} onChange={event => setRejectWeight(event.target.value)} /></label>
            <label>Reason<select className="app-select" value={rejectReason} onChange={event => setRejectReason(event.target.value)}><option value="">Select reason</option>{['Surface Defect', 'Incorrect Diameter', 'Incorrect Thickness', 'Incorrect Length', 'Cracked', 'Deformed', 'Color Problem', 'Stripe Problem', 'Weight Problem', 'Other'].map(reason => <option key={reason}>{reason}</option>)}</select></label>
          </div>
          <div className="helper-text">Rejecting this barcode immediately removes it from available, reservation, storage, and release eligibility without changing total completed output.</div>
          {qualityError && <div className="alert-error mt-3">{qualityError}</div>}
          <div className="form-actions mt-3"><button className="btn-secondary" onClick={() => setRejecting(false)}>Cancel</button><button className="btn-primary" onClick={() => {
            const result = rejectFinishedGood(selected.id, Number(rejectWeight), rejectReason);
            if (!result.success) return setQualityError(result.error || 'Quality rejection could not be saved.');
            setRejecting(false); setRejectWeight(''); setRejectReason(''); setQualityError('');
          }}>Confirm Quality Reject</button></div>
        </div>}
        <div className="app-card detail-card"><div className="section-title">Location History</div>{selected.locationHistory?.length ? selected.locationHistory.map((entry, index) => <div className="metric-row" key={`${entry.dateTime}-${index}`}><div><strong>{entry.action}: {entry.from} → {entry.to}</strong><span>{entry.employee}{entry.reason ? ` · ${entry.reason}` : ''}</span></div><small>{new Date(entry.dateTime).toLocaleString('en-PH')}</small></div>) : <div className="empty-state">No location changes yet.</div>}</div>
        {!rejecting && selected.qualityStatus === 'Pass' && selected.releaseStatus !== 'Released' && <div className="form-actions"><button className="btn-secondary" onClick={() => setRejecting(true)}>Record Quality Reject</button></div>}
      </div>
    </Modal>}
  </div>;
}
