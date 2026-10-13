import React, { useState } from 'react';
import { useApp } from '../../store';
import StatusBadge from '../../components/StatusBadge';
import { ConfirmModal } from '../../components/Modal';
import CategoryTabs from '../../components/CategoryTabs';
import Pagination, { pageRecords } from '../../components/Pagination';
import { MATERIAL_REQUEST_CATEGORIES, requestCategory, type MaterialRequestCategory } from '../../inventoryCategories';
import DocumentViewer from '../../components/DocumentViewer';
import { materialRequestDocument } from '../../documentPrint';

export default function BranchRequests() {
  const { materialRequests, approveMaterialRequest, rejectMaterialRequest } = useApp();
  const [filter, setFilter] = useState('All');
  const [category, setCategory] = useState<'All' | MaterialRequestCategory>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  const statuses = ['All', 'New', 'Pending', 'Approved', 'Rejected'];
  const categoryTabs: readonly ('All' | MaterialRequestCategory)[] = ['All', ...MATERIAL_REQUEST_CATEGORIES];
  const filtered = materialRequests.filter(r => (filter === 'All' || r.status === filter) && (category === 'All' || requestCategory(r) === category));
  const selected = materialRequests.find(r => r.id === selectedId);
  const viewReq = materialRequests.find(r => r.id === viewId);
  const documentRequest = materialRequests.find(r => r.id === documentAction?.id);

  if (viewId && viewReq) return (
    <div style={{ maxWidth: 620 }}>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn-secondary" onClick={() => setViewId(null)}>Back</button>
        <button className="btn-secondary" onClick={() => setDocumentAction({ id: viewReq.id, autoPrint: false })}>View Document</button>
        <button className="btn-primary" onClick={() => setDocumentAction({ id: viewReq.id, autoPrint: true })}>Print</button>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Material Request — {viewReq.refNo}</h2>
      </div>
      <div className="app-card" style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {[
            ['Request No.', viewReq.refNo],
            ['Date', viewReq.date],
            ['Requested By', viewReq.requestedBy],
            ['Material Category', requestCategory(viewReq)],
            [requestCategory(viewReq) === 'Colorant' ? 'Usage Type' : 'Material Grade', requestCategory(viewReq) === 'Colorant' ? (viewReq.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe Colorant' : 'Base Colorant') : viewReq.grade],
            [requestCategory(viewReq) === 'Colorant' ? 'Color' : 'Complete Bags', requestCategory(viewReq) === 'Colorant' ? viewReq.color : String(viewReq.requestedBags ?? viewReq.requestedKg / 25)],
            ['Requested Qty', `${viewReq.requestedKg} kg`],
            ['Status', null],
            ...(viewReq.moRef ? [['MO Reference', viewReq.moRef]] : []),
            ...(viewReq.poRef ? [['PO Reference', viewReq.poRef]] : []),
            ...(viewReq.approvedBy ? [['Reviewed By', viewReq.approvedBy], ['Review Date', viewReq.approvedDate || '']] : []),
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
              {label === 'Status' ? <StatusBadge status={viewReq.status} /> : <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>}
            </div>
          ))}
        </div>
        {(viewReq.status === 'New' || viewReq.status === 'Pending') && (
          <div className="pt-4 button-group" style={{ borderTop: '1px solid var(--card-border)' }}>
            <button className="btn-success" onClick={() => { setSelectedId(viewReq.id); setConfirmAction('approve'); }}>Approve Request</button>
            <button className="btn-danger" onClick={() => { setSelectedId(viewReq.id); setConfirmAction('reject'); }}>Reject Request</button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction === 'approve' ? 'Approve Material Request' : 'Reject Material Request'}
        message={`Are you sure you want to ${confirmAction} ${requestCategory(viewReq)} request ${viewReq.refNo} for ${viewReq.requestedKg} kg?`}
        confirmLabel={confirmAction === 'approve' ? 'Approve' : 'Reject'}
        confirmClass={confirmAction === 'approve' ? 'btn-success' : 'btn-danger'}
        onConfirm={() => {
          if (confirmAction === 'approve') approveMaterialRequest(viewReq.id);
          else rejectMaterialRequest(viewReq.id);
          setConfirmAction(null);
          setViewId(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <DocumentViewer open={!!documentAction} document={documentRequest ? materialRequestDocument(documentRequest) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <CategoryTabs items={categoryTabs} value={category} onChange={v => { setCategory(v); setPage(1); }} label="Material request category" />
      </div>
      {/* Filter tabs */}
      <div className="report-tabs flex gap-1 mb-4">
        {statuses.map(s => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); }} style={{
            padding: '5px 12px', borderRadius: 5, cursor: 'pointer',
            fontSize: 12, fontWeight: filter === s ? 600 : 400,
            background: filter === s ? 'var(--accent-blue)' : 'var(--card-bg)',
            color: filter === s ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${filter === s ? 'var(--accent-blue)' : 'var(--card-border)'}`,
          }}>{s} {s !== 'All' && <span style={{ opacity: 0.7 }}>({materialRequests.filter(r => r.status === s).length})</span>}</button>
        ))}
      </div>

      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>Request No.</th><th>Date</th><th>Category</th><th>Material</th><th>Qty</th><th>Requested By</th><th>Status</th><th data-actions>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRecords(filtered, page).map(req => (
              <tr key={req.id} className="table-row-hover" onClick={() => setViewId(req.id)}>
                <td className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>{req.refNo}</td>
                <td style={{ fontSize: 12 }}>{req.date}</td>
                <td>{requestCategory(req)}</td>
                <td style={{ fontSize: 12 }}>{requestCategory(req) === 'Colorant' ? `${req.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe' : 'Base'} · ${req.color}` : req.grade}</td>
                <td className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>{requestCategory(req) === 'Colorant' ? `${req.requestedKg} kg` : `${req.requestedBags ?? req.requestedKg / 25} bags · ${req.requestedKg} kg`}</td>
                <td style={{ fontSize: 12 }}>{req.requestedBy}</td>
                <td><StatusBadge status={req.status} size="sm" /></td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="button-group">
                    <button className="btn-secondary btn-compact" onClick={() => setViewId(req.id)}>View</button>
                    <button className="btn-secondary btn-compact" onClick={() => setDocumentAction({ id: req.id, autoPrint: true })}>Print</button>
                    {(req.status === 'New' || req.status === 'Pending') && (
                      <>
                        <button className="btn-success btn-compact" onClick={() => { setSelectedId(req.id); setConfirmAction('approve'); }}>Approve</button>
                        <button className="btn-danger btn-compact" onClick={() => { setSelectedId(req.id); setConfirmAction('reject'); }}>Reject</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={8} className="empty-state">No records match the selected filters.</td></tr>}
          </tbody>
        </table>
        <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} />
      </div>

      <ConfirmModal
        open={confirmAction !== null && viewId === null}
        title={confirmAction === 'approve' ? 'Approve Material Request' : 'Reject Material Request'}
        message={`Are you sure you want to ${confirmAction} request ${selected?.refNo}?`}
        confirmLabel={confirmAction === 'approve' ? 'Approve' : 'Reject'}
        confirmClass={confirmAction === 'approve' ? 'btn-success' : 'btn-danger'}
        onConfirm={() => {
          if (selectedId) {
            if (confirmAction === 'approve') approveMaterialRequest(selectedId);
            else rejectMaterialRequest(selectedId);
          }
          setConfirmAction(null); setSelectedId(null);
        }}
        onCancel={() => { setConfirmAction(null); setSelectedId(null); }}
      />
      <DocumentViewer open={!!documentAction} document={documentRequest ? materialRequestDocument(documentRequest) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
    </div>
  );
}
