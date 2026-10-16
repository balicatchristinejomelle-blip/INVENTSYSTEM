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
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hpai-layout-lock-'));
const entry = "\nimport React,{useEffect} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport App from '/src/App';\nimport {AppProvider,useApp,USERS} from '/src/store';\nimport {VIEW_STATE_PREFIX} from '/src/uiViewState';\nimport '/src/index.css';\nconst root=createRoot(document.getElementById('root'));\nwindow.__layoutQA={ready:false};\nlet baseline,version=0;\nfunction Capture(){const app=useApp();baseline=JSON.parse(JSON.stringify(app));window.__layoutQA.ready=true;return null;}\nfunction Surface({page}){useEffect(()=>{window.__layoutQA.ready=true;window.__layoutQA.page=page;},[page]);return React.createElement(App);}\nwindow.__layoutQA.mount=(role,page,prefs={})=>{\n window.__layoutQA.ready=false;\n const user=USERS.find(user=>user.role===role);\n const snapshot={...baseline,currentUser:user||null,currentPage:page};\n if(role==='production'){snapshot.clockedIn=true;snapshot.attendance=snapshot.attendance.map((row,index)=>index===0?{...row,employeeId:user.employeeId,status:'Active',clockOut:undefined}:row);}\n localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify(snapshot));\n const prefix=user?VIEW_STATE_PREFIX+user.employeeId+':'+role+':'+page+':':'';\n for(const[name,value]of Object.entries(prefs))sessionStorage.setItem(prefix+name,JSON.stringify(value));\n root.render(React.createElement(Surface,{key:++version,page}));\n};\nroot.render(React.createElement(AppProvider,null,React.createElement(Capture)));\n";
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
  plugins: [{
    name: 'layout-lock-browser-qa',
    resolveId(id) { if (id === '/__layout-lock-qa.js') return '\0layout-lock-browser-qa.js'; },
    load(id) { if (id === '\0layout-lock-browser-qa.js') return entry; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__layout-lock-qa') return next();
        try {
          const html = await server.transformIndexHtml('/__layout-lock-qa', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__layout-lock-qa.js"></script></body></html>');
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
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/__layout-lock-qa'});
  await waitFor(()=>evaluate("window.__layoutQA?.ready"),'Smart QA fixture ready',90000);


  const audit=process.argv.includes('--audit'),issues=[],measurements=[];
  const cases={
    OWNER_SUPER_ADMIN:['owner-dashboard','owner-plants','owner-records','owner-reports','owner-audit','owner-users','owner-settings'],
    accounting:['accounting-dashboard','acc-raw-materials','acc-rr-records','acc-branch-requests','acc-transfers','acc-transactions','acc-reports'],
    marketing:['marketing-dashboard','mkt-customers','mkt-orders','mkt-finished-goods','mkt-mo-tracking','mkt-reports'],
    management:['management-dashboard','mgmt-operations','mgmt-employees','mgmt-reports','mgmt-audit'],
    plantmanager:['pm-dashboard','pm-production-orders','pm-pellets','pm-material-usage','pm-transfers','pm-requests','pm-finished-goods','pm-recycling','pm-attendance','pm-turnover','pm-reports'],
    production:['production-dashboard','prod-orders','prod-pellets','prod-barcode','prod-finished-pipes','prod-recycling','prod-turnover','prod-history','prod-clockout','shift-attendance'],
  };
  async function mount(role,page,prefs={}){
    await evaluate('window.__layoutQA.mount('+JSON.stringify(role)+','+JSON.stringify(page)+','+JSON.stringify(prefs)+')');
    await waitFor(()=>evaluate('window.__layoutQA.ready&&window.__layoutQA.page==='+JSON.stringify(page)),page+' mounted');
    await pause(60);
  }
  const inspect=()=>evaluate(`(()=>{
    const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
    const main=document.querySelector('.app-main')||document.querySelector('.auth-screen')||document.body;
    const dates=[...document.querySelectorAll('.date-period-filter')].map(node=>{
      const group=node.querySelector('.date-period-group'),bar=node.closest('.record-filter-bar'),text=node.querySelector('.date-active-range span');
      return {box:rect(node),parent:rect(node.parentElement),bar:bar?rect(bar):null,text:text?{...rect(text),value:text.textContent}:null,buttons:[...node.querySelectorAll('.date-period-buttons button')].map(button=>({...rect(button),text:button.textContent})),ancestors:[node.parentElement,node.parentElement?.parentElement].filter(Boolean).map(parent=>({class:parent.className,...rect(parent),display:getComputedStyle(parent).display,columns:getComputedStyle(parent).gridTemplateColumns,contain:getComputedStyle(parent).containerType}))};
    });
    const tables=[...document.querySelectorAll('.app-table')].flatMap(table=>{
      const count=table.tHead?.rows[0]?.cells.length;if(!count)return [];
      return [...(table.tBodies[0]?.rows||[])].filter(row=>![...row.cells].some(cell=>cell.colSpan>1||cell.querySelector('.empty-state'))&&row.cells.length!==count).map(row=>({count,actual:row.cells.length}));
    });
    const actions=[...document.querySelectorAll('h3')].filter(node=>node.textContent==='Quick Actions').map(heading=>({heading:rect(heading),buttons:[...heading.nextElementSibling.querySelectorAll('button')].map(rect)}));
    const inventory=[...document.querySelectorAll('.inventory-metrics')].map(grid=>({box:rect(grid),cards:[...grid.children].map(rect)}));
    const sidebar=document.querySelector('.app-sidebar');
    return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,main:{...rect(main),scroll:main.scrollWidth,client:main.clientWidth},sidebar:sidebar?{...rect(sidebar),open:sidebar.classList.contains('is-open')}:null,dates,tables,actions,inventory,systemAccess:document.body.textContent.includes('SYSTEM ACCESS'),overflow:[...main.querySelectorAll('*')].filter(node=>{const r=node.getBoundingClientRect();return r.width&&r.right>main.getBoundingClientRect().right+2&&!node.closest('.table-scroll,table,.category-tabs,.report-tabs,.tab-strip,.lifecycle,.tracking-flow,.modal-overlay,.document-viewer-overlay')}).slice(0,6).map(node=>({tag:node.tagName,class:node.className,...rect(node)}))};
  })()`);
  const widths=audit?[360,768,1280]:[360,375,390,412,430,768,1280];
  const themes=audit?['light']:['light','dark'];
  if(!process.argv.includes('--forms-only'))for(const[role,pages]of Object.entries(cases))for(const page of pages){
    await mount(role,page);
    for(const theme of themes)for(const width of widths){
      await evaluate("document.documentElement.classList.toggle('dark',"+JSON.stringify(theme==='dark')+")");
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(240);
      const m=await inspect(),problems=[];
      if(m.pageWidth>m.viewport+1||m.main.scroll>m.main.client+1)problems.push('page/content horizontal overflow');
      if(width<=768&&m.sidebar&&!m.sidebar.open&&m.sidebar.right>1)problems.push('closed mobile navigation overlaps content');
      if(m.tables.length)problems.push('table header/body mismatch');
      for(const d of m.dates){
        if(d.box.width<Math.min(280,d.parent.width)-2||(d.bar&&d.box.width<d.bar.width-2))problems.push('Date narrower than filter section');
        if(d.text&&(d.text.width<35||d.text.height>(d.text.value.toLowerCase()==='all dates'?36:90)))problems.push('date text squeezed/letter-wrapped');
        if(new Set(d.buttons.map(button=>Math.round(button.height))).size>1||d.buttons.some(button=>button.width<40))problems.push('compressed period buttons');
        if(width>=1000&&d.box.width>=300&&new Set(d.buttons.map(button=>Math.round(button.top))).size>1)problems.push('desktop date buttons stack');
      }
      for(const a of m.actions){
        if(a.buttons.length&&a.buttons.some(button=>button.top<a.heading.bottom))problems.push('Quick Actions heading overlaps controls');
        if(a.buttons.length&&Math.max(...a.buttons.map(button=>button.height))-Math.min(...a.buttons.map(button=>button.height))>2)problems.push('uneven Quick Action heights');
        if(width>=1100&&a.buttons.length===4&&Math.max(...a.buttons.map(button=>button.width))-Math.min(...a.buttons.map(button=>button.width))>2)problems.push('unbalanced four Quick Actions');
      }
      for(const grid of m.inventory)if(width===768&&grid.cards.length===5&&grid.cards.filter(card=>Math.abs(card.top-grid.cards[0].top)<2).length!==3)problems.push('five summary cards not tablet 3+2');
      measurements.push({role,page,width,theme});
      if(problems.length)issues.push({role,page,width,theme,problems:[...new Set(problems)],...m});
      if((page==='owner-reports'||page==='prod-barcode')&&theme==='light'&&(width===360||width===1280)){
        const shot=await send('Page.captureScreenshot',{format:'png'});
        const file=path.join(os.tmpdir(),'hpai-lock-'+(audit?'before':'after')+'-'+page+'-'+width+'.png');
        fs.writeFileSync(file,Buffer.from(shot.data,'base64'));console.log('SCREENSHOT '+file);
      }
    }
    console.log('AUDITED '+role+' '+page);
  }
  console.log('PASS measured '+measurements.length+' full-shell page/viewport/theme surfaces; continuing with form/scanner probes');
  if(!audit){
    // Preserve actual range behavior while testing the formerly collapsed date-only report bar.
    await mount('OWNER_SUPER_ADMIN','owner-reports');
    await evaluate("[...document.querySelectorAll('.date-period-buttons button')].find(button=>button.textContent==='Week').click()");await pause(80);
    const week=await evaluate("document.querySelector('.date-active-range').textContent");
    await evaluate("document.querySelector('.date-next').click()");await pause(80);
    assert.notEqual(await evaluate("document.querySelector('.date-active-range').textContent"),week);
    await evaluate("document.querySelector('.date-previous').click()");await pause(80);
    assert.equal(await evaluate("document.querySelector('.date-active-range').textContent"),week);
    for(const width of [360,375,390,412,430,768,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(240);
      const m=await inspect();assert.ok(m.dates.every(date=>date.box.width>=280&&date.text.height<=60),'readable actual Week range '+width);
    }
    async function clickText(text,selector='button'){
      assert.ok(await evaluate("(()=>{const button=[...document.querySelectorAll("+JSON.stringify(selector)+")].find(node=>node.textContent.trim()==="+JSON.stringify(text)+");if(!button)return false;button.click();return true;})()"),'button '+text);
      await pause(80);
    }
    const forms=[['accounting','acc-rr-records','New RR'],['accounting','acc-transfers','Create Transfer'],['marketing','mkt-orders','Create Order'],['plantmanager','pm-requests','New Material Request'],['plantmanager','pm-production-orders','Create Stock Replenishment PO'],['production','prod-orders','Record Output']];
    for(const[role,page,button]of forms){
      await mount(role,page,page==='prod-orders'?{'production/ProductionOrders:orderView':'In Progress'}:{});await clickText(button);await waitFor(()=>evaluate("!!document.querySelector('[aria-modal=true]')"),page+' form');
      for(const theme of ['light','dark'])for(const width of [360,375,390,412,430,768,1280]){
        await evaluate("document.documentElement.classList.toggle('dark',"+JSON.stringify(theme==='dark')+")");
        await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(240);
        const modal=await evaluate("(()=>{const box=[...document.querySelectorAll('[aria-modal=true]')].at(-1),r=box.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,scroll:box.scrollWidth,client:box.clientWidth,viewport:innerWidth};})()");
        assert.ok(modal.left>=0&&modal.right<=width+1&&modal.scroll<=modal.client+1,page+' form overflow '+JSON.stringify(modal));
      }
      console.log('PASS unsaved '+page+' form: seven widths, both themes, no data submitted');
    }
    await mount('accounting','acc-rr-records');await clickText('View Details');
    assert.ok(await evaluate("!![...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='View Document')"),'existing RR detail/document action visible');
    for(const width of [360,768,1280]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(240);
      const m=await inspect();assert.ok(m.main.scroll<=m.main.client+1,'RR detail overflow '+JSON.stringify(m));
    }
    await clickText('Back');assert.ok(await evaluate("document.body.textContent.includes('New RR')"),'existing details/back route retained');
    await mount('marketing','mkt-finished-goods');
    await evaluate("(()=>{const input=document.querySelector('input[aria-label=\"Size / Diameter\"]');input.focus();input.click();})()");
    await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'master Size options');
    const sizes=await evaluate("[...document.querySelectorAll('[role=option]')].map(option=>option.textContent)");
    for(const size of [13,20,25,32,40,50,63,75,90,110,160,225,280,315,355,400,450,500])assert.ok(sizes.includes(size+'mm'));
    assert.ok(!sizes.includes('100mm'));
    await evaluate("[...document.querySelectorAll('[role=option]')].find(option=>option.textContent==='280mm').click()");await pause(80);
    assert.equal(await evaluate("document.querySelector('input[aria-label=\"Size / Diameter\"]').value"),'280mm');
    assert.equal(await evaluate("document.querySelector('input[aria-label=Location]').placeholder"),'No Matching Locations');
    await mount('production','prod-barcode');
    await clickText('Enter Manually');
    const before=await evaluate("localStorage.getItem('hpai:shared-app-state-v1')");
    await evaluate("(()=>{const input=document.querySelector('#manual-barcode-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'NOT-A-VALID-BARCODE');input.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await clickText('Submit');assert.ok(await evaluate("!!document.querySelector('.hardware-scanner-display')&&!!document.querySelector('.alert-error')"),'error scan keeps hardware scanner workflow open with actionable feedback');
    const after=await evaluate("localStorage.getItem('hpai:shared-app-state-v1')");
    for(const key of ['pellets','finishedGoods','productionOrders','orders','transactions'])assert.deepEqual(JSON.parse(after)[key],JSON.parse(before)[key],key+' unchanged by error scan');
    console.log('PASS actual report Week navigation, record-details/back, manual error-scan readiness and no inventory writes');
  }
  await mount('login','login');const login=await inspect();
  if(login.systemAccess)issues.push({page:'login',problems:['redundant SYSTEM ACCESS visual card']});
  console.log('MEASURED '+measurements.length+' role/page/viewport/theme surfaces');
  fs.writeFileSync(path.join(os.tmpdir(),'hpai-layout-lock-'+(audit?'audit':'qa')+'.json'),JSON.stringify({issues,measurements},null,2));
  for(const issue of issues.slice(0,30))console.log('ISSUE '+JSON.stringify({role:issue.role,page:issue.page,width:issue.width,problems:issue.problems,dates:issue.dates?.map(date=>({width:date.box.width,height:date.box.height,parent:date.parent.width,text:date.text}))}));
  console.log('ISSUE_COUNT '+issues.length);
  assert.deepEqual(browserErrors,[]);
  if(!audit)assert.deepEqual(issues,[],'layout consistency issues');
  console.log(audit?'Completed pre-change layout audit.':'PASS full-shell six-role layout lock; no live browser profile or saved localhost state touched.');
} finally {
  stopped=true;
  if(socket&&socket.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  if(chrome)chrome.kill();
  await server.close();
  // The unique temporary browser profile is retained for inspection; no user profile is touched.
}
