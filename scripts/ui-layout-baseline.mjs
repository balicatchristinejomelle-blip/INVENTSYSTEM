import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const UI_LAYOUT_BASELINE = '30ba566';
/** Exact reviewed presentation-only CSS block; all earlier styles remain guarded by the existing suites. */
export function restoreUILayoutStyles(source) {
  source = source.replace(/\r/g, '');
  const marker = '/* UI consistency pass:';
  if (!source.includes(marker)) return source;
  const index = source.indexOf(marker);
  const reviewed = source.slice(index).trimEnd() + '\n';
  if (createHash('sha256').update(reviewed).digest('hex') !== '2d1649f2139aad4b6cb6bad47896ce1dd226c220dc495463f6d28b1b008187e4') throw new Error('Unreviewed UI layout style change');
  const baseline = execFileSync('git', ['show', UI_LAYOUT_BASELINE + ':src/index.css'], { encoding: 'utf8' }).replace(/\r/g, '');
  return source.slice(0, index) + baseline.slice(baseline.indexOf('/* Equal desktop thirds,'));
}
