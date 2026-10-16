import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restoreProcessFlowFile, reviewedProcessFlowDeltas, reviewedProcessFlowAdditions } from './process-flow-baseline.mjs';
import { restoreProductionOutputFile } from './production-output-baseline.mjs';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
for (const file of Object.keys(reviewedProcessFlowDeltas)) check('Exact reviewed process-flow delta, rejects unrelated edits: ' + file, () => {
  const source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  assert.equal(restoreProductionOutputFile(file, source), execFileSync('git', ['show', 'b40c023:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  assert.throws(() => restoreProcessFlowFile(file, source + '\n// unexpected'), /Unreviewed process-flow delta/);
});
for (const [file, hash] of Object.entries(reviewedProcessFlowAdditions)) check('Exact additive read-only inventory helper: ' + file, () => assert.equal(createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r/g, '')).digest('hex'), hash));
const previousWindow = globalThis.window;
try {
  const store = await server.ssrLoadModule('/src/store.tsx');
  const inventory = await server.ssrLoadModule('/src/finishedGoodsInventory.ts');
  const locations = await server.ssrLoadModule('/src/locationMaster.ts');
  const relations = await server.ssrLoadModule('/src/finishedPipeRelations.ts');
  const barcodes = await server.ssrLoadModule('/src/finishedPipeBarcodes.ts');
  const master = await server.ssrLoadModule('/src/productMaster.ts');
  const colors = await server.ssrLoadModule('/src/pelletColors.ts');
  const categories = await server.ssrLoadModule('/src/inventoryCategories.ts');
  const production = await server.ssrLoadModule('/src/productionOutput.ts');
  const operational = await server.ssrLoadModule('/src/operationalInventory.ts');
  let captured;
  function Capture() { captured = store.useApp(); return null; }
  const render = () => renderToStaticMarkup(React.createElement(store.AppProvider, null, React.createElement(Capture)));
  render(); const baseline = JSON.parse(JSON.stringify(captured));
  const memory = new Map();
  globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }, location: { hostname: 'test.invalid' } };
  check('Shared registry retains existing stored metadata instead of regenerating createdAt', () => {
    memory.set('hpai:shared-app-state-v1',JSON.stringify(baseline));render();
    assert.deepEqual(captured.barcodeRegistry,baseline.barcodeRegistry);
  });
  const source = fs.readFileSync('src/store.tsx', 'utf8').replace(/\r/g, '');
  const ast = ts.createSourceFile('store.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), bindings = new Map();
  function walk(node) { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) bindings.set(node.name.text, node.initializer.getText(ast)); ts.forEachChild(node, walk); } walk(ast);
  const transpile = code => ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }).outputText;
  const baseDeps = { ...store, ...inventory, ...locations, ...relations, ...barcodes, ...master, ...colors, ...categories, ...production, ...operational, MASS_TOLERANCE_KG: 0.001 };
  const helperNames = ['roundKg', 'makePelletBags', 'makeFinishedPipes', 'nextAnnualSequence', 'makePermanentPelletBags', 'makePermanentFinishedPipes', 'registryEntriesForPellets', 'registryEntriesForFinishedGoods', 'transactionBelongsToSession', 'isUnfinishedProductionOrder', 'findPendingTurnover', 'findSessionProductionOrder'];
  const helpers = new Function(...Object.keys(baseDeps), transpile(helperNames.map(name => 'const ' + name + '=' + bindings.get(name) + ';').join('\n')) + ';return {' + helperNames.join(',') + '};')(...Object.values(baseDeps));
  let state = structuredClone(baseline);
  const role = name => store.USERS.find(user => user.role === name);
  const actor = name => { state = { ...state, currentUser: role(name) }; };
  function action(name, ...args) {
    const deps = { ...baseDeps, ...helpers, useCallback: fn => fn, flushSync: fn => fn(), setState: updater => { state = updater(state); } };
    return new Function(...Object.keys(deps), transpile('const action=' + bindings.get(name) + ';') + ';return action;')(...Object.values(deps))(...args);
  }
  const clone = () => structuredClone(state);
  const balances = () => operational.pelletBalances(state.pellets);
  const spec = { id: 'isolated-process-spec', itemCode: 'QA-PROCESS', productType: 'HDPE Pipe', materialGrade: 'PE100', size: '90mm', sizeUnit: 'mm', sdr: 'SDR11', color: 'Black (BK)', stripe: 'No Stripe', pipeConstruction: 'Solid Wall Pipe', productForm: 'Straight Length', straightLength: '6m', unitWeightKg: 0.5, active: true };
  const producer = role('production');
  state = { ...state, currentShift: 'Day', attendance: [{ ...baseline.attendance[0], id: 'isolated-process-shift', employeeId: producer.employeeId, status: 'Active', shift: 'Day' }], turnovers: [] };
  actor('accounting'); const initial = clone(), original = balances();
  action('createReceivingReport', { pelletType: 'Virgin', grade: 'PE100', color: 'White', numberOfBags: 1, supplier: 'Isolated QA supplier', referenceNo: 'QA-PROCESS-RR', destination: 'Branch Plant', storageLocation: 'A' });
  const bag = state.pellets.find(item => !initial.pellets.some(old => old.id === item.id));
  check('Receiving adds one actual 25kg White virgin bag at A with unique PEL-V barcode', () => {
    assert.ok(bag); assert.equal(bag.availableKg, 25); assert.equal(bag.originalKg, 25); assert.equal(bag.color, 'White'); assert.equal(bag.currentLocation, 'A'); assert.match(bag.barcode, /^PEL-V-/);
    assert.equal(balances().virgin, original.virgin + 25); assert.equal(new Set(state.pellets.map(item => item.barcode)).size, state.pellets.length);
    const transaction = state.transactions.find(item => item.barcode === bag.barcode); assert.equal(operational.operationalStockEffect(transaction, state.finishedGoods).stockIn, 25); assert.equal(transaction.reference, bag.rrRef);
  });
  actor('plantmanager'); const beforePO = state;
  const replenished = action('createStockReplenishmentPO', { specification: spec, targetQty: 550, requiredDate: '2026-10-19', productionLine: 'Line 1', priority: 'Normal', reason: 'Isolated complete-flow verification' });
  const po = state.productionOrders.find(item => item.poNo === replenished.poNo);
  check('Replenishment creates zero-output PO, no fake MO/customer, no inventory increase', () => { assert.equal(replenished.success, true); assert.equal(po.completedQty, 0); assert.equal(state.finishedGoods, beforePO.finishedGoods); assert.equal(state.manufacturingOrders, beforePO.manufacturingOrders); assert.equal(state.orders, beforePO.orders); });
  actor('production'); assert.equal(action('startProduction', po.id).success, true);
  check('Load uses same bag identity and transfers raw stock to WIP without company Stock Out', () => {
    assert.equal(action('loadPellets', bag.id, po.id), true);
    assert.equal(balances().virgin, original.virgin); assert.equal(balances().wip, original.wip + 25);
    const loaded = state.pellets.find(item => item.id === bag.id); assert.equal(loaded.barcode, bag.barcode); assert.equal(loaded.rrRef, bag.rrRef); assert.equal(loaded.availableKg, 25); assert.equal(loaded.inventoryStatus, 'Loaded'); assert.ok(!locations.LOCATION_CODES.includes(loaded.currentLocation));
    assert.deepEqual(operational.operationalStockEffect(state.transactions[0], state.finishedGoods), { stockIn: 0, stockOut: 0, internal: true });
    const after = state; assert.equal(action('loadPellets', bag.id, po.id), false); assert.equal(state, after);
  });
  const rejects = [{ weightKg: 0.5, reason: 'Surface Defect' }];
  assert.equal(action('recordOutput', po.id, 20, rejects, 'isolated-process-output-1').success, true);
  check('Real production consumes 10kg from WIP, not raw again', () => { assert.equal(balances().wip, original.wip + 15); assert.equal(balances().virgin, original.virgin); assert.equal(state.pellets.find(item => item.id === bag.id).availableKg, 15); });
  assert.equal(action('recordOutput', po.id, 30, rejects, 'isolated-process-output-2').success, true);
  check('Further 15kg consumption leaves zero WIP and preserves consumed history', () => {
    const consumed = state.pellets.find(item => item.id === bag.id); assert.equal(consumed.availableKg, 0); assert.equal(consumed.inventoryStatus, 'Fully Consumed'); assert.equal(consumed.locationStatus, 'Released'); assert.ok(!locations.LOCATION_CODES.includes(consumed.currentLocation));
    assert.equal(consumed.originalKg, 25); assert.equal(consumed.rrRef, bag.rrRef); assert.equal(consumed.barcode, bag.barcode); assert.equal(consumed.loadedForPOId, po.id); assert.ok(consumed.fullyConsumedAt); assert.equal(balances().wip, original.wip); assert.equal(balances().virgin, original.virgin);
    const noChange = state; assert.equal(action('finishWipBag', bag.id).success, true); assert.equal(state, noChange);
    const legacyBlank = { ...state, pellets: state.pellets.map(item => item.id === bag.id ? { ...item, currentLocation: '' } : item) }; state = legacyBlank;
    assert.equal(action('receivePellet', bag.id, undefined, 'A'), false); assert.equal(state, legacyBlank);
  });
  const generated = state.finishedGoods.filter(item => item.productionOrderId === po.id);
  check('Cumulative 50 output / 2 rejected makes exactly 48 good physical pipes and 500 remaining', () => {
    const current = state.productionOrders.find(item => item.id === po.id); assert.equal(current.completedQty, 50); assert.equal(current.totalGoodQty, 48); assert.equal(current.totalRejectedQty, 2); assert.equal(current.targetQty - current.completedQty, 500); assert.equal(generated.length, 48);
    assert.ok(generated.every(item => item.source === 'Stock Replenishment' && !item.manufacturingOrderId && !item.customerOrderId && item.originGroup && item.barcode && item.batch));
    const snapshot = state; assert.equal(action('recordOutput', po.id, 30, rejects, 'isolated-process-output-2').success, true); assert.equal(state, snapshot);
  });
  actor('plantmanager'); const pipe = generated[0];
  check('Storage confirmation makes replenishment Available once, with no duplicate Stock In', () => {
    const before = clone(); assert.equal(action('updateFinishedGoodStorage', pipe.id, 'A', 'General Inventory'), true); assert.equal(inventory.finishedPipeInventory(state.finishedGoods.find(item => item.id === pipe.id), state).bucket, 'Available');
    assert.equal(state.finishedGoods.length, before.finishedGoods.length); assert.deepEqual(operational.operationalStockEffect(state.transactions[0], state.finishedGoods), { stockIn: 0, stockOut: 0, internal: true });
    const saved = state; assert.equal(action('updateFinishedGoodStorage', pipe.id, 'A', 'General Inventory'), false); assert.equal(state, saved);
  });
  actor('marketing');
  const customer = state.customers[0];
  const orderResult = action('createCustomerOrder', { customerId: customer.id, product: po.product, diameter: po.diameter, length: po.length, sdr: po.sdr, grade: po.grade, color: po.color, stripe: po.stripe, construction: po.construction, productForm: po.productForm, quantity: 2, requiredDate: '2026-10-19' });
  const order = state.orders.find(item => item.orderNo === orderResult.orderNo);
  check('Customer order reserves available pipe, creates MO only for shortage, not Stock Out', () => { assert.equal(orderResult.success, true); assert.equal(orderResult.reserved, 1); assert.equal(orderResult.shortage, 1); assert.equal(inventory.finishedPipeInventory(state.finishedGoods.find(item => item.id === pipe.id), state).bucket, 'Reserved'); assert.equal(operational.operationalStockEffect(state.transactions[0], state.finishedGoods).stockOut, 0); });
  actor('plantmanager'); assert.equal(action('relocatePhysicalItem', 'Finished Pipe', pipe.id, 'I', 'QA ready for shipment'), true);
  actor('production');
  check('Ready / loading remain On Hand and have no Stock Out', () => { assert.equal(action('markFinishedGoodLoaded', pipe.id), true); assert.equal(operational.operationalStockEffect(state.transactions[0], state.finishedGoods).stockOut, 0); assert.equal(inventory.finishedPipeInventory(state.finishedGoods.find(item => item.id === pipe.id), state).onHand, 1); });
  check('Actual shipment records exactly one Stock Out and is idempotent', () => {
    assert.equal(action('releaseFinishedGood', pipe.id), true); assert.equal(operational.operationalStockEffect(state.transactions[0], state.finishedGoods).stockOut, 1); assert.equal(inventory.finishedPipeInventory(state.finishedGoods.find(item => item.id === pipe.id), state).onHand, 0);
    const saved = state; assert.equal(action('releaseFinishedGood', pipe.id), false); assert.equal(state, saved);
  });
  check('Ending/running balances derive from history, internal moves contribute zero and kg never mix with units', () => {
    const rows = operational.operationalStockCard(state.transactions, state.finishedGoods); const relevant = rows.filter(row => row.transaction.barcode === bag.barcode);
    assert.ok(relevant.filter(row => /Loaded|Consum/.test(row.transaction.transactionType)).every(row => row.internal && row.stockIn === 0 && row.stockOut === 0));
    for (const row of rows) assert.ok(Math.abs(row.balance - (row.before + row.stockIn - row.stockOut)) < 0.001);
    assert.equal(relevant.at(-1).balance - relevant[0].before, 25);
  });
  const primary = clone();
  // A separate isolated attendance fixture exercises the customer's existing MO chain.
  actor('plantmanager'); const mo = state.manufacturingOrders.find(item => item.moNo === order.moRef); const customerPONo = action('createProductionOrder', mo.id);
  const customerPO = state.productionOrders.find(item => item.poNo === customerPONo);
  state = { ...state, productionOrders: state.productionOrders.map(item => item.id === customerPO.id ? { ...item, unitWeightKg: 0.5 } : item), attendance: [{ ...state.attendance[0], id: 'isolated-customer-shift', productionOrderId: undefined }] };
  actor('production'); assert.equal(action('startProduction', customerPO.id).success, true);
  const otherBag = state.pellets.find(item => item.inventoryStatus === 'Available' && item.grade === po.grade && item.availableKg === 25);
  action('loadPellets', otherBag.id, customerPO.id); assert.equal(action('recordOutput', customerPO.id, 1, [], 'isolated-customer-output').success, true);
  const customerPipe = state.finishedGoods.find(item => item.productionOrderId === customerPO.id);
  actor('plantmanager');
  check('Customer MO output retains SO/MO/PO/group allocation and enters Temporary Storage, never Available', () => {
    assert.equal(customerPipe.customerOrderId, order.id); assert.equal(customerPipe.manufacturingOrderId, mo.id); assert.equal(customerPipe.originGroup, mo.moNo);
    assert.equal(action('updateFinishedGoodStorage', customerPipe.id, 'G', 'Customer Order', order.id), true);
    const current = inventory.finishedPipeInventory(state.finishedGoods.find(item => item.id === customerPipe.id), state); assert.equal(current.bucket, 'Temporary Storage'); assert.equal(current.available, 0); assert.equal(current.onHand, 1);
  });
  check('New zero-balance completion only updates the targeted WIP; positive balances and wrong roles are rejected', () => {
    actor('production');const positiveBefore=state;assert.equal(action('finishWipBag',otherBag.id).success,false);assert.equal(state,positiveBefore);actor('plantmanager');
    const history = { ...state.pellets.find(item => item.id === otherBag.id), availableKg: 0 }; state = { ...state, pellets: state.pellets.map(item => item.id === history.id ? history : item) };
    const before = state; assert.equal(action('finishWipBag', history.id).success, false); assert.equal(state, before);
    actor('production'); assert.equal(action('finishWipBag', history.id).success, true); assert.equal(state.pellets.find(item => item.id === history.id).barcode, history.barcode);
    const saved = state; assert.equal(action('finishWipBag', history.id).success, true); assert.equal(state, saved);
  });
  // Low-stock request -> approval -> transfer -> receipt uses existing references/actions.
  actor('plantmanager'); const requestRef = 'MR-2099-9911'; const beforeRequest = state;
  action('addMaterialRequest', { refNo: requestRef, date: '2026-10-16', requestedBy: state.currentUser.name, materialCategory: 'Virgin Pellet', pelletType: 'Virgin', grade: 'PE80', color: 'White', requestedKg: 25, requestedBags: 1, status: 'New', destination: 'Branch Plant' });
  const request = state.materialRequests.find(item => item.refNo === requestRef);
  check('Material Request creates no available stock', () => assert.equal(state.pellets, beforeRequest.pellets));
  actor('accounting'); action('approveMaterialRequest', request.id);
  actor('accounting'); const transferNo = action('createTransfer', request.id); const transfer = state.transfers.find(item => item.refNo === transferNo);
  // Existing dispatch UI uses the transfer status action, not a second material entry.
  action('confirmTransferReceipt', transfer.id, 1, undefined, undefined, 'B');
  check('Preparing transfer cannot be received or increase raw stock prematurely', () => assert.equal(state.transfers.find(item => item.id === transfer.id).status, 'Preparing'));
  check('Accounting dispatch advances the SAME transfer and adds no stock or new physical bags', () => {
    const before = state; assert.equal(action('dispatchTransfer', transfer.id).success, true);
    assert.equal(state.pellets, before.pellets); assert.equal(state.transactions, before.transactions); assert.equal(state.transfers.find(item => item.id === transfer.id).status, 'In Transit');
    const saved = state; assert.equal(action('dispatchTransfer', transfer.id).success, true); assert.equal(state, saved);
  });
  actor('plantmanager'); const beforeReceipt = balances().virgin; action('confirmTransferReceipt', transfer.id, 1, undefined, undefined, 'B');
  check('Transfer receipt activates the same pending bag and preserves MR/transfer traceability once', () => {
    assert.equal(balances().virgin, beforeReceipt + 25); assert.equal(state.transfers.find(item => item.id === transfer.id).status, 'Received'); const received = state.pellets.find(item => item.transferRef === transferNo); assert.equal(received.currentLocation, 'B'); assert.equal(received.inventoryStatus, 'Available');
    const saved = state; action('confirmTransferReceipt', transfer.id, 1, undefined, undefined, 'B'); assert.equal(state, saved);
  });
  // Legitimate additional output supplies enough rejected weight for the existing 50kg pool.
  actor('production'); assert.equal(action('startProduction', po.id).success, true);
  const recyclingInput = state.pellets.find(item => item.grade === 'PE100' && item.inventoryStatus === 'Available' && item.availableKg === 25);
  action('loadPellets', recyclingInput.id, po.id);
  const oldBatchIds = new Set(state.recyclingBatches.map(item => item.id));
  assert.equal(action('recordOutput', po.id, 20, Array.from({ length: 20 }, () => ({ weightKg: 0.5, reason: 'Surface Defect' })), 'isolated-reject-pool-output').success, true);
  const recyclingBatch = state.recyclingBatches.find(item => !oldBatchIds.has(item.id));
  assert.equal(action('recordOutput', po.id, 30, [], 'isolated-remaining-wip-output').success, true);
  check('Rejected output feeds existing recycling allocation; it does not create good pipes', () => { assert.ok(recyclingBatch); assert.equal(recyclingBatch.status, 'Ready for Cutting'); assert.equal(recyclingBatch.originalKg, 50); assert.equal(state.transactions.find(item => item.productionOutputEntryId === 'isolated-reject-pool-output').finishedGoodsQuantity, 0); });
  action('updateRecyclingStage', recyclingBatch.id, 'start-cutting'); action('updateRecyclingStage', recyclingBatch.id, 'complete-cutting'); action('updateRecyclingStage', recyclingBatch.id, 'submit-weight', 45);
  check('Crushing cannot bypass existing Plant Manager approval', () => { const before = state; assert.equal(action('updateRecyclingStage', recyclingBatch.id, 'start-crushing').success, false); assert.equal(state, before); });
  actor('plantmanager'); assert.equal(action('confirmRecyclingForCrushing', recyclingBatch.id), true);
  actor('production'); action('updateRecyclingStage', recyclingBatch.id, 'start-crushing'); action('updateRecyclingStage', recyclingBatch.id, 'complete-crushing'); action('updateRecyclingStage', recyclingBatch.id, 'start-pelletizing');
  const rawRecycledBefore = balances().recycled; action('completeRecyclingBatch', recyclingBatch.id, 25, 'Green');
  const recycledBag = state.pellets.find(item => item.recyclingBatchRef === recyclingBatch.batchNo);
  check('Approved recycling creates one unique Green 25kg bag, once, with source traceability', () => {
    assert.ok(recycledBag); assert.equal(recycledBag.color, 'Green'); assert.equal(recycledBag.availableKg, 25); assert.equal(balances().recycled, rawRecycledBefore + 25);
    const before = state; action('completeRecyclingBatch', recyclingBatch.id, 25, 'Green'); assert.equal(state, before);
  });
  action('receivePellet', recycledBag.id, undefined, 'C');
  check('Storing recycled output assigns a physical location without second Stock In', () => { assert.equal(state.pellets.find(item => item.id === recycledBag.id).currentLocation, 'C'); assert.equal(operational.operationalStockEffect(state.transactions[0], state.finishedGoods).stockIn, 0); });
  action('loadPellets', recycledBag.id, po.id); const recycledRawAfterLoad = balances().recycled;
  assert.equal(action('recordOutput', po.id, 1, [], 'isolated-recycled-output').success, true);
  check('Recycled bag returns to WIP/production; only remaining WIP falls, without double raw deduction', () => { assert.equal(recycledRawAfterLoad, rawRecycledBefore); assert.equal(balances().recycled, rawRecycledBefore); assert.equal(state.pellets.find(item => item.id === recycledBag.id).availableKg, 24.5); });
  const persisted = JSON.parse(JSON.stringify(state)); memory.set('hpai:shared-app-state-v1', JSON.stringify(persisted));
  for (const user of store.USERS) check('Shared records persist unchanged for role: ' + user.role, () => {
    memory.set('hpai:shared-app-state-v1', JSON.stringify({ ...persisted, currentUser: user })); render();
    for (const key of ['pellets', 'productionOrders', 'orders', 'manufacturingOrders', 'transactions', 'materialUsageTransactions']) assert.deepEqual(captured[key], persisted[key], key);
    assert.deepEqual(operational.pelletBalances(captured.pellets), operational.pelletBalances(persisted.pellets));
  });
  check('Original physical records, IDs and barcodes are retained through the primary flow', () => {
    for (const old of initial.finishedGoods) assert.deepEqual(primary.finishedGoods.find(item => item.id === old.id), old);
    for (const old of initial.pellets) assert.deepEqual(primary.pellets.find(item => item.id === old.id), old);
  });
  console.log(`Completed ${checks} isolated end-to-end process checks; no live browser/localStorage or working records touched.`);
} finally { globalThis.window = previousWindow; await server.close(); }
