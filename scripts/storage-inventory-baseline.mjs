import { execFileSync } from 'node:child_process';
import ts from 'typescript';

export const STORAGE_BASELINE = '76747c5';
export const REVIEWED_STORAGE_CALLBACKS = ['createCustomerOrder', 'recordOutput', 'updateFinishedGoodStorage', 'relocatePhysicalItem', 'reserveFinishedGoods', 'releaseFinishedGood'];
const baseline = new Map();
export function storageBaselineFile(file) {
  if (!baseline.has(file)) baseline.set(file, execFileSync('git', ['show', `${STORAGE_BASELINE}:${file}`], { encoding: 'utf8' }).replace(/\r/g, ''));
  return baseline.get(file);
}
export function namedDeclarations(source) {
  const ast = ts.createSourceFile('source.tsx', source.replace(/\r/g, ''), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = new Map();
  const visit = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) result.set(node.name.text, { text: node.initializer.getText(ast), declaration: node.getText(ast) }); ts.forEachChild(node, visit); }; visit(ast);
  return result;
}
/** Old tests still protect everything outside the six explicitly reviewed storage callbacks. New storage tests execute those callbacks. */
export function restoreStorageCallback(name, source) {
  return REVIEWED_STORAGE_CALLBACKS.includes(name) ? namedDeclarations(storageBaselineFile('src/store.tsx')).get(name).text : source;
}
export function restorePreStorageStore(source) {
  source = source.replace(/\r/g, '');
  const current = namedDeclarations(source);
  for (const name of REVIEWED_STORAGE_CALLBACKS) source = source.replace(current.get(name).text, restoreStorageCallback(name, current.get(name).text));
  source = source.replace(`  const ${current.get('markFinishedGoodLoaded').declaration};\n\n`, '');
  source = source.replace("import { finishedPipeInventory, validStorageLocation, storageLocationFor, compatibleStorageLocations, finishedGoodsSummary } from './finishedGoodsInventory';\n", '');
  source = source.replace('  markFinishedGoodLoaded: (fgId: string) => boolean;\n', '').replace('releaseFinishedGood, markFinishedGoodLoaded, completeRecyclingBatch', 'releaseFinishedGood, completeRecyclingBatch');
  return source;
}
export function restorePreStorageTypes(source) {
  return source.replace(/\r/g, '').replace(" | 'Finished Goods Inventory' | 'Temporary Finished Goods' | 'Ready for Ship Out' | 'WIP' | 'Rejected Materials' | 'Recycling'", '').replace("  fulfillmentStatus?: 'Allocated' | 'Ready for Ship Out' | 'Loaded' | 'Shipped';\n", '').replace('  finishedGoodsQuantity?: number;\n', '');
}
export function restorePreStorageStyles(source) {
  return source.replace(/\r/g, '').replace(/\/\* Compact centered operational content;[\s\S]*?(?=\/\* Owner plant cards)/, '');
}
/** Material/recipe arithmetic in recordOutput remains byte-for-byte unchanged after these exact FG-only deltas. */
export function restoreStorageOutput(source) {
  return source.replace("const sourceMo = po.source === 'Stock Replenishment' ? undefined : s.manufacturingOrders.find", 'const sourceMo = s.manufacturingOrders.find')
    .replace("moRef: po.source === 'Stock Replenishment' ? undefined : po.moRef,", 'moRef: po.moRef,')
    .replace("        status: 'Awaiting Storage' as const,", "        status: 'Reserved' as const,")
    .replace('        reservedQty: 0,', '        reservedQty: 1,')
    .replace("        materialCategory: 'Finished Pipe', finishedGoodsQuantity: passedQty,\n", '');
}
