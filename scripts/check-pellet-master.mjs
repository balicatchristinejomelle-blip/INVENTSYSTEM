import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { PELLET_MASTER_BASELINE, reviewedPelletMasterDeltas, reviewedPelletMasterAdditions, pelletMasterBaseline, restorePelletMasterFile } from './pellet-master-baseline.mjs';
import { restoreProductionOutputFile } from './production-output-baseline.mjs';

let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const raw=file=>fs.readFileSync(file,'utf8').replace(/\r/g,'');
for(const file of execFileSync('git',['ls-tree','-r','--name-only',PELLET_MASTER_BASELINE,'src'],{encoding:'utf8'}).trim().split('\n').filter(file=>/\.(tsx?|css)$/.test(file)))check('Unchanged source or exact reviewed color-only delta: '+file,()=>{
  assert.equal(restorePelletMasterFile(file,raw(file)),pelletMasterBaseline(file));
  if(reviewedPelletMasterDeltas[file])assert.throws(()=>restorePelletMasterFile(file,raw(file)+'\n// unexpected'),/Unreviewed (pellet-master|production-output|filter-layout|process-flow) delta/);
});
for(const[file,hash]of Object.entries(reviewedPelletMasterAdditions))check('Exact shared creation selector: '+file,()=>assert.equal(createHash('sha256').update(raw(file)).digest('hex'),hash));
function declarations(text){
  const ast=ts.createSourceFile('store.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),result=new Map();
  const visit=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer)result.set(node.name.text,node.initializer.getText(ast));ts.forEachChild(node,visit);};visit(ast);return result;
}
const current=declarations(restoreProductionOutputFile('src/store.tsx',raw('src/store.tsx'))),before=declarations(pelletMasterBaseline('src/store.tsx'));
const colorCallbacks=['createReceivingReport','createTransfer','addMaterialRequest','completeRecyclingBatch'];
for(const[name,value]of current)if(value.startsWith('useCallback(')&&!colorCallbacks.includes(name))check('Business callback byte-identical: '+name,()=>assert.equal(value,before.get(name)));
function numericBindings(text){
  const ast=ts.createSourceFile('action.ts',text,ts.ScriptTarget.Latest,true),result=[];
  const visit=node=>{
    if((ts.isVariableDeclaration(node)||ts.isPropertyAssignment(node))&&node.initializer&&/^(?:.*(?:Kg|Qty)|qtyBefore|qtyChanged|qtyAfter|numberOfBags|weightPerBagKg|completeBags|recoveryRate|bagging|metrics|year|next|serial)$/.test(node.name.getText(ast))&&node.name.getText(ast)!=='carriedLooseKg')result.push(node.getText(ast));
    ts.forEachChild(node,visit);
  };visit(ast);return result;
}
for(const name of colorCallbacks)check('Existing weight, quantity, loss and sequence bindings unchanged: '+name,()=>assert.deepEqual(numericBindings(current.get(name)),numericBindings(before.get(name))));
for(const name of ['calculateRecycledBagging','calculateRecyclingMetrics','calculateProductionMaterialPlan','roundKg','nextAnnualSequence','carriedLooseKg'])check('Arithmetic/sequence helper unchanged: '+name,()=>assert.equal(current.get(name),before.get(name)));
check('Only explicitly requested unbalanced filter counts receive CSS changes',()=>{
  const original=pelletMasterBaseline('src/smartInventory.css'),now=raw('src/smartInventory.css');
  const stripped=now.replace(/\/\* Only unbalanced[\s\S]*?(?=@container \(max-width: 740px\))/, '');
  assert.equal(stripped,original);assert.match(now,/data-field-count="7"/);assert.match(now,/grid-column: span 4/);
});

