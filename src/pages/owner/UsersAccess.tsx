import React, { useState } from 'react';
import { USERS, useApp } from '../../store';
import { ConfirmModal } from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import Pagination, { pageRecords } from '../../components/Pagination';

const roleLabel = (role: string) => ({ OWNER_SUPER_ADMIN: 'Owner / Super Admin', accounting: 'Accounting', marketing: 'Marketing', management: 'Management', plantmanager: 'Plant Manager', production: 'Production' }[role] || role);

export default function UsersAccess() {
  const { employees, updateEmployee } = useApp();
  const [confirm, setConfirm] = useState<{ id: string; status: 'Active' | 'Inactive' } | null>(null);
  const [accountPage, setAccountPage] = useState(1);
  const [workforcePage, setWorkforcePage] = useState(1);
  return <div className="page-stack">
    <div className="page-intro"><div><span className="eyebrow">Super Admin only</span><h2>Users, Roles & Access</h2><p>Company user visibility, role assignment monitoring, account status, and protected access administration.</p></div><span className="badge-amber">High-impact actions require confirmation</span></div>
    <div className="app-card table-scroll">
      <div className="table-title">Primary system accounts</div>
      <table className="app-table"><thead><tr><th>Employee ID</th><th>User</th><th>Username</th><th>Role</th><th>Plant</th><th>Status</th><th>Last Login</th></tr></thead><tbody>
        {pageRecords(USERS, accountPage).map(user => <tr key={user.id}><td className="font-mono">{user.employeeId}</td><td>{user.name}</td><td className="font-mono">{user.username}</td><td>{roleLabel(user.role)}</td><td>{user.plant}</td><td><StatusBadge status={user.status === 'active' ? 'Active' : 'Inactive'} /></td><td>{user.lastLogin || 'Never'}</td></tr>)}
      </tbody></table>
      <Pagination page={accountPage} totalRecords={USERS.length} onPageChange={setAccountPage} />
    </div>
    <div className="app-card table-scroll">
      <div className="table-title">Branch Plant workforce accounts</div>
      <table className="app-table"><thead><tr><th>Employee ID</th><th>Name</th><th>Username</th><th>Role Assignment</th><th>Shift</th><th>Status</th><th data-actions>Access Action</th></tr></thead><tbody>
        {pageRecords(employees, workforcePage).map(employee => <tr key={employee.id}><td className="font-mono">{employee.employeeId}</td><td>{employee.firstName} {employee.lastName}</td><td className="font-mono">{employee.username}</td><td>{roleLabel(employee.role)}</td><td>{employee.defaultShift}</td><td><StatusBadge status={employee.status} /></td><td><button className={employee.status === 'Active' ? 'btn-danger btn-compact' : 'btn-success btn-compact'} onClick={() => setConfirm({ id: employee.id, status: employee.status === 'Active' ? 'Inactive' : 'Active' })}>{employee.status === 'Active' ? 'Deactivate' : 'Activate'}</button></td></tr>)}
      </tbody></table>
      <Pagination page={workforcePage} totalRecords={employees.length} onPageChange={setWorkforcePage} />
    </div>
    <div className="alert-warning"><strong>Protected administration:</strong> Password resets, role changes, and account deactivation must be confirmed and are recorded in the complete Audit Log. Password values are never displayed.</div>
    <ConfirmModal open={!!confirm} title="Confirm Access Change" message={`This will ${confirm?.status === 'Inactive' ? 'deactivate' : 'activate'} the selected account. The action will be written to the Audit Log.`} confirmLabel="Confirm Access Change" confirmClass={confirm?.status === 'Inactive' ? 'btn-danger' : 'btn-success'} onConfirm={() => { if (confirm) updateEmployee(confirm.id, { status: confirm.status }); setConfirm(null); }} onCancel={() => setConfirm(null)} />
  </div>;
}
