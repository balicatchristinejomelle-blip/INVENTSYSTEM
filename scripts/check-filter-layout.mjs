import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restoreProductionOutputFile } from './production-output-baseline.mjs';
import { FILTER_LAYOUT_BASELINE, reviewedFilterLayoutDeltas, reviewedFilterLayoutAdditions, restoreFilterLayoutFile } from './filter-layout-baseline.mjs';

let checks = 0;
const read = file => fs.readFileSync(file, 'utf8').replace(/\r/g, '');
const check = (label, run) => { run(); checks++; console.log('PASS ' + label); };
for (const file of Object.keys(reviewedFilterLayoutDeltas)) check('Only the exact reviewed layout delta is accepted: ' + file, () => {
  assert.equal(restoreFilterLayoutFile(file, read(file)), execFileSync('git', ['show', FILTER_LAYOUT_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  assert.throws(() => restoreFilterLayoutFile(file, read(file) + '\n/* unexpected */'), /Unreviewed filter-layout delta/);
});
for (const [file, hash] of Object.entries(reviewedFilterLayoutAdditions)) check('Exact scoped seven-filter styles: ' + file, () => assert.equal(createHash('sha256').update(read(file)).digest('hex'), hash));
for (const file of ['src/store.tsx', 'src/types.ts', 'src/productMaster.ts', 'src/productFilters.ts', 'src/locationMaster.ts', 'src/inventoryFacets.ts', 'src/finishedGoodsInventory.ts', 'src/finishedPipeBarcodes.ts', 'src/finishedPipeRelations.ts', 'src/datePeriods.ts', 'src/reprintWorkflow.ts', 'src/App.tsx', 'src/components/Sidebar.tsx', 'src/components/SearchableSelect.tsx', 'src/components/InventoryFacetFields.tsx', 'src/components/PeriodSelector.tsx', 'src/smartInventory.css']) check('Existing business logic/widget retained, including prior output fix: ' + file, () => {
  assert.equal(restoreProductionOutputFile(file, read(file)), execFileSync('git', ['show', FILTER_LAYOUT_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
});
check('New styles cannot read/write inventory, storage, masters or permissions', () => assert.doesNotMatch(read('src/sevenFilterLayout.css'), /localStorage|Math\.random|Stock In|Stock Out|fetch\(|supabase|\b(?:date-period|inventory-number|app-table|sidebar|kpi-grid)\b/));
check('Layout uses twelve tracks with 3/4 spans, genuine-width fallback and mobile stacking', () => {
  const css = read('src/sevenFilterLayout.css');
  for (const text of ['grid-column: 1 / -1', 'repeat(12, minmax(0, 1fr))', 'grid-column: span 3', 'grid-column: span 4', '@container (max-width: 759px)', '@media (max-width: 600px)', 'grid-template-columns: minmax(0, 1fr)']) assert.ok(css.includes(text), text);
  assert.doesNotMatch(css, /::before|::after|visibility:\s*hidden|opacity:\s*0|content:/);
});
check('All seven full reset labels and existing dropdown implementation are retained', () => {
  const source = read('src/components/ProductFilters.tsx');
  for (const text of ['All Products', 'All Material Grades', 'All Colors', 'All Sizes', 'All SDRs', 'All Locations', 'All Lengths']) assert.ok(source.includes(text), text);
  assert.ok(source.includes("import SearchableSelect from './SearchableSelect'"));
});
console.log(`Completed ${checks} filter-layout scope, unchanged-logic and preservation checks. Browser checks measure actual parents, text and rows separately.`);
