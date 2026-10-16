import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import { matchesRecord } from "../../components/RecordSearch"
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';
import { productFilterRecord } from '../../productFilters';
import { finishedGoodsStockCard } from '../../finishedGoodsInventory';
import { operationalStockEffect as finishedGoodsStockEffect, operationalStockCard } from '../../operationalInventory';

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

  const [category, setCategory] = useViewState<Category>("accounting/Transactions:category", "All")

  const [type, setType] = useViewState("accounting/Transactions:type", "All")


  const [search, setSearch] = useViewState("accounting/Transactions:search", "")
  const period = usePeriod('all', search);

  const [page, setPage] = useViewState("accounting/Transactions:page", 1)
  const productFilters = useProductFilters(() => setPage(1));

  const types = useMemo(() => ['All', ...Array.from(new Set(transactions.map(item => item.transactionType)))], [transactions]);
  const finishedCard = useMemo(() => finishedGoodsStockCard(transactions, app.finishedGoods), [transactions, app.finishedGoods]);
  const ledger = useMemo(() => operationalStockCard(transactions, app.finishedGoods), [transactions, app.finishedGoods]);

  const visible = transactions.filter(
    (item) =>
      (category === 'All' || categoryOf(item) === category)
    && (category !== 'Finished Pipe' || productFilters.matches(item))
    && (type === 'All' || item.transactionType === type)
    && dateInPeriod(item.date, period.range) &&
      ([item.barcode, item.reference, item.poRef, item.productType, item.item, item.batch, item.employee].some(value => (value || '').toLowerCase().includes(search.trim().toLowerCase())) ||
        matchesRecord(categoryOf(item) === 'Finished Pipe' ? productFilterRecord(item, app) : item, search)),
  )

  const summary = useMemo(() => {
    const ids = new Set(visible.map(item => item.id));
    const groups = new Map<string, { unit: string; beginning: number; stockIn: number; stockOut: number }>();
    for (const row of ledger.filter(row => ids.has(row.transaction.id))) {
      const group = groups.get(row.category) || { unit: row.category === 'Finished Pipe' ? 'units' : 'kg', beginning: row.before, stockIn: 0, stockOut: 0 };
      group.stockIn += row.stockIn; group.stockOut += row.stockOut; groups.set(row.category, group);
    }
    const format = (field: 'beginning' | 'stockIn' | 'stockOut' | 'ending') => {
      const values = new Map<string, number>();
      for (const group of groups.values()) values.set(group.unit, (values.get(group.unit) || 0) + (field === 'ending' ? group.beginning + group.stockIn - group.stockOut : group[field]));
      return [...values].map(([unit, value]) => `${value.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unit}`).join(' · ') || '0';
    };
    return { beginning: format('beginning'), stockIn: format('stockIn'), stockOut: format('stockOut'), ending: format('ending') };
  }, [visible, ledger]);

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
        <strong>Internal movement:</strong> Raw → WIP, consumption, relocation, inter-plant transfer, storage, reservation, staging and loading do not create company Stock In / Out. Material kg and Finished Pipe units are separate ledgers: good output enters the Finished Pipe ledger once; shipment/release leaves it. Material Ending is the external movement ledger, not active Raw/WIP; current material positions are shown in inventory.</div>
      {category === 'Finished Pipe' && finishedCard.needsReconciliation && <div className="alert-warning">Historical movement totals do not reconcile with the retained physical sample records. No history was rewritten; review the opening balance before backend import.</div>}
      <CategoryTabs items={CATEGORIES} value={category} onChange={value => { setCategory(value); setPage(1); }} label="Inventory transaction category" />
      <div className="toolbar">
        <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => { setPage(1); }} />
        {category === 'Finished Pipe' && <ProductFilters value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade includeColor includeLocation />}
        <label className="product-filter-field"><span className="field-label">Transaction Type</span><SearchableDropdown
          className="app-select" aria-label="Transaction type" value={type} onChange={event => { setType(event.target.value); setPage(1); }}
        >
          {types.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </SearchableDropdown></label>
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
          <TableBody>
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
                  <td className="po-column">
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
                    {formatQuantity(ledger.find(row => row.transaction.id === item.id)?.balance ?? item.qtyAfter, unit)}
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
                  {(search || period.scope !== 'all' || type !== 'All' || category !== 'All') && <button className="btn-secondary btn-compact" onClick={() => { setSearch(''); period.setDate(''); setType('All'); setCategory('All'); setPage(1); }}>Clear Filters</button>}
                </td>
              </tr>
            )}
          </TableBody>
        </table>
        <Pagination page={page} totalRecords={visible.length} onPageChange={setPage} noun="movements" />
      </div>
    </div>
  )
}
