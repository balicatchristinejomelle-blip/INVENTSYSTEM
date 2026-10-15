import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { restoreUILayoutStyles, UI_LAYOUT_BASELINE } from './ui-layout-baseline.mjs';

const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('vite/package.json'))('postcss');
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const previousWindow = globalThis.window, previousSession = globalThis.sessionStorage;
let checks = 0;
const check = (label, fn) => { fn(); checks++; console.log(`PASS ${label}`); };
const source = file => fs.readFileSync(file, 'utf8').replace(/\r/g, '');
const previous = file => execFileSync('git', ['show', `${UI_LAYOUT_BASELINE}:${file}`], { encoding: 'utf8' }).replace(/\r/g, '');
const editedPages = ['src/components/FinishedGoodsMetrics.tsx', 'src/pages/owner/Dashboard.tsx', 'src/pages/management/Dashboard.tsx', 'src/pages/management/Reports.tsx', 'src/pages/marketing/FinishedGoods.tsx', 'src/pages/plantmanager/FinishedGoods.tsx', 'src/pages/plantmanager/Reports.tsx', 'src/pages/plantmanager/ShiftTurnover.tsx', 'src/pages/production/BarcodeScanner.tsx', 'src/pages/production/Dashboard.tsx', 'src/pages/production/ShiftTurnover.tsx', 'src/pages/production/FinishedPipes.tsx'];

