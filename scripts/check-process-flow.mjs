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
import { approvalScanDeltas, approvalScanAdditions, restoreApprovalScanFile } from './approval-scan-baseline.mjs';
import { restoreScanSessionFile } from './scan-session-baseline.mjs';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
for (const file of Object.keys(reviewedProcessFlowDeltas)) check('Exact reviewed process-flow delta, rejects unrelated edits: ' + file, () => {
  const source = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
  assert.equal(restoreProductionOutputFile(file, source), execFileSync('git', ['show', 'b40c023:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  assert.throws(() => restoreProcessFlowFile(file, source + '\n// unexpected'), /Unreviewed (process-flow|approval-scan|incoming-printing) delta/);
});
for(const file of Object.keys(approvalScanDeltas))check('Exact reviewed approval/scan delta: '+file,()=>{const source=fs.readFileSync(file,'utf8');assert.equal(restoreApprovalScanFile(file,source),execFileSync('git',['show','7b0c39c:'+file],{encoding:'utf8'}).replace(/\r/g,''));assert.throws(()=>restoreApprovalScanFile(file,source+'\n// unexpected'),/Unreviewed (approval-scan|incoming-printing) delta/);});
for(const[file,hash]of Object.entries(approvalScanAdditions))check('Exact additive physical scan module: '+file,()=>assert.equal(createHash('sha256').update(restoreScanSessionFile(file,fs.readFileSync(file,'utf8'))).digest('hex'),hash));
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
  const physicalScan = await server.ssrLoadModule('/src/physicalScan.ts');
  const printables = await server.ssrLoadModule('/src/printableRecords.ts');
  const printing = await server.ssrLoadModule('/src/reprintWorkflow.ts');
  const incomingPrinting = await server.ssrLoadModule('/src/incomingPelletBarcodes.ts');
  const countedReceiving = await server.ssrLoadModule('/src/countedPelletReceiving.ts');
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
  const baseDeps = { ...countedReceiving, ...incomingPrinting, ...store, ...inventory, ...locations, ...relations, ...barcodes, ...master, ...colors, ...categories, ...production, ...operational, ...physicalScan, MASS_TOLERANCE_KG: 0.001 };
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
  const scan = (item, orderId) => ({ shift: 'Day', scannerMode: 'Isolated physical barcode scan', barcode: item.barcode, orderId });
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
    const before = clone(); assert.equal(action('updateFinishedGoodStorage', pipe.id, 'A', 'General Inventory', undefined, scan(pipe)), true); assert.equal(inventory.finishedPipeInventory(state.finishedGoods.find(item => item.id === pipe.id), state).bucket, 'Available');
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
    assert.equal(action('releaseFinishedGood', pipe.id, scan(pipe, order.id)), true); assert.equal(operational.operationalStockEffect(state.transactions[0], state.finishedGoods).stockOut, 1); assert.equal(inventory.finishedPipeInventory(state.finishedGoods.find(item => item.id === pipe.id), state).onHand, 0);
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
    assert.equal(action('updateFinishedGoodStorage', customerPipe.id, 'G', 'Customer Order', order.id, scan(customerPipe)), true);
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
  actor('plantmanager'); const beforeReceipt = balances().virgin; action('acceptCountedPelletTransfer',transfer.id,1,'B');
  check('Counted receipt generates one accepted bag and preserves MR/transfer traceability once', () => {
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
  action('receivePellet', recycledBag.id, scan(recycledBag), 'C');
  check('Storing recycled output assigns a physical location without second Stock In', () => { assert.equal(state.pellets.find(item => item.id === recycledBag.id).currentLocation, 'C'); assert.equal(operational.operationalStockEffect(state.transactions[0], state.finishedGoods).stockIn, 0); });
  action('loadPellets', recycledBag.id, po.id); const recycledRawAfterLoad = balances().recycled;
  assert.equal(action('recordOutput', po.id, 1, [], 'isolated-recycled-output').success, true);
  check('Recycled bag returns to WIP/production; only remaining WIP falls, without double raw deduction', () => { assert.equal(recycledRawAfterLoad, rawRecycledBefore); assert.equal(balances().recycled, rawRecycledBefore); assert.equal(state.pellets.find(item => item.id === recycledBag.id).availableKg, 24.5); });
  // Additional isolated fork: requested approval + five delivered bags + ten good pipes.
  const previousFlow=state;state=structuredClone(initial);actor('plantmanager');
  const approvalRef='MR-2099-9955';action('addMaterialRequest',{refNo:approvalRef,date:'2026-10-16',requestedBy:'Isolated scan QA',materialCategory:'Virgin Pellet',pelletType:'Virgin',grade:'PE80',color:'White',requestedKg:125,requestedBags:5,status:'Pending',destination:'Branch Plant'});
  const approvalRequest=state.materialRequests.find(item=>item.refNo===approvalRef);assert.ok(approvalRequest);
  const printableRequest=()=>printables.printableRecords(state).find(item=>item.recordType==='MATERIAL REQUEST'&&item.recordId===approvalRequest.id);
  const pendingState=state;
  check('Pending request is viewable but cannot print, reprint or generate expected bags',()=>{
    assert.ok(printables.documentFor(state,printableRequest()));
    for(const user of store.USERS){assert.equal(printing.canPrint(user,printableRequest()),false);assert.ok(printing.validatePrint(state,user,printableRequest()));}
    actor('accounting');assert.equal(action('createTransfer',approvalRequest.id),null);assert.equal(state.pellets,pendingState.pellets);
  });
  check('Rejected request stays readable, cannot print or generate bags, and cannot be re-approved',()=>{
    action('rejectMaterialRequest',approvalRequest.id);assert.equal(state.materialRequests.find(item=>item.id===approvalRequest.id).status,'Rejected');
    const rejected=clone();assert.ok(printables.documentFor(state,printableRequest()));assert.ok(printing.validatePrint(state,state.currentUser,printableRequest()));assert.equal(action('createTransfer',approvalRequest.id),null);action('approveMaterialRequest',approvalRequest.id);assert.deepEqual(state,rejected);
  });
  state=pendingState;
  check('Approval permissions are unchanged; approval itself creates no received stock',()=>{
    actor('production');const before=clone();action('approveMaterialRequest',approvalRequest.id);assert.deepEqual(state,before);
    actor('accounting');const beforeStock=balances();action('approveMaterialRequest',approvalRequest.id);assert.equal(state.materialRequests.find(item=>item.id===approvalRequest.id).status,'Approved');assert.deepEqual(balances(),beforeStock);assert.equal(printing.validatePrint(state,state.currentUser,printableRequest()),null);
  });
  const rawBefore=balances().virgin;const expectedTransferNo=action('createTransfer',approvalRequest.id);const delivery=state.transfers.find(item=>item.refNo===expectedTransferNo);let expectedBags=[];
  check('Approved transfer creates no pellet labels or inventory before accepted received quantity',()=>{
    assert.equal(state.pellets.filter(item=>item.transferRef===delivery.refNo).length,0);assert.equal(balances().virgin,rawBefore);
    const before=state;action('createTransfer',approvalRequest.id);assert.equal(state,before);
  });
  actor('plantmanager');check('Preparing delivery cannot be accepted by count',()=>{const before=state;assert.equal(action('acceptCountedPelletTransfer',delivery.id,5,'A').success,false);assert.equal(state,before);});
  actor('accounting');action('dispatchTransfer',delivery.id);actor('plantmanager');
  check('Invalid bag counts, missing location and legacy scan/bulk APIs cannot change inventory',()=>{
    const before=state;assert.equal(action('acceptCountedPelletTransfer',delivery.id,6,'A').success,false);assert.equal(action('acceptCountedPelletTransfer',delivery.id,5,'BAD').success,false);assert.equal(action('acceptScannedPelletTransfer',delivery.id,['UNKNOWN'],'A').success,false);assert.equal(action('confirmTransferReceipt',delivery.id,5,undefined,undefined,'A').success,false);assert.equal(state,before);
  });
  check('Unapproved or mismatched material cannot be received by count',()=>{
    const before=state;
    for(const override of [{materialRequests:state.materialRequests.map(item=>item.id===approvalRequest.id?{...item,status:'Pending'}:item)},{transfers:state.transfers.map(item=>item.id===delivery.id?{...item,color:'Green'}:item)}]){
      state={...before,...override};const invalid=state;assert.equal(action('acceptCountedPelletTransfer',delivery.id,5,'A').success,false);assert.equal(state,invalid);
    }state=before;
  });
  check('Counted transfer acceptance retains Plant Manager-only authorization',()=>{
    for(const user of store.USERS.filter(user=>user.role!=='plantmanager')){actor(user.role);const before=state;assert.equal(action('acceptCountedPelletTransfer',delivery.id,5,'A').success,false);assert.equal(state,before);}actor('plantmanager');
  });
  for(let index=1;index<=5;index++)check('Cumulative accepted bag '+index+' adds exactly 25kg once and generates only the received label',()=>{
    assert.equal(action('acceptCountedPelletTransfer',delivery.id,index,['A','B','C','D','E'][index-1],index<5?'Missing':undefined).success,true);assert.equal(balances().virgin,rawBefore+25*index);
    expectedBags=state.pellets.filter(item=>item.transferRef===delivery.refNo);assert.equal(expectedBags.length,index);assert.ok(expectedBags.every(item=>item.inventoryStatus!=='Pending Receipt'));
    const before=state;assert.equal(action('acceptCountedPelletTransfer',delivery.id,index,'I','Missing').success,false);assert.equal(state,before);
  });
  check('Five accepted bags total 125kg Stock In and complete the SAME transfer',()=>{assert.equal(state.transfers.find(item=>item.id===delivery.id).status,'Received');assert.equal(state.transactions.filter(item=>expectedBags.some(bag=>bag.barcode===item.barcode)&&item.transactionType==='Pellets Received').reduce((sum,item)=>sum+operational.operationalStockEffect(item,state.finishedGoods).stockIn,0),125);});
  const beforePipeFlow=clone();action('createStockReplenishmentPO',{specification:{...spec,id:'isolated-ten-pipes',materialGrade:'PE80'},targetQty:550,requiredDate:'2026-10-19',productionLine:'Line 1',priority:'Normal',reason:'Physical ten-pipe QA'});
  const tenPO=state.productionOrders.find(item=>!beforePipeFlow.productionOrders.some(old=>old.id===item.id));actor('production');assert.equal(action('startProduction',tenPO.id).success,true);action('loadPellets',expectedBags[0].id,tenPO.id);assert.equal(action('recordOutput',tenPO.id,10,[],'isolated-ten-good-pipes').success,true);
  const tenPipes=state.finishedGoods.filter(item=>item.productionOrderId===tenPO.id);actor('plantmanager');
  check('Actual Good Output 10 creates exactly ten unique physical pipes, all Awaiting Storage, not 550',()=>{assert.equal(tenPipes.length,10);assert.equal(new Set(tenPipes.map(item=>item.barcode)).size,10);assert.ok(tenPipes.every(pipe=>inventory.finishedPipeInventory(pipe,state).bucket==='Awaiting Storage'&&pipe.availableQty===0));});
  check('Storage cannot bypass exact physical scan, source location or role restrictions',()=>{const before=state;assert.equal(action('updateFinishedGoodStorage',tenPipes[0].id,'A','General Inventory'),false);assert.equal(action('updateFinishedGoodStorage',tenPipes[0].id,'A','General Inventory',undefined,scan(tenPipes[1])),false);assert.equal(action('updateFinishedGoodStorage',tenPipes[0].id,'I','General Inventory',undefined,scan(tenPipes[0])),false);assert.equal(state,before);});
  for(const pipe of tenPipes)check('Scan stores exact pipe once: '+pipe.barcode,()=>{assert.equal(action('updateFinishedGoodStorage',pipe.id,'A','General Inventory',undefined,scan(pipe)),true);const stored=state.finishedGoods.find(item=>item.id===pipe.id);assert.equal(stored.barcode,pipe.barcode);assert.equal(inventory.finishedPipeInventory(stored,state).available,1);assert.equal(state.transactions[0].qtyChanged,0);const before=state;assert.equal(action('updateFinishedGoodStorage',pipe.id,'B','General Inventory',undefined,scan(pipe)),false);assert.equal(state,before);});
  actor('marketing');const shipmentResult=action('createCustomerOrder',{customerId:state.customers[0].id,product:tenPO.product,diameter:tenPO.diameter,length:tenPO.length,sdr:tenPO.sdr,grade:tenPO.grade,color:tenPO.color,stripe:tenPO.stripe,construction:tenPO.construction,productForm:tenPO.productForm,quantity:1,requiredDate:'2026-10-19'});assert.equal(shipmentResult.success,true);const shipmentOrder=state.orders.find(item=>item.orderNo===shipmentResult.orderNo);const shipmentPipe=state.finishedGoods.find(item=>item.reservedForOrderId===shipmentOrder.id);
  actor('production');check('A stored/reserved pipe cannot ship before Ready for Ship Out even with its exact barcode',()=>assert.equal(action('releaseFinishedGood',shipmentPipe.id,scan(shipmentPipe,shipmentOrder.id)),false));
  actor('plantmanager');action('relocatePhysicalItem','Finished Pipe',shipmentPipe.id,'I','Ready for scan-based shipment');actor('production');
  check('Ready pipe cannot ship without a second scan, with another barcode or wrong order',()=>{const before=state;assert.equal(action('releaseFinishedGood',shipmentPipe.id),false);assert.equal(action('releaseFinishedGood',shipmentPipe.id,scan(tenPipes.find(item=>item.id!==shipmentPipe.id),shipmentOrder.id)),false);assert.equal(action('releaseFinishedGood',shipmentPipe.id,scan(shipmentPipe,'wrong-order')),false);assert.equal(state,before);});
  check('Second scan of SAME barcode ships exactly once and keeps barcode/history permanently',()=>{assert.equal(action('releaseFinishedGood',shipmentPipe.id,scan(shipmentPipe,shipmentOrder.id)),true);const shipped=state.finishedGoods.find(item=>item.id===shipmentPipe.id);assert.equal(shipped.barcode,shipmentPipe.barcode);assert.equal(inventory.finishedPipeInventory(shipped,state).bucket,'Shipped');assert.equal(state.transactions[0].qtyChanged,-1);const before=state;assert.equal(action('releaseFinishedGood',shipmentPipe.id,scan(shipmentPipe,shipmentOrder.id)),false);assert.equal(state,before);assert.equal(state.finishedGoods.length,beforePipeFlow.finishedGoods.length+10);});
  for(const old of beforePipeFlow.finishedGoods)assert.deepEqual(state.finishedGoods.find(item=>item.id===old.id),old);
  state=previousFlow;
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
