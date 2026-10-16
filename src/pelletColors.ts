import type { PelletInventory, RecyclingBatch } from './types';
import { PRODUCT_COLORS } from './productMaster';

/** Configuration, never inventory-derived. Reuse the established shared HPAI codes. */
export const RECYCLED_PELLET_COLOR_MASTER = PRODUCT_COLORS.map(label => ({
  name: label.replace(/\s+\([^)]*\)$/, ''), code: label.match(/\(([^)]+)\)$/)![1], label,
}));
export const RECYCLED_PELLET_COLORS = RECYCLED_PELLET_COLOR_MASTER.map(color => color.name);
export const PELLET_COLORS = ['White', ...RECYCLED_PELLET_COLORS];
export type MaterialColorContext = 'Virgin' | 'Recycled' | 'All' | 'Colorant';
export const UNKNOWN_PELLET_COLOR = 'Not specified';

export function normalizeRecycledPelletColor(value: string | undefined) {
  const key = value?.trim().toLowerCase();
  return RECYCLED_PELLET_COLOR_MASTER.find(color => color.name.toLowerCase() === key || color.label.toLowerCase() === key)?.name || '';
}

/** Read historical metadata without guessing a replacement for an invalid color. */
export function pelletColor(type: string, color: string | undefined) {
  return type === 'Virgin' ? 'White' : color?.trim() ? color : UNKNOWN_PELLET_COLOR;
}

/** Strict write boundary: only Virgin White or an explicitly configured Recycled color. */
export function newPelletColor(type: string, color: string | undefined) {
  return type === 'Virgin' ? 'White' : type === 'Recycled' ? normalizeRecycledPelletColor(color) : '';
}

export function pelletColorLabel(type: string, color: string | undefined) {
  if (color?.trim().toLowerCase() === 'mixed') return `${color} (legacy)`;
  const value = pelletColor(type, color);
  return type !== 'Virgin' && value !== UNKNOWN_PELLET_COLOR && !normalizeRecycledPelletColor(value) ? `${value} (legacy)` : value;
}

/** Metadata-only, idempotent repair. Saved Recycled colors, including legacy, win. */
export function repairPelletColor<T extends PelletInventory>(record: T): T {
  if (record.color?.trim().toLowerCase() === 'mixed') return record;
  const color = pelletColor(record.type, record.color);
  return color === record.color ? record : { ...record, color };
}

/** Linked material paperwork must not contradict the physical pellet color. */
export function pelletDocumentColor<T extends { pelletType: string; color: string; materialCategory?: string }>(record: T): T {
  if (record.materialCategory === 'Colorant' || record.color?.trim().toLowerCase() === 'mixed') return record;
  const color = pelletColor(record.pelletType, record.color);
  return color === record.color ? record : { ...record, color };
}

/** Context only; stock, Location, search and pagination cannot shrink this master. */
export function materialColorOptions(context: MaterialColorContext = 'All'): readonly string[] {
  return context === 'Virgin' ? ['White'] : context === 'All' ? PELLET_COLORS : RECYCLED_PELLET_COLORS;
}

/** Validation only: do not regroup stock or alter the existing bagging arithmetic. */
export function incompatibleRecycledCarry(batches: readonly RecyclingBatch[], batch: RecyclingBatch, color: string, gradeFor: (batch: RecyclingBatch) => string) {
  return batches.some(item => item.id !== batch.id && item.status === 'Completed' && (item.looseKg || 0) > 0
    && gradeFor(item) === gradeFor(batch) && normalizeRecycledPelletColor(item.color) !== color);
}
