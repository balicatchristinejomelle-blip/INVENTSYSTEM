import { withPrintSearch } from '../../printableRecords';
import DocumentPrintButton from '../../components/DocumentPrintButton';
import RecordRows from "../../components/RecordRows"

import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useMemo, useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import Pagination, { pageRecords } from '../../components/Pagination';

import { MATERIAL_GRADES } from "../../inventoryCategories"

import DocumentViewer from "../../components/DocumentViewer"

import { receivingReportDocument } from '../../documentPrint';

export default function RRRecords() {
  const app = useApp();
  const { rrRecords, pellets, createReceivingReport } = app;

  const [viewId, setViewId] = useState<string | null>(null)

  const [showNew, setShowNew] = useState(false)

  const [search, setSearch] = useState("")

  const [pelletTypeFilter, setPelletTypeFilter] = useState('All');

  const [page, setPage] = useState(1)

  const [form, setForm] = useState({
    pelletType: 'Virgin' as 'Virgin' | 'Recycled',
    grade: 'PE100',
    color: 'Black (BK)',
    numberOfBags: '5',
    supplier: '',
    referenceNo: '',
    destination: 'Branch Plant Warehouse',
    remarks: '',
  });

  const [formError, setFormError] = useState("")

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  const viewRR = rrRecords.find((r) => r.id === viewId)

  const documentRR = rrRecords.find(r => r.id === documentAction?.id);

  const viewPellets = pellets.filter(p => p.batchNo === viewRR?.batchNo);

  const filtered = useMemo(
    () =>
      rrRecords.filter(
        (rr) =>
          (pelletTypeFilter === 'All' || rr.pelletType === pelletTypeFilter) &&
          ((!search.trim() || [rr.rrNumber, rr.supplier, rr.grade, rr.batchNo, rr.referenceNo, rr.destination].some(v => (v || '').toLowerCase().includes(search.trim().toLowerCase()))) ||
              matchesRecord(withPrintSearch(app, rr), search)),
      ),
    [rrRecords, search, pelletTypeFilter, app.printMetadata, app.reprintRequests],
  )

  const submitRR = () => {
    const numberOfBags = Number(form.numberOfBags);
    if (!Number.isInteger(numberOfBags) || numberOfBags < 1 || !form.supplier.trim() || !form.referenceNo.trim()) {
      setFormError('Enter a whole number of bags, supplier, and reference number.');
      return;
    }
    createReceivingReport({
      ...form,
      numberOfBags,
      supplier: form.supplier.trim(),
      referenceNo: form.referenceNo.trim(),
      remarks: form.remarks.trim() || undefined,
    });
    setShowNew(false);
    setFormError('');
  };

  if (viewId && viewRR)
    return (
      <div style={{ maxWidth: 600 }}>
        <div className="flex items-center gap-3 mb-4">
          <button className="btn-secondary" onClick={() => setViewId(null)}>Back</button>
          <button className="btn-secondary" onClick={() => setDocumentAction({ id: viewRR.id, autoPrint: false })}>View Document</button>
          <DocumentPrintButton className="btn-primary" recordId={viewRR.id} recordType="RECEIVING REPORT" onClick={() => setDocumentAction({ id: viewRR.id, autoPrint: true })} />
          <h2 style={{ fontSize: 14, fontWeight: 700 }}>
            RR Record — {viewRR.rrNumber}
          </h2>
        </div>
        <div className="page-stack">
          {viewPellets.length > 0 && (
            <div className="app-card detail-card">
              <div className="section-title">Branch Barcode Status</div>
              <div className="field-value">
                Automatically assigned to all{" "}
                {viewRR.numberOfBags || viewRR.weightKg / 25} physical bags
              </div>
              <div className="helper-text">The system creates each permanent barcode with the physical bag record. Plant Manager handles label printing at the Branch Plant.</div>
            </div>
          )}
          {viewPellets.length > 0 && (
            <div className="app-card table-scroll">
              <div className="table-title">Physical Bag Locations</div>
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Physical Bag</th>
                    <th>Barcode</th>
                    <th>Weight</th>
                    <th>Current Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {
                    <RecordRows
                      records={viewPellets}
                      render={(item) => (
                        <tr key={item.id}>
                          <td>{item.bagNo}</td>
                          <td className="font-mono">{item.barcode}</td>
                          <td>25 kg</td>
                          <td>{item.currentLocation || "Not Yet Assigned"}</td>
                          <td>
                            <StatusBadge status={item.locationStatus} />
                          </td>
                        </tr>
                      )}
                    />
                  }
                </tbody>
              </table>
            </div>
          )}
          <div className="app-card" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['RR Number', viewRR.rrNumber], ['Date', viewRR.date], ['Material', viewRR.material], ['Pellet Type', viewRR.pelletType], ['Grade', viewRR.grade], ['Color', viewRR.color], ['Batch/Lot No.', viewRR.batchNo], ['Number of Bags', viewRR.numberOfBags || viewRR.weightKg / 25], ['Weight per Bag', `${viewRR.weightPerBagKg || 25} kg`], ['Total Weight', `${viewRR.weightKg} kg`], ['Supplier/Vendor', viewRR.supplier], ['Reference No.', viewRR.referenceNo], ['Destination', viewRR.destination], ['Status', null]].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                    {label}
                  </div>
                  {label === "Status" ? (
                    <StatusBadge status={viewRR.status} />
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {value}
                    </div>
                  )}
                </div>
              ))}
              {viewRR.remarks && (
                <div style={{ gridColumn: "1/-1" }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Remarks</div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    {viewRR.remarks}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <DocumentViewer open={!!documentAction} document={documentRR ? receivingReportDocument(documentRR) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
      </div>
    )

  return (
    <div className="page-stack">
      <div className="toolbar">
        <input className="app-input" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search RR number, supplier, grade, batch, reference…" />
        <SearchableDropdown
          className="app-select" value={pelletTypeFilter} onChange={e => { setPelletTypeFilter(e.target.value); setPage(1); }}
        >
          <option>All</option>
          <option>Virgin</option>
          <option>Recycled</option>
        </SearchableDropdown>
        <button className="btn-primary" onClick={() => setShowNew(true)}>New RR</button>
      </div>
      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>RR Number</th>
              <th>Date</th>
              <th>Pellet Type</th>
              <th>Grade</th>
              <th>Weight</th>
              <th>Supplier</th>
              <th>Destination</th>
              <th>Status</th>
              <th data-actions>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords(filtered, page).map((rr) => (
              <tr key={rr.id} className="table-row-hover" onClick={() => setViewId(rr.id)}>
                <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                  {rr.rrNumber}
                </td>
                <td style={{ fontSize: 12 }}>{rr.date}</td>
                <td>
                  <span className={`${rr.pelletType === 'Virgin' ? 'badge-blue' : 'badge-purple'} px-2 py-0.5 text-[11px] rounded font-medium`}>
                    {rr.pelletType}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{rr.grade}</td>
                <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                  {rr.weightKg} kg
                </td>
                <td style={{ fontSize: 12 }}>{rr.supplier}</td>
                <td style={{ fontSize: 12 }}>{rr.destination}</td>
                <td>
                  <StatusBadge status={rr.status} size="sm" />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="button-group">
                    <button className="btn-secondary btn-compact" onClick={() => setViewId(rr.id)}>View Details</button>
                    <DocumentPrintButton className="btn-secondary btn-compact" recordId={rr.id} recordType="RECEIVING REPORT" onClick={() => setDocumentAction({ id: rr.id, autoPrint: true })} />
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="empty-state">No records match the selected search or filters.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>
      <DocumentViewer open={!!documentAction} document={documentRR ? receivingReportDocument(documentRR) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
      <Modal open={showNew} title="New Receiving Report" onClose={() => setShowNew(false)} width="620px">
        <div className="page-stack">
          <div className="alert-info">
            <strong>Automatic physical bag registration</strong>
            <div>Each bag is fixed at 25 kg. Saving this RR creates one inventory record and one permanent Code 128 barcode per bag.</div>
          </div>
          <div className="form-grid">
            <label>
              Pellet Type
              <SearchableDropdown
                className="app-select" value={form.pelletType} onChange={e => setForm({ ...form, pelletType: e.target.value as 'Virgin' | 'Recycled' })}
              >
                <option>Virgin</option>
                <option>Recycled</option>
              </SearchableDropdown>
            </label>
            <label>
              Grade
              <SearchableDropdown
                className="app-select" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}
              >
                {MATERIAL_GRADES.map(item => <option key={item}>{item}</option>)}
              </SearchableDropdown>
            </label>
            <label>
              Color
              <input className="app-input" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </label>
            <label>
              Number of 25 kg Bags
              <input className="app-input" type="number" min="1" step="1" value={form.numberOfBags} onChange={e => setForm({ ...form, numberOfBags: e.target.value })} />
            </label>
            <label>
              Supplier
              <input className="app-input" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
            </label>
            <label>
              Supplier Reference
              <input className="app-input" value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} />
            </label>
            <label>
              Destination
              <input className="app-input" value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
            </label>
            <label>
              Remarks
              <input className="app-input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
            </label>
          </div>
          <div className="app-card detail-card">
            <div className="field-label">Physical inventory to create</div>
            <div className="field-value">
              {Math.max(0, Number(form.numberOfBags) || 0)} bags ·{" "}
              {Math.max(0, Number(form.numberOfBags) || 0) * 25} kg · one unique
              barcode per bag
            </div>
          </div>
          {formError && <div className="alert-error">{formError}</div>}
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn-primary" onClick={submitRR}>Save RR & Create Bags</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
