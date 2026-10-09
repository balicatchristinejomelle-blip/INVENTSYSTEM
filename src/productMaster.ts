export const HPAI_PRODUCT_MASTER = {
  products: ['HDPE Pipe', 'CTS HDPE Pipe', 'Commercial HDPE Pipe', 'Spiral Pipe', 'Polytube'],
  standardDiameters: ['13mm', '20mm', '25mm', '32mm', '40mm', '50mm', '63mm', '75mm', '90mm', '110mm', '160mm', '225mm', '280mm', '315mm', '355mm', '400mm', '450mm', '500mm'],
  ctsSizes: ['1/2"', '3/4"', '1"'],
  spiralPipeSizes: ['12"', '16"'],
  straightLengths: ['5m', '5.5m', '5.86m', '6m', '8.873m', '10m'],
  coilLengths: ['25m', '30m', '50m', '60m', '90m', '100m', '150m', '200m', '250m', '300m', '350m'],
  sdrRatings: ['SDR9', 'SDR11', 'SDR13.5', 'SDR13.6', 'SDR17', 'SDR21', 'SDR24', 'SDR26', 'SDR33'],
  materialGrades: ['PE80', 'PE100'],
  pipeColors: ['Black (BK)', 'Blue (BE)', 'Orange (OR)', 'Red Orange (RO)', 'Green (GRN)'],
  stripeColors: ['No Stripe', 'Blue Stripe', 'Orange Stripe', 'Green Stripe', 'Black Stripe'],
  constructions: ['Solid Wall Pipe', 'CTS Pipe', 'Commercial Pipe', 'Spiral Tube', 'Polytube'],
  productForms: ['Straight Length', 'Coil'],
  manufacturer: 'Hydro Phil Asia Inc. (HPAI)',
  vendor: 'Hydro Phil Asia Inc.',
  inventoryClasses: ['Raw Materials', 'Work in Progress (WIP)', 'Finished Goods'],
  stockTypes: ['Manufactured', 'Purchased'],
  statuses: ['Active', 'Inactive', 'Discontinued'],
  barcodeTypes: ['Individual', 'Coil Bundle', 'Finished Goods Bundle', 'Product Batch'],
} as const;

export const sizesForProduct = (product: string): readonly string[] => {
  if (product === 'CTS HDPE Pipe') return HPAI_PRODUCT_MASTER.ctsSizes;
  if (product === 'Spiral Pipe') return HPAI_PRODUCT_MASTER.spiralPipeSizes;
  return HPAI_PRODUCT_MASTER.standardDiameters;
};

export const lengthsForForm = (productForm: string): readonly string[] =>
  productForm === 'Coil' ? HPAI_PRODUCT_MASTER.coilLengths : HPAI_PRODUCT_MASTER.straightLengths;

export const colorCodeFromProductColor = (color: string) =>
  color.match(/\((BK|BE|OR|RO|GRN)\)/i)?.[1]?.toUpperCase() || '';

export const colorCodeFromStripe = (stripe: string) => {
  const colorName = stripe.replace(/\s+Stripe$/i, '').trim();
  return ({
    Black: 'BK',
    Blue: 'BE',
    Orange: 'OR',
    'Red Orange': 'RO',
    Green: 'GRN',
  } as Record<string, string>)[colorName] || '';
};
