import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const receivingLinkDeltas = {
  "src/store.tsx": "830db2aaceed3b02b45995854c6d6823cdccb96d885766175b94c9d4e62303a3",
  "src/pages/plantmanager/PelletInventory.tsx": "9007a226fcc189247fbf8da6d7b0580c23c9023fb6392bd5fb2aedecd6388a03",
  "src/incomingPelletBarcodes.ts": "c52dc2b8dd91e6e220889764fae8f9147adbc0126556d52159483efbad23dea3",
  "src/countedPelletReceiving.ts": "8f51728eafd1b38fc2ee256fbc2e2fc76d788355cdfd41d365d36a25229326f4",
  "src/printableRecords.ts": "5c5493b18fd28fec04b3663583511b68ae385c46e6ef6a1c25cc8183db8ec4bf",
  "src/components/CountedTransferAcceptance.tsx": "a8bd455bd7e88c722bf6bf3dab01cb1092ec24124300e49da5e117933f440a87",
  "src/components/ExpectedPelletReceiving.tsx": "93f704b9b381645cd05e49d6cc70a70a9595686c4f51077a28b2355e736f4844",
  "src/components/RequestPelletBarcodes.tsx": "5d0c00c13bf48e458759112d34b4a6fb62b5fdbf64d026e5935bd9bc5258163d",
  "src/pages/plantmanager/IncomingTransfers.tsx": "d61dbbe8f2f1c75777dd1233fa106c1c6f8d985721af3f582ae9ac63c0c446f9",
  "src/components/PipeStorageSession.tsx": "500f6f507c8e35bdde628bb8b739ee1d6246b44682d705dea94a232dcfa199f4"
};
export const receivingLinkAdditions = { 'src/materialRequestLink.ts': '66d6d411b2f0769443b8f1e2adff358d46b79c431c1c90c71f4fb4f7eebc5260' };
const previous = new Map();
/** Exact reviewed relationship/confirmation deltas only, for historical preservation guards. */
export function restoreReceivingLinkFile(file, text) {
  const source = text.replace(/\r/g, '');
  if (!receivingLinkDeltas[file] || !(source.includes('materialRequestLink') || source.includes('validatedBarcode'))) return source;
  if (createHash('sha256').update(source).digest('hex') !== receivingLinkDeltas[file]) throw Error('Unreviewed incoming-printing delta (receiving link/confirm): ' + file);
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', '6a0a293:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
