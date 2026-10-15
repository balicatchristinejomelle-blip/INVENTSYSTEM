import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const executable = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(file => fs.existsSync(file));
if (!executable) throw new Error('Set BROWSER_PATH to a Chrome or Edge executable for headless date-filter QA.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hpai-po-browser-'));
const entry = [
  "import React from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import { AppProvider, useApp, USERS } from '/src/store';",
  "import { ViewStateScope, VIEW_STATE_PREFIX } from '/src/uiViewState';",
  "import RecordReference from '/src/components/RecordReference';",
  "import { buildUniversalIndex } from '/src/components/UniversalSearch';",
  "import { referenceTargets } from '/src/recordReferences';",
  "import PMFinishedGoods from '/src/pages/plantmanager/FinishedGoods';",
  "import MarketingFinishedGoods from '/src/pages/marketing/FinishedGoods';",
  "import '/src/index.css';",
  "const PO = 'PO-2026-0012';",
  "const LONG = 'PO-2026-0012-EXTRA-LONG-REFERENCE-123456789012345678901234567890';",
  "let baseline, version = 0;",
  "const root = createRoot(document.getElementById('root'));",
  "window.__poQA = { ready: false, role: '', mode: '', rowClicked: false };",
  "function Capture() {",
  "  const app = useApp();",
  "  if (!baseline) baseline = JSON.parse(JSON.stringify(app));",
  "  window.__poQA.ready = true;",
  "  window.__poQA.currentPage = app.currentPage;",
  "  return null;",
  "}",
  "function Fixture() {",
  "  const app = useApp();",
  "  window.__poQA.clickable = referenceTargets(buildUniversalIndex(app), PO).length > 0;",
  "  return React.createElement('main', {className:'operational-content page-stack',style:{padding:16,boxSizing:'border-box',minWidth:0,maxWidth:'100%'}},",
  "    React.createElement('div',{'data-qa-role':app.currentUser.role},app.currentUser.role),",
  "    React.createElement('div',{className:'app-card table-scroll','data-testid':'po-table-container'},",
  "      React.createElement('table',{className:'app-table inventory-table'},",
  "        React.createElement('thead',null,React.createElement('tr',null,React.createElement('th',{className:'po-column'},'PO'),React.createElement('th',null,'Customer Order'),...['Barcode','Product','Grade / Size','Purpose','Status','Location','Print','Actions'].map(label=>React.createElement('th',{key:label},label)))),",
  "        React.createElement('tbody',null,[PO,LONG].map((reference,index)=>React.createElement('tr',{key:reference,onClick:()=>{window.__poQA.rowClicked=true;}},",
  "          React.createElement('td',{className:'font-mono po-column','data-testid':index?'long-po':'sample-po'},React.createElement(RecordReference,{value:reference})),",
  "          React.createElement('td',{'data-testid':'customer-order'},'SO-2026-0058'),...['110617BB-SN007-EXTRA-LONG-12345678901234567890','HDPE Pipe','PE100 · 110mm · SDR17 · 6m','Temporary Storage','Awaiting Storage','Production Area / Awaiting Storage / Extended Location Path','REPRINT APPROVED','View Details'].map((value,i)=>React.createElement('td',{key:i},React.createElement(i===7?'button':'span',{className:i===4?'badge-amber':i===7?'btn-secondary btn-compact':undefined},value)))",
  "        )))",
  "      )",
  "    )",
  "  );",
  "}",
  "window.__poQA.mount = (role,mode='table') => {",
  "  const user = USERS.find(user=>user.role===role), currentPage='po-qa-'+role+'-'+mode;",
  "  const original=baseline.productionOrders.find(order=>order.poNo===PO);",
  "  localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify({...baseline,currentUser:user,currentPage,productionOrders:[...baseline.productionOrders,{...original,id:'qa-long-po',poNo:LONG}]}));",
  "  sessionStorage.clear();",
  "  if(mode==='individual'){",
  "    const page=role==='plantmanager'?'plantmanager/FinishedGoods':'marketing/FinishedGoods';",
  "    const prefix=VIEW_STATE_PREFIX+user.employeeId+':'+role+':'+currentPage+':';",
  "    sessionStorage.setItem(prefix+page+':viewMode',JSON.stringify('Individual Pipes'));",
  "    if(role==='marketing')sessionStorage.setItem(prefix+page+':status',JSON.stringify('Available'));",
  "  }",
  "  window.__poQA.expectedPO=role==='marketing'?'PO-2026-0014':PO;window.__poQA.role=role;window.__poQA.mode=mode;window.__poQA.rowClicked=false;",
  "  const Page=mode==='individual'?(role==='plantmanager'?PMFinishedGoods:MarketingFinishedGoods):Fixture;",
  "  root.render(React.createElement(AppProvider,{key:role+mode+(++version)},React.createElement(Capture),React.createElement(ViewStateScope,null,React.createElement('div',{className:'operational-content',style:{minWidth:0,maxWidth:'100%'}},React.createElement(Page)))));",
  "};",
  "root.render(React.createElement(AppProvider,null,React.createElement(Capture)));",
  ""
].join('\n');

