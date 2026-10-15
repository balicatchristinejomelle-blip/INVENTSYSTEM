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
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hpai-smart-browser-'));
const entry = "\nimport React, { useState } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport InventoryFacetFields from '/src/components/InventoryFacetFields';\nimport { inventoryFacetRow, matchesFacets } from '/src/inventoryFacets';\nimport PeriodSelector, { usePeriod } from '/src/components/PeriodSelector';\nimport { businessToday } from '/src/datePeriods';\nimport { AppProvider, useApp, USERS } from '/src/store';\nimport { ViewStateScope, VIEW_STATE_PREFIX } from '/src/uiViewState';\nimport Owner from '/src/pages/owner/Records';\nimport Accounting from '/src/pages/accounting/RawMaterials';\nimport Marketing from '/src/pages/marketing/FinishedGoods';\nimport Management from '/src/pages/management/Operations';\nimport Plant from '/src/pages/plantmanager/FinishedGoods';\nimport Production from '/src/pages/production/FinishedPipes';\nimport '/src/index.css';\nconst root=createRoot(document.getElementById('root'));\nwindow.__smartQA={ready:false};\nlet baseline,version=0;\nconst pages={OWNER_SUPER_ADMIN:Owner,accounting:Accounting,marketing:Marketing,management:Management,plantmanager:Plant,production:Production};\nconst fieldNames=['Product','Material Grade','Color','Size / Diameter','SDR / Thickness','Location','Storage Purpose','Status'];\nconst keys=['product','grade','color','size','sdr','location','purpose','status'];\nconst make=(location,extra={})=>inventoryFacetRow({product:'HDPE Pipe',grade:'PE100',color:'Black (BK)',diameter:'20mm',sdr:'SDR11',currentLocation:location,status:'Available',...extra},{purpose:'Inventory Storage'});\nconst fixtures=[make('A'),make('C'),make('F'),make('H',{grade:'PE80',sdr:'SDR17',diameter:'25mm',color:'Blue'})];\nfunction Capture(){const app=useApp();if(!baseline)baseline=JSON.parse(JSON.stringify(app));window.__smartQA.ready=true;window.__smartQA.role=app.currentUser?.role;return null;}\nfunction Fixture(){\n const [value,setValue]=useState(Object.fromEntries(keys.map(key=>[key,'']))),[search,setSearch]=useState('');\n const period=usePeriod('all',search);\n window.__smartQA.value=value;window.__smartQA.period=period;window.__smartQA.today=businessToday();window.__smartQA.matches=fixtures.filter(row=>matchesFacets(row,value)).length;\n return React.createElement('main',{className:'operational-content page-stack',style:{padding:16,minWidth:0,maxWidth:'100%',boxSizing:'border-box'}},\n  React.createElement(PeriodSelector,{period,search,onSearchChange:setSearch}),\n  React.createElement(InventoryFacetFields,{rows:fixtures,fields:keys.map((key,index)=>({key,label:fieldNames[index]})),value,onChange:setValue}),\n  React.createElement('output',null,window.__smartQA.matches+' matching inventory records'),\n  React.createElement('div',{className:'app-card table-scroll','data-testid':'bucket-table'},React.createElement('table',{className:'app-table inventory-bucket-table'},\n   React.createElement('thead',null,React.createElement('tr',null,['Product','Available','Reserved','Temporary Storage','Ready for Ship Out','On Hand'].map(label=>React.createElement('th',{key:label},label)))),\n   React.createElement('tbody',null,React.createElement('tr',null,['HDPE Pipe',5,0,0,2,7].map((value,index)=>React.createElement('td',{key:index,className:index?'inventory-number':''},value)))))));\n}\nwindow.__smartQA.mount=(role='fixture')=>{\n window.__smartQA.ready=false;\n if(role==='fixture'){root.render(React.createElement(Fixture,{key:++version}));window.__smartQA.ready=true;return;}\n const user=USERS.find(user=>user.role===role),currentPage='smart-browser-qa';\n localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify({...baseline,currentUser:user,currentPage}));\n const prefix=VIEW_STATE_PREFIX+user.employeeId+':'+role+':'+currentPage+':';\n const prefs=role==='OWNER_SUPER_ADMIN'?{'owner/Records:area':'Inventory & Finished Goods','owner/Records:section':'Finished Pipes'}:role==='management'?{'management/Operations:tab':'orders'}:role==='marketing'?{'marketing/FinishedGoods:viewMode':'By Batch','marketing/FinishedGoods:status':'All Statuses'}:role==='plantmanager'?{'plantmanager/FinishedGoods:viewMode':'By Batch'}:role==='production'?{'production/FinishedPipes:activeTab':'All Statuses'}:{};\n for(const[name,value]of Object.entries(prefs))sessionStorage.setItem(prefix+name,JSON.stringify(value));\n root.render(React.createElement(AppProvider,{key:++version},React.createElement(Capture),React.createElement(ViewStateScope,null,React.createElement('main',{className:'operational-content page-stack',style:{padding:16,minWidth:0,maxWidth:'100%',boxSizing:'border-box'}},React.createElement(pages[role])))));\n};\nroot.render(React.createElement(AppProvider,null,React.createElement(Capture)));\n";
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{
    name: 'smart-inventory-browser-qa',
    resolveId(id) { if (id === '/__smart-inventory-qa.js') return '\0smart-inventory-browser-qa.js'; },
    load(id) { if (id === '\0smart-inventory-browser-qa.js') return entry; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__smart-inventory-qa') return next();
        try {
          const html = await server.transformIndexHtml('/__smart-inventory-qa', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__smart-inventory-qa.js"></script></body></html>');
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
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/__smart-inventory-qa'});
  await waitFor(()=>evaluate("window.__smartQA?.ready"),'Smart QA fixture ready',90000);

  await evaluate("window.__smartQA.mount()");
  await waitFor(()=>evaluate("document.querySelectorAll('.inventory-facet-grid [role=combobox]').length===8"),'eight facet controls');
  async function choose(label,value){
    await evaluate("(()=>{const input=document.querySelector('.inventory-facet-grid input[aria-label="+JSON.stringify(label)+"]');input.focus();input.click();})()");
    await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'open '+label);
    const available=await evaluate("[...document.querySelectorAll('[role=option]')].map(option=>option.textContent)");
    assert.ok(available.includes(value),label+' options: '+available);
    await evaluate("[...document.querySelectorAll('[role=option]')].find(option=>option.textContent==="+JSON.stringify(value)+").click()");
    await pause(60);
  }
  await choose('SDR / Thickness','SDR11');
  assert.deepEqual(await evaluate("({grade:window.__smartQA.value.grade,size:window.__smartQA.value.size,color:window.__smartQA.value.color,location:window.__smartQA.value.location})"),{grade:'PE100',size:'20mm',color:'Black',location:''});
  await evaluate("(()=>{const input=document.querySelector('.inventory-facet-grid input[aria-label=Location]');input.focus();input.click();})()");
  await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'location options');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=option]')].map(option=>option.textContent)"),['All Matching Locations','A','C','F']);
  await evaluate("document.querySelector('.inventory-facet-grid input[aria-label=Location]').blur()");
  await choose('Location','C');
  assert.equal(await evaluate('window.__smartQA.matches'),1);
  await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent==='Clear All').click()");
  await pause(80);
  assert.equal(await evaluate('window.__smartQA.matches'),4);
  assert.ok(Object.values(await evaluate('window.__smartQA.value')).every(value=>value===''));
  await choose('Location','H');
  assert.equal(await evaluate('window.__smartQA.value.grade'),'PE80');
  assert.equal(await evaluate('window.__smartQA.value.sdr'),'SDR17');
  console.log('PASS browser: SDR first; unique auto-selection; actual A/C/F options without guessing; Location first; Clear All');
  for(const [scope,previous,next]of [['Day','2026-10-14','2026-10-15'],['Week','2026-10-05','2026-10-12'],['Month','2026-09-01','2026-10-01'],['Year','2025-01-01','2026-01-01']]){
    await evaluate("window.__smartQA.period.setDate('2026-10-15')");
    await pause(30);
    await evaluate("[...document.querySelectorAll('.date-period-buttons button')].find(button=>button.textContent==="+JSON.stringify(scope)+").click()");
    await pause(30);
    await evaluate("document.querySelector('.date-previous').click()");
    await pause(30);assert.equal(await evaluate('window.__smartQA.period.range.start'),previous);
    await evaluate("document.querySelector('.date-next').click()");
    await pause(30);assert.equal(await evaluate('window.__smartQA.period.range.start'),next);
    assert.ok(await evaluate("document.querySelector('.date-active-range').textContent.length>3"));
  }
  await evaluate("window.__smartQA.period.setDate('2027-01-31')");
  await pause(30);
  await evaluate("[...document.querySelectorAll('.date-period-buttons button')].find(button=>button.textContent==='Month').click()");
  await pause(30);await evaluate("document.querySelector('.date-previous').click()");
  await pause(30);assert.equal(await evaluate('window.__smartQA.period.range.start'),'2026-12-01');
  await evaluate("document.querySelector('.date-next').click()");
  await pause(30);assert.equal(await evaluate('window.__smartQA.period.range.start'),'2027-01-01');
  console.log('PASS browser: Previous/Next Day/Week/Month/Year, Monday-Sunday, December/January boundary, visible active range');
  // Exercise real keyboard events on the date controls.
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await evaluate("document.querySelector('.date-previous').focus()");
  assert.ok(await evaluate("document.activeElement===document.querySelector('.date-previous')"),'keyboard focus reaches Previous');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await pause(50);assert.equal(await evaluate('window.__smartQA.period.range.start'),'2026-12-01');
  for(const theme of ['light','dark']){
    await evaluate("document.documentElement.classList.toggle('dark',"+JSON.stringify(theme==='dark')+")");
    for(const width of [360,375,390,412,430,768,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(60);
      const metrics=await evaluate("(()=>{const grid=document.querySelector('.inventory-facet-grid'),fields=[...grid.children].map(node=>node.getBoundingClientRect()),chips=document.querySelector('.inventory-facet-panel .active-filter-summary'),panel=grid.parentElement.getBoundingClientRect(),table=document.querySelector('[data-testid=bucket-table]'),buttons=[...document.querySelectorAll('.date-navigation-controls button')].map(node=>node.getBoundingClientRect());return {page:document.documentElement.scrollWidth,viewport:innerWidth,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,firstRow:fields.filter(rect=>Math.abs(rect.top-fields[0].top)<2).length,chipWidth:chips.getBoundingClientRect().width,panelWidth:panel.width,searchAlignment:getComputedStyle(document.querySelector('.record-search')).textAlign,numbers:[...document.querySelectorAll('td.inventory-number')].map(node=>({align:getComputedStyle(node).textAlign,space:getComputedStyle(node).whiteSpace})),scrollable:table.scrollWidth>table.clientWidth,buttons:buttons.map(rect=>({left:rect.left,right:rect.right,width:rect.width})),label:document.querySelector('.date-active-range').getBoundingClientRect().width};})()");
      assert.ok(metrics.page<=metrics.viewport+1,JSON.stringify({theme,width,...metrics}));
      assert.equal(metrics.searchAlignment,'left');
      if(width===1280){assert.equal(metrics.columns,4);assert.equal(metrics.firstRow,4);}
      assert.ok(Math.abs(metrics.chipWidth-metrics.panelWidth)<2,'full-width active strip');
      for(const number of metrics.numbers){assert.equal(number.align,'center');assert.equal(number.space,'nowrap');}
      for(const button of metrics.buttons){assert.ok(button.width>25&&button.left>=0&&button.right<=width+1,'reachable date controls');}
      if(width<1152)assert.ok(metrics.scrollable);assert.ok(metrics.label>0);
      if(width===390||width===1280){const shot=await send('Page.captureScreenshot',{format:'png'});const file=path.join(os.tmpdir(),'hpai-smart-'+theme+'-'+width+'.png');fs.writeFileSync(file,Buffer.from(shot.data,'base64'));console.log('SCREENSHOT '+file);}
    }
  }
  console.log('PASS browser: 4+4 desktop, full-width chips, left search, centered distinct numeric cells, internal scroll, keyboard, two themes, seven widths');
  for(const role of ['OWNER_SUPER_ADMIN','accounting','marketing','management','plantmanager','production']){
    await evaluate("window.__smartQA.mount("+JSON.stringify(role)+")");
    await waitFor(()=>evaluate("window.__smartQA.ready&&window.__smartQA.role==="+JSON.stringify(role)+"&&!!document.querySelector('.inventory-facet-grid')"),role+' inventory page');
    for(const theme of ['light','dark'])for(const width of [360,375,390,412,430,768,1280]){
      await evaluate("document.documentElement.classList.toggle('dark',"+JSON.stringify(theme==='dark')+")");
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(40);
      const metrics=await evaluate("({page:document.documentElement.scrollWidth,viewport:innerWidth,dates:document.querySelectorAll('[aria-label=\"Date period\"]').length,fields:document.querySelectorAll('.inventory-facet-grid input[role=combobox]').length,errors:[...document.querySelectorAll('.app-table')].flatMap(table=>{const count=table.tHead?.rows[0]?.cells.length;return [...(table.tBodies[0]?.rows||[])].filter(row=>![...row.cells].some(cell=>cell.colSpan>1||cell.querySelector('.empty-state'))&&row.cells.length!==count).map(row=>({count,actual:row.cells.length}));})})");
      assert.ok(metrics.page<=metrics.viewport+1,role+' '+theme+' '+width+' page overflow '+JSON.stringify(metrics));
      assert.equal(metrics.dates,1);assert.deepEqual(metrics.errors,[]);
      if(role!=='accounting')assert.equal(metrics.fields,8);
    }
    console.log('PASS actual '+role+' inventory page: aligned table cells, one date navigator, 7 widths, 2 themes, no measured page overflow');
  }
  assert.deepEqual(browserErrors,[]);
  console.log('PASS isolated smart-inventory browser QA; no live app profile or saved localhost records touched.');
} finally {
  stopped=true;
  if(socket&&socket.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  if(chrome)chrome.kill();
  await server.close();
  // The unique temporary browser profile is retained for inspection; no user profile is touched.
}
