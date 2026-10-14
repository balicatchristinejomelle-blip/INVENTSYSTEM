import React, { useEffect, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import { HPAI_PRODUCT_MASTER } from '../productMaster';
import { readPipeSpecifications } from '../finishedPipeRelations';
import { emptyProductFilter, matchesProductFilter, productFilterSizes, type ProductFilter } from '../productFilters';
import { useApp } from '../store';
import { activeLocationCodes } from '../locationMaster';
import { readStorageLocations } from '../finishedGoodsInventory';

export function useProductFilters(onChange?: () => void) {
  const app = useApp();
  const [value, setValue] = useState<ProductFilter>({ ...emptyProductFilter });
  const change = (next: ProductFilter) => { setValue(next); onChange?.(); };
  return { value, change, reset: () => change({ ...emptyProductFilter }), matches: (record: unknown, overrides: Partial<ProductFilter> = {}) => matchesProductFilter(record, { ...value, ...overrides }, app) };
}
export default function ProductFilters({ value, onChange, product = '', grade = '', onProductChange, onGradeChange, includeProduct = false, includeGrade = false, includeLength = false, includeColor = false, includeLocation = false }: {
  value: ProductFilter; onChange: (next: ProductFilter) => void; product?: string; grade?: string; onProductChange?: (product: string) => void; onGradeChange?: (grade: string) => void; includeProduct?: boolean; includeGrade?: boolean; includeLength?: boolean; includeColor?: boolean; includeLocation?: boolean;
}) {
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
  return <div className="product-filter-controls">
    {(includeProduct || onProductChange) && field('product', 'Product', HPAI_PRODUCT_MASTER.products)}
    {(includeGrade || onGradeChange) && field('grade', 'Material Grade', HPAI_PRODUCT_MASTER.materialGrades)}
    {includeColor && field('color', 'Color', HPAI_PRODUCT_MASTER.pipeColors)}
    {field('size', 'Size / Diameter', sizes)}
    {field('sdr', 'SDR / Thickness', HPAI_PRODUCT_MASTER.sdrRatings)}
    {includeLocation && field('location', 'Location', ['All Locations', ...activeLocationCodes(readStorageLocations())])}
    {includeLength && field('length', 'Length / Coil Length', [...HPAI_PRODUCT_MASTER.straightLengths, ...HPAI_PRODUCT_MASTER.coilLengths])}
  </div>;
}
