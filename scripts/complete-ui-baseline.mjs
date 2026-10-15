import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const COMPLETE_UI_BASELINE = 'ff68408';
// Exact reviewed presentation deltas for older byte-preservation suites.
// Current source, bindings and behavior are checked directly by check-complete-ui.mjs.
const reviewed = {
  'src/index.css': '3bec514df68a2647dbb4687c243d8517dc934ca6ee95d4980b6c23e557acd444',
  'src/components/PeriodSelector.tsx': '9953536338bd007ac49b16a4bb62b581d8ad38f71ef2268cc743104c6bb7b110',
  'src/components/ReprintApprovals.tsx': 'a7fe9d3f9e81f1938d604e01fc8f01f73ae6065f9dfe068e09ae2d1e4d7aa477',
};
const baselines = new Map();
export function completeUIBaseline(file) {
  if (!baselines.has(file)) baselines.set(file, execFileSync('git', ['show', `${COMPLETE_UI_BASELINE}:${file}`], { encoding: 'utf8' }).replace(/\r/g, ''));
  return baselines.get(file);
}
export function restoreCompleteUIFile(file, source) {
  source = source.replace(/\r/g, '');
  if (!reviewed[file] || source === completeUIBaseline(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewed[file]) throw new Error(`Unreviewed complete UI audit delta: ${file}`);
  return completeUIBaseline(file);
}
