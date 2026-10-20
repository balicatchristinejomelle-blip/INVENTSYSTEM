import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restoreActivePmFile } from './pm-active-flow-baseline.mjs';
export const countedReceivingDeltas = {
  "src/store.tsx": "2a80119d30f6cbe68457c51068fab9780513ba10dbf4c1b391a31e27c3df4cdd",
  "src/components/ExpectedPelletReceiving.tsx": "ecb35fd095ec2a9bc518fd9d9616841e33fcc658e79f72701edecf028baea77c",
  "src/components/RequestPelletBarcodes.tsx": "2ec7166c8e97e7487a2880bc9329ab416fe267611be91de6b7525b307b67d430",
  "src/printableRecords.ts": "ab196129b09bac6b885d9b6e35cb0efc2bc1c84b4028eebf99d46f9f27385d32",
  "src/pages/production/BarcodeScanner.tsx": "72320af72296d299efd523c88a7fe8c9107a6f1dd29232a3a6f9e642c7b239c5"
};
export const countedReceivingAdditions = {
  "src/countedPelletReceiving.ts": "d977d9e363797469075ebfb8f989e921a4e97182e672da9bb1f236b5cb4ec82e",
  "src/components/CountedTransferAcceptance.tsx": "27cf5b54c610606b8f8996eb0cbd82ab0a0735a56727332bc7b6593e36e98459"
};
const markers = {"src/store.tsx":"acceptCountedPelletTransfer","src/components/ExpectedPelletReceiving.tsx":"CountedTransferAcceptance","src/components/RequestPelletBarcodes.tsx":"Only accepted received bags","src/printableRecords.ts":"Accept the counted received quantity","src/pages/production/BarcodeScanner.tsx":"Store Recycled Output"}, previous = new Map();
/** Historical guards normalize only this exact reviewed role-flow correction. */
export function restoreCountedReceivingFile(file, text) {
  const source = restoreActivePmFile(file, text), reviewed = countedReceivingDeltas[file];
  if (!reviewed || !source.includes(markers[file])) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewed) throw Error('Unreviewed incoming-printing delta (counted receiving): ' + file);
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', '90f0114:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
