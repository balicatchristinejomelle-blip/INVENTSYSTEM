import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { restoreProductionOutputFile, reviewedProductionOutputDeltas, reviewedProductionOutputAdditions } from './production-output-baseline.mjs';
import { restoreProcessFlowFile } from './process-flow-baseline.mjs';

let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
const read = file => fs.readFileSync(file, 'utf8').replace(/\r/g, '');
function declarations(text) {
  const ast = ts.createSourceFile('source.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), result = new Map();
  const visit = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) result.set(node.name.text, node.initializer.getText(ast)); ts.forEachChild(node, visit); };
  visit(ast); return result;
}
const source = read('src/store.tsx'), bindings = declarations(source);
for (const file of Object.keys(reviewedProductionOutputDeltas)) check('Only exact reviewed production changes are accepted: ' + file, () => {
  assert.equal(restoreProductionOutputFile(file, read(file)), execFileSync('git', ['show', 'b40c023:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  assert.throws(() => restoreProductionOutputFile(file, read(file) + '\n// unexpected'), /Unreviewed (production-output|process-flow|approval-scan|incoming-printing) delta/);
});
for (const [file, hash] of Object.entries(reviewedProductionOutputAdditions)) check('Exact read-only production helper: ' + file, () => assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash));
const before = declarations(execFileSync('git', ['show', 'b40c023:src/store.tsx'], { encoding: 'utf8' }).replace(/\r/g, ''));
const preservedBindings = declarations(restoreProcessFlowFile('src/store.tsx', source));
for (const [name, value] of before) if (name.startsWith('INITIAL_') || (value.startsWith('useCallback(') && name !== 'recordOutput')) check('Unchanged existing seed/business callback: ' + name, () => assert.equal(preservedBindings.get(name), value));
check('No reset, reseed, ID replacement or production-output hydration added', () => {
  for (const name of ['restoreAppState', 'addReplenishmentSample', 'makePermanentFinishedPipes', 'calculateProductionMaterialPlan', 'loadPellets']) assert.equal(bindings.get(name), before.get(name));
});
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const oldWindow = globalThis.window;
try {
  const store = await server.ssrLoadModule('/src/store.tsx');
  const output = await server.ssrLoadModule('/src/productionOutput.ts');
  const master = await server.ssrLoadModule('/src/productMaster.ts');
  const barcodes = await server.ssrLoadModule('/src/finishedPipeBarcodes.ts');
  const relations = await server.ssrLoadModule('/src/finishedPipeRelations.ts');
  const locations = await server.ssrLoadModule('/src/locationMaster.ts');
  let captured;
  function Capture() { captured = store.useApp(); return null; }
  const render = () => renderToStaticMarkup(React.createElement(store.AppProvider, null, React.createElement(Capture)));
  render();
  const baseline = JSON.parse(JSON.stringify(captured));
  const user = store.USERS.find(user => user.role === 'production');
  const po = { ...baseline.productionOrders.find(po => po.targetQty === 550), unitWeightKg: 1 };
  const attendance = { ...baseline.attendance[0], id: 'isolated-output-attendance', employeeId: user.employeeId, employeeName: user.name, status: 'Active', shift: 'Day', date: '2026-10-16', clockIn: '06:00' };
  const fixture = { ...baseline, currentUser: user, currentShift: 'Day', clockedIn: true, attendance: [attendance], turnovers: [],
    productionOrders: baseline.productionOrders.map(item => item.id === po.id ? po : item),
    pellets: [{ ...baseline.pellets[0], grade: po.grade, availableKg: 1000, inventoryStatus: 'Loaded', loadedForPOId: po.id }],
    colorants: baseline.colorants.map(item => ({ ...item, availableKg: 100 })), materialUsageTransactions: [] };
  const transpile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const helperNames = ['roundKg', 'makeFinishedPipes', 'nextAnnualSequence', 'makePermanentFinishedPipes', 'registryEntriesForFinishedGoods', 'transactionBelongsToSession', 'isUnfinishedProductionOrder', 'findPendingTurnover', 'findSessionProductionOrder'];
  const helperCode = transpile(helperNames.map(name => `const ${name} = ${bindings.get(name)};`).join('\n'));
  const helpers = new Function('normalizeBarcodeValue', 'allocateFinishedPipeBarcodes', helperCode + ';return {' + helperNames.join(',') + '};')(store.normalizeBarcodeValue, barcodes.allocateFinishedPipeBarcodes);
  function simulate(name, state, args) {
    let current = state;
    const dependencies = { useCallback: fn => fn, flushSync: fn => fn(), setState: fn => { current = fn(current); },
      ...helpers, ...output, consumeLocationBalances: locations.consumeLocationBalances, hydrateFinishedPipe: relations.hydrateFinishedPipe, normalizeMaterialGrade: store.normalizeMaterialGrade,
      calculateProductionMaterialPlan: store.calculateProductionMaterialPlan, colorCodeFromProductColor: master.colorCodeFromProductColor, colorCodeFromStripe: master.colorCodeFromStripe, MASS_TOLERANCE_KG: 0.001 };
    const action = new Function(...Object.keys(dependencies), transpile('const action = ' + bindings.get(name)) + ';return action;')(...Object.values(dependencies));
    const result = action(...args); return { state: current, result };
  }
  const rejects = n => Array.from({ length: n }, () => ({ weightKg: 0.2, reason: 'Surface Defect' }));
  const totals = state => output.productionOutputTotals(state.productionOrders.find(item => item.id === po.id), state.rejectedMaterials);
  const snapshot = JSON.stringify(fixture);
  const newMO = { ...baseline.manufacturingOrders[0], id: 'isolated-output-mo', moNo: 'MO-ISOLATED-OUTPUT', toManufactureQty: 550 };
  const creating = { ...fixture, currentUser: store.USERS.find(user => user.role === 'plantmanager'), manufacturingOrders: [...fixture.manufacturingOrders, newMO] };
  const created = simulate('createProductionOrder', creating, [newMO.id]);
  check('PO creation has zero completion and creates no output, pipes or movements', () => {
    assert.ok(created.result); assert.equal(created.state.productionOrders.at(-1).completedQty, 0); assert.equal(created.state.productionOrders.at(-1).targetQty, 550);
    for (const key of ['finishedGoods', 'transactions', 'pellets', 'barcodeRegistry']) assert.equal(created.state[key], creating[key]);
    assert.equal(simulate('createProductionOrder', created.state, [newMO.id]).state, created.state);
  });
  for (const status of ['Ready', 'Scheduled', 'Partially Completed', 'In Production']) check('Explicit Start / Continue works: ' + status, () => {
    const state = { ...fixture, productionOrders: fixture.productionOrders.map(item => item.id === po.id ? { ...po, status } : item) };
    const started = simulate('startProduction', state, [po.id]); assert.equal(started.result.success, true, started.result.error);
    assert.equal(started.state.productionOrders.find(item => item.id === po.id).status, 'In Production');
    assert.equal(helpers.findSessionProductionOrder(started.state.productionOrders, started.state.transactions, started.state.attendance[0]).id, po.id);
    for (const key of Object.keys(state).filter(key => !['productionOrders', 'attendance'].includes(key))) assert.equal(started.state[key], state[key], key);
    assert.equal(simulate('startProduction', started.state, [po.id]).state, started.state);
  });
  const started = simulate('startProduction', fixture, [po.id]).state;
  const first = simulate('recordOutput', started, [po.id, 50, rejects(2), 'isolated-entry-1']);
  check('First actual entry: output 50 / good 48 / rejected 2', () => {
    assert.equal(first.result.success, true, first.result.error); assert.deepEqual(totals(first.state), { output: 50, good: 48, rejected: 2 });
    assert.equal(first.state.finishedGoods.length - started.finishedGoods.length, 48);
  });
  const second = simulate('recordOutput', first.state, [po.id, 100, rejects(3), 'isolated-entry-2']);
  check('Cumulative entry: output 150 / good 145 / rejected 5 / target 550', () => {
    assert.equal(second.result.success, true, second.result.error); assert.deepEqual(totals(second.state), { output: 150, good: 145, rejected: 5 });
    assert.equal(second.state.productionOrders.find(item => item.id === po.id).targetQty, 550);
    assert.equal(second.state.finishedGoods.length - started.finishedGoods.length, 145);
    assert.equal(second.state.rejectedMaterials.length - started.rejectedMaterials.length, 5);
    assert.equal(second.state.transactions.filter(item => item.productionOutputEntryId).length, 2);
  });
  for (const [entry, qty, count] of [['isolated-entry-1', 50, 2], ['isolated-entry-2', 100, 3]]) check('Duplicate submission does not write: ' + entry, () => {
    const retry = simulate('recordOutput', second.state, [po.id, qty, rejects(count), entry]); assert.equal(retry.result.success, true); assert.equal(retry.state, second.state);
  });
  check('Existing pipes, output history, POs and references remain unchanged', () => {
    for (const key of ['finishedGoods', 'transactions']) for (const record of started[key]) assert.deepEqual(second.state[key].find(item => item.id === record.id), record);
    for (const record of started.productionOrders.filter(item => item.id !== po.id)) assert.equal(second.state.productionOrders.find(item => item.id === record.id), record);
    for (const key of ['manufacturingOrders', 'transfers', 'rrRecords', 'employees', 'attendance', 'printMetadata', 'reprintRequests']) assert.equal(second.state[key], started[key], key);
    assert.equal(new Set(second.state.finishedGoods.map(item => item.id)).size, second.state.finishedGoods.length);
    assert.equal(new Set(second.state.finishedGoods.map(item => item.barcode)).size, second.state.finishedGoods.length);
  });
  check('Original material plan and WIP consumption are retained', () => {
    const required = store.calculateProductionMaterialPlan(po, 50).pelletRequiredKg + store.calculateProductionMaterialPlan(po, 100).pelletRequiredKg;
    assert.ok(Math.abs(second.state.pellets[0].availableKg - (1000 - required)) < 0.002);
    assert.ok(second.state.materialUsageTransactions.every(item => item.outputTransactionId));
  });
  const allRejected = simulate('recordOutput', started, [po.id, 5, rejects(5), 'all-rejected']);
  check('Rejected-only output creates no good pipes', () => { assert.equal(allRejected.result.success, true); assert.equal(allRejected.state.finishedGoods.length, started.finishedGoods.length); assert.deepEqual(totals(allRejected.state), { output: 5, good: 0, rejected: 5 }); });
  const finishState = { ...started, productionOrders: started.productionOrders.map(item => item.id === po.id ? { ...item, targetQty: 5 } : item) };
  const finished = simulate('recordOutput', finishState, [po.id, 5, [], 'finish-entry']);
  check('Full output updates completion status; retries still cannot duplicate', () => {
    assert.equal(finished.state.productionOrders.find(item => item.id === po.id).status, 'Completed');
    assert.equal(simulate('recordOutput', finished.state, [po.id, 5, [], 'finish-entry']).state, finished.state);
  });
  check('Legacy missing totals are read safely; explicit zero is preserved', () => {
    const legacy = { ...po, completedQty: 10 }, rejected = [{ poRef: po.poNo, quantity: 2 }];
    assert.deepEqual(output.productionOutputTotals(legacy, rejected), { output: 10, good: 8, rejected: 2 });
    assert.deepEqual(output.productionOutputTotals({ ...legacy, totalGoodQty: 0, totalRejectedQty: 0 }, rejected), { output: 10, good: 0, rejected: 0 });
    assert.equal(legacy.totalGoodQty, undefined);
  });
  for (const [savedGood, previousRejected, expectedGood, expectedRejected] of [[undefined, 2, 12, 3], [0, 10, 4, 11]]) check('A new entry adds to legacy totals without replacing prior history: ' + String(savedGood), () => {
    const legacy = { ...started,
      productionOrders: started.productionOrders.map(item => item.id === po.id ? { ...item, completedQty: 10, totalGoodQty: savedGood, totalRejectedQty: undefined } : item),
      rejectedMaterials: [...started.rejectedMaterials, { ...started.rejectedMaterials[0], id: 'isolated-legacy-reject', poRef: po.poNo, quantity: previousRejected, weightKg: 0.2 }],
    };
    const result = simulate('recordOutput', legacy, [po.id, 5, rejects(1), 'legacy-additive-entry']);
    assert.equal(result.result.success, true, result.result.error);
    assert.deepEqual(totals(result.state), { output: 15, good: expectedGood, rejected: expectedRejected });
    for (const record of legacy.rejectedMaterials) assert.deepEqual(result.state.rejectedMaterials.find(item => item.id === record.id), record);
  });
  check('Recording output does not invent Stock In or Stock Out movements', () => {
    assert.deepEqual(second.state.transactions.filter(item => /Stock In|Stock Out/.test(item.transactionType)), started.transactions.filter(item => /Stock In|Stock Out/.test(item.transactionType)));
  });
  for (const [name, override, args] of [
    ['no active shift', { attendance: [] }, [po.id, 1, []]],
    ['other role', { currentUser: store.USERS[0] }, [po.id, 1, []]],
    ['not started', { productionOrders: fixture.productionOrders }, [po.id, 1, []]],
    ['material shortage', { pellets: [] }, [po.id, 1, []]],
    ['fractional output', {}, [po.id, 1.5, []]],
    ['too many rejects', {}, [po.id, 1, rejects(2)]],
    ['missing rejection weight', {}, [po.id, 1, [{ weightKg: 0, reason: 'Surface Defect' }]]],
    ['over target', {}, [po.id, 551, []]],
  ]) check('Invalid save is atomic: ' + name, () => { const state = { ...started, ...override }, attempt = simulate('recordOutput', state, args); assert.equal(attempt.result.success, false); assert.equal(attempt.state, state); });
  for (const override of [{ attendance: [] }, { currentUser: store.USERS[0] }, { turnovers: baseline.turnovers },
    { productionOrders: fixture.productionOrders.map(item => item.id === po.id ? { ...item, assignedShift: 'Night' } : item) },
    { productionOrders: fixture.productionOrders.map(item => item.id === po.id ? { ...item, status: 'Cancelled' } : item) },
    { transactions: [{ id: 'other-session-work', attendanceSessionId: attendance.id, productionOrderId: fixture.productionOrders[0].id }] }]) check('Start cannot bypass shift/role/status/ongoing work safeguards', () => { const state = { ...fixture, ...override }, attempt = simulate('startProduction', state, [po.id]); assert.equal(attempt.result.success, false); assert.equal(attempt.state, state); });
  const memory = new Map([['hpai:shared-app-state-v1', JSON.stringify(second.state)]]);
  globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }, location: { hostname: 'test.invalid' } };
  for (let refresh = 1; refresh <= 2; refresh++) check('Refresh preserves saved output and creates no duplicate: ' + refresh, () => {
    render();
    assert.deepEqual(captured.transactions.filter(item => item.productionOutputEntryId), second.state.transactions.filter(item => item.productionOutputEntryId));
    assert.deepEqual(captured.productionOrders, second.state.productionOrders);
    assert.equal(captured.finishedGoods.length, second.state.finishedGoods.length);
    assert.deepEqual(captured.finishedGoods.map(item => [item.id, item.barcode]), second.state.finishedGoods.map(item => [item.id, item.barcode]));
  });
  check('Input fixture never mutated', () => assert.equal(JSON.stringify(fixture), snapshot));
  console.log(`Completed ${checks} production-output preservation and workflow checks; isolated fixtures only.`);
} finally { globalThis.window = oldWindow; await server.close(); }
