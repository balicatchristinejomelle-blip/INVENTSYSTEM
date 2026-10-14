import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let count = 0;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };
const originalWindow = globalThis.window;
const storage = new Map();
try {
  const relationships = await server.ssrLoadModule('/src/finishedPipeRelations.ts');
  const master = await server.ssrLoadModule('/src/productMaster.ts');
  const inventory = await server.ssrLoadModule('/src/finishedGoodsInventory.ts');
  const { AppProvider, useApp, USERS, addReplenishmentSample } = await server.ssrLoadModule('/src/store.tsx');
  const { matchesRecord } = await server.ssrLoadModule('/src/components/RecordSearch.tsx');
  const { pageRecords } = await server.ssrLoadModule('/src/components/Pagination.tsx');
  const { buildUniversalIndex } = await server.ssrLoadModule('/src/components/UniversalSearch.tsx');
  const { withPrintSearch } = await server.ssrLoadModule('/src/printableRecords.ts');
  const Details = (await server.ssrLoadModule('/src/components/FinishedPipeDetails.tsx')).default;
  let captured;
  function Capture() { captured = useApp(); return null; }
  const render = child => renderToStaticMarkup(React.createElement(AppProvider, null, React.createElement(Capture), child));
  render();
  const data = JSON.parse(JSON.stringify(captured));
  const pipe = data.finishedGoods.find(item => item.source === 'Manufacturing Order');
  const stock = data.finishedGoods.find(item => item.source === 'Stock Replenishment');
  assert.ok(pipe); assert.ok(stock);
  const mo = data.manufacturingOrders.find(item => item.moNo === pipe.moRef);
  const order = data.orders.find(item => item.orderNo === mo.orderRef);
  const spec = { id: 'test-configured-spec', itemCode: 'PEP-1031', seasonal: true, productType: pipe.product, materialGrade: pipe.grade, size: pipe.diameter, sizeUnit: 'mm', sdr: pipe.sdr, productForm: pipe.productForm, straightLength: pipe.length, color: pipe.color, stripe: pipe.stripe, pipeConstruction: pipe.construction, unitWeightKg: 3.625, active: true };
  const context = { ...data, specifications: [spec] };
  const result = relationships.resolveFinishedPipe(pipe, context);
  check('Existing buyer pipe resolves PO-2026-0012 → MO-2026-0045 → SO-2026-0058', () => {
    assert.equal(result.po.poNo, 'PO-2026-0012'); assert.equal(result.mo.moNo, 'MO-2026-0045'); assert.equal(result.order.orderNo, 'SO-2026-0058');
  });
  check('Buyer comes from the actual Customer Order', () => assert.equal(result.buyer, 'Metro Water Corp.'));
  check('MO reference is the origin group, not an extra group per PO', () => assert.equal(result.originGroup, result.mo.moNo));
  check('MO source has Temporary Storage purpose, production location and zero general availability', () => {
    assert.equal(result.source, 'Manufacturing Order'); assert.equal(result.purpose, 'Temporary Storage'); assert.equal(result.inventoryStatus, 'Awaiting Storage'); assert.equal(result.availableQty, 0); assert.equal(result.pipe.currentLocation, 'Production Area / Awaiting Storage');
  });
  check('Configured exact specification weight and PEP code resolve without universal defaults', () => { assert.equal(result.unitWeightKg, 3.625); assert.equal(result.unitWeightSource, 'Product Specification'); assert.equal(result.itemCode, 'PEP-1031'); });
  check('Product Barcode is canonical and distinct from permanent pipe identity', () => {
    assert.equal(result.productBarcode, `PEP-1031|${pipe.product}|${pipe.diameter}x${pipe.length}|${pipe.sdr}`); assert.notEqual(result.productBarcode, pipe.fgId); assert.equal(result.pipe.barcode, pipe.barcode);
  });
  check('Optional PEP and seasonal metadata survive existing specification normalization', () => { const normalized = master.normalizeProductSpecification(spec); assert.equal(normalized.itemCode, spec.itemCode); assert.equal(normalized.seasonal, true); });
  check('A mislabeled physical pipe ID is never displayed as Product Barcode', () => assert.equal(relationships.resolveFinishedPipe({ ...pipe, productBarcode: pipe.fgId }, data).productBarcode, undefined));
  check('Existing valid canonical barcode metadata is preserved without generating another item code', () => { const resolved = relationships.resolveFinishedPipe({ ...pipe, productBarcode: result.productBarcode }, data); assert.equal(resolved.productBarcode, result.productBarcode); assert.equal(resolved.itemCode, 'PEP-1031'); });
  check('Unconfigured weight/code remain unconfigured, with no fabricated values', () => { const unresolved = relationships.resolveFinishedPipe(pipe, data); assert.equal(unresolved.unitWeightKg, undefined); assert.equal(unresolved.unitWeightSource, 'Not Configured'); assert.equal(unresolved.itemCode, undefined); assert.equal(unresolved.productBarcode, undefined); });
  for (const weight of [0, -4, NaN, Infinity]) check(`Invalid configured weight ${weight} is not used`, () => assert.equal(relationships.resolveFinishedPipe(pipe, { ...data, specifications: [{ ...spec, unitWeightKg: weight }] }).unitWeightKg, undefined));
  for (const [key, value] of [['stripe', 'Green Stripe'], ['color', 'Blue (BE)'], ['sdr', 'SDR11'], ['straightLength', '10m'], ['pipeConstruction', 'Spiral Tube']]) check(`Weight cannot leak from a different ${key}`, () => assert.equal(relationships.resolveFinishedPipe(pipe, { ...data, specifications: [{ ...spec, [key]: value }] }).unitWeightKg, undefined));
  check('Ambiguous duplicate specifications do not silently choose an arbitrary recipe', () => { const resolved = relationships.resolveFinishedPipe(pipe, { ...data, specifications: [spec, { ...spec, id: 'other', unitWeightKg: 4 }] }); assert.equal(resolved.unitWeightKg, undefined); assert.equal(resolved.unitWeightSource, 'Configuration Conflict'); });
  check('Explicit matching specification ID disambiguates without changing identity', () => assert.equal(relationships.resolveFinishedPipe({ ...pipe, productSpecificationId: spec.id }, { ...data, specifications: [spec, { ...spec, id: 'other' }] }).unitWeightKg, spec.unitWeightKg));
  check('An intentional historical production snapshot is retained and labeled', () => { const historical = relationships.resolveFinishedPipe({ ...pipe, unitWeightKg: 2.5 }, context); assert.equal(historical.unitWeightKg, 2.5); assert.equal(historical.unitWeightSource, 'Production snapshot'); });
  check('No PO/MO/order is fabricated from product text; explicit historical source survives', () => { const missing = relationships.resolveFinishedPipe({ ...pipe, poRef: 'missing', productionOrderId: undefined, moRef: undefined }, data); assert.equal(missing.po, undefined); assert.equal(missing.mo, undefined); assert.equal(missing.order, undefined); assert.equal(missing.source, pipe.source); assert.ok(missing.issues.includes('Production Order Not Found')); });
  check('Conflicting PO ID and reference are not silently combined', () => assert.equal(relationships.resolveFinishedPipe({ ...pipe, productionOrderId: stock.productionOrderId }, data).po, undefined));
  check('Missing MO/SO relationships are reported, never fabricated', () => {
    const noMo = relationships.resolveFinishedPipe(pipe, { ...data, manufacturingOrders: [] }); assert.equal(noMo.mo, undefined); assert.equal(noMo.buyer, undefined); assert.ok(noMo.issues.includes('Manufacturing Order Not Found'));
    const noSo = relationships.resolveFinishedPipe(pipe, { ...data, orders: [] }); assert.equal(noSo.order, undefined); assert.equal(noSo.buyer, undefined); assert.ok(noSo.issues.includes('Customer Order Not Found'));
  });
  check('Multiple POs attached to one MO retain one MO origin group', () => {
    const po2 = { ...result.po, id: 'test-second-po', poNo: 'PO-TEST-2' };
    const second = relationships.resolveFinishedPipe({ ...pipe, productionOrderId: po2.id, poRef: po2.poNo }, { ...data, productionOrders: [...data.productionOrders, po2] }); assert.equal(second.originGroup, result.originGroup);
  });
  const replenishment = relationships.resolveFinishedPipe(stock, context);
  check('Live replenishment sample has a real PO, batch and stable group', () => { assert.equal(replenishment.po.source, 'Stock Replenishment'); assert.match(replenishment.originGroup, /^REPLENISH-/); assert.ok(stock.batch); assert.ok(data.barcodeRegistry.some(record => record.itemId === stock.id && record.barcode === stock.barcode)); });
  check('Stock sample has Inventory Storage purpose and no fake MO, SO or buyer', () => { assert.equal(replenishment.purpose, 'Inventory Storage'); assert.equal(replenishment.mo, undefined); assert.equal(replenishment.order, undefined); assert.equal(replenishment.buyer, undefined); assert.equal(stock.manufacturingOrderId, undefined); assert.equal(stock.customerOrderId, undefined); });
  check('Stored replenishment stock is available; awaiting stock is not', () => { assert.equal(replenishment.inventoryStatus, 'Stored'); assert.equal(replenishment.availableQty, 1); const waiting = relationships.resolveFinishedPipe({ ...stock, storageStatus: 'Not Stored', locationStatus: 'Awaiting Storage', currentLocation: 'Production Area / Awaiting Storage' }, data); assert.equal(waiting.availableQty, 0); assert.equal(waiting.purpose, 'Inventory Storage'); });
  check('Stock can show a real later customer allocation without fabricating a MO', () => { const allocated = relationships.resolveFinishedPipe({ ...stock, reservedForOrderId: order.id, inventoryPurpose: 'Customer Order' }, data); assert.equal(allocated.order.id, order.id); assert.equal(allocated.mo, undefined); assert.equal(allocated.originGroup, replenishment.originGroup); });
  check('Explicit stock source is authoritative even if an old MO text field is stale', () => { const stockPO = { ...replenishment.po, moRef: mo.moNo }; const resolved = relationships.resolveFinishedPipe(stock, { ...data, productionOrders: data.productionOrders.map(po => po.id === stockPO.id ? stockPO : po) }); assert.equal(resolved.mo, undefined); assert.equal(resolved.buyer, undefined); });
  const legacy = { ...pipe, source: undefined, productionOrderId: undefined, manufacturingOrderId: undefined, customerOrderId: undefined, moRef: undefined, orderReference: undefined, buyer: undefined, originGroup: undefined, inventoryPurpose: 'Unassigned', status: 'Quality Pending' };
  const hydrated = relationships.hydrateFinishedPipe(legacy, data);
  check('Legacy missing relationships hydrate through actual shared references', () => { assert.equal(hydrated.moRef, mo.moNo); assert.equal(hydrated.orderReference, order.orderNo); assert.equal(hydrated.buyer, order.customerName); assert.equal(hydrated.customerOrderId, order.id); assert.equal(hydrated.inventoryPurpose, 'Customer Order'); });
  check('Quality Pass no longer has stale Quality Pending status', () => { assert.equal(hydrated.status, 'Awaiting Storage'); assert.equal(relationships.resolveFinishedPipe(hydrated, data).inventoryStatus, 'Awaiting Storage'); });
  check('Hydration is idempotent and does not mutate the original record', () => { assert.equal(relationships.hydrateFinishedPipe(hydrated, data), hydrated); assert.equal(legacy.buyer, undefined); });
  for (const key of ['id', 'fgId', 'barcode', 'batch', 'quantity', 'reservedQty', 'currentLocation', 'productionDate', 'shift', 'releaseStatus', 'printStatus']) check(`Hydration preserves ${key}`, () => assert.equal(hydrated[key], legacy[key]));
  check('Physical stored evidence resolves stale quality-pending location without inventing movement', () => { const repaired = relationships.hydrateFinishedPipe({ ...stock, locationStatus: 'Quality Pending', status: 'Quality Pending' }, data); assert.equal(repaired.locationStatus, 'Stored'); assert.equal(repaired.status, 'Available'); assert.equal(repaired.currentLocation, stock.currentLocation); });
  check('Stored buyer stock never becomes Available or Ready merely due to quality pass', () => { const repaired = relationships.hydrateFinishedPipe({ ...pipe, storageStatus: 'Stored', locationStatus: 'Stored', currentLocation: 'TMP-BAY-01', storageLocation: 'TMP-BAY-01', status: 'Available', availableQty: 1 }, data); assert.equal(repaired.status, 'Stored'); assert.equal(repaired.availableQty, 0); });
  check('Pending quality remains Quality Pending, not stored availability', () => { const pending = relationships.resolveFinishedPipe({ ...pipe, qualityStatus: 'Pending', status: 'Quality Pending' }, data); assert.equal(pending.inventoryStatus, 'Quality Pending'); assert.equal(pending.availableQty, 0); });
  check('Rejected and released items never become good available inventory', () => { for (const changed of [{ qualityStatus: 'Reject' }, { releaseStatus: 'Released' }]) assert.equal(relationships.resolveFinishedPipe({ ...stock, ...changed }, data).availableQty, 0); });
  check('Hydration does not classify Pending or Rejected quality as awaiting good storage', () => {
    for (const [qualityStatus, expected] of [['Pending', 'Quality Pending'], ['Reject', 'Quality Reject']]) { const repaired = relationships.hydrateFinishedPipe({ ...pipe, qualityStatus, status: 'Available', availableQty: 1 }, data); assert.equal(repaired.status, expected); assert.equal(repaired.availableQty, 0); }
  });
  check('Sample addition is idempotent, retains the five old identities and only adds one pipe', () => { assert.equal(data.finishedGoods.length, 6); assert.equal(data.finishedGoods.filter(item => item.id !== stock.id).length, 5); assert.equal(addReplenishmentSample(data), data); assert.equal(new Set(data.finishedGoods.map(item => item.barcode)).size, data.finishedGoods.length); });
  check('Sample batch does not duplicate existing good or rejected batch references', () => assert.ok(!data.rejectedMaterials.some(item => item.batch === stock.batch)));
  check('Existing sample PO identity is never duplicated if its pipe is absent', () => { const without = { ...data, finishedGoods: data.finishedGoods.filter(item => item.id !== stock.id) }; assert.equal(addReplenishmentSample(without), without); });
  check('Existing operational collections and reprint state are untouched by relationship hydration', () => { const next = relationships.hydratePipeRelationships({ ...data, finishedGoods: [legacy, stock] }); for (const key of ['orders', 'manufacturingOrders', 'pellets', 'transfers', 'rrRecords', 'reprintRequests', 'printMetadata', 'transactions', 'attendance', 'turnovers']) assert.equal(next[key], data[key]); });
  for (const query of [pipe.fgId, pipe.barcode, 'PEP-1031', pipe.product, pipe.diameter, pipe.sdr, pipe.batch, result.po.poNo, mo.moNo, order.orderNo, order.customerName, result.originGroup, pipe.currentLocation]) check(`Finished-pipe search resolves ${query}`, () => assert.ok(matchesRecord(relationships.pipeSearchRecord(pipe, context), query.toLowerCase())));
  check('Search precedes ten-row pagination', () => { const list = Array.from({ length: 23 }, (_, index) => ({ ...relationships.pipeSearchRecord(pipe, context), id: String(index) })).filter(row => matchesRecord(row, order.customerName)); assert.deepEqual([1, 2, 3].map(page => pageRecords(list, page).length), [10, 10, 3]); });
  check('Generic read-only search enrichment includes connected buyer without changing print counts', () => { const enriched = withPrintSearch(data, pipe); assert.equal(enriched.buyer, order.customerName); assert.equal(enriched.printCount, 0); });
  for (const user of USERS) check(`${user.role}: universal search keeps its existing finished-goods authorization`, () => {
    const results = buildUniversalIndex({ ...captured, currentUser: user }, { specifications: [spec] }); const row = results.find(item => item.group === 'FINISHED PIPES' && item.id === pipe.id); assert.equal(!!row, user.role !== 'accounting'); if (row) { assert.equal(row.record.buyer, order.customerName); assert.equal(row.record.productBarcode, result.productBarcode); }
  });
  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  const user = USERS.find(item => item.role === 'plantmanager');
  storage.set('hpai:shared-app-state-v1', JSON.stringify({ ...data, currentUser: user })); storage.set('hpai:product-specifications-v1', JSON.stringify([spec]));
  let html = render(React.createElement(Details, { pipe }));
  check('Shared card renders connected buyer/SO/MO and correct storage purpose', () => { for (const text of [order.customerName, order.orderNo, mo.moNo, 'Temporary Storage', 'Awaiting Storage', '3.625 kg', 'PEP-1031', 'SEASONAL', 'NOT PRINTED']) assert.ok(html.includes(text), text); });
  storage.set('hpai:product-specifications-v1', JSON.stringify([{ ...spec, seasonal: false }]));
  html = render(React.createElement(Details, { pipe }));
  check('False seasonal renders no invented regular/non-seasonal classification', () => { assert.ok(!html.includes('SEASONAL')); assert.ok(!html.includes('NON-SEASONAL')); assert.ok(!html.includes('REGULAR')); });
  html = render(React.createElement(Details, { pipe: stock }));
  check('Stock card renders replenishment purpose/group without buyer or MO', () => { assert.ok(html.includes('Inventory Storage')); assert.ok(html.includes(replenishment.originGroup)); assert.ok(!html.includes(order.customerName)); assert.ok(!html.includes(mo.moNo)); });
  storage.delete('hpai:product-specifications-v1'); html = render(React.createElement(Details, { pipe }));
  check('Unconfigured fields are explicit, not meaningless dashes or fake weights', () => assert.ok(html.includes('Not Configured')));
  const serialized = { ...data, finishedGoods: [legacy, stock] }; storage.set('hpai:shared-app-state-v1', JSON.stringify(serialized)); render();
  check('Refresh safely hydrates existing data without resetting print/operational state', () => { assert.equal(captured.finishedGoods.find(item => item.id === pipe.id).buyer, order.customerName); assert.equal(captured.finishedGoods.length, 2); assert.deepEqual(captured.printMetadata, data.printMetadata); assert.deepEqual(captured.reprintRequests, data.reprintRequests); });

  // Run the existing callback with a synchronous state harness; no browser storage or real movements are touched.
  const sourceText = fs.readFileSync('src/store.tsx', 'utf8');
  const ast = ts.createSourceFile('store.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callbackSource;
  const walk = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'updateFinishedGoodStorage') callbackSource = node.initializer.getText(ast); ts.forEachChild(node, walk); }; walk(ast);
  const callbackCode = ts.transpileModule(`const action = ${callbackSource};`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
  const simulateStorage = (initial, args) => {
    let current = structuredClone(initial);
    const action = new Function('useCallback', 'setState', 'resolveFinishedPipe', 'validStorageLocation', 'finishedGoodsSummary', `${callbackCode}; return action;`)(fn => fn, updater => { current = updater(current); }, relationships.resolveFinishedPipe, inventory.validStorageLocation, inventory.finishedGoodsSummary);
    const success = action(...args); return { success, state: current };
  };
  const plantmanager = USERS.find(item => item.role === 'plantmanager');
  const stateForMovement = { ...data, currentUser: plantmanager, finishedGoods: [hydrated] };
  check('Actual existing storage action rejects MO pipe → general inventory', () => { const outcome = simulateStorage(stateForMovement, [pipe.id, 'Section A', 'General Inventory']); assert.equal(outcome.success, false); assert.deepEqual(outcome.state, stateForMovement); });
  const otherOrder = data.orders.find(item => item.id !== order.id);
  check('Actual existing storage action rejects MO pipe → another buyer', () => assert.equal(simulateStorage(stateForMovement, [pipe.id, 'Customer Order Staging', 'Customer Order', otherOrder.id]).success, false));
  check('Actual existing storage action accepts originating buyer and retains general availability zero', () => { const outcome = simulateStorage(stateForMovement, [pipe.id, 'Customer Order Staging', 'Customer Order', order.id]); assert.equal(outcome.success, true); assert.equal(outcome.state.finishedGoods[0].availableQty, 0); assert.equal(outcome.state.finishedGoods[0].currentLocation, 'Customer Order Staging'); assert.equal(outcome.state.finishedGoods[0].reservedForOrderId, order.id); });
  check('Actual existing stock storage action makes only confirmed general stock available', () => { const waiting = { ...stock, storageStatus: 'Not Stored', locationStatus: 'Awaiting Storage', currentLocation: 'Production Area / Awaiting Storage', availableQty: 0 }; const outcome = simulateStorage({ ...data, currentUser: plantmanager, finishedGoods: [waiting] }, [stock.id, 'Section B', 'General Inventory']); assert.equal(outcome.success, true); assert.equal(outcome.state.finishedGoods[0].availableQty, 1); assert.equal(outcome.state.finishedGoods[0].inventoryPurpose, 'General Inventory'); });
  const previous = '0a783f9995b51ed7145212e6c7cfb307f96342cf';
  for (const file of ['src/reprintWorkflow.ts', 'src/components/PrintAction.tsx', 'src/components/ReprintApprovals.tsx', 'src/components/DocumentPrintButton.tsx', 'src/components/NotificationPanel.tsx', 'src/components/BarcodeLabel.tsx']) check(`Prior reprint workflow unchanged: ${file}`, () => assert.equal(fs.readFileSync(file, 'utf8').replace(/\r/g, ''), execFileSync('git', ['show', `${previous}:${file}`], { encoding: 'utf8' }).replace(/\r/g, '')));
  console.log(`Completed ${count} finished-pipe relationship, storage-source, identity, sample, hydration and regression checks.`);
  console.log(`Buyer sample: ${pipe.fgId} → ${result.po.poNo} → ${mo.moNo} → ${order.orderNo} (${order.customerName})`);
  console.log(`Stock sample: ${stock.fgId} → ${replenishment.po.poNo} → ${replenishment.originGroup} → ${stock.batch}`);
} finally {
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  await server.close();
}
