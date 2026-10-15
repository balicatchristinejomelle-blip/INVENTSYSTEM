import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { SMART_INVENTORY_BASELINE, SMART_INVENTORY_NEW_FILES, reviewedSmartInventoryDeltas, smartInventoryBaseline, restoreSmartInventoryFile } from './smart-inventory-baseline.mjs';
import { restoreRecoveryFile } from './recovery-baseline.mjs';

let checks = 0;
const check = (label, run) => { run(); checks++; console.log('PASS ' + label); };
const raw = file => fs.readFileSync(file, 'utf8').replace(/\r/g, '');
const tree = text => ts.createSourceFile('view.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const printer = ts.createPrinter({ removeComments: true });
function actionCalls(text) {
  const source = tree(text), calls = [];
  const walk = node => {
    if (ts.isCallExpression(node) && /^(create(?!Context|Element)|recordOutput|reserve|loadPellet|releaseFinished|receivePellet|rejectFinished|approve|confirmTransfer|completeRecycling|clock|submitTurnover|updateFinished|relocate|acceptTurnover|printBarcode)/.test(node.expression.getText(source).split('.').at(-1))) calls.push(printer.printNode(ts.EmitHint.Unspecified, node, source));
    ts.forEachChild(node, walk);
  }; walk(source); return calls.sort();
}
function functionBody(text, name) { const source = tree(text); return source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)?.body?.getText(source); }
const files = execFileSync('git', ['ls-tree','-r','--name-only',SMART_INVENTORY_BASELINE,'src'], { encoding:'utf8' }).trim().split('\n').filter(file=>/\.(tsx?|css)$/.test(file));
for (const file of files) {
  const current = restoreRecoveryFile(file, raw(file)), before = smartInventoryBaseline(file);
  check('Existing source unchanged or exact reviewed filter/presentation delta: ' + file, () => {
    if (current === before) assert.equal(current,before);
    else { assert.ok(reviewedSmartInventoryDeltas[file],file); assert.equal(restoreSmartInventoryFile(file,current),before); assert.throws(()=>restoreSmartInventoryFile(file,current+'\n// unexpected')); }
  });
  if (/\.(tsx?|ts)$/.test(file) && current !== before) check('Original business action arguments retained: '+file,()=>assert.deepEqual(actionCalls(current),actionCalls(before)));
}
check('Master-based creation/zero-stock selector body retained exactly',()=>assert.equal(functionBody(raw('src/components/ProductFilters.tsx'),'MasterProductFilters'),functionBody(smartInventoryBaseline('src/components/ProductFilters.tsx'),'ProductFilters')));
for(const file of SMART_INVENTORY_NEW_FILES) check('New facet module has no business writes: '+file,()=>assert.doesNotMatch(raw(file),/localStorage|Math\.random|Stock In|Stock Out|\.clear\(|fetch\(|supabase|createReceivingReport|updateFinishedGoodStorage/));

const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const oldWindow=globalThis.window,oldSession=globalThis.sessionStorage;
try {
  const facets=await server.ssrLoadModule('/src/inventoryFacets.ts');
  const dates=await server.ssrLoadModule('/src/datePeriods.ts');
  const physical=['A','B','C','D','E','F','G','H','I'];
  const fixture=(location,extra={})=>facets.inventoryFacetRow({product:'HDPE Pipe',grade:'PE100',color:'Black (BK)',diameter:'20mm',sdr:'SDR11',currentLocation:location,status:'Available',...extra},{purpose:'Inventory Storage'});
  const rows=[fixture('A'),fixture('C'),fixture('F'),fixture('H',{grade:'PE80',sdr:'SDR17',diameter:'25mm',color:'Blue'})];
  const snapshot=JSON.stringify(rows);
  for(const [key,value]of Object.entries({product:'HDPE Pipe',grade:'PE100',color:'Black',size:'20mm',sdr:'SDR11',location:'C',purpose:'Inventory Storage',status:'Available'})) check('Any filter can be chosen first without inference: '+key,()=>{
    const selected={[key]:value},before=structuredClone(selected);
    const result=facets.resolveInventoryLocations(rows,selected,physical);
    assert.deepEqual(selected,before);assert.deepEqual(Object.keys(result).sort(),['label','location','options']);
  });
  check('SDR11 first narrows actual locations A/C/F without guessing',()=>{
    const result=facets.resolveInventoryLocations(rows,{sdr:'SDR11'},physical);
    assert.deepEqual(result.options,['A','C','F']); assert.equal(result.location,'');
  });
  check('A unique remaining location auto-selects',()=>assert.equal(facets.resolveInventoryLocations([rows[1]],{sdr:'SDR11'},physical).location,'C'));
  check('Newest SDR wins and incompatible old location resets',()=>{
    const result=facets.resolveInventoryLocations([fixture('A',{sdr:'SDR17'}),fixture('C'),fixture('F')],{location:'A',sdr:'SDR11'},physical);
    assert.equal(result.location,'');assert.deepEqual(result.options,['C','F']);
  });
  check('Impossible old location becomes unique current C',()=>assert.equal(facets.resolveInventoryLocations([fixture('A',{sdr:'SDR17'}),fixture('C')],{location:'A',sdr:'SDR11'},physical).location,'C'));
  check('No matches clears only Location and invents no options',()=>{const selected={location:'A',sdr:'SDR11'},result=facets.resolveInventoryLocations([],selected,physical);assert.equal(result.location,'');assert.deepEqual(result.options,[]);assert.equal(selected.sdr,'SDR11');assert.equal(result.label,'No Matching Locations');});
  check('Positive multi-location balances remain multiple, not one master location',()=>assert.deepEqual(facets.inventoryFacetRow({locationBalances:{A:0,C:10,F:3},currentLocation:'A'}).location,['C','F']));
  check('No specification constraint restores the full Location master, without auto-selection',()=>assert.deepEqual(facets.resolveInventoryLocations([rows[0]],{},physical),{location:'',options:physical,label:'All Locations'}));
  check('Location first never infers Product, Grade, SDR or Color',()=>{const selected={location:'H'};facets.resolveInventoryLocations(rows,selected,physical);assert.deepEqual(selected,{location:'H'});});
  check('Matching inventory stays caller-scoped; no hidden locations or writes',()=>{const result=facets.resolveInventoryLocations([rows[0]],{sdr:'SDR11'},physical);assert.deepEqual(result.options,['A']);assert.equal(JSON.stringify(rows),snapshot);});
  for(const [scope,anchor,previous,next]of [
    ['day','2026-10-15','2026-10-14','2026-10-16'],['week','2026-10-15','2026-10-08','2026-10-22'],
    ['month','2027-01-31','2026-12-31','2027-02-28'],['year','2024-02-29','2023-02-28','2025-02-28'],
  ])check('Calendar Previous/Next and anchor preservation: '+scope,()=>{assert.equal(dates.shiftPeriodAnchor(anchor,scope,-1),previous);assert.equal(dates.shiftPeriodAnchor(anchor,scope,1),next);});
  check('Week navigation keeps Monday-Sunday boundaries',()=>{const range=dates.periodRange('week',dates.shiftPeriodAnchor('2026-10-15','week',-1));assert.equal(range.start,'2026-10-05');assert.equal(range.end,'2026-10-11');});
  check('Specific date overrides anchor; references never become dates',()=>{assert.equal(dates.effectiveDateRange('month','10/08/2026','2026-12-31').start,'2026-10-08');for(const ref of ['PO-2026-0072','MO-2026-0045','BATCH-2026-0031','RR-2026-0015'])assert.equal(dates.parseSpecificDate(ref),null);});
  const store=await server.ssrLoadModule('/src/store.tsx'),view=await server.ssrLoadModule('/src/uiViewState.tsx');
  const local=new Map(),session=new Map();let captured;
  globalThis.window={localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value)},sessionStorage:{getItem:key=>session.get(key)??null,setItem:(key,value)=>session.set(key,value),removeItem:key=>session.delete(key)},location:{hostname:'test.invalid'}};
  globalThis.sessionStorage=window.sessionStorage;
  function Capture(){captured=store.useApp();return null;}
  const render=child=>renderToStaticMarkup(React.createElement(store.AppProvider,null,React.createElement(Capture),React.createElement(view.ViewStateScope,null,React.createElement('main',{className:'operational-content'},child))));
  render(null);const baseline=JSON.parse(JSON.stringify(captured));
  const cases={
    OWNER_SUPER_ADMIN:[['owner/Records',{'owner/Records:area':'Inventory & Finished Goods','owner/Records:section':'Finished Pipes'}],['owner/Records',{'owner/Records:area':'Inventory & Finished Goods','owner/Records:section':'Pellet Inventory'}],['owner/Reports',{}]],
    accounting:[['accounting/RawMaterials',{}],['accounting/RawMaterials',{'accounting/RawMaterials:category':'Colorants'}],['accounting/RRRecords',{}],['accounting/Transactions',{}],['accounting/Transfers',{}],['accounting/Reports',{}]],
    marketing:[...['Stock Levels','By Batch','Individual Pipes'].map(mode=>['marketing/FinishedGoods',{'marketing/FinishedGoods:viewMode':mode,'marketing/FinishedGoods:status':'All Statuses'}]),['marketing/Orders',{}],['marketing/Reports',{}]],
    management:[...['inventory','production','orders','attendance'].map(tab=>['management/Operations',{'management/Operations:tab':tab}]),['management/Reports',{}],['management/AuditLogs',{}]],
    plantmanager:[...['Stock Levels','By Batch','Individual Pipes'].map(mode=>['plantmanager/FinishedGoods',{'plantmanager/FinishedGoods:viewMode':mode}]),...['Virgin Pellets','Recycled Pellets','Colorants'].map(category=>['plantmanager/PelletInventory',{'plantmanager/PelletInventory:category':category}]),...['Material Inventory','Finished Goods','Production','Material Usage','Recycling'].map(report=>['plantmanager/Reports',{'plantmanager/Reports:report':report}]),['plantmanager/Attendance',{}],['plantmanager/ShiftTurnover',{}]],
    production:[['production/FinishedPipes',{'production/FinishedPipes:activeTab':'All Statuses'}],['production/Pellets',{}],['production/Pellets',{'production/Pellets:category':'Colorants'}],['production/ProductionOrders',{}],...['My Attendance','My Production','My Turnovers','My Barcode Activity','My Quality Records','My Recycling Activity'].map(tab=>['production/History',{'production/History:tab':tab}])],
  };
  for(const [role,variants]of Object.entries(cases))for(const [file,prefs]of variants){
    const user=store.USERS.find(user=>user.role===role);session.clear();
    local.set('hpai:shared-app-state-v1',JSON.stringify({...baseline,currentUser:user,currentPage:'smart-qa'}));
    for(const [name,value]of Object.entries(prefs))session.set(view.VIEW_STATE_PREFIX+user.employeeId+':'+role+':smart-qa:'+name,JSON.stringify(value));
    const Page=(await server.ssrLoadModule('/src/pages/'+file+'.tsx')).default;
    const html=render(React.createElement(Page));
    check(role+' / '+file+' / '+JSON.stringify(prefs)+': current page renders; populated table header/body mappings align',()=>{
      assert.equal(captured.currentUser.role,role);
      for(const [,table]of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/g)){
        const head=table.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1];if(!head)continue;
        const columns=[...head.matchAll(/<th\b/g)].length;
        for(const [,row]of (table.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)?.[1]||'').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
          if(/colSpan|colspan=|empty-state/.test(row))continue;
          assert.equal([...row.matchAll(/<td\b/g)].length,columns,file+' '+row.slice(0,140));
        }
      }
      assert.ok((html.match(/aria-label="Date period"/g)||[]).length<=1,'duplicate date controls');
      if(/FinishedGoods/.test(file)&&Object.values(prefs).includes('By Batch')){
        assert.match(html,/<th>Temporary Storage<\/th>/);assert.match(html,/<th>Ready for Ship Out<\/th>/);assert.match(html,/<th>On Hand<\/th>/);
        assert.doesNotMatch(html,/<td[^>]*>[^<]*<br\s*\/?><small>\d+ Temporary Storage/);
      }
    });
  }
  check('Inventory facet grid is separate from full-width removable Active Filters',()=>{const source=raw('src/components/InventoryFacetFields.tsx');assert.ok(source.indexOf('<ActiveFilters')<source.indexOf('className="inventory-facet-grid'));assert.match(source,/onRemove=/);assert.match(raw('src/smartInventory.css'),/repeat\(4, minmax\(0, 1fr\)\)/);});
  console.log('Completed '+checks+' smart-inventory, calendar-navigation, original-action, creation-selector, table-alignment and six-role variant checks. Responsive appearance requires separate browser QA.');
}finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldSession===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=oldSession;await server.close();}
