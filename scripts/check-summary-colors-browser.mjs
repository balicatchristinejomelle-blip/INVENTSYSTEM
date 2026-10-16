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
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hpai-summary-colors-'));
const entry = "\nimport React,{useEffect,useState} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport App from '/src/App';\nimport ProductFilters from '/src/components/ProductFilters';\nimport {emptyProductFilter} from '/src/productFilters';\nimport {AppProvider,useApp,USERS} from '/src/store';\nimport {VIEW_STATE_PREFIX} from '/src/uiViewState';\nimport '/src/index.css';\nconst root=createRoot(document.getElementById('root'));\nwindow.__layoutQA={ready:false};\nlet baseline,version=0;\nfunction Capture(){const app=useApp();baseline=JSON.parse(JSON.stringify(app));window.__layoutQA.ready=true;return null;}\nfunction Surface({page}){useEffect(()=>{window.__layoutQA.ready=true;window.__layoutQA.page=page;},[page]);return React.createElement(App);}\nwindow.__layoutQA.mount=(role,page,prefs={},overrides={})=>{\n window.__layoutQA.ready=false;\n const user=USERS.find(user=>user.role===role);\n const snapshot={...baseline,...overrides,currentUser:user||null,currentPage:page};\n if(role==='production'){snapshot.clockedIn=true;snapshot.attendance=snapshot.attendance.map((row,index)=>index===0?{...row,employeeId:user.employeeId,status:'Active',clockOut:undefined}:row);}\n localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify(snapshot));\n const prefix=user?VIEW_STATE_PREFIX+user.employeeId+':'+role+':'+page+':':'';\n for(const key of Object.keys(sessionStorage))if(key.startsWith(prefix))sessionStorage.removeItem(key);\n for(const[name,value]of Object.entries(prefs))sessionStorage.setItem(prefix+name,JSON.stringify(value));\n root.render(React.createElement(Surface,{key:++version,page}));\n};\n\nfunction Live(){const app=useApp();window.__layoutQA.api=app;useEffect(()=>{window.__layoutQA.ready=true;});return null;}\nwindow.__layoutQA.apiMount=(role,overrides={})=>{window.__layoutQA.ready=false;localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify({...baseline,...overrides,currentUser:USERS.find(user=>user.role===role)}));root.render(React.createElement(AppProvider,{key:++version},React.createElement(Live)));};\nroot.render(React.createElement(AppProvider,null,React.createElement(Capture)));\n\nfunction FilterFixture({count,form}){const[value,setValue]=useState({...emptyProductFilter}),[purpose,setPurpose]=useState(''),[status,setStatus]=useState('');return React.createElement('main',{className:'operational-content',style:{padding:16,width:'100%',boxSizing:'border-box'}},React.createElement(ProductFilters,{records:[],value,onChange:setValue,includeProduct:count>5,includeGrade:true,includeColor:true,includeLocation:true,includeLength:count===7||count===9,productForm:form,...(count>=8?{purpose,onPurposeChange:setPurpose,status,onStatusChange:setStatus}: {})}));}\nwindow.__layoutQA.filters=(count,form)=>{root.render(React.createElement(AppProvider,{key:++version},React.createElement(FilterFixture,{count,form})));};\n";
const server = await createServer({
  cacheDir: path.join(profile, 'vite-cache'),
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
  plugins: [{
    name: 'layout-lock-browser-qa',
    resolveId(id) { if (id === '/__summary-colors-qa.js') return '\0layout-lock-browser-qa.js'; },
    load(id) { if (id === '\0layout-lock-browser-qa.js') return entry; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__summary-colors-qa') return next();
        try {
          const html = await server.transformIndexHtml('/__summary-colors-qa', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__summary-colors-qa.js"></script></body></html>');
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
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/__summary-colors-qa'});
  await waitFor(()=>evaluate("window.__layoutQA?.ready"),'Smart QA fixture ready',90000);



  let surfaces=0;
  async function mount(role,page,prefs={},overrides={}){
    await evaluate('window.__layoutQA.mount('+JSON.stringify(role)+','+JSON.stringify(page)+','+JSON.stringify(prefs)+','+JSON.stringify(overrides)+')');
    await waitFor(()=>evaluate('window.__layoutQA.ready&&window.__layoutQA.page==='+JSON.stringify(page)),page+' ready');await pause(250);
  }
  async function clickText(text){
    await evaluate("(()=>{const scope=document.querySelector('.modal-box')||document;const button=[...scope.querySelectorAll('button')].find(node=>node.textContent.trim()==="+JSON.stringify(text)+"||(node.getAttribute('role')==='tab'&&node.firstChild?.textContent.trim()==="+JSON.stringify(text)+"));if(!button)throw Error('Missing button: '+"+JSON.stringify(text)+");button.click();})()");await pause(90);
  }
  async function chooseColor(color,context='Recycled'){
    await evaluate("document.querySelector('input[aria-label=Color]').click()");
    await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'color options');
    const options=await evaluate("[...document.querySelectorAll('[role=option]')].map(node=>node.textContent)");
    const master=context==='Virgin'?['White']:['Black','Blue','Orange','Red Orange','Green'];
    assert.deepEqual(options,['All Colors',...(context==='All'?['White']:[]),...master],context+' uses only its fixed master, never current records');
    await evaluate("[...document.querySelectorAll('[role=option]')].find(node=>node.textContent==="+JSON.stringify(color)+").click()");await pause(120);
  }
  const snapshot=()=>evaluate("JSON.parse(localStorage.getItem('hpai:shared-app-state-v1'))");
  const summaryCases=[
    ['OWNER_SUPER_ADMIN','owner-reports',{}],
    ['marketing','mkt-finished-goods',{}],
    ['management','mgmt-reports',{'management/Reports:activeTab':'Inventory'}],
    ['plantmanager','pm-finished-goods',{}],
    ['plantmanager','pm-reports',{'plantmanager/Reports:report':'Finished Goods'}],
    ['production','prod-finished-pipes',{}],
  ];
  const measure=()=>evaluate("(()=>{const r=node=>{const b=node.getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height}};return [...document.querySelectorAll('.inventory-metrics > .metric-card')].map(node=>({box:r(node),label:r(node.querySelector('.metric-label')),value:r(node.querySelector(':scope > strong')),icon:r(node.querySelector('.metric-help-trigger'))}));})()");
  for(const theme of (process.argv.includes('--pellets-only')?[]:['light','dark']))for(const width of [360,375,390,412,430,768,1280]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    for(const[role,page,prefs]of summaryCases){
      await mount(role,page,prefs);
      await evaluate("document.documentElement.classList.toggle('dark',"+(theme==='dark')+")");
      const before=await measure();assert.equal(before.length,5,page+' five cards');
      for(const card of before){
        assert.ok(Math.abs(card.box.height-before[0].box.height)<1,page+' equal card heights');
        assert.ok(Math.abs((card.value.top-card.box.top)-(before[0].value.top-before[0].box.top))<1,page+' consistent value alignment');
        assert.ok(card.label.width<=card.box.width&&card.label.height>=48,page+' label stays inside card');
        assert.ok(Math.abs(card.icon.width-24)<1&&Math.abs(card.icon.height-24)<1,page+' common help icon size');
      }
      assert.ok(await evaluate("!!document.querySelector('[aria-label=\"On Hand breakdown\"]')"),page+' shows complete equation');
      for(let index=0;index<5;index++){
        await evaluate("document.querySelectorAll('.inventory-metrics .metric-help-trigger')["+index+"].click()");await pause(20);
        const bounds=await evaluate("(()=>{const node=document.querySelector('.metric-help-popover:popover-open');if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,text:node.textContent}})()");
        assert.ok(bounds&&bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=900,page+' help visible without overflow');
        assert.deepEqual(await measure(),before,page+' opening help does not change cards or value positions');
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        assert.equal(await evaluate("document.querySelectorAll(':popover-open').length"),0,'Escape closes help');
      }
      const overflow=await evaluate("document.documentElement.scrollWidth>innerWidth+1");assert.equal(overflow,false,page+' no page overflow');
      if(theme==='light'&&[390,1280].includes(width)&&page==='mkt-finished-goods'){
        const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
        fs.writeFileSync(path.join(os.tmpdir(),'hpai-summary-colors-'+width+'.png'),Buffer.from(shot.data,'base64'));
      }
      surfaces++;
    }
  }
  console.log('PASS '+surfaces+' summary surfaces; equal heights/values, all five help icons, Escape, no card resizing/overflow.');
  const materialCases=[
    ['accounting','acc-raw-materials','accounting/RawMaterials:category'],
    ['management','mgmt-operations','management/Operations:materialCategory'],
    ['plantmanager','pm-pellets','plantmanager/PelletInventory:category'],
    ['production','prod-pellets','production/Pellets:category'],
    ['plantmanager','pm-reports','plantmanager/Reports:materialCategory'],
    ['OWNER_SUPER_ADMIN','owner-records',null],
    ['OWNER_SUPER_ADMIN','owner-records',null,'All Inventory'],
  ];
  for(const theme of ['light','dark'])for(const width of [360,375,390,412,430,768,1280])for(const[role,page,key,section]of materialCases){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    const prefs=key?{[key]:'Virgin Pellets'}:{'owner/Records:area':'Inventory & Finished Goods','owner/Records:section':section||'Pellet Inventory'};
    await mount(role,page,prefs);await evaluate("document.documentElement.classList.toggle('dark',"+(theme==='dark')+")");
    assert.ok(await evaluate("[...document.querySelectorAll('.app-table tbody')].some(node=>node.textContent.includes('White'))"),page+' visible Virgin White');
    const original=await snapshot();
    if(key){await chooseColor('White','Virgin');}
    if(key)await clickText('Recycled Pellets');
    if(!key)await chooseColor('Blue','All'); // Owner combines types; recycled samples may be on a later page.
    assert.ok(await evaluate("[...document.querySelectorAll('.app-table tbody')].some(node=>node.textContent.includes('Blue'))"),page+' visible Recycled Blue');
    await chooseColor('Green',key?'Recycled':'All');
    const matching=await evaluate("[...document.querySelectorAll('.app-table tbody tr')].filter(node=>!node.querySelector('.empty-state')).map(node=>node.textContent)");
    assert.ok(matching.length&&matching.every(text=>text.includes('Green')&&!text.includes('White')),page+' Green filter agrees with visible rows');
    await evaluate("(()=>{const input=document.querySelector('input.record-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Green');input.dispatchEvent(new Event('input',{bubbles:true}));})()");await pause(90);
    assert.ok(await evaluate("[...document.querySelectorAll('.app-table tbody tr')].some(node=>node.textContent.includes('Green'))"),page+' actual search finds recorded pellet color');
    const after=await snapshot();for(const key of ['pellets','finishedGoods','transactions','orders','productionOrders'])assert.deepEqual(after[key],original[key],page+' read-only filters preserve '+key);
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,page+' no page overflow');
    surfaces++;
  }
  console.log('PASS seven authorized pellet/report/combined-inventory views across desktop/tablet/mobile and two themes; White/non-White options, Green filter and actual color search.');
  const masterColors=['Black','Blue','Orange','Red Orange','Green'];
  const blackOnly=(await snapshot()).pellets.filter(item=>item.type==='Recycled'&&item.color==='Black').slice(0,1);
  async function chooseOption(value){
    await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'open choice');
    await evaluate("(()=>{const option=[...document.querySelectorAll('[role=option]')].find(node=>node.textContent==="+JSON.stringify(value)+");if(!option)throw Error('Missing option');option.click();})()");await pause(80);
  }
  async function recycledFieldOptions(){
    await evaluate("document.querySelector('.modal-box input[aria-label=\"Pellet Color\"]').click()");
    await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'master pellet creation options');
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=option]')].map(node=>node.textContent)"),masterColors,'full static master with Black-only inventory');
  }
  async function rrType(type){
    await evaluate("[...document.querySelectorAll('.modal-box label')].find(node=>node.textContent.trim().startsWith('Pellet Type')).querySelector('[role=combobox]').click()");
    await chooseOption(type);
  }
  for(const theme of ['light','dark'])for(const width of [360,375,390,412,430,768,1280]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await mount('accounting','acc-rr-records',{}, {pellets:blackOnly});await clickText('New RR');
    await evaluate("document.documentElement.classList.toggle('dark',"+(theme==='dark')+")");
    assert.deepEqual(await evaluate("(()=>{const node=document.querySelector('.modal-box input[aria-label=\"Pellet Color\"]');return{value:node.value,readOnly:node.readOnly}})()"),{value:'White',readOnly:true});
    await rrType('Recycled');await recycledFieldOptions();await chooseOption('Green');await rrType('Virgin');
    assert.equal(await evaluate("document.querySelector('.modal-box input[aria-label=\"Pellet Color\"]').value"),'White','Green never survives switching to Virgin');
    await rrType('Recycled');assert.equal(await evaluate("document.querySelector('.modal-box input[aria-label=\"Pellet Color\"]').value"),'','no stale recycled selection');await recycledFieldOptions();await chooseOption('Orange');
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,'receiving form no page overflow');surfaces++;
    await mount('plantmanager','pm-requests',{}, {pellets:blackOnly});await clickText('New Material Request');await clickText('Recycled Pellet');await recycledFieldOptions();await chooseOption('Red Orange');await clickText('Virgin Pellet');
    assert.equal(await evaluate("document.querySelector('.modal-box input[aria-label=\"Pellet Color\"]').value"),'White');
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,'request form no page overflow');surfaces++;
    const batch={id:'browser-color-batch',batchNo:'RP-BROWSER-COLOR',originalKg:50,cutMaterialKg:45,status:'Pelletizing',date:'2026-10-16',employees:[],sourcePO:'PO-2026-0012'};
    await mount('production','prod-recycling',{'production/Recycling:tab':'recycling'}, {pellets:blackOnly,recyclingBatches:[batch]});await clickText('Complete Pelletizing');await recycledFieldOptions();await chooseOption('Green');
    await evaluate("(()=>{const node=document.querySelector('.modal-box input[type=number]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'26');node.dispatchEvent(new Event('input',{bubbles:true}));})()");await pause(60);
    await clickText('Complete & Create Bags');const recycled=await snapshot();
    assert.equal(recycled.pellets[0].color,'Green');assert.equal(recycled.pellets.length,blackOnly.length+1);assert.equal(recycled.recyclingBatches[0].color,'Green');assert.equal(recycled.recyclingBatches[0].looseKg,1);surfaces++;
  }
  console.log('PASS 42 actual receiving/request/recycling form surfaces: fixed masters with Black-only inventory, Virgin/Recycled switching, no stale colors, valid output bag/loose colors.');
  const legacyBag={...blackOnly[0],color:'Mixed'};
  await mount('production','prod-pellets',{'production/Pellets:category':'Recycled Pellets'},{pellets:[legacyBag]});
  assert.ok(await evaluate("document.querySelector('.app-table tbody').textContent.includes('Mixed (legacy)')"),'historical Mixed visible and marked legacy');
  await chooseColor('Black');
  assert.equal((await snapshot()).pellets[0].color,'Mixed','filter does not silently recolor legacy stock');
  await send('Page.reload');await waitFor(()=>evaluate('window.__layoutQA?.ready'),'isolated legacy reload');
  assert.equal((await snapshot()).pellets[0].color,'Mixed','saved historical Mixed survives reload');
  for(const width of [390,768,1280]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});await mount('OWNER_SUPER_ADMIN','owner-reports');
    const boxes=await evaluate("(()=>{const grid=document.querySelector('.inventory-facet-grid[data-field-count=\"7\"]');const r=node=>{const x=node.getBoundingClientRect();return{left:x.left,right:x.right,top:x.top,width:x.width}};return{grid:r(grid),fields:[...grid.children].map(r)}})()");
    assert.equal(boxes.fields.length,7);if(width===1280){assert.equal(new Set(boxes.fields.slice(0,4).map(row=>row.top)).size,1);assert.equal(new Set(boxes.fields.slice(4).map(row=>row.top)).size,1);assert.ok(Math.abs(boxes.fields[6].right-boxes.grid.right)<1,'second row fills the report width');assert.ok(Math.abs(boxes.fields[4].width-boxes.fields[6].width)<1,'three evenly distributed peers');}
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,'seven-field report no overflow');surfaces++;
  }
  console.log('PASS historical Mixed stays read-only and absent from options; seven-filter reports retain order with balanced 4+3 desktop rows.');
  for(const theme of ['light','dark'])for(const width of [360,375,390,412,430,768,1280])for(const count of [5,6,7,8,9]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600});
    await evaluate('window.__layoutQA.filters('+count+')');await pause(100);await evaluate("document.documentElement.classList.toggle('dark',"+(theme==='dark')+")");
    const result=await evaluate(`(()=>{const grid=document.querySelector('.inventory-facet-grid'),box=grid.getBoundingClientRect(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');return{grid:{left:box.left,right:box.right},fields:[...grid.children].map(field=>{const input=field.querySelector('input'),r=field.getBoundingClientRect(),style=getComputedStyle(input);ctx.font=style.font;return{top:r.top,left:r.left,right:r.right,height:input.getBoundingClientRect().height,text:input.value||input.placeholder,room:input.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),needed:ctx.measureText(input.value||input.placeholder).width}})}})()`);
    assert.equal(result.fields.length,count);for(const field of result.fields){assert.equal(field.height,36,'consistent control height');assert.ok(field.needed<=field.room+1,'full reset text fits: '+field.text);}
    const rows=Object.values(Object.groupBy(result.fields,field=>Math.round(field.top))).map(fields=>fields.length);
    assert.deepEqual(rows,width===1280?({5:[3,2],6:[3,3],7:[4,3],8:[4,4],9:[3,3,3]}[count]):width===768?Array.from({length:Math.ceil(count/2)},(_,i)=>Math.min(2,count-i*2)):Array(count).fill(1),'balanced '+count+' controls at '+width);
    if(width===1280){for(const row of Object.values(Object.groupBy(result.fields,field=>Math.round(field.top)))){assert.ok(Math.abs(row[0].left-result.grid.left)<1);assert.ok(Math.abs(row.at(-1).right-result.grid.right)<1,'no empty cell at row end');}}
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,'no filter fixture overflow');surfaces++;
    if(width===1280&&count===9)assert.deepEqual(await evaluate("[...document.querySelectorAll('.inventory-facet-grid .field-label')].map(node=>node.textContent)"),['Product','Material Grade','Color','Size / Diameter','SDR / Thickness','Location','Length / Coil Length','Storage Purpose','Status']);
  }
  const straight=['5m','5.5m','5.86m','6m','8.873m','10m'],coil=['25m','30m','50m','60m','90m','100m','150m','200m','250m','300m','350m'];
  for(const[form,expected]of [[undefined,[...straight,...coil]],['Straight Length',straight],['Coil',coil]]){
    await evaluate('window.__layoutQA.filters(7,'+JSON.stringify(form??null)+')');await pause(100);
    await evaluate("document.querySelector('input[aria-label=\"Length / Coil Length\"]').click()");await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'length master opens');
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=option]')].map(node=>node.textContent)"),['All Lengths',...expected]);
    const popup=await evaluate("(()=>{const node=document.querySelector('.searchable-combobox-menu'),r=node.getBoundingClientRect(),trigger=document.querySelector('input[aria-label=\"Length / Coil Length\"]').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,trigger:trigger.width,search:!!node.querySelector('input[type=search]')}})()");
    assert.ok(popup.search&&popup.width>=popup.trigger-1&&popup.left>=0&&popup.right<=1280&&popup.top>=0&&popup.bottom<=900,'popup search and bounds');
    await chooseOption(expected.at(-1));
  }
  console.log('PASS 70 adaptive 5/6/7/8/9-filter surfaces, full reset text, field order, popup search, and zero-stock Straight/Coil master options.');
  await evaluate('window.__layoutQA.filters(7)');await pause(100);
  await evaluate("document.querySelector('input[aria-label=Location]').click()");await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'canonical location options');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=option]')].map(node=>node.textContent)"),['All Locations','A','B','C','D','E','F','G','H','I']);await chooseOption('All Locations');
  await evaluate("document.querySelector('input[aria-label=Product]').click()");await chooseOption('HDPE Pipe');
  await evaluate("document.querySelector('input[aria-label=\"Size / Diameter\"]').click()");await waitFor(()=>evaluate("!!document.querySelector('[role=listbox]')"),'size master options');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=option]')].map(node=>node.textContent)"),['All Sizes',...[13,20,25,32,40,50,63,75,90,110,160,225,280,315,355,400,450,500].map(size=>size+'mm')]);
  await evaluate("(()=>{const node=document.querySelector('.searchable-menu-search');node.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,'500mm');node.dispatchEvent(new Event('input',{bubbles:true}));})()");await pause(90);
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=option]')].map(node=>node.textContent)"),['500mm']);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await pause(90);
  assert.equal(await evaluate("document.querySelector('input[aria-label=\"Size / Diameter\"]').value"),'500mm','popup search/keyboard selects a valid zero-stock size');
  console.log('PASS active A–I-only Location options, all 18 Standard sizes/no 100mm, and inside-popup search/Enter selection with zero stock.');
  await mount('accounting','acc-rr-records');await clickText('New RR');
  assert.deepEqual(await evaluate("(()=>{const input=[...document.querySelectorAll('.modal-box input')].find(node=>node.value==='White');return input?{color:input.value,readOnly:input.readOnly}:null})()"),{color:'White',readOnly:true},'Virgin RR field fixed White');
  // Exercise actual store actions in the isolated profile, never live localhost data.
  async function apiMount(role,overrides={}){
    await evaluate('window.__layoutQA.apiMount('+JSON.stringify(role)+','+JSON.stringify(overrides)+')');await waitFor(()=>evaluate('window.__layoutQA.ready'),'action harness');await pause(80);
  }
  await apiMount('accounting');
  const base=await snapshot();
  const rr={pelletType:'Virgin',grade:'PE100',color:'Black (BK)',numberOfBags:1,supplier:'QA',referenceNo:'QA-COLOR',destination:'Branch Plant',storageLocation:'A'};
  await evaluate('window.__layoutQA.api.createReceivingReport('+JSON.stringify(rr)+')');await pause(100);
  let state=await snapshot();
  assert.equal(state.pellets.length,base.pellets.length+1);assert.equal(state.pellets[0].color,'White');assert.equal(state.rrRecords[0].color,'White');assert.equal(state.pellets[0].availableKg,25);
  const virgin=state;
  await evaluate('window.__layoutQA.api.createReceivingReport('+JSON.stringify({...rr,pelletType:'Recycled',color:''})+')');await pause(100);
  assert.deepEqual(await snapshot(),virgin,'blank recycled RR makes no mutation');
  await evaluate('window.__layoutQA.api.createReceivingReport('+JSON.stringify({...rr,pelletType:'Recycled',color:'Mixed'})+')');await pause(100);
  assert.deepEqual(await snapshot(),virgin,'Mixed recycled RR makes no mutation');
  await evaluate('window.__layoutQA.api.createReceivingReport('+JSON.stringify({...rr,pelletType:'Recycled',color:'Red Orange (RO)'})+')');await pause(100);
  state=await snapshot();assert.equal(state.pellets[0].color,'Red Orange');assert.equal(state.rrRecords[0].color,'Red Orange');assert.equal(state.pellets.length,base.pellets.length+2);
  await apiMount('plantmanager',{materialRequests:[]});
  const request={refNo:'QA-MR',date:'2026-10-16',requestedBy:'QA',materialCategory:'Virgin Pellet',pelletType:'Virgin',grade:'PE100',color:'Black',requestedKg:25,requestedBags:1,status:'New',destination:'Branch Plant'};
  await evaluate('window.__layoutQA.api.addMaterialRequest('+JSON.stringify(request)+')');await pause(100);
  assert.equal((await snapshot()).materialRequests[0].color,'White');
  await apiMount('plantmanager',{materialRequests:[]});
  let result=await evaluate('window.__layoutQA.api.addMaterialRequest('+JSON.stringify({...request,materialCategory:'Recycled Pellet',pelletType:'Recycled',color:''})+')');
  assert.equal(result.success,false);assert.equal((await snapshot()).materialRequests.length,0);
  result=await evaluate('window.__layoutQA.api.addMaterialRequest('+JSON.stringify({...request,materialCategory:'Recycled Pellet',pelletType:'Recycled',color:'Green'})+')');await pause(100);
  assert.equal(result.success,true);assert.equal((await snapshot()).materialRequests[0].color,'Green');
  console.log('PASS actual receipt/request actions: Virgin White enforced, master codes normalized, Mixed/blank Recycled rejected, normal bag quantities preserved.');
  assert.deepEqual(browserErrors,[]);
  console.log('Completed '+surfaces+' responsive summary/pellet surfaces plus isolated actual receipt/request workflows. No live browser profile or saved localhost state touched.');
} finally {
  stopped=true;
  if(socket&&socket.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}
  if(chrome)chrome.kill();
  await server.close();
  // The unique temporary browser profile is retained for inspection; no user profile is touched.
}
