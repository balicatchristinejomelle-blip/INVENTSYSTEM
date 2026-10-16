import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const executable = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!executable) throw Error('Set BROWSER_PATH to Chrome or Edge.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hpai-output-qa-'));
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AppProvider,useApp,USERS} from '/src/store';
import Orders from '/src/pages/production/ProductionOrders';
import Scanner from '/src/pages/production/BarcodeScanner';
import {ViewStateScope} from '/src/uiViewState';
import '/src/index.css';
const root=createRoot(document.getElementById('root'));
window.qa={};let baseline,version=0;
function Live(){const app=useApp();window.qa.app=app;if(!baseline)baseline=JSON.parse(JSON.stringify(app));return React.createElement(ViewStateScope,null,React.createElement('main',{className:'operational-content page-stack',style:{padding:16,maxWidth:'100%',minWidth:0}},React.createElement(app.currentPage==='prod-barcode'?Scanner:Orders)));}
window.qa.mount=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(AppProvider,{key:++version},React.createElement(Live))));
window.qa.seed=()=>{
 const user=USERS.find(user=>user.role==='production'),po=baseline.productionOrders.find(po=>po.targetQty===550);
 const bag=baseline.pellets.find(bag=>bag.grade===po.grade&&bag.inventoryStatus==='Available');
 const state={...baseline,currentUser:user,currentPage:'prod-orders',clockedIn:true,currentShift:'Day',pendingTurnover:null,turnovers:[],
 attendance:[{...baseline.attendance[0],id:'isolated-browser-output-session',employeeId:user.employeeId,status:'Active',shift:'Day'}],
 productionOrders:baseline.productionOrders.map(row=>row.id===po.id?{...row,unitWeightKg:0.1}:row),
 pellets:[bag],colorants:baseline.colorants.map(row=>({...row,availableKg:100})),materialUsageTransactions:[]};
 window.qa.poId=po.id;window.qa.poNo=po.poNo;window.qa.barcode=bag.barcode;window.qa.initialPipes=state.finishedGoods.length;window.qa.initialOutputs=state.transactions.filter(row=>row.transactionType==='Production Output').length;
 localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify(state));window.qa.mount();
};
window.qa.click=(text,scope=document)=>{const button=[...scope.querySelectorAll('button')].find(row=>row.textContent.trim()===text);if(!button)throw Error('Missing button: '+text);if(button.disabled)throw Error('Disabled button: '+text);button.click();};
window.qa.fill=(selector,value)=>{const input=document.querySelector(selector);if(!input)throw Error('Missing input: '+selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,String(value));input.dispatchEvent(new Event('input',{bubbles:true}));};
window.qa.mount();
`;
const server = await createServer({ cacheDir: path.join(profile, 'vite-cache'), server: { host: '127.0.0.1', port: 0, hmr: false }, plugins: [{
  name: 'isolated-production-output-qa', resolveId(id) { if (id === '/__output-qa.js') return '\0output-qa'; }, load(id) { if (id === '\0output-qa') return entry; },
  configureServer(server) { server.middlewares.use(async (req, res, next) => { if (req.url !== '/__output-qa') return next(); try { res.setHeader('Content-Type', 'text/html'); res.end(await server.transformIndexHtml('/__output-qa', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__output-qa.js"></script></body></html>')); } catch (error) { next(error); } }); },
}] });
let chrome, socket, id = 0;
const pending = new Map(), errors = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(probe, label, limit = 30000) { const end = Date.now() + limit; while (Date.now() < end) { try { if (await probe()) return; } catch {} await pause(100); } throw Error('Timed out: ' + label + ' / ' + errors.join('; ')); }
function send(method, params = {}) { return new Promise((resolve, reject) => { const request = ++id; const timer = setTimeout(() => { pending.delete(request); reject(Error('CDP timeout ' + method)); }, 30000); pending.set(request, { resolve: result => { clearTimeout(timer); resolve(result); }, reject }); socket.send(JSON.stringify({ id: request, method, params })); }); }
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; }
const click = text => evaluate('qa.click(' + JSON.stringify(text) + ')');
const fill = (selector, value) => evaluate('qa.fill(' + JSON.stringify(selector) + ',' + JSON.stringify(value) + ')');
try {
  await server.listen();
  chrome = spawn(executable, ['--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let target;
  await wait(async () => { const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); const pages = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); target = pages.find(page => page.type === 'page'); return target; }, 'isolated browser');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); if (message.id) { const request = pending.get(message.id); if (request) { pending.delete(message.id); if (message.error) request.reject(Error(message.error.message)); else request.resolve(message.result); } } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text); });
  await send('Runtime.enable'); await send('Page.enable');
  const url = 'http://127.0.0.1:' + server.httpServer.address().port + '/__output-qa';
  await send('Page.navigate', { url });
  await wait(() => evaluate('!!window.qa?.app'), 'provider');
  await evaluate('qa.seed()');
  await wait(() => evaluate("document.body.textContent.includes('Start Production')"), 'Ready PO action');
  const initial = await evaluate('({pipes:qa.initialPipes,outputs:qa.initialOutputs,poId:qa.poId,poNo:qa.poNo,barcode:qa.barcode})');
  await evaluate("qa.click('Start Production',[...document.querySelectorAll('tr')].find(row=>row.textContent.includes(qa.poNo)))");
  await wait(() => evaluate("document.body.textContent.includes('Record Production Output')"), 'output form');
  assert.equal(await evaluate('qa.app.activeProductionOrder.id'), initial.poId);
  assert.equal(await evaluate('qa.app.finishedGoods.length'), initial.pipes);
  assert.equal(await evaluate("qa.app.transactions.filter(row=>row.transactionType==='Production Output').length"), initial.outputs);
  console.log('PASS Ready / Scheduled PO starts with zero output and no fake pipes');
  await click('Review Materials'); await click('Load Pellet Bags');
  await wait(() => evaluate("qa.app.currentPage==='prod-barcode'"), 'scanner');
  await click('Enter Manually'); await fill('#manual-barcode-input', initial.barcode); await click('Submit');
  await wait(() => evaluate("qa.app.pellets[0].inventoryStatus==='Loaded'"), 'loaded WIP');
  await click('Return to Production Output');
  await wait(() => evaluate("document.body.textContent.includes('Record Production Output')"), 'restored output draft');
  console.log('PASS Actual material scan/load and draft return target the selected PO');
  async function outputEntry(qty, rejected) {
    await fill('input[placeholder="Enter total completed before rejects"]', qty);
    await fill('input[placeholder="0"]', rejected);
    await wait(() => evaluate('document.querySelectorAll(\'input[placeholder="Enter actual weight"]\').length===' + rejected), 'rejection fields');
    for (let index = 0; index < rejected; index++) {
      await evaluate(`(()=>{const input=document.querySelectorAll('input[placeholder="Enter actual weight"]')[${index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'0.2');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await evaluate(`document.querySelectorAll('[aria-label="Select reason"]')[${index}].click()`);
      await wait(() => evaluate("!![...document.querySelectorAll('[role=option]')].find(row=>row.textContent==='Surface Defect')"), 'reject reasons');
      await evaluate("[...document.querySelectorAll('[role=option]')].find(row=>row.textContent==='Surface Defect').click()");
    }
    assert.equal(await evaluate("Number([...document.querySelectorAll('.field-label')].find(row=>row.textContent==='Good Output').nextElementSibling.textContent)"), qty - rejected);
    await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(row=>row.textContent==='Record Output');button.click();button.click();})()");
    await wait(() => evaluate("document.body.textContent.includes('Output recorded successfully.')"), 'saved output');
    assert.equal(await evaluate("sessionStorage.getItem('hpai:production-output-draft')"), null);
    await wait(() => evaluate("!document.body.textContent.includes('Record Production Output')"), 'saved modal closes');
  }
  await outputEntry(50, 2);
  let result = await evaluate('(()=>{const po=qa.app.productionOrders.find(row=>row.id===' + JSON.stringify(initial.poId) + ');return [po.completedQty,po.totalGoodQty,po.totalRejectedQty,qa.app.finishedGoods.length]})()');
  assert.deepEqual(result, [50, 48, 2, initial.pipes + 48]);
  await click('Close');
  await click('In Progress (2)');
  assert.ok(await evaluate("[...document.querySelectorAll('tr')].find(row=>row.textContent.includes(" + JSON.stringify(initial.poNo) + ")).textContent.includes('50/550')"));
  await evaluate("qa.click('Continue / Record Output',[...document.querySelectorAll('tr')].find(row=>row.textContent.includes(" + JSON.stringify(initial.poNo) + ')))');
  await outputEntry(100, 3);
  result = await evaluate('(()=>{const po=qa.app.productionOrders.find(row=>row.id===' + JSON.stringify(initial.poId) + ');return [po.completedQty,po.totalGoodQty,po.totalRejectedQty,qa.app.finishedGoods.length]})()');
  assert.deepEqual(result, [150, 145, 5, initial.pipes + 145]);
  assert.ok(await evaluate("[...document.querySelectorAll('tr')].find(row=>row.textContent.includes(" + JSON.stringify(initial.poNo) + ")).textContent.includes('150/550')"));
  console.log('PASS Actual UI records 50/2 and 100/3 cumulatively: 150 output, 145 good pipes, 5 rejects');
  const stored = await evaluate("JSON.parse(localStorage.getItem('hpai:shared-app-state-v1'))");
  const outputs = stored.transactions.filter(row => row.transactionType === 'Production Output' && row.productionOutputEntryId);
  assert.equal(outputs.length, 2);
  const entryToRetry = outputs[0];
  assert.deepEqual(await evaluate('qa.app.recordOutput(' + JSON.stringify(initial.poId) + ',100,[],' + JSON.stringify(entryToRetry.productionOutputEntryId) + ')'), { success: true });
  assert.equal(await evaluate('qa.app.finishedGoods.length'), initial.pipes + 145);
  await send('Page.reload');
  await wait(() => evaluate('!!window.qa?.app'), 'persisted reload');
  assert.equal(await evaluate('qa.app.finishedGoods.length'), initial.pipes + 145);
  assert.equal(await evaluate("qa.app.transactions.filter(row=>row.productionOutputEntryId).length"), 2);
  await evaluate("qa.click('View',[...document.querySelectorAll('tr')].find(row=>row.textContent.includes(" + JSON.stringify(initial.poNo) + ')))');
  await wait(() => evaluate("document.body.textContent.includes('Production Output History')"), 'per-PO history');
  assert.equal(await evaluate("[...document.querySelectorAll('.modal-box tbody tr')].filter(row=>row.textContent.includes('BATCH-')).length"), 2);
  console.log('PASS Saved output history survives reload; retrying the saved entry creates no duplicate');
  for (const theme of ['light', 'dark']) for (const width of [360, 375, 390, 412, 430, 768, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate("document.documentElement.classList.toggle('dark'," + (theme === 'dark') + ')');
    await pause(70);
    const bounds = await evaluate("(()=>{const rect=document.querySelector('.modal-box').getBoundingClientRect();return {width:innerWidth,doc:document.documentElement.scrollWidth,left:rect.left,right:rect.right};})()");
    assert.ok(bounds.doc <= width + 1 && bounds.left >= -1 && bounds.right <= width + 1, JSON.stringify(bounds));
    if (width >= 768) assert.ok(await evaluate("(()=>{const wrap=document.querySelector('.modal-box .table-scroll');return wrap.scrollWidth<=wrap.clientWidth+1;})()"), 'Desktop history fits the existing dialog');
    if (theme === 'light' && [360, 1280].includes(width)) {
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(profile, 'production-output-history-' + width + '.png');
      fs.writeFileSync(file, Buffer.from(screenshot.data, 'base64')); console.log('SCREENSHOT ' + file);
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS Production details/history fit 7 widths × 2 themes; no runtime exceptions. Isolated profile: ' + profile);
} catch (error) {
  if (socket?.readyState === WebSocket.OPEN) console.error(await evaluate('document.body.innerText').catch(() => 'No browser diagnostics'));
  throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} socket.close(); }
  chrome?.kill(); await server.close();
}
