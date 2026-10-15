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
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hpai-date-browser-'));
const entry = [
"import React, { useState } from 'react';",
"import { createRoot } from 'react-dom/client';",
"import PeriodSelector, { usePeriod } from '/src/components/PeriodSelector';",
"import { businessToday, dateInPeriod } from '/src/datePeriods';",
"import { matchesRecord } from '/src/components/RecordSearch';",
"import '/src/index.css';",
"const today=businessToday();window.__dateQA={today};",
"const records=[{id:'today',date:today},{id:'specific',date:'2026-10-08'},{id:'old',date:'2025-01-01'}];",
"function App(){const [search,setSearch]=useState('');const period=usePeriod('all',search);const visible=records.filter(record=>dateInPeriod(record.date,period.range)&&matchesRecord(record,search));",
"return React.createElement('main',{className:'operational-content page-stack',style:{padding:16,boxSizing:'border-box',maxWidth:'100%',minWidth:0}},React.createElement(PeriodSelector,{period,search,onSearchChange:setSearch}),React.createElement('output',{'data-testid':'results'},visible.map(record=>record.id).join('|')));}",
"import { AppProvider, useApp, USERS } from '/src/store';",
"import RejectedRecycling from '/src/pages/plantmanager/RejectedRecycling';",
"import { effectiveDateRange } from '/src/datePeriods';",
"let baseline;function Capture(){const app=useApp();if(!baseline)baseline=JSON.parse(JSON.stringify(app));window.__dateQA.state=JSON.stringify([app.rejectedMaterials,app.recyclingBatches,app.totalRejectedKg]);return null;}",
"const root=createRoot(document.getElementById('root'));",
"window.__dateQA.mountRejected=()=>{const user=USERS.find(user=>user.role==='plantmanager');localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify({...baseline,currentUser:user,currentPage:'rejected-layout-qa'}));sessionStorage.clear();root.render(React.createElement(AppProvider,{key:'rejected'},React.createElement(Capture),React.createElement('main',{className:'operational-content',style:{padding:16,minWidth:0,maxWidth:'100%',boxSizing:'border-box'}},React.createElement(RejectedRecycling))));};",
"window.__dateQA.expected=(scope)=>{const range=effectiveDateRange(scope,'',businessToday());return baseline.rejectedMaterials.filter(r=>dateInPeriod(r.date,range)).map(r=>r.rejectionId);};",
"root.render(React.createElement(AppProvider,null,React.createElement(Capture),React.createElement(App)));"
].join('\n');
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{
    name: 'date-period-browser-qa',
    resolveId(id) { if (id === '/__date-period-qa.js') return '\0date-period-browser-qa.js'; },
    load(id) { if (id === '\0date-period-browser-qa.js') return entry; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__date-period-qa') return next();
        try {
          const html = await server.transformIndexHtml('/__date-period-qa', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__date-period-qa.js"></script></body></html>');
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
  throw new Error('Timed out: ' + label);
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
const selected = () => evaluate("document.querySelector('.date-period-button[aria-pressed=\"true\"]')?.textContent");
async function clickPeriod(label) {
  await evaluate("Array.from(document.querySelectorAll('.date-period-button')).find(button=>button.textContent==="+JSON.stringify(label)+").click()");
  await waitFor(async () => await selected() === label, 'select ' + label);
}
async function setSearch(value) {
  await evaluate("(()=>{const input=document.querySelector('input[type=\"search\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,"+JSON.stringify(value)+");input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await pause(100);
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
  }, 'headless browser startup',60000);
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
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/__date-period-qa'});
  await waitFor(()=>evaluate("document.querySelectorAll('.date-period-button').length===5"),'period controls render', 45000);
  console.log('PASS actual browser renders shared period controls');
  for(const label of ['Day','Week','Month','Year','All']) {
    await clickPeriod(label);
    if(label==='Day')assert.ok((await evaluate("document.querySelector('output').textContent")).includes('today'));
    if(label!=='All')assert.ok(!(await evaluate("document.querySelector('output').textContent")).includes('old'));
    else assert.ok((await evaluate("document.querySelector('output').textContent")).includes('old'));
    console.log('PASS browser period selection '+label);
  }
  await clickPeriod('Day');
  for(const query of ['10/08/2026','2026-10-08','Oct 8, 2026','October 8, 2026']) {
    await setSearch(query);
    assert.ok((await evaluate("document.querySelector('output').textContent")).includes('specific'));
    const today=await evaluate("window.__dateQA.today");
    if(today!=='2026-10-08')assert.ok(!(await evaluate("document.querySelector('output').textContent")).includes('today'));
    assert.ok(await evaluate("!!document.querySelector('[aria-label=\"Clear specific date search\"]')"));
    console.log('PASS browser exact-date precedence '+query);
  }
  await evaluate("document.querySelector('[aria-label=\"Clear specific date search\"]').click()");
  await waitFor(() => evaluate("document.querySelector('input[type=\"search\"]').value===''"), 'clear exact search');
  assert.equal(await selected(),'Day');
  assert.ok((await evaluate("document.querySelector('output').textContent")).includes('today'));
  console.log('PASS clear exact date restores selected Day');
  await clickPeriod('All');
  await evaluate("document.querySelector('input[type=\"search\"]').focus()");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await evaluate('document.activeElement.textContent'),'All');
  await evaluate("Array.from(document.querySelectorAll('.date-period-button')).find(button=>button.textContent==='Day').focus()");
  assert.equal(await evaluate('document.activeElement.textContent'),'Day');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await waitFor(async()=>await selected()==='Day','keyboard activates Day');
  console.log('PASS keyboard Tab navigation and Enter activation');
  const themeColors = new Map();
  for(const theme of ['light','dark']){
    await evaluate("document.documentElement.classList.toggle('dark',"+JSON.stringify(theme==='dark')+")");
    themeColors.set(theme,await evaluate("getComputedStyle(document.documentElement).getPropertyValue('--card-bg').trim()"));
    for(const width of [360,375,390,412,430,768,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
      await pause(100);
      const metrics=await evaluate("(()=>{const group=document.querySelector('.date-period-buttons');const buttons=[...group.querySelectorAll('button')].map(button=>{const rect=button.getBoundingClientRect();return {height:rect.height,width:rect.width,x:rect.x,right:rect.right};});const summary=document.querySelector('.date-period-summary');const text=summary.querySelector('span').getBoundingClientRect();const clear=summary.querySelector('button').getBoundingClientRect();return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,groupOverflow:group.scrollWidth>group.clientWidth+1,summaryAlignment:Math.abs((text.top+text.bottom-clear.top-clear.bottom)/2),buttons};})()");
      assert.ok(metrics.scroll<=metrics.viewport+1,theme+' '+width+' page overflow: '+JSON.stringify(metrics));
      assert.equal(metrics.groupOverflow,false);
      assert.ok(metrics.summaryAlignment<=1,'Clear button must align with its date scope');
      assert.equal(new Set(metrics.buttons.map(button=>button.height)).size,1);
      assert.ok(metrics.buttons.every(button=>button.width>=42&&button.height>=32&&button.x>=0&&button.right<=metrics.viewport+1),theme+' '+width+' button metrics: '+JSON.stringify(metrics));
      console.log('PASS '+theme+' '+width+'px: no horizontal overflow; equal, readable buttons');
      if(width===390||width===1280){
        const screenshot=await send('Page.captureScreenshot',{format:'png'});
        const file=path.join(os.tmpdir(),'hpai-date-period-'+theme+'-'+width+'.png');
        fs.writeFileSync(file,Buffer.from(screenshot.data,'base64'));console.log('SCREENSHOT '+file);
      }
    }
  }
  assert.notEqual(themeColors.get('light'),themeColors.get('dark'),'Light and dark checks must use distinct theme tokens');

  await evaluate('window.__dateQA.mountRejected()');
  await waitFor(()=>evaluate("document.body.textContent.includes('Rejected Material')"),'actual Rejected & Recycling page');
  const recordsBefore=await evaluate('window.__dateQA.state');
  for(const width of [360,375,390,412,430,768,1280]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
    for(const label of ['All','Day','Week','Month','Year']){
      await clickPeriod(label);
      const metrics=await evaluate("(()=>{const filter=document.querySelector('.date-period-filter'),buttons=[...filter.querySelectorAll('.date-period-button')].map(b=>{const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,width:r.width};}),summary=filter.querySelector('.date-period-summary'),span=summary?.querySelector('span'),range=document.createRange();if(span)range.selectNodeContents(span);const warning=document.querySelector('[class^=alert-]');return {tops:[...new Set(buttons.map(b=>Math.round(b.top)))],buttons,lines:span?range.getClientRects().length:0,text:span?.textContent,nowrap:span?getComputedStyle(span).whiteSpace:null,filterWidth:filter.getBoundingClientRect().width,gap:warning.getBoundingClientRect().top-filter.getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth+1};})()");
      if(width>=768)assert.equal(metrics.tops.length,1,'desktop/tablet buttons horizontal '+width+' '+label);
      assert.ok(metrics.filterWidth>width-80,'toolbar has usable width '+JSON.stringify(metrics));
      assert.equal(metrics.overflow,false);
      assert.ok(metrics.gap>=0&&metrics.gap<100,'compact warning placement '+metrics.gap);
      if(label!=='All'){assert.equal(metrics.lines,1);assert.equal(metrics.nowrap,'nowrap');assert.ok(metrics.text.startsWith('Period: '));}
      const expected=await evaluate('window.__dateQA.expected('+JSON.stringify(label.toLowerCase())+')');
      const rendered=await evaluate("[...document.querySelectorAll('.app-table')][0].textContent");
      for(const id of expected)assert.ok(rendered.includes(id),label+' missing '+id);
      assert.equal(await evaluate('window.__dateQA.state'),recordsBefore,'filters preserve records/totals');
    }
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    if(width===390||width===1280)fs.writeFileSync(path.join(os.tmpdir(),'hpai-rejected-period-'+width+'.png'),Buffer.from(screenshot.data,'base64'));
    console.log('PASS actual Rejected & Recycling '+width+'px: all selections, horizontal desktop buttons, one-line summary, compact warning/KPIs/table, preserved records');
  }
  assert.deepEqual(browserErrors,[]);
  console.log('PASS browser date-filter QA: selection, date precedence, clearing, keyboard, 7 widths and both themes.');
} finally {
  stopped=true;
  if(socket&&socket.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  if(chrome)chrome.kill();
  await server.close();
  // The unique temporary browser profile is retained for inspection; no user profile is touched.
}
