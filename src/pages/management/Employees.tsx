import React, { useState } from 'react';
import { useApp } from '../../store';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import { ConfirmModal } from '../../components/Modal';
import Pagination, { pageRecords } from '../../components/Pagination';

export default function Employees() {
  const { employees, addEmployee, updateEmployee } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    firstName: '', lastName: '', username: '', role: 'production' as 'production' | 'plantmanager',
    defaultShift: 'Day' as 'Day' | 'Night' | 'Rotating' | 'Assign Later', status: 'Active' as 'Active' | 'Inactive',
  });

  const viewEmp = employees.find(e => e.id === viewId);
  const deactivateEmp = employees.find(e => e.id === deactivateId);

  const genPassword = () => `HPAI@${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  const openReset = (id: string) => {
    setResetId(id);
    setTemporaryPassword(genPassword());
  };

  const handleAdd = () => {
    if (!form.firstName || !form.lastName || !form.username) return;
    const idPrefix = form.role === 'production' ? 'BP-PRD' : 'BP-PM';
    const next = employees.filter(e => e.role === form.role).length + 1;
    addEmployee({
      employeeId: `${idPrefix}-${String(next + 4).padStart(3, '0')}`,
      firstName: form.firstName,
      lastName: form.lastName,
      username: form.username,
      role: form.role,
      plant: 'Branch Plant',
      defaultShift: form.defaultShift,
      status: form.status,
    });
    setShowAdd(false);
    setForm({ firstName: '', lastName: '', username: '', role: 'production', defaultShift: 'Day', status: 'Active' });
  };

  const F = (l: string, v: string) => (
    <div key={l}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{l}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{v}</div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 page-actions">
        <button className="btn-primary" onClick={() => setShowAdd(true)}>Add Employee</button>
      </div>

      <div className="app-card" style={{ overflow: 'hidden' }}>
        <table className="app-table">
          <thead>
            <tr><th>Employee ID</th><th>Name</th><th>Role</th><th>Shift</th><th>Status</th><th>Last Login</th><th data-actions>Actions</th></tr>
          </thead>
          <tbody>
            {pageRecords(employees, page).map(emp => (
              <tr key={emp.id} className="table-row-hover" onClick={() => setViewId(emp.id)}>
                <td className="font-mono" style={{ fontSize: 11 }}>{emp.employeeId}</td>
                <td style={{ fontSize: 13, fontWeight: 500 }}>{emp.firstName} {emp.lastName}</td>
                <td><span className={`badge-${emp.role === 'plantmanager' ? 'blue' : 'gray'} px-2 py-0.5 text-[11px] rounded font-medium`}>{emp.role === 'plantmanager' ? 'Plant Manager' : 'Production'}</span></td>
                <td style={{ fontSize: 12 }}>{emp.defaultShift}</td>
                <td><StatusBadge status={emp.status === 'Active' ? 'Active' : 'Inactive'} size="sm" /></td>
                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.lastLogin || 'Never'}</td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="button-group">
                    <button className="btn-secondary btn-compact" onClick={() => setViewId(emp.id)}>View</button>
                    <button className="btn-secondary btn-compact" onClick={() => setViewId(emp.id)}>Edit</button>
                    <button className="btn-warning btn-compact" onClick={() => openReset(emp.id)}>Reset Password</button>
                    {emp.status === 'Active' && <button className="btn-danger btn-compact" onClick={() => setDeactivateId(emp.id)}>Deactivate</button>}
                    {emp.status === 'Inactive' && <button className="btn-success btn-compact" onClick={() => updateEmployee(emp.id, { status: 'Active' })}>Activate</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} totalRecords={employees.length} onPageChange={setPage} />
      </div>

      {/* View modal */}
      {viewId && viewEmp && (
        <Modal open title={`Employee — ${viewEmp.employeeId}`} onClose={() => setViewId(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {F('Employee ID', viewEmp.employeeId)}
            {F('Full Name', `${viewEmp.firstName} ${viewEmp.lastName}`)}
            {F('Username', viewEmp.username)}
            {F('Role', viewEmp.role === 'plantmanager' ? 'Plant Manager' : 'Production')}
            {F('Plant', viewEmp.plant)}
            {F('Default Shift', viewEmp.defaultShift)}
            {F('Status', viewEmp.status)}
            {F('Last Login', viewEmp.lastLogin || 'Never')}
          </div>
          <div className="mt-4 form-actions">
            <button className="btn-secondary" onClick={() => setViewId(null)}>Close</button>
            <button className="btn-secondary">Edit</button>
            <button className="btn-warning">Reset Password</button>
          </div>
        </Modal>
      )}

      {/* Add Employee modal */}
      <Modal open={showAdd} title="Add Employee" onClose={() => setShowAdd(false)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Employee ID</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Auto-generated upon creation</div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>First Name <span style={{ color: '#dc2626' }}>*</span></label>
            <input className="app-input" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Last Name <span style={{ color: '#dc2626' }}>*</span></label>
            <input className="app-input" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Username <span style={{ color: '#dc2626' }}>*</span></label>
            <input className="app-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Temporary Password</label>
            <div className="flex gap-1">
              <input className="app-input" value={genPassword()} readOnly style={{ flex: 1, fontSize: 11 }} />
              <button className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>Generate Password</button>
            </div>
          </div>
          <div style={{ gridColumn: '1/-1', fontSize: 11, color: 'var(--text-muted)', background: 'rgba(37,99,235,0.05)', padding: '6px 10px', borderRadius: 5 }}>Plant: <strong>Branch Plant</strong></div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Role</label>
            <select className="app-select" style={{ width: '100%' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
              <option value="production">Production</option>
              <option value="plantmanager">Plant Manager</option>
            </select>
          </div>
          {form.role === 'production' && (
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Default Shift</label>
              <select className="app-select" style={{ width: '100%' }} value={form.defaultShift} onChange={e => setForm(f => ({ ...f, defaultShift: e.target.value as any }))}>
                <option value="Day">Day</option>
                <option value="Night">Night</option>
                <option value="Rotating">Rotating</option>
                <option value="Assign Later">Assign Later</option>
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Status</label>
            <select className="app-select" style={{ width: '100%' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleAdd}>Add Employee</button>
        </div>
      </Modal>

      <ConfirmModal
        open={deactivateId !== null}
        title="Deactivate Employee"
        message={`Are you sure you want to deactivate ${deactivateEmp?.firstName} ${deactivateEmp?.lastName}? Their attendance, production records, and audit logs will be preserved.`}
        confirmLabel="Deactivate"
        confirmClass="btn-danger"
        onConfirm={() => {
          if (deactivateId) updateEmployee(deactivateId, { status: 'Inactive' });
          setDeactivateId(null);
        }}
        onCancel={() => setDeactivateId(null)}
      />
      {resetId && <Modal open title="Reset Password" onClose={() => setResetId(null)}>
        <div className="page-stack">
          <div className="alert-warning">A temporary password has been generated. The employee's existing password is never displayed.</div>
          <label>Temporary Password<div className="input-action"><input className="app-input font-mono" readOnly value={temporaryPassword} /><button className="btn-secondary" onClick={() => navigator.clipboard?.writeText(temporaryPassword)}>Copy Password</button></div></label>
          <div className="responsive-grid"><div><div className="field-label">Password Status</div><div className="field-value">Temporary · Change required at next sign-in</div></div></div>
          <div className="form-actions"><button className="btn-secondary" onClick={() => setResetId(null)}>Cancel</button><button className="btn-warning" onClick={() => setResetId(null)}>Confirm Reset</button></div>
        </div>
      </Modal>}
    </div>
  );
}
