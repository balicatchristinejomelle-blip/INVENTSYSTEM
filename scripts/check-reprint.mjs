import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import ts from 'typescript';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let checks = 0;
const check = (name, callback) => { callback(); checks++; console.log(`PASS ${name}`); };
const now = '2026-10-14T10:00:00+08:00';
const storageKey = 'hpai:shared-app-state-v1';
const storage = new Map();
const originalWindow = globalThis.window;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
try {
  const flow = await server.ssrLoadModule('/src/reprintWorkflow.ts');
  const records = await server.ssrLoadModule('/src/printableRecords.ts');
  const samples = await server.ssrLoadModule('/src/reprintSamples.ts');
  const { AppProvider, useApp, USERS } = await server.ssrLoadModule('/src/store.tsx');
  const { matchesRecord } = await server.ssrLoadModule('/src/components/RecordSearch.tsx');
  const { pageRecords } = await server.ssrLoadModule('/src/components/Pagination.tsx');
  const { buildUniversalIndex } = await server.ssrLoadModule('/src/components/UniversalSearch.tsx');
  const { notificationsForRole } = await server.ssrLoadModule('/src/components/NotificationPanel.tsx');
  let app;
  function Capture() { app = useApp(); return null; }
  const capture = child => renderToStaticMarkup(React.createElement(AppProvider, null, React.createElement(Capture), child));
  capture();
  const baseline = JSON.parse(JSON.stringify(app));
  const printables = records.printableRecords(baseline);
  const management = USERS.find(user => user.role === 'management');
  const owner = USERS.find(user => user.role === 'OWNER_SUPER_ADMIN');
  const plantmanager = USERS.find(user => user.role === 'plantmanager');
  const document = printables.find(item => item.recordType === 'PRODUCTION ORDER');
  const barcode = printables.find(item => item.recordType === 'Finished Pipe');
  const empty = { printMetadata: {}, reprintRequests: [] };
  const success = result => { assert.equal(result.success, true, result.error); return result.state; };

  for (const user of USERS) {
    const record = printables.find(item => item.allowedRoles.includes(user.role));
    check(`${user.role}: authorized original print then no immediate second print`, () => {
      assert.ok(record);
      assert.equal(flow.validatePrint(empty, user, record), null);
      const printed = success(flow.completePrint(empty, user, record, now));
      assert.equal(printed.printMetadata[record.key].printCount, 1);
      assert.ok(flow.validatePrint(printed, user, record));
      assert.equal(flow.printState(printed, record), 'PRINTED');
    });
    check(`${user.role}: approval actions require Management and cannot self-approve`, () => {
      const printed = success(flow.completePrint(empty, user, record, now));
      const pending = success(flow.requestReprint(printed, user, record, 'Lost copy', now, `test-${user.role}`));
      assert.equal(flow.reviewReprint(pending, user, `test-${user.role}`, 'APPROVED', '', now).success, false);
      assert.equal(flow.reviewReprint(pending, user, `test-${user.role}`, 'REJECTED', 'Reason', now).success, false);
    });
  }
  for (const record of [document, barcode]) {
    let state = success(flow.completePrint(empty, plantmanager, record, now));
    const original = JSON.stringify(record);
    check(`${record.kind}: blank and whitespace reasons rejected`, () => {
      for (const reason of ['', ' ', '\n\t']) assert.equal(flow.requestReprint(state, plantmanager, record, reason, now, 'bad').success, false);
    });
    state = success(flow.requestReprint(state, plantmanager, record, 'Printer issue', now, `request-${record.kind}`));
    const requestId = state.reprintRequests[0].id;
    check(`${record.kind}: pending blocks printing and duplicate requests`, () => {
      assert.equal(flow.printState(state, record), 'REPRINT_PENDING');
      assert.ok(flow.validatePrint(state, plantmanager, record, requestId));
      assert.equal(flow.requestReprint(state, plantmanager, record, 'Lost copy', now, 'duplicate').success, false);
    });
    state = success(flow.reviewReprint(state, management, requestId, 'APPROVED', '', now));
    check(`${record.kind}: approval records actor/time but does not print`, () => {
      assert.equal(state.printMetadata[record.key].printCount, 1);
      assert.equal(state.reprintRequests[0].status, 'APPROVED');
      assert.equal(state.reprintRequests[0].approvedBy, management.name);
      assert.equal(flow.validatePrint(state, plantmanager, record, requestId), null);
    });
    check(`${record.kind}: approval limited to exact requester, record and barcode value`, () => {
      assert.ok(flow.validatePrint(state, { ...plantmanager, employeeId: 'another-user' }, record, requestId));
      assert.ok(flow.validatePrint(state, plantmanager, { ...record, value: `${record.value || ''}-changed` }, requestId));
      assert.ok(flow.validatePrint(state, plantmanager, { ...record, reference: 'another-reference' }, requestId));
      assert.ok(flow.validatePrint(state, plantmanager, barcode === record ? document : barcode, requestId));
    });
    state = success(flow.completePrint(state, plantmanager, record, now, requestId));
    check(`${record.kind}: one approval becomes USED with count 2; reuse blocked`, () => {
      assert.equal(state.printMetadata[record.key].printCount, 2);
      assert.equal(state.reprintRequests[0].status, 'USED');
      assert.equal(state.reprintRequests[0].usedBy, plantmanager.name);
      assert.equal(state.reprintRequests[0].printCountAfter, 2);
      assert.equal(flow.completePrint(state, plantmanager, record, now, requestId).success, false);
      assert.equal(flow.printState(state, record), 'PRINTED');
      assert.equal(JSON.stringify(record), original);
    });
    check(`${record.kind}: next print requires a new request`, () => assert.equal(flow.requestReprint(state, plantmanager, record, 'Lost copy', now, 'next').success, true));
  }
  check('Rejected requests require a reason and never authorize printing', () => {
    let state = success(flow.completePrint(empty, plantmanager, document, now));
    state = success(flow.requestReprint(state, plantmanager, document, 'Lost copy', now, 'reject'));
    assert.equal(flow.reviewReprint(state, management, 'reject', 'REJECTED', ' ', now).success, false);
    state = success(flow.reviewReprint(state, management, 'reject', 'REJECTED', 'Existing copy usable', now));
    assert.equal(state.reprintRequests[0].rejectionReason, 'Existing copy usable');
    assert.ok(flow.validatePrint(state, plantmanager, document, 'reject'));
    assert.equal(flow.requestReprint(state, plantmanager, document, 'New valid reason', now, 'new').success, true);
  });
  check('Another Management employee can approve a Management requester', () => {
    let state = success(flow.completePrint(empty, management, document, now));
    state = success(flow.requestReprint(state, management, document, 'Lost copy', now, 'management-own'));
    assert.equal(flow.reviewReprint(state, management, 'management-own', 'APPROVED', '', now).success, false);
    const another = { ...management, id: 'test-management-2', employeeId: 'TEST-MGT-002', name: 'Another Management' };
    assert.equal(flow.reviewReprint(state, another, 'management-own', 'APPROVED', '', now).success, true);
  });
  check('Owner cannot bypass approval or approve another employee request', () => {
    let state = success(flow.completePrint(empty, owner, document, now));
    assert.ok(flow.validatePrint(state, owner, document));
    state = success(flow.requestReprint(state, owner, document, 'Lost copy', now, 'owner-request'));
    assert.equal(flow.reviewReprint(state, owner, 'owner-request', 'APPROVED', '', now).success, false);
    assert.equal(flow.canViewRequest(owner, state.reprintRequests[0]), true);
  });
  check('Unauthenticated and inactive users have no print access', () => {
    assert.ok(flow.validatePrint(empty, null, document));
    assert.ok(flow.validatePrint(empty, { ...plantmanager, status: 'inactive' }, document));
    assert.equal(flow.requestReprint(empty, null, document, 'Lost copy', now, 'bad').success, false);
  });
  check('Legacy Printed barcode safely hydrates count 1 without made-up dates', () => {
    const legacy = { ...baseline, finishedGoods: baseline.finishedGoods.map((item, index) => index === 0 ? { ...item, printStatus: 'Printed' } : item) };
    const hydrated = records.hydratePrintWorkflow(legacy, {});
    const record = records.printableRecords(legacy).find(item => item.recordType === 'Finished Pipe');
    assert.equal(flow.metadataFor(hydrated, record).printCount, 1);
    assert.equal(flow.metadataFor(hydrated, record).firstPrintedAt, undefined);
    assert.ok(flow.validatePrint(hydrated, plantmanager, record));
    assert.equal(flow.metadataFor(hydrated, document).printCount, 0);
  });
  const demo = samples.seedReprintSamples(baseline, USERS);
  check('Four demo states reference real existing records and employees only', () => {
    assert.deepEqual(demo.reprintRequests.map(item => item.status), ['PENDING', 'APPROVED', 'USED', 'REJECTED']);
    for (const request of demo.reprintRequests) {
      assert.ok(printables.find(item => item.key === request.printable.key));
      assert.ok(USERS.find(user => user.employeeId === request.requestedBy));
    }
  });
  check('Request search is partial/case-insensitive and includes barcode, PO, employee, reason, status and date', () => {
    for (const query of [document.reference.toLowerCase(), 'rosa', 'PRINTER', 'pending', '2026-10-13', barcode.value.toLowerCase()]) assert.ok(demo.reprintRequests.some(request => matchesRecord(request, query)), query);
  });
  check('Search and filters precede pagination, capped at ten records', () => {
    const many = Array.from({ length: 31 }, (_, index) => ({ ...demo.reprintRequests[0], id: `match-${index}`, status: index < 23 ? 'PENDING' : 'USED' }));
    const matched = many.filter(item => item.status === 'PENDING' && matchesRecord(item, 'match-'));
    assert.deepEqual([1, 2, 3].map(page => pageRecords(matched, page).length), [10, 10, 3]);
  });
  for (const user of USERS) check(`${user.role}: universal requests limited to Management, Owner or own employee`, () => {
    const index = buildUniversalIndex({ ...baseline, ...demo, currentUser: user });
    const requests = index.filter(item => item.group === 'REPRINT REQUESTS');
    const expected = demo.reprintRequests.filter(request => flow.canViewRequest(user, request));
    assert.deepEqual(requests.map(item => item.id), expected.map(item => item.id));
    assert.ok(requests.every(item => !JSON.stringify(item.record).includes(user.password)));
  });
  check('Requester notifications are employee-scoped even within the same role', () => {
    const approved = demo.notifications.find(item => item.recipientEmployeeId === plantmanager.employeeId);
    assert.ok(notificationsForRole([approved], plantmanager.role, plantmanager.employeeId).length);
    assert.equal(notificationsForRole([approved], plantmanager.role, 'another-employee').length, 0);
    assert.equal(notificationsForRole([approved], owner.role, owner.employeeId).length, 1);
  });

  globalThis.window = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } };
  const load = (user, snapshot = baseline) => {
    storage.set(storageKey, JSON.stringify({ ...snapshot, currentUser: user, currentPage: 'notifications' }));
    capture();
    return app;
  };
  const saved = () => JSON.parse(storage.get(storageKey));
  const businessKeys = ['pellets', 'finishedGoods', 'productionOrders', 'manufacturingOrders', 'rrRecords', 'orders', 'materialRequests', 'transfers', 'recyclingBatches', 'rejectedMaterials', 'colorants', 'materialUsageTransactions', 'transactions', 'attendance', 'turnovers', 'customers', 'employees'];
  const businessSnapshot = snapshot => Object.fromEntries(businessKeys.map(key => [key, snapshot[key]]));
  let requester = load(plantmanager);
  const beforeBusiness = businessSnapshot(requester);
  let job = await requester.beginPrint([barcode.key]);
  check('Store first preview creates a ticket but no print metadata', () => { assert.equal(job.success, true); assert.equal(saved().printMetadata[barcode.key], undefined); });
  const duplicate = await requester.beginPrint([barcode.key]);
  check('Rapid duplicate first-print start is blocked', () => assert.equal(duplicate.success, false));
  check('Cancel preview preserves Never Printed', () => { assert.equal(requester.finishPrint(job.ticket, false).success, true); assert.equal(saved().printMetadata[barcode.key], undefined); });
  await new Promise(resolve => setTimeout(resolve, 0));
  job = await requester.beginPrint([barcode.key]);
  check('Store records actual first print only on explicit confirmation', () => {
    assert.equal(job.success, true, job.error);
    const completed = requester.finishPrint(job.ticket, true);
    assert.equal(completed.success, true, completed.error);
    assert.equal(saved().printMetadata[barcode.key].printCount, 1);
    assert.equal(requester.finishPrint(job.ticket, true).success, false);
  });
  check('Pending request persists with exact Management notification and audit', () => {
    assert.equal(requester.submitReprintRequest(barcode.key, 'Printer issue').success, true);
    assert.equal(requester.submitReprintRequest(barcode.key, 'Lost copy').success, false);
    const state = saved();
    assert.equal(state.reprintRequests[0].status, 'PENDING');
    assert.equal(state.notifications[0].reprintRequestId, state.reprintRequests[0].id);
    assert.deepEqual(state.notifications[0].roles, ['management']);
    assert.equal(state.auditLogs[0].action, 'Reprint Requested');
  });
  let snapshot = saved();
  const requestId = snapshot.reprintRequests[0].id;
  requester = load(plantmanager, snapshot);
  check('Refresh retains Pending and blocks unauthorized print', () => assert.equal(requester.reprintRequests[0].status, 'PENDING'));
  assert.equal((await requester.beginPrint([barcode.key], requestId)).success, false);
  let approver = load(management, saved());
  check('Approval is separate from print and persists through refresh', () => {
    assert.equal(approver.decideReprintRequest(requestId, 'APPROVED').success, true);
    assert.equal(saved().reprintRequests[0].status, 'APPROVED');
    assert.equal(saved().printMetadata[barcode.key].printCount, 1);
    assert.equal(saved().notifications[0].recipientEmployeeId, plantmanager.employeeId);
  });
  requester = load(plantmanager, saved());
  job = await requester.beginPrint([barcode.key], requestId);
  check('Approved preview and cancellation do not consume authorization', () => {
    assert.equal(job.success, true);
    assert.equal(saved().reprintRequests[0].status, 'APPROVED');
    assert.equal(requester.finishPrint(job.ticket, false).success, true);
    assert.equal(saved().reprintRequests[0].status, 'APPROVED');
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  job = await requester.beginPrint([barcode.key], requestId);
  check('Successful approved reprint persists USED and count 2', () => {
    assert.equal(requester.finishPrint(job.ticket, true).success, true);
    assert.equal(saved().reprintRequests[0].status, 'USED');
    assert.equal(saved().printMetadata[barcode.key].printCount, 2);
  });
  requester = load(plantmanager, saved());
  const reused = await requester.beginPrint([barcode.key], requestId);
  check('Refresh cannot reuse USED approval', () => assert.equal(reused.success, false));
  check('Print/request/approve/reprint leaves every operational collection unchanged', () => assert.deepEqual(businessSnapshot(saved()), beforeBusiness));
  const otherBarcodes = printables.filter(item => item.kind === 'Barcode' && item.key !== barcode.key).slice(0, 2);
  job = await requester.beginPrint(otherBarcodes.map(item => item.key));
  check('Batch originals are reserved together and record one event per label', () => {
    assert.equal(job.success, true);
    assert.equal(requester.finishPrint(job.ticket, true).success, true);
    for (const record of otherBarcodes) assert.equal(saved().printMetadata[record.key].printCount, 1);
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const mixed = await requester.beginPrint([barcode.key, document.key]);
  check('Mixed batch cannot sneak an already printed label through first print', () => assert.equal(mixed.success, false));
  const duplicateBatch = await requester.beginPrint([document.key, document.key]);
  check('Duplicate batch IDs are rejected', () => assert.equal(duplicateBatch.success, false));
  const invented = await requester.beginPrint(['invented-record']);
  check('Unsupported printable records cannot be introduced through store actions', () => assert.equal(invented.success, false));
  await new Promise(resolve => setTimeout(resolve, 0));

  // Exercise the browser-origin lock contract without launching a browser or changing user's data.
  let held = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (_name, _options, callback) => {
    if (held) return callback(null);
    held = true;
    try { return await callback({ name: 'test-lock' }); } finally { held = false; }
  } } } });
  requester = load(plantmanager, saved());
  const anotherTab = load(plantmanager, saved());
  job = await requester.beginPrint([document.key]);
  const conflict = await anotherTab.beginPrint([document.key]);
  check('Browser origin lock prevents a second tab from opening another print session', () => { assert.equal(job.success, true); assert.equal(conflict.success, false); });
  requester.finishPrint(job.ticket, false);
  await new Promise(resolve => setTimeout(resolve, 0));
  const afterCancel = await anotherTab.beginPrint([document.key]);
  check('Cancelling a print releases the cross-tab lock without recording a print', () => assert.equal(afterCancel.success, true));
  anotherTab.finishPrint(afterCancel.ticket, false);
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;

  await new Promise(resolve => setTimeout(resolve, 0));
  requester = load(plantmanager);
  const beforeDocument = businessSnapshot(requester);
  job = await requester.beginPrint([document.key]);
  check('Live PO document first-print event records count 1 without changing PO', () => {
    assert.equal(job.success, true, job.error);
    assert.equal(requester.finishPrint(job.ticket, true).success, true);
    assert.equal(saved().printMetadata[document.key].printCount, 1);
  });
  check('Live PO reprint request persists exact document ID and reference', () => {
    assert.equal(requester.submitReprintRequest(document.key, 'Document damaged').success, true);
    assert.equal(saved().reprintRequests[0].printable.recordId, document.recordId);
    assert.equal(saved().reprintRequests[0].printable.reference, document.reference);
  });
  const documentRequest = saved().reprintRequests[0].id;
  approver = load(management, saved());
  check('Live PO approval does not print or advance production status', () => {
    assert.equal(approver.decideReprintRequest(documentRequest, 'APPROVED').success, true);
    assert.equal(saved().printMetadata[document.key].printCount, 1);
  });
  requester = load(plantmanager, saved());
  await new Promise(resolve => setTimeout(resolve, 0));
  job = await requester.beginPrint([document.key], documentRequest);
  check('Live PO approved reprint uses the same document and consumes once', () => {
    assert.equal(job.success, true, job.error);
    assert.equal(requester.finishPrint(job.ticket, true).success, true);
    assert.equal(saved().reprintRequests[0].status, 'USED');
    assert.equal(saved().printMetadata[document.key].printCount, 2);
    assert.deepEqual(businessSnapshot(saved()), beforeDocument);
  });
  check('Read-only document search includes Used state without mutating the PO', () => {
    const state = saved();
    const po = state.productionOrders.find(item => item.id === document.recordId);
    const enriched = records.withPrintSearch(state, po);
    assert.equal(matchesRecord(enriched, 'USED'), true);
    assert.equal(po.printCount, undefined);
  });

  check('Existing saved data is not seeded or cleared on load', () => {
    const legacy = { ...baseline }; delete legacy.printMetadata; delete legacy.reprintRequests;
    const restored = load(plantmanager, legacy);
    assert.equal(restored.reprintRequests.length, 0);
    assert.deepEqual(restored.productionOrders, baseline.productionOrders);
  });
  storage.delete(storageKey); capture();
  check('Fresh localhost dataset contains the four demonstration states', () => assert.equal(app.reprintRequests.length, 4));
  const approvals = (await server.ssrLoadModule('/src/components/ReprintApprovals.tsx')).default;
  const printAction = (await server.ssrLoadModule('/src/components/PrintAction.tsx')).default;
  const DocButton = (await server.ssrLoadModule('/src/components/DocumentPrintButton.tsx')).default;
  for (const user of USERS) {
    load(user, { ...baseline, ...demo });
    const html = capture(React.createElement(approvals));
    check(`${user.role}: approval list renders or shows Access Restricted`, () => assert.equal(html.includes('Reprint Approvals'), user.role === 'management'));
  }
  load(owner, { ...baseline, ...demo });
  const ownerHtml = capture(React.createElement(approvals, { monitor: true }));
  check('Owner monitor is read-only, without Approve/Reject controls', () => { assert.ok(ownerHtml.includes('read-only')); assert.ok(!ownerHtml.includes('Approve Reprint')); });
  load(plantmanager, { ...baseline, ...empty });
  let html = capture(React.createElement(printAction, { record: barcode, onPreview: () => true }));
  check('Never Printed UI offers Print, not unrestricted Reprint', () => { assert.ok(html.includes('>Print</button>')); assert.ok(!html.includes('>Reprint</button>')); });
  const printed = success(flow.completePrint(empty, plantmanager, barcode, now));
  load(plantmanager, { ...baseline, ...printed });
  html = capture(React.createElement(printAction, { record: barcode, onPreview: () => true }));
  check('Printed UI offers Request Reprint, not Reprint', () => { assert.ok(html.includes('>Request Reprint</button>')); assert.ok(!html.includes('>Reprint</button>')); });
  const pending = success(flow.requestReprint(printed, plantmanager, barcode, 'Lost copy', now, 'ui-request'));
  load(plantmanager, { ...baseline, ...pending });
  html = capture(React.createElement(printAction, { record: barcode, onPreview: () => true }));
  check('Pending UI shows View Request and no Reprint', () => { assert.ok(html.includes('>View Request</button>')); assert.ok(!html.includes('>Reprint</button>')); });
  const approved = success(flow.reviewReprint(pending, management, 'ui-request', 'APPROVED', '', now));
  load(plantmanager, { ...baseline, ...approved });
  html = capture(React.createElement(printAction, { record: barcode, onPreview: () => true }));
  check('Approved UI offers exactly the guarded Reprint', () => assert.ok(html.includes('>Reprint</button>')));
  const printedDocument = success(flow.completePrint(empty, owner, document, now));
  load(owner, { ...baseline, ...printedDocument });
  html = capture(React.createElement(DocButton, { recordId: document.recordId, recordType: document.recordType, onClick: () => {} }));
  check('Owner document-list button changes to Request Reprint', () => assert.ok(html.includes('>Request Reprint</button>')));

  const baseCommit = 'cbded7456c91dffb784e18527c60faae83964b04';
  const baseFile = file => execFileSync('git', ['show', `${baseCommit}:${file}`], { encoding: 'utf8' });
  const namedSources = source => {
    source = source.replace(/\r/g, '');
    const result = new Map();
    const ast = ts.createSourceFile('source.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const walk = node => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) result.set(node.name.text, node.initializer.getText(ast));
      if (ts.isFunctionDeclaration(node) && node.name) result.set(node.name.text, node.getText(ast));
      ts.forEachChild(node, walk);
    }; walk(ast); return result;
  };
  const originalStore = namedSources(baseFile('src/store.tsx'));
  const updatedStore = namedSources(fs.readFileSync('src/store.tsx', 'utf8'));
  // Follow-up relationship work adds only these reviewed metadata/validation statements.
  // Preserve the exact baseline check for all remaining operational formula/transaction code.
  const withoutRelationshipAdditions = (name, source) => {
    if (name === 'createProductionOrder') return source.replace("        source: 'Manufacturing Order',\n        originGroup: mo.moNo,\n", '');
    if (name === 'createStockReplenishmentPO') return source.replace("        originGroup: `REPLENISH-${now.getFullYear()}-${String(next).padStart(4, '0')}`,\n", '');
    if (name === 'recordOutput') return source.replace('.map(pipe => hydrateFinishedPipe(pipe, s))', '');
    if (name === 'updateFinishedGoodStorage') return source.replace('      const origin = fg ? resolveFinishedPipe(fg, s) : undefined;\n', '').replace("        || (origin?.source === 'Manufacturing Order' && (purpose !== 'Customer Order' || !origin.order || origin.order.id !== order?.id))\n", '');
    return source;
  };
  for (const name of ['login', 'logout', 'navigate', 'clockIn', 'clockOut', 'createCustomerOrder', 'createReceivingReport', 'createTransfer', 'approveMaterialRequest', 'rejectMaterialRequest', 'createProductionOrder', 'createStockReplenishmentPO', 'recordOutput', 'addMaterialRequest', 'loadPellets', 'recordColorantUsage', 'submitTurnover', 'updateFinishedGoodStorage', 'receivePellet', 'confirmTransferReceipt', 'relocatePhysicalItem', 'reserveFinishedGoods', 'rejectFinishedGood', 'releaseFinishedGood', 'completeRecyclingBatch', 'updateRecyclingStage', 'confirmRecyclingForCrushing', 'calculateProductionMaterialPlan', 'calculateMaterialUsage', 'INITIAL_PELLETS', 'INITIAL_FG', 'INITIAL_POS', 'INITIAL_MOS', 'INITIAL_ORDERS', 'INITIAL_RR', 'INITIAL_TRANSFERS', 'INITIAL_MATERIAL_REQUESTS']) {
    check(`Baseline operational formulas preserved: ${name}`, () => { assert.ok(originalStore.has(name), name); assert.equal(withoutRelationshipAdditions(name, updatedStore.get(name)), originalStore.get(name)); });
  }
  check('Product master rules preserved; optional existing PEP/seasonal metadata retained', () => assert.equal(fs.readFileSync('src/productMaster.ts', 'utf8').replace(/\r/g, '').replace(' itemCode: value.itemCode, seasonal: value.seasonal,', ''), baseFile('src/productMaster.ts').replace(/\r/g, '')));
  for (const name of ['makePelletBags', 'makeFinishedPipes', 'registryEntriesForPellets', 'registryEntriesForFinishedGoods']) check(`Permanent barcode generation unchanged: ${name}`, () => { assert.ok(originalStore.has(name), name); assert.equal(updatedStore.get(name), originalStore.get(name)); });
  const originalBarcodes = namedSources(baseFile('src/components/BarcodeLabel.tsx'));
  const updatedBarcodes = namedSources(fs.readFileSync('src/components/BarcodeLabel.tsx', 'utf8'));
  for (const name of ['CODE_128_PATTERNS', 'getCode128Bars', 'barcodeSvgMarkup', 'barcodeValidationError', 'BarcodeSvg']) check(`Barcode encoding/format unchanged: ${name}`, () => assert.equal(updatedBarcodes.get(name), originalBarcodes.get(name)));
  check('Existing official document contents unchanged except stable record ID metadata', () => assert.equal(fs.readFileSync('src/documentPrint.ts', 'utf8').replace(/^  recordId: .*\r?\n/gm, '').replace(/\r/g, ''), baseFile('src/documentPrint.ts').replace(/\r/g, '')));
  check('Sidebar unchanged and no new roles added', () => assert.equal(fs.readFileSync('src/components/Sidebar.tsx', 'utf8').replace(/\r/g, ''), baseFile('src/components/Sidebar.tsx').replace(/\r/g, '')));
  console.log(`Completed ${checks} reprint workflow, authorization, persistence, inventory-safety and regression checks.`);
} finally {
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
  await server.close();
}
