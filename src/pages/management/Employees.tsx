import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useMemo, useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import { ConfirmModal } from "../../components/Modal"

import Pagination, { pageRecords } from '../../components/Pagination';

type Shift = "Day" | "Night"

export default function Employees() {
  const { employees, attendance, assignEmployeeShift } = useApp();

  const [search, setSearch] = useState("")

  const [shiftFilter, setShiftFilter] = useState<'All' | Shift>('All');

  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('Active');

  const [page, setPage] = useState(1)

  const [pending, setPending] = useState<{ id: string; shift: Shift } | null>(null);

  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const productionEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()

    return employees
      .filter(employee => employee.role === 'production')
      .filter(employee => statusFilter === 'All' || employee.status === statusFilter)
      .filter(employee => shiftFilter === 'All' || employee.defaultShift === shiftFilter)
      .filter(
        (employee) =>
          !query || [
        employee.employeeId,
        employee.firstName,
        employee.lastName,
        employee.username,
        employee.defaultShift,
      ].some(value => value.toLowerCase().includes(query)) ||
            matchesRecord(employee, query),
      )

      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
      )
  }, [employees, search, shiftFilter, statusFilter])

  const pendingEmployee = employees.find(employee => employee.id === pending?.id);

  const activeAttendanceFor = (employeeId: string) =>
    attendance.find(record => record.employeeId === employeeId && record.status === 'Active');

  const resetPage = () => setPage(1)

  return (
    <div className="page-stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Management oversight</span>
          <h2>Attendance &amp; Shift Assignment</h2>
          <p>Assign active Production employees to Day or Night Shift. Production employees cannot change their own assignment.</p>
        </div>
        <span className="badge-blue">Management controlled</span>
      </div>

      {feedback && (
        <div className={feedback.kind === 'success' ? 'alert-success' : 'alert-error'}>
          {feedback.message}
        </div>
      )}

      <div className="filter-panel">
        <div className="filter-row">
          <input
            className="app-input"
            value={search}
            onChange={event => { setSearch(event.target.value); resetPage(); }}
            placeholder="Search employee name, ID, username, or shift..."
          />
          <label className="product-filter-field"><span className="field-label">Shift</span><SearchableDropdown
            className="app-select" value={shiftFilter} onChange={event => { setShiftFilter(event.target.value as typeof shiftFilter); resetPage(); }}
          >
            <option value="All">All Shifts</option>
            <option value="Day">Day Shift</option>
            <option value="Night">Night Shift</option>
          </SearchableDropdown></label>
          <label className="product-filter-field"><span className="field-label">Status</span><SearchableDropdown
            className="app-select" value={statusFilter} onChange={event => { setStatusFilter(event.target.value as typeof statusFilter); resetPage(); }}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </SearchableDropdown></label>
        </div>
      </div>

      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Employee ID</th>
              <th>Current Shift</th>
              <th>Attendance</th>
              <th>Status</th>
              <th data-actions>New Shift</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords(productionEmployees, page).map((employee) => {
              const activeAttendance = activeAttendanceFor(employee.employeeId);

              const currentShift = employee.defaultShift === 'Day' || employee.defaultShift === 'Night' ? employee.defaultShift : null;

              const newShift: Shift = currentShift === 'Day' ? 'Night' : 'Day';

              return (
                <tr key={employee.id}>
                  <td>
                    <strong>
                      {employee.firstName} {employee.lastName}
                    </strong>
                    <div className="helper-text font-mono">
                      {employee.username}
                    </div>
                  </td>
                  <td className="font-mono">{employee.employeeId}</td>
                  <td>
                    {currentShift ? <StatusBadge status={`${currentShift} Shift`} /> : <StatusBadge status="Not Assigned" />}
                  </td>
                  <td>
                    {activeAttendance ? (
                      <>
                        <StatusBadge status="Clocked In" />
                        <div className="helper-text">
                          {activeAttendance.shift} Shift ·{" "}
                          {activeAttendance.clockIn}
                        </div>
                      </>
                    ) : (
                      <StatusBadge status="Clocked Out" />
                    )}
                  </td>
                  <td>
                    <StatusBadge status={employee.status} />
                  </td>
                  <td>
                    <button
                      className="btn-secondary btn-compact"
                      disabled={employee.status !== 'Active'}
                      title={employee.status !== 'Active' ? 'Only active Production employees may receive a shift assignment.' : `Assign ${newShift} Shift`}
                      onClick={() => { setPending({ id: employee.id, shift: newShift }); setFeedback(null); }}
                    >
                      Assign {newShift} Shift
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!productionEmployees.length && (
          <div className="empty-state empty-state-action">
            <strong>NO RECORDS FOUND</strong>
            <span>No Production employees match the selected search or filters.</span>
            <button className="btn-secondary btn-compact" onClick={() => { setSearch(''); setShiftFilter('All'); setStatusFilter('Active'); setPage(1); }}>Clear Filters</button>
          </div>
        )}
        <Pagination page={page} totalRecords={productionEmployees.length} onPageChange={setPage} noun="employees" />
      </div>

      <ConfirmModal
        open={!!pending && !!pendingEmployee}
        title="Confirm Employee Shift Change"
        message={pendingEmployee && pending
          ? `${pendingEmployee.firstName} ${pendingEmployee.lastName} (${pendingEmployee.employeeId}) will change from ${pendingEmployee.defaultShift} Shift to ${pending.shift} Shift. This action will be written to the Audit Log.`
          : 'Confirm this shift assignment?'}
        confirmLabel="Confirm Shift Change"
        confirmClass="btn-primary"
        onConfirm={() => {
          if (!pending) return;
          const result = assignEmployeeShift(pending.id, pending.shift);
          setFeedback({
            kind: result.success ? 'success' : 'error',
            message: result.success ? 'Employee shift changed successfully.' : (result.error || 'Shift assignment could not be saved.'),
          });
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}