const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const oldWindow=globalThis.window,oldSession=globalThis.sessionStorage;
try{
  const colors=await server.ssrLoadModule('/src/pelletColors.ts'),master=await server.ssrLoadModule('/src/productMaster.ts');
  const store=await server.ssrLoadModule('/src/store.tsx'),locations=await server.ssrLoadModule('/src/locationMaster.ts'),categories=await server.ssrLoadModule('/src/inventoryCategories.ts');
  const Field=(await server.ssrLoadModule('/src/components/PelletColorField.tsx')).default;
  const filters=await server.ssrLoadModule('/src/productFilters.ts');
  check('Complete stock-independent sizes, SDRs, grades and all Straight/Coil lengths',()=>{
    assert.deepEqual(filters.productFilterSizes('HDPE Pipe'),[13,20,25,32,40,50,63,75,90,110,160,225,280,315,355,400,450,500].map(size=>size+'mm'));
    assert.deepEqual(filters.productFilterSizes('CTS HDPE Pipe'),['1/2"','3/4"','1"']);assert.deepEqual(filters.productFilterSizes('Spiral Pipe'),['12"','16"']);
    assert.deepEqual(filters.productFilterLengths('Straight Length'),['5m','5.5m','5.86m','6m','8.873m','10m']);
    assert.deepEqual(filters.productFilterLengths('Coil'),['25m','30m','50m','60m','90m','100m','150m','200m','250m','300m','350m']);
    assert.equal(filters.productFilterLengths().length,17);assert.deepEqual(master.MATERIAL_GRADES,['PE80','PE100']);assert.equal(master.SDR_RATINGS.length,9);
  });
  check('Location master choices are A–I only; legacy names/status/IDs preserved idempotently',()=>{
    const legacy={id:'legacy-section',name:'Section A',plant:'Branch Plant',locationType:'Raw Material Area',status:'Active'};
    const custom={...legacy,id:'custom',name:'User Rack',code:'USER'};
    const next=locations.normalizeLocationMaster([legacy,custom]);assert.deepEqual(next.slice(0,2),[legacy,custom]);assert.deepEqual(locations.normalizeLocationMaster(next),next);
    assert.deepEqual(locations.filterLocationCodes(next),locations.LOCATION_CODES);assert.deepEqual(locations.activeLocationCodes(next),locations.LOCATION_CODES);
  });
  check('Date and Location automation engines, barcode/quantity/RBAC logic unchanged',()=>{
    for(const file of ['src/datePeriods.ts','src/components/PeriodSelector.tsx','src/inventoryFacets.ts','src/finishedGoodsInventory.ts','src/finishedPipeBarcodes.ts','src/reprintWorkflow.ts','src/finishedPipeRelations.ts','src/productMaster.ts','src/App.tsx','src/components/Sidebar.tsx'])assert.equal(raw(file),pelletMasterBaseline(file));
    const now=declarations(raw('src/pages/management/Settings.tsx')),previous=declarations(pelletMasterBaseline('src/pages/management/Settings.tsx'));
    for(const name of ['createTarget','createSpecification','confirmDeactivate'])assert.equal(now.get(name),previous.get(name));
  });
  const memory=new Map(),writes=[];
  globalThis.window={localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>{writes.push(key);memory.set(key,value);}},sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},location:{hostname:'test.invalid'}};
  globalThis.sessionStorage=window.sessionStorage;
  let captured;function Capture(){captured=store.useApp();return null;}
  const render=()=>renderToStaticMarkup(React.createElement(store.AppProvider,null,React.createElement(Capture)));
  render();const baseline=JSON.parse(JSON.stringify(captured));
  const expected=['Black','Blue','Orange','Red Orange','Green'];
  check('One full configured recycled master, correct codes, no record-derived options',()=>{
    assert.deepEqual(colors.materialColorOptions('Recycled'),expected);
    assert.deepEqual(colors.RECYCLED_PELLET_COLOR_MASTER.map(color=>color.code),['BK','BE','OR','RO','GRN']);
    assert.deepEqual(colors.materialColorOptions('Virgin'),['White']);
    assert.deepEqual(colors.materialColorOptions('All'),['White',...expected]);
    assert.doesNotMatch(colors.materialColorOptions.toString(),/records|flatMap|availableKg|currentLocation|pagination|\.filter\(/);
  });
  for(const color of expected)check('Master color valid at zero stock, by name and established code: '+color,()=>{
    const entry=colors.RECYCLED_PELLET_COLOR_MASTER.find(item=>item.name===color);
    assert.equal(colors.newPelletColor('Recycled',color),color);assert.equal(colors.newPelletColor('Recycled',entry.label),color);
    assert.equal(colors.newPelletColor('Virgin',color),'White');
  });
  check('Fresh demo has only valid master colors; same 40 recycled bags / 1000 kg',()=>{
    const recycled=baseline.pellets.filter(item=>item.type==='Recycled');assert.equal(recycled.length,40);assert.equal(recycled.reduce((sum,item)=>sum+item.availableKg,0),1000);
    assert.deepEqual([...new Set(recycled.map(item=>item.color))],expected);assert.ok(baseline.pellets.filter(item=>item.type==='Virgin').every(item=>item.color==='White'));
  });
  for(const color of ['Mixed','mixed','White','Custom amber','Not specified','',undefined])check('Invalid active Recycled color rejected without a substitute: '+String(color),()=>assert.equal(colors.newPelletColor('Recycled',color),''));
  const legacy=structuredClone(baseline);const recycled=legacy.pellets.filter(item=>item.type==='Recycled');recycled[0].color='Mixed';recycled[1].color='Custom amber';recycled[2].color='White';
  memory.set('hpai:shared-app-state-v1',JSON.stringify(legacy));render();const restored=JSON.parse(JSON.stringify(captured));
  check('Historical Mixed/custom/White recycled metadata preserved, visibly legacy, never active options',()=>{
    assert.deepEqual(restored.pellets,legacy.pellets);
    for(const color of ['Mixed','Custom amber','White']){assert.equal(colors.pelletColorLabel('Recycled',color),color+' (legacy)');assert.ok(!colors.materialColorOptions('Recycled').includes(color));}
    assert.deepEqual(restored.transactions,legacy.transactions);assert.deepEqual(restored.finishedGoods,legacy.finishedGoods);
  });
  check('Historical reload idempotent; empty collections remain empty',()=>{
    memory.set('hpai:shared-app-state-v1',JSON.stringify(restored));render();assert.deepEqual(captured.pellets,restored.pellets);
    memory.set('hpai:shared-app-state-v1',JSON.stringify({...baseline,pellets:[]}));render();assert.deepEqual(captured.pellets,[]);
  });
  check('Historical Mixed exception is preserved even on a legacy Virgin record',()=>{
    const record={...baseline.pellets[0],type:'Virgin',color:'Mixed'};
    assert.equal(colors.repairPelletColor(record),record);assert.equal(colors.pelletColorLabel('Virgin','Mixed'),'Mixed (legacy)');
    assert.equal(colors.newPelletColor('Virgin','Mixed'),'White');
  });
  for(const user of store.USERS)check('Shared Virgin/Recycled creation rule independent of role: '+user.role,()=>{
    const virgin=Field({type:'Virgin',value:'Green',onChange:()=>{}});assert.equal(virgin.props.value,'White');assert.equal(virgin.props.readOnly,true);
    const recycled=Field({type:'Recycled',value:'',onChange:()=>{}});assert.deepEqual(recycled.props.options,expected);
  });
  const transpile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
  const helperNames=['roundKg','makePelletBags','normalizeBarcodeValue','nextAnnualSequence','makePermanentPelletBags','registryEntriesForPellets'];
  const helperDeps={...colors,isSupportedMaterialGrade:store.isSupportedMaterialGrade};
  const helpers=new Function(...Object.keys(helperDeps),transpile(helperNames.map(name=>'const '+name+' = '+current.get(name)+';').join('\n'))+';return {'+helperNames.join(',')+'};')(...Object.values(helperDeps));
  function simulate(name,state,args){let updated=structuredClone(state);const deps={...colors,...master,...categories,...helpers,...locations,readStorageLocations:()=>locations.normalizeLocationMaster([]),normalizeMaterialGrade:store.normalizeMaterialGrade,isSupportedMaterialGrade:store.isSupportedMaterialGrade,calculateRecycledBagging:store.calculateRecycledBagging,calculateRecyclingMetrics:store.calculateRecyclingMetrics,useCallback:fn=>fn,setState:fn=>{updated=fn(updated);}};const action=new Function(...Object.keys(deps),transpile('const action = '+current.get(name)+';')+';return action;')(...Object.values(deps));return{result:action(...args),state:updated};}
  const rr={pelletType:'Recycled',grade:'PE100',color:'Green',numberOfBags:1,supplier:'Fixture',referenceNo:'COLOR-QA',destination:'Branch Plant',storageLocation:'A'};
  const request={refNo:'QA-MR',date:'2026-10-16',requestedBy:'QA',materialCategory:'Recycled Pellet',pelletType:'Recycled',grade:'PE100',color:'Green',requestedKg:25,requestedBags:1,status:'Approved',destination:'Branch Plant'};
  const manager=store.USERS.find(user=>user.role==='plantmanager');
  for(const color of expected)check('Actual receiving/request/transfer writes accept full master at zero stock: '+color,()=>{
    const received=simulate('createReceivingReport',{...baseline,pellets:[]},[{...rr,color}]).state;assert.equal(received.pellets.length,1);assert.equal(received.pellets[0].color,color);assert.equal(received.pellets[0].availableKg,25);
    const requested=simulate('addMaterialRequest',{...baseline,currentUser:manager,materialRequests:[]},[{...request,status:'New',color}]);assert.equal(requested.result.success,true);assert.equal(requested.state.materialRequests[0].color,color);
    const transferred=simulate('createTransfer',{...baseline,pellets:[],transfers:[],materialRequests:[{...request,id:'qa-request',color}]},['qa-request']);assert.ok(transferred.result);assert.equal(transferred.state.pellets.length,1);assert.equal(transferred.state.pellets[0].color,color);
  });
  for(const color of ['Mixed','mixed','White','Custom amber',''])check('Actual receiving/request/transfer rejects new invalid recycled color with no writes: '+color,()=>{
    const state={...baseline,currentUser:manager,materialRequests:[{...request,id:'invalid-request',color}],transfers:[]};
    assert.deepEqual(simulate('createReceivingReport',state,[{...rr,color}]).state,state);
    assert.equal(simulate('addMaterialRequest',state,[{...request,color}]).result.success,false);
    const transfer=simulate('createTransfer',state,['invalid-request']);assert.equal(transfer.result,null);assert.deepEqual(transfer.state,state);
  });
  const batch={id:'qa-batch',batchNo:'RP-QA',originalKg:100,cutMaterialKg:90,status:'Pelletizing',date:'2026-10-16',sourcePO:baseline.productionOrders[0].poNo,employees:[]};
  const loose=(id,color,kg,sourcePO=batch.sourcePO)=>({...batch,id,batchNo:id,status:'Completed',color,looseKg:kg,sourcePO});
  const recycling={...baseline,pellets:[],recyclingBatches:[batch,loose('green','Green',9),loose('blue','Blue',7),loose('legacy','Mixed',8),loose('other-grade','Green',4,baseline.productionOrders[1].poNo)]};
  for(const color of ['Mixed','White','',undefined])check('Recycling cannot generate invalid/Mixed output: '+String(color),()=>assert.deepEqual(simulate('completeRecyclingBatch',recycling,[batch.id,26,color]).state,recycling));
  check('Recycling blocks incompatible/legacy carry-over instead of changing pooling calculations',()=>assert.deepEqual(simulate('completeRecyclingBatch',recycling,[batch.id,26,'Green']).state,recycling));
  check('Recycling uses selected color with the original same-grade carry-over/bagging arithmetic',()=>{
    const compatible={...recycling,recyclingBatches:[batch,recycling.recyclingBatches[1],recycling.recyclingBatches[4]]};
    const state=simulate('completeRecyclingBatch',compatible,[batch.id,26,'Green']).state;
    assert.equal(state.pellets.length,1);assert.equal(state.pellets[0].color,'Green');assert.equal(state.pellets[0].availableKg,25);
    assert.equal(state.recyclingBatches[0].color,'Green');assert.equal(state.recyclingBatches[0].looseKg,10);
    assert.deepEqual(state.recyclingBatches.slice(1).map(item=>item.looseKg),[0,4]);
    assert.equal(25+state.recyclingBatches.reduce((sum,item)=>sum+(item.looseKg||0),0),26+9+4);
    assert.deepEqual(state.transactions,recycling.transactions);
  });
  check('Existing differently colored bags are never relabeled or duplicated by recycling completion',()=>{
    const state={...recycling,pellets:[{...baseline.pellets.find(item=>item.type==='Recycled'),color:'Mixed',recyclingBatchRef:batch.batchNo}]};
    assert.deepEqual(simulate('completeRecyclingBatch',state,[batch.id,26,'Green']).state,state);
  });
  check('No SSR persistence writes, wipe or database access',()=>{assert.deepEqual(writes,[]);assert.doesNotMatch(raw('src/pelletColors.ts'),/localStorage|setState|fetch\(|supabase|Math\.random/);});
  console.log('Completed '+checks+' final pellet-master, zero-stock, legacy-preservation, creation/transfer/recycling and unchanged-arithmetic checks.');
}finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldSession===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=oldSession;await server.close();}
