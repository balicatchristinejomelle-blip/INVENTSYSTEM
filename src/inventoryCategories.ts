import type { MaterialRequest, Transfer } from './types';

export const MATERIAL_CATEGORIES = ['Virgin Pellets', 'Recycled Pellets', 'Colorants'] as const;
export type MaterialCategoryTab = typeof MATERIAL_CATEGORIES[number];

export const MATERIAL_REQUEST_CATEGORIES = ['Virgin Pellet', 'Recycled Pellet', 'Colorant'] as const;
export type MaterialRequestCategory = typeof MATERIAL_REQUEST_CATEGORIES[number];

export const MATERIAL_GRADES = ['PE80', 'PE100'] as const;
export type MaterialGrade = typeof MATERIAL_GRADES[number];
export const PIPE_PRODUCT_TYPES = ['HDPE Pipe', 'CTS HDPE Pipe', 'Commercial HDPE Pipe', 'Spiral Pipe', 'Polytube'] as const;
export type PipeProductType = typeof PIPE_PRODUCT_TYPES[number];

export const BASE_COLORANTS = ['Black (BK)', 'Blue (BE)', 'Orange (OR)', 'Red Orange (RO)', 'Green (GRN)'] as const;
export const STRIPE_COLORANTS = ['Blue', 'Orange', 'Green', 'Black'] as const;

export function requestCategory(request: MaterialRequest): MaterialRequestCategory {
  return request.materialCategory || (request.pelletType === 'Recycled' ? 'Recycled Pellet' : 'Virgin Pellet');
}

export function transferCategory(transfer: Transfer): MaterialRequestCategory {
  return transfer.materialCategory || (transfer.pelletType === 'Recycled' ? 'Recycled Pellet' : 'Virgin Pellet');
}

export function normalizedProductType(product: string): string {
  return product === 'Commercial HDPE Pipe (CGPE)' ? 'Commercial HDPE Pipe' : product;
}
