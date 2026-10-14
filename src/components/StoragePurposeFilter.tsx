import React from 'react';
import SearchableSelect from './SearchableSelect';
import { STORAGE_PURPOSES, type StoragePurpose } from '../finishedGoodsInventory';
export type StoragePurposeSelection = 'All' | StoragePurpose;
export default function StoragePurposeFilter({ value, onChange }: { value: StoragePurposeSelection; onChange: (value: StoragePurposeSelection) => void }) {
  return <label className="product-filter-field">Storage Purpose<SearchableSelect ariaLabel="Storage Purpose" placeholder="All Storage Purposes" value={value} options={['All', ...STORAGE_PURPOSES]} onChange={value => onChange(value as StoragePurposeSelection)} /></label>;
}
