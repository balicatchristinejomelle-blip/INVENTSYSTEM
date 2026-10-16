import React, { useEffect, useRef } from 'react';
import SearchableSelect from './SearchableSelect';
import { ActiveFilters } from './UXFeedback';
import { facetValue, resolveInventoryLocations, type FacetRow, type FacetSelection } from '../inventoryFacets';

export interface InventoryFacetField { key: string; label: string; options: readonly string[]; allLabel?: string; display?: (value: string) => string }
const allMatchingLabel = (field: InventoryFacetField) => field.allLabel || 'All ' + ({ product: 'Products', grade: 'Material Grades', color: 'Colors', size: 'Sizes', sdr: 'SDRs', location: 'Locations', purpose: 'Storage Purposes', status: 'Statuses', length: 'Lengths' }[field.key] || field.label);
export default function InventoryFacetFields({ rows, fields, value, onChange }: {
  rows: readonly FacetRow[]; fields: readonly InventoryFacetField[]; value: FacetSelection; onChange: (next: FacetSelection) => void;
}) {
  const locationField = fields.find(field => field.key === 'location');
  const location = resolveInventoryLocations(rows, value, locationField?.options || []);
  const context = JSON.stringify([Object.entries(value).filter(([key]) => ['product', 'grade', 'color', 'size', 'sdr', 'length'].includes(key)), location.options]);
  const clearedLocationContext = useRef<string | null>(null);
  useEffect(() => {
    if (locationField && clearedLocationContext.current !== context && facetValue(value.location) !== location.location) onChange({ ...value, location: location.location });
  }, [context, location.location, value.location]);
  const change = (key: string, selected: string) => {
    const next = { ...value, [key]: selected };
    // Explicit Location removal stays clear until the specification/matching locations change.
    if (key === 'location') clearedLocationContext.current = selected ? null : context;
    if (locationField && ['product', 'grade', 'color', 'size', 'sdr', 'length'].includes(key)) {
      clearedLocationContext.current = null;
      next.location = resolveInventoryLocations(rows, next, locationField.options).location;
    }
    onChange(next);
  };
  return <div className="inventory-facet-panel">
    <ActiveFilters compact items={fields.map(field => [field.label, field.display?.(facetValue(value[field.key])) || facetValue(value[field.key])] as const)}
      onRemove={label => { const field = fields.find(field => field.label === label); if (field) change(field.key, ''); }}
      clearLabel="Clear All" onClear={() => onChange(Object.fromEntries(fields.map(field => [field.key, ''])))} />
    <div className="inventory-facet-grid product-filter-controls" data-field-count={fields.length}>
      {fields.map(field => <label className="product-filter-field" key={field.key}>
        <span className="field-label">{field.label}</span>
        <SearchableSelect ariaLabel={field.label} menuClassName="inventory-facet-options" value={facetValue(value[field.key])}
          placeholder={field.key === 'location' ? location.label : allMatchingLabel(field)}
          searchPlaceholder={`Search ${field.label}...`} options={[{ value: '', label: field.key === 'location' ? location.label : allMatchingLabel(field) }, ...(field.key === 'location' ? location.options : field.options).map(value => ({ value, label: field.display?.(value) || value }))]}
          onChange={selected => change(field.key, selected)} />
      </label>)}
    </div>
  </div>;
}
