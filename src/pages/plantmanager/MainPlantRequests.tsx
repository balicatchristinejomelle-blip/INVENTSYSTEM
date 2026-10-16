import PeriodSelector, { dateInPeriod, usePeriod } from '../../components/PeriodSelector';
import RecordReference from '../../components/RecordReference';
import { useViewState } from '../../uiViewState';
import { TableBody } from '../../components/UXFeedback';
import { useCreatedRecordNotice } from '../../components/UXFeedback';
import { DismissButton } from '../../components/ActionButton';
import ActionButton from '../../components/ActionButton';
import { withPrintSearch } from '../../printableRecords';
import DocumentPrintButton from '../../components/DocumentPrintButton';
import { matchesRecord } from "../../components/RecordSearch"

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useEffect, useMemo, useState } from "react"

import { useApp } from "../../store"

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

import CategoryTabs from "../../components/CategoryTabs"

import {
  BASE_COLORANTS,
  MATERIAL_GRADES,
  MATERIAL_REQUEST_CATEGORIES,
  STRIPE_COLORANTS,
  requestCategory,
  type MaterialRequestCategory,
} from '../../inventoryCategories';

import DocumentViewer from "../../components/DocumentViewer"

import { materialRequestDocument } from '../../documentPrint';

import Pagination, { pageRecords } from '../../components/Pagination';

import SearchableSelect from '../../components/SearchableSelect';

type RequestTab = "All" | MaterialRequestCategory

const REQUEST_TABS: readonly RequestTab[] = ['All', ...MATERIAL_REQUEST_CATEGORIES];

function nextRefNo(existing: { refNo: string }[]): string {
  const next = Math.max(18, ...existing.map(item => Number(item.refNo.split('-').pop()) || 0)) + 1;
  return `MR-2026-${String(next).padStart(4, '0')}`;
}

