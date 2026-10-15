import React, { useEffect, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import { HPAI_PRODUCT_MASTER } from '../productMaster';
import { readPipeSpecifications } from '../finishedPipeRelations';
import { emptyProductFilter, matchesProductFilter, productFilterRecord, productFilterSizes, type ProductFilter } from '../productFilters';
import InventoryFacetFields, { type InventoryFacetField } from './InventoryFacetFields';
import { inventoryFacetRow } from '../inventoryFacets';
import { finishedPipeInventory } from '../finishedGoodsInventory';
import type { FinishedGood } from '../types';
import { useApp } from '../store';
import { activeLocationCodes } from '../locationMaster';
import { readStorageLocations } from '../finishedGoodsInventory';
import { useViewState } from '../uiViewState';
import { ActiveFilters } from './UXFeedback';

export function useProductFilters(onChange?: () => void, viewKey = 'product-filters') {
  const app = useApp();
  const [value, setValue] = useViewState<ProductFilter>(viewKey, { ...emptyProductFilter });
  const change = (next: ProductFilter) => { setValue(next); onChange?.(); };
  return { value, change, reset: () => change({ ...emptyProductFilter }), matches: (record: unknown, overrides: Partial<ProductFilter> = {}) => matchesProductFilter(record, { ...value, ...overrides }, app) };
}
interface ProductFiltersProps {
  value: ProductFilter; onChange: (next: ProductFilter) => void; product?: string; grade?: string; onProductChange?: (product: string) => void; onGradeChange?: (grade: string) => void; includeProduct?: boolean; includeGrade?: boolean; includeLength?: boolean; includeColor?: boolean; includeLocation?: boolean;
  records?: readonly unknown[]; purpose?: string; onPurposeChange?: (value: string) => void; status?: string; onStatusChange?: (value: string) => void;
  statusFor?: (record: any) => string; statusLabel?: (status: string) => string;
}
function InventoryProductFilters(props: ProductFiltersProps) {
  const app = useApp();
  const { value, onChange, product, grade, onProductChange, onGradeChange } = props;
  const fields: InventoryFacetField[] = [
    ...((props.includeProduct || onProductChange) ? [{ key: 'product', label: 'Product' }] : []),
    ...((props.includeGrade || onGradeChange) ? [{ key: 'grade', label: 'Material Grade' }] : []),
    ...(props.includeColor ? [{ key: 'color', label: 'Color' }] : []),
    { key: 'size', label: 'Size / Diameter' }, { key: 'sdr', label: 'SDR / Thickness' },
    ...(props.includeLocation ? [{ key: 'location', label: 'Location' }] : []),
    ...(props.onPurposeChange ? [{ key: 'purpose', label: 'Storage Purpose' }] : []),
    ...(props.onStatusChange ? [{ key: 'status', label: 'Status', display: props.statusLabel }] : []),
    ...(props.includeLength ? [{ key: 'length', label: 'Length / Coil Length' }] : []),
  ];
  const rows = props.records!.map(record => inventoryFacetRow(productFilterRecord(record, app), {
    ...(props.statusFor ? { status: props.statusFor(record) } : {}),
    ...(record && typeof record === 'object' && 'fgId' in record ? { purpose: finishedPipeInventory(record as FinishedGood, app).purpose || '' } : {}),
  }));
  return <InventoryFacetFields rows={rows} fields={fields} value={Object.fromEntries(fields.map(({ key }) => [key,
    key === 'product' && onProductChange ? product || '' : key === 'grade' && onGradeChange ? grade || '' : key === 'purpose' ? props.purpose || '' : key === 'status' ? props.status || '' : value[key as keyof ProductFilter] || '',
  ]))} onChange={next => {
    const updated = { ...value };
    for (const { key } of fields) {
      if (key === 'product' && onProductChange) { if ((product === 'All' ? '' : product) !== next[key]) onProductChange(next[key] || 'All'); }
      else if (key === 'grade' && onGradeChange) { if ((grade === 'All' ? '' : grade) !== next[key]) onGradeChange(next[key] || 'All'); }
      else if (key === 'purpose') props.onPurposeChange?.(next[key] || 'All');
      else if (key === 'status') props.onStatusChange?.(next[key] || 'All Statuses');
      else updated[key as keyof ProductFilter] = next[key];
    }
    onChange(updated);
  }} />;
}
export default function ProductFilters(props: ProductFiltersProps) {
  return props.records ? <InventoryProductFilters {...props} /> : <MasterProductFilters {...props} />;
}
function MasterProductFilters({ value, onChange, product = '', grade = '', onProductChange, onGradeChange, includeProduct = false, includeGrade = false, includeLength = false, includeColor = false, includeLocation = false }: ProductFiltersProps) {
  const specifications = readPipeSpecifications();
  const sizes = productFilterSizes(onProductChange ? product : includeProduct ? value.product : product, specifications);
  useEffect(() => {
    if (value.size && !sizes.includes(value.size)) onChange({ ...value, size: '' });
  }, [product, value.product]);
  const field = (key: keyof ProductFilter, label: string, options: readonly string[]) => <label key={key} className="product-filter-field">
    <span className="field-label">{label}</span>
    <SearchableSelect value={key === 'product' && onProductChange ? product === 'All' ? '' : product : key === 'grade' && onGradeChange ? grade === 'All' ? '' : grade : value[key] || ''} options={options} ariaLabel={label} placeholder={key === 'grade' ? 'All Material Grades' : key === 'color' ? 'All Colors' : key === 'location' ? 'All Locations' : `Select ${label}`} searchPlaceholder={`Search ${label}...`} onChange={selected => {
      if (key === 'product' && onProductChange) { onProductChange(selected || 'All'); return; }
      if (key === 'grade' && onGradeChange) { onGradeChange(selected || 'All'); return; }
      const next = { ...value, [key]: selected };
      if (key === 'product' && next.size && !productFilterSizes(selected, specifications).includes(next.size)) next.size = '';
      onChange(next);
    }} />
  </label>;
  return <><ActiveFilters clearLabel="Clear product filters" items={[
    ['Product', onProductChange ? product : value.product], ['Material Grade', onGradeChange ? grade : value.grade],
    ['Color', value.color], ['Size / Diameter', value.size], ['SDR / Thickness', value.sdr], ['Location', value.location], ['Length', value.length],
  ]} onClear={() => { onChange({ ...emptyProductFilter }); onProductChange?.('All'); onGradeChange?.('All'); }} />
  <div className="product-filter-controls">
    {(includeProduct || onProductChange) && field('product', 'Product', HPAI_PRODUCT_MASTER.products)}
    {(includeGrade || onGradeChange) && field('grade', 'Material Grade', HPAI_PRODUCT_MASTER.materialGrades)}
    {includeColor && field('color', 'Color', HPAI_PRODUCT_MASTER.pipeColors)}
    {field('size', 'Size / Diameter', sizes)}
    {field('sdr', 'SDR / Thickness', HPAI_PRODUCT_MASTER.sdrRatings)}
    {includeLocation && field('location', 'Location', ['All Locations', ...activeLocationCodes(readStorageLocations())])}
    {includeLength && field('length', 'Length / Coil Length', [...HPAI_PRODUCT_MASTER.straightLengths, ...HPAI_PRODUCT_MASTER.coilLengths])}
  </div></>;
}
