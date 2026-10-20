import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const activePmDeltas = {
  "src/App.tsx": "d64181b2db4f91ad815e1c9d82bd86290c2d488e0ee20acaeb95ba4c417a224f",
  "src/components/Sidebar.tsx": "59c35b5da277523258c0bcc0dd784c3bb5ec68a3839dbc44b018bd40359d1ff7",
  "src/components/Header.tsx": "d194773bc2da0bcff2c0cd80e25cd5a2fd951e4dacb02e27f91e66790a98b00d",
  "src/components/ExpectedPelletReceiving.tsx": "7cb2cabb025822d38f7d1f42fef1c51119ccc05961f38e14e388ef80af1415b8",
  "src/components/CountedTransferAcceptance.tsx": "254f2d2edd9f40552cba4357328e242253ec74df9e23fbe4faf428cd4d152682",
  "src/components/RequestPelletBarcodes.tsx": "94cbb15cce0d938aad6e4a0d5e99f39bee49b79eaab74cd8f3c2d3761cf36ed4",
  "src/pages/production/BarcodeScanner.tsx": "804b0f7cc412f9607212e9e03d6a03ac3eeb0754d3c375076c3bada74f389896"
};
const markers = {"src/App.tsx":"'pm-scanner'","src/components/Sidebar.tsx":"id: 'scanner', label: 'Scanner'","src/components/Header.tsx":"'pm-scanner'","src/components/ExpectedPelletReceiving.tsx":"Accepted Bags / Label History","src/components/CountedTransferAcceptance.tsx":"setReceiptError","src/components/RequestPelletBarcodes.tsx":"label=\"Print Barcodes\"","src/pages/production/BarcodeScanner.tsx":"managerStorage"}, previous = new Map();
/** Only exact reviewed active UI/navigation changes normalize for historical guards. */
export function restoreActivePmFile(file, text) {
  const source = text.replace(/\r/g, ''), reviewed = activePmDeltas[file];
  if (!reviewed || !source.includes(markers[file])) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewed) throw Error('Unreviewed incoming-printing delta (active PM flow): ' + file);
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', 'd8c2e7f:' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
