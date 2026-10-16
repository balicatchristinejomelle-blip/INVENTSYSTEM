import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hpai-process-flow-'));
const executable = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const entry = `
import React from 'react';import{createRoot}from'react-dom/client';
import{AppProvider,useApp,USERS}from'/src/store';import{ViewStateScope,VIEW_STATE_PREFIX}from'/src/uiViewState';
import Pellets from '/src/pages/production/Pellets';import Transfers from '/src/pages/accounting/Transfers';import Operations from '/src/pages/management/Operations';import Transactions from '/src/pages/accounting/Transactions';import Reports from '/src/pages/plantmanager/Reports';
import*as operational from'/src/operationalInventory';import*as inventory from'/src/finishedGoodsInventory';import'/src/index.css';
const root=createRoot(document.getElementById('root'));let baseline,version=0;window.qa={operational,inventory};
function Live(){const app=useApp();window.qa.app=app;if(!baseline)baseline=JSON.parse(JSON.stringify(app));const Page=app.currentPage==='prod-pellets'?Pellets:app.currentPage==='acc-transfers'?Transfers:app.currentPage==='mgmt-operations'?Operations:app.currentPage==='acc-transactions'?Transactions:app.currentPage==='pm-reports'?Reports:null;return React.createElement(ViewStateScope,null,React.createElement('main',{className:'operational-content page-stack',style:{padding:16,minWidth:0,maxWidth:'100%'}},Page&&React.createElement(Page)));}
window.qa.mount=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(AppProvider,{key:++version},React.createElement(Live))));
window.qa.seed=()=>{const user=USERS.find(row=>row.role==='production'),zero={...baseline.pellets[0],id:'isolated-zero-wip',barcode:'QA-ZERO-WIP',availableKg:0,inventoryStatus:'Loaded',currentLocation:'A'};localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify({...baseline,currentUser:USERS.find(row=>row.role==='accounting'),currentPage:'process-qa',clockedIn:true,currentShift:'Day',attendance:[{...baseline.attendance[0],id:'isolated-browser-process-shift',employeeId:user.employeeId,status:'Active',shift:'Day'}],turnovers:[],pellets:[zero,...baseline.pellets],barcodeRegistry:[...baseline.barcodeRegistry,{barcode:zero.barcode,itemId:zero.id,itemType:'Virgin Pellet Bag',category:'Pellet',createdAt:'2000-01-01T00:00:00.000Z'}]}));window.qa.mount();};
window.qa.role=(role,page='process-qa',prefs={})=>{const user=USERS.find(row=>row.role===role),prefix=VIEW_STATE_PREFIX+user.employeeId+':'+role+':'+page+':';for(const[key,value]of Object.entries(prefs))sessionStorage.setItem(prefix+key,JSON.stringify(value));window.qa.app.login(user.username,user.password);window.qa.app.navigate(page);};
window.qa.data=()=>JSON.parse(JSON.stringify(['pellets','finishedGoods','productionOrders','orders','manufacturingOrders','transactions','materialUsageTransactions','transfers','rejectedMaterials','recyclingBatches','rrRecords','materialRequests','colorants','barcodeRegistry','auditLogs','attendance'].map(key=>window.qa.app[key])));
window.qa.click=(text,scope=document)=>{const button=[...scope.querySelectorAll('button')].find(node=>node.textContent.trim()===text);if(!button||button.disabled)throw Error('Missing/disabled '+text);button.click();};
window.qa.mount();
`;
const server = await createServer({ cacheDir:path.join(profile,'vite-cache'),server:{host:'127.0.0.1',port:0,strictPort:false,hmr:false},plugins:[{
  name:'process-flow-browser',resolveId(id){if(id==='/__process-qa.js')return'\0process-qa';},load(id){if(id==='\0process-qa')return entry;},configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url!=='/__process-qa')return next();try{res.setHeader('Content-Type','text/html');res.end(await server.transformIndexHtml('/__process-qa','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__process-qa.js"></script></body></html>'));}catch(error){next(error);}});},
}]});
let chrome,socket,id=0;const pending=new Map(),errors=[];const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(probe,label){const end=Date.now()+90000;while(Date.now()<end){try{if(await probe())return;}catch{}await pause(100);}throw Error('Timed out '+label+' '+errors.join(';'));}
function send(method,params={}){return new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP timeout '+method));},30000);pending.set(request,{resolve:value=>{clearTimeout(timer);resolve(value);},reject});socket.send(JSON.stringify({id:request,method,params}));});}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
async function action(name,...args){const result=await evaluate('qa.app['+JSON.stringify(name)+'](...'+JSON.stringify(args)+')');await pause(100);return result;}
async function role(name,page,prefs={}){await evaluate('qa.role('+JSON.stringify(name)+','+JSON.stringify(page||'process-qa')+','+JSON.stringify(prefs)+')');await pause(150);}
const snapshot=()=>evaluate('JSON.parse(JSON.stringify(qa.app))');
async function reload(){await evaluate('window.__processReloadPending=true');await send('Page.reload');await wait(()=>evaluate('!window.__processReloadPending&&!!window.qa?.app'),'new document after reload');await pause(100);}
try{
  await server.listen();chrome=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let target;await wait(async()=>{const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0].trim();target=(await(await fetch('http://127.0.0.1:'+port+'/json')).json()).find(page=>page.type==='page');return target;},'isolated browser');
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));socket.addEventListener('message',({data})=>{const message=JSON.parse(data);if(message.id){const request=pending.get(message.id);if(request){pending.delete(message.id);if(message.error)request.reject(Error(message.error.message));else request.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:'http://127.0.0.1:'+server.httpServer.address().port+'/__process-qa'});await wait(()=>evaluate('!!window.qa?.app'),'app');await evaluate('qa.seed()');await pause(300);
  const initial=await snapshot(),before=await evaluate('qa.operational.pelletBalances(qa.app.pellets)');
  await action('createReceivingReport',{pelletType:'Virgin',grade:'PE100',color:'White',numberOfBags:1,supplier:'Isolated Browser QA',referenceNo:'QA-BROWSER-RECEIVING',destination:'Branch Plant',storageLocation:'A'});
  let state=await snapshot();const bag=state.pellets.find(item=>!initial.pellets.some(old=>old.id===item.id));assert.ok(bag);assert.equal(bag.currentLocation,'A');
  await role('plantmanager');
  const spec={id:'isolated-browser-spec',itemCode:'QA-BROWSER',productType:'HDPE Pipe',materialGrade:'PE100',size:'90mm',sizeUnit:'mm',sdr:'SDR11',color:'Black (BK)',stripe:'No Stripe',pipeConstruction:'Solid Wall Pipe',productForm:'Straight Length',straightLength:'6m',unitWeightKg:0.5,active:true};
  await action('createStockReplenishmentPO',{specification:spec,targetQty:550,requiredDate:'2026-10-19',productionLine:'Line 1',priority:'Normal',reason:'Isolated browser process verification'});
  state=await snapshot();const po=state.productionOrders.find(item=>!initial.productionOrders.some(old=>old.id===item.id));assert.ok(po);assert.equal(state.finishedGoods.length,initial.finishedGoods.length);
  await role('production');assert.equal((await action('startProduction',po.id)).success,true);await action('loadPellets',bag.id,po.id);
  assert.deepEqual(await evaluate('qa.operational.pelletBalances(qa.app.pellets)'),{...before,virgin:before.virgin,wip:before.wip+25});
  assert.equal((await action('recordOutput',po.id,20,[{weightKg:0.5,reason:'Surface Defect'}],'browser-process-1')).success,true);
  assert.equal(await evaluate('qa.operational.pelletBalances(qa.app.pellets).wip'),before.wip+15);
  assert.equal((await action('recordOutput',po.id,30,[{weightKg:0.5,reason:'Surface Defect'}],'browser-process-2')).success,true);
  state=await snapshot();const produced=state.finishedGoods.filter(item=>item.productionOrderId===po.id);assert.equal(produced.length,48);assert.equal(state.pellets.find(item=>item.id===bag.id).inventoryStatus,'Fully Consumed');
  const savedState=await evaluate('qa.data()');await action('recordOutput',po.id,30,[{weightKg:0.5,reason:'Surface Defect'}],'browser-process-2');assert.deepEqual(await evaluate('qa.data()'),savedState);
  console.log('PASS actual browser callbacks: Receiving -> WIP 25 -> 15 -> 0, output 50 / good 48 / rejected 2; no duplicate replay');
  await role('management','mgmt-operations');
  const virginShown=await evaluate("Number([...document.querySelectorAll('.kpi-card')].find(node=>node.firstElementChild?.textContent==='Virgin Pellets').querySelector('strong').textContent.replace(/[^0-9.]/g,''))");assert.equal(virginShown,before.virgin);
  console.log('PASS Management raw total matches shared raw records, excluding WIP');
  await role('production','prod-pellets',{'production/Pellets:lifecycle':'Open / WIP'});
  await wait(()=>evaluate("[...document.querySelectorAll('button')].some(node=>node.textContent==='Mark Finished')"),'legacy zero WIP action');await evaluate("qa.click('Mark Finished')");await pause(150);
  assert.equal((await snapshot()).pellets.find(item=>item.id==='isolated-zero-wip').inventoryStatus,'Fully Consumed');assert.ok(await evaluate("document.body.textContent.includes('WIP marked Finished: QA-ZERO-WIP')"));
  assert.equal(await evaluate("[...document.querySelectorAll('button')].filter(node=>node.textContent==='Mark Finished').length"),0);
  console.log('PASS actual Mark Finished action retires zero WIP without deleting traceability or changing quantities');
  await role('plantmanager');await action('updateFinishedGoodStorage',produced[0].id,'A','General Inventory');
  await role('marketing');await action('createCustomerOrder',{customerId:state.customers[0].id,product:po.product,diameter:po.diameter,length:po.length,sdr:po.sdr,grade:po.grade,color:po.color,stripe:po.stripe,construction:po.construction,productForm:po.productForm,quantity:1,requiredDate:'2026-10-19'});
  await role('plantmanager');await action('relocatePhysicalItem','Finished Pipe',produced[0].id,'I','QA shipping');await role('production');await action('markFinishedGoodLoaded',produced[0].id);await action('releaseFinishedGood',produced[0].id);
  state=await snapshot();assert.equal(state.finishedGoods.find(item=>item.id===produced[0].id).releaseStatus,'Released');assert.equal(state.transactions.filter(item=>item.barcode===produced[0].barcode&&item.transactionType==='Finished Pipe Released').length,1);
  console.log('PASS actual storage -> reservation -> ready -> loading -> shipment preserves one physical pipe and creates one release');
  await role('plantmanager');await action('addMaterialRequest',{refNo:'MR-2099-9950',date:'2026-10-16',requestedBy:'Isolated QA',materialCategory:'Virgin Pellet',pelletType:'Virgin',grade:'PE80',color:'White',requestedKg:25,requestedBags:1,status:'New',destination:'Branch Plant'});
  state=await snapshot();const request=state.materialRequests.find(item=>item.refNo==='MR-2099-9950');assert.ok(request);
  await role('accounting');await action('approveMaterialRequest',request.id);await action('createTransfer',request.id);state=await snapshot();const transfer=state.transfers.find(item=>item.requestRef===request.refNo);assert.ok(transfer);
  await role('accounting','acc-transfers');await evaluate("qa.click('Dispatch',[...document.querySelectorAll('tr')].find(node=>node.textContent.includes("+JSON.stringify(transfer.refNo)+')))' );
  await wait(()=>evaluate("document.body.textContent.includes('Confirm action')"),'dispatch confirmation');await evaluate("qa.click('Confirm',document.querySelector('.modal-box'))");await pause(200);
  state=await snapshot();assert.equal(state.transfers.find(item=>item.id===transfer.id).status,'In Transit');assert.ok(await evaluate("document.body.textContent.includes('Transfer dispatched: '+"+JSON.stringify(transfer.refNo)+')'));
  await role('plantmanager');await action('confirmTransferReceipt',transfer.id,1,undefined,undefined,'B');state=await snapshot();assert.equal(state.transfers.find(item=>item.id===transfer.id).status,'Received');
  console.log('PASS actual Accounting Dispatch button and reference feedback connect request -> transfer -> receiving without extra material entry');
  const shared=await evaluate('qa.data()');
  for(const name of ['OWNER_SUPER_ADMIN','accounting','marketing','management','plantmanager','production']){
    await role(name);assert.deepEqual(await evaluate('qa.data()'),shared,name+' shares the same records');
    if(name!=='accounting'){const result=await action('dispatchTransfer',transfer.id);assert.equal(result.success,false);assert.deepEqual(await evaluate('qa.data()'),shared);}
    if(name!=='production'){const result=await action('finishWipBag','isolated-zero-wip');assert.equal(result.success,false);assert.deepEqual(await evaluate('qa.data()'),shared);}
  }
  await role('accounting','acc-transactions');await pause(200);
  const rows=await evaluate('qa.operational.operationalStockCard(qa.app.transactions,qa.app.finishedGoods)');assert.ok(rows.filter(row=>/Loaded|Consum/.test(row.transaction.transactionType)).every(row=>row.stockIn===0&&row.stockOut===0));
  assert.ok(await evaluate("document.body.textContent.includes('Material kg and Finished Pipe units are separate ledgers')"));
  const persisted=await evaluate('qa.data()');await reload();
  const reloaded=await evaluate('qa.data()'),expected=structuredClone(persisted);
  // Existing hydrateFinishedPipe fills this absent relationship on reload.
  // Permit ONLY that additive reference, retaining strict equality for every
  // quantity, identity, barcode, physical location, history and other property.
  for(const pipe of expected[1])if(pipe.source==='Stock Replenishment'&&!Object.hasOwn(pipe,'customerOrderId')&&pipe.reservedForOrderId){
    assert.ok(expected[3].some(order=>order.id===pipe.reservedForOrderId));pipe.customerOrderId=pipe.reservedForOrderId;
  }
  assert.deepEqual(reloaded,expected);
  await reload();assert.deepEqual(await evaluate('qa.data()'),reloaded);
  console.log('PASS all six roles share persisted operational data; new actions enforce roles; reload does not duplicate stock, output, pipes or movements');
  for(const width of [360,768,1280]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(100);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false);if(width!==768){const screenshot=await send('Page.captureScreenshot',{format:'png'}),file=path.join(profile,'movement-'+width+'.png');fs.writeFileSync(file,Buffer.from(screenshot.data,'base64'));console.log('SCREENSHOT '+file);}}
  assert.deepEqual(errors,[]);console.log('PASS process-flow browser verification; isolated profile '+profile);
}catch(error){if(socket?.readyState===WebSocket.OPEN)console.error(await evaluate('document.body.innerText').catch(()=>''));throw error;}finally{if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}chrome?.kill();await server.close();}
