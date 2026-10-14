import DocumentPrintButton from '../../components/DocumentPrintButton';
import RecordRows from "../../components/RecordRows"

import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useState } from "react"

import StatusBadge from "../../components/StatusBadge"

import Modal, { ConfirmModal } from "../../components/Modal"

import CategoryTabs from "../../components/CategoryTabs"

import { MATERIAL_REQUEST_CATEGORIES, transferCategory, type MaterialRequestCategory } from '../../inventoryCategories';

import DocumentViewer from "../../components/DocumentViewer"

import { transferDocument } from "../../documentPrint"

type FilterTab = 'All' | 'Preparing' | 'In Transit' | 'Receiving Discrepancy' | 'Received';

function IncomingTransfers() {
  const { transfers, confirmTransferReceipt } = useSearchableApp()

  const [tab, setTab] = useState<FilterTab>("All")

  const [category, setCategory] = useState<'All' | MaterialRequestCategory>('All');

  const [viewId, setViewId] = useState<string | null>(null)

  const [confirmAcceptId, setConfirmAcceptId] = useState<string | null>(null);

  const [receivedQuantity, setReceivedQuantity] = useState("")

  const [discrepancyReason, setDiscrepancyReason] = useState<'Missing' | 'Damaged' | 'Wrong Item' | 'Quantity Error' | 'Other' | ''>('');

  const [discrepancyNotes, setDiscrepancyNotes] = useState("")

  const [receiptError, setReceiptError] = useState("")

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  const tabs: FilterTab[] = ['All', 'Preparing', 'In Transit', 'Receiving Discrepancy', 'Received'];

  const inTransitCount = transfers.filter(t => t.status === 'In Transit').length;

  const categoryTabs: readonly ('All' | MaterialRequestCategory)[] = ['All', ...MATERIAL_REQUEST_CATEGORIES];

  const filtered = transfers.filter(t => (tab === 'All' || t.status === tab) && (category === 'All' || transferCategory(t) === category));

  const detail = transfers.find((t) => t.id === viewId)

  const documentTransfer = transfers.find(t => t.id === documentAction?.id);

  const handleAccept = () => {
    if (confirmAcceptId) {
      const transfer = transfers.find(item => item.id === confirmAcceptId);
      const isColorant = !!transfer && transferCategory(transfer) === 'Colorant';
      const quantity = receivedQuantity === '' ? (transfer?.sentQuantity ?? (isColorant ? transfer?.weightKg : transfer?.numberOfBags) ?? 0) : Number(receivedQuantity);
      const result = confirmTransferReceipt(confirmAcceptId, quantity, discrepancyReason || undefined, discrepancyNotes);
      if (!result.success) {
        setReceiptError(result.error || 'Receipt could not be saved.');
        return;
      }
      setConfirmAcceptId(null);
      setViewId(null);
      setReceivedQuantity('');
      setDiscrepancyReason('');
      setDiscrepancyNotes('');
      setReceiptError('');
    }
  };

  const getEffectiveStatus = (t: typeof transfers[0]) => t.status;

  return (
    <div>
      <div className="mb-4">
        <CategoryTabs items={categoryTabs} value={category} onChange={setCategory} label="Incoming transfer category" />
      </div>
      {/* In Transit Alert */}
      {inTransitCount > 0 && (
        <div className="alert-warning" style={{ marginBottom: 16, fontSize: 12 }}>
          <strong>
            {inTransitCount} transfer{inTransitCount > 1 ? "s" : ""} In Transit
          </strong>{" "}
          — expecting delivery at Branch Plant. Review and accept upon receipt.
        </div>
      )}

      <div className="app-card" style={{ overflow: "hidden" }}>
        {/* Filter Tabs */}
        <div className="report-tabs" style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1px solid var(--card-border)' }}>
          {tabs.map(t => {
            const count = t === 'All' ? transfers.length : transfers.filter(x => x.status === t).length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '10px 18px',
                  fontSize: 12,
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t}
                <span style={{ marginLeft: 5, fontSize: 10, background: tab === t ? 'var(--accent-blue)' : 'var(--card-border)', color: tab === t ? '#fff' : 'var(--text-muted)', borderRadius: 8, padding: '1px 5px', fontFamily: 'JetBrains Mono, monospace' }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No transfers found for this filter.</div>
        ) : (
          <table className="app-table">
            <thead>
              <tr>
                <th>Transfer No.</th>
                <th>Date</th>
                <th>Material</th>
                <th>Grade</th>
                <th>Color</th>
                <th>Batch No.</th>
                <th>Weight (kg)</th>
                <th>From</th>
                <th>Status</th>
                <th data-actions>Actions</th>
              </tr>
            </thead>
            <tbody>
              {
                <RecordRows
                  records={filtered}
                  render={(t) => {
                    const effectiveStatus = getEffectiveStatus(t)

                    return (
                      <tr key={t.id} className="table-row-hover" onClick={() => setViewId(t.id)}>
                        <td>
                          <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                            {t.refNo}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{t.date}</td>
                        <td style={{ fontSize: 12 }}>{transferCategory(t)}</td>
                        <td style={{ fontSize: 12 }}>{t.grade}</td>
                        <td style={{ fontSize: 12 }}>{t.color}</td>
                        <td>
                          <span className="font-mono" style={{ fontSize: 11 }}>
                            {t.batchNo}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>
                            {t.weightKg.toFixed(1)}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>{t.source}</td>
                        <td>
                      <StatusBadge status={effectiveStatus} size="sm" />
                    </td>
                        <td onClick={e => e.stopPropagation()}>
                      <div className="button-group">
                        <button
                          className="btn-secondary btn-compact"
                          onClick={() => setViewId(t.id)}
                        >
                          View
                        </button>
                        <DocumentPrintButton className="btn-secondary btn-compact" recordId={t.id} recordType="MATERIAL TRANSFER" onClick={() => setDocumentAction({ id: t.id, autoPrint: true })} />
                        {effectiveStatus === 'In Transit' && (
                          <button
                            className="btn-success btn-compact"
                            onClick={() => setConfirmAcceptId(t.id)}
                          >
                            Confirm Receipt
                          </button>
                        )}
                      </div>
                    </td>
                      </tr>
                    )
                  }}
                />
              }
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <Modal open title={`Transfer — ${detail.refNo}`} onClose={() => setViewId(null)} width="540px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            {([
              ['Transfer No.', detail.refNo],
              ['Date', detail.date],
              ['Material Category', transferCategory(detail)],
              [transferCategory(detail) === 'Colorant' ? 'Usage Type' : 'Grade', transferCategory(detail) === 'Colorant' ? (detail.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe Colorant' : 'Base Colorant') : detail.grade],
              ['Color', detail.color],
              ['Batch No.', detail.batchNo],
              ['Source', detail.source],
              ['Destination', detail.destination],
              ['Request Ref', detail.requestRef || '—'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                  {label}
                </div>
                <div className="font-mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {value}
                </div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Status</div>
              <StatusBadge status={getEffectiveStatus(detail)} />
            </div>
            <div>
              <div className="field-label">
                Sent {transferCategory(detail) === "Colorant" ? "kg" : "Bags"}
              </div>
              <div className="field-value">
                {detail.sentQuantity ?? (transferCategory(detail) === 'Colorant' ? detail.weightKg : detail.numberOfBags) ?? 0}
              </div>
            </div>
            <div>
              <div className="field-label">
                Received{" "}
                {transferCategory(detail) === "Colorant" ? "kg" : "Bags"}
              </div>
              <div className="field-value">{detail.receivedQuantity ?? 0}</div>
            </div>
            <div>
              <div className="field-label">
                Discrepancy{" "}
                {transferCategory(detail) === "Colorant" ? "kg" : "Bags"}
              </div>
              <div className="field-value">
                {detail.discrepancyQuantity ?? 0}
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 18, padding: '12px 14px', background: 'var(--app-bg)', borderRadius: 6, border: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Weight</div>
            <div className="font-mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent-blue)' }}>
              {detail.weightKg.toFixed(1)} kg
            </div>
          </div>

          {(detail.receivedBy || detail.receivedDate) && (
            <div style={{ marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {detail.receivedBy && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Received By</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {detail.receivedBy}
                  </div>
                </div>
              )}
              {detail.receivedDate && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Received Date</div>
                  <div className="font-mono" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {detail.receivedDate}
                  </div>
                </div>
              )}
            </div>
          )}

          {getEffectiveStatus(detail) === "In Transit" && (
            <>
              <div className="alert-warning" style={{ marginBottom: 16, fontSize: 12 }}>
                Enter the{" "}
                {transferCategory(detail) === 'Colorant' ? 'colorant kg quantity' : 'physical bags'}{" "}
                received. A quantity below Sent creates a Receiving Discrepancy.
              </div>
              <div className="form-grid mb-3">
                <label>
                  Received{" "}
                  {transferCategory(detail) === 'Colorant' ? 'Quantity (kg)' : 'Bags'}
                  <input className="app-input" type="number" min="0" step={transferCategory(detail) === 'Colorant' ? '0.001' : '1'} max={detail.sentQuantity ?? (transferCategory(detail) === 'Colorant' ? detail.weightKg : detail.numberOfBags) ?? 0} value={receivedQuantity} onChange={event => setReceivedQuantity(event.target.value)} placeholder={String(detail.sentQuantity ?? (transferCategory(detail) === 'Colorant' ? detail.weightKg : detail.numberOfBags) ?? 0)} />
                </label>
                <label>
                  Discrepancy Reason
                  <SearchableDropdown
                    className="app-select" value={discrepancyReason} onChange={event => setDiscrepancyReason(event.target.value as typeof discrepancyReason)}
                  >
                    <option value="">Not required for full receipt</option>
                    {['Missing', 'Damaged', 'Wrong Item', 'Quantity Error', 'Other'].map(reason => <option key={reason}>{reason}</option>)}
                  </SearchableDropdown>
                </label>
              </div>
              <label className="block-label mb-3">Notes
                <textarea className="app-input" rows={2} value={discrepancyNotes} onChange={event => setDiscrepancyNotes(event.target.value)} />
              </label>
              {receiptError && <div className="alert-error mb-3">{receiptError}</div>}
            </>
          )}

          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setDocumentAction({ id: detail.id, autoPrint: false })}>View Document</button>
            <DocumentPrintButton className="btn-primary" recordId={detail.id} recordType="MATERIAL TRANSFER" onClick={() => setDocumentAction({ id: detail.id, autoPrint: true })} />
            <button className="btn-secondary" onClick={() => setViewId(null)}>Close</button>
            {getEffectiveStatus(detail) === 'In Transit' && (
              <button
                className="btn-success"
                onClick={() => {
                  setViewId(null);
                  setConfirmAcceptId(detail.id);
                }}
              >
                Confirm Receipt
              </button>
            )}
          </div>
        </Modal>
      )}
      <DocumentViewer open={!!documentAction} document={documentTransfer ? transferDocument(documentTransfer) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />

      {/* Accept Confirmation Modal */}
      <ConfirmModal
        open={!!confirmAcceptId}
        title="Accept Transfer"
        message={(() => {
          const t = transfers.find(x => x.id === confirmAcceptId);
          return t
            ? `Confirm the received quantity for ${t.refNo}. A short receipt remains a discrepancy and does not silently change the sent quantity.${receiptError ? `\n\n${receiptError}` : ''}`
            : 'Confirm receipt of this transfer?';
        })()}
        confirmLabel="Accept Transfer"
        confirmClass="btn-success"
        onConfirm={handleAccept}
        onCancel={() => setConfirmAcceptId(null)}
      />
    </div>
  )
}

export default withRecordSearch(IncomingTransfers, ["transfers"])
