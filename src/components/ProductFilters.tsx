import React, { useEffect, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import { HPAI_PRODUCT_MASTER } from '../productMaster';
import { readPipeSpecifications } from '../finishedPipeRelations';
import { emptyProductFilter, matchesProductFilter, productFilterRecord, productFilterSizes, productFilterLengths, type ProductFilter } from '../productFilters';
import InventoryFacetFields, { type InventoryFacetField } from './InventoryFacetFields';
import { inventoryFacetRow } from '../inventoryFacets';
import { finishedPipeInventory, STORAGE_PURPOSES } from '../finishedGoodsInventory';
import type { FinishedGood } from '../types';
import { useApp } from '../store';
import { activeLocationCodes, filterLocationCodes } from '../locationMaster';
import { readStorageLocations } from '../finishedGoodsInventory';
import { useViewState } from '../uiViewState';
import { ActiveFilters } from './UXFeedback';
import { materialColorOptions } from '../pelletColors';

export function useProductFilters(onChange?: () => void, viewKey = 'product-filters') {
  const app = useApp();
  const [value, setValue] = useViewState<ProductFilter>(viewKey, { ...emptyProductFilter });
  const change = (next: ProductFilter) => { setValue(next); onChange?.(); };
  return { value, change, reset: () => change({ ...emptyProductFilter }), matches: (record: unknown, overrides: Partial<ProductFilter> = {}) => matchesProductFilter(record, { ...value, ...overrides }, app) };
}
interface ProductFiltersProps {
  productForm?: 'Straight Length' | 'Coil';
  materialColors?: boolean;
  value: ProductFilter; onChange: (next: ProductFilter) => void; product?: string; grade?: string; onProductChange?: (product: string) => void; onGradeChange?: (grade: string) => void; includeProduct?: boolean; includeGrade?: boolean; includeLength?: boolean; includeColor?: boolean; includeLocation?: boolean;
  records?: readonly unknown[]; purpose?: string; onPurposeChange?: (value: string) => void; status?: string; onStatusChange?: (value: string) => void;
  statusFor?: (record: any) => string; statusLabel?: (status: string) => string; statusOptions?: readonly string[];
}
function InventoryProductFilters(props: ProductFiltersProps) {
  const app = useApp();
  const { value, onChange, product, grade, onProductChange, onGradeChange } = props;
  const specifications = readPipeSpecifications();
  const sizes = productFilterSizes(onProductChange ? product || '' : props.includeProduct ? value.product : product || '', specifications);
  useEffect(() => {
    if (props.materialColors && value.color && !materialColorOptions('All').includes(value.color)) onChange({ ...value, color: '' });
  }, [props.materialColors, value.color]);
  useEffect(() => {
    if (value.size && !sizes.includes(value.size)) onChange({ ...value, size: '' });
  }, [product, value.product]);
  const fields: InventoryFacetField[] = [
    ...((props.includeProduct || onProductChange) ? [{ key: 'product', label: 'Product', options: HPAI_PRODUCT_MASTER.products }] : []),
    ...((props.includeGrade || onGradeChange) ? [{ key: 'grade', label: 'Material Grade', options: HPAI_PRODUCT_MASTER.materialGrades }] : []),
    ...(props.includeColor ? [{ key: 'color', label: 'Color', options: props.materialColors ? materialColorOptions('All') : HPAI_PRODUCT_MASTER.pipeColors }] : []),
    { key: 'size', label: 'Size / Diameter', options: sizes }, { key: 'sdr', label: 'SDR / Thickness', options: HPAI_PRODUCT_MASTER.sdrRatings },
    ...(props.includeLocation ? [{ key: 'location', label: 'Location', options: filterLocationCodes(readStorageLocations()) }] : []),
    ...(props.includeLength ? [{ key: 'length', label: 'Length / Coil Length', options: productFilterLengths(props.productForm) }] : []),
    ...(props.onPurposeChange ? [{ key: 'purpose', label: 'Storage Purpose', options: STORAGE_PURPOSES }] : []),
    ...(props.onStatusChange ? [{ key: 'status', label: 'Status', options: props.statusOptions || ['Quality Pending', 'Awaiting Storage', 'Stored', 'Available', 'Reserved', 'Ready for Release', 'Shipped Out', 'Quality Reject', 'Low Stock'], display: props.statusLabel }] : []),
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
      else if (key === 'purpose') { if ((props.purpose?.startsWith('All') ? '' : props.purpose || '') !== next[key]) props.onPurposeChange?.(next[key] || 'All'); }
      else if (key === 'status') { if ((props.status?.startsWith('All') ? '' : props.status || '') !== next[key]) props.onStatusChange?.(next[key] || 'All Statuses'); }
      else updated[key as keyof ProductFilter] = next[key];
    }
    onChange(updated);
  }} />;
}
export default function ProductFilters(props: ProductFiltersProps) {
  return props.records ? <InventoryProductFilters {...props} /> : <MasterProductFilters {...props} />;
}
function MasterProductFilters({ value, onChange, product = '', grade = '', onProductChange, onGradeChange, includeProduct = false, includeGrade = false, includeLength = false, includeColor = false, includeLocation = false, productForm }: ProductFiltersProps) {
  const specifications = readPipeSpecifications();
  const sizes = productFilterSizes(onProductChange ? product : includeProduct ? value.product : product, specifications);
  useEffect(() => {
    if (value.size && !sizes.includes(value.size)) onChange({ ...value, size: '' });
  }, [product, value.product]);
  const field = (key: keyof ProductFilter, label: string, options: readonly string[]) => <label key={key} className="product-filter-field">
    <span className="field-label">{label}</span>
    <SearchableSelect value={key === 'product' && onProductChange ? product === 'All' ? '' : product : key === 'grade' && onGradeChange ? grade === 'All' ? '' : grade : value[key] || ''} options={options} ariaLabel={label} placeholder={{ product: 'All Products', grade: 'All Material Grades', color: 'All Colors', size: 'All Sizes', sdr: 'All SDRs', location: 'All Locations', length: 'All Lengths' }[key]} searchPlaceholder={`Search ${label}...`} onChange={selected => {
      if (key === 'product' && onProductChange) { onProductChange(selected || 'All'); return; }
      if (key === 'grade' && onGradeChange) { onGradeChange(selected || 'All'); return; }
      const next = { ...value, [key]: selected };
      if (key === 'product' && next.size && !productFilterSizes(selected, specifications).includes(next.size)) next.size = '';
      onChange(next);
    }} />
  </label>;
  const controls = <><ActiveFilters clearLabel="Clear product filters" items={[
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
    {includeLength && field('length', 'Length / Coil Length', productFilterLengths(productForm))}
  </div></>;
  // Only the seven-field legacy variant needs its own width-query boundary.
  // Other field counts retain their existing fragment/parent layout.
  return (includeProduct || onProductChange) && (includeGrade || onGradeChange) && includeColor && includeLocation && includeLength
    ? <div className="seven-master-filter-panel">{controls}</div> : controls;
}
