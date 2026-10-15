import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restoreRecoveryFile } from './recovery-baseline.mjs';
export const SMART_INVENTORY_BASELINE = '4f251f6';
export const SMART_INVENTORY_NEW_FILES = ['src/inventoryFacets.ts', 'src/components/InventoryFacetFields.tsx', 'src/smartInventory.css'];
// Pinned presentation/filter deltas only. check-smart-inventory independently checks
// current facet behavior, calendar navigation, table mappings, creation selectors and business actions.
export const reviewedSmartInventoryDeltas = {
  "src/components/DateSearchContext.tsx": "f77f0a44815017b31b64229bea418e58627343060751d15e7ad4b88b35b178c9",
  "src/components/LocationStockBreakdown.tsx": "41c9046ecfee3b8baff327957b61aa5120dd2376502977efbe3202b8774c10fd",
  "src/components/MaterialLocationFilters.tsx": "199daa2c022d734081c0e49ae73505f23f92fb0837568ecf2471d6179b29e9de",
  "src/components/PeriodSelector.tsx": "af7166325172fc3869ac86ad396efba5f695e65fef891b36d18b49dcaeaa1ac5",
  "src/components/ProductFilters.tsx": "f28f64e3a91c9151c2e4a0dae8f884dbf20eb5b7e8349a2cc758377cee48b9c2",
  "src/components/RecordSearch.tsx": "683eef4a8c2cb3e9f2b1974211cd0496663ef774078aecffaca2170d3ebf5833",
  "src/components/UXFeedback.tsx": "0448e8a47030a25055e38d34aa0cc1e3b7a258ff74b613f37fc3e8cd3798b7ba",
  "src/datePeriods.ts": "c6791b280b51f9fecfa35ad6f828dfd611e73a86ed285b6dadd5e04527a8c6c1",
  "src/index.css": "9e3fe5047a88c8423bd0d6aae451de4dfee433e83c6d327b2d87b6bd716cf60e",
  "src/pages/accounting/RawMaterials.tsx": "626885e2bb95f9ff27ab4925b2c1769720dcc8c9aef79ac950108341b6fab0c7",
  "src/pages/management/Operations.tsx": "579312f532661578f61bbd3c5c3f3d9a60632c962e5a25e35b6ff8a9b2fbf3d5",
  "src/pages/marketing/FinishedGoods.tsx": "151568ea124ef11333dda3fe7186e5c317cc47d9a155cc28c79240c2cb9ba9fc",
  "src/pages/marketing/Orders.tsx": "8d775ff6724001ccf9789ff4a7c41bfc6c3b58b2c92fd74eacfaa02240af3526",
  "src/pages/owner/Records.tsx": "74fa853c1975a80a8d12f4ff3757efe07414ff0151ba0d3349b3a41a6ba88ea9",
  "src/pages/plantmanager/FinishedGoods.tsx": "b26888038cd6afee08276cee104d75a757b963d7b2a31c46e31245b0f6b5230d",
  "src/pages/plantmanager/PelletInventory.tsx": "2f978260940fe3e0bbecd1268321fc8762197e2c817b67a10b3d214a5ad3ae9b",
  "src/pages/plantmanager/ProductionOrders.tsx": "5a20469c3cc765bb51a337f601dca3f3cf1be9f09cf6caadb5b3de712af11524",
  "src/pages/plantmanager/Reports.tsx": "092fc344520e37e4922269c5ec39f4042a8cd6cb3fd90419f67f168233efce21",
  "src/pages/production/FinishedPipes.tsx": "8742b347d12f48d976f615c82665cf3154108182f9a10f6081fdee2be1fcdfb5",
  "src/pages/production/History.tsx": "8d423ad9156e6d803f05e8866e408d5d3b2b27daf6088fc5644ed94067ba686d",
  "src/pages/production/Pellets.tsx": "8e8fe712fe6ffd54352f42a8f14b9da5d8d57a0bc239bc3da2ec35232968a2fd",
  "src/pages/production/ProductionOrders.tsx": "1d2b7d413d9dbf1939be69b8a27de9a42268cf3cce539626ca0382f4f916563b"
};
const baseline = new Map();
export function smartInventoryBaseline(file) {
  if (!baseline.has(file)) baseline.set(file, execFileSync('git', ['show', SMART_INVENTORY_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return baseline.get(file);
}
export function restoreSmartInventoryFile(file, text) {
  const normalized = text.replace(/\r/g, '');
  if (reviewedSmartInventoryDeltas[file] && normalized === smartInventoryBaseline(file)) return normalized;
  const source = restoreRecoveryFile(file, normalized);
  if (!reviewedSmartInventoryDeltas[file] || source === smartInventoryBaseline(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewedSmartInventoryDeltas[file]) throw new Error('Unreviewed smart-inventory delta: ' + file);
  return smartInventoryBaseline(file);
}
