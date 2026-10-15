import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const UX_BASELINE = '306019b';
export const UX_NEW_FILES = ['src/uiViewState.tsx','src/uiSubmission.ts','src/recordReferences.ts','src/components/ActionButton.tsx','src/components/UXFeedback.tsx','src/components/RecordReference.tsx'];
// Exact reviewed frontend UX deltas only. Current behavior and original business callbacks
// are checked independently in check-ux.mjs; unknown deltas cannot bypass older suites.
export const reviewedUXDeltas = {
  "src/App.tsx": "61b90c980d26610adffeaafdd35861f9dfa720520b611859cecb4a1a24d89f46",
  "src/components/BatchTraceability.tsx": "934305c2d252fbdf3fec3c71a7f80247d86a4f48e3287343f5cf1e2155e48625",
  "src/components/FinishedGoodsMetrics.tsx": "51cdcfc6ca57047734a6227974ad601662c4717ec02dcf66e0801468d86c8bb5",
  "src/components/FinishedPipeDetails.tsx": "ed69b2207b9ff591f6c3f8e936bf9e3ebe74dba880dfe8adf65dab6e567cf36b",
  "src/components/FinishedPipeStorage.tsx": "1c88bf9d5fb30861329bbc8d10cafbcbcbd166d0ae8614baa788f756e7859970",
  "src/components/MaterialLocationFilters.tsx": "60f9db97a6c4d0893ae7ac42d4681154d502b221bfc40b86faca1711f8f216db",
  "src/components/MetricCards.tsx": "63c7205a2aa01471c18c8cd3ee847366584255c46b918ca147dce64c8f7d5b1c",
  "src/components/Modal.tsx": "9fa6bff03a02d68b1de16b1810ad8329db0768141778811a90547b986f4c2b30",
  "src/components/Pagination.tsx": "41bd37e813ba93709aaf129cb76c15fb9eb6e6ce52b3460fa46676f46de065b3",
  "src/components/PeriodSelector.tsx": "d6892eac01079a5b2429c8a7b0aa521e4e3d3fb80c00d7bb4701898405518509",
  "src/components/ProductFilters.tsx": "05b397fdddd188b2d33f42395dac109918c770026f632c520b055f42d8d3f369",
  "src/components/RecordList.tsx": "da9ebcb8d2c07ce3d1e0a1a803f7353a99fed07a025e686301bc64b7971b6300",
  "src/components/RecordRows.tsx": "f80eff68fd111377504be6bd982e9018d861cc0ac395ff292c1ba5b278f70421",
  "src/components/RecordSearch.tsx": "26c193fca866e7d81cb51ed170ecb84cac17f132dd0111d61692b10f679ccb4c",
  "src/components/StatusBadge.tsx": "71efd15458ee1a7dcb6d04e716c50dbe4d78ad1a02e30cf06b038e7c24c9cf0a",
  "src/index.css": "462232fedd22ad651208e9e5cb028db810c0bb931b66857d7758b13e075a9112",
  "src/pages/NotificationsPage.tsx": "22ed2f6b5bc092d3fb30abd185ad87e192f9bda6ee237efcaa6f04f07a7fa74b",
  "src/pages/accounting/BranchRequests.tsx": "63a94183343e88bb583e19f8abd3f5879a27bd67f4785b2f68f93c9ecc2b277d",
  "src/pages/accounting/Dashboard.tsx": "897845979bc7dd9615058352b0790d8f774177304a37dc14212dc67c4dd0d701",
  "src/pages/accounting/RRRecords.tsx": "47706a396115af8f621e09b6157ec90d7bcdfc3d8f323ed9a918757653b680de",
  "src/pages/accounting/RawMaterials.tsx": "469675a3f1943e56adbe5246f38ec0b52313e6882227520a45d5426cb9c854ba",
  "src/pages/accounting/Reports.tsx": "dbea309ae6fcf4b6ee85e61975027be2a01fa67f17a145df1ae29025abe0016b",
  "src/pages/accounting/Transactions.tsx": "80ce0ef52d6114742d98f3a4a8fa01d2d09265ddddc2e27c5d2d8eda384ace48",
  "src/pages/accounting/Transfers.tsx": "15aaa983f98196ba7caa555558d51ce591ce8e094d688f13688c007f2de40ac7",
  "src/pages/management/AuditLogs.tsx": "e281ccbfe420a11b658711adc0188f7f00006b3f200f4869cbde0ef4e10f0c90",
  "src/pages/management/Employees.tsx": "6e3fde3095b7524941c7f1edfb021d2383d90d1003f955b404aa6820d30cf289",
  "src/pages/management/Operations.tsx": "a51aa1a8ca6075d90c6e02b99131274814f2f2bc7e1cefe9cffae2ccb360f2a1",
  "src/pages/management/Reports.tsx": "d164c52c4caa452bfec30dd587bb4f63d0a7a2e112a683180bc4b21b9e7f1e06",
  "src/pages/management/Settings.tsx": "3905957227eccebef399cef5015a2b063e919f0d7c0cda11cdf358c654c7695d",
  "src/pages/marketing/Customers.tsx": "52d0060f8f9b6538d61ba9952bbbad7d3097bfbee0b3637fefa0486345745195",
  "src/pages/marketing/Dashboard.tsx": "9b385bf323a8fe31102752b3f2df01c4d80aacf9abd0e898c0d8580c59e1496d",
  "src/pages/marketing/FinishedGoods.tsx": "6c939d5d3415579f28ca24e3305e673c5b8c640ffebae0189e9467eb67eabba7",
  "src/pages/marketing/MOTracking.tsx": "08c9cb2a7cae26a66d8babfcde759eeacd8508598f9a708008f062090a2553d2",
  "src/pages/marketing/Orders.tsx": "e748b309f187ff6583cf1e3c46e7897c650d09b3817cb9fa912901523bf041ce",
  "src/pages/marketing/Reports.tsx": "ec1f9c0d19bf9809a9fcae7a00b28ee8c2ab36638ea974bb1e1eb3d8135cf3f6",
  "src/pages/owner/Records.tsx": "c074b2a2fd8ed02b31febaecc59a4628ec3d10956c5e657ad593d9d3841c975d",
  "src/pages/owner/UsersAccess.tsx": "cbc5fbdcfd82de23989c6c066a42e1ee57142a37f9650293156188fc242582de",
  "src/pages/plantmanager/Attendance.tsx": "0aa269adc17e95b0ebdb0bc75b42d6bf0af6b2b58ea3e243b45ca42bf940588c",
  "src/pages/plantmanager/FinishedGoods.tsx": "265126f920244a5d57041d7f44b2889502f32ae197067b3799316bec1b757935",
  "src/pages/plantmanager/IncomingTransfers.tsx": "0ae2ee71ee191804c3808b626749f6663370a2b41e387f4df84a11122817d479",
  "src/pages/plantmanager/MainPlantRequests.tsx": "dab41797efa84cbdcb3631d4950906a0bd0d6914ab399130d27c03818ffad807",
  "src/pages/plantmanager/MaterialUsage.tsx": "d96d5fbdeea16f168985c357cdd3f5429cd3fb20f8c55dccf6658f056d5b7fbe",
  "src/pages/plantmanager/PelletInventory.tsx": "31f918badd4f8b76fcbdda7436c47e22772044e9f2707aa18fcd29ed7114ab8c",
  "src/pages/plantmanager/ProductionOrders.tsx": "8cc360eb1c4c3e3d2ae04b93ad7618e3fd7dbde62dd4d6be760e81d8d51ab9ed",
  "src/pages/plantmanager/RejectedRecycling.tsx": "9006195893afb7e5e84da58b3d9f189de4b39ff2639751fa29ca2b6756d1e5e9",
  "src/pages/plantmanager/Reports.tsx": "c358e39022236ac9be0e3756331ed859fb4e0c1412bc2e502dd450b339214c08",
  "src/pages/plantmanager/ShiftTurnover.tsx": "ef01b83a256a5e3c2769476e2d73df246918d49b65f7c7ffcde2276220d1e0d3",
  "src/pages/production/BarcodeScanner.tsx": "ec4fc176dd6e08b1927665fe65964a1f67f91742bb0bfadabba970ce050a764b",
  "src/pages/production/ClockOut.tsx": "694cb4126310f3dad9e0bed21f71cd7624c8e6f54e5d3e60ad0698c81cd9d250",
  "src/pages/production/Dashboard.tsx": "77555624c945eda0558411450dc803e2c8a448eeb953ca4e651c564658043266",
  "src/pages/production/FinishedPipes.tsx": "6b934afc47e4baf7295bffecfc4c0d9f9cd2a3ca814abdbefd64affbf50fdb9a",
  "src/pages/production/History.tsx": "26b91baf0e03acc5d0d6814b770cb4bce40d7dafb1d3e6c5bb181b6597aee03a",
  "src/pages/production/Pellets.tsx": "af427d9c06ea3da9b82937fc10ede9061a5b738c95f5d08aad0db3d22e670e6f",
  "src/pages/production/ProductionOrders.tsx": "3efc2959dbb56d93a8d7bff35b230ba4d7351a0d0eb17acf5417787c77474eb6",
  "src/pages/production/Recycling.tsx": "65967af22de13f76e9f64c0813dff7e5a43dd6efa2c93c272b7922185099e3e1",
  "src/pages/production/ShiftAttendance.tsx": "b9daa4f16009b32b0d6fff306e561c74ed790531630003add84de3f246d0e6d3",
  "src/pages/production/ShiftTurnover.tsx": "c05c37332285aaf235ed742979ebe04be83d64123c3426badba864674d363062"
};
const baseline = new Map();
export function uxBaseline(file) {
  if (!baseline.has(file)) baseline.set(file, execFileSync('git', ['show', UX_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return baseline.get(file);
}
export function restoreUXFile(file, text) {
  const source = text.replace(/\r/g, '');
  if (!reviewedUXDeltas[file] || source === uxBaseline(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewedUXDeltas[file]) throw new Error('Unreviewed frontend UX delta: ' + file);
  return uxBaseline(file);
}
