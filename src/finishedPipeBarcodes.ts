import { STANDARD_DIAMETER_OPTIONS, STRAIGHT_LENGTH_OPTIONS, COIL_LENGTH_OPTIONS, SDR_RATINGS, PRODUCT_COLORS, STRIPE_OPTIONS } from './productMaster';
import type { FinishedGood, BarcodeRegistryRecord } from './types';
export const PIPE_COLOR_CODES: Readonly<Record<string, string>> = { 'Black (BK)': 'B', 'Blue (BE)': 'BE', 'Orange (OR)': 'O', 'Red Orange (RO)': 'RO', 'Green (GRN)': 'G' };
export const PIPE_STRIPE_CODES: Readonly<Record<string, string>> = { 'No Stripe': 'N', 'Blue Stripe': 'B', 'Orange Stripe': 'O', 'Green Stripe': 'G', 'Black Stripe': 'BK' };
type Specification = Pick<FinishedGood, 'diameter' | 'length' | 'sdr' | 'color' | 'stripe'>;
const normalized = (value: string) => value.normalize('NFKC').trim().toUpperCase();
export function encodePipeSize(value: string) {
  const size = value.trim(), mm = size.match(/^(\d+(?:\.\d+)?)mm$/i), inch = size.match(/^(\d+)(?:\/(\d+))?"$/);
  if (mm) return mm[1].replace('.', 'P');
  if (inch) return `I${inch[1]}${inch[2] ? `D${inch[2]}` : ''}`;
  if (!size) throw new Error('Size / Diameter is required for the physical barcode.');
  return `U${Array.from(new TextEncoder().encode(size), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
export function decodePipeSize(value: string) {
  if (/^\d+(?:P\d+)?$/.test(value)) return `${value.replace('P', '.')}mm`;
  const inch = value.match(/^I(\d+)(?:D(\d+))?$/);
  if (inch) return `${inch[1]}${inch[2] ? `/${inch[2]}` : ''}"`;
  if (/^U(?:[0-9A-F]{2})+$/.test(value)) return new TextDecoder().decode(Uint8Array.from(value.slice(1).match(/../g)!, byte => Number.parseInt(byte, 16)));
  throw new Error('Invalid encoded Size / Diameter.');
}
export function encodePipeLength(value: string) { const match = value.trim().match(/^(\d+(?:\.\d+)?)m$/i); if (!match || Number(match[1]) <= 0) throw new Error('Positive length in metres is required.'); return match[1].replace('.', 'P'); }
export function encodePipeSdr(value: string) { const match = value.trim().match(/^SDR\s*(\d+(?:\.\d+)?)$/i); if (!match || Number(match[1]) <= 0) throw new Error('SDR / Thickness is required.'); return match[1].replace('.', 'P'); }
const colorCode = (color: string) => PIPE_COLOR_CODES[color] || PIPE_COLOR_CODES[PRODUCT_COLORS.find(value => normalized(value.replace(/\s+\([^)]*\)$/, '')) === normalized(color.replace(/\s+\([^)]*\)$/, ''))) || ''];
const compactIndex = new Map<string, Array<{ diameter: string; length: string; sdr: string }>>();
for (const diameter of STANDARD_DIAMETER_OPTIONS) for (const length of [...STRAIGHT_LENGTH_OPTIONS, ...COIL_LENGTH_OPTIONS]) for (const sdr of SDR_RATINGS) { const body = `${encodePipeSize(diameter)}${encodePipeLength(length)}${encodePipeSdr(sdr)}`; compactIndex.set(body, [...(compactIndex.get(body) || []), { diameter, length, sdr }]); }
const compactMatches = (body: string) => compactIndex.get(body) || [];
export function finishedPipeBarcodePrefix(specification: Specification) {
  const size = encodePipeSize(specification.diameter), length = encodePipeLength(specification.length), sdr = encodePipeSdr(specification.sdr), color = colorCode(specification.color), stripe = PIPE_STRIPE_CODES[specification.stripe];
  if (!color || !stripe) throw new Error('Select a supported pipe Color and Stripe.');
  const compact = `${size}${length}${sdr}`;
  const matches = compactMatches(compact);
  const exactCompact = matches.length === 1 && encodePipeSize(matches[0].diameter) === size && encodePipeLength(matches[0].length) === length && encodePipeSdr(matches[0].sdr) === sdr;
  // Keep the exact requested integer example. Explicit X boundaries make decimals/inches/custom or ambiguous combinations reversible.
  return `${/^\d+$/.test(compact) && exactCompact ? compact : `${size}X${length}X${sdr}`}${color}${stripe}`;
}
export function parseFinishedPipeBarcode(barcode: string) {
  const value = normalized(barcode), serial = value.match(/^(.*)-SN(\d{3,})$/);
  if (!serial || !Number.isSafeInteger(Number(serial[2])) || Number(serial[2]) < 1) return null;
  const candidates = PRODUCT_COLORS.flatMap(color => STRIPE_OPTIONS.flatMap(stripe => {
    const suffix = `${PIPE_COLOR_CODES[color]}${PIPE_STRIPE_CODES[stripe]}`;
    if (!serial[1].endsWith(suffix)) return [];
    const body = serial[1].slice(0, -suffix.length);
    if (!body.includes('X')) return compactMatches(body).map(spec => ({ ...spec, color, stripe }));
    const parts = body.split('X');
    if (parts.length !== 3 || !/^\d+(?:P\d+)?$/.test(parts[1]) || !/^\d+(?:P\d+)?$/.test(parts[2]) || Number(parts[1].replace('P', '.')) <= 0 || Number(parts[2].replace('P', '.')) <= 0) return [];
    try { return [{ diameter: decodePipeSize(parts[0]), length: `${parts[1].replace('P', '.')}m`, sdr: `SDR${parts[2].replace('P', '.')}`, color, stripe }]; } catch { return []; }
  }));
  return candidates.length === 1 ? { ...candidates[0], serialNumber: `SN${serial[2]}`, serial: Number(serial[2]), barcode: value } : null;
}
export function allocateFinishedPipeBarcodes(count: number, specification: Specification, existing: Iterable<string>, serialFloor = 0) {
  if (!Number.isInteger(count) || count < 0) throw new Error('Physical pipe count must be a non-negative integer.');
  const used = new Set(Array.from(existing, normalized));
  let serial = Math.max(0, serialFloor);
  for (const value of used) serial = Math.max(serial, Number(value.match(/-SN(\d+)$/)?.[1]) || 0);
  const prefix = finishedPipeBarcodePrefix(specification);
  return Array.from({ length: count }, () => { do { serial++; } while (used.has(`${prefix}-SN${String(serial).padStart(3, '0')}`)); if (!Number.isSafeInteger(serial)) throw new Error('Finished Pipe serial sequence is exhausted.'); const barcode = `${prefix}-SN${String(serial).padStart(3, '0')}`; used.add(barcode); return { barcode, serialNumber: `SN${String(serial).padStart(3, '0')}` }; });
}
export function findFinishedPipeBarcode(barcode: string, pipes: readonly FinishedGood[]) {
  const value = normalized(barcode);
  if (!value) return null;
  const active = pipes.filter(pipe => normalized(pipe.barcode) === value);
  if (active.length === 1) return { pipe: active[0], legacy: false };
  if (active.length > 1) return { ambiguous: true };
  const legacy = pipes.filter(pipe => pipe.barcodeMigrations?.some(migration => normalized(migration.oldBarcode) === value));
  return legacy.length === 1 ? { pipe: legacy[0], legacy: true, message: `Legacy barcode. This Pipe has been migrated to: ${legacy[0].barcode}` } : legacy.length > 1 ? { ambiguous: true } : null;
}
/** Full in-place migration includes printed/requested pipes. No new physical records, stock movements or print counts. */
export function migrateFinishedPipeBarcodes<T extends { finishedGoods: FinishedGood[]; barcodeRegistry: BarcodeRegistryRecord[]; finishedPipeSerialHighWater?: number; reprintRequests?: Array<{ printable: { recordType: string; recordId: string; value?: string } }> }>(state: T, migratedAt = new Date().toISOString()): T {
  const used = new Set(state.barcodeRegistry.filter(row => row.category === 'Finished Pipe').map(row => row.barcode)); state.finishedGoods.forEach(pipe => used.add(pipe.barcode));
  const seen = new Set<number>(), replacements = new Map<string, string>(); let highWater = state.finishedPipeSerialHighWater || 0;
  const converted = [...state.finishedGoods].sort((a, b) => a.id.localeCompare(b.id)).map(pipe => {
    const parsed = parseFinishedPipeBarcode(pipe.barcode);
    if (parsed && !seen.has(parsed.serial) && pipe.barcode === `${finishedPipeBarcodePrefix(pipe)}-${parsed.serialNumber}`) { seen.add(parsed.serial); highWater = Math.max(highWater, parsed.serial); return pipe.serialNumber === parsed.serialNumber ? pipe : { ...pipe, serialNumber: parsed.serialNumber }; }
    const [next] = allocateFinishedPipeBarcodes(1, pipe, used, highWater); highWater = Number(next.serialNumber.slice(2)); seen.add(highWater); used.add(next.barcode); replacements.set(pipe.id, next.barcode);
    return { ...pipe, ...next, barcodeMigrations: [...(pipe.barcodeMigrations || []), { oldBarcode: pipe.barcode, newBarcode: next.barcode, migratedAt, migrationReason: 'Finished Pipe barcode format migration' as const }], legacyLabelObsolete: true };
  });
  const byId = new Map(converted.map(pipe => [pipe.id, pipe])), finishedGoods = state.finishedGoods.map(pipe => byId.get(pipe.id)!);
  const registeredPipes = state.barcodeRegistry.filter(row => row.category === 'Finished Pipe');
  const registryCurrent = registeredPipes.length === finishedGoods.length && finishedGoods.every(pipe => registeredPipes.filter(row => row.itemId === pipe.id && row.barcode === pipe.barcode && row.itemType === 'Finished Pipe').length === 1);
  if (!replacements.size && registryCurrent && finishedGoods.every((pipe, index) => pipe === state.finishedGoods[index]) && highWater === state.finishedPipeSerialHighWater) return state;
  const barcodeRegistry = [...state.barcodeRegistry.filter(row => row.category !== 'Finished Pipe'), ...finishedGoods.map(pipe => ({ barcode: pipe.barcode, itemId: pipe.id, itemType: 'Finished Pipe' as const, category: 'Finished Pipe' as const, createdAt: state.barcodeRegistry.find(row => row.itemId === pipe.id)?.createdAt || migratedAt }))];
  const reprintRequests = state.reprintRequests?.map(request => request.printable.recordType === 'Finished Pipe' && replacements.has(request.printable.recordId) ? { ...request, printable: { ...request.printable, value: replacements.get(request.printable.recordId) } } : request);
  return { ...state, finishedGoods, barcodeRegistry, finishedPipeSerialHighWater: highWater, ...(reprintRequests ? { reprintRequests } : {}) };
}
