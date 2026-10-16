import { pelletColorLabel } from '../../pelletColors';
import { TableBody } from '../../components/UXFeedback';
import { DismissButton } from '../../components/ActionButton';
import ActionButton from '../../components/ActionButton';
import RecordRows from "../../components/RecordRows"

import {
  withRecordSearch,
  useSearchableApp,
} from "../../components/RecordSearch"

import React, { useState } from "react"

import { calculateRecyclingMetrics } from "../../store"

import Modal from "../../components/Modal"

import BarcodeLabel from "../../components/BarcodeLabel"

import StatusBadge from "../../components/StatusBadge"

import type { RecyclingBatch } from "../../types"

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  )
}

function RejectedRecycling() {
  const { rejectedMaterials, recyclingBatches, pellets, totalRejectedKg, confirmRecyclingForCrushing } = useSearchableApp()

  const [detailId, setDetailId] = useState<string | null>(null);

  const [confirmId, setConfirmId] = useState<string | null>(null);

  const period = usePeriod("month")

  const periodRejected = rejectedMaterials.filter(item => dateInPeriod(item.date, period.range));

  const periodBatches = recyclingBatches.filter(item => dateInPeriod(item.date, period.range));

  const detail = recyclingBatches.find(batch => batch.id === detailId);

  const confirmation = recyclingBatches.find(batch => batch.id === confirmId);

  const recovered = periodBatches.reduce((sum, batch) => sum + (batch.recoveredKg || 0), 0);

  const collection = totalRejectedKg >= 50 ? 'Recycling Required' : totalRejectedKg >= 40 ? 'Nearing Limit' : 'Collecting';

  const fieldsFor = (batch: RecyclingBatch) => {
    const metrics = batch.recoveredKg == null
      ? null
      : calculateRecyclingMetrics(batch.originalKg, batch.cutMaterialKg ?? batch.originalKg, batch.recoveredKg);
    return [
      ['Batch Number', batch.batchNo], ['Source PO', batch.sourcePO || '—'], ['Product', batch.product || '—'],
      ['Reject Reasons', batch.rejectReasons?.join(', ') || '—'], ['Original Rejected Weight', `${batch.originalKg.toFixed(1)} kg`],
      ['Cut Material Weight', batch.cutMaterialKg == null ? '—' : `${batch.cutMaterialKg.toFixed(1)} kg`],
      ['Cutting Loss', batch.cuttingLossKg == null ? '—' : `${batch.cuttingLossKg.toFixed(1)} kg`],
      ['Recovered Pellet Weight', batch.recoveredKg == null ? '—' : `${batch.recoveredKg.toFixed(1)} kg`],
      ['Recycled Pellet Color', pelletColorLabel('Recycled', batch.color)],
      ['Recycling Process Loss', metrics == null ? '—' : `${metrics.recyclingProcessLossKg.toFixed(1)} kg`],
      ['Total Recycling Loss', metrics == null ? '—' : `${metrics.totalRecyclingLossKg.toFixed(1)} kg`],
      ['Recovery Rate', metrics == null ? '—' : `${metrics.recoveryRate.toFixed(2)}%`],
      ['Complete 25 kg Bags', batch.completeBags == null ? '—' : batch.completeBags],
      ['Loose Recycled Pellets', batch.looseKg == null ? '—' : `${batch.looseKg.toFixed(1)} kg`],
      ['Cut By', batch.cutBy || '—'], ['Cutting Date / Time', batch.cutAt ? new Date(batch.cutAt).toLocaleString('en-PH') : '—'],
      ['Weighed By', batch.weighedBy || '—'], ['Weighed Date / Time', batch.weighedAt ? new Date(batch.weighedAt).toLocaleString('en-PH') : '—'],
      ['Confirmation Status', batch.confirmationStatus || 'Not yet required'], ['Confirmed By', batch.confirmedBy || '—'],
      ['Confirmation Date / Time', batch.confirmedAt ? new Date(batch.confirmedAt).toLocaleString('en-PH') : '—'],
    ];
  };

  return (
    <div className="page-stack">
      <PeriodSelector period={period} />
      <div className={totalRejectedKg >= 50 ? 'alert-error' : totalRejectedKg >= 40 ? 'alert-warning' : 'alert-info'}>
      <strong>{collection}</strong>
      <div>Current unrecycled material: {totalRejectedKg.toFixed(1)} kg. Warning begins at 40 kg; recycling is required at 50 kg.</div>
    </div>
      <div className="kpi-grid">
        {[['Current Rejected kg', totalRejectedKg.toFixed(1)], ['Collection Status', collection], ['Period Rejections', `${periodRejected.reduce((sum, item) => sum + item.weightKg, 0).toFixed(1)} kg`], ['Recovered During Period', `${recovered.toFixed(1)} kg`]].map(([label, value]) => (
          <div className="app-card kpi-card" key={label}>
            <div>{label}</div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="app-card table-scroll">
        <div className="table-title">Rejected Material</div>
        <table className="app-table">
          <thead>
            <tr>
              <th>Rejection ID</th>
              <th>Date</th>
              <th className="po-column">PO</th>
              <th>Product</th>
              <th>Employee</th>
              <th>Qty</th>
              <th>Weight</th>
              <th>Reason</th>
              <th>Recycling Batch</th>
            </tr>
          </thead>
          <TableBody>
            {periodRejected.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-state">No rejected materials found.</td>
              </tr>
            ) : (
              <RecordRows
                records={periodRejected}
                render={(record) => (
                  <tr key={record.id}>
                    <td>{record.rejectionId}</td>
                    <td>{record.date}</td>
                    <td className="po-column">{record.poRef}</td>
                    <td>{record.product}</td>
                    <td>{record.employee}</td>
                    <td>{record.quantity}</td>
                    <td>
                      <strong>{record.weightKg.toFixed(1)} kg</strong>
                    </td>
                    <td>{record.reason}</td>
                    <td>{record.recyclingBatchRef || "—"}</td>
                  </tr>
                )}
              />
            )}
          </TableBody>
        </table>
      </div>
      <div className="app-card table-scroll">
        <div className="table-title">Recycling Batches</div>
        <table className="app-table">
          <thead>
            <tr>
              <th>Batch</th>
              <th className="po-column">Source PO</th>
              <th>Product</th>
              <th>Original Weight</th>
              <th>Cut Weight</th>
              <th>Cutting Loss</th>
              <th>Status</th>
              <th>Confirmation</th>
              <th data-actions>Actions</th>
            </tr>
          </thead>
          <TableBody>
            {periodBatches.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-state">No recycling batches found.</td>
              </tr>
            ) : (
              <RecordRows
                records={periodBatches}
                render={(batch) => (
                  <tr key={batch.id}>
                    <td>{batch.batchNo}</td>
                    <td className="po-column">{batch.sourcePO || "—"}</td>
                    <td>{batch.product || "—"}</td>
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
                    <td>{batch.confirmationStatus || "—"}</td>
                    <td>
                      <div className="button-group">
            <button className="btn-secondary btn-compact" onClick={() => setDetailId(batch.id)}>View</button>
            {batch.status === 'Awaiting Crushing Confirmation' && <button className="btn-primary btn-compact" onClick={() => setConfirmId(batch.id)}>Confirm for Crushing</button>}
          </div>
                    </td>
                  </tr>
                )}
              />
            )}
          </TableBody>
        </table>
      </div>

      {detail && (
        <Modal open title={`Recycling Batch — ${detail.batchNo}`} onClose={() => setDetailId(null)} width="720px">
          <div className="page-stack">
            <div>
              <StatusBadge status={detail.status} />
            </div>
            <div className="responsive-grid">
              {fieldsFor(detail).map(([label, value]) => <DetailField key={label as string} label={label as string} value={value} />)}
            </div>
            {detail.status === "Completed" &&
              (() => {
                const recycledPellets = pellets.filter(pellet => pellet.type === 'Recycled' && pellet.batchNo === detail.batchNo);

                return (
                  <div className="page-stack">
                    <div className="alert-success">
                      <strong>
                        {recycledPellets.length} complete 25 kg bag barcode(s)
                        assigned automatically
                      </strong>
                      <div>Loose recycled material remains unbarcoded.</div>
                    </div>
                    {recycledPellets.map(pellet => <BarcodeLabel
              key={pellet.id}
              value={pellet.barcode}
              recordId={pellet.id}
              recordLabel={pellet.bagNo}
            />)}
                  </div>
                )
              })()}
            <div className="form-actions">
          <button className="btn-secondary" onClick={() => setDetailId(null)}>Close</button>
          {detail.status === 'Awaiting Crushing Confirmation' && <button className="btn-primary" onClick={() => setConfirmId(detail.id)}>Confirm for Crushing</button>}
        </div>
          </div>
        </Modal>
      )}

      {confirmation && (
        <Modal open title="Confirm for Crushing" onClose={() => setConfirmId(null)} width="560px">
          <div className="page-stack">
            <div className="alert-warning">Confirm that this cut and weighed rejected material is ready to proceed to Crushing?</div>
            <div className="responsive-grid">
              <DetailField label="Batch" value={confirmation.batchNo} />
              <DetailField label="Product" value={confirmation.product || '—'} />
              <DetailField label="Source PO" value={confirmation.sourcePO || '—'} />
              <DetailField label="Original Weight" value={`${confirmation.originalKg.toFixed(1)} kg`} />
              <DetailField label="Cut Material Weight" value={`${(confirmation.cutMaterialKg || 0).toFixed(1)} kg`} />
              <DetailField label="Cutting Loss" value={`${(confirmation.cuttingLossKg || 0).toFixed(1)} kg`} />
            </div>
            <div className="form-actions">
          <DismissButton className="btn-secondary" onClick={() => setConfirmId(null)}>Cancel</DismissButton>
          <ActionButton className="btn-primary" onClick={() => { if (confirmRecyclingForCrushing(confirmation.id)) { setConfirmId(null); setDetailId(null); } }}>Confirm for Crushing</ActionButton>
        </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default withRecordSearch(RejectedRecycling, [
  "rejectedMaterials",
  "recyclingBatches",
], false, false)
