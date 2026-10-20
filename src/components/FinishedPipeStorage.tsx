import ActionButton, { useDraftProtection } from './ActionButton';
import React, { useState } from 'react';
import type { FinishedGood } from '../types';
import { useApp } from '../store';
import { finishedPipeInventory, compatibleStorageLocations, readStorageLocations } from '../finishedGoodsInventory';
import SearchableSelect from './SearchableSelect';
import { exactPhysicalScan } from '../physicalScan';
import PipeStorageSession from './PipeStorageSession';

/** Plant Manager confirms a physical location, never a production purpose or buyer. */
export default function FinishedPipeStorage({ pipe }: { pipe: FinishedGood }) {
  const app = useApp();
  const state = finishedPipeInventory(pipe, app);
  const [scanSession] = useState(() => state.bucket === 'Awaiting Storage');
  const [location, setLocation] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [verifiedBarcode, setVerifiedBarcode] = useState('');
  useDraftProtection({ location, reason, scannedBarcode });
  if (app.currentUser?.role === 'plantmanager' && scanSession) return <PipeStorageSession />;
  if (app.currentUser?.role !== 'plantmanager' || pipe.qualityStatus !== 'Pass' || !state.purpose || ['Rejected', 'Shipped'].includes(state.bucket)) return null;
  const moving = !['Awaiting Storage', 'Quality Pending'].includes(state.bucket);
  const master = readStorageLocations();
  const options = [...compatibleStorageLocations(state.purpose, master), ...(moving && state.allocated ? master.filter(location => location.status === 'Active' && location.plant === 'Branch Plant' && ['Ready for Ship Out', 'Temporary Finished Goods'].includes(location.locationType)) : [])];
  const names = [...new Set(options.map(location => location.name))];
  const confirm = () => {
    const saved = moving ? app.relocatePhysicalItem('Finished Pipe', pipe.id, location, reason) : app.updateFinishedGoodStorage(pipe.id, location, state.purpose === 'Inventory Storage' ? 'General Inventory' : 'Customer Order', undefined, { shift: app.currentShift, scannerMode: 'Store Finished Pipes', barcode: verifiedBarcode });
    setFeedback(saved ? `${pipe.barcode} confirmed at Location ${location}. Company On Hand is unchanged.` : 'Could not confirm. Select an active compatible location; moves also require a reason.');
    if (saved) { setLocation(''); setReason(''); setScannedBarcode(''); setVerifiedBarcode(''); }
  };
  const scan = () => {
    const valid = exactPhysicalScan({ shift: app.currentShift, scannerMode: 'Store Finished Pipes', barcode: scannedBarcode }, pipe, app.finishedGoods);
    setVerifiedBarcode(valid ? scannedBarcode : '');
    setFeedback(valid ? 'Physical barcode verified. Choose a compatible location and confirm storage.' : 'Wrong or unknown barcode. Scan the exact physical pipe shown in this record. No state changed.');
  };
  return <div className="app-card detail-card page-stack">
    <div className="section-title">{moving ? 'Internal Storage Move / Ready for Ship Out' : 'Pipe Storage'}</div>
    <div className="helper-text">Storage Purpose: {state.purpose} (automatic from production source)</div>
    <div className="field-value">Current Location: {pipe.currentLocation || 'Not Yet Assigned'}</div>
    {!moving && <div className="page-stack"><label className="block-label">Scan Pipe Barcode<input className="app-input font-mono" aria-label="Scan Pipe Barcode" autoComplete="off" value={scannedBarcode} onChange={event => { setScannedBarcode(event.target.value); setVerifiedBarcode(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); scan(); } }} placeholder="Honeywell scan + Enter, or type exact barcode" /></label><button className="btn-secondary" onClick={scan}>Validate Storage Scan</button></div>}
    <label className="block-label">Physical Storage Location
      <SearchableSelect value={location} options={names} onChange={setLocation} ariaLabel="Compatible Finished Pipe Storage Location" placeholder="Search compatible location..." />
    </label>
    {!names.length && <div className="alert-warning">No active compatible location is configured. Owner Settings must add a {state.purpose === 'Inventory Storage' ? 'Finished Goods Inventory' : 'Temporary Finished Goods'} location.</div>}
    {moving && <label className="block-label">Reason for internal movement<input className="app-input" value={reason} onChange={event => setReason(event.target.value)} /></label>}
    {feedback && <div role="status" className="helper-text">{feedback}</div>}
    <div className="action-row"><ActionButton className="btn-primary" confirmMessage={`${moving ? 'Move' : 'Store'} ${pipe.barcode} at Location ${location}? Company On Hand will not change.`} disabled={!location || (!moving && !verifiedBarcode) || (moving && !reason.trim())} onClick={confirm}>{moving ? 'Confirm Internal Move' : 'Confirm Storage'}</ActionButton></div>
  </div>;
}
