import { withPrintSearch } from '../../printableRecords';
import DocumentPrintButton from '../../components/DocumentPrintButton';
import { matchesRecord } from "../../components/RecordSearch"

import React, { useState } from "react"

import { calculateRecyclingMetrics, useApp } from '../../store';

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import type { RecyclingBatch } from "../../types"

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

import Pagination, { pageRecords } from '../../components/Pagination';

import DocumentViewer from "../../components/DocumentViewer"

import { recyclingDocument } from "../../documentPrint"

function BatchDetails({ batch }: { batch: RecyclingBatch }) {
  const metrics = batch.recoveredKg == null
    ? null
    : calculateRecyclingMetrics(batch.originalKg, batch.cutMaterialKg ?? batch.originalKg, batch.recoveredKg);

  const fields = [
    ['Batch Number', batch.batchNo],
    ['Source PO', batch.sourcePO || '—'],
    ['Product', batch.product || '—'],
    ['Reject Reasons', batch.rejectReasons?.join(', ') || '—'],
    ['Original Rejected Weight', `${batch.originalKg.toFixed(1)} kg`],
    ['Cut Material Weight', batch.cutMaterialKg == null ? '—' : `${batch.cutMaterialKg.toFixed(1)} kg`],
    ['Cutting Loss', batch.cuttingLossKg == null ? '—' : `${batch.cuttingLossKg.toFixed(1)} kg`],
    ['Recovered Pellet Weight', batch.recoveredKg == null ? '—' : `${batch.recoveredKg.toFixed(1)} kg`],
    ['Recycling Process Loss', metrics == null ? '—' : `${metrics.recyclingProcessLossKg.toFixed(1)} kg`],
    ['Total Recycling Loss', metrics == null ? '—' : `${metrics.totalRecyclingLossKg.toFixed(1)} kg`],
    ['Recovery Rate', metrics == null ? '—' : `${metrics.recoveryRate.toFixed(2)}%`],
    ['Complete 25 kg Bags', batch.completeBags == null ? '—' : batch.completeBags],
    ['Loose Recycled Pellets', batch.looseKg == null ? '—' : `${batch.looseKg.toFixed(1)} kg`],
    ['Cut By', batch.cutBy || '—'],
    ['Cutting Date / Time', batch.cutAt ? new Date(batch.cutAt).toLocaleString('en-PH') : '—'],
    ['Weighed By', batch.weighedBy || '—'],
    ['Weighed Date / Time', batch.weighedAt ? new Date(batch.weighedAt).toLocaleString('en-PH') : '—'],
  ];

  return (
    <div className="responsive-grid">
      {fields.map(([label, value]) => (
        <div key={label}>
          <div className="field-label">{label}</div>
          <div className="field-value">{value}</div>
        </div>
      ))}
    </div>
  )
}

