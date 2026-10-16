import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import ActionButton from '../../components/ActionButton';
import { DismissButton } from '../../components/ActionButton';
import { withPrintSearch } from '../../printableRecords';
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';
import { productionOriginGroup } from '../../finishedPipeRelations';
import DocumentPrintButton from '../../components/DocumentPrintButton';
import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useRef, useState } from "react"
import { canRecordProduction, productionOutputTotals } from '../../productionOutput';
import type { ProductionOrder } from '../../types';

import { calculateProductionMaterialPlan, useApp } from '../../store';

import { colorCodeFromProductColor, colorCodeFromStripe } from '../../productMaster';

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';

import Pagination, { pageRecords } from '../../components/Pagination';

import DocumentViewer from "../../components/DocumentViewer"

import { productionOrderDocument } from '../../documentPrint';

const OUTPUT_DRAFT_KEY = "hpai:production-output-draft"

const MATERIAL_REVIEW_KEY = "hpai:material-review-request"

type OutputDraft = {
  entryId?: string;
  poId: string;
  outputQty: string;
  rejectQty: string;
  rejections: Array<{ weight: string; reason: string }>;
};

type OrderView = 'Ready' | 'In Progress' | 'Pending Turnover' | 'Completed';

const ORDER_VIEWS: OrderView[] = ['Ready', 'In Progress', 'Pending Turnover', 'Completed'];

const readOutputDraft = (): OutputDraft | null => {
  try {
    const value = sessionStorage.getItem(OUTPUT_DRAFT_KEY);
    return value ? JSON.parse(value) as OutputDraft : null;
  } catch {
    return null;
  }
};

