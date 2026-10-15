/** Read-only inventory facets. Callers supply only their already-visible records. */
export type FacetRow = Readonly<Record<string, readonly string[]>>;
export type FacetSelection = Record<string, string>;
export const facetValue = (value: unknown) => typeof value === 'string' && !/^all(?:\s|$)/i.test(value) ? value : '';
const valuesFor = (rows: readonly FacetRow[], key: string) => [...new Set(rows.flatMap(row => row[key] || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
export const matchesFacets = (row: FacetRow, selected: FacetSelection) => Object.entries(selected).every(([key, value]) => !facetValue(value) || row[key]?.includes(value));

/** Newest explicit choice wins; incompatible older choices reset. Auto choices are not constraints. */
export function resolveInventoryFacets(rows: readonly FacetRow[], keys: readonly string[], intent: FacetSelection, priority = Object.keys(intent), cleared: readonly string[] = []) {
  const retained: FacetSelection = {};
  for (const key of [...new Set([...priority, ...keys])]) {
    const value = facetValue(intent[key]);
    if (keys.includes(key) && value && rows.some(row => matchesFacets(row, { ...retained, [key]: value }))) retained[key] = value;
  }
  const matching = rows.filter(row => matchesFacets(row, retained));
  const selected: FacetSelection = {}, options: Record<string, string[]> = {};
  for (const key of keys) {
    const others = { ...retained }; delete others[key];
    options[key] = valuesFor(rows.filter(row => matchesFacets(row, others)), key);
    const remaining = valuesFor(matching, key);
    // Missing metadata must not silently remove otherwise matching historical stock.
    selected[key] = retained[key] || (!cleared.includes(key) && remaining.length === 1 && matching.every(row => row[key]?.length) ? remaining[0] : '');
  }
  return { selected, options, retained };
}

export function inventoryFacetRow(record: Record<string, unknown>, extras: FacetSelection = {}): FacetRow {
  const text = (value: unknown) => typeof value === 'string' && value ? [value] : [];
  const balances = record.locationBalances;
  const locations = balances && typeof balances === 'object'
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
