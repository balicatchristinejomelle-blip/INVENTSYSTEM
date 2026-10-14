// Exact, reviewed grade-only deltas; all other baseline code remains compared.
export function restorePreviousGradeMaster(source) {
  return source.replace(/\r/g, '')
    .replace("import type { LegacyMaterialGrade, MaterialGrade, ProductMaterialGrade, ProductSpecification, ProductType } from './types';", "import type { MaterialGrade, ProductSpecification, ProductType } from './types';")
    .replace("export const MATERIAL_GRADES: readonly MaterialGrade[] = ['PE80', 'PE100'];", "export const MATERIAL_GRADES: readonly MaterialGrade[] = ['HDPE Standard', 'PE100', 'Commercial Grade (CGPE)', 'CTS Grade'];")
    .replace("\n// Historical labels remain readable; they are never active selector options.\nexport const LEGACY_MATERIAL_GRADES: readonly LegacyMaterialGrade[] = ['HDPE Standard', 'Commercial Grade (CGPE)', 'CTS Grade'];\nexport const READABLE_MATERIAL_GRADES: readonly ProductMaterialGrade[] = [...MATERIAL_GRADES, ...LEGACY_MATERIAL_GRADES];\nexport const isActiveMaterialGrade = (grade: string): grade is MaterialGrade => MATERIAL_GRADES.includes(grade as MaterialGrade);\nexport const materialGradeFilterLabel = (grade: string) => grade === 'All' ? 'All Material Grades' : grade;\n", '')
    .replace('READABLE_MATERIAL_GRADES.includes(value.materialGrade)', "[...MATERIAL_GRADES, 'PE80'].includes(value.materialGrade)");
}
export function restorePreviousGradeTypes(source) {
  return source.replace(/\r/g, '').replace("export type MaterialGrade = 'PE80' | 'PE100';\nexport type LegacyMaterialGrade = 'HDPE Standard' | 'Commercial Grade (CGPE)' | 'CTS Grade';\nexport type ProductMaterialGrade = MaterialGrade | LegacyMaterialGrade;", "export type MaterialGrade = 'HDPE Standard' | 'PE100' | 'Commercial Grade (CGPE)' | 'CTS Grade';\nexport type ProductMaterialGrade = MaterialGrade | 'PE80';");
}
export function restoreGradeCreationGuard(name, source) {
  if (name === 'createCustomerOrder') return source.replace('isActiveMaterialGrade(grade)', 'isSupportedMaterialGrade(grade)');
  if (name === 'createReceivingReport') return source.replace('isActiveMaterialGrade(normalizeMaterialGrade(data.grade))', 'isSupportedMaterialGrade(data.grade)');
  if (name === 'addMaterialRequest') return source.replace('isActiveMaterialGrade(normalizeMaterialGrade(req.grade))', 'isSupportedMaterialGrade(req.grade)');
  if (name === 'createStockReplenishmentPO') return source.replace("      if (!isActiveMaterialGrade(input.specification.materialGrade)) {\n        result = { success: false, error: 'Select PE80 or PE100 for new Stock Replenishment production.' };\n        return s;\n      }\n", '');
  return source;
}
export function restorePreviousGradeStore(source) {
  source = source.replace(/\r/g, '')
    .replace('specificationLength, READABLE_MATERIAL_GRADES, isActiveMaterialGrade, MATERIAL_GRADES', 'specificationLength')
    .replace('const TEST_VIRGIN_GRADES = MATERIAL_GRADES.map(grade => [grade, grade] as const);', "const TEST_VIRGIN_GRADES = [\n  ['PE80', 'PE80'],\n  ['PE100', 'PE100'],\n] as const;")
    .replace('READABLE_MATERIAL_GRADES.some(grade => grade === normalizeMaterialGrade(value))', "['PE80', 'HDPE Standard', 'PE100', 'Commercial Grade (CGPE)', 'CTS Grade'].includes(normalizeMaterialGrade(value))");
  for (const name of ['createCustomerOrder', 'createReceivingReport', 'addMaterialRequest', 'createStockReplenishmentPO']) source = restoreGradeCreationGuard(name, source);
  return source;
}
