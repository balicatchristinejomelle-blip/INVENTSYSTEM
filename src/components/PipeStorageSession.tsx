import React, { useRef, useState } from 'react';
import { useApp } from '../store';
import { finishedPipeInventory, readStorageLocations, validStorageLocation } from '../finishedGoodsInventory';
import { activeLocationCodes } from '../locationMaster';
import { exactPhysicalScan } from '../physicalScan';
import { resolveFinishedPipe } from '../finishedPipeRelations';
import LocationSelect from './LocationSelect';

/** Validate first; only an explicit confirmation stores the exact scanned physical pipe. */
export default function PipeStorageSession() {
  const app = useApp();
  const [location, setLocation] = useState(''), [barcode, setBarcode] = useState(''), [feedback, setFeedback] = useState('');
  const [validatedBarcode, setValidatedBarcode] = useState('');
  const [validatedPipeId, setValidatedPipeId] = useState('');
  const input = useRef<HTMLInputElement>(null);
  if (app.currentUser?.role !== 'plantmanager') return null;
  const validate = (value: string) => {
    const meta = { shift: app.currentShift, scannerMode: 'Store Finished Pipes', barcode: value };
    const pipe = app.finishedGoods.find(item => exactPhysicalScan(meta, item, app.finishedGoods));
    const inventory = pipe && finishedPipeInventory(pipe, app);
    const origin = pipe && resolveFinishedPipe(pipe, app);
    if (!pipe || !inventory) setFeedback('Unknown or ambiguous active pipe barcode. No data changed.');
    else if (pipe.locationStatus === 'Stored' || pipe.storageStatus === 'Stored') setFeedback('This pipe is already stored. No data changed.');
    else if (inventory.bucket !== 'Awaiting Storage') setFeedback('Duplicate or invalid lifecycle: this pipe is not Awaiting Storage. No data changed.');
    else if (!inventory.purpose || !origin?.source || (origin.source === 'Manufacturing Order' && !origin.order)) setFeedback('Valid production source and applicable customer order references are required. No data changed.');
    else return { pipe, inventory, meta };
    return undefined;
  };
  const scan = () => {
    setValidatedBarcode('');
    const valid = validate(barcode);
    if (valid) {
      setValidatedBarcode(valid.pipe.barcode);
      setValidatedPipeId(valid.pipe.id);
      setFeedback(`${valid.pipe.barcode}: Valid pipe. Select physical Location A-I and Confirm Storage. Storage Purpose: ${valid.inventory.purpose} (automatic).`);
    }
  };
  const confirm = () => {
    const valid = validate(validatedBarcode);
    if (!valid) { setValidatedBarcode(''); return; }
    if (valid.pipe.id !== validatedPipeId) { setValidatedBarcode(''); setFeedback('The scanned pipe identity changed. Scan again; no data changed.'); return; }
    if (!activeLocationCodes(readStorageLocations()).includes(location as never)) setFeedback('Select physical Storage Location A-I before confirmation. No data changed.');
    else if (!validStorageLocation(location, valid.inventory.purpose)) setFeedback(`Location ${location} is not compatible with ${valid.inventory.purpose}. Choose a compatible location; no data changed.`);
    else {
      const { pipe, inventory, meta } = valid;
      const saved = app.updateFinishedGoodStorage(pipe.id, location, inventory.purpose === 'Inventory Storage' ? 'General Inventory' : 'Customer Order', undefined, meta);
      setFeedback(saved ? `${pipe.barcode}: Stored at ${location}. Storage Purpose: ${inventory.purpose} (automatic). Ready for next pipe.` : 'Storage blocked. Recheck this pipe and its production references.');
      if (saved) { setBarcode(''); setValidatedBarcode(''); input.current?.focus(); }
    }
  };
  return <section className="app-card detail-card page-stack" style={{ whiteSpace: 'normal' }}>
    <h3 className="section-title">Pipe Storage</h3>
    <p className="helper-text">Scan a good pipe + Enter to validate, then select physical Location A-I and Confirm Storage. Customer Order / MO uses Temporary Storage; replenishment uses Inventory Storage automatically. The last selected location remains available for the next validated pipe.</p>
    <label className="block-label">Scan Pipe Barcode<input ref={input} className="app-input font-mono" aria-label="Scan Pipe Barcode" autoFocus autoComplete="off" value={barcode} onChange={event => { setBarcode(event.target.value); setValidatedBarcode(''); setFeedback(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); scan(); } }} placeholder="Scan existing barcode + Enter" /></label>
    <button className="btn-secondary" onClick={scan}>Validate Pipe</button>
    {validatedBarcode && <>
      <LocationSelect value={location} onChange={setLocation} />
      <button className="btn-primary" onClick={confirm}>Confirm Storage</button>
    </>}
    {feedback && <div className="alert-info" role="status">{feedback}</div>}
  </section>;
}
