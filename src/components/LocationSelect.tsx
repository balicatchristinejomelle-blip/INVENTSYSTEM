import React from 'react';
import SearchableSelect from './SearchableSelect';
import { activeLocationCodes } from '../locationMaster';
import { readStorageLocations } from '../finishedGoodsInventory';
export default function LocationSelect({ value, onChange, filter = false }: { value: string; onChange: (value: string) => void; filter?: boolean }) {
  return <label className="product-filter-field"><span className="field-label">{filter ? 'Location' : 'Storage Location'}</span><SearchableSelect value={filter && (!value || value === 'All') ? 'All Locations' : value} options={filter ? ['All Locations', ...activeLocationCodes(readStorageLocations())] : activeLocationCodes(readStorageLocations())} ariaLabel={filter ? 'Location' : 'Storage Location'} placeholder={filter ? 'All Locations' : 'Select Storage Location'} onChange={value => onChange(filter && (!value || value === 'All Locations') ? 'All' : value)} /></label>;
}
