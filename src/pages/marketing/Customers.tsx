import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useState, useMemo } from "react"

import { useApp } from "../../store"

import Modal from "../../components/Modal"

import Pagination, { pageRecords } from '../../components/Pagination';

export default function Customers() {
  const { customers, addCustomer } = useApp()

  const [viewId, setViewId] = useState<string | null>(null)

  const [showAdd, setShowAdd] = useState(false)

  const [error, setError] = useState("")

  const [search, setSearch] = useState("")

  const [status, setStatus] = useState("All")

  const [page, setPage] = useState(1)

  const [form, setForm] = useState({ name: '', code: '', contact: '', address: '', email: '' });

  const viewC = customers.find((c) => c.id === viewId)

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          (status === "All" || c.status === status) &&
          ((!search.trim() || [c.name, c.code, c.contact, c.address, c.email].some(v => v?.toLowerCase().includes(search.trim().toLowerCase()))) ||
              matchesRecord(c, search)),
      ),
    [customers, search, status],
  )

  const resetPage = () => setPage(1)

  const saveCustomer = () => {
    if (!form.name.trim() || !form.code.trim() || !form.contact.trim() || !form.address.trim()) {
      setError('Name, code, contact, and address are required.');
      return;
    }
    if (customers.some(customer => customer.code.toLowerCase() === form.code.trim().toLowerCase())) {
      setError('Customer code must be unique.');
      return;
    }
    addCustomer({ ...form, name: form.name.trim(), code: form.code.trim(), contact: form.contact.trim(), address: form.address.trim(), email: form.email.trim(), status: 'Active' });
    setForm({ name: '', code: '', contact: '', address: '', email: '' });
    setError('');
    setShowAdd(false);
  };

  return (
    <div className="page-stack">
      <div className="toolbar">
        <input className="app-input" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }} placeholder="Search customer name, code, contact, address…" />
        <label className="product-filter-field"><span className="field-label">Status</span><SearchableDropdown
          className="app-select" value={status} onChange={e => { setStatus(e.target.value); resetPage(); }}
        >
          <option>All</option>
          <option>Active</option>
          <option>Inactive</option>
        </SearchableDropdown></label>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>Add Customer</button>
      </div>
      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Customer Name</th>
              <th>Contact</th>
              <th>Address</th>
              <th>Email</th>
              <th>Status</th>
              <th data-actions>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords(filtered, page).map((c) => (
              <tr key={c.id} className="table-row-hover" onClick={() => setViewId(c.id)}>
                <td className="font-mono" style={{ fontSize: 11 }}>
                  {c.code}
                </td>
                <td style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</td>
                <td style={{ fontSize: 12 }}>{c.contact}</td>
                <td style={{ fontSize: 12 }}>{c.address}</td>
                <td style={{ fontSize: 12, color: "var(--accent-blue)" }}>
                  {c.email || "—"}
                </td>
                <td>
                  <span className={`badge-${c.status === 'Active' ? 'green' : 'gray'} px-2 py-0.5 text-[11px] rounded font-medium`}>
                    {c.status}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="btn-secondary btn-compact" onClick={() => setViewId(c.id)}>View</button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="empty-state">No records match the selected search or filters.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>
      {viewC && (
        <Modal open title={`Customer — ${viewC.name}`} onClose={() => setViewId(null)}>
          <dl className="form-grid">
            {Object.entries({ Code: viewC.code, Name: viewC.name, Contact: viewC.contact, Address: viewC.address, Email: viewC.email || '—', Status: viewC.status }).map(([label, value]) => (
              <div key={label}>
                <dt className="field-label">{label}</dt>
                <dd className="field-value">{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      {showAdd && (
        <Modal open title="Add Customer" onClose={() => setShowAdd(false)}>
          <div className="page-stack">
            {error && <div className="alert-error">{error}</div>}
            <div className="form-grid">
              {([
              ['name', 'Customer Name'], ['code', 'Customer Code'], ['contact', 'Contact Person'],
              ['address', 'Address'], ['email', 'Email'],
            ] as const).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input className="app-input" value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveCustomer}>Add Customer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
