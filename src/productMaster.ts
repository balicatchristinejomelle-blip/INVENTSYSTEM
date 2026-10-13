import type { MaterialGrade, ProductSpecification, ProductType } from './types';

export const PRODUCT_TYPES: readonly ProductType[] = ['HDPE Pipe', 'CTS HDPE Pipe', 'Commercial HDPE Pipe (CGPE)', 'Spiral Pipe', 'Polytube'];

export const MATERIAL_GRADES: readonly MaterialGrade[] = ['HDPE Standard', 'PE100', 'Commercial Grade (CGPE)', 'CTS Grade'];

export const STANDARD_DIAMETERS_MM = [13, 20, 25, 32, 40, 50, 63, 75, 90, 110, 160, 225, 280, 315, 355, 400, 450, 500] as const;

export const CTS_SIZES = ['1/2"', '3/4"', '1"'] as const

export const SPIRAL_PIPE_SIZES = ['12"', '16"'] as const

export const STRAIGHT_LENGTHS_M = [5, 5.5, 5.86, 6, 8.873, 10] as const;

export const COIL_LENGTHS_M = [25, 30, 50, 60, 90, 100, 150, 200, 250, 300, 350] as const;

export const SDR_RATINGS = ['SDR9', 'SDR11', 'SDR13.5', 'SDR13.6', 'SDR17', 'SDR21', 'SDR24', 'SDR26', 'SDR33'] as const;

export const PRODUCT_COLORS = ['Black (BK)', 'Blue (BE)', 'Orange (OR)', 'Red Orange (RO)', 'Green (GRN)'] as const;

export const STRIPE_OPTIONS = ['No Stripe', 'Blue Stripe', 'Orange Stripe', 'Green Stripe', 'Black Stripe'] as const;

export const PIPE_CONSTRUCTIONS = ['Solid Wall Pipe', 'CTS Pipe', 'Commercial Pipe', 'Spiral Tube', 'Polytube'] as const;

export const PRODUCT_FORMS = ['Straight Length', 'Coil'] as const;

export const formatDiameter = (value: number) => `${value}mm`;

export const formatLength = (value: number) => `${value}m`

export const STANDARD_DIAMETER_OPTIONS = STANDARD_DIAMETERS_MM.map(formatDiameter);

export const STRAIGHT_LENGTH_OPTIONS = STRAIGHT_LENGTHS_M.map(formatLength);

export const COIL_LENGTH_OPTIONS = COIL_LENGTHS_M.map(formatLength);

export const HPAI_PRODUCT_MASTER = {
  products: PRODUCT_TYPES,
  standardDiameters: STANDARD_DIAMETER_OPTIONS,
  ctsSizes: CTS_SIZES,
  spiralPipeSizes: SPIRAL_PIPE_SIZES,
  straightLengths: STRAIGHT_LENGTH_OPTIONS,
  coilLengths: COIL_LENGTH_OPTIONS,
  sdrRatings: SDR_RATINGS,
  materialGrades: MATERIAL_GRADES,
  pipeColors: PRODUCT_COLORS,
  stripeColors: STRIPE_OPTIONS,
  constructions: PIPE_CONSTRUCTIONS,
  productForms: PRODUCT_FORMS,
  manufacturer: 'Hydro Phil Asia Inc. (HPAI)',
  vendor: 'Hydro Phil Asia Inc.',
  inventoryClasses: ['Raw Materials', 'Work in Progress (WIP)', 'Finished Goods'],
  stockTypes: ['Manufactured', 'Purchased'],
  statuses: ['Active', 'Inactive', 'Discontinued'],
  barcodeTypes: ['Individual', 'Coil Bundle', 'Finished Goods Bundle', 'Product Batch'],
} as const;

export const normalizeProductType = (product: string): ProductType =>
  product === 'Commercial HDPE Pipe' ? 'Commercial HDPE Pipe (CGPE)' : product as ProductType;

export const constructionForProduct = (product: string): ProductSpecification['pipeConstruction'] => {
  const normalized = normalizeProductType(product);
  if (normalized === 'CTS HDPE Pipe') return 'CTS Pipe';
  if (normalized === 'Commercial HDPE Pipe (CGPE)') return 'Commercial Pipe';
  if (normalized === 'Spiral Pipe') return 'Spiral Tube';
  if (normalized === 'Polytube') return 'Polytube';
  return 'Solid Wall Pipe';
};

