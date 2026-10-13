import SearchableDropdown from "../../components/SearchableDropdown"

import React, { useEffect, useRef, useState } from "react"

import { isSupportedMaterialGrade, normalizeBarcodeValue, normalizeMaterialGrade, useApp } from '../../store';

import type { FinishedGood, PelletInventory } from '../../types';

type Category = "Pellet" | "Finished Pipe"

type ScannerMode = 'Receive Pellets' | 'Load Pellets' | 'Store Finished Pipes' | 'Release Finished Goods';

type ScanResult =
  | { category: 'Pellet'; barcode: string; itemType: string; record: PelletInventory }
  | { category: 'Finished Pipe'; barcode: string; itemType: string; record: FinishedGood };

type SessionScan = {
  barcode: string;
  category: Category;
  title: string;
  subtitle: string;
  quantity: number;
  status: string;
  date: string;
  time: string;
  reference: string;
  beforeInventory: number;
  change: number;
  afterInventory: number;
  employee: string;
  employeeId: string;
  shift: string;
  scannerMode: string;
  location?: string;
  poTotal?: number;
};

type LastScan = {
  kind: 'success' | 'duplicate';
  barcode: string;
  itemType: string;
  weight?: number;
  time: string;
  status: string;
  message: string;
  detail: string;
};

