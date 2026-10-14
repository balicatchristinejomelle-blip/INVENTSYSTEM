import { matchesRecord } from "../../components/RecordSearch"
import ProductFilters, { useProductFilters } from '../../components/ProductFilters';

import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useEffect, useMemo, useState } from "react"

import { useApp } from "../../store"

import {
  constructionForProduct, HPAI_PRODUCT_MASTER, lengthsForForm, normalizeProductSpecification, normalizeProductType, sizeLabelForProduct,
  sizesForProduct, specificationKey, specificationKeyFromRecord, specificationLength,
  sizeUnitForProduct,
} from '../../productMaster';

import type { MaterialGrade, ProductSpecification, ProductType, StockTarget, StorageLocation } from '../../types';

import Pagination, { pageRecords } from '../../components/Pagination';

import SearchableSelect from '../../components/SearchableSelect';

import StatusBadge from "../../components/StatusBadge"

import Modal from "../../components/Modal"

const TABS = ['General', 'Product Specifications', 'Stock Targets / Reorder Levels', 'Storage Locations', 'Notifications', 'Display'] as const;

type Tab = typeof TABS[number]

const INITIAL_LOCATIONS: StorageLocation[] = [
  { id: 'loc-a', name: 'Section A', plant: 'Branch Plant', locationType: 'Finished Goods Area', description: 'General pipe storage', status: 'Active' },
  { id: 'loc-b', name: 'Section B', plant: 'Branch Plant', locationType: 'Finished Goods Area', description: 'Large-diameter pipe storage', status: 'Active' },
  { id: 'loc-c', name: 'Section C', plant: 'Branch Plant', locationType: 'Raw Material Area', description: 'Pellet and raw-material staging', status: 'Active' },
];

const specificationLabel = (spec: ProductSpecification) =>
  `${spec.productType} · ${spec.materialGrade} · ${spec.size} · ${spec.sdr} · ${specificationLength(spec)} · ${spec.color} · ${spec.stripe}`;

function usePersistentState<T>(key: string, fallback: T, normalize?: (stored: unknown) => T) {
  const [value, setValue] = useState<T>(() => {
    try { const stored = window.localStorage.getItem(key); if (!stored) return fallback; const parsed: unknown = JSON.parse(stored); return normalize ? normalize(parsed) : parsed as T; }
    catch { return fallback; }
  });
  useEffect(() => { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Prototype remains usable in memory. */ } }, [key, value]);
  return [value, setValue] as const;
}

const SectionHeader = ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
  <div className="settings-section-header">
    <div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
    {action}
  </div>
)

