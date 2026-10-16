import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { restoreProcessFlowFile } from './process-flow-baseline.mjs';

// Exact presentation-only deltas; no historical guard silently accepts other edits.
export const FILTER_LAYOUT_BASELINE = 'b40c023';
export const reviewedFilterLayoutDeltas = {
  'src/index.css': 'e64296b820b3ed2b9b24832aa68c2ed46cec6636d5d340414fbc2fbdf2b793d2',
  'src/components/ProductFilters.tsx': 'c0ea2c42626995e8aab0bb508b3983e76a6ef79bc768ab6f9f8c75b6dd46d56a',
};
export const reviewedFilterLayoutAdditions = { 'src/sevenFilterLayout.css': '9d6996f8e0a487115e3057a13551b80ca7350031cc7240c613d6e283cca50f50' };
const previous = new Map();
export function restoreFilterLayoutFile(file, text) {
  const source = restoreProcessFlowFile(file, text);
  if (!reviewedFilterLayoutDeltas[file]) return source;
  const marker = file.endsWith('.css') ? "@import './sevenFilterLayout.css';" : 'seven-master-filter-panel';
  if (!source.includes(marker)) return source;
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', FILTER_LAYOUT_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  if (createHash('sha256').update(source).digest('hex') !== reviewedFilterLayoutDeltas[file]) throw Error('Unreviewed filter-layout delta: ' + file);
  return previous.get(file);
}
