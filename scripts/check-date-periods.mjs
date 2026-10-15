import { restoreDatePeriodFile, reviewedDatePeriodDeltas } from './date-period-baseline.mjs';
import { restoreSmartInventoryFile } from './smart-inventory-baseline.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS ' + name); };
const raw = file => fs.readFileSync(file, 'utf8').replace(/\r/g, '');
const compiled = ts.transpileModule(raw('src/datePeriods.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dates = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const anchor = '2026-10-15';
check('Day is a Manila calendar day, not the last 24 hours', () => {
  assert.equal(dates.businessToday(new Date('2026-10-14T16:00:00Z')), anchor);
  assert.equal(dates.businessToday(new Date('2026-10-14T15:59:59Z')), '2026-10-14');
  const range = dates.periodRange('day', anchor);
  assert.ok(dates.dateInPeriod('2026-10-14T16:00:00Z', range));
  assert.ok(dates.dateInPeriod('2026-10-15T15:59:59Z', range));
  assert.ok(!dates.dateInPeriod('2026-10-15T16:00:00Z', range));
  assert.equal(dates.calendarDate('2026-10-15'), anchor);
  assert.equal(dates.calendarDate('2026-10-15 01:00:00'), anchor);
});
check('Week is Monday through Sunday, including across years', () => {
  assert.deepEqual(dates.periodRange('week', anchor), { start:'2026-10-12', end:'2026-10-18', label:'Week: Oct 12, 2026 – Oct 18, 2026' });
  assert.equal(dates.periodRange('week','2027-01-01').start,'2026-12-28');
  assert.equal(dates.periodRange('week','2027-01-01').end,'2027-01-03');
  assert.equal(dates.periodRange('week','2026-10-18').start,'2026-10-12');
});
check('Month respects actual calendar and leap-year boundaries', () => {
  assert.equal(dates.periodRange('month',anchor).start,'2026-10-01');
  assert.equal(dates.periodRange('month',anchor).end,'2026-10-31');
  assert.equal(dates.periodRange('month','2024-02-15').end,'2024-02-29');
  assert.equal(dates.periodRange('month','2026-02-15').end,'2026-02-28');
});
check('Year includes January 1 through December 31 only', () => {
  const range=dates.periodRange('year',anchor);
  assert.equal(range.start,'2026-01-01'); assert.equal(range.end,'2026-12-31');
  for(const value of ['2026-01-01','2026-12-31'])assert.ok(dates.dateInPeriod(value,range));
  for(const value of ['2025-12-31','2027-01-01',undefined,'invalid'])assert.ok(!dates.dateInPeriod(value,range));
});
for(const query of ['10/08/2026','2026-10-08','Oct 8, 2026','October 8, 2026','oCtObEr 08 2026'])check('Complete exact date: '+query,()=>{
  assert.equal(dates.parseSpecificDate(query),'2026-10-08');
  const range=dates.effectiveDateRange('month',query,'2026-11-15');
  assert.equal(range.start,'2026-10-08');assert.equal(range.end,'2026-10-08');
});
check('References, partial dates and invalid dates stay ordinary text searches',()=>{
 for(const query of ['PO-2026-0072','BATCH-2026-0031','2026','10/08','Feb 30, 2026','2026-02-29','2026-13-01','junk October 8, 2026','2026-10-08 extra'])assert.equal(dates.parseSpecificDate(query),null,query);
});
check('Clearing a specific date restores the selected broad period; All accepts undated records',()=>{
 assert.equal(dates.effectiveDateRange('month','10/08/2026',anchor).start,'2026-10-08');
 assert.equal(dates.effectiveDateRange('month','',anchor).start,'2026-10-01');
 assert.equal(dates.effectiveDateRange('all','',anchor).start,'');
 assert.ok(dates.dateInPeriod(undefined,dates.periodRange('all',anchor)));
});
check('Every temporal collection has an explicit primary date field',()=>{
 const expected={orders:'orderDate',manufacturingOrders:'createdDate',productionOrders:'requiredDate',finishedGoods:'productionDate',pellets:'receivedDate',colorants:'lastUpdated',transactions:'date',materialUsageTransactions:'dateTime',attendance:'date',turnovers:'date',rejectedMaterials:'date',recyclingBatches:'date',rrRecords:'date',transfers:'date',materialRequests:'date',auditLogs:'date',notifications:'datetime',reprintRequests:'requestedAt'};
 for(const [key,field]of Object.entries(expected))assert.equal(dates.COLLECTION_DATE_FIELDS[key][0],field);
});
check('Store, permissions, product masters, business types and inventory formulas remain byte-for-byte unchanged',()=>{
 for(const file of ['src/store.tsx','src/types.ts','src/productMaster.ts','src/productFilters.ts','src/finishedGoodsInventory.ts','src/locationMaster.ts','src/reprintWorkflow.ts','src/components/Sidebar.tsx','src/components/ProductFilters.tsx']){
  assert.equal(file === 'src/components/ProductFilters.tsx' ? restoreSmartInventoryFile(file, raw(file)) : raw(file),execFileSync('git',['show','079e1d3:'+file],{encoding:'utf8'}).replace(/\r/g,''),file);
 }
});
check('Legacy comparison guards accept only the exact reviewed date-filter update',()=>{
 const file='src/components/PeriodSelector.tsx';
 assert.ok(reviewedDatePeriodDeltas[file]);
 assert.equal(restoreDatePeriodFile(file,raw(file)),execFileSync('git',['show','079e1d3:'+file],{encoding:'utf8'}).replace(/\r/g,''));
 assert.throws(()=>restoreDatePeriodFile(file,raw(file)+'\n/* unexpected */'),/Unreviewed (date-period|smart-inventory) delta/);
});
check('Only business-entry date inputs remain',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(dir+'/'+entry.name):[dir+'/'+entry.name]);
 const fields=walk('src').filter(file=>/\.(tsx|ts)$/.test(file)).flatMap(file=>[...raw(file).matchAll(/<input\b[\s\S]*?\/>/g)].filter(match=>/type="date"/.test(match[0])).map(match=>[file,match[0]]));
 assert.equal(fields.length,3);
 for(const [file,field]of fields){assert.match(field,/requiredDate/);assert.ok(/marketing\/Orders|plantmanager\/ProductionOrders|plantmanager\/FinishedGoods/.test(file));}
});
check('Compact period styles wrap at all five requested mobile widths and use theme tokens',()=>{
 const css=raw('src/datePeriods.css');
 assert.match(css,/@media \(max-width: 480px\)/);
 assert.match(css,/repeat\(3, minmax\(0, 1fr\)\)/);
 assert.match(css,/focus-visible/);
 assert.match(css,/var\(--accent-blue\)/);
 for(const width of [360,375,390,412,430]){const available=Math.min(width-32,300);assert.ok((available-8)/3>=90);}
});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const oldWindow=globalThis.window,oldSession=globalThis.sessionStorage;
try{
 const store=await server.ssrLoadModule('/src/store.tsx');
 const view=await server.ssrLoadModule('/src/uiViewState.tsx');
 const periodModule=await server.ssrLoadModule('/src/components/PeriodSelector.tsx');
 const search=await server.ssrLoadModule('/src/components/RecordSearch.tsx');
 const product=await server.ssrLoadModule('/src/productFilters.ts');
 let captured;
 function Capture(){captured=store.useApp();return null;}
 const local=new Map(),session=new Map();
 globalThis.window={localStorage:{getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value)},sessionStorage:{getItem:key=>session.get(key)??null,setItem:(key,value)=>session.set(key,value),removeItem:key=>session.delete(key)},location:{hostname:'test.invalid'}};
 globalThis.sessionStorage=window.sessionStorage;
 const render=child=>renderToStaticMarkup(React.createElement(store.AppProvider,null,React.createElement(Capture),React.createElement(view.ViewStateScope,null,child)));
 render(null);
 const baseline=JSON.parse(JSON.stringify(captured));
 const unchanged=JSON.stringify(baseline);
 check('Existing page search normalizes dates without interpreting references as dates',()=>{
  for(const query of ['10/08/2026','2026-10-08','Oct 8, 2026','October 8, 2026'])assert.ok(search.matchesRecord({date:'2026-10-08',reference:'RR-2026-0072'},query));
  assert.ok(search.matchesRecord({date:anchor,reference:'PO-2026-0072'},'PO-2026-0072'));
  assert.ok(!search.matchesRecord({date:'2026-10-09',reference:'PO-2026-10-08'},'2026-10-08'));
 });
 check('Period and all product/grade/color/size/SDR/location conditions combine before pagination',()=>{
  const record={...baseline.finishedGoods[0],productionDate:'2026-10-08',product:'HDPE Pipe',grade:'PE100',diameter:'110mm',sdr:'SDR11',color:'Black (BK)',currentLocation:'C'};
  const filter={...product.emptyProductFilter,product:'HDPE Pipe',grade:'PE100',size:'110mm',sdr:'SDR11',color:'Black (BK)',location:'C'};
  const matches=item=>dates.dateInPeriod(item.productionDate,dates.periodRange('month',anchor))&&product.matchesProductFilter(item,filter,baseline);
  assert.ok(matches(record));
  assert.ok(!matches({...record,productionDate:'2026-09-30'}));
  for(const [key,value]of Object.entries({grade:'PE80',sdr:'SDR17',diameter:'315mm',currentLocation:'A'}))assert.ok(!matches({...record,[key]:value}),key);
 });
 const pageCases={
  OWNER_SUPER_ADMIN:['owner/Records','owner/Reports'],
  accounting:['accounting/RawMaterials','accounting/RRRecords','accounting/Transactions','accounting/Transfers','accounting/BranchRequests','accounting/Reports'],
  marketing:['marketing/Orders','marketing/FinishedGoods','marketing/MOTracking','marketing/Reports'],
  management:['management/AuditLogs','management/Operations','management/Reports','management/Dashboard'],
  plantmanager:['plantmanager/Attendance','plantmanager/ShiftTurnover','plantmanager/FinishedGoods','plantmanager/PelletInventory','plantmanager/ProductionOrders','plantmanager/MainPlantRequests','plantmanager/IncomingTransfers','plantmanager/MaterialUsage','plantmanager/RejectedRecycling','plantmanager/Reports'],
  production:['production/History','production/ProductionOrders','production/FinishedPipes','production/Pellets','production/Recycling'],
 };
 for(const [role,pages]of Object.entries(pageCases)){
  const user=store.USERS.find(user=>user.role===role);
  local.set('hpai:shared-app-state-v1',JSON.stringify({...baseline,currentUser:user,currentPage:'date-test'}));session.clear();
  for(const file of pages){const Page=(await server.ssrLoadModule('/src/pages/'+file+'.tsx')).default;check(role+' / '+file+': one period control, All/Day/Week/Month/Year, no filter calendar',()=>{
   const html=render(React.createElement(Page));
   assert.equal((html.match(/aria-label="Date period"/g)||[]).length,1,file);
   for(const label of ['All','Day','Week','Month','Year'])assert.ok(html.includes('>'+label+'</button>'),label);
   // Creation modals may render a requiredDate picker; filter calendars cannot survive.
   assert.ok(!html.includes('Date (optional)'));assert.ok(!html.includes('Specific Date (optional)'));assert.ok(!html.includes('Movement Date (optional)'));
   assert.equal(captured.currentUser.role,role);
  });}
  function PeriodProbe(){const period=periodModule.usePeriod('all');return React.createElement(periodModule.default,{period});}
  const key=view.VIEW_STATE_PREFIX+user.employeeId+':'+user.role+':date-test:date-period:v2';
  for(const scope of ['day','week','month','year']){session.set(key,JSON.stringify(scope));check(role+' restores selected '+scope+' scope',()=>{
   const html=render(React.createElement(PeriodProbe));assert.ok(html.includes('aria-pressed="true" class="date-period-button">'+scope[0].toUpperCase()+scope.slice(1)+'</button>'));
  });}
  const Wrapped=search.withRecordSearch(function Rows(){const app=search.useSearchableApp();return React.createElement('output',null,app.attendance.map(row=>row.id).join('|'));},['attendance']);
  const today=dates.businessToday(),historical='2026-10-08';
  const fixtures=[{...baseline.attendance[0],id:'today-row',date:today},{...baseline.attendance[0],id:'exact-row',date:historical}];
  local.set('hpai:shared-app-state-v1',JSON.stringify({...baseline,currentUser:user,currentPage:'date-test',attendance:fixtures}));
  session.set(key,JSON.stringify('day'));session.set(view.VIEW_STATE_PREFIX+user.employeeId+':'+user.role+':date-test:page-search',JSON.stringify('10/08/2026'));
  check(role+' exact date overrides Day through actual shared page search',()=>{
   const html=render(React.createElement(Wrapped));assert.ok(html.includes('exact-row'));if(today!==historical)assert.ok(!html.includes('today-row'));assert.ok(html.includes('Date: Oct 8, 2026'));
  });
  session.set(view.VIEW_STATE_PREFIX+user.employeeId+':'+user.role+':date-test:page-search',JSON.stringify(''));
  check(role+' clearing exact date returns to selected Day',()=>{const html=render(React.createElement(Wrapped));assert.ok(html.includes('today-row'));if(today!==historical)assert.ok(!html.includes('exact-row'));});
 }
 check('QA leaves original fixtures and inventory unchanged',()=>assert.equal(JSON.stringify(baseline),unchanged));
 console.log('Completed '+checks+' date-period, boundary, search, combined-filter, preservation and six-role rendering checks. Browser viewport and keyboard interactions require separate browser QA.');
}finally{
 if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
 if(oldSession===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=oldSession;
 await server.close();
}
