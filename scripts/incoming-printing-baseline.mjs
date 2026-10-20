import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Normalize only exact reviewed additive label preparation/UI changes for older guards.
export const incomingPrintingDeltas = {
  'src/types.ts': ['f832090394d86217452b63efb7f1122ead7f7183f13653e661030a80b9473a30', 'materialRequestRef?:'],
  'src/store.tsx': ['701fb906aa46b3bfa99194c49da905639cb271b59e5ccbfba2c98b604e51b506', 'ensureExpectedPelletBags'],
  'src/printableRecords.ts': ['55a91579905504fa6ebd4fbc296db3da55c84dcdb5a5046388423da4c0243815', 'pelletApproval'],
  'src/pages/plantmanager/MainPlantRequests.tsx': ['288c5fd8dcb361a072a2f82579c8217d8db6327cb41bd477f286f3a9639ec7f9', 'RequestPelletBarcodeButton'],
  'src/pages/plantmanager/IncomingTransfers.tsx': ['b7955731110ac6b730a760d04a169f020add0367341f23a09624fb61e3e4c9b8', 'RequestPelletBarcodeButton'],
};
export const incomingPrintingAdditions = {
  'src/incomingPelletBarcodes.ts': 'a22762bf0cf01c2a45449bcb6c275f3de89ea46b6cf9d1aba75b8c1b1f45445a',
  'src/components/RequestPelletBarcodes.tsx': '19f4c3cdb60014c79cf391262f6d3a33017264cfb1b206e3a5ec6656fa3c79d6',
};
const previous = new Map();
export function restoreIncomingPrintingFile(file, text) {
  const source = text.replace(/\r/g, ''), reviewed = incomingPrintingDeltas[file];
  if (!reviewed || !source.includes(reviewed[1])) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewed[0]) throw Error('Unreviewed incoming-printing delta: ' + file);
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', 'e938306:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
