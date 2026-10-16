import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { SUMMARY_COLORS_BASELINE, reviewedSummaryColorsDeltas, reviewedSummaryColorsAdditions, summaryColorsBaseline, restoreSummaryColorsFile } from './summary-colors-baseline.mjs';

let checks = 0;
const check = (label, fn) => { fn(); checks++; console.log('PASS ' + label); };
const raw = file => fs.readFileSync(file, 'utf8').replace(/\r/g, '');
for(const[file,digest]of Object.entries(reviewedSummaryColorsAdditions))check('Exact reviewed new module, independently exercised below: '+file,()=>{
  assert.equal(createHash('sha256').update(raw(file)).digest('hex'),digest);
  assert.doesNotMatch(raw(file),/localStorage|setState|Math\.random|fetch\(|supabase/);
});
for (const file of execFileSync('git', ['ls-tree','-r','--name-only',SUMMARY_COLORS_BASELINE,'src'], { encoding:'utf8' }).trim().split('\n').filter(file=>/\.(tsx?|css)$/.test(file))) {
  check('Original source unchanged or exact reviewed summary/color delta: ' + file, () => {
    assert.equal(restoreSummaryColorsFile(file, raw(file)), summaryColorsBaseline(file));
    if (reviewedSummaryColorsDeltas[file]) assert.throws(() => restoreSummaryColorsFile(file, raw(file) + '\n// unexpected'), /Unreviewed summary\/color delta/);
  });
}
function callbacks(source) {
  const ast = ts.createSourceFile('store.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), items = [];
  const visit = node => { if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useCallback') items.push(node.getText(ast)); ts.forEachChild(node, visit); };
  visit(ast);return items;
}
check('Every business callback is identical except explicit pellet color normalization/blank validation', () => {
  const normalized = raw('src/store.tsx')
    .replace("      if (data.pelletType === 'Recycled' && !data.color.trim()) return s;\n", '')
    .replace('color: pelletColor(data.pelletType, data.color),\n        batchNo,', 'color: data.color,\n        batchNo,')
    .replace("    if (category === 'Recycled Pellet' && !req.color.trim()) return { success: false, error: 'Enter the recycled pellet color.' };\n", '')
    .replace("pelletDocumentColor({ ...req, grade: category === 'Colorant' ? req.grade : normalizeMaterialGrade(req.grade), id })", "{ ...req, grade: category === 'Colorant' ? req.grade : normalizeMaterialGrade(req.grade), id }");
  assert.deepEqual(callbacks(normalized), callbacks(summaryColorsBaseline('src/store.tsx')));
});
check('Inventory, stock movements, pipe identity, product master and authorization engines remain byte-identical', () => {
  for (const file of ['src/finishedGoodsInventory.ts','src/finishedPipeBarcodes.ts','src/reprintWorkflow.ts','src/finishedPipeRelations.ts','src/productMaster.ts','src/locationMaster.ts','src/inventoryFacets.ts','src/App.tsx','src/components/Sidebar.tsx']) assert.equal(raw(file), summaryColorsBaseline(file), file);
});

const server = await createServer({ server:{middlewareMode:true,hmr:false},appType:'custom' });
const oldWindow=globalThis.window,oldSession=globalThis.sessionStorage;
try {
  const colors=await server.ssrLoadModule('/src/pelletColors.ts');
  const facets=await server.ssrLoadModule('/src/inventoryFacets.ts');
  const filters=await server.ssrLoadModule('/src/productFilters.ts');
  const search=await server.ssrLoadModule('/src/components/RecordSearch.tsx');
  const inventory=await server.ssrLoadModule('/src/finishedGoodsInventory.ts');
  const store=await server.ssrLoadModule('/src/store.tsx');
  const memory=new Map(),writes=[];
  globalThis.window={localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>{writes.push(key);memory.set(key,value);}},sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},location:{hostname:'test.invalid'}};
  globalThis.sessionStorage=window.sessionStorage;
  let captured;
  function Capture(){captured=store.useApp();return null;}
  const render=page=>renderToStaticMarkup(React.createElement(store.AppProvider,null,React.createElement(Capture),page));
  render();const baseline=JSON.parse(JSON.stringify(captured));
  const load=state=>{memory.set('hpai:shared-app-state-v1',JSON.stringify(state));render();return JSON.parse(JSON.stringify(captured));};
  check('Fresh Virgin seed bags and associated paperwork are White',()=>{
    assert.ok(baseline.pellets.filter(bag=>bag.type==='Virgin').every(bag=>bag.color==='White'));
    for(const key of ['rrRecords','materialRequests','transfers'])assert.ok(baseline[key].filter(row=>row.pelletType==='Virgin'&&row.materialCategory!=='Colorant').every(row=>row.color==='White'));
  });
  check('Fresh Recycled seed has Black/Blue/Green/Mixed with exactly the same forty bags and 1000 kg',()=>{
    const bags=baseline.pellets.filter(bag=>bag.type==='Recycled');
    assert.equal(bags.length,40);assert.equal(bags.reduce((sum,bag)=>sum+bag.availableKg,0),1000);
    assert.deepEqual([...new Set(bags.map(bag=>bag.color))],['Black','Blue','Green','Mixed']);
  });
  for(const color of ['Black','Blue','Green','Mixed','White','Custom recycled amber']){
    check('Preserve actual Recycled color: '+color,()=>assert.equal(colors.pelletColor('Recycled',color),color));
    check('Virgin always White, independent of pipe/colorant color: '+color,()=>assert.equal(colors.pelletColor('Virgin',color),'White'));
  }
  const modified=structuredClone(baseline);
  modified.pellets=[baseline.pellets[0],...baseline.pellets.filter(bag=>bag.type==='Recycled').slice(0,3)].map((bag,index)=>({...bag,color:['Black (BK)','Custom amber','','White'][index],availableKg:[3.75,12.5,0,25][index],currentLocation:'D',batchNo:'USER-BATCH',recyclingBatchRef:undefined}));
  modified.pellets.forEach(bag=>delete bag.recyclingBatchRef);
  modified.pellets.push({...baseline.pellets.filter(bag=>bag.type==='Recycled')[3],color:''});
  const restored=load(modified);
  check('Saved user colors preserved; unknown recycled color honest, no White/Mixed guessing',()=>assert.deepEqual(restored.pellets.map(bag=>bag.color),['White','Custom amber','Not specified','White','Black']));
  check('Hydration changes only pellet color metadata; no quantities, IDs, labels, histories or unrelated collections',()=>{
    for(let i=0;i<modified.pellets.length;i++){const {color:before,...a}=modified.pellets[i],{color:after,...b}=restored.pellets[i];assert.deepEqual(b,a);}
    for(const key of ['finishedGoods','orders','manufacturingOrders','productionOrders','transactions','auditLogs','attendance','turnovers','colorants','rejectedMaterials','recyclingBatches'])assert.deepEqual(restored[key],modified[key],key);
    const registryIdentity=items=>items.map(({createdAt,...identity})=>identity);
    assert.deepEqual(registryIdentity(restored.barcodeRegistry),registryIdentity(modified.barcodeRegistry),'barcode registry identities; existing hydration refreshes registry timestamps');
  });
  check('Repeated reload idempotent; empty collections never reseeded',()=>{
    const withoutRegistryTime=state=>({...state,barcodeRegistry:state.barcodeRegistry.map(({createdAt,...identity})=>identity)});
    assert.deepEqual(withoutRegistryTime(load(restored)),withoutRegistryTime(restored));
    const empty=load({...baseline,pellets:[],finishedGoods:[],rrRecords:[],materialRequests:[],transfers:[]});
    for(const key of ['pellets','finishedGoods','rrRecords','materialRequests','transfers'])assert.deepEqual(empty[key],[]);
  });
  check('Colorants retain actual colors and all other document fields',()=>{
    const record={pelletType:'Virgin',materialCategory:'Colorant',color:'Blue',grade:'PE100',quantity:13};
    assert.equal(colors.pelletDocumentColor(record),record);
  });
  for(const color of ['White','Black','Blue','Green','Mixed','Custom amber','Not specified'])check('Search and filters agree on normalized pellet color: '+color,()=>{
    const record={type:color==='White'?'Virgin':'Recycled',color,availableKg:25,currentLocation:'D'};
    assert.ok(search.matchesRecord(record,color));assert.ok(filters.matchesInventoryColor(record.color,color));
    assert.ok(facets.matchesFacets(facets.inventoryFacetRow(record),{color}));
    assert.ok(colors.materialColorOptions([record]).includes(color));
  });
  check('Zero-stock master pellet colors include White and non-White without altering pipe master',()=>{
    assert.ok(colors.materialColorOptions([]).includes('White'));assert.ok(colors.materialColorOptions([]).includes('Green'));
    assert.equal(raw('src/productMaster.ts'),summaryColorsBaseline('src/productMaster.ts'));
  });
  const counts=inventory.finishedGoodsSummary(baseline.finishedGoods,baseline);
  check('Physical On Hand reconciles exactly with all seven mutually exclusive buckets',()=>{
    assert.equal(counts.onHand,counts.available+counts.reserved+counts.temporary+counts.ready+counts.awaiting+counts.qualityPending+counts.rejected);
    assert.equal(counts.onHand,6);
    assert.deepEqual(inventory.finishedGoodsSummary([...baseline.finishedGoods,...baseline.finishedGoods],baseline),counts);
  });
  const Summary=(await server.ssrLoadModule('/src/components/FinishedGoodsMetrics.tsx')).default;
  for(const user of store.USERS)check('Shared summary/help is consistent for '+user.role,()=>{
    load({...baseline,currentUser:user});const html=render(React.createElement(Summary));
    assert.equal((html.match(/class="metric-help-trigger"/g)||[]).length,5);
    assert.equal((html.match(/popover="auto"/g)||[]).length,5);
    assert.match(html,/On Hand breakdown/);assert.match(html,/Quality Pending/);assert.match(html,/Held Rejected/);
  });
  check('No SSR startup storage writes or wipe',()=>assert.deepEqual(writes,[]));
  console.log('Completed '+checks+' summary/color metadata, safety, unchanged-business-logic and six-role checks.');
}finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldSession===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=oldSession;await server.close();}
