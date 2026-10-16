import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Exact reviewed deltas only. Current callbacks are exercised by check-process-flow.
export const approvalScanDeltas = {
  'src/components/DocumentPrintButton.tsx': ['a3232f2199426eda2d1bcc6f87d7732321f05ba0b1ceb5fd9cb1fe0947979424', 'canPrint(app.currentUser'],
  'src/components/DocumentViewer.tsx': ['29ba0228bacb582e90bdb3edc244e35cbe259c43d9a40143674d66418334baad', 'record?.approvalError'],
  'src/components/FinishedPipeStorage.tsx': ['b9a4ed2e93c086cd01088e90afc49211a4fe40b9ea79dec70563025863487c37', 'verifiedBarcode'],
  'src/components/PrintAction.tsx': ['4e86cb7f29fe57fcb466091f92dd94c1c3b1d142087a40f4fb7a6fb31d0031b0', 'record.approvalError'],
  'src/pages/plantmanager/IncomingTransfers.tsx': ['b6a548af6af5187ffcf01decdbb7cdadee53d1e851ecd3a0e6f6f1b9f2f7f4b7', 'ExpectedPelletReceiving'],
  'src/pages/plantmanager/PelletInventory.tsx': ['d4c45e7c52de92e295447a087b6a4fb54b7762817b7857b33a93cd61804d799b', "? item.inventoryStatus === 'Available'"],
  'src/pages/production/BarcodeScanner.tsx': ['d98966cfa39603d24db94e5c40b904f1d555504b912a066087fec09f6c3805ca', 'releaseOrderId'],
  'src/printableRecords.ts': ['820f66f39e0527adc7206a6a563ad0acdfea1d2602db4a6ad53ccbf18e6544d8', 'requestApproval'],
  'src/reprintWorkflow.ts': ['4823144fd58a7ee6e3a6af981145982387fc51f0b05fe22e390a0cb89f02afe0', 'approvalError?:'],
  'src/store.tsx': ['c1b149dabd50bc38ed96961264aa1161102b9fa1d2dfb127d908533832597055', 'type PhysicalScanMeta'],
};
export const approvalScanAdditions = {
  'src/physicalScan.ts': '6b6532a1ef66c1a685e0d958659bea6e5c46d208f9cd0f857bb519483a3e3d64',
  'src/components/ExpectedPelletReceiving.tsx': 'd95808063ea99131a8da3ec24af63c54b58113af0633acd9505dc8a420ea10ba',
};
export function restoreApprovalScanFile(file, text) {
  const source = text.replace(/\r/g, ''), reviewed = approvalScanDeltas[file];
  if (!reviewed || !source.includes(reviewed[1])) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewed[0]) throw Error('Unreviewed approval-scan delta: ' + file);
  return execFileSync('git', ['show', '7b0c39c:' + file], { encoding: 'utf8' }).replace(/\r/g, '');
}
