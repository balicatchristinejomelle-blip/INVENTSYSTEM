import type { StorageLocation, PelletInventory, ColorantInventory } from './types';
export const LOCATION_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export const SAMPLE_LOCATIONS: readonly StorageLocation[] = LOCATION_CODES.map((code, index) => ({ id: `demo-location-${code.toLowerCase()}-v1`, code, name: code, status: 'Active', plant: 'Branch Plant', locationType: index < 6 ? 'Finished Goods Inventory' : index < 8 ? 'Temporary Finished Goods' : 'Ready for Ship Out' }));
export function normalizeLocationMaster(stored: unknown): StorageLocation[] {
  const records: StorageLocation[] = Array.isArray(stored) ? stored.filter(record => record && typeof record.name === 'string' && typeof record.locationType === 'string') : [];
  const retained = records;
  return [...retained, ...SAMPLE_LOCATIONS.filter(sample => !retained.some(record => record.id === sample.id || record.code === sample.code || record.name === sample.name)).map(sample => ({ ...sample }))];
}
export function activeLocationCodes(locations: readonly StorageLocation[] = SAMPLE_LOCATIONS) { return LOCATION_CODES.filter(code => locations.some(location => location.status === 'Active' && (location.code || location.name) === code)); }
/** Active choices are canonical A–I codes only; saved legacy names remain readable. */
export function filterLocationCodes(locations: readonly StorageLocation[] = SAMPLE_LOCATIONS) { return activeLocationCodes(locations); }
export const physicalLocation = (record: { currentLocation?: string; storageLocation?: string; receivingLocation?: string }) => record.currentLocation || record.storageLocation || record.receivingLocation || '';
export const matchesLocation = (record: { currentLocation?: string; storageLocation?: string; receivingLocation?: string; locationBalances?: Record<string, number> }, location: string) => !location || location === 'All' || location === 'All Locations' || (record.locationBalances ? (record.locationBalances[location] || 0) > 0 : physicalLocation(record) === location);
export function locationQuantity(record: { availableKg: number; currentLocation?: string; locationBalances?: Record<string, number> }, location: string) { return location && location !== 'All' && location !== 'All Locations' ? record.locationBalances?.[location] ?? (record.currentLocation === location ? record.availableKg : 0) : record.availableKg; }
export function inventoryLocationLabel(record: { currentLocation?: string; storageLocation?: string; receivingLocation?: string; locationBalances?: Record<string, number> }) { const locations = Object.entries(record.locationBalances || {}).filter(([, quantity]) => quantity > 0); return locations.length > 1 ? locations.map(([location, quantity]) => `${location}: ${quantity.toFixed(3)} kg`).join(' · ') : locations[0]?.[0] || physicalLocation(record) || 'Not Yet Assigned'; }
/** Location bookkeeping only; material recipe/calculated consumption is unchanged. */
export function consumeLocationBalances(balances: Record<string, number> | undefined, quantity: number) { if (!balances) return undefined; const next = { ...balances }; let remaining = quantity; for (const location of Object.keys(next).sort()) { const consumed = Math.min(next[location], remaining); next[location] = Math.max(0, next[location] - consumed); remaining -= consumed; } return next; }
/** Only explicit stored demo seeds lacking a physical code get deterministic locations. Pending/user-entered records are untouched. */
export function migrateSampleLocations<T extends { pellets: PelletInventory[]; colorants: ColorantInventory[] }>(state: T): T {
  const sampleCode = (id: string) => LOCATION_CODES[Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % LOCATION_CODES.length];
  const pellets = state.pellets.map(bag => bag.isTestData && bag.batchNo.startsWith('TEST') && bag.locationStatus === 'Stored' && (!bag.currentLocation || ['Virgin Pellet Storage', 'Recycled Pellet Storage'].includes(bag.currentLocation)) ? { ...bag, currentLocation: sampleCode(bag.id) } : bag);
  const colors = [...state.colorants].filter(colorant => colorant.id.startsWith('test-colorant-')).sort((a, b) => a.id.localeCompare(b.id));
  const colorants = state.colorants.map(colorant => colorant.isTestData && colorant.id.startsWith('test-colorant-') && !colorant.currentLocation ? { ...colorant, currentLocation: LOCATION_CODES[colors.findIndex(row => row.id === colorant.id) % LOCATION_CODES.length], locationBalances: { [LOCATION_CODES[colors.findIndex(row => row.id === colorant.id) % LOCATION_CODES.length]]: colorant.availableKg } } : colorant);
  return pellets.every((row, index) => row === state.pellets[index]) && colorants.every((row, index) => row === state.colorants[index]) ? state : { ...state, pellets, colorants };
}
