import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restoreLayoutLockFile } from './layout-lock-baseline.mjs';

export const RECOVERY_BASELINE = '9f6d47b';
// Exact recovery deltas, independently exercised by check-recovery and browser QA.
export const reviewedRecoveryDeltas = {
  "src/locationMaster.ts": "76e0fc3320e1a748915372b081c736ecd3e9b6f0112b6929fe267b4ab9451ab1",
  "src/pages/plantmanager/FinishedGoods.tsx": "17bf5a6144266b3522ef5d0097b57353297daf700cf9421e65e296fc345f9ac6",
  "src/store.tsx": "b0da8efdd92f0e314718d2758d209b9aa63ab3de9d4cb9da3e47e3f800db4154",
  "src/pages/production/FinishedPipes.tsx": "8b20bd4276648133995ff8f633edf4e016c6144ab75b9e82b0612a34722c53bf",
  "src/components/InventoryFacetFields.tsx": "631cb164c4346925d4a7a6b2476e793c09ab7d05518c08bb8fdcfcb5b71a2977",
  "src/App.tsx": "df9defd39a4a343608efd8ee21b5de85e6e42bbd0fca9e81c6bb844cebe044a8",
  "src/components/MaterialLocationFilters.tsx": "d5648b3fda0eb51431cd8d5a77393810850a87114614e2a545d3c0ab5f12e8b4",
  "src/pages/owner/Records.tsx": "0e9e2b544fcd919775a77d690481aae3b9249f43abac3dd510421ecd282e4888",
  "src/pages/marketing/FinishedGoods.tsx": "729f55690da27c35a1b97ab86e40d4f617ea6ce2d892e9adeedea5258f5222e7",
  "src/pages/plantmanager/Reports.tsx": "abc1cfd1ebd66dbc7af5e492c954b2950181365837cd463f6457206c17951727",
  "src/components/PeriodSelector.tsx": "48a0f0bd35ae82ba18770c164d4eac6632247982a0efab71ee6bc82b414f85ed",
  "src/smartInventory.css": "6d872e663d5615bb57c9063bf31e330417fcb1785066444fe6b7c05ff75a67f4",
  "src/inventoryFacets.ts": "397d3be32a22f36fe798089467ead46f0ab701ccce831270ea43b3ab47c52a70",
  "src/components/ProductFilters.tsx": "e89fa11cff4c9d58e4e38063b9b45586bb77ea396dfd3ba6b303cde7e0a3a15e"
};
const previous = new Map();
export function recoveryBaseline(file) {
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', RECOVERY_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
export function restoreRecoveryFile(file, text) {
  const normalized = text.replace(/\r/g, '');
  if (reviewedRecoveryDeltas[file] && normalized === recoveryBaseline(file)) return normalized;
  const source = restoreLayoutLockFile(file, normalized);
  if (!reviewedRecoveryDeltas[file] || source === recoveryBaseline(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewedRecoveryDeltas[file]) throw new Error('Unreviewed recovery delta: ' + file);
  return recoveryBaseline(file);
}