export default function MainPlantRequests() {
  const app = useApp();
  const { materialRequests, productionOrders, addMaterialRequest, currentUser } = app;
  const creationNotice = useCreatedRecordNotice(materialRequests, record => record.refNo);

  const [tab, setTab] = useViewState<RequestTab>("plantmanager/MainPlantRequests:tab", "All")

  const [search, setSearch] = useViewState("plantmanager/MainPlantRequests:search", "")
  const period = usePeriod('all', search);

  const [page, setPage] = useViewState("plantmanager/MainPlantRequests:page", 1)

  const [viewId, setViewId] = useState<string | null>(null)

  const [showNew, setShowNew] = useState(false)

  const [category, setCategory] = useState<MaterialRequestCategory>('Virgin Pellet');

  const [poId, setPoId] = useState("")

  const [grade, setGrade] = useState<string>("PE100")

  const [bags, setBags] = useState("")

  const [usageType, setUsageType] = useState<'BASE_COLORANT' | 'STRIPE_COLORANT'>('BASE_COLORANT');

  const [color, setColor] = useState<string>("Black (BK)")
  const [recycledColor, setRecycledColor] = useState('');

  const [quantityKg, setQuantityKg] = useState("")

  const [notes, setNotes] = useState("")

  const [error, setError] = useState("")

  const [documentAction, setDocumentAction] = useState<{ id: string; autoPrint: boolean } | null>(null);

  const [replenishmentContext, setReplenishmentContext] = useState<{ current: number; minimum: number; target: number; suggestedKg: number; bags?: number } | null>(null);

  useEffect(() => {
    try {
      const viewId = window.sessionStorage.getItem('hpai:material-request-view-v1');
      if (viewId) { setViewId(viewId); window.sessionStorage.removeItem('hpai:material-request-view-v1'); }
      const stored = window.sessionStorage.getItem('hpai:material-request-intent-v1');
      if (!stored) return;
      const intent = JSON.parse(stored) as { category: MaterialRequestCategory; grade?: string; color?: string; usageType?: 'BASE_COLORANT' | 'STRIPE_COLORANT'; current: number; minimum: number; target: number; suggestedKg: number; bags?: number };
      setCategory(intent.category);
      if (intent.grade) setGrade(intent.grade);
      if (intent.color) setColor(intent.color);
      if (intent.category === 'Recycled Pellet' && intent.color) setRecycledColor(intent.color);
      if (intent.usageType) setUsageType(intent.usageType);
      if (intent.category === 'Colorant') setQuantityKg(String(intent.suggestedKg));
      else setBags(String(intent.bags || Math.ceil(intent.suggestedKg / 25)));
      setNotes(`Stock replenishment: current ${intent.current} kg, minimum ${intent.minimum} kg, target ${intent.target} kg.`);
      setReplenishmentContext(intent);
      setShowNew(true);
      window.sessionStorage.removeItem('hpai:material-request-intent-v1');
    } catch { window.sessionStorage.removeItem('hpai:material-request-intent-v1'); }
  }, []);

  const activePOs = productionOrders.filter(po => !['Completed', 'Cancelled'].includes(po.status));

  const selectedPO = productionOrders.find(po => po.id === poId);

  const filtered = materialRequests.filter(
    (request) =>
      dateInPeriod(request.date, period.range) && (tab === "All" || requestCategory(request) === tab) &&
      ([request.refNo, request.grade, request.color, request.poRef || '', request.destination || '', request.status].some(value => value.toLowerCase().includes(search.toLowerCase())) ||
        matchesRecord(withPrintSearch(app, request), search)),
  )

  const detail = materialRequests.find(request => request.id === viewId);

  const documentRequest = materialRequests.find(request => request.id === documentAction?.id);

  const requestedBags = Number(bags)

  const requestedKg = category === 'Colorant' ? Number(quantityKg) : requestedBags * 25;

  const colors = usageType === 'BASE_COLORANT' ? BASE_COLORANTS : STRIPE_COLORANTS;

  const counts = useMemo(() => Object.fromEntries(REQUEST_TABS.map(item => [
    item,
    item === 'All' ? materialRequests.length : materialRequests.filter(request => requestCategory(request) === item).length,
  ])), [materialRequests]);

  const choosePO = (id: string) => {
    setPoId(id);
    const po = productionOrders.find(item => item.id === id);
    if (!po) return;
    setGrade(po.grade);
    const remainingKg = Math.max(0, po.requiredKg - po.loadedKg);
    setBags(remainingKg > 0 ? String(Math.ceil(remainingKg / 25)) : '');
    if (category === 'Colorant') {
      setUsageType('BASE_COLORANT');
      setColor(po.color);
    }
  };

  const chooseCategory = (next: MaterialRequestCategory) => {
    setCategory(next);
    setError('');
    if (next === 'Colorant' && selectedPO) {
      setUsageType('BASE_COLORANT');
      setColor(selectedPO.color);
    }
  };

  const submit = () => {
    if (category === 'Recycled Pellet' && !recycledColor.trim()) { setError('Enter the recycled pellet color.'); return; }
    if (category !== 'Colorant' && (!Number.isInteger(requestedBags) || requestedBags <= 0)) {
      setError('Requested complete bags must be a positive whole number.');
      return;
    }
    if (category === 'Colorant' && (!Number.isFinite(requestedKg) || requestedKg <= 0)) {
      setError('Requested colorant quantity must be greater than 0 kg.');
      return;
    }
    const result = addMaterialRequest({
      refNo: nextRefNo(materialRequests),
      date: new Date().toISOString().slice(0, 10),
      requestedBy: currentUser?.name || 'Plant Manager',
      materialCategory: category,
      pelletType: category === 'Recycled Pellet' ? 'Recycled' : 'Virgin',
      grade: category === 'Colorant' ? selectedPO?.grade || 'Not applicable' : grade,
      color: category === 'Colorant' ? color : category === 'Virgin Pellet' ? 'White' : recycledColor.trim(),
      requestedKg,
      requestedBags: category === 'Colorant' ? undefined : requestedBags,
      colorantUsageType: category === 'Colorant' ? usageType : undefined,
      destination: 'Branch Plant',
      status: 'New',
      notes: notes.trim() || undefined,
      poRef: selectedPO?.poNo,
      moRef: selectedPO?.moRef,
    });
    if (!result.success) { setError(result.error || 'Unable to submit Material Request.'); return; }
    setShowNew(false);
    setBags('');
    setQuantityKg('');
    setNotes('');
    setError('');
    setReplenishmentContext(null);
  };

  return (
    <div className="page-stack">
      {creationNotice.message && <div className="alert-success" role="status">{creationNotice.message}</div>}
      <div className="category-panel-header">
        <div>
          <div className="section-title">Materials & Requests</div>
          <div className="helper-text">Requests are separated by physical pellet bags and kg-based colorants.</div>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>New Material Request</button>
      </div>

      <CategoryTabs items={REQUEST_TABS} value={tab} onChange={value => { setTab(value); setPage(1); }} counts={counts} label="Material request category" />
      <div className="record-filter-bar">
        <PeriodSelector period={period} search={search} onSearchChange={value => { setSearch(value); setPage(1); }} onDateChange={() => { setPage(1); }} />
      </div>

      <div className="app-card table-scroll">
        <table className="app-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Category</th>
              <th>Material</th>
              <th>Requested Quantity</th>
              <th className="po-column">PO</th>
              <th>Destination</th>
              <th>Status</th>
              <th data-actions>Action</th>
            </tr>
          </thead>
          <TableBody>
            {pageRecords(filtered, page).map((request) => {
              const requestType = requestCategory(request)

              return (
                <tr key={request.id}>
                  <td>
                    <span className="font-mono"><RecordReference value={request.refNo} /></span>
                    <br />
                    <small>{request.date}</small>
                  </td>
                  <td>{requestType}</td>
                  <td>
                    {requestType === 'Colorant' ? `${request.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe' : 'Base'} · ${request.color}` : request.grade}
                  </td>
                  <td className="font-mono">
                    {requestType === 'Colorant' ? `${request.requestedKg} kg` : `${request.requestedBags ?? request.requestedKg / 25} bags · ${request.requestedKg} kg`}
                  </td>
                  <td className="font-mono po-column">
                    {request.poRef || "Not PO-based"}
                  </td>
                  <td>{request.destination || "Branch Plant"}</td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>
                    <div className="button-group">
                      <button className="btn-secondary btn-compact" onClick={() => setViewId(request.id)}>View Details</button>
                      <DocumentPrintButton className="btn-secondary btn-compact" recordId={request.id} recordType="MATERIAL REQUEST" onClick={() => setDocumentAction({ id: request.id, autoPrint: true })} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </TableBody>
        </table>
      </div>
      <Pagination page={page} totalRecords={filtered.length} onPageChange={setPage} noun="material requests" />

      {detail && (
        <Modal open title={`Material Request — ${detail.refNo}`} onClose={() => setViewId(null)} width="620px">
          <div className="responsive-grid">
          <Info label="Category" value={requestCategory(detail)} />
          <Info label="Requested By" value={detail.requestedBy} />
          {requestCategory(detail) === 'Colorant' ? <>
            <Info label="Usage" value={detail.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe Colorant' : 'Base Colorant'} />
            <Info label="Color" value={detail.color} />
            <Info label="Quantity" value={`${detail.requestedKg} kg`} />
          </> : <>
            <Info label="Material Grade" value={detail.grade} />
            <Info label="Bags" value={detail.requestedBags ?? detail.requestedKg / 25} />
            <Info label="Weight" value={`${detail.requestedKg} kg`} />
          </>}
          <Info label="PO Number" value={detail.poRef || 'Not PO-based'} />
          <Info label="Destination" value={detail.destination || 'Branch Plant'} />
        </div>
          <div className="form-actions mt-4">
            <button className="btn-secondary" onClick={() => setDocumentAction({ id: detail.id, autoPrint: false })}>View Document</button>
            <DocumentPrintButton className="btn-primary" recordId={detail.id} recordType="MATERIAL REQUEST" onClick={() => setDocumentAction({ id: detail.id, autoPrint: true })} />
          </div>
        </Modal>
      )}
      <DocumentViewer open={!!documentAction} document={documentRequest ? materialRequestDocument(documentRequest) : null} autoPrint={documentAction?.autoPrint} onClose={() => setDocumentAction(null)} />

      {showNew && (
        <Modal draft={{ category, poId, grade, bags, usageType, color, recycledColor, quantityKg, notes }} open title="New Material Request" onClose={() => setShowNew(false)} width="680px">
          <div className="page-stack">
            {replenishmentContext && (
              <div className="alert-warning">
                <strong>Low-stock replenishment</strong>
                <div>
                  Current {replenishmentContext.current.toFixed(3)} kg · minimum{" "}
                  {replenishmentContext.minimum.toFixed(3)} kg · target{" "}
                  {replenishmentContext.target.toFixed(3)} kg · suggested{" "}
                  {replenishmentContext.suggestedKg.toFixed(3)} kg
                  {category !== 'Colorant' ? ` (${replenishmentContext.bags} complete 25 kg bags)` : ''}
                  . Creating this request does not change inventory.
                </div>
              </div>
            )}
            <label className="block-label">Material Category</label>
            <CategoryTabs items={MATERIAL_REQUEST_CATEGORIES} value={category} onChange={chooseCategory} label="Requested material category" />

            <label className="block-label">
              Active Production Order (optional)
              <SearchableDropdown
                className="app-select" value={poId} onChange={event => choosePO(event.target.value)}
              >
                <option value="">Manual request — no PO selected</option>
                {activePOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    <RecordReference value={po.poNo} /> · {po.product} · {po.grade}
                  </option>
                ))}
              </SearchableDropdown>
            </label>

            {selectedPO && (
              <div className="app-card detail-card">
                <div className="section-title">Production Order Requirements</div>
                <div className="responsive-grid">
              <Info label="PO Number" value={selectedPO.poNo} />
              <Info label="Product" value={selectedPO.product} />
              <Info label="Material Grade" value={selectedPO.grade} />
              <Info label="Pipe Color" value={selectedPO.color} />
              <Info label="Stripe Color" value={selectedPO.stripe} />
              <Info label="Remaining Pellet Requirement" value={`${Math.max(0, selectedPO.requiredKg - selectedPO.loadedKg).toFixed(1)} kg`} />
            </div>
                <div className="alert-info mt-3">
                  Identified materials: {selectedPO.grade} Virgin Pellet ·{" "}
                  {selectedPO.color} Base Colorant ·{" "}
                  {selectedPO.stripe === 'No Stripe' ? 'Stripe Colorant Not Required' : `${selectedPO.stripe.replace(' Stripe', '')} Stripe Colorant`}
                </div>
              </div>
            )}

            {category !== "Colorant" ? (
              <div className="form-grid">
                <label>
                  Material Grade
                  <SearchableDropdown
                    className="app-select" value={grade} onChange={event => setGrade(event.target.value)}
                  >
                    {MATERIAL_GRADES.map(item => <option key={item}>{item}</option>)}
                  </SearchableDropdown>
                </label>
                <label>Requested Complete Bags
              <input className="app-input" type="number" min="1" step="1" value={bags} onChange={event => setBags(event.target.value)} />
            </label>
                <label>Pellet Color
                  <input className="app-input" readOnly={category === 'Virgin Pellet'} value={category === 'Virgin Pellet' ? 'White' : recycledColor} required placeholder="Enter actual recycled color" onChange={event => setRecycledColor(event.target.value)} />
                </label>
                <Info label="Weight Per Bag" value="25 kg fixed" />
                <Info label="Total Requested Weight" value={`${Number.isFinite(requestedKg) ? requestedKg : 0} kg (automatic)`} />
              </div>
            ) : (
              <div className="form-grid">
                <label>
                  Colorant Usage Type
                  <SearchableDropdown
                    className="app-select" value={usageType} onChange={event => {
                const next = event.target.value as typeof usageType;
                setUsageType(next);
                setColor(next === 'BASE_COLORANT' ? BASE_COLORANTS[0] : STRIPE_COLORANTS[0]);
              }}
                  >
                    <option value="BASE_COLORANT">Base Colorant</option>
                    <option value="STRIPE_COLORANT" disabled={selectedPO?.stripe === 'No Stripe'}>Stripe Colorant</option>
                  </SearchableDropdown>
                </label>
                <label>
                  Color
                  <SearchableDropdown
                    className="app-select" value={color} onChange={event => setColor(event.target.value)}
                  >
                    {colors.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </SearchableDropdown>
                </label>
                <label>Requested Quantity (kg)
              <input className="app-input" type="number" min="0.001" step="0.001" value={quantityKg} onChange={event => setQuantityKg(event.target.value)} />
            </label>
              </div>
            )}

            <label className="block-label">Notes
            <textarea className="app-input" rows={2} value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
            {error && <div className="alert-error">{error}</div>}
            <div className="form-actions">
            <DismissButton className="btn-secondary" onClick={() => setShowNew(false)}>Cancel</DismissButton>
            <ActionButton className="btn-primary" onStart={creationNotice.begin} onClick={submit}>Submit Material Request</ActionButton>
          </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string ; value: React.ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  )
}