const server = await createServer({
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{
    name: 'po-reference-browser-qa',
    resolveId(id) { if (id === '/__po-reference-qa.js') return '\0po-reference-browser-qa.js'; },
    load(id) { if (id === '\0po-reference-browser-qa.js') return entry; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__po-reference-qa') return next();
        try {
          const html = await server.transformIndexHtml('/__po-reference-qa', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__po-reference-qa.js"></script></body></html>');
          res.setHeader('Content-Type', 'text/html');res.end(html);
        } catch (error) { next(error); }
      });
    },
  }],
});
let chrome, socket, stopped = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const pending = new Map();
let nextId = 0, browserErrors = [];
async function waitFor(probe, label, limit = 30000) {
  const end = Date.now() + limit;
  while (Date.now() < end) { try { const value = await probe(); if (value) return value; } catch {} await pause(100); }
  throw new Error('Timed out: ' + label + (browserErrors.length ? ' / ' + browserErrors.join('; ') : ''));
}
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id);reject(new Error('CDP timeout: ' + method)); }, method === 'Page.navigate' ? 45000 : 15000);
    pending.set(id, { resolve: value => {clearTimeout(timer);resolve(value);}, reject: error => {clearTimeout(timer);reject(error);} });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
  return result.result.value;
}

try {
  await server.listen();
  const address = server.httpServer.address();
  const port = address.port, debugPort = 0;
  chrome = spawn(executable, ['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port='+debugPort,'--user-data-dir='+profile,'about:blank'], { windowsHide:true, stdio:'ignore' });
  chrome.on('error', error => {browserErrors.push(error.message);});
  const target = await waitFor(async () => {
    const actualPort=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0].trim();
    const response = await fetch('http://127.0.0.1:'+actualPort+'/json');
    return (await response.json()).find(target=>target.type==='page');
  }, 'headless browser startup', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message', event => {
    const message=JSON.parse(event.data);
    if(message.id){const waiter=pending.get(message.id);if(!waiter)return;pending.delete(message.id);if(message.error)waiter.reject(new Error(JSON.stringify(message.error)));else waiter.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
  });
  await send('Runtime.enable');await send('Page.enable');
  await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/__po-reference-qa'});
  await waitFor(()=>evaluate("window.__poQA?.ready"),'PO QA fixture ready',45000);
  const po='PO-2026-0012';
  for(const role of ['OWNER_SUPER_ADMIN','accounting','marketing','management','plantmanager','production']){
    await evaluate("window.__poQA.mount("+JSON.stringify(role)+")");
    await waitFor(()=>evaluate("document.querySelector('[data-qa-role]')?.textContent==="+JSON.stringify(role)),'render '+role);
    assert.equal(await evaluate("document.querySelector('[data-testid=\"sample-po\"] .po-reference').textContent"),po);
    const clickable=await evaluate('window.__poQA.clickable');
    assert.equal(await evaluate("!!document.querySelector('[data-testid=\"sample-po\"] button.po-reference')"),clickable);
    if(clickable){
      const pageBefore=await evaluate('window.__poQA.currentPage');
      await evaluate("document.querySelector('[data-testid=\"sample-po\"] button.po-reference').click()");
      await waitFor(()=>evaluate("!!document.querySelector('[aria-modal=\"true\"]')"),'open authorized PO');
      const detail=await evaluate("document.querySelector('[aria-modal=\"true\"]').textContent");
      assert.ok(detail.includes('Related record · '+po));
      assert.ok(detail.includes('PRODUCTION ORDERS'));
      assert.equal(await evaluate('window.__poQA.rowClicked'),false);
      assert.equal(await evaluate('window.__poQA.currentPage'),pageBefore);
      await evaluate("Array.from(document.querySelector('[aria-modal=\"true\"]').querySelectorAll('button')).find(button=>button.textContent==='Close').click()");
      await waitFor(()=>evaluate("!document.querySelector('[aria-modal=\"true\"]')"),'close PO');
      console.log('PASS '+role+': existing PO link opens the correct read-only record');
    } else console.log('PASS '+role+': reference remains readable without expanding role access');
    for(const theme of ['light','dark']){
      await evaluate("document.documentElement.classList.toggle('dark',"+JSON.stringify(theme==='dark')+")");
      for(const width of [360,375,390,412,430,768,1280]){
        await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
        await pause(50);
        const metrics=await evaluate("(()=>{const wrap=document.querySelector('[data-testid=\"po-table-container\"]');const cells=[...document.querySelectorAll('td.po-column')].map(cell=>{const ref=cell.querySelector('.po-reference');const range=document.createRange();range.selectNodeContents(ref);const lines=[...range.getClientRects()];const rect=ref.getBoundingClientRect(),box=cell.getBoundingClientRect(),neighbor=cell.nextElementSibling.getBoundingClientRect(),style=getComputedStyle(ref);return {text:ref.textContent,lineCount:lines.length,width:box.width,nowrap:style.whiteSpace,breakWord:style.wordBreak,wrapWord:style.overflowWrap,inside:rect.left>=box.left&&rect.right<=box.right,apart:rect.right<=neighbor.left,visible:ref.scrollWidth<=ref.clientWidth+1||ref.tagName==='SPAN'};});wrap.scrollLeft=10000;const scrolled=wrap.scrollLeft;wrap.scrollLeft=0;return {cells,scrollable:wrap.scrollWidth>wrap.clientWidth,scrolled,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth};})()");
        assert.ok(metrics.documentWidth<=metrics.viewport+1,role+' '+width+' page overflow');
        for(const cell of metrics.cells){
          assert.equal(cell.lineCount,1,role+' '+width+' wrapped '+cell.text);
          assert.equal(cell.nowrap,'nowrap');assert.equal(cell.breakWord,'keep-all');assert.equal(cell.wrapWord,'normal');
          assert.ok(cell.width>=150);assert.ok(cell.inside&&cell.apart&&cell.visible,JSON.stringify(cell));
        }
        const fields=await evaluate("(()=>[...document.querySelectorAll('[data-testid=po-table-container] td')].map(cell=>{const rects=[],walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);while(walker.nextNode()){if(!walker.currentNode.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(walker.currentNode);rects.push(...range.getClientRects());}const ys=new Set(rects.filter(r=>r.width>0).map(r=>Math.round(r.top)));const box=cell.getBoundingClientRect();return {text:cell.textContent,lines:ys.size,inside:rects.every(r=>r.left>=box.left-1&&r.right<=box.right+1)};}))()");
        for(const cell of fields){assert.equal(cell.lines,1,role+' '+width+' wrapped field '+cell.text);assert.ok(cell.inside,role+' clipped '+cell.text);}
        if(width<600){assert.ok(metrics.scrollable);assert.ok(metrics.scrolled>0);}
      }
    }
    console.log('PASS '+role+': normal/long PO values stay on one line with clear neighboring columns; 7 widths, 2 themes');
  }
  for(const role of ['plantmanager','marketing']){
    await evaluate("window.__poQA.mount("+JSON.stringify(role)+",'individual')");
    await waitFor(()=>evaluate("Array.from(document.querySelectorAll('td.po-column')).some(cell=>cell.textContent===window.__poQA.expectedPO)"),role+' actual Individual Pipes table',45000);
    for(const width of [390,768,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
      await pause(100);
      const result=await evaluate("(()=>{const cells=[...document.querySelectorAll('td.po-column')].filter(cell=>cell.textContent===window.__poQA.expectedPO&&cell.getBoundingClientRect().width>0);return cells.map(cell=>{const ref=cell.querySelector('.po-reference');const range=document.createRange();range.selectNodeContents(ref);const rect=ref.getBoundingClientRect(),box=cell.getBoundingClientRect(),next=cell.nextElementSibling.getBoundingClientRect();return {lines:range.getClientRects().length,inside:rect.right<=box.right,apart:rect.right<=next.left};});})()");
      const inventory=await evaluate("(()=>{const table=document.querySelector('.inventory-table'),wrap=table.closest('.table-scroll');const cells=[...table.querySelectorAll('th,td')].filter(cell=>cell.getBoundingClientRect().width>0).map(cell=>{const box=cell.getBoundingClientRect(),ys=new Set();let inside=true;const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);while(walker.nextNode()){if(!walker.currentNode.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(walker.currentNode);for(const r of range.getClientRects()){ys.add(Math.round(r.top));inside=inside&&r.left>=box.left-1&&r.right<=box.right+1;}}return {text:cell.textContent,lines:ys.size,inside};});wrap.scrollLeft=100000;const scroll=wrap.scrollLeft;wrap.scrollLeft=0;return {cells,scroll,overflow:document.documentElement.scrollWidth>innerWidth+1};})()");
      for(const cell of inventory.cells){assert.equal(cell.lines,1,role+' '+width+' wrapped '+cell.text);assert.ok(cell.inside,role+' clipped '+cell.text);}
      assert.equal(inventory.overflow,false,role+' page overflow');
      if(width<800)assert.ok(inventory.scroll>0,role+' horizontal scroll');

      assert.ok(result.length>0,role+' individual table is visible at '+width);
      for(const cell of result){assert.equal(cell.lines,1);assert.ok(cell.inside&&cell.apart);}
      if(width===1280){
        const screenshot=await send('Page.captureScreenshot',{format:'png'});
        const file=path.join(os.tmpdir(),'hpai-po-individual-'+role+'.png');
        fs.writeFileSync(file,Buffer.from(screenshot.data,'base64'));console.log('SCREENSHOT '+file);
      }
    }
    await evaluate("[...document.querySelectorAll('.inventory-table button')].find(button=>button.textContent==='View Details').click()");
    await waitFor(()=>evaluate("!!document.querySelector('[aria-modal=true]')"),role+' View Details opens');
    await evaluate("document.querySelector('[aria-modal=true] .modal-close').click()");
    await waitFor(()=>evaluate("!document.querySelector('[aria-modal=true]')"),role+' close details');
    console.log('PASS actual '+role+' Individual Pipes: '+(await evaluate('window.__poQA.expectedPO'))+' stays intact and adjacent columns do not overlap');
  }
  assert.deepEqual(browserErrors,[]);
  console.log('PASS PO browser QA: six roles, correct authorized links, normal/long references, no clipping/overlap, horizontal scrolling and actual Individual Pipes tables.');

} finally {
  stopped=true;
  if(socket&&socket.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  if(chrome)chrome.kill();
  await server.close();
  // The unique temporary browser profile is retained for inspection; no user profile is touched.
}
