import ActionButton from '../../components/ActionButton';
import { DismissButton } from '../../components/ActionButton';
import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useEffect, useState } from "react"

import { formatProductionTime, useApp } from "../../store"

import Modal from "../../components/Modal"

const TURNOVER_DRAFT_KEY = "hpai:shift-turnover-draft"

const MATERIAL_REVIEW_KEY = "hpai:material-review-request"

const LINE_CONDITIONS = ['Normal', 'Running Normally', 'Needs Observation', 'Requires Adjustment', 'Minor Issue', 'Maintenance Required', 'Stopped / Not Operational', 'Other'] as const;

const ISSUE_CATEGORIES = ['No Issues Encountered', 'Machine / Equipment Issue', 'Material Issue', 'Quality Issue', 'Production Delay', 'Power / Electrical Issue', 'Safety Issue', 'Maintenance Issue', 'Barcode / Scanner Issue', 'System / Application Issue', 'Other'] as const;

const NEXT_ACTIONS = ['Continue Production', 'Continue Current PO', 'Check Machine Settings', 'Inspect Production Line', 'Load Required Materials', 'Check Remaining WIP', 'Perform Quality Check', 'Resolve Production Issue', 'Wait for Maintenance', 'Clean / Prepare Production Line', 'Review Product Specifications', 'Hold Production', 'Other'] as const;

const INSTRUCTION_TYPES = ['No Special Instructions', 'Safety', 'Quality', 'Machine / Equipment', 'Production', 'Material Handling', 'Product Specification', 'Maintenance', 'Customer / Order Priority', 'Other'] as const;

type TurnoverForm = {
  lineCondition: string;
  lineConditionOther: string;
  issueCategory: string;
  issueDetails: string;
  nextRequiredAction: string;
  nextRequiredActionOther: string;
  notesForIncoming: string;
  instructionType: string;
  importantInstructions: string;
};

const EMPTY_FORM: TurnoverForm = {
  lineCondition: 'Normal',
  lineConditionOther: '',
  issueCategory: 'No Issues Encountered',
  issueDetails: '',
  nextRequiredAction: 'Continue Current PO',
  nextRequiredActionOther: '',
  notesForIncoming: '',
  instructionType: 'No Special Instructions',
  importantInstructions: '',
};

function Field({ label, value }: { label: string ; value: React.ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  )
}

