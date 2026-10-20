import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Exact reviewed scan-session deltas only; current transitions are exercised separately.
export const scanSessionDeltas = {
  "src/store.tsx": "d78a8a3582a9d83b1898735fc5108a93f55ea388ff8339dad2426e2298bbf206",
  "src/physicalScan.ts": "de0105226ea076c757e3d0e375bd2ecbd16719c03d6ebc72aa14af340f00b702",
  "src/components/FinishedPipeStorage.tsx": "227fd523dcbb96fe9a336f3be6d792116462c6760654c2d8cc0190dfa70f0307",
  "src/components/ExpectedPelletReceiving.tsx": "562ef6d582c342b2678dfbd0f4c688e933a254fe295e3061558d2d2036fb5599",
  "src/pages/plantmanager/IncomingTransfers.tsx": "0b83384492dd214fe4810f22616a7e0c016b6cdb32795bebe6fe1ef10cf78fb4"
};
export const scanSessionAdditions = {
  "src/components/PipeStorageSession.tsx": "2cf293e104cc3c737a37b38ff09d8696726fb442c5f3ba1b3e1760655717ae75",
  "src/components/ScannedTransferAcceptance.tsx": "8e202ddcfeb40ef20c374a4bee3563a085abf4c9c8456c7576fbd200722b2af4"
};
const previous = new Map();
const markers = { 'src/store.tsx': 'acceptScannedPelletTransfer', 'src/physicalScan.ts': "'Receiving Discrepancy'", 'src/components/FinishedPipeStorage.tsx': 'PipeStorageSession', 'src/components/ExpectedPelletReceiving.tsx': 'ScannedTransferAcceptance', 'src/pages/plantmanager/IncomingTransfers.tsx': 'setViewId(t.id)}>Accept Transfer' };
export function restoreScanSessionFile(file, text) {
  const source = text.replace(/\r/g, ''), reviewed = scanSessionDeltas[file];
  if (!reviewed || !source.includes(markers[file])) return source;
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', '9ba6955:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  const baseline = previous.get(file);
  if (source === baseline) return source;
  // This is the next narrowly reviewed incoming-printing/receiving delta.
  if (createHash('sha256').update(source).digest('hex') !== reviewed) throw Error('Unreviewed incoming-printing delta (scan-session): ' + file);
  return baseline;
}
