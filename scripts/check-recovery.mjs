import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { RECOVERY_BASELINE, reviewedRecoveryDeltas, recoveryBaseline, restoreRecoveryFile } from './recovery-baseline.mjs';

let checks = 0;
const check = (label, fn) => { fn(); checks++; console.log('PASS ' + label); };
const raw = file => fs.readFileSync(file, 'utf8').replace(/\r/g, '');
for (const file of execFileSync('git', ['ls-tree', '-r', '--name-only', RECOVERY_BASELINE, 'src'], { encoding: 'utf8' }).trim().split('\n')) {
  if (!/\.(tsx?|css)$/.test(file)) continue;
  check('Source unchanged or exact recovery delta: ' + file, () => {
    assert.equal(restoreRecoveryFile(file, raw(file)), recoveryBaseline(file));
    if (reviewedRecoveryDeltas[file]) assert.throws(() => restoreRecoveryFile(file, raw(file) + '\n// unexpected'));
  });
}
function bindings(text) {
  const ast = ts.createSourceFile('store.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), callbacks = [], seeds = [];
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useCallback') callbacks.push(node.getText(ast));
    if (ts.isVariableDeclaration(node) && /^INITIAL_/.test(node.name.getText(ast))) seeds.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }; visit(ast);return { callbacks, seeds };
}
check('All business callbacks and transactional seed records are byte-identical', () => assert.deepEqual(bindings(raw('src/store.tsx')), bindings(recoveryBaseline('src/store.tsx'))));
check('No master/specification/PEP remapping or barcode/quantity/RBAC engine changes', () => {
  for (const file of ['src/productMaster.ts', 'src/finishedPipeRelations.ts', 'src/finishedGoodsInventory.ts', 'src/finishedPipeBarcodes.ts', 'src/reprintWorkflow.ts', 'src/pages/management/Settings.tsx', 'src/components/Sidebar.tsx', 'src/components/LocationSelect.tsx']) assert.equal(raw(file), recoveryBaseline(file), file);
});
check('No startup reset, forced attendance completion, mandatory bag reinsertion or destructive fallback remains', () => {
  const source = raw('src/store.tsx');
  assert.doesNotMatch(source, /localStorage\.clear|const resetKey|legacyDemoSession|physicalIds\.has|return initial;/);
  assert.match(source, /No reset was performed/);
});

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const oldWindow = globalThis.window, oldSession = globalThis.sessionStorage;
try {
  const master = await server.ssrLoadModule('/src/productMaster.ts');
  const product = await server.ssrLoadModule('/src/productFilters.ts');
  const locations = await server.ssrLoadModule('/src/locationMaster.ts');
  const facets = await server.ssrLoadModule('/src/inventoryFacets.ts');
  const store = await server.ssrLoadModule('/src/store.tsx');
  check('Five products, exactly two grades, all 18 standard sizes, active 110mm and no new 100mm', () => {
    assert.deepEqual(master.HPAI_PRODUCT_MASTER.products, ['HDPE Pipe', 'CTS HDPE Pipe', 'Commercial HDPE Pipe (CGPE)', 'Spiral Pipe', 'Polytube']);
    assert.deepEqual(master.MATERIAL_GRADES, ['PE80', 'PE100']);
    assert.deepEqual(master.HPAI_PRODUCT_MASTER.standardDiameters, [13,20,25,32,40,50,63,75,90,110,160,225,280,315,355,400,450,500].map(size => size + 'mm'));
  });
  check('CTS/Spiral and configured Polytube sizes use master compatibility, not stock', () => {
    assert.deepEqual(product.productFilterSizes('CTS HDPE Pipe'), ['1/2"', '3/4"', '1"']);
    assert.deepEqual(product.productFilterSizes('Spiral Pipe'), ['12"', '16"']);
    assert.deepEqual(product.productFilterSizes('Polytube', [{ productType: 'Polytube', active: true, size: 'fixture-configured-size' }]), ['fixture-configured-size']);
  });
  check('All nine SDRs, all five colors and all shared lengths remain available with zero inventory', () => {
    assert.deepEqual(master.HPAI_PRODUCT_MASTER.sdrRatings, ['SDR9','SDR11','SDR13.5','SDR13.6','SDR17','SDR21','SDR24','SDR26','SDR33']);
    assert.equal(master.HPAI_PRODUCT_MASTER.pipeColors.length, 5);
    assert.equal(master.HPAI_PRODUCT_MASTER.straightLengths.length, 6); assert.equal(master.HPAI_PRODUCT_MASTER.coilLengths.length, 11);
  });
  const custom = { id: 'loc-a', name: 'User Rack', code: 'USER', locationType: 'Raw Material Area', plant: 'Branch Plant', status: 'Active' };
  check('Location master adds missing A–I once; existing status/name/IDs and custom locations win', () => {
    const restored = locations.normalizeLocationMaster([custom, { ...locations.SAMPLE_LOCATIONS[0], status: 'Inactive', description: 'User edited' }]);
    assert.deepEqual(restored[0], custom); assert.equal(restored[1].status, 'Inactive');
    assert.deepEqual(locations.normalizeLocationMaster(restored), restored);
    for (const code of locations.LOCATION_CODES) assert.ok(restored.some(location => location.code === code));
    assert.ok(locations.filterLocationCodes(restored).includes('USER'));
  });
  const fixture = (location, extra = {}) => facets.inventoryFacetRow({ product: 'HDPE Pipe', grade: 'PE100', color: 'Black (BK)', diameter: '20mm', sdr: 'SDR11', currentLocation: location, ...extra });
  const rows = [fixture('A'), fixture('C'), fixture('F'), fixture('H', { diameter: '25mm', sdr: 'SDR17', grade: 'PE80' })];
  const physical = locations.LOCATION_CODES;
  check('Multiple matching locations never guess or rewrite any selected specification', () => {
    const selected = { product: 'HDPE Pipe', grade: 'PE100', size: '20mm', sdr: 'SDR11', color: 'Black (BK)', purpose: 'Temporary Storage', status: 'Reserved', location: 'H' };
    const snapshot = structuredClone(selected);
    assert.deepEqual(facets.resolveInventoryLocations(rows, selected, physical), { options: ['A','C','F'], location: '', label: 'All Matching Locations' });
    assert.deepEqual(selected, snapshot);
  });
  check('Unique matching physical location auto-selects; stale location alone resets', () => {
    assert.equal(facets.resolveInventoryLocations(rows, { sdr: 'SDR17', location: 'C' }, physical).location, 'H');
    assert.equal(facets.resolveInventoryLocations(rows, { sdr: 'SDR11', location: 'C' }, physical).location, 'C');
  });
  check('Zero-stock selections stay valid; no constraints gives All Locations including zero-stock master locations', () => {
    const selected = { size: '500mm', grade: 'PE80', sdr: 'SDR33', location: 'C' }, snapshot = structuredClone(selected);
    assert.deepEqual(facets.resolveInventoryLocations(rows, selected, physical), { options: [], location: '', label: 'No Matching Locations' });
    assert.deepEqual(selected, snapshot);
    assert.deepEqual(facets.resolveInventoryLocations([], { purpose: 'Inventory Storage', status: 'Available' }, physical), { options: [...physical], location: '', label: 'All Locations' });
  });
  check('Caller-scoped inventory never exposes hidden stock; stage names never become physical choices', () => {
    assert.deepEqual(facets.resolveInventoryLocations([rows[1], fixture('Production Area')], { sdr: 'SDR11' }, physical).options, ['C']);
    assert.equal(facets.resolveInventoryLocations([], { sdr: 'SDR17' }, physical).location, '');
  });
  check('Only positive balances/current stock contribute matching physical locations', () => {
    assert.deepEqual(facets.inventoryFacetRow({ locationBalances: { A: 0, C: 10, F: 3 }, currentLocation: 'A' }).location, ['C', 'F']);
    for (const extra of [{ availableKg: 0 }, { inventoryStatus: 'Fully Consumed' }, { inventoryStatus: 'Pending Receipt' }, { releaseStatus: 'Released' }, { currentInventoryBucket: 'Rejected' }]) assert.deepEqual(fixture('C', extra).location, []);
  });
  check('Configured physical sublocations, custom names and historical Product aliases remain filterable', () => {
    const allowed = locations.filterLocationCodes([custom]);
    assert.ok(allowed.includes('USER'));assert.ok(allowed.includes('User Rack'));
    assert.equal(facets.resolveInventoryLocations([fixture('User Rack / Bay 2')], { sdr: 'SDR11' }, allowed).location, 'User Rack / Bay 2');
    assert.equal(facets.resolveInventoryLocations([fixture('C', { product: 'Commercial HDPE Pipe' })], { product: 'Commercial HDPE Pipe (CGPE)' }, physical).location, 'C');
  });

  const memory = new Map(), writes = [];
  globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { writes.push(key); memory.set(key, value); } }, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, location: { hostname: 'test.invalid' } };
  globalThis.sessionStorage = window.sessionStorage;
  let captured;
  function Capture() { captured = store.useApp(); return null; }
  const render = () => renderToStaticMarkup(React.createElement(store.AppProvider, null, React.createElement(Capture)));
  render(); const baseline = JSON.parse(JSON.stringify(captured)), key = 'hpai:shared-app-state-v1';
  const load = state => { memory.set(key, JSON.stringify(state)); render(); return JSON.parse(JSON.stringify(captured)); };
  check('Fresh demo initialization remains six pipes, with unique IDs and current unique barcodes', () => {
    assert.equal(baseline.finishedGoods.length, 6); assert.equal(new Set(baseline.finishedGoods.map(pipe => pipe.id)).size, 6); assert.equal(new Set(baseline.finishedGoods.map(pipe => pipe.barcode)).size, 6);
  });
  const modified = structuredClone(baseline);
  modified.pellets = modified.pellets.slice(1);
  Object.assign(modified.pellets[0], { availableKg: 3.75, currentLocation: 'D', grade: 'Historical unconfigured' });
  Object.assign(modified.colorants[0], { availableKg: 1.25, currentLocation: 'E', locationBalances: { E: 1.25 } });
  modified.attendance[0] = { ...modified.attendance[0], status: 'Active', clockOut: '' };
  modified.orders[0].quantity = 117;
  const restored = load(modified);
  check('Modified material quantities/locations/unknown grade, active attendance and order values survive startup', () => {
    for (const collection of ['pellets','colorants','attendance','orders','manufacturingOrders','productionOrders','rrRecords','transactions','auditLogs','turnovers','rejectedMaterials','recyclingBatches']) assert.deepEqual(restored[collection], modified[collection], collection);
    assert.deepEqual(restored.finishedGoods, modified.finishedGoods);
  });
  check('Repeated hydration/reload does not inflate inventory, duplicate records or regenerate active barcodes', () => {
    const twice = load(restored);
    for (const collection of ['pellets','colorants','finishedGoods','orders','manufacturingOrders','productionOrders','rrRecords','transactions','attendance','turnovers']) assert.deepEqual(twice[collection], restored[collection], collection);
  });
  check('Existing empty/missing collections do not reseed bags, orders or replenishment pipes', () => {
    const empty = { ...baseline, pellets: [], finishedGoods: [], productionOrders: [], orders: [] };delete empty.colorants;
    const state = load(empty);
    for (const collection of ['pellets','finishedGoods','productionOrders','orders','colorants']) assert.deepEqual(state[collection], []);
  });
  check('Malformed/schema-invalid saved state fails closed without replacing the raw storage value', () => {
    for (const invalid of ['{broken', 'null', '[]', '{"pellets":null}']) {
      memory.set(key, invalid); assert.throws(render, /No reset was performed/);assert.equal(memory.get(key), invalid);
    }
    assert.deepEqual(writes, []);
  });
  console.log('Completed ' + checks + ' recovery/master/location/startup-preservation checks. Browser effects and responsive six-role UI are checked separately.');
} finally {
  if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  if (oldSession === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldSession;
  await server.close();
}