export const sizeUnitForProduct = (product: string): ProductSpecification['sizeUnit'] => {
  const normalized = normalizeProductType(product);
  return normalized === 'CTS HDPE Pipe' || normalized === 'Spiral Pipe' ? 'in' : normalized === 'Polytube' ? 'configured' : 'mm';
};

export const normalizeProductSpecification = (raw: unknown): ProductSpecification | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ProductSpecification> & { length?: string; construction?: string; status?: string };
  if (!value.id || !value.productType || !value.size || !value.sdr || !value.productForm || !value.color || !value.stripe) return null;
  const productType = normalizeProductType(value.productType);
  const pipeConstruction = constructionForProduct(productType);
  const length = value.productForm === 'Coil' ? value.coilLength || value.length : value.straightLength || value.length;
  return {
    id: value.id, productType, materialGrade: value.materialGrade && [...MATERIAL_GRADES, 'PE80'].includes(value.materialGrade) ? value.materialGrade : 'PE100', size: value.size,
    sizeUnit: value.sizeUnit || sizeUnitForProduct(productType),
    sdr: value.sdr, productForm: value.productForm,
    straightLength: value.productForm === 'Straight Length' ? length : undefined,
    coilLength: value.productForm === 'Coil' ? length : undefined,
    color: value.color, stripe: value.stripe,
    pipeConstruction: (value.pipeConstruction || value.construction || pipeConstruction) as ProductSpecification['pipeConstruction'],
    unitWeightKg: value.unitWeightKg, active: value.active ?? value.status !== 'Inactive',
  };
};

const numericSize = (value: string) => Number.parseFloat(value.replace(/[^\d.]/g, '')) || 0;

export const sortSizes = (values: readonly string[]) =>
  [...new Set(values)].sort((a, b) => {
    const numeric = (size: string) => {
      const fraction = size.match(/(\d+)\s*\/\s*(\d+)/)
      return fraction
        ? Number(fraction[1]) / Number(fraction[2])
        : numericSize(size)
    }

    return numeric(a) - numeric(b)
  })

export const sizesForProduct = (product: string, configuredPolytubeSizes: readonly string[] = []): readonly string[] => {
  const normalized = normalizeProductType(product);
  if (normalized === 'CTS HDPE Pipe') return CTS_SIZES;
  if (normalized === 'Spiral Pipe') return SPIRAL_PIPE_SIZES;
  if (normalized === 'Polytube') return [...new Set(configuredPolytubeSizes)].sort((a, b) => numericSize(a) - numericSize(b));
  return STANDARD_DIAMETER_OPTIONS;
};

export const lengthsForForm = (productForm: string): readonly string[] =>
  productForm === 'Coil' ? COIL_LENGTH_OPTIONS : productForm === 'Straight Length' ? STRAIGHT_LENGTH_OPTIONS : [];

export const sizeLabelForProduct = (product: string) => normalizeProductType(product) === 'HDPE Pipe' || normalizeProductType(product) === 'Commercial HDPE Pipe (CGPE)' ? 'Size / Diameter' : 'Size';

export const specificationLength = (specification: ProductSpecification) =>
  specification.productForm === 'Coil' ? specification.coilLength || '' : specification.straightLength || '';

export const specificationKey = (source: Pick<ProductSpecification, 'productType' | 'materialGrade' | 'size' | 'sdr' | 'productForm' | 'color' | 'stripe'> & { straightLength?: string; coilLength?: string }) =>
  [normalizeProductType(source.productType), source.materialGrade, source.size, source.sdr, source.productForm, source.productForm === 'Coil' ? source.coilLength : source.straightLength, source.color, source.stripe].join('|');

export const specificationKeyFromRecord = (source: { product: string; grade: string; diameter: string; sdr: string; productForm: string; length: string; color: string; stripe: string }) =>
  [normalizeProductType(source.product), source.grade, source.diameter, source.sdr, source.productForm, source.length, source.color, source.stripe].join('|');

export const colorCodeFromProductColor = (color: string) => color.match(/\((BK|BE|OR|RO|GRN)\)/i)?.[1]?.toUpperCase() || '';

export const colorCodeFromStripe = (stripe: string) => {
  const colorName = stripe.replace(/\s+Stripe$/i, '').trim();
  return ({ Black: 'BK', Blue: 'BE', Orange: 'OR', 'Red Orange': 'RO', Green: 'GRN' } as Record<string, string>)[colorName] || '';
};
