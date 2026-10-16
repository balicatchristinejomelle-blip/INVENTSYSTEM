import React from 'react';
import SearchableSelect from './SearchableSelect';
import { materialColorOptions } from '../pelletColors';

/** One shared creation selector. Options never depend on inventory or a role. */
export default function PelletColorField({ type, value, onChange, label = 'Pellet Color' }: {
  type: 'Virgin' | 'Recycled'; value: string; onChange: (value: string) => void; label?: string;
}) {
  return type === 'Virgin'
    ? <input className="app-input" aria-label={label} value="White" readOnly />
    : <SearchableSelect ariaLabel={label} value={value} options={materialColorOptions('Recycled')}
        placeholder="Select recycled pellet color" required onChange={onChange} />;
}
