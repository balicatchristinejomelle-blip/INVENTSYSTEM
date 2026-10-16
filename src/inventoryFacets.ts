import { normalizeProductType } from './productMaster';
/** Read-only inventory facets. Callers supply only their already-visible records. */
export type FacetRow = Readonly<Record<string, readonly string[]>>;
export type FacetSelection = Record<string, string>;
export const facetValue = (value: unknown) => typeof value === 'string' && !/^all(?:\s|$)/i.test(value) ? value : '';
const valuesFor = (rows: readonly FacetRow[], key: string) => [...new Set(rows.flatMap(row => row[key] || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const comparable = (key: string, value: string) => key === 'color' ? value.replace(/\s+\([^)]*\)$/, '').toLowerCase() : key === 'product' ? normalizeProductType(value) : value;
export const matchesFacets = (row: FacetRow, selected: FacetSelection) => Object.entries(selected).every(([key, value]) => !facetValue(value) || row[key]?.some(option => comparable(key, option) === comparable(key, value)));

/** Only physical Location depends on inventory. Never rewrite specification, purpose or status choices. */
export function resolveInventoryLocations(rows: readonly FacetRow[], selected: FacetSelection, physicalLocations: readonly string[]) {
  const constraints = Object.fromEntries(Object.entries(selected).filter(([key]) => ['product', 'grade', 'color', 'size', 'sdr', 'length'].includes(key)));
  const constrained = Object.values(constraints).some(value => !!facetValue(value));
  const configured = (value: string) => physicalLocations.some(location => value === location || value.startsWith(location + ' / '));
  if (!constrained) {
    const options = [...new Set([...physicalLocations, ...valuesFor(rows, 'location').filter(configured)])];
    return { options, location: options.includes(facetValue(selected.location)) ? facetValue(selected.location) : '', label: 'All Locations' };
  }
  const matching = rows.filter(row => matchesFacets(row, constraints));
  const options = valuesFor(matching, 'location').filter(configured);
  return { options, location: options.length === 1 ? options[0] : options.includes(facetValue(selected.location)) ? facetValue(selected.location) : '', label: options.length ? 'All Matching Locations' : 'No Matching Locations' };
}

export function inventoryFacetRow(record: Record<string, unknown>, extras: FacetSelection = {}): FacetRow {
  const text = (value: unknown) => typeof value === 'string' && value ? [value] : [];
  const balances = record.locationBalances;
  const absentStock = (typeof record.availableKg === 'number' && record.availableKg <= 0)
    || (typeof record.quantity === 'number' && record.quantity <= 0)
    || record.releaseStatus === 'Released' || record.fulfillmentStatus === 'Shipped'
    || ['Fully Consumed', 'Pending Receipt'].includes(String(record.inventoryStatus))
    || ['Shipped', 'Rejected', 'Awaiting Storage'].includes(String(record.currentInventoryBucket));
  const locations = absentStock ? [] : balances && typeof balances === 'object'
    ? Object.entries(balances).filter(([, quantity]) => typeof quantity === 'number' && quantity > 0).map(([location]) => location)
    : text(record.currentLocation || record.storageLocation || record.receivingLocation || record.location);
  return {
    product: text(record.productType || record.product), grade: text(record.materialGrade || record.grade),
    color: text(typeof record.color === 'string' ? record.color.replace(/\s+\([^)]*\)$/, '') : ''),
    size: text(record.size || record.diameter), sdr: text(record.sdr), length: text(record.length || record.straightLength || record.coilLength),
    location: locations, status: text(record.inventoryStatus || record.status),
    ...Object.fromEntries(Object.entries(extras).map(([key, value]) => [key, text(value)])),
  };
}
