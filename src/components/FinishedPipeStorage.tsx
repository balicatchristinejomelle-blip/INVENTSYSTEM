import ActionButton, { useDraftProtection } from './ActionButton';
import React, { useState } from 'react';
import type { FinishedGood } from '../types';
import { useApp } from '../store';
import { finishedPipeInventory, compatibleStorageLocations, readStorageLocations } from '../finishedGoodsInventory';
import SearchableSelect from './SearchableSelect';

/** Plant Manager confirms a physical location, never a production purpose or buyer. */
export default function FinishedPipeStorage({ pipe }: { pipe: FinishedGood }) {
  const app = useApp();
  const state = finishedPipeInventory(pipe, app);
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  useDraftProtection({ location, reason });
  if (app.currentUser?.role !== 'plantmanager' || pipe.qualityStatus !== 'Pass' || !state.purpose || ['Rejected', 'Shipped'].includes(state.bucket)) return null;
  const moving = !['Awaiting Storage', 'Quality Pending'].includes(state.bucket);
  const master = readStorageLocations();
  const options = [...compatibleStorageLocations(state.purpose, master), ...(moving && state.allocated ? master.filter(location => location.status === 'Active' && location.plant === 'Branch Plant' && ['Ready for Ship Out', 'Temporary Finished Goods'].includes(location.locationType)) : [])];
  const names = [...new Set(options.map(location => location.name))];
  const confirm = () => {
    const saved = moving ? app.relocatePhysicalItem('Finished Pipe', pipe.id, location, reason) : app.updateFinishedGoodStorage(pipe.id, location, state.purpose === 'Inventory Storage' ? 'General Inventory' : 'Customer Order');
    setFeedback(saved ? `${pipe.barcode} confirmed at Location ${location}. Company On Hand is unchanged.` : 'Could not confirm. Select an active compatible location; moves also require a reason.');
    if (saved) { setLocation(''); setReason(''); }
  };
  return <div className="app-card detail-card page-stack">
    <div className="section-title">{moving ? 'Internal Storage Move / Ready for Ship Out' : 'Confirm Finished Pipe Storage'}</div>
    <div className="helper-text">Storage Purpose: {state.purpose} (automatic from production source)</div>
    <div className="field-value">Current Location: {pipe.currentLocation || 'Not Yet Assigned'}</div>
    <label className="block-label">Physical Storage Location
      <SearchableSelect value={location} options={names} onChange={setLocation} ariaLabel="Compatible Finished Pipe Storage Location" placeholder="Search compatible location..." />
    </label>
    {!names.length && <div className="alert-warning">No active compatible location is configured. Owner Settings must add a {state.purpose === 'Inventory Storage' ? 'Finished Goods Inventory' : 'Temporary Finished Goods'} location.</div>}
    {moving && <label className="block-label">Reason for internal movement<input className="app-input" value={reason} onChange={event => setReason(event.target.value)} /></label>}
    {feedback && <div role="status" className="helper-text">{feedback}</div>}
    <div className="action-row"><ActionButton className="btn-primary" confirmMessage={`${moving ? 'Move' : 'Store'} ${pipe.barcode} at Location ${location}? Company On Hand will not change.`} disabled={!location || (moving && !reason.trim())} onClick={confirm}>{moving ? 'Confirm Internal Move' : 'Confirm Storage'}</ActionButton></div>
  </div>;
}
