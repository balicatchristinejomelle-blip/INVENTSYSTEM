import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { restorePreviousGradeMaster, restorePreviousGradeStore, restorePreviousGradeTypes } from './material-grade-baseline.mjs';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalWindow = globalThis.window;
let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
try {
  const master = await server.ssrLoadModule('/src/productMaster.ts');
  const categories = await server.ssrLoadModule('/src/inventoryCategories.ts');
  const store = await server.ssrLoadModule('/src/store.tsx');
  const { filterSelectOptions } = await server.ssrLoadModule('/src/components/SearchableSelect.tsx');
  const Controls = (await server.ssrLoadModule('/src/components/ProductFilters.tsx')).default;
  const Tabs = (await server.ssrLoadModule('/src/components/CategoryTabs.tsx')).default;
  const Details = (await server.ssrLoadModule('/src/components/FinishedPipeDetails.tsx')).default;
  const relations = await server.ssrLoadModule('/src/finishedPipeRelations.ts');
  const { matchesRecord } = await server.ssrLoadModule('/src/components/RecordSearch.tsx');
  let captured;
  function Capture() { captured = store.useApp(); return null; }
  const render = child => renderToStaticMarkup(React.createElement(store.AppProvider, null, React.createElement(Capture), child));
  render();
  const baseline = JSON.parse(JSON.stringify(captured));
  const saved = JSON.stringify(baseline);
  const memory = new Map();
  globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }, sessionStorage: { getItem: () => null, removeItem: () => {} }, location: { hostname: 'test.invalid' } };
  const blank = { product: '', grade: '', size: '', sdr: '', length: '' };
  const search = query => filterSelectOptions(master.MATERIAL_GRADES.map(value => ({ value, label: value })), query).map(option => option.value);
  check('Exactly PE80 / PE100 are active, and every category uses the same array instance', () => { assert.deepEqual(master.MATERIAL_GRADES, ['PE80', 'PE100']); assert.equal(master.HPAI_PRODUCT_MASTER.materialGrades, master.MATERIAL_GRADES); assert.equal(categories.MATERIAL_GRADES, master.MATERIAL_GRADES); });
  for (const [query, expected] of [['PE', ['PE80', 'PE100']], ['80', ['PE80']], ['100', ['PE100']], ['', ['PE80', 'PE100']]]) check(`Grade search ${query || 'cleared'}`, () => assert.deepEqual(search(query), expected));
  for (const legacy of master.LEGACY_MATERIAL_GRADES) check(`${legacy}: readable but never an active option`, () => { assert.equal(master.isActiveMaterialGrade(legacy), false); assert.equal(store.isSupportedMaterialGrade(legacy), true); assert.ok(!master.MATERIAL_GRADES.includes(legacy)); });
  for (const user of store.USERS) check(`${user.role}: PE80 and All Material Grades render through the same unchanged combobox`, () => {
    memory.set('hpai:shared-app-state-v1', JSON.stringify({ ...baseline, currentUser: user }));
    let html = render(React.createElement(Controls, { value: { ...blank, grade: 'PE80' }, onChange: () => {}, includeProduct: true, includeGrade: true }));
    assert.equal(captured.currentUser.role, user.role); assert.ok(html.includes('value="PE80"')); assert.equal((html.match(/aria-label="Material Grade"/g) || []).length, 1); assert.ok(!html.includes('HDPE Standard'));
    html = render(React.createElement(Controls, { value: blank, onChange: () => {}, includeGrade: true })); assert.ok(html.includes('placeholder="All Material Grades"'));
  });
  check('Existing grade tabs show All Material Grades while retaining the original All filter value', () => { const html = renderToStaticMarkup(React.createElement(Tabs, { items: ['All', ...master.MATERIAL_GRADES], value: 'All', onChange: () => {}, displayLabel: master.materialGradeFilterLabel })); for (const label of ['All Material Grades', 'PE80', 'PE100']) assert.ok(html.includes(label)); assert.ok(html.includes('aria-selected="true"')); });
  const spec = { id: 'fixture-spec', itemCode: 'PEP-1031', productType: 'HDPE Pipe', materialGrade: 'PE100', size: '110mm', sdr: 'SDR11', productForm: 'Straight Length', straightLength: '6m', color: 'Black (BK)', stripe: 'Blue Stripe', pipeConstruction: 'Solid Wall Pipe', unitWeightKg: 3.625, active: true };
  for (const grade of [...master.MATERIAL_GRADES, ...master.LEGACY_MATERIAL_GRADES]) check(`Specification reader preserves ${grade} without guessing or remapping identifiers`, () => {
    const normalized = master.normalizeProductSpecification({ ...spec, materialGrade: grade }); assert.equal(normalized.materialGrade, grade); for (const key of ['id', 'itemCode', 'size', 'sdr', 'straightLength', 'unitWeightKg', 'active']) assert.equal(normalized[key], spec[key]);
  });
  for (const grade of master.LEGACY_MATERIAL_GRADES) check(`${grade}: persisted order/MO/PO/pipe/pellet/request/transfer/RR survive refresh`, () => {
    const state = structuredClone(baseline);
    for (const collection of ['orders', 'manufacturingOrders', 'productionOrders', 'finishedGoods', 'pellets', 'materialRequests', 'transfers', 'rrRecords']) state[collection][0].grade = grade;
    memory.set('hpai:shared-app-state-v1', JSON.stringify(state)); render();
    for (const collection of ['orders', 'manufacturingOrders', 'productionOrders', 'finishedGoods', 'pellets', 'materialRequests', 'transfers', 'rrRecords']) { const record = captured[collection].find(record => record.id === state[collection][0].id); assert.ok(record); assert.equal(record.grade, grade); assert.equal(captured[collection].length, state[collection].length); }
    const pipe = captured.finishedGoods.find(pipe => pipe.id === state.finishedGoods[0].id); assert.ok(render(React.createElement(Details, { pipe })).includes(grade)); assert.equal(pipe.barcode, state.finishedGoods[0].barcode); assert.equal(pipe.originGroup, state.finishedGoods[0].originGroup);
  });
  const source = fs.readFileSync('src/store.tsx', 'utf8');
  const ast = ts.createSourceFile('store.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const initializers = new Map();
  const walk = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) initializers.set(node.name.text, node.initializer.getText(ast)); ts.forEachChild(node, walk); }; walk(ast);
  const transpile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
  const settingsSource = fs.readFileSync('src/pages/management/Settings.tsx', 'utf8');
  const settingsAst = ts.createSourceFile('Settings.tsx', settingsSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let specificationInitializer;
  const findSpecificationInitializer = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'initialSpecifications') specificationInitializer = node.initializer.getText(settingsAst); ts.forEachChild(node, findSpecificationInitializer); }; findSpecificationInitializer(settingsAst);
  const specificationDependencies = { useMemo: fn => fn(), normalizeProductType: master.normalizeProductType, sizeUnitForProduct: master.sizeUnitForProduct, constructionForProduct: master.constructionForProduct, specificationKey: master.specificationKey, READABLE_MATERIAL_GRADES: master.READABLE_MATERIAL_GRADES };
  for (const grade of [...master.MATERIAL_GRADES, ...master.LEGACY_MATERIAL_GRADES]) check(`Owner Settings initial specifications preserve stored ${grade}`, () => {
    const record = { ...baseline.orders[0], grade };
    const dependencies = { ...specificationDependencies, orders: [record], productionOrders: [], finishedGoods: [] };
    const specifications = new Function(...Object.keys(dependencies), `${transpile(`const specifications = ${specificationInitializer};`)}; return specifications;`)(...Object.values(dependencies));
    assert.equal(specifications.length, 1); assert.equal(specifications[0].materialGrade, grade); assert.equal(specifications[0].id, 'spec-1'); assert.equal(specifications[0].size, record.diameter); assert.equal(specifications[0].sdr, record.sdr);
  });
  const helperNames = ['makePelletBags', 'normalizeBarcodeValue', 'nextAnnualSequence', 'makePermanentPelletBags', 'registryEntriesForPellets'];
  const helperCode = transpile(helperNames.map(name => `const ${name} = ${initializers.get(name)};`).join('\n'));
  const helpers = new Function('isSupportedMaterialGrade', `${helperCode}; return { ${helperNames.join(', ')} };`)(store.isSupportedMaterialGrade);
  function simulate(name, role, input) {
    let current = structuredClone({ ...baseline, currentUser: store.USERS.find(user => user.role === role), finishedGoods: [], materialRequests: [], productionOrders: [], transfers: [] });
    const dependencies = { useCallback: fn => fn, setState: fn => { current = fn(current); }, normalizeMaterialGrade: store.normalizeMaterialGrade, isActiveMaterialGrade: master.isActiveMaterialGrade, requestCategory: categories.requestCategory, specificationKey: master.specificationKey, specificationKeyFromRecord: master.specificationKeyFromRecord, specificationLength: master.specificationLength, ...helpers };
    const action = new Function(...Object.keys(dependencies), `${transpile(`const action = ${initializers.get(name)};`)}; return action;`)(...Object.values(dependencies));
    const before = structuredClone(current); const result = action(input); return { result, before, state: current };
  }
  const actions = [
    ['createCustomerOrder', 'marketing', grade => ({ ...baseline.orders[0], grade, quantity: 1 })],
    ['createReceivingReport', 'accounting', grade => ({ grade, numberOfBags: 1, pelletType: 'Virgin', color: 'Black (BK)', supplier: 'Fixture', referenceNo: 'Fixture', destination: 'Branch Plant' })],
    ['addMaterialRequest', 'plantmanager', grade => ({ ...baseline.materialRequests[0], grade, refNo: 'MR-FIXTURE', materialCategory: 'Virgin Pellet' })],
    ['createStockReplenishmentPO', 'plantmanager', grade => ({ specification: { ...spec, materialGrade: grade }, targetQty: 1, requiredDate: '2026-10-20', productionLine: 'Line 1', priority: 'Normal', reason: 'Fixture' })],
  ];
  for (const [name, role, input] of actions) {
    for (const grade of master.MATERIAL_GRADES) check(`${name}: accepts ${grade} using the actual store callback`, () => { const outcome = simulate(name, role, input(grade)); assert.notDeepEqual(outcome.state, outcome.before); if (outcome.result) assert.equal(outcome.result.success, true); });
    for (const grade of master.LEGACY_MATERIAL_GRADES) check(`${name}: rejects new selection of ${grade} without mutation`, () => { const outcome = simulate(name, role, input(grade)); assert.deepEqual(outcome.state, outcome.before); if (outcome.result) assert.equal(outcome.result.success, false); });
  }
  check('Fresh sample grades and their existing batch/physical identities remain exactly PE80 / PE100', () => { const testBags = baseline.pellets.filter(bag => bag.batchNo === 'TEST-PE80' || bag.batchNo === 'TEST-PE100'); assert.equal(testBags.length, 40); assert.equal(testBags.filter(bag => bag.grade === 'PE80').length, 20); assert.equal(testBags.filter(bag => bag.grade === 'PE100').length, 20); assert.equal(baseline.finishedGoods.length, 6); });
  check('Product barcode contains the same item/product/size/length/SDR regardless of material grade', () => { const pipe = baseline.finishedGoods[0]; const coded = { ...pipe, itemCode: 'PEP-1031' }; const pe80 = relations.resolveFinishedPipe({ ...coded, grade: 'PE80' }, baseline); const pe100 = relations.resolveFinishedPipe({ ...coded, grade: 'PE100' }, baseline); assert.equal(pe80.productBarcode, pe100.productBarcode); assert.ok(!pe80.productBarcode.includes('PE80')); assert.ok(!pe100.productBarcode.includes('PE100')); assert.equal(coded.barcode, pipe.barcode); });
  check('Legacy record search remains readable and no existing data is mutated by fixtures', () => { assert.ok(matchesRecord({ grade: 'CTS Grade' }, 'cts')); assert.equal(JSON.stringify(baseline), saved); });
  for (const [file, restore] of [['src/productMaster.ts', restorePreviousGradeMaster], ['src/store.tsx', restorePreviousGradeStore], ['src/types.ts', restorePreviousGradeTypes]]) check(`${file}: only exact reviewed grade changes differ from pre-task main`, () => assert.equal(restore(fs.readFileSync(file, 'utf8')), execFileSync('git', ['show', `f47fc9c:${file}`], { encoding: 'utf8' }).replace(/\r/g, '')));
  for (const file of ['src/index.css', 'src/components/SearchableSelect.tsx', 'src/components/FinishedPipeDetails.tsx', 'src/finishedPipeRelations.ts', 'src/productionGroups.ts', 'src/reprintWorkflow.ts', 'src/documentPrint.ts', 'src/components/BarcodeLabel.tsx']) check(`Non-grade behavior unchanged: ${file}`, () => assert.equal(fs.readFileSync(file, 'utf8').replace(/\r/g, ''), execFileSync('git', ['show', `f47fc9c:${file}`], { encoding: 'utf8' }).replace(/\r/g, '')));
  console.log(`Completed ${checks} active-grade, historical-preservation, six-role, callback and non-grade regression checks. SSR is not visual browser verification.`);
} finally { if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; await server.close(); }
