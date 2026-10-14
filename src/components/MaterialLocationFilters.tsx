import React from 'react';
import LocationSelect from './LocationSelect';
import SearchableSelect from './SearchableSelect';
import { HPAI_PRODUCT_MASTER } from '../productMaster';
export default function MaterialLocationFilters({ color, location, onColorChange, onLocationChange, grade, onGradeChange }: { color: string; location: string; onColorChange: (value: string) => void; onLocationChange: (value: string) => void; grade?: string; onGradeChange?: (value: string) => void }) {
  return <div className="product-filter-controls">
    {onGradeChange && <label className="product-filter-field"><span className="field-label">Material Grade</span><SearchableSelect value={grade === 'All' ? '' : grade || ''} options={HPAI_PRODUCT_MASTER.materialGrades} placeholder="All Material Grades" ariaLabel="Material Grade" onChange={value => onGradeChange(value || 'All')} /></label>}
    <label className="product-filter-field"><span className="field-label">Color</span><SearchableSelect value={color} options={HPAI_PRODUCT_MASTER.pipeColors} placeholder="All Colors" ariaLabel="Color" onChange={onColorChange} /></label>
    <LocationSelect filter value={location} onChange={onLocationChange} />
  </div>;
}
