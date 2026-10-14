import React, { useEffect, useState } from 'react';
import { useApp } from '../store';
import { buildProductionGroups, productionGroupSummary, type ProductionGroup } from '../productionGroups';
import { readPipeSpecifications, resolveFinishedPipe } from '../finishedPipeRelations';
import { matchesRecord } from './RecordSearch';
import { matchesProductFilter, type ProductFilter } from '../productFilters';
import Pagination, { pageRecords } from './Pagination';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import type { FinishedGood } from '../types';
import { productFilterRecord } from '../productFilters';

export default function FinishedGoodGroups({ search, filter, onViewPipe }: { search: string; filter: ProductFilter; onViewPipe: (pipe: FinishedGood) => void }) {
  const app = useApp();
  const data = { ...app, specifications: readPipeSpecifications() };
  const groups = buildProductionGroups(data);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [pipePage, setPipePage] = useState(1);
  useEffect(() => setPage(1), [search, filter.size, filter.sdr, filter.product, filter.grade, filter.length]);
  const records = (group: ProductionGroup) => [...group.orders.map(po => productFilterRecord(po, data)), ...group.pipes.map(pipe => resolveFinishedPipe(pipe, data))];
  const visible = groups.filter(group => matchesRecord({ reference: group.reference, type: group.type, records: records(group) }, search)
    && [...group.orders, ...group.pipes].some(record => matchesProductFilter(record, filter, data)));
  const detail = groups.find(group => `${group.type}|${group.reference}` === selected);
  const fields = (group: ProductionGroup) => {
    const summary = productionGroupSummary(group, data);
    const mo = group.type === 'MO' ? app.manufacturingOrders.find(mo => mo.moNo === group.reference) : undefined;
    const order = mo ? app.orders.find(order => order.orderNo === mo.orderRef) : undefined;
    const specifications = [...new Set(group.orders.map(po => `${po.product} · ${po.grade} · ${po.diameter} · ${po.sdr} · ${po.length} · ${po.color} · ${po.stripe}`))];
    const codes = [...new Set([...group.pipes.map(pipe => resolveFinishedPipe(pipe, data).itemCode), ...group.orders.map(po => productFilterRecord(po, data).itemCode)].filter(Boolean))];
    return { 'Origin Group': group.reference, 'Group Type': group.type, 'Production Source': group.type === 'MO' ? 'Manufacturing Order' : 'Stock Replenishment',
      'Manufacturing Order': mo?.moNo || 'N/A', ...(group.type === 'MO' ? { 'Customer Order': order?.orderNo || 'Not Resolved', Buyer: order?.customerName || 'Not Resolved' } : {}),
      'Item Code': codes.join(', ') || 'Not Configured', 'Product Specification': specifications.join('; ') || 'Historical Output',
      'Inventory Purpose': group.type === 'MO' ? 'Temporary Storage' : 'Inventory Storage', 'Related POs': group.orders.map(po => po.poNo).join(', '), 'Related Batches': summary.batches.join(', ') || 'No output yet',
      ...(group.type === 'Replenishment' ? { 'Target Replenishment Quantity': summary.target } : {}), Produced: summary.produced, Good: summary.good, Rejected: summary.rejected, Available: summary.available, Reserved: summary.reserved,
      'Temporary Storage': summary.temporary, 'Ready for Ship Out': summary.ready, Shipped: summary.shipped, Status: summary.status };
  };
  const grid = (group: ProductionGroup) => <div className="responsive-grid">{Object.entries(fields(group)).map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value">{value}</div></div>)}</div>;
  const seasonal = (group: ProductionGroup) => group.pipes.some(pipe => resolveFinishedPipe(pipe, data).seasonal) || group.orders.some(po => productFilterRecord(po, data).seasonal === true);
  return <div className="page-stack production-group-view">
    {pageRecords(visible, page).map(group => <article className="app-card detail-card" key={`${group.type}|${group.reference}`}>
      <div className="mobile-record-heading"><strong>{group.reference}</strong><StatusBadge status={productionGroupSummary(group, data).status} />{seasonal(group) && <span className="badge-blue">SEASONAL</span>}</div>
      {grid(group)}<button className="btn-secondary" onClick={() => { setSelected(`${group.type}|${group.reference}`); setPipePage(1); }}>View Group</button>
    </article>)}
    {!visible.length && <div className="app-card empty-state">No matching groups.</div>}
    <Pagination page={page} totalRecords={visible.length} onPageChange={setPage} noun="groups" />
    {detail && <Modal open title={`Production Group — ${detail.reference}`} onClose={() => setSelected(null)} width="1100px"><div className="page-stack production-group-view">
      {seasonal(detail) && <span className="badge-blue">SEASONAL</span>}{grid(detail)}
      <div className="section-title">Related Finished Pipe Records</div>
      {pageRecords(detail.pipes, pipePage).map(pipe => <article className="app-card mobile-record-card" key={pipe.id}>
        <strong>{pipe.fgId}</strong><span>{pipe.batch} · {pipe.poRef} · {pipe.product} · {pipe.diameter} · {pipe.sdr}</span>
        <StatusBadge status={pipe.releaseStatus === 'Released' ? 'Shipped Out' : pipe.status} />
        <button className="btn-secondary" onClick={() => { setSelected(null); onViewPipe(pipe); }}>View Details</button>
      </article>)}
      {!detail.pipes.length && <div className="empty-state">No finished pipe output yet.</div>}
      <Pagination page={pipePage} totalRecords={detail.pipes.length} onPageChange={setPipePage} noun="pipes" />
    </div></Modal>}
  </div>;
}
