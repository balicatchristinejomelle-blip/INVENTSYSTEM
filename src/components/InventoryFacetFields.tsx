import React, { useEffect, useRef } from 'react';
import SearchableSelect from './SearchableSelect';
import { ActiveFilters } from './UXFeedback';
import { facetValue, resolveInventoryFacets, type FacetRow, type FacetSelection } from '../inventoryFacets';

export interface InventoryFacetField { key: string; label: string; allLabel?: string; display?: (value: string) => string }
const allMatchingLabel = (field: InventoryFacetField) => field.allLabel || 'All Matching ' + ({ product: 'Products', grade: 'Material Grades', color: 'Colors', size: 'Sizes', sdr: 'SDRs', location: 'Locations', purpose: 'Storage Purposes', status: 'Statuses', length: 'Lengths' }[field.key] || field.label);
export default function InventoryFacetFields({ rows, fields, value, onChange }: {
  rows: readonly FacetRow[]; fields: readonly InventoryFacetField[]; value: FacetSelection; onChange: (next: FacetSelection) => void;
}) {
  const intent = useRef<FacetSelection>({ ...value }), priority = useRef(Object.keys(value));
  const last = useRef(JSON.stringify(value));
  const cleared = useRef<string[]>([]);
  const signature = JSON.stringify(value);
  if (last.current !== signature) {
    for (const field of fields) if (value[field.key] !== JSON.parse(last.current)[field.key]) {
      intent.current[field.key] = facetValue(value[field.key]);
      priority.current = [field.key, ...priority.current.filter(key => key !== field.key)];
    }
    last.current = signature;
  }
  const result = resolveInventoryFacets(rows, fields.map(field => field.key), intent.current, priority.current, cleared.current);
  const resolved = JSON.stringify(result.selected);
  const apply = (selected: FacetSelection) => { last.current = JSON.stringify(selected); onChange(selected); };
  useEffect(() => {
    intent.current = result.retained;
    if (fields.some(field => facetValue(value[field.key]) !== result.selected[field.key])) apply(result.selected);
  }, [resolved, signature]);
  const change = (key: string, selected: string) => {
    cleared.current = selected ? [] : [key];
    intent.current = { ...result.retained, [key]: selected };
    priority.current = [key, ...priority.current.filter(item => item !== key)];
    apply(resolveInventoryFacets(rows, fields.map(field => field.key), intent.current, priority.current, cleared.current).selected);
  };
  return <div className="inventory-facet-panel">
    <ActiveFilters compact items={fields.map(field => [field.label, field.display?.(result.selected[field.key]) || result.selected[field.key]] as const)}
      onRemove={label => { const field = fields.find(field => field.label === label); if (field) change(field.key, ''); }}
      clearLabel="Clear All" onClear={() => { intent.current = {}; cleared.current = fields.map(field => field.key); apply(Object.fromEntries(fields.map(field => [field.key, '']))); }} />
    <div className="inventory-facet-grid product-filter-controls" data-field-count={fields.length}>
      {fields.map(field => <label className="product-filter-field" key={field.key}>
        <span className="field-label">{field.label}</span>
        <SearchableSelect ariaLabel={field.label} menuClassName="inventory-facet-options" value={result.selected[field.key] || ''}
          placeholder={allMatchingLabel(field)}
          searchPlaceholder={`Search ${field.label}...`} options={[{ value: '', label: allMatchingLabel(field) }, ...result.options[field.key].map(value => ({ value, label: field.display?.(value) || value }))]}
          onChange={selected => change(field.key, selected)} />
      </label>)}
    </div>
  </div>;
}