export default function Settings() {
  const { orders, productionOrders, finishedGoods, pellets, colorants } = useApp();

  const [activeTab, setActiveTab] = useState<Tab>("General")

  const initialSpecifications = useMemo<ProductSpecification[]>(() => {
    const unique = new Map<string, ProductSpecification>();
    [...orders, ...productionOrders, ...finishedGoods].forEach((record, index) => {
      const productType = normalizeProductType(record.product);
      const productForm = record.productForm === 'Coil' ? 'Coil' : 'Straight Length';
      const spec: ProductSpecification = {
        id: `spec-${index + 1}`, productType, materialGrade: [...HPAI_PRODUCT_MASTER.materialGrades, 'PE80'].includes(record.grade) ? record.grade as ProductSpecification['materialGrade'] : 'PE100',
        size: record.diameter, sizeUnit: sizeUnitForProduct(productType), sdr: record.sdr, productForm,
        straightLength: productForm === 'Straight Length' ? record.length : undefined,
        coilLength: productForm === 'Coil' ? record.length : undefined,
        color: record.color, stripe: record.stripe, pipeConstruction: constructionForProduct(productType),
        unitWeightKg: 'unitWeightKg' in record ? record.unitWeightKg : undefined, active: true,
      };
      if (!unique.has(specificationKey(spec))) unique.set(specificationKey(spec), spec);
    });
    return Array.from(unique.values());
  }, [orders, productionOrders, finishedGoods]);

  const [specifications, setSpecifications] = usePersistentState<ProductSpecification[]>('hpai:product-specifications-v1', initialSpecifications, stored =>
    Array.isArray(stored) ? stored.map(normalizeProductSpecification).filter((item): item is ProductSpecification => item !== null) : initialSpecifications);

  const [stockTargets, setStockTargets] = usePersistentState<StockTarget[]>('hpai:stock-targets-v1', [], stored =>
    Array.isArray(stored) ? stored.map(item => ({ ...item, inventoryType: item.inventoryType || 'Finished Pipe' })) as StockTarget[] : []);

  const [locations, setLocations] = usePersistentState<StorageLocation[]>('hpai:storage-locations-v1', INITIAL_LOCATIONS);

  const [search, setSearch] = useState("")

  const [page, setPage] = useState(1)
  const productFilters = useProductFilters(() => setPage(1));

  const [feedback, setFeedback] = useState("")

  const [deactivate, setDeactivate] = useState<{ kind: 'spec' | 'location'; id: string; label: string } | null>(null);

  const [reason, setReason] = useState("")

  const [showSpecForm, setShowSpecForm] = useState(false)

  const [showTargetForm, setShowTargetForm] = useState(false)

  const [showLocationForm, setShowLocationForm] = useState(false);

  const [specForm, setSpecForm] = useState({ productType: '' as '' | ProductType, materialGrade: '' as '' | MaterialGrade, size: '', sdr: '', productForm: '' as '' | ProductSpecification['productForm'], length: '', color: '', stripe: '', pipeConstruction: '' as '' | ProductSpecification['pipeConstruction'], unitWeightKg: '' });

  const [targetForm, setTargetForm] = useState({ plant: 'Branch Plant' as 'Main Plant' | 'Branch Plant', inventoryType: 'Finished Pipe' as StockTarget['inventoryType'], productSpecificationId: '', materialGrade: 'PE100' as MaterialGrade, color: 'Black (BK)', colorantUsageType: 'BASE_COLORANT' as 'BASE_COLORANT' | 'STRIPE_COLORANT', minimumStock: '10', targetStock: '50' });

  const [locationForm, setLocationForm] = useState({ name: '', plant: 'Branch Plant' as 'Main Plant' | 'Branch Plant', locationType: 'Finished Goods Area' as StorageLocation['locationType'], description: '' });

  const [lowPelletEnabled, setLowPelletEnabled] = useState(true);

  const [turnoverReminderEnabled, setTurnoverReminderEnabled] = useState(true);

  const [behindScheduleEnabled, setBehindScheduleEnabled] = useState(true);

  const [fgReadyEnabled, setFgReadyEnabled] = useState(true)

  const [dateFormat, setDateFormat] = useState<'MM/DD/YYYY' | 'YYYY-MM-DD'>('MM/DD/YYYY');

  const [timeFormat, setTimeFormat] = useState<'12' | '24'>('12');

  const notifySaved = (message: string) => { setFeedback(message); window.setTimeout(() => setFeedback(''), 3000); };

  const filteredSpecs = specifications.filter((spec) =>
    productFilters.matches(spec) &&
    matchesRecord(
      {
        ...spec,
        length: specificationLength(spec),
        status: spec.active ? "Active" : "Inactive",
      },
      search,
    ),
  )

  const filteredLocations = locations.filter(
    (location) =>
      !search.trim() || [location.name, location.plant, location.locationType, location.description, location.status].some(value => value?.toLowerCase().includes(search.trim().toLowerCase())) ||
        matchesRecord(location, search),
  )

  const currentForTarget = (target: StockTarget) => {
    if (target.inventoryType === 'Finished Pipe') {
      const spec = specifications.find(item => item.id === target.productSpecificationId);
      return spec ? finishedGoods.filter(item => item.status === 'Available' && item.releaseStatus !== 'Released' && specificationKeyFromRecord(item) === specificationKey(spec)).reduce((sum, item) => sum + item.quantity, 0) : 0;
    }
    if (target.inventoryType === 'Colorant') return colorants.filter(item => item.color === target.color && item.usageType === target.colorantUsageType).reduce((sum, item) => sum + item.availableKg, 0);
    const pelletType = target.inventoryType === 'Virgin Pellet' ? 'Virgin' : 'Recycled';
    return pellets.filter(item => item.type === pelletType && item.grade === target.materialGrade && item.availableKg > 0).reduce((sum, item) => sum + item.availableKg, 0);
  };

  const targetLabel = (target: StockTarget) => {
    if (target.inventoryType === 'Finished Pipe') { const spec = specifications.find(item => item.id === target.productSpecificationId); return spec ? specificationLabel(spec) : 'Missing Product Specification'; }
    if (target.inventoryType === 'Colorant') return `${target.color} · ${target.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe Colorant' : 'Base Colorant'}`;
    return `${target.materialGrade} · 25 kg physical bags`;
  };

  const filteredTargets = stockTargets.filter(target => (!Object.values(productFilters.value).some(Boolean) || (target.inventoryType === 'Finished Pipe' && specifications.some(spec => spec.id === target.productSpecificationId && productFilters.matches(spec)))) && (!search.trim() || `${target.plant} ${target.inventoryType} ${targetLabel(target)} ${target.status}`.toLowerCase().includes(search.trim().toLowerCase())));

  const createSpecification = () => {
    if (!specForm.productType || !specForm.materialGrade || !specForm.size || !specForm.sdr || !specForm.productForm || !specForm.length || !specForm.color || !specForm.stripe || !specForm.pipeConstruction) return notifySaved('Complete every required Product Specification field.');
    const candidate: ProductSpecification = {
      id: `spec-${Date.now()}`, productType: specForm.productType, materialGrade: specForm.materialGrade,
      size: specForm.size, sizeUnit: sizeUnitForProduct(specForm.productType), sdr: specForm.sdr, productForm: specForm.productForm,
      straightLength: specForm.productForm === 'Straight Length' ? specForm.length : undefined,
      coilLength: specForm.productForm === 'Coil' ? specForm.length : undefined,
      color: specForm.color, stripe: specForm.stripe, pipeConstruction: specForm.pipeConstruction || constructionForProduct(specForm.productType),
      unitWeightKg: specForm.unitWeightKg ? Number(specForm.unitWeightKg) : undefined, active: true,
    };
    if (specifications.some(spec => specificationKey(spec) === specificationKey(candidate))) return notifySaved('That exact Product Specification already exists.');
    setSpecifications(items => [candidate, ...items]); setShowSpecForm(false); notifySaved(`Product Specification ${candidate.id} created.`);
  };

  const createTarget = () => {
    const minimumStock = Number(targetForm.minimumStock); const targetStock = Number(targetForm.targetStock);
    const missing = targetForm.inventoryType === 'Finished Pipe' ? !targetForm.productSpecificationId : targetForm.inventoryType === 'Colorant' ? !targetForm.color : !targetForm.materialGrade;
    if (missing || minimumStock < 0 || targetStock < minimumStock) return notifySaved('Select an inventory item and ensure Target Stock is at least Minimum Stock.');
    const productSpecificationId = targetForm.inventoryType === 'Finished Pipe' ? targetForm.productSpecificationId : undefined;
    const materialGrade = targetForm.inventoryType.includes('Pellet') ? targetForm.materialGrade : undefined;
    const color = targetForm.inventoryType === 'Colorant' ? targetForm.color : undefined;
    const colorantUsageType = targetForm.inventoryType === 'Colorant' ? targetForm.colorantUsageType : undefined;
    if (stockTargets.some(target => target.status === 'Active' && target.plant === targetForm.plant && target.inventoryType === targetForm.inventoryType && target.productSpecificationId === productSpecificationId && target.materialGrade === materialGrade && target.color === color && target.colorantUsageType === colorantUsageType)) return notifySaved('An active stock target already exists for that exact item and Plant.');
    const item: StockTarget = { id: `target-${Date.now()}`, plant: targetForm.plant, inventoryType: targetForm.inventoryType, productSpecificationId, materialGrade, color, colorantUsageType, minimumStock, targetStock, status: 'Active' };
    const nextTargets = [item, ...stockTargets];
    setStockTargets(nextTargets);
    try { window.localStorage.setItem('hpai:stock-targets-v1', JSON.stringify(nextTargets)); } catch { /* In-memory state still works. */ }
    setShowTargetForm(false); window.dispatchEvent(new CustomEvent('hpai:stock-targets-changed')); notifySaved(`Stock target ${item.id} created.`);
  };

  const createLocation = () => {
    if (!locationForm.name.trim()) return notifySaved('Location Name is required.');
    const item: StorageLocation = { id: `loc-${Date.now()}`, ...locationForm, name: locationForm.name.trim(), status: 'Active' };
    setLocations(items => [item, ...items]); setShowLocationForm(false); notifySaved(`Storage Location ${item.name} created.`);
  };

  const confirmDeactivate = () => {
    if (!deactivate || !reason.trim()) return;
    if (deactivate.kind === 'spec') setSpecifications(items => items.map(item => item.id === deactivate.id ? { ...item, active: false } : item));
    else setLocations(items => items.map(item => item.id === deactivate.id ? { ...item, status: 'Inactive' } : item));
    notifySaved(`${deactivate.label} deactivated. Reason recorded for future audit integration.`); setDeactivate(null); setReason('');
  };

  const changeTab = (tab: Tab) => { setActiveTab(tab); setSearch(''); setPage(1); };

  const sizeOptions = specForm.productType ? sizesForProduct(specForm.productType, specifications.filter(spec => spec.productType === 'Polytube').map(spec => spec.size)) : [];

  const lengthOptions = lengthsForForm(specForm.productForm)

  return (
    <div className={`page-stack settings-page${activeTab === 'Product Specifications' || activeTab === 'Stock Targets / Reorder Levels' ? ' product-filter-page' : ''}`}>
      <div className="section-heading">
        <div>
          <h2>Settings</h2>
          <p>Owner / Super Admin configuration · frontend prototype state</p>
        </div>
        {feedback && (
          <span className="settings-feedback" role="status">
            {feedback}
          </span>
        )}
      </div>
      <div className="report-tabs settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((tab) => (
          <button key={tab} className={activeTab === tab ? 'tab-active' : ''} role="tab" aria-selected={activeTab === tab} onClick={() => changeTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      {activeTab === "General" && (
        <div className="app-card settings-card">
          <SectionHeader title="Frontend configuration" description="These settings are local prototype values until the backend is connected." />
          <div className="settings-rule-grid">
            <div>
              <span>Active material grades</span>
              <strong>HDPE Standard · PE100 · Commercial Grade (CGPE) · CTS Grade</strong>
              <small>PE80 remains visible only on genuine historical records.</small>
            </div>
            <div>
              <span>Physical Pellet Bag</span>
              <strong>25.00 kg</strong>
              <small>One bag receives one permanent unique Barcode.</small>
            </div>
            <div>
              <span>Long-record page size</span>
              <strong>10 records</strong>
              <small>Search and filters are applied before pagination.</small>
            </div>
            <div>
              <span>Rejected-material threshold</span>
              <strong>50.00 kg</strong>
              <small>Recycling trigger begins at 40.00 kg.</small>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Product Specifications" && (
        <div className="app-card settings-card">
          <SectionHeader title="Product Specification Master" description="The only valid combinations for new ordering, production, and finished-goods records." action={<button className="btn-primary" onClick={() => setShowSpecForm(true)}>Add Specification</button>} />
          <div className="record-filter-bar">
            <input className="app-input record-search" aria-label="Search Product Specifications" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search type, grade, size, SDR / Thickness, form, length, color, stripe, or construction" />
          </div>
          <ProductFilters value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade includeLength />
          <div className="table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Product Type</th>
                  <th>Grade</th>
                  <th>Size</th>
                  <th>SDR / Thickness</th>
                  <th>Form / Length</th>
                  <th>Construction</th>
                  <th>Color / Stripe</th>
                  <th>Status</th>
                  <th data-actions>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(filteredSpecs, page).map((spec) => (
                  <tr key={spec.id}>
                    <td>{spec.productType}</td>
                    <td>{spec.materialGrade}</td>
                    <td>{spec.size}</td>
                    <td>{spec.sdr}</td>
                    <td>
                      {spec.productForm}
                      <br />
                      <small>{specificationLength(spec)}</small>
                    </td>
                    <td>{spec.pipeConstruction}</td>
                    <td>
                      {spec.color}
                      <br />
                      <small>{spec.stripe}</small>
                    </td>
                    <td>
                      <StatusBadge
                        status={spec.active ? "Active" : "Inactive"}
                      />
                    </td>
                    <td>
                      {spec.active && <button className="btn-secondary btn-compact" onClick={() => setDeactivate({ kind: 'spec', id: spec.id, label: specificationLabel(spec) })}>Deactivate</button>}
                    </td>
                  </tr>
                ))}
                {!filteredSpecs.length && (
                  <tr>
                    <td colSpan={9} className="empty-state">
                      NO MATCHING RECORDS
                      <br />
                      <small>No Product Specifications match the current search.</small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalRecords={filteredSpecs.length} onPageChange={setPage} noun="specifications" />
        </div>
      )}

      {activeTab === "Stock Targets / Reorder Levels" && (
        <div className="app-card settings-card">
          <SectionHeader title="Stock Targets / Reorder Levels" description="Configure exact material or finished-pipe thresholds per Plant." action={<button className="btn-primary" onClick={() => setShowTargetForm(true)}>Add Stock Target</button>} />
          <div className="record-filter-bar">
            <input className="app-input record-search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search Plant, inventory type, exact item, or status" />
          </div>
          <ProductFilters value={productFilters.value} onChange={productFilters.change} includeProduct includeGrade includeLength />
          <div className="table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Plant</th>
                  <th>Inventory Type</th>
                  <th>Exact Item</th>
                  <th>Current</th>
                  <th>Minimum</th>
                  <th>Target</th>
                  <th>Stock State</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(filteredTargets, page).map((target) => {
                  const current = currentForTarget(target)
                  const state = current === 0 ? 'OUT OF STOCK' : current <= target.minimumStock ? 'LOW STOCK' : 'NORMAL';
                  const unit = target.inventoryType === 'Finished Pipe' ? 'units' : 'kg';
                  return (
                    <tr key={target.id}>
                      <td>{target.plant}</td>
                      <td>{target.inventoryType}</td>
                      <td>{targetLabel(target)}</td>
                      <td className="font-mono">
                        {current.toLocaleString()} {unit}
                      </td>
                      <td className="font-mono">
                        {target.minimumStock.toLocaleString()} {unit}
                      </td>
                      <td className="font-mono">
                        {target.targetStock.toLocaleString()} {unit}
                      </td>
                      <td>
                        <StatusBadge status={state} />
                      </td>
                    </tr>
                  )
                })}
                {!filteredTargets.length && (
                  <tr>
                    <td colSpan={7} className="empty-state empty-state-action">
                      <strong>
                        {stockTargets.length ? 'NO MATCHING STOCK TARGETS' : 'NO STOCK TARGETS'}
                      </strong>
                      <span>
                        {stockTargets.length ? 'No stock target matches the current search.' : 'No material or finished-pipe reorder level has been configured.'}
                      </span>
                      {!stockTargets.length && <button className="btn-secondary btn-compact" onClick={() => setShowTargetForm(true)}>Add Stock Target</button>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalRecords={filteredTargets.length} onPageChange={setPage} noun="stock targets" />
        </div>
      )}

      {activeTab === "Storage Locations" && (
        <div className="app-card settings-card">
          <SectionHeader title="Storage Location Master" description="Active locations are approved for inventory storage and relocation." action={<button className="btn-primary" onClick={() => setShowLocationForm(true)}>Add Location</button>} />
          <div className="record-filter-bar">
            <input className="app-input record-search" aria-label="Search Storage Locations" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, Plant, type, description, or status" />
          </div>
          <div className="table-scroll">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Location Name</th>
                  <th>Plant</th>
                  <th>Location Type</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th data-actions>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageRecords(filteredLocations, page).map((location) => (
                  <tr key={location.id}>
                    <td>{location.name}</td>
                    <td>{location.plant}</td>
                    <td>{location.locationType}</td>
                    <td>{location.description || "—"}</td>
                    <td>
                      <StatusBadge status={location.status} />
                    </td>
                    <td>
                      {location.status === 'Active' && <button className="btn-secondary btn-compact" onClick={() => setDeactivate({ kind: 'location', id: location.id, label: location.name })}>Deactivate</button>}
                    </td>
                  </tr>
                ))}
                {!filteredLocations.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">NO MATCHING RECORDS</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalRecords={filteredLocations.length} onPageChange={setPage} noun="locations" />
        </div>
      )}

      {activeTab === "Notifications" && (
        <div className="app-card settings-card">
          <SectionHeader title="Notification Preferences" description="Role authorization controls which records each user can see." />
          {[['Low Pellet Stock Alerts', lowPelletEnabled, setLowPelletEnabled], ['Shift Turnover Reminders', turnoverReminderEnabled, setTurnoverReminderEnabled], ['Production Behind Schedule Alerts', behindScheduleEnabled, setBehindScheduleEnabled], ['Finished Goods Ready for Release', fgReadyEnabled, setFgReadyEnabled]].map(([label, enabled, setter]) => (
            <label className="settings-toggle" key={String(label)}>
              <span>
                <strong>{String(label)}</strong>
                <small>Show this authorized alert in the shared header notification panel.</small>
              </span>
              <input type="checkbox" checked={Boolean(enabled)} onChange={event => (setter as React.Dispatch<React.SetStateAction<boolean>>)(event.target.checked)} />
            </label>
          ))}
          <div className="form-actions">
            <button className="btn-primary" onClick={() => notifySaved('Notification preferences saved.')}>Save Preferences</button>
          </div>
        </div>
      )}
      {activeTab === "Display" && (
        <div className="app-card settings-card">
          <SectionHeader title="Operational formatting" description="The recommended HPAI display standard is MM/DD/YYYY with 12-hour time." />
          <div className="settings-display-grid">
            <label>
              Date Format
              <SearchableDropdown
                className="app-select" value={dateFormat} onChange={event => setDateFormat(event.target.value as typeof dateFormat)}
              >
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </SearchableDropdown>
            </label>
            <label>
              Time Format
              <SearchableDropdown
                className="app-select" value={timeFormat} onChange={event => setTimeFormat(event.target.value as typeof timeFormat)}
              >
                <option value="12">12-hour with AM/PM</option>
                <option value="24">24-hour</option>
              </SearchableDropdown>
            </label>
            <label>
              Records per long page
              <input className="app-input" value="10" disabled />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={() => notifySaved('Display preferences saved.')}>Save Preferences</button>
          </div>
        </div>
      )}

      <Modal open={showSpecForm} onClose={() => setShowSpecForm(false)} title="Add Product Specification" width="720px">
        <div className="form-grid">
          <label>
            Product Type *
            <SearchableSelect value={specForm.productType} options={HPAI_PRODUCT_MASTER.products} ariaLabel="Product Type" placeholder="Search product type..." onChange={productType => setSpecForm(value => ({ ...value, productType: productType as ProductType, size: productType && sizesForProduct(productType, specifications.filter(spec => spec.productType === 'Polytube').map(spec => spec.size)).includes(value.size) ? value.size : '', pipeConstruction: productType ? constructionForProduct(productType) : '' }))} />
          </label>
          <label>
            Material Grade *
            <SearchableSelect value={specForm.materialGrade} options={HPAI_PRODUCT_MASTER.materialGrades} disabled={!specForm.productType} ariaLabel="Material Grade" placeholder="Search material grade..." onChange={materialGrade => setSpecForm(value => ({ ...value, materialGrade: materialGrade as MaterialGrade }))} />
          </label>
          <label>
            {sizeLabelForProduct(specForm.productType)} *
            <SearchableSelect
              ariaLabel={sizeLabelForProduct(specForm.productType)}
              value={specForm.size}
              options={sizeOptions}
              disabled={!specForm.productType}
              allowCustom={specForm.productType === "Polytube"}
              placeholder={specForm.productType === 'Polytube' ? 'Enter or search configured size' : 'Search size'}
              onChange={size => setSpecForm(value => ({ ...value, size }))}
            />
          </label>
          <label>
            SDR / Thickness *
            <SearchableSelect value={specForm.sdr} options={HPAI_PRODUCT_MASTER.sdrRatings} disabled={!specForm.size} ariaLabel="SDR / Thickness" placeholder="Select SDR / Thickness" searchPlaceholder="Search SDR / Thickness..." onChange={sdr => setSpecForm(value => ({ ...value, sdr }))} />
          </label>
          <label>
            Product Form *
            <SearchableSelect value={specForm.productForm} options={HPAI_PRODUCT_MASTER.productForms} disabled={!specForm.sdr} ariaLabel="Product Form" placeholder="Search product form..." onChange={productForm => setSpecForm(value => ({ ...value, productForm: productForm as ProductSpecification['productForm'], length: lengthsForForm(productForm).includes(value.length) ? value.length : '' }))} />
          </label>
          <label>
            Length / Coil Length *
            <SearchableSelect ariaLabel="Length / Coil Length" value={specForm.length} options={lengthOptions} disabled={!specForm.productForm} placeholder="Search length" onChange={length => setSpecForm(value => ({ ...value, length }))} />
          </label>
          <label>
            Color *
            <SearchableSelect value={specForm.color} options={HPAI_PRODUCT_MASTER.pipeColors} disabled={!specForm.length} ariaLabel="Product Color" placeholder="Search product color..." onChange={color => setSpecForm(value => ({ ...value, color }))} />
          </label>
          <label>
            Stripe *
            <SearchableSelect value={specForm.stripe} options={HPAI_PRODUCT_MASTER.stripeColors} disabled={!specForm.color} ariaLabel="Stripe Color" placeholder="Search stripe color..." onChange={stripe => setSpecForm(value => ({ ...value, stripe }))} />
          </label>
          <label>
            Pipe Construction *
            <SearchableSelect value={specForm.pipeConstruction} options={HPAI_PRODUCT_MASTER.constructions} disabled={!specForm.productType} ariaLabel="Pipe Construction" placeholder="Search pipe construction..." onChange={pipeConstruction => setSpecForm(value => ({ ...value, pipeConstruction: pipeConstruction as ProductSpecification['pipeConstruction'] }))} />
          </label>
          <label>
            Unit Weight (kg)
            <input className="app-input" type="number" min="0" step="0.01" value={specForm.unitWeightKg} onChange={event => setSpecForm(value => ({ ...value, unitWeightKg: event.target.value }))} placeholder="Optional" />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => setShowSpecForm(false)}>Back</button>
          <button className="btn-primary" onClick={createSpecification}>Create Specification</button>
        </div>
      </Modal>

      <Modal open={showTargetForm} onClose={() => setShowTargetForm(false)} title="Add Stock Target" width="680px">
        <div className="form-grid">
          <label>
            Plant *
            <SearchableDropdown
              className="app-select" value={targetForm.plant} onChange={event => setTargetForm(value => ({ ...value, plant: event.target.value as typeof value.plant }))}
            >
              <option>Main Plant</option>
              <option>Branch Plant</option>
            </SearchableDropdown>
          </label>
          <label>
            Inventory Type *
            <SearchableDropdown
              className="app-select" value={targetForm.inventoryType} onChange={event => setTargetForm(value => ({ ...value, inventoryType: event.target.value as StockTarget['inventoryType'], productSpecificationId: '' }))}
            >
              {['Finished Pipe', 'Virgin Pellet', 'Recycled Pellet', 'Colorant'].map(value => <option key={value}>{value}</option>)}
            </SearchableDropdown>
          </label>
          {targetForm.inventoryType === "Finished Pipe" && (
            <label className="form-grid-span-2">
              Product Specification *
              <SearchableDropdown
                className="app-select" value={targetForm.productSpecificationId} onChange={event => setTargetForm(value => ({ ...value, productSpecificationId: event.target.value }))}
              >
                <option value="">Select an active exact specification</option>
                {specifications
                  .filter((spec) => spec.active)
                  .map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {specificationLabel(spec)}
                    </option>
                  ))}
              </SearchableDropdown>
            </label>
          )}
          {targetForm.inventoryType.includes("Pellet") && (
            <label>
              Material Grade *
              <SearchableDropdown
                className="app-select" value={targetForm.materialGrade} onChange={event => setTargetForm(value => ({ ...value, materialGrade: event.target.value as MaterialGrade }))}
              >
                {HPAI_PRODUCT_MASTER.materialGrades.map(value => <option key={value}>{value}</option>)}
              </SearchableDropdown>
            </label>
          )}
          {targetForm.inventoryType === "Colorant" && (
            <>
              <label>
                Color *
                <SearchableDropdown
                  className="app-select" value={targetForm.color} onChange={event => setTargetForm(value => ({ ...value, color: event.target.value }))}
                >
                  {HPAI_PRODUCT_MASTER.pipeColors.map(value => <option key={value}>{value}</option>)}
                </SearchableDropdown>
              </label>
              <label>
                Usage Type *
                <SearchableDropdown
                  className="app-select" value={targetForm.colorantUsageType} onChange={event => setTargetForm(value => ({ ...value, colorantUsageType: event.target.value as typeof value.colorantUsageType }))}
                >
                  <option value="BASE_COLORANT">Base Colorant</option>
                  <option value="STRIPE_COLORANT">Stripe Colorant</option>
                </SearchableDropdown>
              </label>
            </>
          )}
          <label>
            Minimum Stock *
            <input className="app-input" type="number" min="0" value={targetForm.minimumStock} onChange={event => setTargetForm(value => ({ ...value, minimumStock: event.target.value }))} />
          </label>
          <label>
            Target Stock *
            <input className="app-input" type="number" min="0" value={targetForm.targetStock} onChange={event => setTargetForm(value => ({ ...value, targetStock: event.target.value }))} />
          </label>
        </div>
        <p className="helper-text">OUT OF STOCK means Current Available is 0. LOW STOCK means Current Available is at or below Minimum Stock. Pellet values are kg and requests convert to whole 25 kg bags.</p>
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => setShowTargetForm(false)}>Back</button>
          <button className="btn-primary" onClick={createTarget}>Create Stock Target</button>
        </div>
      </Modal>

      <Modal open={showLocationForm} onClose={() => setShowLocationForm(false)} title="Add Storage Location">
        <div className="form-grid">
          <label>
            Location Name *
            <input className="app-input" value={locationForm.name} onChange={event => setLocationForm(value => ({ ...value, name: event.target.value }))} />
          </label>
          <label>
            Plant *
            <SearchableDropdown
              className="app-select" value={locationForm.plant} onChange={event => setLocationForm(value => ({ ...value, plant: event.target.value as typeof value.plant }))}
            >
              <option>Main Plant</option>
              <option>Branch Plant</option>
            </SearchableDropdown>
          </label>
          <label>
            Location Type *
            <SearchableDropdown
              className="app-select" value={locationForm.locationType} onChange={event => setLocationForm(value => ({ ...value, locationType: event.target.value as StorageLocation['locationType'] }))}
            >
              {['Production Area', 'Finished Goods Area', 'Raw Material Area', 'Staging Area'].map(value => <option key={value}>{value}</option>)}
            </SearchableDropdown>
          </label>
          <label>
            Description
            <textarea className="app-input" value={locationForm.description} onChange={event => setLocationForm(value => ({ ...value, description: event.target.value }))} />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => setShowLocationForm(false)}>Back</button>
          <button className="btn-primary" onClick={createLocation}>Create Location</button>
        </div>
      </Modal>
      <Modal open={deactivate !== null} onClose={() => { setDeactivate(null); setReason(''); }} title={`Deactivate ${deactivate?.kind === 'spec' ? 'Product Specification' : 'Storage Location'}?`}>
        <p className="confirm-copy">
          <strong>{deactivate?.label}</strong> will become unavailable for new records. Historical references will be preserved.</p>
        <label>
          Reason *
          <textarea className="app-input" value={reason} onChange={event => setReason(event.target.value)} placeholder="Enter the reason for deactivation" />
        </label>
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => { setDeactivate(null); setReason(''); }}>Back</button>
          <button className="btn-danger" disabled={!reason.trim()} onClick={confirmDeactivate}>Confirm Deactivation</button>
        </div>
      </Modal>
    </div>
  )
}
