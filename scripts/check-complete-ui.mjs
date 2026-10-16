import { reviewedPelletMasterAdditions } from './pellet-master-baseline.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { COMPLETE_UI_BASELINE, completeUIBaseline, restoreCompleteUIFile } from './complete-ui-baseline.mjs';
import { restoreUXFile, UX_NEW_FILES } from './ux-baseline.mjs';
import { reviewedSummaryColorsAdditions } from './summary-colors-baseline.mjs';

const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve('vite/package.json'))('postcss');
const read = file => restoreUXFile(file, fs.readFileSync(file, 'utf8'));
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
const ast = text => ts.createSourceFile('view.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const jsx = node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
function normalized(node) {
  const result = ts.transform(node, [context => {
    const visit = item => {
      if (jsx(item)) return ts.factory.createIdentifier('PRESENTATION');
      // Optional visual caption API only; original props and function body remain compared.
      if (ts.isPropertySignature(item) && item.name.getText() === 'groupLabel') return undefined;
      if (ts.isBindingElement(item) && item.name.getText() === 'groupLabel') return undefined;
      return ts.visitEachChild(item, visit, context);
    };
    return root => ts.visitNode(root, visit);
  }]);
  const printed = ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, result.transformed[0], node.getSourceFile());
  result.dispose(); return printed.replace(/\s+/g, ' ').trim();
}
function bindings(text) {
  const tree = ast(text), values = [];
  const visit = node => {
    // Compare every existing operational prop, including callback bodies, control values,
    // options, disabled guards, counts, filters and render functions. Only visual props excluded.
    if (ts.isJsxAttribute(node) && !['className','style','groupLabel','role','aria-label'].includes(node.name.getText(tree))) {
      values.push(`${node.name.getText(tree)}=${node.initializer ? normalized(node.initializer) : ''}`);
    }
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent) && !/^groupLabel\b/.test(node.expression.getText(tree))) values.push(`child=${normalized(node.expression)}`);
    ts.forEachChild(node, visit);
  };
  visit(tree); return values.sort();
}
let count = 0;
const check = (label, fn) => { fn(); count++; console.log(`PASS ${label}`); };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const oldWindow = globalThis.window, oldSession = globalThis.sessionStorage;
try {
  // Audit all source files, not a hand-picked edit whitelist. Non-UI source is byte-guarded.
  for (const file of files('src').filter(file => /\.(ts|tsx)$/.test(file) && !UX_NEW_FILES.includes(file) && !reviewedSummaryColorsAdditions[file] && !reviewedPelletMasterAdditions[file])) {
    const current = read(file), baseline = completeUIBaseline(file);
    if (current === baseline) check(`Unchanged source: ${file}`, () => assert.equal(current, baseline));
    else {
      check(`No non-presentation code changed: ${file}`, () => assert.equal(normalized(ast(current)), normalized(ast(baseline))));
      check(`All runtime bindings, values and callbacks preserved: ${file}`, () => assert.deepEqual(bindings(current), bindings(baseline)));
    }
  }
  for (const file of ['src/index.css','src/components/PeriodSelector.tsx','src/components/ReprintApprovals.tsx']) {
    check(`Reviewed exact legacy-suite delta: ${file}`, () => assert.equal(restoreCompleteUIFile(file, read(file)), completeUIBaseline(file)));
    check(`Unreviewed source cannot bypass legacy guard: ${file}`, () => assert.throws(() => restoreCompleteUIFile(file, read(file) + '\n/* unexpected */')));
  }
  const css = read('src/index.css'), added = css.slice(css.indexOf('/* Complete UI audit:'));
  const rules = []; postcss.parse(added).walkRules(rule => rules.push(rule));
  const decl = rule => Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
  const has = (selector, prop, value, context) => rules.some(rule => rule.selector.includes(selector) && decl(rule)[prop] === value && (!context || rule.parent.params === context));
  check('Free-text fields are left aligned; no blanket card/input centering remains', () => {
    assert.ok(has('.app-input:not(.searchable-select)', 'text-align', 'left'));
    assert.ok(has('.operational-content .app-input:not(textarea)', 'min-height', '36px'));
    assert.ok(!css.includes('.app-input:not(textarea), .app-select'));
    assert.ok(!css.includes('.app-card:not(:has(.print-document)) { text-align: center; }'));
    assert.ok(css.includes('.record-search:not(.searchable-select), .operational-content'));
    assert.ok(has('.record-search:only-child', 'grid-template-columns', 'minmax(0, 1fr)'));
  });
  check('Eight combined filters use four equal columns, not separate six plus two grids', () => {
    assert.ok(has('.combined-product-filters:has(> .product-operational-filters)', 'grid-template-columns', 'repeat(4, minmax(0, 1fr))'));
    assert.ok(has('.combined-product-filters > :is(', 'display', 'contents'));
    assert.ok(has('.combined-product-filters > :is(', 'grid-column', 'auto'));
  });
  check('Nine combined fields including Length retain balanced three-column rows', () => assert.ok(has(':nth-child(7):last-child)', 'grid-template-columns', 'repeat(3, minmax(0, 1fr))')));
  check('Date labels and related filters have a compact wrapping group, not centered floating fields', () => {
    assert.ok(has('.record-filter-controls', 'display', 'flex'));
    assert.ok(has('.record-filter-controls', 'flex-wrap', 'wrap'));
    assert.ok(has('.record-filter-bar:not(:has(', 'width', 'fit-content'));
    assert.ok(has('.date-filter-field', 'gap', '4px'));
    assert.ok(has('.attendance-toolbar', 'align-items', 'end'));
  });
  check('Notices and tabs/chips use compact natural height and scoped overflow containment', () => {
    assert.ok(has('.alert-info', 'height', 'auto'));
    assert.ok(has('.alert-info', 'min-height', '0'));
    assert.ok(has('.category-tabs', 'overscroll-behavior-inline', 'contain'));
    assert.ok(has('.filter-chip-group', 'gap', '4px'));
  });
  check('Statistic label/value/subtext rows align without fixed title heights', () => {
    assert.ok(has('.statistic-card', 'grid-template-rows', 'subgrid'));
    assert.ok(has('.statistic-card > :nth-child(2)', 'grid-row', '2'));
    assert.ok(!/min-height:\s*\d+px/.test(added.slice(added.indexOf('.operational-content .statistic-card'), added.indexOf('.statistic-title'))));
  });
  check('Receiving form uses 3x3 fields with actions below; narrative audit values remain readable', () => {
    assert.ok(has('.receiving-form-grid', 'grid-template-columns', 'repeat(3, minmax(0, 1fr))'));
    assert.ok(has('.narrative-cell', 'text-align', 'left'));
    assert.ok(has('.narrative-cell', 'white-space', 'normal'));
  });
  for (const width of [360,375,390,412,430]) check(`${width}px CSS coverage: combined filters and forms stack, attendance shifts wrap`, () => {
    assert.ok(has('.combined-product-filters', 'grid-template-columns', 'minmax(0, 1fr)', '(max-width: 600px)'));
    assert.ok(has('.attendance-toolbar', 'flex-direction', 'column', '(max-width: 600px)'));
    assert.ok(has('.shift-filter-group button', 'min-height', 'var(--button-touch-height)', '(max-width: 600px)'));
  });
  check('Tablet/narrow desktop containers reflow combined filters to two columns', () => assert.ok(has('.combined-product-filters', 'grid-template-columns', 'repeat(2, minmax(0, 1fr))', '(max-width: 860px)')));
  check('No new fixed section heights, spacers, negative margins, absolute layout or theme colors', () => {
    assert.ok(!/position:\s*absolute|margin[^:]*:\s*-|(?:^|[;{])\s*height:\s*\d|#[\da-f]{3,8}\b|localStorage|setTheme/.test(added));
    assert.ok(!/\*\s*\{[^}]*text-align/.test(added));
  });

  const store = await server.ssrLoadModule('/src/store.tsx');
  let captured; function Capture() { captured = store.useApp(); return null; }
  renderToStaticMarkup(React.createElement(store.AppProvider, null, React.createElement(Capture)));
  const base = captured, snapshot = JSON.stringify(base);
  const localWrites = [];
  globalThis.window = { localStorage: { getItem: () => null, setItem: (...args) => localWrites.push(args) }, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, location: { hostname: 'test.invalid' } };
  globalThis.sessionStorage = window.sessionStorage;
  const roleMap = { owner:'OWNER_SUPER_ADMIN',accounting:'accounting',marketing:'marketing',management:'management',plantmanager:'plantmanager',production:'production' };
  const htmlByPage = new Map();
  for (const file of files('src/pages').filter(file => file.endsWith('.tsx'))) {
    const text = read(file), tree = ast(text), controls = [], layout = [];
    const audit = node => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(tree);
        if (/Filters|Selector|Tabs|Modal|Metrics|Cards|input|textarea|table|Searchable/.test(tag)) controls.push(tag);
      }
      if (ts.isPropertyAssignment(node) && /^(height|minHeight|gridTemplateColumns|marginBottom)$/.test(node.name.getText(tree))) layout.push(node.getText(tree));
      ts.forEachChild(node, audit);
    }; audit(tree);
    console.log(`AUDIT ${file}: controls=[${[...new Set(controls)].join(', ')}]; layout=[${[...new Set(layout)].join('; ')}]`);
    check(`Whole-page source audit covers controls, cards, notices, forms and layout: ${file}`, () => assert.equal(tree.parseDiagnostics.length, 0));
    const role = roleMap[file.split('/')[2]];
    if (!role) continue; // Shared/auth pages source-audited; role pages all rendered below.
    const user = store.USERS.find(user => user.role === role);
    const attendance = [{ ...base.attendance[0], employeeId: user.employeeId, employeeName: user.name, status: 'Active', shift: 'Day' }];
    const context = { ...base, currentUser: user, currentShift: 'Day', attendance, activeAttendance: attendance[0], activeProductionOrder: base.productionOrders.find(order => order.status === 'In Production') || base.productionOrders[0], turnovers: [], currentSessionTurnover: undefined, pendingTurnover: undefined };
    const Page = (await server.ssrLoadModule('/' + file)).default;
    check(`Authorized role-page render: ${file}`, () => {
      const html = renderToStaticMarkup(React.createElement(globalThis.__HPAI_APP_CONTEXT__.Provider, { value: context }, React.createElement(Page)));
      assert.ok(html.length > 100); htmlByPage.set(file, html);
    });
  }
  check('All six roles included in full source/render audit', () => {
    for (const folder of Object.keys(roleMap)) assert.ok([...htmlByPage.keys()].some(file => file.startsWith(`src/pages/${folder}/`)));
    assert.equal(htmlByPage.size, files('src/pages').filter(file => file.endsWith('.tsx') && roleMap[file.split('/')[2]]).length);
  });
  for (const file of ['src/pages/management/AuditLogs.tsx','src/pages/management/Settings.tsx']) {
    const Page = (await server.ssrLoadModule('/' + file)).default;
    check(`Owner-authorized shared route render: ${file}`, () => {
      const html = renderToStaticMarkup(React.createElement(globalThis.__HPAI_APP_CONTEXT__.Provider, { value:{...base,currentUser:store.USERS.find(user => user.role === 'OWNER_SUPER_ADMIN')} }, React.createElement(Page)));
      assert.ok(html.length > 100); assert.ok(!html.includes('Access Restricted'));
    });
  }
  for (const file of ['src/pages/Profile.tsx','src/pages/NotificationsPage.tsx']) {
    const Page = (await server.ssrLoadModule('/' + file)).default;
    for (const user of store.USERS) check(`${user.role}: shared page renders without changing role capabilities: ${file}`, () => {
      assert.ok(renderToStaticMarkup(React.createElement(globalThis.__HPAI_APP_CONTEXT__.Provider, { value:{...base,currentUser:user} }, React.createElement(Page))).length > 100);
    });
  }
  for (const role of ['marketing','plantmanager']) check(`${role}: actual finished goods render has eight inventory controls in the requested order`, () => {
    const html = htmlByPage.get(`src/pages/${role}/FinishedGoods.tsx`);
    const start = html.indexOf('class="inventory-facet-grid product-filter-controls"'), end = html.indexOf('class="category-tab-group"', start);
    const panel = html.slice(start, end);
    assert.ok(start > 0); assert.equal((panel.match(/role="combobox"/g) || []).length, 8);
    assert.ok(panel.includes('class="field-label">Status</span>'));
    assert.ok(panel.includes('class="field-label">Storage Purpose</span>'));
    const labels = [...panel.matchAll(/class="field-label">([^<]+)<\/span>/g)].map(match => match[1]);
    assert.deepEqual(labels.slice(0,8), ['Product','Material Grade','Color','Size / Diameter','SDR / Thickness','Location','Storage Purpose','Status']);
  });
  check('Attendance uses one period control, no duplicate calendars and all three shift choices', () => {
    const html = htmlByPage.get('src/pages/plantmanager/Attendance.tsx');
    assert.equal((html.match(/type="date"/g) || []).length, 0);
    assert.equal((html.match(/aria-label="Date period"/g) || []).length, 1);
    assert.ok(html.includes('class="attendance-toolbar"'));
    for (const label of ['Date period','Day','Week','Month','Year','Shift filter','All','Day Shift','Night Shift','View Only.']) assert.ok(html.includes(label));
  });
  const Tabs = (await server.ssrLoadModule('/src/components/CategoryTabs.tsx')).default;
  check('Chip caption is separate from navigation, preserving original selected tab/count semantics', () => {
    const html = renderToStaticMarkup(React.createElement(Tabs, { items:['All','PE80','PE100'],value:'PE80',counts:{All:5,PE80:2,PE100:3},onChange:()=>{},groupLabel:'Material Grade' }));
    assert.ok(html.includes('class="field-label">Material Grade</div>'));
    assert.equal((html.match(/role="tab"/g) || []).length, 3);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    assert.ok(html.includes('PE80<span>2</span>'));
  });
  const Period = (await server.ssrLoadModule('/src/components/PeriodSelector.tsx')).default;
  check('Selected period exposes compact controls and an accessible clear action', () => {
    const html = renderToStaticMarkup(React.createElement(Period, { period:{scope:'day',setScope:()=>{},exactDate:null,clearExact:()=>{},date:'',setDate:()=>{},range:{start:'2026-10-15',end:'2026-10-15',label:'Day: Oct 15, 2026'}},search:'example',onSearchChange:()=>{} }));
    assert.ok(html.includes('aria-label="Date period"'));
    assert.ok(html.includes('aria-pressed="true" class="date-period-button">Day</button>'));
    assert.ok(html.includes('aria-label="Clear period filter"')); assert.ok(!html.includes('type="date"'));
    assert.ok(html.includes('type="search"')); assert.ok(html.includes('class="date-period-buttons"'));
  });
  check('All source data and real localhost storage remain untouched by QA', () => { assert.equal(JSON.stringify(base), snapshot); assert.equal(localWrites.length, 0); });
  console.log(`Completed ${count} complete UI source, bindings, CSS and all-six-role rendering checks against ${COMPLETE_UI_BASELINE}. These are NOT browser screenshots or measured viewport/theme/keyboard/overflow tests.`);
} finally {
  if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
  if (oldSession === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = oldSession;
  await server.close();
}