export default function BarcodeScanner() {
  const {
    pellets, finishedGoods, activeProductionOrder, transfers, orders, transactions,
    loadPellets, updateFinishedGoodStorage, receivePellet, relocatePhysicalItem, releaseFinishedGood,
    currentUser, currentShift, barcodeResetVersion, barcodeRegistry, navigate,
  } = useApp();

  const [mode, setMode] = useState<ScannerMode>('Load Pellets');

  const expected: Category = mode === 'Receive Pellets' || mode === 'Load Pellets' ? 'Pellet' : 'Finished Pipe';

  const [manualBarcode, setManualBarcode] = useState("")

  const [manualOpen, setManualOpen] = useState(false)

  const [scannerStatus, setScannerStatus] = useState('READY TO SCAN');

  const [result, setResult] = useState<ScanResult | null>(null);

  const [error, setError] = useState("")

  const [section, setSection] = useState("")

  const [rack, setRack] = useState("")

  const [storagePurpose, setStoragePurpose] = useState<'General Inventory' | 'Customer Order' | ''>('');

  const [storageOrderId, setStorageOrderId] = useState("")

  const [relocating, setRelocating] = useState(false)

  const [relocationReason, setRelocationReason] = useState("")

  const [sessionItems, setSessionItems] = useState<Record<string, SessionScan[]>>({});

  const [lastScan, setLastScan] = useState<LastScan | null>(null);

  const [completion, setCompletion] = useState("")

  const manualInputRef = useRef<HTMLInputElement>(null)

  const scannerBufferRef = useRef("")

  const scannerLastKeyRef = useRef(0)

  const scannerStartRef = useRef(0)

  const submitHardwareRef = useRef<(value: string) => void>(() => undefined);

  const lastSubmissionRef = useRef({ value: "", time: 0 })

  const processedRef = useRef(new Map<string, SessionScan>())

  const initialLoadedRef = useRef(new Map<string, number>())

  const activePO = activeProductionOrder

  const scannerMode = mode

  const releaseOrder = orders.find(order => order.status === 'Ready for Release')
    || orders.find(order => order.status === 'Released');

  const reference = mode === 'Load Pellets'
    ? activePO?.poNo || 'no-active-po'
    : mode === 'Release Finished Goods'
      ? releaseOrder?.orderNo || 'no-release-order'
      : mode.toLowerCase().replace(/ /g, '-');

  const sessionKey = `${mode.toLowerCase().replace(/ /g, '-')}:${reference}`;

  const scans = sessionItems[sessionKey] || []

  if (activePO && !initialLoadedRef.current.has(sessionKey)) initialLoadedRef.current.set(sessionKey, activePO.loadedKg);

  const previouslyLoaded = initialLoadedRef.current.get(sessionKey) || 0;

  const loadedThisSession = scans.reduce((sum, item) => sum + item.quantity, 0);

  const storedThisSession = scans.reduce((sum, item) => sum + item.quantity, 0);

  const modeLabel = mode === 'Release Finished Goods' ? 'Release Finished Pipes' : mode;

  const focusHardwareInput = () => undefined

  useEffect(() => {
    processedRef.current.clear();
    initialLoadedRef.current.clear();
    setSessionItems({});
    setLastScan(null);
    setCompletion('');
    setResult(null);
    setManualBarcode('');
    setManualOpen(false);
    setScannerStatus('READY TO SCAN');
    setError('');
    setSection('');
    setRack('');
    setStoragePurpose('');
    setStorageOrderId('');
    setRelocating(false);
    setRelocationReason('');
    focusHardwareInput();
  }, [barcodeResetVersion]);

  const duplicateKey = (value: string) => `${sessionKey}:${value.toLowerCase()}`;

  const showDuplicate = (item: SessionScan) => {
    setResult(null);
    setError('');
    setScannerStatus('ALREADY PROCESSED');
    setLastScan({
      kind: 'duplicate',
      barcode: item.barcode,
      itemType: item.subtitle,
      weight: item.category === 'Pellet' ? 25 : undefined,
      time: item.time,
      status: 'Already Processed',
      message: `${item.barcode} has already been scanned for ${item.scannerMode} (${item.reference}).`,
      detail: `${item.quantity}${item.category === 'Pellet' ? ' kg' : ''} previously processed by ${item.employee} at ${item.time}. No inventory changes were made.`,
    });
  };

  const processBarcode = (value: string) => {
    const clean = normalizeBarcodeValue(value)

    if (!clean) return

    setScannerStatus("PROCESSING")

    setError("")
    setCompletion("")
    setLastScan(null)

    const registryRecord = barcodeRegistry.find(item => normalizeBarcodeValue(item.barcode) === clean);

    if (!registryRecord) {
      setResult(null);
      setScannerStatus('BARCODE NOT FOUND');
      setError(`BARCODE NOT FOUND\nScanned Value: ${clean}\nThis barcode is not registered in HPAI inventory.`);
      return;
    }

    const pelletRecord = registryRecord.category === 'Pellet'
      ? pellets.find(item => item.id === registryRecord.itemId)
      : undefined;

    const finishedGoodRecord = registryRecord.category === 'Finished Pipe'
      ? finishedGoods.find(item => item.id === registryRecord.itemId)
      : undefined;

    const physicalRecord = pelletRecord || finishedGoodRecord

    if (!physicalRecord) {
      setResult(null);
      setScannerStatus('BARCODE NOT FOUND');
      setError(`BARCODE NOT FOUND\nScanned Value: ${clean}\nThe registry entry does not have a matching physical inventory record.`);
      return;
    }

    if (pelletRecord && !isSupportedMaterialGrade(pelletRecord.grade)) {
      setResult(null)

      setScannerStatus("INVALID PELLET GRADE")

      setError("INVALID PELLET GRADE\nSelect a supported material grade.")

      return
    }

    const found: ScanResult = registryRecord.category === 'Pellet'
      ? {
          category: 'Pellet',
          barcode: registryRecord.barcode,
          itemType: registryRecord.itemType,
          record: pelletRecord!,
        }
      : {
          category: 'Finished Pipe',
          barcode: registryRecord.barcode,
          itemType: registryRecord.itemType,
          record: finishedGoodRecord!,
        };

    if (found.category !== expected) {
      setResult(null);
      setScannerStatus('WRONG ITEM TYPE');
      setError(`WRONG ITEM TYPE\nThis operation requires a ${expected} barcode.\nScanned barcode belongs to ${found.itemType}.`);
      return;
    }

    if (mode === 'Release Finished Goods' && 'releaseStatus' in found.record && found.record.releaseStatus === 'Released') {
      setResult(null);
      setScannerStatus('ALREADY RELEASED');
      setError(`ALREADY RELEASED\nBarcode: ${found.barcode}\nReleased: ${found.record.releasedAt ? new Date(found.record.releasedAt).toLocaleString('en-PH') : 'Recorded'}\nCustomer Order: ${found.record.releaseReference || 'Recorded'}\nNo inventory changes were made.`);
      return;
    }

    const previousScan = processedRef.current.get(duplicateKey(found.record.barcode));

    if (previousScan) {
      showDuplicate(previousScan);
      return;
    }

    const isStorageOperation = mode === 'Receive Pellets' || mode === 'Store Finished Pipes';

    if (isStorageOperation && found.record.locationStatus === 'Stored') {
      setScannerStatus('ITEM FOUND');
      setResult(found);
      setRelocating(false);
      return;
    }

    const previousTransaction = transactions.find(item =>
      item.barcode?.toLowerCase() === found.record.barcode.toLowerCase()
      && item.scannerMode === scannerMode
    );

    if (previousTransaction) {
      showDuplicate({
        barcode: found.record.barcode,
        category: found.category,
        title: found.category === 'Pellet' ? found.record.batchNo : found.record.fgId,
        subtitle: previousTransaction.item,
        quantity: Math.abs(previousTransaction.qtyChanged) || (found.category === 'Finished Pipe' ? found.record.quantity : 25),
        status: 'Already Processed',
        date: previousTransaction.date,
        time: previousTransaction.time,
        reference: previousTransaction.reference,
        beforeInventory: previousTransaction.qtyBefore,
        change: previousTransaction.qtyChanged,
        afterInventory: previousTransaction.qtyAfter,
        employee: previousTransaction.employee,
        employeeId: previousTransaction.employeeId,
        shift: previousTransaction.shift || currentShift,
        scannerMode: previousTransaction.scannerMode || scannerMode,
      });
      return;
    }

    if (mode === 'Receive Pellets' && found.category === 'Pellet') {
      setScannerStatus('ITEM FOUND');
      setResult(found);
      return;
    }

    if (mode === 'Load Pellets' && found.category === 'Pellet' && found.record.inventoryStatus === 'Fully Consumed') {
      setResult(null);
      setLastScan(null);
      setScannerStatus('BAG FULLY CONSUMED');
      setError(`BAG FULLY CONSUMED\n${found.barcode} has already been fully consumed.`);
      return;
    }

    if (mode === 'Load Pellets' && found.category === 'Pellet' && ['Loaded', 'Partially Consumed'].includes(found.record.inventoryStatus)) {
      setResult(null);
      setLastScan(null);
      setScannerStatus('ALREADY LOADED');
      setError(`ALREADY LOADED\n${found.barcode} is already in Production WIP.`);
      return;
    }

    setScannerStatus("ITEM FOUND")

    setResult(found)
  }

  const submitBarcode = (rawValue: string, source: 'hardware' | 'manual') => {
    const clean = normalizeBarcodeValue(rawValue);
    if (!clean) {
      focusHardwareInput();
      return;
    }
    const now = Date.now();
    if (lastSubmissionRef.current.value === clean && now - lastSubmissionRef.current.time < 300) {
      focusHardwareInput();
      return;
    }
    lastSubmissionRef.current = { value: clean, time: now };
    if (source === 'manual') {
      setManualBarcode('');
      setManualOpen(false);
    }
    processBarcode(clean);
    focusHardwareInput();
  };

  submitHardwareRef.current = value => submitBarcode(value, 'hardware');

  useEffect(() => {
    const captureScannerInput = (event: KeyboardEvent) => {
      if (manualOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const now = performance.now();
      if (event.key === 'Enter') {
        const captured = scannerBufferRef.current;
        const elapsed = scannerStartRef.current ? now - scannerStartRef.current : Number.POSITIVE_INFINITY;
        const averageInterval = captured.length > 1 ? elapsed / (captured.length - 1) : Number.POSITIVE_INFINITY;
        scannerBufferRef.current = '';
        scannerLastKeyRef.current = 0;
        scannerStartRef.current = 0;
        if (captured.length >= 4 && averageInterval <= 50) {
          event.preventDefault();
          submitHardwareRef.current(captured);
        }
        return;
      }
      if (event.key.length !== 1) return;
      if (scannerLastKeyRef.current && now - scannerLastKeyRef.current > 80) {
        scannerBufferRef.current = '';
        scannerStartRef.current = 0;
      }
      if (!scannerBufferRef.current) scannerStartRef.current = now;
      scannerBufferRef.current += event.key;
      scannerLastKeyRef.current = now;
    };
    window.addEventListener('keydown', captureScannerInput);
    return () => window.removeEventListener('keydown', captureScannerInput);
  }, [manualOpen]);

  useEffect(() => {
    if (!error) return;
    const heading = error.split('\n')[0];
    const supportedStatuses = ['BARCODE NOT FOUND', 'WRONG ITEM TYPE', 'INVALID PELLET GRADE', 'INCOMPATIBLE MATERIAL', 'ALREADY PROCESSED', 'ALREADY RELEASED', 'ALREADY LOADED', 'BAG FULLY CONSUMED'];
    setScannerStatus(supportedStatuses.includes(heading) ? heading : 'VALIDATION ERROR');
    focusHardwareInput();
    const readyTimer = window.setTimeout(() => setScannerStatus('READY TO SCAN'), 1600);
    return () => window.clearTimeout(readyTimer);
  }, [error]);

  useEffect(() => {
    if (!lastScan) return;
    setScannerStatus(lastScan.kind === 'duplicate' ? 'ALREADY PROCESSED' : 'SCAN SUCCESSFUL');
    focusHardwareInput();
    const readyTimer = window.setTimeout(() => setScannerStatus('READY TO SCAN'), 1600);
    return () => window.clearTimeout(readyTimer);
  }, [lastScan]);

  const confirmPellet = () => {
    if (!result || result.category !== 'Pellet' || !activePO || !('availableKg' in result.record)) return;
    const duplicate = processedRef.current.get(duplicateKey(result.record.barcode));
    if (duplicate) return showDuplicate(duplicate);
    if (result.record.inventoryStatus === 'Fully Consumed') return setError('BAG FULLY CONSUMED');
    if (result.record.inventoryStatus === 'Loaded' || result.record.inventoryStatus === 'Partially Consumed') return setError('ALREADY LOADED');
    if (result.record.availableKg !== 25 || result.record.inventoryStatus !== 'Available') return setError(`WRONG LIFECYCLE — Bag status is ${result.record.inventoryStatus}.`);
    if (normalizeMaterialGrade(result.record.grade) !== normalizeMaterialGrade(activePO.grade)) return setError(`INCOMPATIBLE MATERIAL\nThis batch is ${normalizeMaterialGrade(result.record.grade)}. ${activePO.poNo} requires ${normalizeMaterialGrade(activePO.grade)}.`);
    const now = new Date();
    const time = now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    const item: SessionScan = {
      barcode: result.record.barcode,
      category: 'Pellet',
      title: result.record.batchNo,
      subtitle: `${result.record.type} Pellet`,
      quantity: 25,
      status: 'Loaded',
      date: now.toISOString().slice(0, 10),
      time,
      reference: activePO.poNo,
      beforeInventory: result.record.availableKg,
      change: -25,
      afterInventory: 0,
      employee: currentUser?.name || '',
      employeeId: currentUser?.employeeId || '',
      shift: currentShift,
      scannerMode,
      poTotal: activePO.loadedKg + 25,
    };
    processedRef.current.set(duplicateKey(item.barcode), item);
    setSessionItems(items => ({ ...items, [sessionKey]: [...(items[sessionKey] || []), item] }));
    loadPellets(result.record.id, activePO.id, { shift: currentShift, scannerMode });
    setLastScan({
      kind: 'success',
      barcode: item.barcode,
      itemType: `${result.record.type} Pellet Bag`,
      weight: 25,
      time: item.time,
      status: 'Loaded',
      message: '1 bag · 25 kg loaded',
      detail: `Raw available: ${item.beforeInventory} kg → ${item.afterInventory} kg · WIP loaded: 25 kg · PO total: ${item.poTotal} kg`,
    });
    setResult(null);
  };

  const confirmStorage = () => {
    if (!result || result.category !== 'Finished Pipe' || !section || !storagePurpose || !('availableQty' in result.record)) return;
    const duplicate = processedRef.current.get(duplicateKey(result.record.barcode));
    if (duplicate) return showDuplicate(duplicate);
    const location = `${section}${rack.trim() ? ` / ${rack.trim()}` : ''}`;
    const now = new Date();
    const time = now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    const item: SessionScan = {
      barcode: result.record.barcode,
      category: 'Finished Pipe',
      title: result.record.fgId,
      subtitle: `${result.record.product} ${result.record.diameter} ${result.record.length}`,
      quantity: 1,
      status: 'Stored',
      date: now.toISOString().slice(0, 10),
      time,
      reference: result.record.poRef,
      beforeInventory: result.record.availableQty,
      change: 0,
      afterInventory: result.record.availableQty,
      employee: currentUser?.name || '',
      employeeId: currentUser?.employeeId || '',
      shift: currentShift,
      scannerMode,
      location,
    };
    if (!updateFinishedGoodStorage(result.record.id, location, storagePurpose, storageOrderId || undefined, { shift: currentShift, scannerMode })) {
      setError('Storage could not be saved. Complete the required purpose, Customer Order, and valid location fields.');
      return;
    }
    processedRef.current.set(duplicateKey(item.barcode), item);
    setSessionItems(items => ({ ...items, [sessionKey]: [...(items[sessionKey] || []), item] }));
    setLastScan({
      kind: 'success',
      barcode: item.barcode,
      itemType: 'Finished Pipe',
      time: item.time,
      status: 'Stored',
      message: '1 pipe stored',
      detail: `${location} · ${item.time}`,
    });
    setResult(null); setSection(''); setRack(''); setStoragePurpose(''); setStorageOrderId('');
  };

  const confirmRelocation = () => {
    if (!result || !section || !relocationReason.trim()) return;
    const location = `${section}${rack.trim() ? ` / ${rack.trim()}` : ''}`;
    if (!relocatePhysicalItem(result.category, result.record.id, location, relocationReason)) {
      setError('Relocation could not be saved. Choose a different valid location and provide a reason.');
      return;
    }
    setLastScan({
      kind: 'success',
      barcode: result.barcode,
      itemType: result.itemType,
      time: new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
      status: 'Relocated',
      message: `Item relocated to ${location}`,
      detail: `Reason: ${relocationReason.trim()} · ${currentUser?.name || ''}`,
    });
    setResult(null); setSection(''); setRack(''); setRelocating(false); setRelocationReason('');
  };

  const confirmReceive = () => {
    if (!result || result.category !== 'Pellet' || !('availableKg' in result.record)) return;
    const duplicate = processedRef.current.get(duplicateKey(result.record.barcode));
    if (duplicate) return showDuplicate(duplicate);
    const transfer = transfers.find(item => item.batchNo === result.record.batchNo && item.status === 'In Transit');
    const destination = result.record.type === 'Virgin' ? 'Virgin Pellet Storage' : 'Recycled Pellet Storage';
    const now = new Date();
    const item: SessionScan = {
      barcode: result.record.barcode,
      category: 'Pellet',
      title: result.record.batchNo,
      subtitle: `${result.record.type} Pellet`,
      quantity: 25,
      status: result.record.type === 'Virgin' ? 'Received' : 'Stored',
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
      reference: transfer?.refNo || result.record.rrRef || result.record.recyclingBatchRef || result.record.batchNo,
      beforeInventory: result.record.availableKg,
      change: result.record.inventoryStatus === 'Pending Receipt' ? 25 : 0,
      afterInventory: 25,
      employee: currentUser?.name || '',
      employeeId: currentUser?.employeeId || '',
      shift: currentShift,
      scannerMode,
      location: destination,
    };
    if (!receivePellet(result.record.id, { shift: currentShift, scannerMode })) {
      return setError('This item has already been received or stored. Use Relocate Item for an authorized location change.');
    }
    processedRef.current.set(duplicateKey(item.barcode), item);
    setSessionItems(items => ({ ...items, [sessionKey]: [...(items[sessionKey] || []), item] }));
    setLastScan({ kind: 'success', barcode: item.barcode, itemType: `${result.record.type} Pellet Bag`, weight: 25, time: item.time, status: item.status, message: `25 kg ${item.status.toLowerCase()} in ${destination}`, detail: `${item.reference} · ${result.record.currentLocation || 'Not Yet Assigned'} → ${destination}` });
    setResult(null);
  };

  const confirmRelease = () => {
    if (!result || result.category !== 'Finished Pipe' || !('availableQty' in result.record)) return;
    const duplicate = processedRef.current.get(duplicateKey(result.record.barcode));
    if (duplicate) return showDuplicate(duplicate);
    if (result.record.releaseStatus === 'Released') return setError(`ALREADY RELEASED\nBarcode: ${result.record.barcode}\nReleased: ${result.record.releasedAt ? new Date(result.record.releasedAt).toLocaleString('en-PH') : 'Recorded'}\nCustomer Order: ${result.record.releaseReference || 'Recorded'}\nNo inventory changes were made.`);
    if (result.record.qualityStatus !== 'Pass') return setError('QUALITY PASS REQUIRED');
    if (result.record.availableQty <= 0 && result.record.reservedQty <= 0) return setError(`WRONG LIFECYCLE — Pipe status is ${result.record.status}.`);
    const matchingOrder = orders.find(order => order.id === result.record.reservedForOrderId);
    if (!matchingOrder) return setError('No authorized Customer Order reservation matches this finished good.');
    const now = new Date();
    const item: SessionScan = {
      barcode: result.record.barcode,
      category: 'Finished Pipe',
      title: result.record.fgId,
      subtitle: `${result.record.product} ${result.record.diameter}`,
      quantity: 1,
      status: 'Released',
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }),
      reference: matchingOrder.orderNo,
      beforeInventory: result.record.availableQty,
      change: -1,
      afterInventory: 0,
      employee: currentUser?.name || '',
      employeeId: currentUser?.employeeId || '',
      shift: currentShift,
      scannerMode,
    };
    if (!releaseFinishedGood(result.record.id, { shift: currentShift, scannerMode })) {
      return setError('PIPE RESERVED FOR ANOTHER ORDER');
    }
    processedRef.current.set(duplicateKey(item.barcode), item);
    setSessionItems(items => ({ ...items, [sessionKey]: [...(items[sessionKey] || []), item] }));
    setLastScan({ kind: 'success', barcode: item.barcode, itemType: 'Finished Pipe', time: item.time, status: 'Released', message: `${item.quantity} pipe released`, detail: `${matchingOrder.orderNo} · Released by ${item.employee} at ${item.time}` });
    setResult(null);
  };

  useEffect(() => {
    if (!result) return;
    if (mode === 'Store Finished Pipes' && result.category === 'Finished Pipe' && result.record.locationStatus !== 'Stored') {
      const suggestedOrderId = result.record.reservedForOrderId || '';
      setStoragePurpose(suggestedOrderId ? 'Customer Order' : '');
      setStorageOrderId(suggestedOrderId);
      setSection('');
    }
    if (mode === 'Load Pellets' && 'inventoryStatus' in result.record && result.record.inventoryStatus === 'Available') confirmPellet();
    if (mode === 'Release Finished Goods') confirmRelease();
  }, [result]);

  const finishSession = () => {
    if (!scans.length) return;
    setCompletion(`SCANNING COMPLETE — ${scans.length} barcode(s), ${scans.reduce((sum, item) => sum + item.quantity, 0)} processed in ${mode}.`);
    scans.forEach(item => processedRef.current.delete(`${sessionKey}:${item.barcode.toLowerCase()}`));
    setSessionItems(items => ({ ...items, [sessionKey]: [] }));
    if (activePO) initialLoadedRef.current.set(sessionKey, activePO.loadedKg);
    setLastScan(null);
  };

  const hasBottomAction = (result?.category === 'Pellet' && mode === 'Receive Pellets' && result.record.locationStatus !== 'Stored')
    || (result?.category === 'Finished Pipe' && mode === 'Store Finished Pipes' && (result.record.locationStatus !== 'Stored' || relocating))
    || scans.length > 0;

  return (
    <div className={`scanner-page page-stack${hasBottomAction ? ' has-bottom-action' : ''}`}>
      <div>
      <div className="section-title">Production Barcode Scanner</div>
      <div className="helper-text">Honeywell Voyager XP 1470g hardware scanning with manual entry fallback.</div>
    </div>
      {sessionStorage.getItem('hpai:production-output-draft') && <div className="alert-info">
      Production output entry is paused while materials are loaded.
      <button className="btn-secondary btn-compact ml-2" onClick={() => navigate('prod-orders')}>Return to Production Output</button>
    </div>}
      <div className="scanner-context">
        <div>
          <span className="field-label">Current Operation</span>
          <strong>{modeLabel}</strong>
          <div>
            {mode === 'Load Pellets' ? activePO?.poNo || 'No active Production Order' : mode === 'Release Finished Goods' ? releaseOrder?.orderNo || 'No order ready for release' : 'Authorized physical operation'}
          </div>
        </div>
        <SearchableDropdown
          className="app-select" value={mode} onChange={e => { setMode(e.target.value as ScannerMode); setResult(null); setError(''); setLastScan(null); setCompletion(''); setScannerStatus('READY TO SCAN'); focusHardwareInput(); }}
        >
          <option>Receive Pellets</option>
          <option>Load Pellets</option>
          <option>Store Finished Pipes</option>
          <option value="Release Finished Goods">Release Finished Pipes</option>
        </SearchableDropdown>
      </div>
      <section className="app-card detail-card hardware-scanner-card">
        <div className="hardware-scanner-heading">
          <div>
            <div className="section-title">Hardware Scanner</div>
            <strong>Honeywell Voyager XP 1470g</strong>
          </div>
          <div className="scanner-status" aria-live="polite">
            <span>Status</span>
            <strong>{scannerStatus}</strong>
          </div>
        </div>
        <div className="block-label">Scan the physical barcode using the Honeywell scanner.</div>
        <div className="hardware-scanner-display font-mono" role="status" aria-live="polite">
        <span className="scanner-capture-indicator" aria-hidden="true" />
        <span>Ready for Honeywell scan</span>
      </div>
        <div className="helper-text">Scanner capture is active. This panel is not editable; the Honeywell Enter suffix submits one scan.</div>
        <div className="action-row">
        <button className="btn-secondary" onClick={() => { setManualOpen(true); window.setTimeout(() => manualInputRef.current?.focus(), 0); }}>Enter Manually</button>
        <button className="btn-secondary" onClick={() => navigate('production-dashboard')}>Close</button>
      </div>
      </section>
      {manualOpen && <section className="app-card detail-card">
      <div className="section-title">Enter Barcode Manually</div>
      <label className="block-label" htmlFor="manual-barcode-input">Barcode</label>
      <div className="input-action">
        <input
          ref={manualInputRef}
          id="manual-barcode-input"
          className="app-input font-mono"
          value={manualBarcode}
          onChange={event => setManualBarcode(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submitBarcode(event.currentTarget.value, 'manual');
          }}
          placeholder="Enter the exact barcode value"
          autoComplete="off"
        />
        <button className="btn-primary" onClick={() => submitBarcode(manualBarcode, 'manual')}>Submit</button>
        <button className="btn-secondary" onClick={() => { setManualOpen(false); setManualBarcode(''); focusHardwareInput(); }}>Cancel</button>
      </div>
      <div className="helper-text">Use the complete value printed below the physical barcode label.</div>
    </section>}
      {error && <div className="alert-error">{error}</div>}
      {result?.category === "Pellet" && (
        <div className="app-card detail-card">
          <div className="result-heading">
            Item Found <span className="badge-blue">{result.itemType}</span>
          </div>
          <div className="responsive-grid">
            <Info label="Barcode" value={result.barcode} />
            <Info label="Pellet Type" value={result.record.type} />
            <Info label="Batch" value={result.record.batchNo} />
            <Info label="Grade / Color" value={`${result.record.grade} · ${result.record.color}`} />
            <Info label="Weight" value="25 kg" />
            <Info label="Available" value={`${result.record.availableKg} kg`} />
            <Info label="Source" value={result.record.transferRef || result.record.rrRef || result.record.recyclingBatchRef || 'Physical inventory'} />
            <Info label="Inventory Status" value={result.record.inventoryStatus} />
            <Info label="Current Location" value={result.record.currentLocation || 'Not Yet Assigned'} />
            <Info label="Location Status" value={result.record.locationStatus || 'Not Yet Assigned'} />
            {activePO && (
              <>
                <Info label="Production Order" value={activePO.poNo} />
                <Info label="Pellet Grade" value={activePO.grade} />
                <Info label="Actual Loaded" value={`${activePO.loadedKg} kg`} />
              </>
            )}
          </div>
          {mode === "Receive Pellets" ? (
            result.record.locationStatus === "Stored" ? (
              <div className="alert-info mt-3">
                This bag is already stored at{" "}
                <strong>{result.record.currentLocation}</strong>. Its location
                was not overwritten.
              </div>
            ) : (
              <div className="confirm-panel">
                <div>
                  <span className="field-label">Destination Location</span>
                  <strong>
                    {result.record.type === 'Virgin' ? 'Virgin Pellet Storage' : 'Recycled Pellet Storage'}
                  </strong>
                </div>
              </div>
            )
          ) : activePO && result.record.inventoryStatus === "Available" ? (
            <div className="confirm-panel">
              <div>
                <span className="field-label">Physical Bag</span>
                <strong>1 bag · 25 kg</strong>
              </div>
              <button className="btn-primary" onClick={confirmPellet}>Confirm Pellet Load</button>
            </div>
          ) : (
            <div className="alert-info mt-3">
              {activePO
            ? result.record.inventoryStatus === 'Fully Consumed' ? 'BAG FULLY CONSUMED'
              : ['Loaded', 'Partially Consumed'].includes(result.record.inventoryStatus) ? `ALREADY LOADED — ${result.record.availableKg} kg WIP remaining`
                : `Item found. Location: ${result.record.locationStatus}. Complete receiving before pellet loading.`
            : 'No active production order. The pellet was identified without changing inventory.'}
            </div>
          )}
        </div>
      )}
      {result?.category === "Finished Pipe" && (
        <div className="app-card detail-card">
          <div className="result-heading">
            Item Found <span className="badge-blue">Finished Pipe</span>
          </div>
          <div className="responsive-grid">
            <Info label="Barcode" value={result.barcode} />
            <Info label="Finished Goods ID" value={result.record.fgId} />
            <Info label="Product" value={`${result.record.product} ${result.record.diameter} ${result.record.length}`} />
            <Info label="Specifications" value={`${result.record.sdr} · ${result.record.grade} · ${result.record.color} · ${result.record.stripe}`} />
            <Info label="Batch / PO" value={`${result.record.batch} · ${result.record.poRef}`} />
            <Info label="Available / Reserved" value={`${result.record.availableQty} / ${result.record.reservedQty}`} />
            <Info label="Storage Status" value={result.record.storageStatus} />
            <Info label="Release Status" value={result.record.releaseStatus} />
            <Info label="Current Location" value={result.record.currentLocation || 'Not Yet Assigned'} />
            <Info label="Status" value={result.record.status} />
          </div>
          {mode === "Store Finished Pipes" ? (
            <>
              {result.record.locationStatus === "Stored" && !relocating ? (
                <div className="action-row mt-3">
                  <button className="btn-secondary" onClick={() => setRelocating(true)}>Relocate Item</button>
                </div>
              ) : (
                <>
                  {!relocating && <div className="mt-3">
              <div className="section-title">Where should this pipe go?</div>
              <div className="action-row">
                <button className={storagePurpose === 'General Inventory' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setStoragePurpose('General Inventory'); setStorageOrderId(''); setSection(''); }}>General Inventory</button>
                <button className={storagePurpose === 'Customer Order' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setStoragePurpose('Customer Order'); setSection(''); }}>Customer Order</button>
              </div>
            </div>}
                  {storagePurpose === "Customer Order" && !relocating && (
                    <label className="block-label mt-3">
                      Customer Order / Buyer
                      <SearchableDropdown
                        className="app-select" value={storageOrderId} onChange={e => setStorageOrderId(e.target.value)}
                      >
                        <option value="">Select Customer Order</option>
                        {orders.filter(order => order.status !== 'Released' && order.status !== 'Completed').map((order) => (
                            <option key={order.id} value={order.id}>
                              {order.orderNo} · {order.customerName}
                            </option>
                          ))}
                      </SearchableDropdown>
                    </label>
                  )}
                  {(relocating || storagePurpose) && (
                    <div className="form-grid mt-3">
                      <label>
                        {relocating ? "New Location" : "Storage Location"}
                        <SearchableDropdown
                          className="app-select" value={section} onChange={e => setSection(e.target.value)}
                        >
                          <option value="">Select location</option>
                          {((relocating ? result.record.inventoryPurpose : storagePurpose) === 'Customer Order' ? ['Customer Order Staging', 'Reserved Order Area', 'Ready for Ship-Out Area'] : ['Section A', 'Section B', 'Section C', 'Section D']).map(location => <option key={location}>{location}</option>)}
                        </SearchableDropdown>
                      </label>
                      {(relocating ? result.record.inventoryPurpose : storagePurpose) === 'General Inventory' && (
                        <label>
                          Rack / Row / Bay / Area (Optional)
                          <input className="app-input" value={rack} onChange={e => setRack(e.target.value)} />
                        </label>
                      )}
                    </div>
                  )}
                  {relocating && (
                    <label className="block-label mt-3">
                      Reason for Relocation
                      <input className="app-input" value={relocationReason} onChange={e => setRelocationReason(e.target.value)} placeholder="Enter required reason" />
                    </label>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="action-row mt-3">
              <button className="btn-primary" disabled={(result.record.availableQty <= 0 && result.record.reservedQty <= 0) || result.record.releaseStatus === 'Released' || result.record.qualityStatus !== 'Pass'} onClick={confirmRelease}>Confirm Release</button>
            </div>
          )}
        </div>
      )}
      {hasBottomAction && <div className="scanner-bottom-action">
      {result?.category === 'Pellet' && mode === 'Receive Pellets' && result.record.locationStatus !== 'Stored'
        ? <button className="btn-success" onClick={confirmReceive}>
            {result.record.type === 'Virgin' ? 'Confirm Receipt' : 'Confirm Storage'}
          </button>
        : result?.category === 'Finished Pipe' && mode === 'Store Finished Pipes' && (result.record.locationStatus !== 'Stored' || relocating)
          ? <button className="btn-primary" disabled={!section || (!relocating && (!storagePurpose || (storagePurpose === 'Customer Order' && !storageOrderId))) || (relocating && !relocationReason.trim())} onClick={relocating ? confirmRelocation : confirmStorage}>
              {relocating ? 'Confirm Relocation' : 'Confirm Storage'}
            </button>
          : <button className="btn-primary" onClick={finishSession}>
              {mode === 'Receive Pellets' ? 'Complete Receiving'
                : mode === 'Load Pellets' ? 'Finish Pellet Loading'
                  : mode === 'Store Finished Pipes' ? 'Complete Finished Pipe Storage'
                    : 'Complete Release'}
            </button>}
    </div>}
      {!lastScan && (
        <div className="app-card detail-card scan-feedback">
          <div className="section-title">Last Scan</div>
          <div className="empty-state">No scan yet.</div>
        </div>
      )}
      {lastScan && (
        <div className={lastScan.kind === 'duplicate' ? 'alert-error scan-feedback' : 'alert-success scan-feedback'}>
          <div className="section-title">
            {lastScan.kind === 'duplicate' ? 'Already Processed' : 'Last Scan'}
          </div>
          <Info label="Detected Item" value={lastScan.itemType} />
          <Info label="Barcode" value={<strong className="font-mono">{lastScan.barcode}</strong>} />
          {lastScan.weight && <Info label="Weight" value={`${lastScan.weight} kg`} />}
          <Info label="Time" value={lastScan.time} />
          <Info label="Status" value={lastScan.status} />
          <div>{lastScan.message}</div>
          <small>{lastScan.detail}</small>
          {lastScan.kind === 'duplicate' && <button className="btn-secondary" onClick={() => setLastScan(null)}>OK</button>}
        </div>
      )}
      {completion && (
        <div className="alert-success scan-feedback">
          <strong>{completion}</strong>
          <div>
            Scanned by {currentUser?.name} · {currentUser?.employeeId} ·{" "}
            {currentShift} Shift
          </div>
        </div>
      )}
      <section className="app-card detail-card scan-session">
        <div className="section-title">Scanned This Session</div>
        {mode === 'Load Pellets' && activePO && <div className="scan-session-context">
        <Info label="PO" value={activePO.poNo} />
        <Info label="Expected Usage" value="No BOM defined — actual usage only" />
        <Info label="Previously Loaded" value={`${previouslyLoaded} kg`} />
      </div>}
        {mode === 'Release Finished Goods' && releaseOrder && <div className="scan-session-context">
        <Info label="Customer Order" value={releaseOrder.orderNo} />
        <Info label="Customer" value={releaseOrder.customerName} />
        <Info label="Required" value={releaseOrder.quantity} />
      </div>}
        {scans.length === 0 ? <div className="empty-state">No successfully processed barcodes in this session.</div> : (
          <div className="scan-item-list">
            {scans.map((item, index) => (
              <article className="scan-item" key={`${item.barcode}-${item.time}`}>
                <div className="scan-item-number">{index + 1}</div>
                <div className="scan-item-body">
                  <strong className="font-mono">{item.barcode}</strong>
                  <span>
                    {item.title} · {item.subtitle}
                  </span>
                  {item.location && <span>{item.location}</span>}
                </div>
                <div className="scan-item-result">
                  <strong>
                    {item.quantity}
                    {item.category === "Pellet" ? " kg" : ""}
                  </strong>
                  <span>{item.status}</span>
                  <time>{item.time}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="app-card detail-card session-summary">
        <div className="section-title">Session Summary</div>
        {mode === "Load Pellets" ? (
          <>
            <div className="responsive-grid">
          <Info label="Bags Scanned" value={scans.length} />
          <Info label="Loaded This Session" value={`${loadedThisSession} kg`} />
          <Info label="Total PO Loaded" value={`${activePO?.loadedKg || 0} kg`} />
          <Info label="Usage Basis" value="Successful bag scans" />
        </div>
            {activePO && (
              <div className="scan-progress">
                <div>
                  <strong>
                    {activePO.loadedKg} kg loaded to Production WIP
                  </strong>
                  <span>{Math.round(activePO.loadedKg / 25)} bags</span>
                </div>
              </div>
            )}
          </>
        ) : mode === 'Release Finished Goods' ? <div className="responsive-grid">
        <Info label="Pipes Scanned" value={scans.length} />
        <Info label="Pipes Released" value={storedThisSession} />
        <Info label="Required" value={releaseOrder?.quantity || 0} />
        <Info label="Remaining" value={Math.max(0, (releaseOrder?.quantity || 0) - storedThisSession)} />
      </div> : mode === 'Receive Pellets' ? <div className="responsive-grid">
        <Info label="Bags Scanned" value={scans.length} />
        <Info label="Received This Session" value={`${storedThisSession} kg`} />
        <Info label="Reference" value={reference} />
        <Info label="Scanned By" value={currentUser?.name || '—'} />
      </div> : <div className="responsive-grid">
        <Info label="Pipes Scanned" value={scans.length} />
        <Info label="Pipes Stored" value={storedThisSession} />
        <Info label="Reference" value={reference} />
        <Info label="Scanned By" value={currentUser?.name || '—'} />
      </div>}
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string ; value: React.ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div className="field-value">{value}</div>
    </div>
  )
}