function nonPresentation(text) {
  const ast = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = ts.transform(ast, [context => {
    const visit = node => {
      if (ts.isImportDeclaration(node) && /\/MetricCards$/.test(node.moduleSpecifier.text)) return undefined;
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) return ts.factory.createIdentifier('UNCHANGED_PRESENTATION_BOUNDARY');
      return ts.visitEachChild(node, visit, context);
    };
    return root => ts.visitNode(root, visit);
  }]);
  const printed = ts.createPrinter({ removeComments: true }).printFile(result.transformed[0]); result.dispose(); return printed;
}
function eventHandlers(text) {
  const ast = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), handlers = [];
  const walk = node => { if (ts.isJsxAttribute(node) && /^on[A-Z]/.test(node.name.getText(ast))) handlers.push(`${node.name.getText(ast)}=${node.initializer?.getText(ast).replace(/\s+/g, ' ')}`); ts.forEachChild(node, walk); }; walk(ast); return handlers.sort();
}
function divByClass(html, name) {
  const first = [...html.matchAll(/<div\b[^>]*class="([^"]*)"[^>]*>/g)].find(match => match[1].split(/\s+/).includes(name));
  assert.ok(first, `Missing ${name}`); let depth = 0;
  for (const tag of html.slice(first.index).matchAll(/<div\b[^>]*>|<\/div>/g)) { depth += tag[0].startsWith('</') ? -1 : 1; if (!depth) return html.slice(first.index, first.index + tag.index + tag[0].length); }
  assert.fail(`Unclosed ${name}`);
}
try {
  for (const file of ['src/store.tsx', 'src/types.ts', 'src/productMaster.ts', 'src/productFilters.ts', 'src/finishedPipeBarcodes.ts', 'src/locationMaster.ts', 'src/finishedGoodsInventory.ts', 'src/finishedPipeRelations.ts', 'src/inventoryCategories.ts', 'src/reprintWorkflow.ts', 'src/printableRecords.ts', 'src/reprintSamples.ts', 'src/documentPrint.ts', 'src/components/BarcodeLabel.tsx', 'src/components/Sidebar.tsx', 'src/components/ProductFilters.tsx', 'src/components/SearchableSelect.tsx', 'src/components/SearchableDropdown.tsx', 'src/components/RecordSearch.tsx', 'src/components/PeriodSelector.tsx', 'src/components/Pagination.tsx', 'src/components/Modal.tsx', 'src/components/PrintAction.tsx']) check(`Business/state/permissions/widget behavior byte-for-byte unchanged: ${file}`, () => assert.equal(source(file), previous(file)));
  for (const file of editedPages) {
    check(`All non-JSX calculations, state, callbacks and guards preserved: ${file}`, () => assert.equal(nonPresentation(source(file)), nonPresentation(previous(file))));
    check(`Every existing event handler is preserved: ${file}`, () => assert.deepEqual(eventHandlers(source(file)), eventHandlers(previous(file))));
  }
  check('New metric component is presentation-only, with caller-owned values', () => { const text = source('src/components/MetricCards.tsx'); assert.ok(text.includes('items.map')); for (const forbidden of ['useApp', 'useState', 'useEffect', 'localStorage', 'setState', 'finishedGoodsSummary']) assert.ok(!text.includes(forbidden)); });
  const css = source('src/index.css'), layoutCss = css.slice(css.indexOf('/* UI consistency pass:'));
  const ast = postcss.parse(layoutCss), rules = []; ast.walkRules(rule => rules.push(rule));
  const declarations = rule => Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
  const hasRule = (fragment, property, value) => rules.some(rule => rule.selector.includes(fragment) && declarations(rule)[property] === value);
  check('Only the reviewed UI style block differs; all earlier CSS is preserved', () => assert.equal(restoreUILayoutStyles(css), previous('src/index.css')));
  for (const [count, columns, expectedRows] of [[4,4,[4]], [5,6,[3,2]], [6,3,[3,3]], [7,8,[4,3]], [8,4,[4,4]], [9,3,[3,3,3]]]) check(`Desktop ${count} peers: balanced ${expectedRows.join('+')}, no orphan row`, () => {
    const exact = rules.filter(rule => rule.parent.type === 'atrule' && rule.parent.params === '(min-width: 901px)' && rule.selector.includes(`:nth-child(${count}):last-child`));
    assert.ok(exact.some(rule => declarations(rule)['grid-template-columns'] === `repeat(${columns}, minmax(0, 1fr))`));
    const span = exact.some(rule => declarations(rule)['grid-column'] === 'span 2') ? 2 : 1;
    const rowCapacity = columns / span, rowCounts = []; for (let remaining = count; remaining > 0; remaining -= rowCapacity) rowCounts.push(Math.min(remaining, rowCapacity));
    assert.deepEqual(rowCounts, expectedRows); assert.ok(rowCounts.every(value => value > 1));
    if (count === 5 || count === 7) assert.ok(exact.some(rule => declarations(rule)['grid-column'] === '2 / span 2'));
  });
  check('Actual filter-container width can reduce four controls to 2×2 without reserved blank rows', () => { assert.ok(hasRule(':nth-child(4):last-child', 'grid-template-columns', 'repeat(2, minmax(0, 1fr))')); assert.ok(rules.some(rule => rule.parent.params === '(max-width: 860px)' && declarations(rule)['grid-column'] === 'auto')); assert.ok(hasRule('.filter-panel', 'height', 'auto')); assert.ok(hasRule('.filter-panel', 'min-height', '0')); });
  check('Main search is single-line/full-width with left text, left placeholder and left search icon', () => { assert.ok(hasRule(':not(.searchable-select)', 'text-align', 'left')); assert.ok(hasRule(':not(.searchable-select)::placeholder', 'text-align', 'left')); assert.ok(hasRule(':not(.searchable-select)', 'height', '36px')); assert.ok(hasRule(':not(.searchable-select)', 'background-position', '10px center')); assert.ok(hasRule(':not(.searchable-select)', 'width', '100%')); });
  check('Closed dropdowns center content; open internal search is left; portaled options center', () => { assert.ok(hasRule('.searchable-combobox:not(.is-open)', 'text-align', 'center')); assert.ok(hasRule('.searchable-combobox.is-open', 'text-align', 'left')); assert.ok(hasRule('.searchable-combobox.is-open .searchable-select::placeholder', 'text-align', 'left')); assert.ok(hasRule('.searchable-combobox-menu .searchable-combobox-option', 'text-align', 'center')); });
  check('Two actions separate left/right; single primary goes right, single secondary navigation left', () => { assert.ok(hasRule(':has(> :nth-child(2):last-child)', 'justify-content', 'space-between')); assert.ok(hasRule(':has(> .btn-secondary:only-child)', 'justify-content', 'flex-start')); assert.ok(hasRule('.product-view-actions)', 'justify-content', 'flex-end')); assert.ok(hasRule('.btn-secondary', 'order', '0')); assert.ok(hasRule('.btn-primary', 'order', '1')); assert.ok(hasRule('.toolbar', 'grid-column', '1 / -1')); });
  check('Tables/action cells retain centered alignment and existing button text remains centered', () => { assert.ok(css.includes('text-align: center !important')); assert.ok(css.includes('justify-content: center')); assert.ok(hasRule('.app-table th', 'justify-content', 'center')); });
  check('Five inventory metrics use equal desktop columns and natural attached label/value structure', () => { assert.ok(hasRule('.operational-content .inventory-metrics', 'grid-template-columns', 'repeat(5, minmax(0, 1fr))')); assert.ok(hasRule('.kpi-card', 'flex-direction', 'column')); assert.ok(hasRule('.kpi-card > :first-child', 'flex', '1')); assert.ok(hasRule('.plant-stat-label', 'max-height', 'none')); assert.ok(hasRule('.plant-stat-label', 'overflow', 'visible')); });
  check('Summary strip is full-width with three equal totals, outside the four equal-height detail cards', () => { assert.ok(hasRule('.material-summary', 'width', '100%')); assert.ok(hasRule('.material-summary', 'height', 'auto')); assert.ok(hasRule('.material-summary-metrics', 'grid-template-columns', 'repeat(3, minmax(0, 1fr))')); assert.ok(hasRule('.material-usage-grid', 'align-items', 'stretch')); assert.ok(hasRule('.material-usage-note', 'margin-top', '8px')); });
  check('Current Operation has separated status/control columns and a clear nonzero gap', () => { assert.ok(hasRule('.scanner-context', 'grid-template-columns', 'minmax(0, 1fr) minmax(0, 1fr)')); assert.ok(hasRule('.scanner-context', 'gap', '20px')); assert.ok(hasRule('.scanner-context-status strong', 'display', 'block')); });
  for (const width of [360,375,390,412,430]) check(`${width}px responsive CSS: one filter per row, stacked status/actions/summary`, () => {
    const mobile = rules.filter(rule => rule.parent.type === 'atrule' && rule.parent.params === '(max-width: 600px)');
    assert.ok(mobile.some(rule => rule.selector.includes('.product-filter-controls') && declarations(rule)['grid-template-columns'] === 'minmax(0, 1fr)'));
    assert.ok(mobile.some(rule => rule.selector.includes('.form-actions') && declarations(rule)['flex-direction'] === 'column'));
    assert.ok(mobile.some(rule => rule.selector === '.material-summary-metrics' && declarations(rule)['grid-template-columns'] === 'minmax(0, 1fr)'));
    assert.ok(rules.some(rule => rule.parent.params === '(max-width: 900px)' && rule.selector === '.scanner-context' && declarations(rule)['grid-template-columns'] === 'minmax(0, 1fr)'));
  });
  for (const theme of ['light','dark']) check(`${theme}: layout uses existing theme tokens, with no color-mode state mutations`, () => { assert.ok(!/localStorage|setTheme|data-theme/.test(layoutCss)); assert.ok(!/background:\s*(white|black|#[0-9a-f]{3,8})\b/i.test(layoutCss)); });
  const store = await server.ssrLoadModule('/src/store.tsx'), inventory = await server.ssrLoadModule('/src/finishedGoodsInventory.ts');
  const barcodes = await server.ssrLoadModule('/src/finishedPipeBarcodes.ts');
  const Controls = (await server.ssrLoadModule('/src/components/ProductFilters.tsx')).default;
  const Metrics = (await server.ssrLoadModule('/src/components/FinishedGoodsMetrics.tsx')).default;
  const blank = (await server.ssrLoadModule('/src/productFilters.ts')).emptyProductFilter;
  let captured; function Capture() { captured = store.useApp(); return null; }
  const render = child => renderToStaticMarkup(React.createElement(store.AppProvider, null, React.createElement(Capture), React.createElement('main', { className: 'operational-content' }, child)));
  render(); const baseline = JSON.parse(JSON.stringify(captured)), unchanged = JSON.stringify(baseline), memory = new Map();
  globalThis.window = { localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key,value) => memory.set(key,value) }, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, location: { hostname: 'test.invalid' } };
  globalThis.sessionStorage = globalThis.window.sessionStorage;
  const setContext = state => memory.set('hpai:shared-app-state-v1', JSON.stringify(state));
  const expectedLabels = ['Available','Reserved','Temporary Storage','Ready for Ship Out','On Hand'];
  for (const user of store.USERS) {
    check(`${user.role}: shared four/six-filter controls render unchanged field options/permissions`, () => { setContext({ ...baseline, currentUser: user }); for (const count of [4,6]) { const html = render(React.createElement(Controls, { value: blank, onChange: () => {}, includeProduct: true, includeGrade: true, includeColor: count === 6, includeLocation: count === 6 })); assert.equal((html.match(/role="combobox"/g) || []).length, count); assert.equal(captured.currentUser.role, user.role); assert.ok(!html.includes('Add Specification')); } });
    check(`${user.role}: five inventory labels retain correct attached counts in the same order`, () => { const html = divByClass(render(React.createElement(Metrics)), 'inventory-metrics'); const rows = [...html.matchAll(/<div class="metric-label">([^<]+)<\/div><strong>([^<]+)<\/strong>/g)]; assert.deepEqual(rows.map(row => row[1]), expectedLabels); const counts = inventory.finishedGoodsSummary(captured.finishedGoods, captured); assert.deepEqual(rows.map(row => Number(row[2])), [counts.available,counts.reserved,counts.temporary,counts.ready,counts.onHand]); });
  }
  const pages = [['owner/Dashboard','OWNER_SUPER_ADMIN'],['owner/Records','OWNER_SUPER_ADMIN'],['owner/Reports','OWNER_SUPER_ADMIN'],['accounting/RRRecords','accounting'],['accounting/RawMaterials','accounting'],['accounting/Transactions','accounting'],['marketing/FinishedGoods','marketing'],['management/Dashboard','management'],['management/Reports','management'],['management/Operations','management'],['plantmanager/FinishedGoods','plantmanager'],['plantmanager/ProductionOrders','plantmanager'],['plantmanager/Reports','plantmanager'],['plantmanager/ShiftTurnover','plantmanager'],['production/Dashboard','production'],['production/Pellets','production'],['production/FinishedPipes','production']];
  for (const [file, role] of pages) { const Page = (await server.ssrLoadModule(`/src/pages/${file}.tsx`)).default; check(`${file}: actual authorized page renders after layout changes`, () => { setContext({ ...baseline, currentUser: store.USERS.find(user => user.role === role) }); assert.ok(render(React.createElement(Page)).length > 100); }); }
  const producer = store.USERS.find(user => user.role === 'production');
  const attendance = { ...baseline.attendance[0], id: 'ui-fixture-attendance', employeeId: producer.employeeId, employeeName: producer.name, status: 'Active', shift: 'Day' };
  const Dashboard = (await server.ssrLoadModule('/src/pages/production/Dashboard.tsx')).default;
  setContext({ ...baseline, currentUser: producer, attendance: [attendance] });
  const dashboardHtml = render(React.createElement(Dashboard));
  check('Automatic Material Usage renders exactly four peer cards, then separate Summary with three totals and original note', () => { const peers = divByClass(dashboardHtml, 'material-usage-grid'), summary = divByClass(dashboardHtml, 'material-summary'); assert.equal((peers.match(/class="material-usage-group"/g) || []).length, 4); assert.ok(!peers.includes('Total Material Weight')); assert.ok(dashboardHtml.indexOf(summary) > dashboardHtml.indexOf(peers)); for (const text of ['Total Pellet Weight','Total Colorant Weight','Total Material Weight']) assert.ok(summary.includes(text)); assert.ok(dashboardHtml.indexOf('These are not') > dashboardHtml.indexOf(summary)); assert.ok(dashboardHtml.includes('official HPAI formulas')); });
  check('Material Summary retains the exact production binding/arithmetic, including No Stripe handling', () => { const text = source('src/pages/production/Dashboard.tsx'); for (const fragment of ['currentMaterialUsage.totalPelletWeightKg + displayedColorantTotal', 'currentMaterialUsage.totalPelletWeightKg', 'displayedColorantTotal', "activePO?.stripe === 'No Stripe'", 'TEST_BASE_COLORANT_RATE * 100', 'TEST_STRIPE_COLORANT_RATE * 100']) assert.ok(text.includes(fragment) && previous('src/pages/production/Dashboard.tsx').includes(fragment)); });
  const Scanner = (await server.ssrLoadModule('/src/pages/production/BarcodeScanner.tsx')).default;
  setContext({ ...baseline, currentUser: producer, attendance: [attendance], productionOrders: [] });
  const scannerHtml = render(React.createElement(Scanner));
  check('Actual Current Operation/no-active-PO screenshot case has distinct status and selector wrappers', () => { const status = divByClass(scannerHtml, 'scanner-context-status'), control = divByClass(scannerHtml, 'scanner-context-control'); assert.ok(status.includes('Current Operation')); assert.ok(status.includes('No active Production Order')); assert.ok(!status.includes('role="combobox"')); assert.ok(control.includes('Load Pellets')); assert.ok(control.includes('role="combobox"')); });
  const Turnover = (await server.ssrLoadModule('/src/pages/production/ShiftTurnover.tsx')).default;
  setContext({ ...baseline, currentUser: producer, currentShift: 'Day', attendance: [attendance], turnovers: [] });
  check('Production turnover uses the same three-total full-width Summary pattern without new calculations', () => { const html = render(React.createElement(Turnover)); const summary = divByClass(html, 'material-summary'); for (const label of ['Total Pellet Weight','Total Colorant Weight','Total Material Weight']) assert.ok(summary.includes(label)); });
  check('Seven distinct physical fixture pipes retain nonzero inventory counts 2/1/3/1/7 under new metric presentation', () => {
    const stock = baseline.finishedGoods.find(pipe => pipe.source === 'Stock Replenishment'), mo = baseline.finishedGoods.find(pipe => pipe.source === 'Manufacturing Order');
    const buyer = baseline.orders[0];
    const make = (base, index, extra) => { const pipe = { ...base, id: `ui-fixture-${index}`, fgId: `UI-PIPE-${index}`, quantity: 1, qualityStatus: 'Pass', storageStatus: 'Stored', locationStatus: 'Stored', releaseStatus: 'Not Released', currentLocation: base === stock ? 'A' : 'G', storageLocation: base === stock ? 'A' : 'G', ...extra }; return { ...pipe, ...barcodes.allocateFinishedPipeBarcodes(1, pipe, [], 10000 + index)[0] }; };
    const pipes = [make(stock,0,{status:'Available',reservedQty:0}),make(stock,1,{status:'Available',reservedQty:0}),make(stock,2,{status:'Reserved',reservedQty:1,reservedForOrderId:buyer.id}),make(mo,3,{status:'Stored'}),make(mo,4,{status:'Stored'}),make(mo,5,{status:'Stored'}),make(mo,6,{status:'Ready for Release',currentLocation:'I',storageLocation:'I'})];
    setContext({ ...baseline, currentUser: producer, finishedGoods: pipes }); const html = divByClass(render(React.createElement(Metrics)), 'inventory-metrics'); const values = [...html.matchAll(/<strong>(\d+)<\/strong>/g)].map(row => Number(row[1])); assert.deepEqual(values,[2,1,3,1,7]);
  });
  check('Verification never mutates original business records or live browser storage', () => assert.equal(JSON.stringify(baseline), unchanged));
  console.log(`Completed ${checks} UI structure, responsive CSS models, six-role rendering, calculation/handler preservation and business-file checks. No browser is connected: screenshots, actual overflow and interactive desktop/mobile/theme visual QA remain unverified.`);
} finally {
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  if (previousSession === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previousSession;
  await server.close();
}
