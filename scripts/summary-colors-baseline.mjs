import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restorePelletMasterFile } from './pellet-master-baseline.mjs';

export const SUMMARY_COLORS_BASELINE = '18703f4';
export const reviewedSummaryColorsAdditions = {
  "src/components/InventorySummaryNote.tsx": "23128d64968a16e2e08df18992568abb99e2a529d2c5ec2caf4665c6fb055b79",
  "src/pelletColors.ts": "21f92fe5d9496ec5e16c0e7b8c542223afe491459ab5d5edac175f6883c0cf7d"
};
// Exact reviewed color-metadata / summary-presentation deltas. Current semantics
// are exercised independently by check-summary-colors and browser QA.
export const reviewedSummaryColorsDeltas = {
  "src/components/ProductFilters.tsx": "e3123774cce8c17647d08d6cbe7c3cc09476e728d758fb4b437f20cc025afcd8",
  "src/pages/owner/Records.tsx": "cb611091767ca52e42aea87c84cbf5e9408279a2c75f8667796df0637cf56ec3",
  "src/pages/plantmanager/Reports.tsx": "d79a226303e4075f2b1f3177af718ad1944defd75982c8543500c8a16399a3e4",
  "src/pages/accounting/RawMaterials.tsx": "cc6181a461f3b76177097820b867df9ae2b6a2d2bcdd5ae17034eb9f0f8779f9",
  "src/pages/plantmanager/PelletInventory.tsx": "2815ccfe434702c9487e24e7a970fbd76f28b35e4b2ccba32ec5edca099ab4a7",
  "src/components/MaterialLocationFilters.tsx": "e5e0525148a23a486fc3eb1db7f66609837dc5031e0a1007bb7d91663f39f7f0",
  "src/pages/plantmanager/FinishedGoods.tsx": "b7fc14cbc626e31b46f0a00bb68ab09d735dda5b9aabb252072aef91f37e84e2",
  "src/components/UXFeedback.tsx": "b337af79022177aa7202648ad68ab7d454647a91724c1ad08e30e2c39a252ce6",
  "src/components/FinishedGoodsMetrics.tsx": "0f3006516774e90c496acf0c724fbf67bc1384181d92fc4797c59543b62d54b5",
  "src/pages/production/FinishedPipes.tsx": "4da0359e71fccadd1e2f92e9fc19e8ba85074ede7e59335ccbe3fd1a9b84af00",
  "src/pages/management/Reports.tsx": "6ac34edb727683333c7c1774d6f89ed053ebbc4ebf2c152d310d7c1eb8c810ac",
  "src/store.tsx": "b18e800ddcccc27228d60cc77ab24ce2b4934901c3447354d6f46821d333bc6a",
  "src/index.css": "5fcfc516245aa3f92f8e693aba825ff5539a348bb9ebebd4884571322bbd88b1",
  "src/pages/production/Pellets.tsx": "b883a754d0975e8a71175aa892fd219cfde279315b16ace1d7f8459a8d68f82f",
  "src/components/MetricCards.tsx": "b336d39f088d452ad37a36b0e8b5c2822e1e21bb24a8d0f586646732d1852318",
  "src/pages/plantmanager/MainPlantRequests.tsx": "949648347d502b1b9d41c460e6d5cfaa64feed9b944731a1dd3f1b7280563238",
  "src/pages/marketing/FinishedGoods.tsx": "ec3a97968f844dd711a8e4619623da9276ef1d4bc12bab7ffd507bea0b6d8a59",
  "src/pages/accounting/RRRecords.tsx": "e63428c530c1a50086c1b3c70d8cb34fb497170d1c415afa6eefcd39fdc0ce10"
};
const previous = new Map();
export function summaryColorsBaseline(file) {
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', SUMMARY_COLORS_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
export function restoreSummaryColorsFile(file, text) {
  const normalized = text.replace(/\r/g, '');
  if (reviewedSummaryColorsDeltas[file] && normalized === summaryColorsBaseline(file)) return normalized;
  const source = restorePelletMasterFile(file, normalized);
  if (!reviewedSummaryColorsDeltas[file] || source === summaryColorsBaseline(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewedSummaryColorsDeltas[file]) throw new Error('Unreviewed summary/color delta: ' + file);
  return summaryColorsBaseline(file);
}
