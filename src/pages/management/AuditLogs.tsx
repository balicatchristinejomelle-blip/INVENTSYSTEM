import React, { useMemo, useState } from 'react';
import { useApp } from '../../store';
import Pagination, { pageRecords } from '../../components/Pagination';
import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

function processType(action: string, reference = '') {
  const value = `${action} ${reference}`.toUpperCase();
  if (/\bRR\b|RECEIVING REPORT/.test(value)) return 'RR';
  if (/\bOR\b/.test(value)) return 'OR';
  if (/\bPR\b/.test(value)) return 'PR';
  if (/\bSO\b|CUSTOMER ORDER/.test(value)) return 'Customer Order';
  if (/\bMO\b|MANUFACTURING ORDER/.test(value)) return 'MO';
  if (/\bPO\b|PRODUCTION ORDER/.test(value)) return 'PO';
  if (/MATERIAL REQUEST|\bMR\b/.test(value)) return 'Material Request';
  if (/TRANSFER/.test(value)) return 'Transfer';
  if (/FINISHED|PIPE/.test(value)) return 'Finished Goods';
  if (/RECYCL/.test(value)) return 'Recycling';
  if (/ATTENDANCE|CLOCK IN|CLOCK OUT/.test(value)) return 'Attendance';
  if (/TURNOVER|\bSTO\b/.test(value)) return 'Shift Turnover';
  if (/BARCODE|PRINT/.test(value)) return 'Barcode';
  if (/INVENTORY|ADJUST/.test(value)) return 'Inventory Adjustment';
  if (/USER|ACCESS|LOGIN|EMPLOYEE/.test(value)) return 'User / Access';
  if (/PRODUCTION|OUTPUT/.test(value)) return 'Production';
  return 'Other';
}

export default function AuditLogs() {
  const { auditLogs } = useApp();
  const [type, setType] = useState('All');
  const [employeeRole, setEmployeeRole] = useState('All');
  const [action, setAction] = useState('All');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const period = usePeriod('month');

  const rows = useMemo(() => auditLogs.map(log => ({
    ...log,
    processType: processType(log.action, log.reference),
  })), [auditLogs]);
  const types = useMemo(() => Array.from(new Set(rows.map(row => row.processType))).sort(), [rows]);

  // Build combined Employee / Role options: individual employees + role groups
  const employeeRoleOptions = useMemo(() => {
    const employees = Array.from(new Set(rows.map(row => `${row.user} — ${row.role}`))).sort();
    const roles = Array.from(new Set(rows.map(row => `Role: ${row.role}`))).sort();
    return [...employees, ...roles];
  }, [rows]);

  const actions = useMemo(() => Array.from(new Set(rows.map(row => row.action))).sort(), [rows]);
  const filtered = rows.filter(row => {
    const query = search.trim().toLowerCase();
    const erMatch = employeeRole === 'All'
      || `${row.user} — ${row.role}` === employeeRole
      || `Role: ${row.role}` === employeeRole;
    return (type === 'All' || row.processType === type)
      && erMatch
      && (action === 'All' || row.action === action)
      && dateInPeriod(row.date, period.range)
      && (!query || [row.reference, row.user, row.employeeId, row.action, row.previousValue, row.newValue]
        .some(value => value?.toLowerCase().includes(query)));
  }).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const exportCSV = () => {
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Reporting Period', period.range.label],
      [],
      ['Date', 'Time', 'Employee', 'Employee ID', 'Role', 'Action', 'Process Type', 'Reference', 'Before', 'After'],
      ...filtered.map(row => [row.date, row.time, row.user, row.employeeId, row.role, row.action, row.processType, row.reference, row.previousValue, row.newValue]),
    ].map(values => values.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hpai-audit-${period.range.start}-to-${period.range.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-stack">
      <div className="category-panel-header">
        <p className="helper-text">Audit logs are automatically generated and read-only. Filters use the actual shared audit records.</p>
        <button className="btn-secondary" onClick={exportCSV}>Export CSV</button>
      </div>
      <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => setPage(1)} placeholder="Search reference, PO, MO, order, barcode, employee, or action..." />
      <div className="app-card detail-card">
        <div className="audit-filters-row">
          <label>Document / Process Type<select className="app-select" value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option>All</option>{types.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Employee / Role<select className="app-select" value={employeeRole} onChange={event => { setEmployeeRole(event.target.value); setPage(1); }}><option>All</option>{employeeRoleOptions.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Action<select className="app-select" value={action} onChange={event => { setAction(event.target.value); setPage(1); }}><option>All</option>{actions.map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
      </div>
      <div className="app-card table-scroll">
        <table className="app-table">
          <thead><tr><th>Date / Time</th><th>Employee</th><th>Role</th><th>Action</th><th>Process Type</th><th>Reference</th><th>Before / After</th></tr></thead>
          <tbody>{pageRecords(filtered, page).map(log => <tr key={log.id}>
            <td className="font-mono">{log.date} {log.time}</td>
            <td>{log.user}<div className="helper-text font-mono">{log.employeeId}</div></td>
            <td>{log.role}</td><td>{log.action}</td><td>{log.processType}</td>
            <td className="font-mono text-blue">{log.reference || '—'}</td>
            <td>{log.previousValue || log.newValue ? <><div>{log.previousValue || '—'}</div><div className="helper-text">→ {log.newValue || '—'}</div></> : '—'}</td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <div className="empty-state">NO AUDIT RECORDS MATCH THE SELECTED FILTERS</div>}
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>
    </div>
  );
}
