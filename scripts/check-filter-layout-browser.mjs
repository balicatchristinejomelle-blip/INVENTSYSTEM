import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const audit = process.argv.includes('--audit');
const executable = process.env.BROWSER_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!executable) throw Error('Set BROWSER_PATH to Chrome or Edge.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hpai-filter-layout-'));
const entry = `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import App from '/src/App';import{AppProvider,useApp,USERS}from'/src/store';
import ProductFilters from '/src/components/ProductFilters';import{emptyProductFilter}from'/src/productFilters';
import PeriodSelector,{usePeriod}from'/src/components/PeriodSelector';import{ViewStateScope,VIEW_STATE_PREFIX}from'/src/uiViewState';
import'/src/index.css';
const root=createRoot(document.getElementById('root'));let baseline,version=0;window.qa={ready:false};
function Capture(){const app=useApp();baseline=JSON.parse(JSON.stringify(app));window.qa.ready=true;return null;}
function Fixture({kind,parent,role}){const[value,setValue]=useState({...emptyProductFilter}),period=usePeriod(),app=useApp();
 const controls=React.createElement(ProductFilters,{...(kind==='inventory'?{records:[]}:{}),value,onChange:setValue,includeProduct:true,includeGrade:true,includeColor:true,includeLocation:true,includeLength:true});
 const content=parent==='period'?React.createElement(PeriodSelector,{period,search:'',onSearchChange:()=>{},filters:controls}):React.createElement('div',{className:parent==='card'?'filter-panel product-filter-panel':parent==='toolbar'?'toolbar':parent==='combined'?'combined-product-filters':''},controls);
 return React.createElement('div',{className:'app-shell',style:{display:'flex',width:'100%',minHeight:'100vh'}},React.createElement('aside',{className:'fixture-sidebar',style:{width:240,flexShrink:0}}),React.createElement('div',{className:'app-workspace',style:{flex:1,minWidth:0}},React.createElement('main',{className:'app-main operational-content',style:{padding:20}},content)));
}
window.qa.fixture=(kind,parent,role)=>{const user=USERS.find(row=>row.role===role);localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify({...baseline,currentUser:user,currentPage:'filter-qa'}));root.render(React.createElement(AppProvider,{key:++version},React.createElement(ViewStateScope,null,React.createElement(Fixture,{kind,parent,role}))));};
window.qa.mount=(role,page,prefs={})=>{const user=USERS.find(row=>row.role===role),snapshot={...baseline,currentUser:user,currentPage:page};if(role==='production'){snapshot.clockedIn=true;snapshot.attendance=snapshot.attendance.map((row,index)=>index===0?{...row,employeeId:user.employeeId,status:'Active',clockOut:undefined}:row);}
localStorage.setItem('hpai:shared-app-state-v1',JSON.stringify(snapshot));const prefix=VIEW_STATE_PREFIX+user.employeeId+':'+role+':'+page+':';for(const[name,value]of Object.entries(prefs))sessionStorage.setItem(prefix+name,JSON.stringify(value));root.render(React.createElement(App,{key:++version}));};
root.render(React.createElement(AppProvider,null,React.createElement(Capture)));
`;
const server = await createServer({ cacheDir: path.join(profile, 'vite-cache'), server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false }, plugins: [{
  name: 'filter-layout-qa', resolveId(id) { if (id === '/__filter-qa.js') return '\0filter-qa'; }, load(id) { if (id === '\0filter-qa') return entry; },
  configureServer(server) { server.middlewares.use(async (req, res, next) => { if (req.url !== '/__filter-qa') return next(); try { res.setHeader('Content-Type', 'text/html');res.end(await server.transformIndexHtml('/__filter-qa', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__filter-qa.js"></script></body></html>')); } catch(error) { next(error); } }); },
}] });
let chrome, socket, id = 0, surfaces = 0;
const pending = new Map(), errors = [], issues = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(probe, label) { const end = Date.now() + 90000; while(Date.now()<end) { try { if(await probe()) return; } catch{} await pause(100); } throw Error('Timed out: '+label+' / '+errors.join(';')); }
function send(method, params={}) { return new Promise((resolve,reject)=>{const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error('CDP timeout '+method));},30000);pending.set(request,{resolve:result=>{clearTimeout(timer);resolve(result);},reject});socket.send(JSON.stringify({id:request,method,params}));}); }
async function evaluate(expression) { const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value; }
const measure = `(()=>{const round=n=>Math.round(n*10)/10;return [...document.querySelectorAll('.product-filter-controls')].filter(grid=>grid.children.length===7&&grid.getBoundingClientRect().width>0).map(grid=>{
 const rect=grid.getBoundingClientRect(),fields=[...grid.children].map(field=>{const r=field.getBoundingClientRect(),input=field.querySelector('[role=combobox]'),s=getComputedStyle(input),ir=input.getBoundingClientRect(),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=s.font;const text=input.value||input.placeholder,available=ir.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-2;return{label:input.getAttribute('aria-label'),text,left:round(r.left),right:round(r.right),top:round(r.top),width:round(r.width),input:round(ir.width),available:round(available),textWidth:round(ctx.measureText(text).width),aligned:s.textAlign};});
 const ancestors=[];let node=grid;for(let index=0;node&&index<7;index++,node=node.parentElement){const s=getComputedStyle(node),r=node.getBoundingClientRect();ancestors.push({class:node.className,width:round(r.width),display:s.display,columns:s.gridTemplateColumns,container:s.containerType,maxWidth:s.maxWidth,flex:s.flex,align:s.alignItems});}
 const host=grid.parentElement.classList.contains('inventory-facet-panel')?grid.parentElement.parentElement:grid.parentElement,hs=getComputedStyle(host),hr=host.getBoundingClientRect(),hostWidth=hr.width-parseFloat(hs.paddingLeft)-parseFloat(hs.paddingRight)-parseFloat(hs.borderLeftWidth)-parseFloat(hs.borderRightWidth);
 const rows=Object.values(Object.groupBy(fields,field=>field.top)).map(row=>row.length);return{width:round(rect.width),hostWidth:round(hostWidth),left:round(rect.left),right:round(rect.right),rows,fields,ancestors};});})()`;
async function inspect(label, width, screenshot=false) {
  await pause(90);const grids=await evaluate(measure);surfaces++;
  for(const grid of grids){
    const expected=width<=600?[1,1,1,1,1,1,1]:grid.hostWidth>=760?[4,3]:[2,2,2,1];
    if(grid.width<grid.hostWidth-1)issues.push({label,problem:'narrow parent grid slot',grid});
    if(JSON.stringify(grid.rows)!==JSON.stringify(expected))issues.push({label,problem:'rows',expected,grid});
    if(grid.rows.join(',')==='4,3'){
      const last=grid.fields.slice(4);if(Math.abs(last[0].left-grid.left)>1||Math.abs(last[2].right-grid.right)>1||Math.max(...last.map(x=>x.width))-Math.min(...last.map(x=>x.width))>1)issues.push({label,problem:'second row not full-width',grid});
    }
    for(const field of grid.fields)if(field.input<field.width-1||field.available<field.textWidth-1||field.aligned!=='center')issues.push({label,problem:'clipped/nonfull select',field,ancestors:grid.ancestors});
  }
  if(await evaluate('document.documentElement.scrollWidth>innerWidth+1'))issues.push({label,problem:'page overflow'});
  if(screenshot){const image=await send('Page.captureScreenshot',{format:'png'}),file=path.join(profile,label.replace(/[^\w-]/g,'-')+'.png');fs.writeFileSync(file,Buffer.from(image.data,'base64'));console.log('SCREENSHOT '+file);}
  return grids;
}
try {
  await server.listen();chrome=spawn(executable,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let target;await wait(async()=>{const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0].trim();target=(await(await fetch('http://127.0.0.1:'+port+'/json')).json()).find(page=>page.type==='page');return target;},'browser');
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  socket.addEventListener('message',({data})=>{const message=JSON.parse(data);if(message.id){const request=pending.get(message.id);if(request){pending.delete(message.id);if(message.error)request.reject(Error(message.error.message));else request.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);});
  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:'http://127.0.0.1:'+server.httpServer.address().port+'/__filter-qa'});await wait(()=>evaluate('window.qa?.ready'),'fixture');
  const roles=['OWNER_SUPER_ADMIN','accounting','marketing','management','plantmanager','production'];
  const widths=audit?[1280,1024]:[360,375,390,412,430,768,800,1000,1024,1100,1280,1440];
  for(const width of widths){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=600});await evaluate("document.querySelectorAll('.fixture-sidebar').forEach(node=>node.hidden=innerWidth<=1000)");
    for(const kind of ['inventory','master'])for(const parent of ['plain','period','card','toolbar','combined']){
      await evaluate('qa.fixture('+JSON.stringify(kind)+','+JSON.stringify(parent)+',"OWNER_SUPER_ADMIN")');await pause(80);
      await evaluate("document.querySelector('.fixture-sidebar').style.display=innerWidth<=1000?'none':'block'");
      const grids=await inspect(kind+'-'+parent+'-'+width,width,width===1280&&(parent==='period'||parent==='toolbar'));
      if(grids.length!==1)issues.push({label:kind+'-'+parent+'-'+width,problem:'missing or display:contents grid',grids});
      if(audit&&width===1280)console.log('TRACE '+kind+' '+parent+' '+JSON.stringify(grids));
    }
  }
  const pages=[['OWNER_SUPER_ADMIN','owner-reports',{}],['accounting','acc-reports',{}],['marketing','mkt-reports',{}],['management','mgmt-reports',{}],['plantmanager','pm-reports',{'plantmanager/Reports:report':'Recycling'}],['production','prod-orders',{}]];
  for(const theme of audit?['light']:['light','dark'])for(const width of audit?[1280]:widths)for(const[role,page,prefs]of pages){
    await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=600});await evaluate('qa.mount('+JSON.stringify(role)+','+JSON.stringify(page)+','+JSON.stringify(prefs)+')');await pause(180);await evaluate("document.documentElement.classList.toggle('dark',"+(theme==='dark')+')');
    const grids=await inspect(role+'-'+page+'-'+theme+'-'+width,width,[360,1280].includes(width)&&theme==='light'&&gridsNeeded(page));
    if(audit)console.log('PAGE '+page+' '+JSON.stringify(grids));
  }
  if(!audit){
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
    for(const role of roles)for(const kind of ['inventory','master']){
      await evaluate('qa.fixture('+JSON.stringify(kind)+',"period",'+JSON.stringify(role)+')');await pause(100);
      await evaluate("document.querySelector('input[aria-label=Product]').click()");await wait(()=>evaluate("!!document.querySelector('.searchable-combobox-menu')"),'popup');
      const popup=await evaluate("(()=>{const trigger=document.querySelector('input[aria-label=Product]'),menu=document.querySelector('.searchable-combobox-menu'),search=menu.querySelector('.searchable-menu-search');return{width:menu.getBoundingClientRect().width,trigger:trigger.getBoundingClientRect().width,searchAlign:getComputedStyle(search).textAlign,triggerAlign:getComputedStyle(trigger).textAlign};})()");
      assert.ok(popup.width>=popup.trigger-1);assert.equal(popup.searchAlign,'left');assert.equal(popup.triggerAlign,'left');
      await evaluate("document.activeElement.blur();document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))");surfaces++;
    }
  }
  console.log('SURFACES '+surfaces+' ISSUES '+issues.length);for(const issue of issues.slice(0,15))console.log('ISSUE '+JSON.stringify(issue));assert.deepEqual(errors,[]);
  if(!audit)assert.equal(issues.length,0,'Layout/text defects remain');
} finally {if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close');}catch{}socket.close();}chrome?.kill();await server.close();}
function gridsNeeded(page){return ['owner-reports','mkt-reports','mgmt-reports'].includes(page);}
