import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { LAYOUT_LOCK_BASELINE, reviewedLayoutLockDeltas, layoutLockBaseline, restoreLayoutLockFile } from './layout-lock-baseline.mjs';

let checks = 0;
const check = (label, fn) => { fn(); checks++; console.log('PASS ' + label); };
const raw = file => fs.readFileSync(file, 'utf8').replace(/\r/g, '');
const printer = ts.createPrinter({ removeComments: true });
function nonPresentation(text) {
  const ast = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = ts.transform(ast, [context => {
    const visit = node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)
      ? ts.factory.createIdentifier('UNCHANGED_PRESENTATION_BOUNDARY') : ts.visitEachChild(node, visit, context);
    return source => ts.visitNode(source, visit);
  }]);
  const printed = printer.printFile(result.transformed[0]);result.dispose();return printed;
}
function actions(text) {
  const ast = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), result = [];
  const visit = node => {
    if (ts.isCallExpression(node) && /^(navigate|login|setTheme|create|approve|reject|record|receive|load|release|clock|submit|confirm|reserve|relocate|print|complete)/.test(node.expression.getText(ast))) result.push(printer.printNode(ts.EmitHint.Unspecified, node, ast));
    ts.forEachChild(node, visit);
  };visit(ast);return result.sort();
}
for (const file of execFileSync('git', ['ls-tree','-r','--name-only',LAYOUT_LOCK_BASELINE,'src'], { encoding:'utf8' }).trim().split('\n').filter(file => /\.(tsx?|css)$/.test(file))) {
  check('Original source unchanged or exact reviewed presentation delta: ' + file, () => {
    assert.equal(restoreLayoutLockFile(file, raw(file)), layoutLockBaseline(file));
    if (reviewedLayoutLockDeltas[file]) assert.throws(() => restoreLayoutLockFile(file, raw(file) + '\n/* unexpected */'));
  });
  if (reviewedLayoutLockDeltas[file] && file.endsWith('.tsx')) {
    check('All non-JSX logic, state and calculations are byte-equivalent after printing: ' + file, () => assert.equal(nonPresentation(raw(file)), nonPresentation(layoutLockBaseline(file))));
    check('Original business actions and navigation arguments are unchanged: ' + file, () => assert.deepEqual(actions(raw(file)), actions(layoutLockBaseline(file))));
  }
}
check('Existing date/location/filter/master/hydration/barcode/RBAC engines are not edited', () => {
  for (const file of ['src/components/PeriodSelector.tsx','src/components/InventoryFacetFields.tsx','src/components/ProductFilters.tsx','src/components/MaterialLocationFilters.tsx','src/datePeriods.ts','src/inventoryFacets.ts','src/productFilters.ts','src/productMaster.ts','src/locationMaster.ts','src/store.tsx','src/finishedGoodsInventory.ts','src/finishedPipeRelations.ts','src/finishedPipeBarcodes.ts','src/reprintWorkflow.ts','src/App.tsx','src/components/Sidebar.tsx','src/uiViewState.tsx','src/components/Modal.tsx','src/uiSubmission.ts']) assert.equal(raw(file),layoutLockBaseline(file),file);
});
check('Original stylesheet remains an exact prefix; all new rules are scoped layout overrides', () => {
  const before=layoutLockBaseline('src/index.css'),current=raw('src/index.css');assert.ok(current.startsWith(before));
  const added=current.slice(before.length);assert.match(added,/Final layout lock/);assert.match(added,/width: 100%/);assert.match(added,/grid-column: 1 \/ -1/);
  assert.doesNotMatch(added,/localStorage|setState|fetch\(|supabase|display:\s*none|\*\s*\{|body\s*\{|height:\s*\d{3,}px/);
  assert.match(added,/overflow-wrap: normal/);assert.match(added,/date-all-summary/);
});
check('Only the redundant System Access notice is removed; Login validation/auth remains intact', () => {
  assert.match(layoutLockBaseline('src/pages/Login.tsx'),/SYSTEM ACCESS/);assert.doesNotMatch(raw('src/pages/Login.tsx'),/SYSTEM ACCESS|Unauthorized access is prohibited/);
  assert.match(raw('src/pages/Login.tsx'),/const result = login\(username, password\)/);assert.match(raw('src/pages/Login.tsx'),/Username and password are required/);
});
check('Four existing Quick Action groups share balanced grid classes, without changing their buttons', () => {
  for(const role of ['accounting','marketing','plantmanager','production']){
    const file='src/pages/'+role+'/Dashboard.tsx',before=layoutLockBaseline(file),current=raw(file);
    assert.match(current,/quick-actions/);assert.match(current,/quick-action-grid/);
    assert.deepEqual([...current.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(match=>match[0]),[...before.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(match=>match[0]));
  }
});
console.log('Completed '+checks+' layout-lock source, unchanged-logic, authentication, action and scoped-CSS checks. Full-shell responsive behavior is verified separately in the browser.');