export default function ProductionShiftTurnover() {
  const {
    currentUser, currentShift, manufacturingOrders, orders,
    activeAttendance, activeProductionOrder, currentSessionTransactions, currentMaterialUsage,
    currentSessionTurnover, rejectedMaterials, pellets, navigate, submitTurnover, pendingTurnover, acceptTurnover,
  } = useApp();

  const po = activeProductionOrder

  const [form, setForm] = useState(() => {
    try {
      const draft = sessionStorage.getItem(TURNOVER_DRAFT_KEY);
      if (draft) return { ...EMPTY_FORM, ...JSON.parse(draft) } as TurnoverForm;
    } catch {
      // Use a clean form when browser session storage is unavailable.
    }
    return EMPTY_FORM;
  });

  const [error, setError] = useState("")

  const [confirming, setConfirming] = useState(false)

  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    sessionStorage.setItem(TURNOVER_DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (
    pendingTurnover && pendingTurnover.incomingShift === currentShift && pendingTurnover.outgoingEmployeeId !== currentUser?.employeeId
  ) {
    const pendingPo = manufacturingOrders.find(item => item.moNo === pendingTurnover.moRef);

    return (
      <div className="page-stack">
        <div className="alert-warning">
          <strong>PENDING SHIFT TURNOVER</strong>
          <div className="mt-1">Review the previous shift state before continuing production.</div>
        </div>
        <div className="app-card detail-card responsive-grid">
          <Field label="From" value={pendingTurnover.outgoingEmployee} />
          <Field label="Previous Shift" value={`${pendingTurnover.outgoingShift} Shift`} />
          <Field label="Production Order" value={pendingTurnover.poRef} />
          <Field label="Manufacturing Order" value={pendingTurnover.moRef || pendingPo?.moNo || '—'} />
          <Field label="Product" value={pendingTurnover.product || '—'} />
          <Field label="Specifications" value={pendingTurnover.specifications || '—'} />
          <Field label="Target Quantity" value={pendingTurnover.targetQty} />
          <Field label="Cumulative Completed" value={pendingTurnover.totalCompleted} />
          <Field label="PO Completed" value={pendingTurnover.totalCompleted} />
          <Field label="Produced Previous Shift" value={pendingTurnover.completedThisShift} />
          <Field label="Good" value={pendingTurnover.goodQty ?? Math.max(0, pendingTurnover.completedThisShift - pendingTurnover.rejectedQty)} />
          <Field label="Rejected" value={pendingTurnover.rejectedQty} />
          <Field label="Rejected Weight" value={`${pendingTurnover.rejectedKg} kg`} />
          <Field label="Remaining Quantity" value={pendingTurnover.remaining} />
          <Field label="Pellet Loaded" value={`${pendingTurnover.pelletLoaded} kg`} />
          <Field label="Pellet Consumed" value={`${pendingTurnover.totalPelletWeight ?? pendingTurnover.pelletUsed} kg`} />
          <Field label="Remaining WIP" value={`${pendingTurnover.pelletWipRemaining ?? Math.max(0, pendingTurnover.pelletLoaded - pendingTurnover.pelletUsed)} kg`} />
          <Field label="Material Grade" value={pendingTurnover.pelletType} />
          <Field label="Previous Clock Out" value={formatProductionTime(pendingTurnover.clockOut)} />
          <Field label="Production Line" value={pendingTurnover.productionLine} />
          <Field label="Production Stage" value={pendingTurnover.productionStage} />
          <Field label="Line Condition" value={pendingTurnover.lineConditionOther || pendingTurnover.lineCondition || pendingTurnover.machineCondition} />
          <Field label="Issue Category" value={pendingTurnover.issueCategory || (pendingTurnover.issuesEncountered ? 'Other' : 'No Issues Encountered')} />
          <Field label="Issue Details" value={pendingTurnover.issueDescription || pendingTurnover.issuesEncountered || 'No issues reported.'} />
          <Field label="Next Required Action" value={pendingTurnover.nextRequiredActionOther || pendingTurnover.nextRequiredAction || 'Continue Current PO'} />
          <Field label="Notes for Incoming Shift" value={pendingTurnover.notesForIncoming || 'None'} />
          <Field label="Instruction Type" value={pendingTurnover.instructionType || (pendingTurnover.importantInstructions ? 'Other' : 'No Special Instructions')} />
          <Field label="Important Instructions" value={pendingTurnover.importantInstructions || 'No special instructions.'} />
        </div>
        <div className="action-row">
          <ActionButton className="btn-success" onClick={() => { acceptTurnover(); navigate('prod-orders'); }}>Accept & Continue</ActionButton>
        </div>
      </div>
    )
  }

  if (currentSessionTurnover)
    return (
      <div className="page-stack">
        <div className="alert-info">
          <strong>SHIFT TURNOVER ALREADY COMPLETED</strong>
          <div className="mt-1">
            {currentSessionTurnover.turnoverNo} is already saved for this attendance session. A duplicate turnover will not be created.</div>
        </div>
        <div className="action-row">
          <button className="btn-primary" onClick={() => navigate('prod-clockout')}>Continue to Clock Out Confirmation</button>
        </div>
      </div>
    )

  if (!po) return <div className="app-card empty-state">No active production order requires turnover.</div>;

  const outputTx = currentSessionTransactions.filter(transaction => transaction.transactionType === 'Production Output' && transaction.reference === po.poNo);

  const completedThisShift = outputTx.reduce((sum, transaction) => sum + Math.max(0, transaction.qtyChanged), 0);

  const outputBatches = new Set(outputTx.map(transaction => transaction.batch));

  const shiftRejects = rejectedMaterials.filter(rejected => rejected.poRef === po.poNo && rejected.employee === currentUser?.name && outputBatches.has(rejected.batch));

  const rejectedQty = shiftRejects.reduce((sum, rejected) => sum + rejected.quantity, 0);

  const rejectedKg = shiftRejects.reduce((sum, rejected) => sum + rejected.weightKg, 0);

  const goodQty = Math.max(0, completedThisShift - rejectedQty);

  const pelletLoadedThisShift = currentSessionTransactions
    .filter(transaction => transaction.transactionType === 'Pellet Loaded' && transaction.productionOrderId === po.id)
    .reduce((sum, transaction) => sum + Math.abs(transaction.qtyChanged), 0);

  const pelletWipRemaining = pellets
    .filter(item => item.loadedForPOId === po.id && ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus))
    .reduce((sum, item) => sum + item.availableKg, 0);

  const processLossThisShift = outputTx.reduce((sum, transaction) => sum + (transaction.processLossKg || 0), 0);

  const rejectReasons = Object.entries(shiftRejects.reduce<Record<string, number>>((summary, rejected) => {
    summary[rejected.reason] = (summary[rejected.reason] || 0) + rejected.quantity;
    return summary;
  }, {}));

  const mo = manufacturingOrders.find(item => item.moNo === po.moRef);

  const order = orders.find(item => item.orderNo === mo?.orderRef);

  const update = (key: keyof TurnoverForm, value: string) => setForm(v => ({ ...v, [key]: value }));

  const materialUsageIncomplete = completedThisShift > 0 && (
    currentMaterialUsage.totalPelletWeightKg <= 0
    || currentMaterialUsage.baseColorantWeightKg <= 0
    || (po.stripe !== 'No Stripe' && currentMaterialUsage.stripeColorantWeightKg <= 0)
  );

  const reviewMaterials = () => {
    sessionStorage.setItem(MATERIAL_REVIEW_KEY, JSON.stringify({ poId: po.id, returnPage: 'prod-turnover' }));
    navigate('prod-orders');
  };

  const submit = () => {
    if (!activeAttendance) return setError('The active attendance session is no longer available.');
    if (materialUsageIncomplete) return setError('MATERIAL USAGE INCOMPLETE — Resolve missing material usage before finalizing this Shift Turnover.');
    if (form.lineCondition === 'Other' && !form.lineConditionOther.trim()) return setError('Specify the Line Condition.');
    if (form.issueCategory !== 'No Issues Encountered' && !form.issueDetails.trim()) return setError('Issue Details are required for the selected Issue Category.');
    if (form.nextRequiredAction === 'Other' && !form.nextRequiredActionOther.trim()) return setError('Specify the Next Required Action.');
    if (form.instructionType !== 'No Special Instructions' && !form.importantInstructions.trim()) return setError('Important Instructions are required for the selected Instruction Type.');
    setError('');
    setConfirming(true);
  };

  const confirm = () => {
    const result = submitTurnover({
      machineCondition: form.lineCondition === 'Maintenance Required'
        ? 'Maintenance Required'
        : ['Needs Observation', 'Requires Adjustment', 'Minor Issue', 'Stopped / Not Operational', 'Other'].includes(form.lineCondition)
          ? 'Needs Attention'
          : 'Normal',
      lineCondition: form.lineCondition,
      lineConditionOther: form.lineConditionOther,
      issueCategory: form.issueCategory,
      issueDescription: form.issueDetails,
      issuesEncountered: form.issueCategory === 'No Issues Encountered' ? 'No issues reported.' : form.issueDetails,
      nextRequiredAction: form.nextRequiredAction,
      nextRequiredActionOther: form.nextRequiredActionOther,
      notesForIncoming: form.notesForIncoming,
      instructionType: form.instructionType,
      importantInstructions: form.importantInstructions,
    }, po.id);
    if (!result.success) {
      setConfirming(false);
      setError(result.error || 'Shift Turnover could not be saved.');
      return;
    }
    sessionStorage.removeItem(TURNOVER_DRAFT_KEY);
  };

  return (
    <div className="page-stack">
      <div className="alert-info">Review the automatic shift summary, complete the handover notes, and confirm before the exact Clock Out time is captured.</div>
      <section className="app-card detail-card">
        <div className="section-title">Employee & Shift</div>
        <div className="responsive-grid">
          <Field label="Employee" value={currentUser?.name} />
          <Field label="Employee ID" value={currentUser?.employeeId} />
          <Field label="Current Shift" value={`${currentShift} Shift`} />
          <Field label="Next Shift" value={`${currentShift === 'Day' ? 'Night' : 'Day'} Shift`} />
          <Field label="Clock In" value={formatProductionTime(activeAttendance?.clockIn)} />
          <Field label="Current Time" value={currentTime.toLocaleString('en-PH')} />
        </div>
      </section>
      <section className="app-card detail-card">
        <div className="section-title">Production Order & Progress</div>
        <div className="responsive-grid">
          <Field label="Production Order" value={po.poNo} />
          <Field label="MO / Customer Order" value={`${po.moRef} / ${order?.orderNo || mo?.orderRef || '—'}`} />
          <Field label="Product" value={`${po.product} ${po.diameter} ${po.length}`} />
          <Field label="Specifications" value={`${po.sdr} · ${po.grade} · ${po.color} · ${po.stripe}`} />
          <Field label="Construction / Form" value={`${po.construction} · ${po.productForm}`} />
          <Field label="Production Line" value={po.productionLine} />
          <Field label="Target Quantity" value={po.targetQty} />
          <Field label="Total Completed" value={po.completedQty} />
          <Field label="Remaining Quantity" value={Math.max(0, po.targetQty - po.completedQty)} />
          <Field label="Current Production Stage" value={po.status} />
          <Field label="PO Status" value={po.status} />
        </div>
      </section>
      <section className="app-card detail-card">
        <div className="section-title">Automatic Production & Quality Summary</div>
        <div className="responsive-grid">
          <Field label="Produced This Shift" value={completedThisShift} />
          <Field label="Rejected This Shift" value={rejectedQty} />
          <Field label="Good Output This Shift" value={goodQty} />
          <Field label="Rejected Weight" value={`${rejectedKg.toFixed(1)} kg`} />
          <Field label="PO Total Completed" value={po.completedQty} />
          <Field label="PO Remaining" value={Math.max(0, po.targetQty - po.completedQty)} />
          <Field label="Reject Reasons" value={rejectReasons.length ? rejectReasons.map(([reason, count]) => `${reason}: ${count}`).join(' · ') : 'None'} />
        </div>
      </section>
      <section className="app-card detail-card">
        <div className="section-title">Automatic Material Usage</div>
        <div className="responsive-grid">
          <Field label="Virgin Pellet Bags Used" value={currentMaterialUsage.virginBags} />
          <Field label="Virgin Pellet Weight" value={`${currentMaterialUsage.virginWeightKg} kg`} />
          <Field label="Recycled Pellet Bags Used" value={currentMaterialUsage.recycledBags} />
          <Field label="Recycled Pellet Weight" value={`${currentMaterialUsage.recycledWeightKg} kg`} />
          <Field label="Base Colorant Used" value={`${currentMaterialUsage.baseColorantWeightKg} kg`} />
          <Field label="Base Colorant" value={currentMaterialUsage.baseColorantNames.join(', ') || 'None recorded'} />
          <Field label="Stripe Colorant Used" value={po.stripe === 'No Stripe' ? 'Not Required' : `${currentMaterialUsage.stripeColorantWeightKg} kg`} />
          <Field label="Stripe Colorant" value={po.stripe === 'No Stripe' ? 'Not Required' : currentMaterialUsage.stripeColorantNames.join(', ') || 'None recorded'} />
          <Field label="Pellet Loaded This Shift" value={`${pelletLoadedThisShift.toFixed(3)} kg`} />
          <Field label="WIP Pellet Remaining" value={`${pelletWipRemaining.toFixed(3)} kg`} />
          <Field label="Pellet Consumed This Shift" value={`${currentMaterialUsage.totalPelletWeightKg.toFixed(3)} kg`} />
          <Field label="Process Loss This Shift" value={`${processLossThisShift.toFixed(3)} kg`} />
        </div>
        <div className="material-usage-group material-summary">
          <div className="section-title">Summary</div>
          <div className="material-summary-metrics">
            <Field label="Total Pellet Weight" value={`${currentMaterialUsage.totalPelletWeightKg} kg`} />
            <Field label="Total Colorant Weight" value={`${currentMaterialUsage.colorantWeightKg} kg`} />
            <Field label="Total Material Weight" value={`${currentMaterialUsage.totalMaterialWeightKg} kg`} />
          </div>
        </div>
      </section>
      {materialUsageIncomplete && (
        <div className="alert-warning">
          <strong>MATERIAL USAGE INCOMPLETE</strong>
          <div>Resolve missing material usage before finalizing this Shift Turnover.</div>
          <button className="btn-secondary btn-compact mt-3" onClick={reviewMaterials}>Review Materials</button>
        </div>
      )}
      <section className="app-card detail-card">
        <div className="section-title">Manual Shift Notes</div>
        <div className="form-grid">
          <label>
            Line Condition
            <SearchableDropdown
              className="app-select" value={form.lineCondition} onChange={e => update('lineCondition', e.target.value)}
            >
              {LINE_CONDITIONS.map(option => <option key={option}>{option}</option>)}
            </SearchableDropdown>
          </label>
          <label>
            Issue Category
            <SearchableDropdown
              className="app-select" value={form.issueCategory} onChange={e => update('issueCategory', e.target.value)}
            >
              {ISSUE_CATEGORIES.map(option => <option key={option}>{option}</option>)}
            </SearchableDropdown>
          </label>
          {form.lineCondition === "Other" && (
            <label>
              Specify Line Condition
              <input className="app-input" value={form.lineConditionOther} onChange={e => update('lineConditionOther', e.target.value)} placeholder="Enter details" />
            </label>
          )}
          <label>
            Next Required Action
            <SearchableDropdown
              className="app-select" value={form.nextRequiredAction} onChange={e => update('nextRequiredAction', e.target.value)}
            >
              {NEXT_ACTIONS.map(option => <option key={option}>{option}</option>)}
            </SearchableDropdown>
          </label>
          {form.nextRequiredAction === "Other" && (
            <label>
              Specify Next Action
              <input className="app-input" value={form.nextRequiredActionOther} onChange={e => update('nextRequiredActionOther', e.target.value)} placeholder="Enter required action" />
            </label>
          )}
          <label>
            Instruction Type
            <SearchableDropdown
              className="app-select" value={form.instructionType} onChange={e => update('instructionType', e.target.value)}
            >
              {INSTRUCTION_TYPES.map(option => <option key={option}>{option}</option>)}
            </SearchableDropdown>
          </label>
        </div>
        {form.issueCategory !== "No Issues Encountered" && (
          <label className="block-label">
            Issue Details
            <textarea className="app-input" rows={3} required value={form.issueDetails} onChange={e => update('issueDetails', e.target.value)} placeholder="Enter issue details" />
          </label>
        )}
        {form.issueCategory === 'No Issues Encountered' && <div className="helper-text">No issues reported. Issue Details are optional.</div>}
        <label className="block-label">
          Notes for Incoming Shift
          <textarea className="app-input" rows={3} value={form.notesForIncoming} onChange={e => update('notesForIncoming', e.target.value)} placeholder="Additional details for the incoming shift" />
        </label>
        {form.instructionType !== "No Special Instructions" && (
          <label className="block-label">
            Important Instructions for Next Shift
            <textarea className="app-input" rows={3} required value={form.importantInstructions} onChange={e => update('importantInstructions', e.target.value)} placeholder="Enter specific safety, quality, or operating instructions" />
          </label>
        )}
        {form.instructionType === 'No Special Instructions' && <div className="helper-text">No special instructions. Additional instruction details are optional.</div>}
        {error && <div className="alert-error mt-3">{error}</div>}
      </section>
      <div className="action-row">
        <button className="btn-secondary" onClick={() => navigate('production-dashboard')}>Cancel</button>
        <button className="btn-primary" onClick={submit}>Submit Turnover & Clock Out</button>
      </div>
      <Modal open={confirming} title="CONFIRM SHIFT TURNOVER & CLOCK OUT" onClose={() => setConfirming(false)} width="640px">
        <div className="page-stack">
          <div className="responsive-grid">
            <Field label="Employee" value={currentUser?.name} />
            <Field label="Shift" value={`${currentShift} Shift`} />
            <Field label="Clock In" value={formatProductionTime(activeAttendance?.clockIn)} />
            <Field label="PO" value={po.poNo} />
            <Field label="Produced This Shift" value={completedThisShift} />
            <Field label="Good" value={goodQty} />
            <Field label="Rejected" value={rejectedQty} />
            <Field label="Rejected Weight" value={`${rejectedKg.toFixed(1)} kg`} />
            <Field label="Total Materials Used" value={`${currentMaterialUsage.totalMaterialWeightKg} kg`} />
            <Field label="PO Remaining" value={Math.max(0, po.targetQty - po.completedQty)} />
            <Field label="Line Condition" value={form.lineConditionOther || form.lineCondition} />
            <Field label="Issue Category" value={form.issueCategory} />
            <Field label="Issue Details" value={form.issueDetails || 'No issues reported.'} />
            <Field label="Next Required Action" value={form.nextRequiredActionOther || form.nextRequiredAction} />
            <Field label="Notes" value={form.notesForIncoming || 'None'} />
            <Field label="Instruction Type" value={form.instructionType} />
            <Field label="Instructions" value={form.importantInstructions || 'No special instructions.'} />
          </div>
          <div className="alert-warning">Submit this Shift Turnover and Clock Out? The Clock Out timestamp will be captured only after confirmation.</div>
          <div className="form-actions">
            <DismissButton className="btn-secondary" onClick={() => setConfirming(false)}>Back to Edit</DismissButton>
            <ActionButton className="btn-primary" onClick={confirm}>Confirm Turnover & Clock Out</ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