export default function ProductionRecycling() {
  const app = useApp();
  const { rejectedMaterials, recyclingBatches, totalRejectedKg, updateRecyclingStage, completeRecyclingBatch } = app;

  const [tab, setTab] = useState<'rejected' | 'recycling'>('rejected');

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [weightMode, setWeightMode] = useState<'cut' | 'recovered' | null>(null);

  const [weight, setWeight] = useState("")

  const [message, setMessage] = useState("")

  const [search, setSearch] = useState("")

  const [page, setPage] = useState(1)

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  const period = usePeriod()

  const query = search.trim().toLowerCase()

  const filteredRejected = rejectedMaterials.filter(
    (record) =>
      dateInPeriod(record.date, period.range) &&
      ((!query || [record.rejectionId, record.poRef, record.product, record.reason, record.batch].some(value => value.toLowerCase().includes(query))) ||
          matchesRecord(record, query)),
  )

  const filteredBatches = recyclingBatches.filter(
    (batch) =>
      dateInPeriod(batch.date, period.range) &&
      ((!query || [batch.batchNo, batch.sourcePO, batch.product, batch.status].some(value => String(value || '').toLowerCase().includes(query))) ||
          matchesRecord(withPrintSearch(app, batch), query)),
  )

  const selected = recyclingBatches.find(batch => batch.id === selectedId);

  const documentBatch = recyclingBatches.find(batch => batch.id === documentAction?.id);

  const status = totalRejectedKg >= 50 ? 'RECYCLING REQUIRED' : totalRejectedKg >= 40 ? 'NEARING LIMIT' : 'COLLECTING';

  const runAction = (batchId: string, action: Parameters<typeof updateRecyclingStage>[1]) => {
    const result = updateRecyclingStage(batchId, action);
    setMessage(result.error || '');
  };

  const submitWeight = () => {
    if (!selected) return;
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) return setMessage('Enter the required weight.');
    if (weightMode === 'cut') {
      const result = updateRecyclingStage(selected.id, 'submit-weight', value);
      if (!result.success) return setMessage(result.error || 'The weight could not be submitted.');
    } else {
      if (value > (selected.cutMaterialKg ?? selected.originalKg)) return setMessage('Recovered weight cannot exceed the cut material weight.');
      completeRecyclingBatch(selected.id, value);
    }
    setWeight('');
    setWeightMode(null);
    setMessage('');
  };

  return (
    <div className="page-stack">
      <div className={totalRejectedKg >= 50 ? 'alert-error' : totalRejectedKg >= 40 ? 'alert-warning' : 'alert-info'}>
        <strong>
          {totalRejectedKg.toFixed(1)} kg / 50 kg — {status}
        </strong>
        <div>Rejected weight is calculated from the original rejected-pipe records.</div>
      </div>
      <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => setPage(1)} placeholder="Search rejection, PO, batch, product, or status..." />
      <div className="tab-strip">
      <button className={tab === 'rejected' ? 'tab-active' : ''} onClick={() => { setTab('rejected'); setPage(1); }}>Rejected Materials</button>
      <button className={tab === 'recycling' ? 'tab-active' : ''} onClick={() => { setTab('recycling'); setPage(1); }}>Recycling Batches</button>
    </div>
      {tab === "rejected" ? (
        <div className="app-card table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th>Rejection ID</th>
                <th>PO</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Weight</th>
                <th>Reason</th>
                <th>Batch</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords(filteredRejected, page).map((record) => (
                <tr key={record.id}>
                  <td className="font-mono">{record.rejectionId}</td>
                  <td>{record.poRef}</td>
                  <td>{record.product}</td>
                  <td>{record.quantity}</td>
                  <td>
                    <strong>{record.weightKg.toFixed(1)} kg</strong>
                  </td>
                  <td>{record.reason}</td>
                  <td>{record.recyclingBatchRef || "—"}</td>
                  <td>{record.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRejected.length && (
            <div className="empty-state empty-state-action">
              <strong>NO RECORDS FOUND</strong>
              <span>No records match the selected search, date, or filters.</span>
            </div>
          )}
          <Pagination page={page} totalRecords={filteredRejected.length} onPageChange={setPage} />
        </div>
      ) : (
        <div className="app-card table-scroll">
          <table className="app-table">
            <thead>
              <tr>
                <th>Batch</th>
                <th>Source PO</th>
                <th>Original Weight</th>
                <th>Cut Weight</th>
                <th>Cutting Loss</th>
                <th>Status</th>
                <th data-actions>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRecords(filteredBatches, page).map((batch) => (
                <tr key={batch.id}>
                  <td className="font-mono">{batch.batchNo}</td>
                  <td>{batch.sourcePO || "—"}</td>
                  <td>{batch.originalKg.toFixed(1)} kg</td>
                  <td>
                    {batch.cutMaterialKg == null ? '—' : `${batch.cutMaterialKg.toFixed(1)} kg`}
                  </td>
                  <td>
                    {batch.cuttingLossKg == null ? '—' : `${batch.cuttingLossKg.toFixed(1)} kg`}
                  </td>
                  <td>
                    <StatusBadge status={batch.status} size="sm" />
                  </td>
                  <td>
                    <div className="button-group">
              <button className="btn-secondary btn-compact" onClick={() => { setSelectedId(batch.id); setMessage(''); }}>View</button>
              <DocumentPrintButton className="btn-secondary btn-compact" recordId={batch.id} recordType="RECYCLING RECORD" onClick={() => setDocumentAction({ id: batch.id, autoPrint: true })} />
              {batch.status === 'Ready for Cutting' && <button className="btn-primary btn-compact" onClick={() => runAction(batch.id, 'start-cutting')}>Start Cutting</button>}
              {batch.status === 'Cutting' && <button className="btn-primary btn-compact" onClick={() => runAction(batch.id, 'complete-cutting')}>Complete Cutting</button>}
              {batch.status === 'Weighing' && <button className="btn-primary btn-compact" onClick={() => { setSelectedId(batch.id); setWeightMode('cut'); setWeight(''); }}>Submit Weight</button>}
              {batch.status === 'Ready for Crushing' && <button className="btn-primary btn-compact" onClick={() => runAction(batch.id, 'start-crushing')}>Start Crushing</button>}
              {batch.status === 'Crushing' && <button className="btn-primary btn-compact" onClick={() => runAction(batch.id, 'complete-crushing')}>Complete Crushing</button>}
              {batch.status === 'Ready for Pelletizing' && <button className="btn-primary btn-compact" onClick={() => runAction(batch.id, 'start-pelletizing')}>Start Pelletizing</button>}
              {batch.status === 'Pelletizing' && <button className="btn-primary btn-compact" onClick={() => { setSelectedId(batch.id); setWeightMode('recovered'); setWeight(''); }}>Complete Pelletizing</button>}
            </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredBatches.length && (
            <div className="empty-state empty-state-action">
              <strong>NO RECORDS FOUND</strong>
              <span>No records match the selected search, date, or filters.</span>
            </div>
          )}
          <Pagination page={page} totalRecords={filteredBatches.length} onPageChange={setPage} />
        </div>
      )}

      {selected && (
        <Modal open title={`Recycling Batch — ${selected.batchNo}`} onClose={() => { setSelectedId(null); setWeightMode(null); setMessage(''); }} width="720px">
          <div className="page-stack">
            <div>
              <StatusBadge status={selected.status} />
            </div>
            <BatchDetails batch={selected} />
            {selected.status === 'Awaiting Crushing Confirmation' && <div className="alert-warning">
          <strong>Waiting for Plant Manager confirmation before Crushing.</strong>
          <div>Start Crushing is unavailable until this batch is confirmed.</div>
        </div>}
            {weightMode === 'cut' && <label className="block-label">Cut Material Weight (kg)
          <input className="app-input" type="number" min="0.1" max={selected.originalKg} step="0.1" value={weight} onChange={event => setWeight(event.target.value)} />
          <span className="helper-text">Original rejected weight: {selected.originalKg.toFixed(1)} kg. Cutting loss is calculated automatically.</span>
        </label>}
            {weightMode === 'recovered' && <label className="block-label">Recovered Pellet Weight (kg)
          <input className="app-input" type="number" min="0.1" max={selected.cutMaterialKg ?? selected.originalKg} step="0.1" value={weight} onChange={event => setWeight(event.target.value)} />
          <span className="helper-text">Every complete 25 kg bag receives one barcode. Loose pellets remain unbarcoded.</span>
        </label>}
            {message && <div className="alert-error">{message}</div>}
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setDocumentAction({ id: selected.id, autoPrint: false })}>View Document</button>
              <DocumentPrintButton className="btn-primary" recordId={selected.id} recordType="RECYCLING RECORD" onClick={() => setDocumentAction({ id: selected.id, autoPrint: true })} />
              <button className="btn-secondary" onClick={() => { setSelectedId(null); setWeightMode(null); }}>Close</button>
              {weightMode && (
                <button className="btn-primary" onClick={submitWeight}>
                  {weightMode === 'cut' ? 'Submit Weight' : 'Complete & Create Bags'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
      <DocumentViewer open={!!documentAction} document={documentBatch ? recyclingDocument(documentBatch) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />
    </div>
  )
}
