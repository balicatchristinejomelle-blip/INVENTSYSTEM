import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const PELLET_MASTER_BASELINE = 'a628d7c';
// Exact color-master/legacy-presentation deltas. Independent tests execute the
// current creation, transfer and color-compatible recycling callbacks.
export const reviewedPelletMasterDeltas = {
  "src/pages/plantmanager/RejectedRecycling.tsx": "e13467cd7ee260453e93fe047921556f73cc88dc138b6b52644ec3467022a70c",
  "src/store.tsx": "995d01924ac510cd95bba8b77ba8c2fcbff846667749a31938300ab870ef1c62",
  "src/pages/management/Operations.tsx": "5ad5438448dd3fbf1fc094be37cafaf57a198df283595ae87d5b0de2d1aed4eb",
  "src/smartInventory.css": "fbd19f9eca4e2578a0d10a2b9fe28cf613a1f88ee141a21446e6ee0b57948673",
  "src/components/UniversalSearch.tsx": "c1d2621b9ba6bf4a0ab710f338f43ad0603671a07abb61448bce9facf44a74f3",
  "src/components/InventoryFacetFields.tsx": "eea5982df62692947d5453857d6dcafca049d327565f1af24da2b111d98a9be4",
  "src/index.css": "b0a175ae91cc086f76d61c799b6a0ffa1b63ced0b0f3d8f373487ad85322fde9",
  "src/pages/production/Pellets.tsx": "aad8999ee6f7767e59a82d3a74184daec58a912316d411b8cc61e82779317848",
  "src/pelletColors.ts": "89f15a78604d4b7513c42b8e7cef6b0569535ad8c686fa76c5cb21d6d0ebf9b3",
  "src/pages/owner/Records.tsx": "30d584bd77ba7a16b850f43219652d94b0c1ceebafb17506d16d481b92e6e7e9",
  "src/components/ProductFilters.tsx": "4de24cdf1a4d4b5a6c2840ddb6e7d10e9e325cb07748063fa6307ae7e75c27bc",
  "src/pages/management/Reports.tsx": "fbeb3ca228d00bb00ab7a74251598cd953cd70852b9277ab295a505ddb677172",
  "src/pages/accounting/RRRecords.tsx": "99c66215ab2ba98fb2fce11daf60dfc03563c73ec88502689f0e8c5fb88ff7c1",
  "src/components/SearchableSelect.tsx": "3f859786fcffb566b1e5c30d8c443cea23a602dec19c7e723d01ba7d94c91f7d",
  "src/pages/plantmanager/PelletInventory.tsx": "b97284452570f4c67f571831584d2dd5a6975b381e99872ec09c57d748a18212",
  "src/locationMaster.ts": "bde35aabd17a524f1d7615b1dafaf6c41e30e08259e27999c72c5fb5d38d0ab2",
  "src/pages/plantmanager/MainPlantRequests.tsx": "05e26c3d75faa21227002d9c22190c14cd2b7e31be082330f9796eb95f8a15fa",
  "src/types.ts": "1609ed96a04ade47f6448a9483c0f32803bfa8a623650f8133502e0ec8f4932e",
  "src/pages/production/Recycling.tsx": "221a933bea6fd1d97f35ae50089879a434f5858bdc1eab893ebb0b37525b785f",
  "src/pages/accounting/RawMaterials.tsx": "58ca32d85f65045375b66200a14f7884104108145179aba641063f7121d61e5f",
  "src/components/MaterialLocationFilters.tsx": "dda93d94252ece67b2d4d2fac78f63b097d9d41e07e23714b1066e9069abf090",
  "src/pages/plantmanager/IncomingTransfers.tsx": "f803a4357268ad1c941913467509acfe8ca3d2ab91bb9bd83cb7ed701f84c225",
  "src/productFilters.ts": "710f900d02a7185c3fb2af304d684f298a480b8fe0f5abaaf14a948b767412b6",
  "src/pages/management/Settings.tsx": "5b6acc80c73e50b3d0be4aace3af3328565b7235fa7c64a38074269f61b35b5b",
  "src/documentPrint.ts": "d382b26df99ec2a963ce7db3d3a43358aed3ffcfc27078e5503559f5221b1a92",
  "src/pages/accounting/Transfers.tsx": "10c350a353a1b569e7bf40d2680860dc8ac7eca16549788329c13da420f82926",
  "src/pages/plantmanager/Reports.tsx": "cffbc58d10113660e8193f3688a43b386e0ff0a68b836b8fb5fc2025fffd0d97"
};
export const reviewedPelletMasterAdditions = { 'src/components/PelletColorField.tsx': 'b89ee3a58f2691700073e265b7cfe0e7567d2260e5468a587bea471c5f08e28a' };
const previous = new Map();
export function pelletMasterBaseline(file) {
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', PELLET_MASTER_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
export function restorePelletMasterFile(file, text) {
  const source = text.replace(/\r/g, '');
  if (!reviewedPelletMasterDeltas[file] || source === pelletMasterBaseline(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewedPelletMasterDeltas[file]) throw new Error('Unreviewed pellet-master delta: ' + file);
  return pelletMasterBaseline(file);
}
