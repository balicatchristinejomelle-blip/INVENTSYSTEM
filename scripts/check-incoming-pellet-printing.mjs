import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { incomingPrintingDeltas, incomingPrintingAdditions, restoreIncomingPrintingFile } from './incoming-printing-baseline.mjs';
import { scanSessionDeltas, scanSessionAdditions, restoreScanSessionFile } from './scan-session-baseline.mjs';

let checks = 0;
const check = (name, run) => { run(); checks++; console.log('PASS '+name); };
const read = file => fs.readFileSync(file,'utf8').replace(/\r/g,'');
for(const[file,hash]of Object.entries({...scanSessionDeltas,...scanSessionAdditions}))check('Exact reviewed scan-session source: '+file,()=>{assert.equal(createHash('sha256').update(read(file)).digest('hex'),hash);if(scanSessionDeltas[file])assert.throws(()=>restoreScanSessionFile(file,read(file)+'\n// unexpected'),/Unreviewed incoming-printing delta/);});
for(const file of Object.keys(incomingPrintingDeltas))check('Exact reviewed incoming printing delta: '+file,()=>{
  assert.equal(restoreIncomingPrintingFile(file,read(file)),execFileSync('git',['show','e938306:'+file],{encoding:'utf8'}).replace(/\r/g,''));
  assert.throws(()=>restoreIncomingPrintingFile(file,read(file)+'\n// unexpected'),/Unreviewed incoming-printing delta/);
});
for(const[file,hash]of Object.entries(incomingPrintingAdditions))check('Exact additive label module: '+file,()=>assert.equal(createHash('sha256').update(read(file)).digest('hex'),hash));
function bindings(source){const ast=ts.createSourceFile('store.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),result=new Map();const walk=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer)result.set(node.name.text,node.initializer.getText(ast));ts.forEachChild(node,walk);};walk(ast);return result;}
const source=bindings(read('src/store.tsx')),old=bindings(execFileSync('git',['show','e938306:src/store.tsx'],{encoding:'utf8'}));
check('Historical seeds/callbacks remain byte-identical after exact reviewed label and scan-session normalization',()=>{
  const preserved=bindings(restoreScanSessionFile('src/store.tsx',read('src/store.tsx')));
  for(const[name,value]of old)if(name.startsWith('INITIAL_')||(value.startsWith('useCallback(')&&name!=='createTransfer'))assert.equal(preserved.get(name),value,name);
});
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'}),oldWindow=globalThis.window;
try{
  const store=await server.ssrLoadModule('/src/store.tsx'),incoming=await server.ssrLoadModule('/src/incomingPelletBarcodes.ts'),scan=await server.ssrLoadModule('/src/physicalScan.ts'),colors=await server.ssrLoadModule('/src/pelletColors.ts'),categories=await server.ssrLoadModule('/src/inventoryCategories.ts'),inventory=await server.ssrLoadModule('/src/finishedGoodsInventory.ts'),locations=await server.ssrLoadModule('/src/locationMaster.ts'),printing=await server.ssrLoadModule('/src/reprintWorkflow.ts'),printables=await server.ssrLoadModule('/src/printableRecords.ts');
  let captured;function Capture(){captured=store.useApp();return null;}const render=()=>renderToStaticMarkup(React.createElement(store.AppProvider,null,React.createElement(Capture)));render();const baseline=JSON.parse(JSON.stringify(captured));
  let state=structuredClone(baseline);const memory=new Map();globalThis.window={localStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},location:{hostname:'test.invalid'}};
  const dependencies={...store,...incoming,...scan,...colors,...categories,...inventory,...locations};
  const transpile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  const names=['makePelletBags','nextAnnualSequence','makePermanentPelletBags','registryEntriesForPellets'];
  const helpers=new Function(...Object.keys(dependencies),transpile(names.map(name=>'const '+name+'='+source.get(name)+';').join('\n'))+';return {'+names.join(',')+'};')(...Object.values(dependencies));
  const actor=role=>{state={...state,currentUser:store.USERS.find(user=>user.role===role)};};
  const action=(name,...args)=>{const deps={...dependencies,...helpers,useCallback:fn=>fn,flushSync:fn=>fn(),setState:fn=>{state=fn(state);}};return new Function(...Object.keys(deps),transpile('const action='+source.get(name)+';')+';return action;')(...Object.values(deps))(...args);};
  const request={id:'isolated-incoming-label-request',refNo:'MR-2099-9970',date:'2026-10-20',requestedBy:'Isolated QA',materialCategory:'Virgin Pellet',pelletType:'Virgin',grade:'PE80',color:'White',requestedKg:125,requestedBags:5,status:'Approved',destination:'Branch Plant'};
  state={...state,materialRequests:[request,...state.materialRequests]};actor('plantmanager');const before=state;
  check('Approved request prepares five unique zero-stock expected bags before any transfer exists',()=>{
    assert.equal(action('ensureExpectedPelletBags',request.id).success,true);const bags=incoming.requestPelletBags(state,request);assert.equal(bags.length,5);assert.equal(new Set(bags.map(bag=>bag.barcode)).size,5);assert.ok(bags.every(bag=>bag.inventoryStatus==='Pending Receipt'&&bag.availableKg===0&&bag.originalKg===25&&!bag.transferRef&&/^PEL-V-/.test(bag.barcode)));
    for(const key of Object.keys(before).filter(key=>!['pellets','barcodeRegistry'].includes(key)))assert.equal(state[key],before[key],key);
    for(const bag of before.pellets)assert.equal(state.pellets.find(item=>item.id===bag.id),bag);
  });
  const bags=incoming.requestPelletBags(state,request),prepared=state;
  check('Reopening View Barcodes is idempotent, preserving all records, IDs, barcodes and quantities',()=>{action('ensureExpectedPelletBags',request.id);assert.equal(state,prepared);});
  for(const status of ['Pending','Rejected'])check(status+' cannot prepare or print labels or receive expected bags',()=>{
    state={...prepared,materialRequests:prepared.materialRequests.map(item=>item.id===request.id?{...item,status}:item)};const before=state;assert.equal(action('ensureExpectedPelletBags',request.id).success,false);assert.equal(state,before);
    for(const bag of bags){const record=printables.printableRecords(state).find(item=>item.kind==='Barcode'&&item.recordId===bag.id);assert.ok(printing.validatePrint(state,state.currentUser,record));assert.equal(action('receivePellet',bag.id,{shift:'Day',scannerMode:'Receive Pellets',barcode:bag.barcode},'A'),false);}state=prepared;
  });
  for(const user of store.USERS.filter(user=>user.role!=='plantmanager'))check(user.role+' cannot gain label-preparation permission',()=>{actor(user.role);const before=state;assert.equal(action('ensureExpectedPelletBags',request.id).success,false);assert.equal(state,before);});state=prepared;
  check('Existing approved labels are first-printable before dispatch; reprints require same-record Management approval',()=>{
    const record=printables.printableRecords(state).find(item=>item.kind==='Barcode'&&item.recordId===bags[0].id);const printed=printing.completePrint(state,state.currentUser,record,'2026-10-20T00:00:00Z');assert.equal(printed.success,true);const workflow={...state,...printed.state};assert.ok(printing.validatePrint(workflow,state.currentUser,record));const requested=printing.requestReprint(workflow,state.currentUser,record,'Lost copy','2026-10-20T01:00:00Z','isolated-label-reprint');assert.equal(requested.success,true);const approved=printing.reviewReprint(requested.state,store.USERS.find(user=>user.role==='management'),'isolated-label-reprint','APPROVED','','2026-10-20T02:00:00Z');assert.equal(approved.success,true);assert.equal(printing.validatePrint(approved.state,state.currentUser,record,'isolated-label-reprint'),null);assert.ok(printing.validatePrint(approved.state,state.currentUser,{...record,value:'OTHER-BARCODE'},'isolated-label-reprint'));assert.equal(printing.completePrint(approved.state,state.currentUser,record,'2026-10-20T03:00:00Z','isolated-label-reprint').success,true);assert.equal(state,prepared);
  });
  check('Partial missing-label repair appends ONLY missing records, preserving valid printed data',()=>{
    const missing= new Set(bags.slice(3).map(bag=>bag.id));state={...prepared,pellets:prepared.pellets.filter(bag=>!missing.has(bag.id)).map(bag=>bag.id===bags[0].id?{...bag,printStatus:'Printed'}:bag),barcodeRegistry:prepared.barcodeRegistry.filter(record=>!missing.has(record.itemId)),printMetadata:{...prepared.printMetadata,['Barcode:Pellet:'+bags[0].id]:{printCount:1}}};const before=state;assert.equal(action('ensureExpectedPelletBags',request.id).success,true);assert.equal(incoming.requestPelletBags(state,request).length,5);for(const bag of before.pellets)assert.equal(state.pellets.find(item=>item.id===bag.id),bag);assert.equal(state.printMetadata,before.printMetadata);const fixed=state;action('ensureExpectedPelletBags',request.id);assert.equal(state,fixed);state=prepared;
  });
  check('Conflicting batch/quantity/duplicate-barcode data fails safely without rewriting anything',()=>{
    for(const override of [{materialRequests:prepared.materialRequests.map(item=>item.id===request.id?{...item,requestedKg:100}:item)},{pellets:prepared.pellets.map(bag=>bag.id===bags[0].id?{...bag,batchNo:'conflict'}:bag)},{pellets:[...prepared.pellets,{...bags[0],id:'ambiguous-duplicate'}]}]){state={...prepared,...override};const before=state;assert.equal(action('ensureExpectedPelletBags',request.id).success,false);assert.equal(state,before);}state=prepared;
  });
  actor('accounting');action('createTransfer',request.id);const transfer=state.transfers.find(item=>item.requestRef===request.refNo);
  check('Accounting transfer reuses every prepared barcode/batch/ID and adds no duplicate bags or stock',()=>{assert.ok(transfer);assert.equal(state.pellets.length,prepared.pellets.length);for(const bag of bags){const linked=state.pellets.find(item=>item.id===bag.id);assert.deepEqual(linked,{...bag,transferRef:transfer.refNo});}assert.equal(state.transactions,prepared.transactions);});
  action('dispatchTransfer',transfer.id);actor('plantmanager');const beforeReceive=state;
  for(const bag of bags.slice(0,3))assert.equal(action('receivePellet',bag.id,{shift:'Day',scannerMode:'Receive Pellets',barcode:bag.barcode},'A'),true);
  check('Partial delivery: three individual scans produce 3 received / 2 remaining / exactly 75kg Stock In',()=>{const current=incoming.requestPelletBags(state,request);assert.equal(current.filter(bag=>bag.inventoryStatus==='Pending Receipt').length,2);assert.equal(current.filter(bag=>bag.receivedAt).length,3);assert.equal(current.reduce((sum,bag)=>sum+bag.availableKg,0),75);assert.equal(state.transactions.filter(tx=>bags.some(bag=>bag.barcode===tx.barcode)&&tx.transactionType==='Pellets Received').reduce((sum,tx)=>sum+tx.qtyChanged,0),75);assert.equal(state.transfers.find(item=>item.id===transfer.id).status,'In Transit');});
  check('Duplicate and unknown receiving cannot change partial totals or history',()=>{const before=state;assert.equal(action('receivePellet',bags[0].id,{shift:'Day',scannerMode:'Receive Pellets',barcode:bags[0].barcode},'B'),false);assert.equal(action('receivePellet','unknown',{shift:'Day',scannerMode:'Receive Pellets',barcode:'UNKNOWN'},'A'),false);assert.equal(state,before);action('ensureExpectedPelletBags',request.id);assert.equal(state,before);assert.equal(state.finishedGoods,beforeReceive.finishedGoods);});
  check('Missing-only repair preserves already-received bags, partial quantities and Stock In history',()=>{const partial=state,missing=new Set(bags.slice(3).map(bag=>bag.id));state={...partial,pellets:partial.pellets.filter(bag=>!missing.has(bag.id)),barcodeRegistry:partial.barcodeRegistry.filter(record=>!missing.has(record.itemId))};const before=state;assert.equal(action('ensureExpectedPelletBags',request.id).success,true);const current=incoming.requestPelletBags(state,request);assert.equal(current.length,5);assert.equal(current.reduce((sum,bag)=>sum+bag.availableKg,0),75);for(const bag of before.pellets)assert.equal(state.pellets.find(item=>item.id===bag.id),bag);for(const key of ['transfers','materialRequests','transactions','printMetadata'])assert.equal(state[key],before[key],key);state=partial;});
  state=beforeReceive;
  check('Accept Transfer blocks zero scans, duplicate scans, unknown barcode, record IDs and invalid location atomically',()=>{
    for(const[values,location]of [[[],'A'],[[bags[0].barcode,bags[0].barcode],'A'],[[bags[0].barcode,'UNKNOWN'],'A'],[[bags[0].id],'A'],[[bags[0].barcode],'J']]){const before=state;assert.equal(action('acceptScannedPelletTransfer',transfer.id,values,location).success,false);assert.equal(state,before);}
  });
  check('Pending, Rejected, wrong material, wrong transfer and Preparing deliveries cannot be accepted',()=>{
    const valid=state;
    for(const override of [
      ...['Pending','Rejected'].map(status=>({materialRequests:valid.materialRequests.map(item=>item.id===request.id?{...item,status}:item)})),
      {pellets:valid.pellets.map(item=>item.id===bags[0].id?{...item,grade:'WRONG'}:item)},
      {pellets:valid.pellets.map(item=>item.id===bags[0].id?{...item,transferRef:'OTHER'}:item)},
      {pellets:valid.pellets.map(item=>item.id===bags[1].id?{...item,currentLocation:'Z',locationStatus:'Stored'}:item)},
      {transfers:valid.transfers.map(item=>item.id===transfer.id?{...item,receivedQuantity:2}:item)},
      {transfers:valid.transfers.map(item=>item.id===transfer.id?{...item,status:'Preparing'}:item)},
    ]){state={...valid,...override};const before=state;assert.equal(action('acceptScannedPelletTransfer',transfer.id,[bags[0].barcode,bags[1].barcode],'A').success,false);assert.equal(state,before);}state=valid;
  });
  for(const user of store.USERS.filter(user=>user.role!=='plantmanager'))check('Transfer acceptance preserves existing RBAC for '+user.role,()=>{const valid=state;actor(user.role);const before=state;assert.equal(action('acceptScannedPelletTransfer',transfer.id,[bags[0].barcode],'A').success,false);assert.equal(state,before);state=valid;});
  const beforeAccept=state;
  check('Accept 3 of 5 scans records exactly 75 kg and 50 kg missing, preserving Sent Quantity and every unscanned record',()=>{
    assert.equal(action('acceptScannedPelletTransfer',transfer.id,bags.slice(0,3).map(bag=>bag.barcode),'A').success,true);
    const delivery=state.transfers.find(item=>item.id===transfer.id);assert.equal(delivery.status,'Receiving Discrepancy');assert.equal(delivery.receivedQuantity,3);assert.equal(delivery.discrepancyQuantity,2);assert.equal(delivery.weightKg,125);assert.equal(delivery.sentQuantity,beforeAccept.transfers.find(item=>item.id===transfer.id).sentQuantity);
    for(const bag of beforeAccept.pellets.filter(bag=>!bags.slice(0,3).some(item=>item.id===bag.id)))assert.equal(state.pellets.find(item=>item.id===bag.id),bag);
    for(const key of ['orders','manufacturingOrders','productionOrders','rrRecords','materialRequests','barcodeRegistry','printMetadata','reprintRequests','finishedGoods'])assert.equal(state[key],beforeAccept[key],key);
    const tx=state.transactions.filter(tx=>bags.some(bag=>bag.barcode===tx.barcode)&&tx.transactionType==='Pellets Received');assert.equal(tx.length,3);assert.equal(new Set(tx.map(tx=>tx.txId)).size,3);assert.equal(tx.reduce((sum,tx)=>sum+tx.qtyChanged,0),75);
  });
  const partialAccepted=state;
  check('Mixed already-received and unreceived scans cannot partially mutate a delivery',()=>{const before=state;assert.equal(action('acceptScannedPelletTransfer',transfer.id,[bags[3].barcode,bags[0].barcode],'B').success,false);assert.equal(state,before);});
  check('Remaining two bags complete partial delivery without recreating bags or rewriting prior receipt/history',()=>{
    assert.equal(action('acceptScannedPelletTransfer',transfer.id,bags.slice(3).map(bag=>bag.barcode),'B').success,true);const delivery=state.transfers.find(item=>item.id===transfer.id);assert.equal(delivery.status,'Received');assert.equal(delivery.receivedQuantity,5);assert.equal(delivery.discrepancyQuantity,0);assert.equal(delivery.receivingLocation,'Multiple Locations');
    for(const bag of partialAccepted.pellets.filter(item=>bags.slice(0,3).some(bag=>bag.id===item.id)))assert.equal(state.pellets.find(item=>item.id===bag.id),bag);
    for(const tx of partialAccepted.transactions)assert.ok(state.transactions.includes(tx));
    for(const bag of bags)assert.equal(state.pellets.find(item=>item.id===bag.id).barcode,bag.barcode);
    const tx=state.transactions.filter(tx=>bags.some(bag=>bag.barcode===tx.barcode)&&tx.transactionType==='Pellets Received');assert.equal(tx.length,5);assert.equal(tx.reduce((sum,tx)=>sum+tx.qtyChanged,0),125);
    const completed=state;assert.equal(action('acceptScannedPelletTransfer',transfer.id,[bags[4].barcode],'A').success,false);assert.equal(state,completed);
  });
  check('Full five-bag acceptance records 125kg with five unique stock movements and no discrepancy',()=>{state=beforeAccept;assert.equal(action('acceptScannedPelletTransfer',transfer.id,bags.map(bag=>bag.barcode),'I').success,true);const delivery=state.transfers.find(item=>item.id===transfer.id);assert.equal(delivery.status,'Received');assert.equal(delivery.discrepancyQuantity,0);const tx=state.transactions.filter(tx=>bags.some(bag=>bag.barcode===tx.barcode)&&tx.transactionType==='Pellets Received');assert.equal(tx.length,5);assert.equal(new Set(tx.map(tx=>tx.txId)).size,5);assert.equal(tx.reduce((sum,tx)=>sum+tx.qtyChanged,0),125);});
  state=partialAccepted;
  const persisted=JSON.parse(JSON.stringify(state));for(const user of store.USERS)check('Partial labels and quantities survive reload for '+user.role,()=>{memory.set('hpai:shared-app-state-v1',JSON.stringify({...persisted,currentUser:user}));render();for(const key of ['pellets','transfers','materialRequests','transactions','barcodeRegistry'])assert.deepEqual(captured[key],persisted[key],key);});
  console.log(`Completed ${checks} incoming-pellet label preparation, print approval, preservation and partial-receiving checks. Isolated fixtures only.`);
}finally{globalThis.window=oldWindow;await server.close();}
