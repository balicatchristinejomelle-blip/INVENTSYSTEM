import { matchesRecord } from "../../components/RecordSearch"
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';
import { productFilterRecord } from '../../productFilters';
import { finishedGoodsStockEffect, finishedGoodsStockCard } from '../../finishedGoodsInventory';

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useMemo, useState } from "react"

import { useApp } from "../../store"

import CategoryTabs from "../../components/CategoryTabs"

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
  const app = useApp();
  const { transactions, navigate } = app;

  const [category, setCategory] = useState<Category>("All")

  const [type, setType] = useState("All")

  const [date, setDate] = useState("")

  const [search, setSearch] = useState("")

  const [page, setPage] = useState(1)
  const productFilters = useProductFilters(() => setPage(1));

  const types = useMemo(() => ['All', ...Array.from(new Set(transactions.map(item => item.transactionType)))], [transactions]);
  const finishedCard = useMemo(() => finishedGoodsStockCard(transactions, app.finishedGoods), [transactions, app.finishedGoods]);

  const visible = transactions.filter(
    (item) =>
      (category === 'All' || categoryOf(item) === category)
    && (category !== 'Finished Pipe' || productFilters.matches(item))
    && (type === 'All' || item.transactionType === type)
    && (!date || item.date === date) &&
      ([item.barcode, item.reference, item.poRef, item.productType, item.item, item.batch, item.employee].some(value => (value || '').toLowerCase().includes(search.trim().toLowerCase())) ||
        matchesRecord(categoryOf(item) === 'Finished Pipe' ? productFilterRecord(item, app) : item, search)),
  )

  const summary = useMemo(() => {
    const ordered = [...visible].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    const byItem = new Map<string, typeof ordered>();
    ordered.forEach(item => {
      const key = item.barcode || `${categoryOf(item)}|${item.item}|${item.batch}`;
      byItem.set(key, [...(byItem.get(key) || []), item]);
    });
    const beginning = category === 'Finished Pipe' ? (finishedCard.rows.find(row => ordered.some(item => item.id === row.transaction.id))?.before ?? finishedCard.ending) : Array.from(byItem.values()).reduce((sum, items) => sum + (items[0]?.qtyBefore || 0), 0);
    const stockIn = ordered.reduce((sum, item) => sum + finishedGoodsStockEffect(item, app.finishedGoods).stockIn, 0);
    const stockOut = ordered.reduce((sum, item) => sum + finishedGoodsStockEffect(item, app.finishedGoods).stockOut, 0);
    return { beginning, stockIn, stockOut, ending: beginning + stockIn - stockOut };
  }, [visible, category, finishedCard, app.finishedGoods]);

  const targetForReference = (reference: string) => {
    if (/^RR-/.test(reference)) return 'acc-rr-records';
    if (/^(MT|TR)-/.test(reference)) return 'acc-transfers';
    if (/^MR-/.test(reference)) return 'acc-branch-requests';
    return null;
  };

  const unitFor = (item: typeof transactions[number]) =>
    categoryOf(item) === "Finished Pipe" ? "units" : "kg"

  const formatQuantity = (value: number, unit: string) => `${value.toLocaleString('en-US', { minimumFractionDigits: unit === 'kg' ? 2 : 0, maximumFractionDigits: unit === 'kg' ? 2 : 0 })} ${unit}`;

  return (
    <div className="page-stack">
      <div className="kpi-grid inventory-balance-grid">
        <div className="app-card kpi-card">
          <div>
            Beginning Balance{" "}
            <span className="info-hint" title="Balance before the first matching movement.">i</span>
          </div>
          <strong>{summary.beginning.toLocaleString()}</strong>
        </div>
        <div className="app-card kpi-card">
          <div>
            Stock In{" "}
            <span className="info-hint" title="Physical stock received into the selected inventory scope.">i</span>
          </div>
          <strong className="stock-in-value">
            +{summary.stockIn.toLocaleString()}
          </strong>
        </div>
        <div className="app-card kpi-card">
          <div>
            Stock Out{" "}
            <span className="info-hint" title="Physical stock released from the selected inventory scope.">i</span>
          </div>
          <strong className="stock-out-value">
            −{summary.stockOut.toLocaleString()}
          </strong>
        </div>
        <div className="app-card kpi-card">
          <div>
            Ending Balance{" "}
            <span className="info-hint" title="Beginning + Stock In − Stock Out. This value is calculated and cannot be edited.">i</span>
          </div>
          <strong>{summary.ending.toLocaleString()}</strong>
        </div>
      </div>
      <div className="alert-info stock-card-note">
        <strong>Internal movement:</strong> Finished Pipe storage, reservation, staging and loading have zero Stock In / Out. Good production output is the single Stock In; shipment/release is Stock Out. Raw Pellet → WIP remains unchanged.</div>
      {category === 'Finished Pipe' && finishedCard.needsReconciliation && <div className="alert-warning">Historical movement totals do not reconcile with the retained physical sample records. No history was rewritten; review the opening balance before backend import.</div>}
      <CategoryTabs items={CATEGORIES} value={category} onChange={value => { setCategory(value); setPage(1); }} label="Inventory transaction category" />
      <div className="toolbar">
        <input className={`app-input${category === 'Finished Pipe' ? ' record-search' : ''}`} type="search" aria-label="Search inventory movements" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search Barcode, PO, product, batch, reference, or employee" />
        {category === 'Finished Pipe' && <ProductFilters value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade />}
        <SearchableDropdown
          className="app-select" aria-label="Transaction type" value={type} onChange={event => { setType(event.target.value); setPage(1); }}
        >
          {types.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </SearchableDropdown>
        <input className="app-input" aria-label="Movement date" type="date" value={date} onChange={event => { setDate(event.target.value); setPage(1); }} />
      </div>
      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Reference</th>
              <th>Transaction Type</th>
              <th>Description</th>
              <th>Stock In</th>
              <th>Stock Out</th>
              <th>Running Balance</th>
              <th>Unit</th>
              <th>Location</th>
              <th>Employee</th>
              <th data-actions>Action</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords(visible, page).map((item) => {
              const unit = unitFor(item)

              const target = targetForReference(item.reference)

              return (
                <tr key={item.id}>
                  <td>
                    {item.date}
                    <br />
                    <small>{item.time}</small>
                  </td>
                  <td>
                    <span className="font-mono reference-link">
                      {item.reference || item.poRef || item.txId}
                    </span>
                    <br />
                    <small className="font-mono">
                      {item.barcode || item.batch}
                    </small>
                  </td>
                  <td>
                    {item.transactionType}
                    <br />
                    <small>
                      {finishedGoodsStockEffect(item, app.finishedGoods).internal ? 'Internal Movement' : categoryOf(item)}
                    </small>
                  </td>
                  <td>
                    {item.item}
                    <br />
                    <small>
                      {item.source} → {item.destination}
                    </small>
                  </td>
                  <td className="font-mono stock-in-value">
                    {finishedGoodsStockEffect(item, app.finishedGoods).stockIn > 0 ? formatQuantity(finishedGoodsStockEffect(item, app.finishedGoods).stockIn, unit) : '—'}
                  </td>
                  <td className="font-mono stock-out-value">
                    {finishedGoodsStockEffect(item, app.finishedGoods).stockOut > 0 ? formatQuantity(finishedGoodsStockEffect(item, app.finishedGoods).stockOut, unit) : '—'}
                  </td>
                  <td className="font-mono">
                    {formatQuantity(categoryOf(item) === 'Finished Pipe' ? finishedCard.rows.find(row => row.transaction.id === item.id)?.balance ?? item.qtyAfter : item.qtyAfter, unit)}
                  </td>
                  <td>{unit}</td>
                  <td>{item.destination || item.source}</td>
                  <td>{item.employee}</td>
                  <td>
                    {target ? <button className="btn-secondary btn-compact" onClick={() => navigate(target)}>Open</button> : <span className="helper-text">No linked view</span>}
                  </td>
                </tr>
              )
            })}
            {!visible.length && (
              <tr>
                <td colSpan={11} className="empty-state empty-state-action">
                  <strong>NO INVENTORY MOVEMENTS</strong>
                  <span>No stock movement exists for the selected search or filters.</span>
                  {(search || date || type !== 'All' || category !== 'All') && <button className="btn-secondary btn-compact" onClick={() => { setSearch(''); setDate(''); setType('All'); setCategory('All'); setPage(1); }}>Clear Filters</button>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalRecords={visible.length} onPageChange={setPage} noun="movements" />
      </div>
    </div>
  )
}
