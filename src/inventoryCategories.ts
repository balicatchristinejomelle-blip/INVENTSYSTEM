import type { MaterialRequest, Transfer } from './types';
import { MATERIAL_GRADES as SHARED_MATERIAL_GRADES, PRODUCT_COLORS, PRODUCT_TYPES, STRIPE_OPTIONS } from './productMaster';
export { materialGradeFilterLabel } from './productMaster';

export const MATERIAL_CATEGORIES = ['Virgin Pellets', 'Recycled Pellets', 'Colorants'] as const;
export type MaterialCategoryTab = typeof MATERIAL_CATEGORIES[number];

export const MATERIAL_REQUEST_CATEGORIES = ['Virgin Pellet', 'Recycled Pellet', 'Colorant'] as const;
export type MaterialRequestCategory = typeof MATERIAL_REQUEST_CATEGORIES[number];

export const MATERIAL_GRADES = SHARED_MATERIAL_GRADES;
export type MaterialGrade = typeof MATERIAL_GRADES[number];
export const PIPE_PRODUCT_TYPES = PRODUCT_TYPES;
export type PipeProductType = typeof PIPE_PRODUCT_TYPES[number];

export const BASE_COLORANTS = PRODUCT_COLORS;
export const STRIPE_COLORANTS = STRIPE_OPTIONS.filter(value => value !== 'No Stripe').map(value => value.replace(' Stripe', ''));

export function requestCategory(request: MaterialRequest): MaterialRequestCategory {
  return request.materialCategory || (request.pelletType === 'Recycled' ? 'Recycled Pellet' : 'Virgin Pellet');
}

export function transferCategory(transfer: Transfer): MaterialRequestCategory {
  return transfer.materialCategory || (transfer.pelletType === 'Recycled' ? 'Recycled Pellet' : 'Virgin Pellet');
}

export function normalizedProductType(product: string): string {
  return product === 'Commercial HDPE Pipe' ? 'Commercial HDPE Pipe (CGPE)' : product;
}
