import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import React, { useMemo, useState } from 'react';
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';
import { matchesRecord } from '../../components/RecordSearch';
import { productFilterRecord } from '../../productFilters';
import { formatProductionTime, useApp } from '../../store';
import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';
import Pagination, { pageRecords } from '../../components/Pagination';

const tabs = ['My Attendance', 'My Production', 'My Turnovers', 'My Barcode Activity', 'My Quality Records', 'My Recycling Activity'] as const;

export default function ProductionHistory() {
  const app = useApp();
  const { currentUser, attendance, transactions, turnovers, rejectedMaterials, recyclingBatches, productionOrders } = app;
  const [tab, setTab] = useViewState<typeof tabs[number]>("production/History:tab", 'My Attendance');
  const [search, setSearch] = useViewState("production/History:search", '');
  const period = usePeriod('all', search);
  const [page, setPage] = useViewState("production/History:page", 1);
  const productFilters = useProductFilters(() => setPage(1));
  const productTab = tab !== 'My Attendance';
  const query = search.trim().toLowerCase();
  const mine = useMemo(() => transactions.filter(item =>
    item.employeeId === currentUser?.employeeId
    && (!productTab || productFilters.matches(item))
    && dateInPeriod(item.date, period.range)
    && matchesRecord(productFilterRecord(item, app), query)
  ), [transactions, currentUser, search, period.range, productFilters.value, productTab, period.range.start, period.range.end]);
  const matchesSearch = (item: unknown) => matchesRecord(productTab ? productFilterRecord(item, app) : item, query) && (!productTab || productFilters.matches(item));
  const myAttendance = attendance.filter(item => item.employeeId === currentUser?.employeeId && dateInPeriod(item.date, period.range) && matchesSearch(item));
  const myTurnovers = turnovers.filter(item => item.outgoingEmployeeId === currentUser?.employeeId && dateInPeriod(item.date, period.range) && matchesSearch(item));
  const myQuality = rejectedMaterials.filter(item => item.employee === currentUser?.name && dateInPeriod(item.date, period.range) && matchesSearch(item));
  const myRecycling = recyclingBatches.filter(item => item.employees.includes(currentUser?.name || '') && dateInPeriod(item.date, period.range) && matchesSearch(item));
  const recordCount = tab === 'My Attendance' ? myAttendance.length
    : tab === 'My Production' ? mine.length
    : tab === 'My Turnovers' ? myTurnovers.length
    : tab === 'My Barcode Activity' ? mine.filter(item => item.barcode).length
    : tab === 'My Quality Records' ? myQuality.length
    : myRecycling.length;

  return <div className="page-stack">
    <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => setPage(1)} placeholder="Search PO, MO, product, barcode, employee, shift..." compact filters={productTab ? <ProductFilters value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade /> : undefined} />
    <div className="tab-strip">{tabs.map(item => <button key={item} className={tab === item ? 'tab-active' : ''} onClick={() => { setTab(item); setPage(1); }}>{item}</button>)}</div>
    <div className="app-card table-scroll"><table className="app-table"><thead><tr>
      {tab === 'My Attendance' && <><th>Date</th><th>Shift</th><th>Clock In</th><th>Clock Out</th><th>Status</th></>}
      {tab === 'My Production' && <><th>Date</th><th>Shift</th><th className="po-column">PO</th><th>Product / Action</th><th>Quantity</th><th>Status</th></>}
      {tab === 'My Turnovers' && <><th>Date / Shift</th><th className="po-column">PO / Product</th><th>Produced / Good</th><th>Rejected / Weight</th><th>Total Materials</th><th>Submitted / Accepted</th><th>Status</th></>}
      {tab === 'My Barcode Activity' && <><th>Date / Time</th><th>Barcode</th><th>Category</th><th>Batch / FG</th><th data-actions>Actions</th><th>Reference</th></>}
      {tab === 'My Quality Records' && <><th>Date</th><th className="po-column">PO</th><th>Product</th><th>Quantity</th><th>Rejected kg</th><th>Result / Reason</th></>}
      {tab === 'My Recycling Activity' && <><th>Date</th><th>Recycling Batch</th><th>Original kg</th><th>Recovered kg</th><th>Status</th></>}
    </tr></thead><TableBody>
      {tab === 'My Attendance' && pageRecords(myAttendance, page).map(item => <tr key={item.id}><td>{item.date}</td><td>{item.shift}</td><td>{formatProductionTime(item.clockIn)}</td><td>{formatProductionTime(item.clockOut)}</td><td>{item.status === 'Active' ? 'Clocked In' : 'Clocked Out'}</td></tr>)}
      {tab === 'My Production' && pageRecords(mine, page).map(item => <tr key={item.id}><td>{item.date}</td><td>{productionOrders.find(order => order.poNo === item.reference)?.assignedShift || 'Day'}</td><td className="po-column">{item.reference}</td><td>{item.item} · {item.transactionType}</td><td>{Math.abs(item.qtyChanged)}</td><td>{item.status}</td></tr>)}
      {tab === 'My Turnovers' && pageRecords(myTurnovers, page).map(item => <tr key={item.id}><td>{item.date}<br />{item.outgoingShift}</td><td className="po-column"><RecordReference value={item.poRef} /><br />{item.product || '—'}</td><td>{item.completedThisShift} / {item.goodQty ?? Math.max(0, item.completedThisShift - item.rejectedQty)}</td><td>{item.rejectedQty} / {item.rejectedKg} kg</td><td>{item.totalMaterialWeight ?? item.pelletUsed} kg</td><td>{item.time}<br />{item.acceptedBy ? `${item.acceptedBy} · ${item.acceptedTime}` : 'Pending acceptance'}</td><td>{item.status}</td></tr>)}
      {tab === 'My Barcode Activity' && pageRecords(mine.filter(item => item.barcode), page).map(item => <tr key={item.id}><td>{item.date} {item.time}</td><td className="font-mono"><RecordReference value={item.barcode} /></td><td>{item.transactionType.includes('Pellet') ? 'Pellet' : 'Finished Pipe'}</td><td><RecordReference value={item.batch} /></td><td>{item.transactionType}</td><td className="po-column">{item.reference}</td></tr>)}
      {tab === 'My Quality Records' && pageRecords(myQuality, page).map(item => <tr key={item.id}><td>{item.date}</td><td className="po-column"><RecordReference value={item.poRef} /></td><td>{item.product}</td><td>{item.quantity}</td><td>{item.weightKg}</td><td>Rejected · {item.reason}</td></tr>)}
      {tab === 'My Recycling Activity' && pageRecords(myRecycling, page).map(item => <tr key={item.id}><td>{item.date}</td><td><RecordReference value={item.batchNo} /></td><td>{item.originalKg}</td><td>{item.recoveredKg || '—'}</td><td>{item.status}</td></tr>)}
      {!recordCount && <tr><td colSpan={7}><div className="empty-state">No records are available for {period.range.label}.</div></td></tr>}
    </TableBody></table><Pagination page={page} totalRecords={recordCount} onPageChange={setPage} /></div>
  </div>;
}
