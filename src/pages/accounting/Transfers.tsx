import {
  withRecordSearch,
  useSearchableApp,
  useSearchPaginationReset,
} from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useState } from "react"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import CategoryTabs from "../../components/CategoryTabs"

import Pagination, { pageRecords } from '../../components/Pagination';

import { MATERIAL_REQUEST_CATEGORIES, requestCategory, transferCategory, type MaterialRequestCategory } from '../../inventoryCategories';

import DocumentViewer from "../../components/DocumentViewer"

import { transferDocument } from "../../documentPrint"

function Transfers() {
  const { transfers, materialRequests, createTransfer } = useSearchableApp()

  const [viewId, setViewId] = useState<string | null>(null)

  const [filter, setFilter] = useState("All")

  const [category, setCategory] = useState<'All' | MaterialRequestCategory>('All');

  const [showCreate, setShowCreate] = useState(false)

  const [requestId, setRequestId] = useState("")

  const [message, setMessage] = useState("")

  const [page, setPage] = useState(1)

  useSearchPaginationReset(setPage)

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  const statuses = ['All', 'Preparing', 'In Transit', 'Received'];

  const categoryTabs: readonly ('All' | MaterialRequestCategory)[] = ['All', ...MATERIAL_REQUEST_CATEGORIES];

  const filtered = transfers.filter(t => (filter === 'All' || t.status === filter) && (category === 'All' || transferCategory(t) === category));

  const viewTransfer = transfers.find((t) => t.id === viewId)

  const documentTransfer = transfers.find(t => t.id === documentAction?.id);

  if (viewId && viewTransfer)
    return (
      <div style={{ maxWidth: 580 }}>
        <div className="flex items-center gap-3 mb-4">
          <button className="btn-secondary" onClick={() => setViewId(null)}>Back</button>
          <button className="btn-secondary" onClick={() => setDocumentAction({ id: viewTransfer.id, autoPrint: false })}>View Document</button>
          <button className="btn-primary" onClick={() => setDocumentAction({ id: viewTransfer.id, autoPrint: true })}>Print</button>
          <h2 style={{ fontSize: 14, fontWeight: 700 }}>
            Transfer — {viewTransfer.refNo}
          </h2>
        </div>
        <DocumentViewer open={!!documentAction} document={documentTransfer ? transferDocument(documentTransfer) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
        <div className="app-card" style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
            ['Reference No.', viewTransfer.refNo],
            ['Date', viewTransfer.date],
            ['Material Category', transferCategory(viewTransfer)],
            [transferCategory(viewTransfer) === 'Colorant' ? 'Usage Type' : 'Material Grade', transferCategory(viewTransfer) === 'Colorant' ? (viewTransfer.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe Colorant' : 'Base Colorant') : viewTransfer.grade],
            ['Color', viewTransfer.color],
            ['Batch No.', viewTransfer.batchNo],
            ...(transferCategory(viewTransfer) === 'Colorant' ? [] : [['Number of Bags', viewTransfer.numberOfBags || Math.floor(viewTransfer.weightKg / 25)], ['Weight per Bag', '25 kg']]),
            ['Weight', `${viewTransfer.weightKg} kg`],
            ['Source', viewTransfer.source],
            ['Destination', viewTransfer.destination],
            ['Status', null],
            ...(viewTransfer.requestRef ? [['Request Reference', viewTransfer.requestRef]] : []),
            ...(viewTransfer.receivedBy ? [['Received By', viewTransfer.receivedBy], ['Received Date', viewTransfer.receivedDate || '']] : []),
          ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                  {label}
                </div>
                {label === "Status" ? (
                  <StatusBadge status={viewTransfer.status} />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {value}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )

  return (
    <div>
      <div className="mb-4">
        <CategoryTabs items={categoryTabs} value={category} onChange={v => { setCategory(v); setPage(1); }} label="Transfer material category" />
      </div>
      <div className="flex items-center justify-between mb-4 page-toolbar">
        <div className="report-tabs flex gap-1">
          {statuses.map((s) => (
            <button key={s} onClick={() => { setFilter(s); setPage(1); }} style={{
              padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: filter === s ? 600 : 400,
              background: filter === s ? 'var(--accent-blue)' : 'var(--card-bg)', color: filter === s ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${filter === s ? 'var(--accent-blue)' : 'var(--card-border)'}`,
            }}>
              {s}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>Create Transfer</button>
      </div>

      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>Ref No.</th>
              <th>Date</th>
              <th>Category</th>
              <th>Material</th>
              <th>Batch / Record</th>
              <th>Quantity</th>
              <th>Destination</th>
              <th>Status</th>
              <th data-actions>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords(filtered, page).map((t) => (
              <tr key={t.id} className="table-row-hover" onClick={() => setViewId(t.id)}>
                <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                  {t.refNo}
                </td>
                <td style={{ fontSize: 12 }}>{t.date}</td>
                <td>{transferCategory(t)}</td>
                <td style={{ fontSize: 12 }}>
                  {transferCategory(t) === 'Colorant' ? `${t.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe' : 'Base'} · ${t.color}` : t.grade}
                </td>
                <td className="font-mono" style={{ fontSize: 11 }}>
                  {t.batchNo}
                </td>
                <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                  {t.weightKg} kg
                </td>
                <td style={{ fontSize: 12 }}>{t.destination}</td>
                <td>
                  <StatusBadge status={t.status} size="sm" />
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="button-group">
                    <button className="btn-secondary btn-compact" onClick={() => setViewId(t.id)}>View Details</button>
                    <button className="btn-secondary btn-compact" onClick={() => setDocumentAction({ id: t.id, autoPrint: true })}>Print</button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="empty-state">No records match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>
      {showCreate && (
        <Modal open title="Create Transfer" onClose={() => setShowCreate(false)}>
          <div className="page-stack">
            <div className="alert-info">Approved pellet requests create individual 25 kg bag records. Approved colorant requests transfer a shared kg quantity without pellet barcodes.</div>
            <label>
              Approved Material Request
              <SearchableDropdown
                className="app-select" value={requestId} onChange={event => { setRequestId(event.target.value); setMessage(''); }}
              >
                <option value="">Select approved request</option>
                {materialRequests.filter(request => request.status === 'Approved').map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.refNo} · {requestCategory(request)} ·{" "}
                      {request.requestedKg} kg
                    </option>
                  ))}
              </SearchableDropdown>
            </label>
            {message && (
              <div className={message.startsWith('Created') ? 'alert-success' : 'alert-error'}>
                {message}
              </div>
            )}
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn-primary" disabled={!requestId} onClick={() => {
            const result = createTransfer(requestId);
            setMessage(result ? `Created or opened ${result}. The same transfer is visible to Plant Manager and Production.` : 'Transfer could not be created. Verify that the request is approved.');
          }}>Confirm</button>
            </div>
          </div>
        </Modal>
      )}
      <DocumentViewer open={!!documentAction} document={documentTransfer ? transferDocument(documentTransfer) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
    </div>
  )
}

export default withRecordSearch(Transfers, ["transfers"])