export default function ProdOrders() {
  const app = useApp();
  const { productionOrders, rejectedMaterials, materialUsageTransactions, pellets, colorants, activeAttendance, navigate, startProduction, recordOutput } = app;

  const [initialDraft] = useState(readOutputDraft)
  const outputEntryId = useRef(initialDraft?.entryId || crypto.randomUUID());
  const submissionLock = useRef(false);

  const [materialReviewRequest] = useState(() => {
    try {
      const value = sessionStorage.getItem(MATERIAL_REVIEW_KEY);
      return value ? JSON.parse(value) as { poId: string; returnPage: string } : null;
    } catch {
      return null;
    }
  });

  const [viewId, setViewId] = useState<string | null>(initialDraft?.poId || materialReviewRequest?.poId || null);

  const [showOutput, setShowOutput] = useState(!!initialDraft || !!materialReviewRequest);

  const [outputQty, setOutputQty] = useState(initialDraft?.outputQty || '');

  const [rejectQty, setRejectQty] = useState(initialDraft?.rejectQty || '');

  const [rejections, setRejections] = useState<Array<{ weight: string; reason: string }>>(initialDraft?.rejections || []);

  const [error, setError] = useState("")

  const [saved, setSaved] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [reviewMaterials, setReviewMaterials] = useState(!!materialReviewRequest);

  const [orderView, setOrderView] = useViewState<OrderView>("production/ProductionOrders:orderView", 'Ready');

  const [search, setSearch] = useViewState("production/ProductionOrders:search", "")
  const period = usePeriod('all', search);

  const [pages, setPages] = useViewState<Record<OrderView, number>>("production/ProductionOrders:pages", { Ready: 1, 'In Progress': 1, 'Pending Turnover': 1, Completed: 1 });
  const productFilters = useProductFilters(() => setPages({ Ready: 1, 'In Progress': 1, 'Pending Turnover': 1, Completed: 1 }));

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);


  const query = search.trim().toLowerCase()

  const filteredOrders = productionOrders.filter((po) => {
    const inView = orderView === 'Ready' ? ['Scheduled', 'Ready'].includes(po.status)
      : orderView === 'In Progress' ? ['In Production', 'Partially Completed'].includes(po.status)
      : orderView === 'Pending Turnover' ? po.status === 'Awaiting Shift Turnover'
      : po.status === 'Completed';

    return (
      inView &&
      productFilters.matches(po) &&
      dateInPeriod(po.requiredDate, period.range) &&
      ((!query || [po.poNo, po.moRef, po.product, po.diameter, po.grade, po.productionLine].some(value => value.toLowerCase().includes(query))) ||
          matchesRecord(withPrintSearch(app, po), query))
    )
  })

  const page = pages[orderView]

  const resetPages = () => setPages({ Ready: 1, 'In Progress': 1, 'Pending Turnover': 1, Completed: 1 });

  const viewPO = productionOrders.find((p) => p.id === viewId)
  const outputHistory = app.transactions.filter(transaction => transaction.transactionType === 'Production Output'
    && (transaction.productionOrderId === viewId || (viewPO && transaction.reference === viewPO.poNo)));

  const documentPO = productionOrders.find(p => p.id === documentAction?.id);

  const viewPOMaterialUsage = viewPO
    ? materialUsageTransactions.filter(transaction => transaction.productionOrderId === viewPO.id)
    : [];

  const currentSessionMaterials = viewPO && activeAttendance
    ? materialUsageTransactions.filter(transaction =>
        transaction.productionOrderId === viewPO.id
        && transaction.attendanceSessionId === activeAttendance.id
      )
    : [];

  const pelletMaterials = currentSessionMaterials.filter(transaction => transaction.materialType !== 'COLORANT');

  const virginMaterials = pelletMaterials.filter(transaction => transaction.materialType === 'VIRGIN_PELLET');

  const recycledMaterials = pelletMaterials.filter(transaction => transaction.materialType === 'RECYCLED_PELLET');

  const baseColorants = currentSessionMaterials.filter(transaction => transaction.materialType === 'COLORANT' && (transaction.usageType || 'BASE_COLORANT') === 'BASE_COLORANT');

  const stripeColorants = currentSessionMaterials.filter(transaction => transaction.materialType === 'COLORANT' && transaction.usageType === 'STRIPE_COLORANT');

  const sumQuantity = (transactions: typeof currentSessionMaterials) => transactions.reduce((sum, transaction) => sum + transaction.quantity, 0);

  const virginWeight = sumQuantity(virginMaterials)

  const recycledWeight = sumQuantity(recycledMaterials)

  const baseColorantWeight = sumQuantity(baseColorants)

  const stripeColorantWeight = sumQuantity(stripeColorants)

  const totalPelletWeight = virginWeight + recycledWeight

  const stripeRequired = viewPO?.stripe !== "No Stripe"

  const outputCount = Number.isInteger(Number(outputQty)) ? Number(outputQty) : 0;

  const materialPlan = viewPO ? calculateProductionMaterialPlan(viewPO, outputCount) : null;

  const loadedWipBags = viewPO ? pellets.filter(item =>
    ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus)
    && item.grade === viewPO.grade
    && item.availableKg > 0
  ) : [];

  const wipAvailable = loadedWipBags.reduce((sum, item) => sum + item.availableKg, 0);

  const virginWip = loadedWipBags.filter(item => item.type === 'Virgin').reduce((sum, item) => sum + item.availableKg, 0);

  const recycledWip = loadedWipBags.filter(item => item.type === 'Recycled').reduce((sum, item) => sum + item.availableKg, 0);

  const baseColorant = viewPO ? colorants.find(item => item.usageType === 'BASE_COLORANT' && item.colorCode === colorCodeFromProductColor(viewPO.color)) : undefined;

  const stripeColorant = viewPO && stripeRequired ? colorants.find(item => item.usageType === 'STRIPE_COLORANT' && item.colorCode === colorCodeFromStripe(viewPO.stripe)) : undefined;

  const singlePipePlan = viewPO ? calculateProductionMaterialPlan(viewPO, 1) : null;

  const unitWeightConfigured = !!singlePipePlan && singlePipePlan.unitWeightKg > 0;

  const materialCapacity = singlePipePlan && unitWeightConfigured ? Math.max(0, Math.min(
    Math.floor(wipAvailable / Math.max(singlePipePlan.pelletRequiredKg, 0.000001)),
    Math.floor((baseColorant?.availableKg || 0) / Math.max(singlePipePlan.baseColorantKg, 0.000001)),
    stripeRequired ? Math.floor((stripeColorant?.availableKg || 0) / Math.max(singlePipePlan.stripeColorantKg, 0.000001)) : Number.MAX_SAFE_INTEGER,
    viewPO ? viewPO.targetQty - viewPO.completedQty : 0,
  )) : 0;

  const validMaterials = wipAvailable > 0

  const rejectedForPO = (poNo: string) => {
    const po = productionOrders.find(item => item.poNo === poNo);
    return po ? productionOutputTotals(po, rejectedMaterials).rejected : 0;
  };

  const openProduction = (po: ProductionOrder) => {
    const result = startProduction(po.id);
    if (!result.success) return setError(result.error || 'Production could not be started.');
    setError('');
    setViewId(po.id);
    setReviewMaterials(false);
    setShowOutput(true);
  };

  const handleSaveOutput = () => {
    if (submitting || submissionLock.current) return;
    const completed = Number(outputQty);
    const rejected = Number(rejectQty || 0);
    if (!Number.isInteger(completed) || completed < 1) return setError('Enter the completed quantity.');
    if (!Number.isInteger(rejected) || rejected < 0 || rejected > completed) return setError('Rejected quantity must be a whole number no greater than Completed.');
    if (rejected > 0 && (rejections.length !== rejected || rejections.some(rejection => !Number.isFinite(Number(rejection.weight)) || Number(rejection.weight) <= 0))) {
      return setError('Enter the rejected weight for every rejected pipe.');
    }
    if (rejections.some(rejection => !rejection.reason)) {
      return setError('Select a reject reason for every rejected pipe.');
    }
    if (viewPO && completed > viewPO.targetQty - viewPO.completedQty) return setError('Completed quantity cannot exceed the remaining target.');
    if (!unitWeightConfigured) return setError('UNIT WEIGHT CONFIGURATION REQUIRED|Configure a product-specific unit weight, BOM / recipe, or valid solid-wall geometry before recording output.');
    if (wipAvailable <= 0) return setError('MATERIAL USAGE MISSING|Production output cannot be finalized because no pellet bags are loaded to this Production Order.');
    if (materialPlan && completed > materialCapacity) {
      const availableMaterial =
        Math.min(wipAvailable, materialPlan.pelletRequiredKg)
        + Math.min(baseColorant?.availableKg || 0, materialPlan.baseColorantKg)
        + (stripeRequired ? Math.min(stripeColorant?.availableKg || 0, materialPlan.stripeColorantKg) : 0);
      const shortage =
        Math.max(0, materialPlan.pelletRequiredKg - wipAvailable)
        + Math.max(0, materialPlan.baseColorantKg - (baseColorant?.availableKg || 0))
        + (stripeRequired ? Math.max(0, materialPlan.stripeColorantKg - (stripeColorant?.availableKg || 0)) : 0);
      return setError(`INSUFFICIENT MATERIAL|Only ${materialCapacity} pipes can be produced using the currently available Production materials.|Requested Output: ${completed}|Maximum Possible: ${materialCapacity}|Material Required: ${materialPlan.totalMaterialConsumedKg.toFixed(3)} kg|Material Available: ${availableMaterial.toFixed(3)} kg|Material Shortage: ${shortage.toFixed(3)} kg`);
    }
    if (viewId) {
      submissionLock.current = true;
      setSubmitting(true);
      const result = recordOutput(viewId, completed, rejections.map(rejection => ({ weightKg: Number(rejection.weight), reason: rejection.reason })), outputEntryId.current);
      if (!result.success) {
        submissionLock.current = false;
        setSubmitting(false);
        return setError(result.error || 'Output could not be recorded. Check the entered quantities.');
      }
      setError('');
      setSaved(true);
      sessionStorage.removeItem(OUTPUT_DRAFT_KEY);
      setTimeout(() => {
        outputEntryId.current = crypto.randomUUID();
        submissionLock.current = false;
        setSaved(false); setShowOutput(false); setOutputQty(''); setRejectQty('');
        setRejections([]); setSubmitting(false);
      }, 1200);
    }
  };

  const updateRejectedQuantity = (value: string) => {
    setRejectQty(value);
    const count = Math.max(0, Math.floor(Number(value) || 0));
    setRejections(current => Array.from({ length: count }, (_, index) => current[index] || { weight: '', reason: '' }));
  };

  const closeOutput = () => {
    if (submissionLock.current) return;
    sessionStorage.removeItem(OUTPUT_DRAFT_KEY);
    sessionStorage.removeItem(MATERIAL_REVIEW_KEY);
    setShowOutput(false);
    setReviewMaterials(false);
  };

  const returnFromMaterialReview = () => {
    const returnPage = materialReviewRequest?.returnPage;
    sessionStorage.removeItem(MATERIAL_REVIEW_KEY);
    if (returnPage) navigate(returnPage);
    else setReviewMaterials(false);
  };

  const loadPelletBags = () => {
    if (!viewPO) return;
    sessionStorage.setItem(OUTPUT_DRAFT_KEY, JSON.stringify({
      entryId: outputEntryId.current,
      poId: viewPO.id,
      outputQty,
      rejectQty,
      rejections,
    } satisfies OutputDraft));
    navigate('prod-barcode');
  };

  return (
    <div className="page-stack">
      {error && !showOutput && <div className="alert-error" role="alert">{error}</div>}
      <PeriodSelector
        period={period}
        search={search}
        onSearchChange={value => { setSearch(value); resetPages(); }}
        onDateChange={resetPages}
        placeholder="Search PO, MO, product, barcode, reference..."
        filters={<ProductFilters records={productionOrders.filter(item => dateInPeriod(item.requiredDate, period.range) && matchesRecord(withPrintSearch(app, item), search))} value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade />}
      />
      <div className="tab-strip">
        {ORDER_VIEWS.map(view => (
        <button key={view} className={orderView === view ? 'tab-active' : ''} onClick={() => setOrderView(view)}>
          {view} ({productionOrders.filter(po => view === 'Ready' ? ['Scheduled', 'Ready'].includes(po.status) : view === 'In Progress' ? ['In Production', 'Partially Completed'].includes(po.status) : view === 'Pending Turnover' ? po.status === 'Awaiting Shift Turnover' : po.status === 'Completed').length})
        </button>
      ))}
      </div>
      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th className="po-column">PO No.</th>
              <th>Product</th>
              <th>Completed / Good / Rejected</th>
              <th>Progress</th>
              <th>Line</th>
              <th>Req. Date</th>
              <th>Status</th>
              <th data-actions>Actions</th>
            </tr>
          </thead>
          <TableBody>
            {pageRecords(filteredOrders, page).map((po) => {
              const pct = po.targetQty > 0 ? Math.round(po.completedQty / po.targetQty * 100) : 0;

              return (
                <tr key={po.id} className="table-row-hover" onClick={() => setViewId(po.id)}>
                  <td className="font-mono po-column" style={{ fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600 }}>
                    <RecordReference value={po.poNo} />
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {po.product} {po.diameter} × {po.length}
                  </td>
                  <td className="font-mono">
                    {po.completedQty} /{" "}
                    {productionOutputTotals(po, rejectedMaterials).good} /{" "}
                    {rejectedForPO(po.poNo)}
                  </td>
                  <td style={{ minWidth: 130 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                      {po.completedQty}/{po.targetQty} ({pct}%)
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? '#16a34a' : '#2563eb' }} />
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{po.productionLine}</td>
                  <td style={{ fontSize: 12 }}>{po.requiredDate}</td>
                  <td>
                    <StatusBadge status={po.status} size="sm" />
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="button-group">
                      <button className="btn-secondary btn-compact" onClick={() => setViewId(po.id)}>View</button>
                      <DocumentPrintButton className="btn-secondary btn-compact" recordId={po.id} recordType="PRODUCTION ORDER" onClick={() => setDocumentAction({ id: po.id, autoPrint: true })} />
                      {canRecordProduction(po) && <button className="btn-primary btn-compact" onClick={() => openProduction(po)}>{['Ready', 'Scheduled'].includes(po.status) ? 'Start Production' : 'Continue / Record Output'}</button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </TableBody>
        </table>
        {!filteredOrders.length && (
          <div className="empty-state empty-state-action">
            <strong>NO RECORDS FOUND</strong>
            <span>No records match the selected search, date, or filters.</span>
            <button className="btn-secondary btn-compact" onClick={() => { setSearch(''); period.setDate(''); resetPages(); }}>Clear Filters</button>
          </div>
        )}
        <Pagination page={page} totalRecords={filteredOrders.length} onPageChange={next => setPages(current => ({ ...current, [orderView]: next }))} />
      </div>

      {/* PO Detail */}
      {viewId && viewPO && !showOutput && (
        <Modal open title={`Production Order — ${viewPO.poNo}`} onClose={() => setViewId(null)} width="620px">
          {error && <div className="alert-error mb-3" role="alert">{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              ["PO No.", viewPO.poNo],
              ["MO Reference", viewPO.moRef],
              ["Product", viewPO.product],
              ["Diameter", viewPO.diameter],
              ["Length", viewPO.length],
              ["SDR / Thickness", viewPO.sdr],
              ["Origin Group (read-only)", productionOriginGroup(viewPO, app) || 'Not Resolved'],
              ["Grade", viewPO.grade],
              ["Color", viewPO.color],
              ["Stripe", viewPO.stripe],
              ["Target Qty", viewPO.targetQty],
              ["Completed Qty", viewPO.completedQty],
              ["Rejected Qty", rejectedForPO(viewPO.poNo)],
              ['Good Output', productionOutputTotals(viewPO, rejectedMaterials).good],
              ['Remaining', Math.max(0, viewPO.targetQty - viewPO.completedQty)],
              ["Pellet Type", viewPO.pelletType],
              ["Production Line", viewPO.productionLine],
              ["Required Date", viewPO.requiredDate],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                  {l}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{String(v)}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Status</div>
              <StatusBadge status={viewPO.status} />
            </div>
          </div>
          <section className="mb-3">
            <div className="section-title">Production Output History</div>
            {outputHistory.length ? <div className="table-scroll"><div><table className="app-table" style={{ minWidth: 520 }}>
              <thead><tr><th>Date / Time</th><th>Batch</th><th>Output</th><th>Good</th><th>Rejected</th></tr></thead>
              <tbody>{outputHistory.map(entry => <tr key={entry.id}>
                <td>{entry.date} {entry.time}</td><td>{entry.batch}</td><td>{entry.qtyChanged}</td>
                <td>{entry.finishedGoodsQuantity ?? 'Not recorded'}</td>
                <td>{entry.finishedGoodsQuantity == null ? 'Not recorded' : entry.qtyChanged - entry.finishedGoodsQuantity}</td>
              </tr>)}</tbody>
            </table></div></div> : <div className="helper-text">No production output has been recorded. Starting or scheduling a PO does not create output.</div>}
          </section>
          {viewPO.completedQty > 0 && viewPOMaterialUsage.length === 0 && (
            <div className="alert-warning mb-3">
              <strong>MATERIAL USAGE MISSING</strong>
              <div>Production output has been recorded, but no material usage is linked to this Production Order.</div>
              <button className="btn-secondary btn-compact mt-3" onClick={() => { setShowOutput(true); setReviewMaterials(true); }}>Review Materials</button>
            </div>
          )}
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setDocumentAction({ id: viewPO.id, autoPrint: false })}>View Document</button>
            <DocumentPrintButton className="btn-primary" recordId={viewPO.id} recordType="PRODUCTION ORDER" onClick={() => setDocumentAction({ id: viewPO.id, autoPrint: true })} />
            <button className="btn-secondary" onClick={() => setViewId(null)}>Close</button>
            {canRecordProduction(viewPO) && (
              <>
                {viewPO.status === 'In Production' && <button className="btn-primary" onClick={() => {
                  const result = startProduction(viewPO.id);
                  if (!result.success) setError(result.error || 'Production could not be started.');
                  else loadPelletBags();
                }}>Scan with Honeywell</button>}
                <button className="btn-primary" onClick={() => openProduction(viewPO)}>{['Ready', 'Scheduled'].includes(viewPO.status) ? 'Start Production' : 'Continue / Record Output'}</button>
              </>
            )}
          </div>
        </Modal>
      )}
      <DocumentViewer open={!!documentAction} document={documentPO ? productionOrderDocument(documentPO) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />

      {/* Record Output */}
      {showOutput && viewPO && (
        <Modal draft={{ outputQty, rejectQty, rejections }} dirty={!saved && !!(outputQty || rejectQty || rejections.length)} open title="Record Production Output" onClose={closeOutput} width="720px">
          <section className="app-card detail-card mb-3">
            <div className="section-title">Production Order</div>
            <div className="responsive-grid">
              <div>
                <div className="field-label">PO</div>
                <div className="field-value font-mono text-blue">
                  <RecordReference value={viewPO.poNo} />
                </div>
              </div>
              <div>
                <div className="field-label">Product</div>
                <div className="field-value">{viewPO.product}</div>
              </div>
              <div>
                <div className="field-label">Diameter / Size</div>
                <div className="field-value">{viewPO.diameter}</div>
              </div>
              <div>
                <div className="field-label">SDR / Thickness</div>
                <div className="field-value">{viewPO.sdr}</div>
                <div className="field-label">Origin Group (read-only)</div><div className="field-value">{productionOriginGroup(viewPO, app) || 'Not Resolved'}</div>
              </div>
              <div>
                <div className="field-label">Length</div>
                <div className="field-value">{viewPO.length}</div>
              </div>
              <div>
                <div className="field-label">Material Grade</div>
                <div className="field-value">{viewPO.grade}</div>
              </div>
              <div>
                <div className="field-label">Color</div>
                <div className="field-value">{viewPO.color}</div>
              </div>
              <div>
                <div className="field-label">Stripe</div>
                <div className="field-value">{viewPO.stripe}</div>
              </div>
              <div>
                <div className="field-label">Construction</div>
                <div className="field-value">{viewPO.construction}</div>
              </div>
              <div>
                <div className="field-label">Form</div>
                <div className="field-value">{viewPO.productForm}</div>
              </div>
              <div>
                <div className="field-label">Target</div>
                <div className="field-value font-mono">{viewPO.targetQty}</div>
              </div>
              <div>
                <div className="field-label">Previously Completed</div>
                <div className="field-value font-mono">
                  {viewPO.completedQty}
                </div>
              </div>
              <div>
                <div className="field-label">Remaining</div>
                <div className="field-value font-mono">
                  {Math.max(0, viewPO.targetQty - viewPO.completedQty)}
                </div>
              </div>
            </div>
          </section>
          <div className="section-title">Output</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                Output Quantity (units){" "}
                <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input className="app-input" type="number" min="1" value={outputQty} onChange={e => setOutputQty(e.target.value)} placeholder="Enter total completed before rejects" style={{ fontFamily: 'JetBrains Mono, monospace' }} />
            </div>
          </div>
          <div style={{ border: '1px solid var(--card-border)', borderRadius: 6, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Quality Check</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Rejected Quantity</label>
                <input className="app-input" type="number" min="0" value={rejectQty} onChange={e => updateRejectedQuantity(e.target.value)} placeholder="0" />
              </div>
              <div>
                <div className="field-label">Good Output</div>
                <div className="field-value">
                  {Math.max(0, (Number(outputQty) || 0) - (Number(rejectQty) || 0))}
                </div>
              </div>
            </div>
            {rejections.length > 0 && (
              <div className="form-grid mt-3">
                {rejections.map((rejection, index) => (
                  <div key={index} className="app-card detail-card">
                    <div className="section-title">
                      Rejected Pipe {index + 1}
                    </div>
                    <label className="block-label" style={{ marginTop: 0 }}>Actual Weight (kg)
                  <input className="app-input" type="number" min="0.1" step="0.1" value={rejection.weight} onChange={event => setRejections(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, weight: event.target.value } : item))} placeholder="Enter actual weight" />
                </label>
                    <label className="block-label">
                      Reject Reason
                      <SearchableDropdown
                        className="app-select" style={{ width: '100%' }} value={rejection.reason} onChange={event => setRejections(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reason: event.target.value } : item))}
                      >
                        <option value="">Select reason</option>
                        {['Surface Defect', 'Incorrect Diameter', 'Incorrect Thickness', 'Incorrect Length', 'Cracked', 'Deformed', 'Color Problem', 'Stripe Problem', 'Weight Problem', 'Other'].map(reason => <option key={reason}>{reason}</option>)}
                      </SearchableDropdown>
                    </label>
                  </div>
                ))}
              </div>
            )}
            <div className="helper-text">Good Output is calculated automatically: Completed − Rejected. Only good pipes receive finished-goods barcodes.</div>
          </div>
          <section className="app-card detail-card mb-3">
            <div className="section-title">Read-only Material Preview</div>
            <div className="responsive-grid">
              <div>
                <div className="field-label">Output / Good / Rejected</div>
                <div className="field-value">
                  {outputCount} /{" "}
                  {Math.max(0, outputCount - (Number(rejectQty) || 0))} /{" "}
                  {Number(rejectQty) || 0}
                </div>
              </div>
              <div>
                <div className="field-label">Estimated Unit Weight</div>
                <div className="field-value font-mono">
                  {unitWeightConfigured ? `${materialPlan!.unitWeightKg.toFixed(3)} kg` : 'UNIT WEIGHT CONFIGURATION REQUIRED'}
                </div>
                <div className="helper-text">
                  {materialPlan?.unitWeightSource}
                </div>
              </div>
              <div>
                <div className="field-label">Total Physical Pipe Material</div>
                <div className="field-value font-mono">
                  {materialPlan?.physicalPipeMaterialKg.toFixed(3) || "0.000"}{" "}
                  kg
                </div>
              </div>
              <div>
                <div className="field-label">Pellet / Resin Required</div>
                <div className="field-value font-mono">
                  {materialPlan?.pelletRequiredKg.toFixed(3) || "0.000"} kg
                </div>
              </div>
              <div>
                <div className="field-label">Base Colorant</div>
                <div className="field-value">
                  {baseColorant?.name || viewPO.color} ·{" "}
                  {materialPlan?.baseColorantKg.toFixed(3) || "0.000"} kg
                </div>
                <div className="helper-text">
                  {(baseColorant?.availableKg || 0).toFixed(3)} kg available
                </div>
              </div>
              <div>
                <div className="field-label">Stripe Colorant</div>
                <div className="field-value">
                  {stripeRequired ? `${stripeColorant?.name || viewPO.stripe} · ${materialPlan?.stripeColorantKg.toFixed(3) || '0.000'} kg` : 'Not Required'}
                </div>
                {stripeRequired && (
                  <div className="helper-text">
                    {(stripeColorant?.availableKg || 0).toFixed(3)} kg available
                  </div>
                )}
              </div>
              <div>
                <div className="field-label">Production Process Loss</div>
                <div className="field-value font-mono">
                  {materialPlan?.processLossKg.toFixed(3) || "0.000"} kg
                </div>
                <div className="helper-text">Auto-calculated from consumed material versus physical output; theoretical usage currently reconciles to zero.</div>
              </div>
              <div>
                <div className="field-label">Total Material Consumed</div>
                <div className="field-value font-mono">
                  {materialPlan?.totalMaterialConsumedKg.toFixed(3) || '0.000'}{" "}
                  kg
                </div>
              </div>
              <div>
                <div className="field-label">Virgin WIP</div>
                <div className="field-value">
                  {loadedWipBags.filter(item => item.type === 'Virgin').length}{" "}
                  bags · {virginWip.toFixed(3)} kg
                </div>
              </div>
              <div>
                <div className="field-label">Recycled WIP</div>
                <div className="field-value">
                  {loadedWipBags.filter(item => item.type === 'Recycled').length}{" "}
                  bags · {recycledWip.toFixed(3)} kg
                </div>
              </div>
              <div>
                <div className="field-label">WIP Pellet Available</div>
                <div className="field-value font-mono">
                  {wipAvailable.toFixed(3)} kg
                </div>
              </div>
              <div>
                <div className="field-label">Pellet Balance After Output</div>
                <div className="field-value font-mono">
                  {Math.max(0, wipAvailable - (materialPlan?.pelletRequiredKg || 0)).toFixed(3)}{" "}
                  kg
                </div>
              </div>
            </div>
            <div className="helper-text mt-3">Pellet capacity uses unit pipe weight only. Colorants are tracked separately and use clearly marked TEST rates until an approved HPAI BOM or recipe is available. Nothing is deducted until Record Output succeeds.</div>
          </section>
          {!validMaterials && <div className="alert-warning mb-3">
            <strong>MATERIAL USAGE MISSING</strong>
            <div>Load production materials before recording output.</div>
            <button className="btn-secondary btn-compact mt-3" onClick={() => setReviewMaterials(current => !current)}>Review Materials</button>
          </div>}
          {reviewMaterials && (
            <section className="app-card detail-card mb-3">
              <div className="section-title">Current PO / Shift / Attendance Session</div>
              <div className="responsive-grid mb-3">
                <div>
                  <div className="field-label">PO Number</div>
                  <div className="field-value font-mono"><RecordReference value={viewPO.poNo} /></div>
                </div>
                <div>
                  <div className="field-label">Shift</div>
                  <div className="field-value">
                    {activeAttendance?.shift || "—"}
                  </div>
                </div>
                <div>
                  <div className="field-label">Attendance Session</div>
                  <div className="field-value font-mono">
                    {activeAttendance?.id || "—"}
                  </div>
                </div>
                <div>
                  <div className="field-label">Specifications</div>
                  <div className="field-value">
                    {viewPO.diameter} · {viewPO.sdr} · {viewPO.length} ·{" "}
                    {viewPO.grade}
                  </div>
                </div>
              </div>
              <div className="button-group mb-3">
              <ActionButton className="btn-primary btn-compact" onClick={loadPelletBags}>Load Pellet Bags</ActionButton>
            </div>
              <div className="alert-info mb-3">Base and stripe colorants are selected from the PO and linked automatically with the first successful pellet-bag load.</div>
              <div className="button-group">
              {materialReviewRequest && <button className="btn-secondary btn-compact" onClick={returnFromMaterialReview}>Return to Shift Turnover</button>}
            </div>
            </section>
          )}
          {saved && <div className="alert-success mb-3" style={{ fontSize: 12 }}>Output recorded successfully.</div>}
          {error &&
            (error.startsWith("MATERIAL USAGE MISSING|") ? (
              <div className="alert-warning mb-3">
                <strong>MATERIAL USAGE MISSING</strong>
                <div>{error.split("|")[1]}</div>
                <button className="btn-secondary btn-compact mt-3" onClick={() => setReviewMaterials(true)}>Review Materials</button>
              </div>
            ) : error.startsWith("INSUFFICIENT MATERIAL|") ? (
              <div className="alert-error mb-3">
                <strong>INSUFFICIENT MATERIAL</strong>
                {error.split('|').slice(1).map(line => <div key={line}>{line}</div>)}
                <div className="button-group mt-3">
                  <ActionButton className="btn-secondary btn-compact" onClick={loadPelletBags}>Load More Materials</ActionButton>
                  <DismissButton className="btn-secondary btn-compact" onClick={() => setError('')}>Cancel</DismissButton>
                </div>
              </div>
            ) : (
              <div className="alert-error mb-3" style={{ whiteSpace: 'pre-line' }}>
                {error.split("|").join("\n")}
              </div>
            ))}
          <div className="form-actions">
            <DismissButton className="btn-secondary" onClick={closeOutput}>Cancel</DismissButton>
            <ActionButton className="btn-primary" disabled={submitting || !validMaterials} onClick={handleSaveOutput}>
              {submitting ? "Recording…" : "Record Output"}
            </ActionButton>
          </div>
        </Modal>
      )}
    </div>
  )
}
