import React, { useEffect, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import { HPAI_PRODUCT_MASTER } from '../productMaster';
import { readPipeSpecifications } from '../finishedPipeRelations';
import { emptyProductFilter, matchesProductFilter, productFilterSizes, type ProductFilter } from '../productFilters';
import { useApp } from '../store';

export function useProductFilters(onChange?: () => void) {
  const app = useApp();
  const [value, setValue] = useState<ProductFilter>({ ...emptyProductFilter });
  const change = (next: ProductFilter) => { setValue(next); onChange?.(); };
  return { value, change, reset: () => change({ ...emptyProductFilter }), matches: (record: unknown) => matchesProductFilter(record, value, app) };
}
export default function ProductFilters({ value, onChange, product = '', includeProduct = false, includeGrade = false, includeLength = false }: {
  value: ProductFilter; onChange: (next: ProductFilter) => void; product?: string; includeProduct?: boolean; includeGrade?: boolean; includeLength?: boolean;
}) {
  const specifications = readPipeSpecifications();
  const sizes = productFilterSizes(includeProduct ? value.product : product, specifications);
  useEffect(() => {
    if (value.size && !sizes.includes(value.size)) onChange({ ...value, size: '' });
  }, [product, value.product]);
  const field = (key: keyof ProductFilter, label: string, options: readonly string[]) => <label key={key} className="product-filter-field">
    <span className="field-label">{label}</span>
    <SearchableSelect value={value[key]} options={options} ariaLabel={label} placeholder={`Select ${label}`} searchPlaceholder={`Search ${label}...`} onChange={selected => {
      const next = { ...value, [key]: selected };
      if (key === 'product' && next.size && !productFilterSizes(selected, specifications).includes(next.size)) next.size = '';
      onChange(next);
    }} />
  </label>;
  return <div className="product-filter-controls">
    {includeProduct && field('product', 'Product', HPAI_PRODUCT_MASTER.products)}
    {includeGrade && field('grade', 'Material Grade', HPAI_PRODUCT_MASTER.materialGrades)}
    {field('size', 'Size / Diameter', sizes)}
    {field('sdr', 'SDR / Thickness', HPAI_PRODUCT_MASTER.sdrRatings)}
    {includeLength && field('length', 'Length / Coil Length', [...HPAI_PRODUCT_MASTER.straightLengths, ...HPAI_PRODUCT_MASTER.coilLengths])}
  </div>;
}
