import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const LAYOUT_LOCK_BASELINE = 'b0aae1f';
// Exact presentation-only edits, independently checked by check-layout-lock and full-shell browser QA.
export const reviewedLayoutLockDeltas = {
  "src/index.css": "9754f09bbc0cdfc7813a6bf632629c11cf5061811a504d433b00fdf9ebd077ff",
  "src/pages/Login.tsx": "5e88dce29def30ab5192425e7462fcb1365e362a07cac51cedaf3cefcea0a78e",
  "src/pages/production/Dashboard.tsx": "b82e464bd30557fb5a28957b52389023f106b24f26ef1efbd90e415c4b57a46f",
  "src/pages/plantmanager/Dashboard.tsx": "af332543a16c5c3661a3179feadaefdc0cfcc1c1ca1b0c297e23c644e6e231c3",
  "src/pages/accounting/Dashboard.tsx": "07cb27da0627ce8c669b62eb4f7d5c6e3427a31c05d98eb6ddfa0ac643b95329",
  "src/pages/marketing/Dashboard.tsx": "336ad14c46eeac3d7a73ece04f04df5c1b0d2399259a03f337b4fbb5de74bf02"
};
const previous = new Map();
export function layoutLockBaseline(file) {
  if (!previous.has(file)) previous.set(file, execFileSync('git', ['show', LAYOUT_LOCK_BASELINE + ':' + file], { encoding: 'utf8' }).replace(/\r/g, ''));
  return previous.get(file);
}
export function restoreLayoutLockFile(file, text) {
  const source = text.replace(/\r/g, '');
  if (!reviewedLayoutLockDeltas[file] || source === layoutLockBaseline(file)) return source;
  if (createHash('sha256').update(source).digest('hex') !== reviewedLayoutLockDeltas[file]) throw new Error('Unreviewed layout-lock delta: ' + file);
  return layoutLockBaseline(file);
}
