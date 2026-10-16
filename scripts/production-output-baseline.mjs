import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restoreFilterLayoutFile } from './filter-layout-baseline.mjs';

// Historical guards accept only these exact reviewed production-workflow deltas.
// check-production-output executes the CURRENT callbacks independently.
export const PRODUCTION_OUTPUT_BASELINE = 'b40c023';
export const reviewedProductionOutputAdditions = { 'src/productionOutput.ts': 'dd375023757aaff8020c065b3b9f7750fe33b93311fcf59519feb1e172fcb69c' };
export const reviewedProductionOutputDeltas = {
  'src/store.tsx': 'ee71bde0e18534ed6287e8499b017a8db8076ffc9cac3f0b687cf113b95624f4',
  'src/types.ts': 'f1658f27520019787d5b8ec6abc085742816d259e172db57f2eddbedaec0c71c',
  'src/pages/production/ProductionOrders.tsx': 'dcf8f619856e031d9ad2242271e43a196c485f774aed6418eef350e841588d00',
};
const previous = new Map();
export function restoreProductionOutputFile(file, text) {
  const source = restoreFilterLayoutFile(file, text);
  if (!reviewedProductionOutputDeltas[file]) return source;
  // Other guard layers may already have restored an older historical version.
  const marker = file === 'src/types.ts' ? 'productionOutputEntryId?: string' : 'productionOutputTotals';
  if (!source.includes(marker)) return source;
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', PRODUCTION_OUTPUT_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  if (source === previous.get(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewedProductionOutputDeltas[file]) throw new Error('Unreviewed production-output delta: ' + file);
  return previous.get(file);
}
