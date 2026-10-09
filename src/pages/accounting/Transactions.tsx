import React, { useMemo, useState } from 'react';
import { useApp } from '../../store';
import CategoryTabs from '../../components/CategoryTabs';
import Pagination, { pageRecords } from '../../components/Pagination';

type Category = 'All' | 'Virgin Pellet' | 'Recycled Pellet' | 'Colorant' | 'Finished Pipe';
const CATEGORIES: readonly Category[] = ['All', 'Virgin Pellet', 'Recycled Pellet', 'Colorant', 'Finished Pipe'];

function categoryOf(item: { materialCategory?: Category; item: string; transactionType: string }): Category {
  if (item.materialCategory) return item.materialCategory;
  const text = `${item.item} ${item.transactionType}`.toLowerCase();
  if (text.includes('colorant')) return 'Colorant';
  if (text.includes('finished') || text.includes('pipe')) return 'Finished Pipe';
  if (text.includes('recycled')) return 'Recycled Pellet';
  return 'Virgin Pellet';
}

export default function Transactions() {
  const { transactions } = useApp();
  const [category, setCategory] = useState<Category>('All');
  const [type, setType] = useState('All');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const types = useMemo(() => ['All', ...Array.from(new Set(transactions.map(item => item.transactionType)))], [transactions]);
  const visible = transactions.filter(item =>
    (category === 'All' || categoryOf(item) === category)
    && (type === 'All' || item.transactionType === type)
    && (!date || item.date === date)
    && [item.barcode, item.reference, item.poRef, item.productType, item.item, item.batch].some(value => (value || '').toLowerCase().includes(search.toLowerCase()))
  );
  return <div className="page-stack">
    <CategoryTabs items={CATEGORIES} value={category} onChange={v => { setCategory(v); setPage(1); }} label="Inventory transaction category" />
    <div className="toolbar">
      <input className="app-input" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search barcode, PO, product, batch, or reference" />
      <select className="app-select" value={type} onChange={event => { setType(event.target.value); setPage(1); }}>{types.map(item => <option key={item}>{item}</option>)}</select>
      <input className="app-input" type="date" value={date} onChange={event => { setDate(event.target.value); setPage(1); }} />
    </div>
    <div className="app-card table-scroll">
      <table className="app-table">
        <thead><tr><th>TX ID</th><th>Date / Time</th><th>Category</th><th>Transaction Type</th><th>Item</th><th>Batch / Barcode</th><th>PO / Reference</th><th>Before</th><th>Changed</th><th>After</th><th>Employee</th></tr></thead>
        <tbody>
          {pageRecords(visible, page).map(item => <tr key={item.id}>
            <td className="font-mono">{item.txId}</td><td>{item.date} {item.time}</td><td>{categoryOf(item)}</td><td>{item.transactionType}</td><td>{item.item}</td>
            <td><span className="font-mono">{item.batch}</span><br/><small className="font-mono">{item.barcode || 'No item barcode'}</small></td>
            <td><span className="font-mono">{item.poRef || '—'}</span><br/><small>{item.reference}</small></td>
            <td className="font-mono">{item.qtyBefore}</td><td className="font-mono">{item.qtyChanged > 0 ? '+' : ''}{item.qtyChanged}</td><td className="font-mono">{item.qtyAfter}</td><td>{item.employee}</td>
          </tr>)}
          {!visible.length && <tr><td colSpan={11} className="empty-state">No records match the selected search or filters.</td></tr>}
        </tbody>
      </table>
      <Pagination page={page} totalRecords={visible.length} onPageChange={setPage} />
    </div>
  </div>;
}
