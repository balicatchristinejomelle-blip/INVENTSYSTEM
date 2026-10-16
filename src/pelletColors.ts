import type { PelletInventory } from './types';

export const PELLET_COLORS = ['White', 'Black', 'Blue', 'Green', 'Orange', 'Red Orange', 'Mixed'] as const;
export const UNKNOWN_PELLET_COLOR = 'Not specified';

/** Pellet body color is independent of the finished pipe/colorant specification. */
export function pelletColor(type: string, color: string | undefined) {
  return type === 'Virgin' ? 'White' : color?.trim() || UNKNOWN_PELLET_COLOR;
}

/** Metadata-only, idempotent repair. Never invent a color for non-demo recycled stock. */
export function repairPelletColor<T extends PelletInventory>(record: T): T {
  const demo = record.type === 'Recycled' && record.batchNo === 'TEST'
    && record.recyclingBatchRef === 'TEST-SEED-RECYCLED';
  const serial = Number(record.bagNo.match(/\d+$/)?.[0] || 1);
  const color = pelletColor(record.type, record.color?.trim() || (demo ? ['Black', 'Blue', 'Green'][(serial - 1) % 3] : ''));
  return color === record.color ? record : { ...record, color };
}

/** Linked material paperwork must not contradict the physical pellet color. */
export function pelletDocumentColor<T extends { pelletType: string; color: string; materialCategory?: string }>(record: T): T {
  if (record.materialCategory === 'Colorant') return record;
  const color = pelletColor(record.pelletType, record.color);
  return color === record.color ? record : { ...record, color };
}

/** Retain master choices at zero stock and include custom recorded recycled colors. */
export function materialColorOptions(records: readonly unknown[] = []) {
  return [...new Set([...PELLET_COLORS, ...records.flatMap(record => {
    const color = (record as { color?: unknown } | null)?.color;
    return typeof color === 'string' && color.trim() ? [color.trim().replace(/\s+\([^)]*\)$/, '')] : [];
  })])];
}
