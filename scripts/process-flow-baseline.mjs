import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restoreApprovalScanFile } from './approval-scan-baseline.mjs';

// Historical source guards normalize only these exact reviewed deltas.
// check-process-flow independently executes the CURRENT production callbacks.
export const reviewedProcessFlowDeltas = {
  'src/store.tsx': '6d681309f1bd5c0afceeeaa024f702ba4bb74267b756515bdd53c2b3cb4492da',
  'src/pages/management/Operations.tsx': 'b4c697477154c674280542e3ae7f60fb28bb88a96355785e2cba4f1ed2b90522',
  'src/pages/plantmanager/PelletInventory.tsx': 'c5ce588918114695ad580861d92dbc028c3ef79c8571b38a39f53402d68feb7e',
  'src/pages/plantmanager/Dashboard.tsx': 'eea28d824c77755f962b3d8173d7d6bc54e2692cfa1c7a7c8f2288864e9e767d',
  'src/pages/production/Pellets.tsx': '8a883a9c0ca52698d6e15c54e321f3b01440bdc27f8640a58c2f4fa923cc30dd',
  'src/pages/accounting/Transactions.tsx': 'ea46767df341e6c5361282b6b8aa03332a96ed93d2867b7ae5f023a3bad50fd0',
  'src/pages/accounting/Transfers.tsx': '607f05aac8150c0c9e75d885befe5fe94bbfdab9a0fef46522df962ae294556a',
};
export const reviewedProcessFlowAdditions = {
  'src/operationalInventory.ts': '2a138257b4eabcaf88c53b95efaefcd9c8c4fae2a3b49280eefbd8cfc69bfc21',
};
const previous = new Map();
const hash = source => createHash('sha256').update(source).digest('hex');
export function restoreProcessFlowFile(file, text) {
  const source = restoreApprovalScanFile(file, text);
  if (!reviewedProcessFlowDeltas[file]) return source;
  const marker = file.endsWith('Transfers.tsx') ? 'dispatchTransfer' : file.includes('/plantmanager/') ? "item.inventoryStatus === 'Available' && item.availableKg > 0" : 'operationalInventory';
  if (!source.includes(marker)) return source;
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', 'b40c023:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  if (source === previous.get(file)) return source;
  if (hash(source) !== reviewedProcessFlowDeltas[file]) throw Error('Unreviewed process-flow delta: ' + file);
  if (file !== 'src/store.tsx') return previous.get(file);
  // Retain the earlier, still-uncommitted production-output work beneath this layer.
  const restored = source
    .replace("import { canFinishWip } from './operationalInventory';\n", '')
    .replace('  dispatchTransfer: (transferId: string) => { success: boolean; error?: string };\n', '')
    .replace('  finishWipBag: (pelletId: string) => { success: boolean; error?: string };\n', '')
    .replace(/  const dispatchTransfer = useCallback\([\s\S]*?(?=  const updatePO = useCallback)/, '')
    .replace("      if (pellet && !['Pending Receipt', 'Available'].includes(pellet.inventoryStatus)) return s;\n", '')
    .replace('      if (key && !records.has(key)) records.set(key, record);', '      if (key) records.set(key, record);')
    .replace('    dispatchTransfer, finishWipBag, addMaterialRequest,', '    addMaterialRequest,');
  if (hash(restored) !== 'ee71bde0e18534ed6287e8499b017a8db8076ffc9cac3f0b687cf113b95624f4') throw Error('Process-flow normalization would alter earlier production-output work');
  return restored;
}
