import React, { useRef, useState } from 'react';
import { useApp } from '../store';
import { finishedPipeInventory, readStorageLocations, validStorageLocation } from '../finishedGoodsInventory';
import { activeLocationCodes } from '../locationMaster';
import { exactPhysicalScan } from '../physicalScan';
import LocationSelect from './LocationSelect';

/** A location belongs to this scan session, not to the last displayed pipe. */
export default function PipeStorageSession() {
  const app = useApp();
  const [location, setLocation] = useState(''), [barcode, setBarcode] = useState(''), [feedback, setFeedback] = useState('');
  const input = useRef<HTMLInputElement>(null);
  if (app.currentUser?.role !== 'plantmanager') return null;
  const scan = () => {
    const meta = { shift: app.currentShift, scannerMode: 'Store Finished Pipes', barcode };
    const pipe = app.finishedGoods.find(item => exactPhysicalScan(meta, item, app.finishedGoods));
    const inventory = pipe && finishedPipeInventory(pipe, app);
    if (!activeLocationCodes(readStorageLocations()).includes(location as never)) setFeedback('Select Location A-I once before scanning.');
    else if (!pipe || !inventory) setFeedback('Unknown or ambiguous active pipe barcode. No data changed.');
    else if (inventory.bucket !== 'Awaiting Storage') setFeedback('Duplicate or invalid lifecycle: this pipe is not Awaiting Storage. No data changed.');
    else if (!validStorageLocation(location, inventory.purpose)) setFeedback(`Location ${location} is not compatible with ${inventory.purpose}. Choose a compatible location; no data changed.`);
    else {
      const saved = app.updateFinishedGoodStorage(pipe.id, location, inventory.purpose === 'Inventory Storage' ? 'General Inventory' : 'Customer Order', undefined, meta);
      setFeedback(saved ? `${pipe.barcode}: Stored at ${location}. Storage Purpose: ${inventory.purpose} (automatic). Ready for next pipe.` : 'Storage blocked. Recheck this pipe and its production references.');
    }
    setBarcode('');
    input.current?.focus();
  };
  return <section className="app-card detail-card page-stack" style={{ whiteSpace: 'normal' }}>
    <h3 className="section-title">Pipe Storage</h3>
    <p className="helper-text">Select Location A-I once, then scan each good pipe + Enter. Customer Order / MO uses Temporary Storage; replenishment uses Inventory Storage. Existing location compatibility rules still apply.</p>
    <LocationSelect value={location} onChange={value => { setLocation(value); input.current?.focus(); }} />
    <label className="block-label">Scan Pipe Barcode<input ref={input} className="app-input font-mono" aria-label="Scan Pipe Barcode" autoComplete="off" value={barcode} onChange={event => setBarcode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); scan(); } }} placeholder="Scan existing barcode + Enter" /></label>
    <button className="btn-primary" onClick={scan}>Store Scanned Pipe</button>
    {feedback && <div className="alert-info" role="status">{feedback}</div>}
  </section>;
}
