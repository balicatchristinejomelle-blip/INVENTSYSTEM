import React, { useMemo, useState } from 'react';
import { useApp } from '../../store';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import CategoryTabs from '../../components/CategoryTabs';
import Pagination, { pageRecords } from '../../components/Pagination';
import type { FinishedGood } from '../../types';
import { MATERIAL_GRADES, PIPE_PRODUCT_TYPES, normalizedProductType, type PipeProductType } from '../../inventoryCategories';

export default function MarketingFG() {
  const { finishedGoods } = useApp();
  const [productType, setProductType] = useState<'All' | PipeProductType>('All');
  const [status, setStatus] = useState<'Available' | 'Reserved' | 'Ready for Release' | 'Shipped Out / Released'>('Available');
  const [grade, setGrade] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FinishedGood | null>(null);
  const [page, setPage] = useState(1);
  const productTabs: readonly ('All' | PipeProductType)[] = ['All', ...PIPE_PRODUCT_TYPES];
  const visible = useMemo(() => finishedGoods.filter(item =>
    (productType === 'All' || normalizedProductType(item.product) === productType)
    && (grade === 'All' || item.grade === grade)
    && (status === 'Shipped Out / Released' ? item.releaseStatus === 'Released' : item.releaseStatus !== 'Released' && item.status === status)
    && [item.barcode, item.fgId, item.poRef, item.product, item.grade].some(value => value.toLowerCase().includes(search.toLowerCase()))
  ), [finishedGoods, grade, productType, search, status]);
  const selectedGroup = productType === 'All' ? finishedGoods : finishedGoods.filter(item => normalizedProductType(item.product) === productType);

  return <div className="page-stack">
    <div><div className="section-title">Finished Goods Availability</div><div className="helper-text">Read-only stock visibility grouped by official product type.</div></div>
    <CategoryTabs items={productTabs} value={productType} onChange={v => { setProductType(v); setPage(1); }} label="Finished goods product type" />
    <div className="kpi-grid">
      {[
        ['Available', selectedGroup.filter(item => item.status === 'Available').length],
        ['Reserved', selectedGroup.filter(item => item.status === 'Reserved').length],
        ['Ready for Release', selectedGroup.filter(item => item.status === 'Ready for Release').length],
      ].map(([label, value]) => <div className="app-card kpi-card" key={label}><div>{label}</div><strong>{value}</strong><small>individual physical pipes</small></div>)}
    </div>
    <div className="toolbar">
      <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search barcode, pipe ID, PO, or product" />
      <select className="app-select" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }}><option>Available</option><option>Reserved</option><option>Ready for Release</option><option>Shipped Out / Released</option></select>
      <select className="app-select" value={grade} onChange={event => { setGrade(event.target.value); setPage(1); }}><option>All</option>{MATERIAL_GRADES.map(item => <option key={item}>{item}</option>)}</select>
    </div>
    <div className="app-card table-scroll">
      <table className="app-table">
        <thead><tr><th>Pipe ID</th><th>Barcode</th><th>Product Type</th><th>Specifications</th><th>Grade</th><th>Location</th><th>PO</th><th>Status</th><th data-actions>Action</th></tr></thead>
        <tbody>
          {pageRecords(visible, page).map(item => <tr key={item.id}><td className="font-mono">{item.fgId}</td><td className="font-mono">{item.barcode}</td><td>{normalizedProductType(item.product)}</td><td>{item.diameter} · {item.sdr} · {item.length} · {item.color} · {item.stripe}</td><td>{item.grade}</td><td>{item.currentLocation || 'Not Yet Assigned'}</td><td className="font-mono">{item.poRef}</td><td><StatusBadge status={item.status} /></td><td><button className="btn-secondary btn-compact" onClick={() => setSelected(item)}>View</button></td></tr>)}
          {!visible.length && <tr><td colSpan={9} className="empty-state">No records match the selected search or filters.</td></tr>}
        </tbody>
      </table>
      <Pagination page={page} totalRecords={visible.length} onPageChange={setPage} />
    </div>
    {selected && <Modal open title={`Finished Pipe — ${selected.fgId}`} onClose={() => setSelected(null)} width="620px"><div className="responsive-grid">
      <Info label="Product Type" value={normalizedProductType(selected.product)} /><Info label="Material Grade" value={selected.grade} />
      <Info label="Diameter / Size" value={selected.diameter} /><Info label="SDR" value={selected.sdr} />
      <Info label="Length" value={selected.length} /><Info label="Color / Stripe" value={`${selected.color} · ${selected.stripe}`} />
      <Info label="Form" value={selected.productForm} /><Info label="Related PO" value={selected.poRef} />
    </div></Modal>}
  </div>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="field-label">{label}</div><div className="field-value">{value}</div></div>;
}
