import { reviewedPelletMasterAdditions } from './pellet-master-baseline.mjs';
import { restoreDatePeriodFile } from './date-period-baseline.mjs';
import { reviewedSummaryColorsAdditions } from './summary-colors-baseline.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { reviewedProductionOutputAdditions } from './production-output-baseline.mjs';
import { reviewedProcessFlowAdditions } from './process-flow-baseline.mjs';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createServer } from 'vite';
import { UX_BASELINE, UX_NEW_FILES, reviewedUXDeltas, uxBaseline, restoreUXFile } from './ux-baseline.mjs';

const read = file => restoreDatePeriodFile(file, fs.readFileSync(file, 'utf8')).replace(/\r/g, '');
const files = dir => fs.readdirSync(dir, { withFileTypes:true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
const parse = text => ts.createSourceFile('view.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const jsx = node => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
const uiProps = new Set(['draft','dirty','dialogRole','emptyMessage','confirmMessage','onStart','busyLabel']);
const uiComponents = new Set(['ActiveFilters','LastUpdated','TermHelp','RelatedRecords','EmptyState']);
const uiVariables = new Set(['creationNotice','receivingNotice','hardwareCaptureRef','statusPresentation']);
const printer = ts.createPrinter({removeComments:true});
const print = (node, tree) => printer.printNode(ts.EmitHint.Unspecified, node, tree).replace(/\s+/g,' ').trim();
function normalized(text, file) {
  // Only this reviewed feedback string changes inside an existing transaction callback.
  text = text.replace('`${pipe.barcode} confirmed at Location ${location}. Company On Hand is unchanged.`', "'Physical location confirmed. Company On Hand is unchanged.'");
  const tree = parse(text);
  const result = ts.transform(tree, [context => {
    const visit = node => {
      if (ts.isImportDeclaration(node)) {
        if (/\/(?:ActionButton|UXFeedback|RecordReference|uiViewState|uiSubmission)$/.test(node.moduleSpecifier.text)) return undefined;
        if (['src/components/Modal.tsx','src/components/Pagination.tsx'].includes(file) && node.moduleSpecifier.text === 'react') {
          const old = node.importClause, names = old?.namedBindings;
          if (names && ts.isNamedImports(names)) {
            const kept = names.elements.filter(item => item.name.text !== (file.includes('Modal') ? 'useState' : 'useEffect'));
            return ts.factory.updateImportDeclaration(node,node.modifiers,ts.factory.updateImportClause(old,old.isTypeOnly,old.name,kept.length ? ts.factory.updateNamedImports(names,kept) : undefined),node.moduleSpecifier,node.attributes);
          }
        }
      }
      if (ts.isFunctionDeclaration(node) && ['Modal','ConfirmModal','StatusBadge'].includes(node.name?.text)) return ts.factory.createExpressionStatement(ts.factory.createIdentifier('REVIEWED_UI_' + node.name.text));
      if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === 'viewKey') return undefined;
      if ((ts.isPropertySignature(node) || ts.isBindingElement(node)) && node.name && uiProps.has(node.name.getText(tree))) return undefined;
      if (ts.isVariableStatement(node)) {
        const kept = node.declarationList.declarations.filter(item => !uiVariables.has(item.name.getText(tree)));
        if (!kept.length) return undefined;
        if (kept.length !== node.declarationList.declarations.length) node = ts.factory.updateVariableStatement(node,node.modifiers,ts.factory.updateVariableDeclarationList(node.declarationList,kept));
      }
      if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'focusHardwareInput') return ts.factory.updateVariableDeclaration(node,node.name,node.exclamationToken,node.type,ts.factory.createArrowFunction(undefined,undefined,[],undefined,ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),ts.factory.createIdentifier('undefined')));
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
        const name = node.expression.expression.getText(tree), text = node.getText(tree);
        if (name === 'useDraftProtection' || (file.includes('Pagination') && name === 'useEffect') || (name === 'setScannerStatus' && text.includes('Duplicate scan ignored'))) return undefined;
      }
      if (ts.isIfStatement(node) && node.expression.getText(tree) === 'document.querySelector(\'[aria-modal="true"]\')') return undefined;
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(tree);
        if (name === 'useViewState') return ts.factory.updateCallExpression(node,ts.factory.createIdentifier('useState'),node.typeArguments,node.arguments.slice(1,2).map(arg => ts.visitNode(arg,visit)));
        if (name === 'useFilterChangeEffect') return ts.factory.updateCallExpression(node,ts.factory.createIdentifier('useEffect'),node.typeArguments,node.arguments.map(arg => ts.visitNode(arg,visit)));
        if (name === 'useProductFilters' && node.arguments.length === 2) return ts.factory.updateCallExpression(node,node.expression,node.typeArguments,[]);
      }
      if (jsx(node)) return ts.factory.createIdentifier('PRESENTATION');
      return ts.visitEachChild(node,visit,context);
    }; return root => ts.visitNode(root,visit);
  }]);
  const value = print(result.transformed[0], tree); result.dispose(); return value;
}
function originalProps(text) {
  const tree = parse(text), values = [];
  const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && (uiComponents.has(node.tagName.getText(tree)) || node.tagName.getText(tree) === 'RecordReference')) return;
    if (ts.isJsxElement(node) && uiComponents.has(node.openingElement.tagName.getText(tree))) return;
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(tree);
      if (!uiProps.has(name) && !['className','style','role','title','ref','tabIndex','colSpan','rowSpan'].includes(name) && !name.startsWith('aria-')) values.push(name + '=' + (node.initializer ? print(node.initializer,tree) : ''));
    }
    ts.forEachChild(node,visit);
  }; visit(tree); return values.sort();
}
function initializer(file, name) {
  const tree = parse(read(file)); let found;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer?.getText(tree); ts.forEachChild(node,visit); }; visit(tree);
  assert.ok(found, `Missing ${name}`); return found;
}
function action(file,name,deps) {
  const js = ts.transpileModule(`const action = ${initializer(file,name)};`,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  return new Function(...Object.keys(deps), js + ';return action;')(...Object.values(deps));
}
let count = 0;
const check = (label, fn) => { fn(); count++; console.log(`PASS ${label}`); };
const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const oldWindow = globalThis.window, oldSession = globalThis.sessionStorage;
try {
  for (const file of files('src').filter(file => /\.(ts|tsx)$/.test(file) && !UX_NEW_FILES.includes(file) && !reviewedSummaryColorsAdditions[file] && !reviewedPelletMasterAdditions[file] && !reviewedProductionOutputAdditions[file] && !reviewedProcessFlowAdditions[file])) {
    const current = read(file), baseline = uxBaseline(file);
    if (current === baseline) check(`Protected source byte-for-byte unchanged: ${file}`, () => assert.equal(current,baseline));
    else {
      check(`Exact reviewed UI-only delta; arbitrary edits rejected: ${file}`, () => { assert.equal(restoreUXFile(file,current),baseline); assert.throws(() => restoreUXFile(file,current+'\n// unexpected')); });
      check(`Original non-UI state/formulas/transaction code retained: ${file}`, () => assert.equal(normalized(current,file),normalized(baseline,file)));
      if (!['src/components/Modal.tsx','src/components/StatusBadge.tsx'].includes(file)) check(`Original values/options/disabled guards/event callbacks retained: ${file}`, () => assert.deepEqual(originalProps(current),originalProps(baseline)));
    }
  }
  const gateModule = await server.ssrLoadModule('/src/uiSubmission.ts');
  let release, calls=0; const settled = new Promise(resolve => {release=resolve;}); const gate=gateModule.createSubmissionGate();
  const first=gate.run(()=>{calls++;},()=>settled), duplicate=gate.run(()=>{calls++;},()=>settled);
  assert.equal(await duplicate,false); check('Immediate duplicate click never calls the transaction twice',()=>{assert.equal(calls,1);assert.equal(gate.busy,true);});
  release(); assert.equal(await first,true);
  await gate.run(()=>{calls++;},async()=>{}); check('Submission lock releases and permits the next valid action',()=>{assert.equal(calls,2);assert.equal(gate.busy,false);});
  await assert.rejects(gate.run(()=>{throw new Error('fixture failure');},async()=>{})); check('Errors release the submission lock',()=>assert.equal(gate.busy,false));
  for (const [name,current,original,dirty,child,expected] of [['untouched',undefined,undefined,false,false,false],['unchanged',{qty:'5'},JSON.stringify({qty:'5'}),false,false,false],['changed',{qty:'6'},JSON.stringify({qty:'5'}),false,false,true],['restored output draft',{},'{}',true,false,true],['nested storage form',{},'{}',false,true,true]]) check(`Unsaved protection: ${name}`,()=>assert.equal(gateModule.hasUnsavedChanges(current,original,dirty,child),expected));
  const view = await server.ssrLoadModule('/src/uiViewState.tsx');
  for (const [value,fallback,valid] of [['PE100','',true],[null,'',false],[-1,1,false],[2,1,true],[true,false,true],[{size:'20mm'},{size:''},true],[{size:12},{size:''},false],[{size:'20mm',role:'owner'},{size:''},false]]) check(`View-cache validation: ${JSON.stringify(value)}`,()=>assert.equal(view.validViewValue(value,fallback),valid));
  check('Malformed or inaccessible session storage falls back without clearing data',()=>{assert.equal(view.readViewValue({getItem:()=>'{broken'},'key','default'),'default');assert.equal(view.readViewValue({getItem:()=>{throw Error('blocked');}},'key',1),1);});
  const feedback = await server.ssrLoadModule('/src/components/UXFeedback.tsx');
  check('Empty table contains an accessible explanation, not a blank tbody',()=>{const html=renderToStaticMarkup(React.createElement(feedback.TableBody,null,[]));assert.ok(html.includes('No records match the selected filters.'));assert.ok(html.includes('role="status"'));});
  check('Active filter summaries omit All values and have a clear action',()=>{const html=renderToStaticMarkup(React.createElement(feedback.ActiveFilters,{items:[['Product','HDPE Pipe'],['Grade','PE100'],['Location','All Locations']],onClear:()=>{}}));assert.ok(html.includes('HDPE Pipe'));assert.ok(html.includes('PE100'));assert.ok(!html.includes('All Locations'));assert.ok(html.includes('Clear filters'));});
  check('Last Updated uses actual saved timestamps and never invents a current timestamp',()=>{const html=renderToStaticMarkup(React.createElement(feedback.LastUpdated,{records:[{storedAt:'2026-06-01T08:15:00Z'},{date:'2026-05-31'}]}));assert.ok(html.includes('2026-06-01'));assert.equal(renderToStaticMarkup(React.createElement(feedback.LastUpdated,{records:[]})),'');});
  const badge = await server.ssrLoadModule('/src/components/StatusBadge.tsx');
  check('Finished-goods display aliases are consistent; raw-material Released remains distinct',()=>{assert.deepEqual(badge.statusPresentation('Ready for Release'),badge.statusPresentation('Ready for Ship Out'));assert.equal(badge.statusPresentation('Shipped Out').label,'Shipped');assert.equal(badge.statusPresentation('Released').label,'Released');assert.equal(badge.statusPresentation('OUT OF STOCK').className,'badge-red');});
  const pagination = await server.ssrLoadModule('/src/components/Pagination.tsx');
  check('Pagination remains ten records per page, with no redundant single-page navigation',()=>{assert.equal(pagination.PAGE_SIZE,10);const rows=Array.from({length:23},(_,i)=>i);assert.deepEqual([1,2,3].map(page=>pagination.pageRecords(rows,page).length),[10,10,3]);const html=renderToStaticMarkup(React.createElement(pagination.default,{page:1,totalRecords:3,onPageChange:()=>{}}));assert.ok(html.includes('of 3'));assert.ok(!html.includes('>Next<'));});

  const rr='src/pages/accounting/RRRecords.tsx', output='src/pages/production/ProductionOrders.tsx', scanner='src/pages/production/BarcodeScanner.tsx';
  let message='', transactions=0;
  const rrDeps={form:{storageLocation:'',numberOfBags:'5',supplier:'Supplier',referenceNo:'REF-1',remarks:''},setFormError:value=>{message=value;},createReceivingReport:()=>{transactions++;},setShowNew:()=>{}};
  action(rr,'submitRR',rrDeps)();check('Missing Location gives the original specific error and creates nothing',()=>{assert.equal(message,'Storage Location is required.');assert.equal(transactions,0);});
  rrDeps.form.storageLocation='B'; const save=action(rr,'submitRR',rrDeps), rrGate=gateModule.createSubmissionGate(); let finish; const wait=new Promise(resolve=>{finish=resolve;});
  const saving=rrGate.run(save,()=>wait);await rrGate.run(save,()=>wait);finish();await saving;check('Valid receiving callback executes exactly once under rapid repeat submission',()=>assert.equal(transactions,1));
  const outputDeps={submitting:false,outputQty:'1',rejectQty:'0',rejections:[],viewPO:{targetQty:20,completedQty:0},unitWeightConfigured:true,wipAvailable:25,materialPlan:null,viewId:'test-po',setError:value=>{message=value;},setSubmitting:()=>{},recordOutput:()=>{throw Error('Validation must stop first');}};
  for(const [label,extra,expected] of [['invalid quantity',{outputQty:'0'},'Enter the completed quantity.'],['missing unit weight',{unitWeightConfigured:false},'UNIT WEIGHT CONFIGURATION REQUIRED'],['missing WIP',{wipAvailable:0},'MATERIAL USAGE MISSING'],['insufficient WIP',{outputQty:'5',wipAvailable:10,materialCapacity:2,materialPlan:{pelletRequiredKg:25,baseColorantKg:0,stripeColorantKg:0,totalMaterialConsumedKg:25},baseColorant:undefined,stripeRequired:false},'INSUFFICIENT MATERIAL']]){message='';action(output,'handleSaveOutput',{...outputDeps,...extra})();check(`Actual production validation: ${label}`,()=>assert.ok(message.includes(expected)));}
  let duplicates=0;
  action(scanner,'confirmPellet',{result:{category:'Pellet',record:{barcode:'bag',availableKg:25}},activePO:{poNo:'PO-fixture'},processedRef:{current:new Map([['bag',{barcode:'bag'}]])},duplicateKey:value=>value,showDuplicate:()=>{duplicates++;}})();
  check('Actual duplicate-scan guard stops before any material action and retains the workflow',()=>assert.equal(duplicates,1));
  action(scanner,'confirmPellet',{result:{category:'Pellet',record:{availableKg:25}},activePO:undefined})();
  check('No active PO cannot reach a pellet-load transaction',()=>assert.ok(read(scanner).includes('No active Production Order')));

  const store = await server.ssrLoadModule('/src/store.tsx'), search = await server.ssrLoadModule('/src/components/UniversalSearch.tsx'), refs = await server.ssrLoadModule('/src/recordReferences.ts'), referenceUI = await server.ssrLoadModule('/src/components/RecordReference.tsx');
  let base; function Capture(){base=store.useApp();return null;} renderToStaticMarkup(React.createElement(store.AppProvider,null,React.createElement(Capture)));
  const original = JSON.stringify(base), session = new Map(), local = new Map(), writes=[];
  globalThis.window={sessionStorage:{getItem:key=>session.get(key)??null,setItem:(key,value)=>{writes.push(key);session.set(key,value);},removeItem:key=>session.delete(key)},localStorage:{getItem:key=>local.get(key)??null,setItem:()=>{throw Error('Business localStorage write during QA');}},location:{hostname:'test.invalid'}};
  globalThis.sessionStorage=window.sessionStorage;
  const Provider=globalThis.__HPAI_APP_CONTEXT__.Provider;
  const render=(child,user,extra={})=>renderToStaticMarkup(React.createElement(Provider,{value:{...base,currentUser:user,...extra}},React.createElement(view.ViewStateScope,null,React.createElement(referenceUI.RecordReferenceProvider,null,child))));
  for(const user of store.USERS){
    const app={...base,currentUser:user}, index=search.buildUniversalIndex(app);
    check(`${user.role}: clickable references are a strict subset of the unchanged authorized index`,()=>{for(const item of index){for(const target of refs.referenceTargets(index,item.title))assert.ok(index.includes(target));}if(user.role==='production'){for(const order of base.orders)assert.equal(refs.referenceTargets(index,order.orderNo).length,0);}if(user.role==='accounting'){for(const mo of base.manufacturingOrders)assert.equal(refs.referenceTargets(index,mo.moNo).length,0);}});
    const item=index.find(item=>['FINISHED PIPES','PRODUCTION ORDERS','RECEIVING REPORTS','MATERIAL REQUESTS'].includes(item.group));
    check(`${user.role}: authorized reference renders a read-only in-place action`,()=>{const html=render(React.createElement(referenceUI.default,{value:item.title}),user);assert.match(html,/class="[^"]*\brecord-reference\b[^"]*"/);assert.ok(html.includes(item.title));});
    const pipe=base.finishedGoods[0]; if(pipe.barcodeMigrations?.length)check(`${user.role}: former barcode/Record ID stays read-only traceability, never an active physical label`,()=>{const old=pipe.barcodeMigrations[0].oldBarcode;for(const match of refs.referenceTargets(index,old)){assert.notEqual(match.record.barcode,old);assert.ok(refs.legacyReferenceMessage(match.record,old)?.includes(match.record.barcode));const html=render(React.createElement(referenceUI.default,{value:old}),user);assert.ok(html.includes('Legacy barcode.'));}});
  }
  check('Reverse related links use actual recorded IDs/references, not invented relationships',()=>{const index=search.buildUniversalIndex({...base,currentUser:store.USERS.find(user=>user.role==='OWNER_SUPER_ADMIN')});const order=base.orders[0];for(const value of refs.reverseReferenceValues(index,order))assert.ok(index.some(item=>item.title===value&&refs.relatedReferenceValues(item.record).some(ref=>ref===order.id||ref===order.orderNo)));assert.deepEqual(refs.referenceTargets(index,'NOT-A-REAL-REFERENCE'),[]);});
  let capturedValue,capturedSetter;function ViewCapture(){[capturedValue,capturedSetter]=view.useViewState('test:search','');return null;}
  const owner=store.USERS.find(user=>user.role==='OWNER_SUPER_ADMIN'), accountant=store.USERS.find(user=>user.role==='accounting');
  render(React.createElement(ViewCapture),owner,{currentPage:'owner-records'});capturedSetter('PE100');
  render(React.createElement(ViewCapture),owner,{currentPage:'owner-records'});check('Search preference is restored on returning to the same authorized page',()=>assert.equal(capturedValue,'PE100'));
  render(React.createElement(ViewCapture),accountant,{currentPage:'acc-rr-records'});check('Cached view preferences do not leak across roles or employees',()=>assert.equal(capturedValue,''));
  check('Only namespaced UI session keys were written; business state stays untouched',()=>{assert.ok(writes.every(key=>key.startsWith(view.VIEW_STATE_PREFIX)));assert.equal(JSON.stringify(base),original);});
  const roleMap={owner:'OWNER_SUPER_ADMIN',accounting:'accounting',marketing:'marketing',management:'management',plantmanager:'plantmanager',production:'production'};
  for(const file of files('src/pages').filter(file=>file.endsWith('.tsx'))){
    const text=read(file);check(`UX source audit: ${file}`,()=>{assert.equal(parse(text).parseDiagnostics.length,0);assert.ok(!/<tbody\b/.test(text)||!text.includes('<table'));});
    const role=roleMap[file.split('/')[2]];if(!role)continue;
    const user=store.USERS.find(user=>user.role===role), Page=(await server.ssrLoadModule('/'+file)).default;
    const attendance={...base.attendance[0],employeeId:user.employeeId,employeeName:user.name,status:'Active',shift:'Day'};
    check(`All-six-role page render: ${file}`,()=>assert.ok(render(React.createElement(Page),user,{currentPage:file,attendance:[attendance],activeAttendance:attendance,activeProductionOrder:base.productionOrders[0],pendingTurnover:undefined,currentSessionTurnover:undefined}).length>100));
  }
  const css=read('src/index.css'),marker='/* Frontend UX:';
  check('UX styles preserve the established layout and theme rules',()=>{assert.equal(css.slice(0,css.indexOf(marker)).trimEnd(),uxBaseline('src/index.css').trimEnd());const added=css.slice(css.indexOf(marker));assert.ok(!/position:\s*absolute|#[0-9a-f]{3,8}\b|height:\s*[2-9]\d\dpx/.test(added));});
  for(const width of [360,375,390,412,430])check(`${width}px CSS structure retains readable wrapping filters/actions/details`,()=>{assert.ok(css.includes('.active-filter-summary { align-items: stretch; flex-direction: column; }'));assert.ok(css.includes('.reference-detail-grid { grid-template-columns: minmax(0, 1fr); }'));});
  check('Scanner focus recovery is camera-free and cannot process scans behind a confirmation dialog',()=>{const text=read(scanner);assert.ok(text.includes('hardwareCaptureRef.current?.focus({ preventScroll: true })'));assert.ok(text.includes('if (document.querySelector(\'[aria-modal="true"]\')) return;'));assert.ok(!text.includes('getUserMedia'));assert.ok(text.includes('This barcode has already been scanned.'));});
  check('Modal guards apply to actual changes; Escape, focus trap and original confirm callback remain available',()=>{const text=read('src/components/Modal.tsx');for(const fragment of ['hasUnsavedChanges','event.key === \'Tab\'','event.key === \'Escape\'','beforeunload','onClick={onConfirm}','Leave without saving'])assert.ok(text.includes(fragment));});
  check('UI helpers cannot mutate inventory, generate records, or create backend/database code',()=>{for(const file of UX_NEW_FILES){const text=read(file);assert.ok(!/\b(?:createReceivingReport|createCustomerOrder|createProductionOrder|reserveFinishedGoods|recordOutput|releaseFinishedGood|updateFinishedGoodStorage|relocatePhysicalItem)\s*\(|localStorage\.setItem|localStorage\.clear|Math\.random|createClient|\.rpc\(/.test(text),file);}});
  console.log(`Completed ${count} UX callback-preservation, duplicate-submit, validation, reference-permission, view-state, empty-state, CSS and all-role rendering checks against ${UX_BASELINE}. Interactive scanner/keyboard/viewport/light-dark QA remains unverified: no connected browser.`);
}finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldSession===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=oldSession;await server.close();}
