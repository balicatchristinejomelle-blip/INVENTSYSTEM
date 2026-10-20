import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { canRecordProduction, productionOutputTotals } from './productionOutput';
import { canFinishWip } from './operationalInventory';
import { exactPhysicalScan, expectedPelletError, type PhysicalScanMeta } from './physicalScan';
import { expectedPelletPlan } from './incomingPelletBarcodes';
import { requestReprint, reviewReprint, completePrint, validatePrint, canViewRequest, printAuditRole, type PrintableRecord, type PrintWorkflowState } from './reprintWorkflow';
import { hydratePrintWorkflow, printableRecords } from './printableRecords';
import { seedReprintSamples } from './reprintSamples';
import { hydrateFinishedPipe, hydratePipeRelationships, resolveFinishedPipe } from './finishedPipeRelations';
import { allocateFinishedPipeBarcodes, migrateFinishedPipeBarcodes } from './finishedPipeBarcodes';
import { activeLocationCodes, consumeLocationBalances, migrateSampleLocations } from './locationMaster';
import { readStorageLocations } from './finishedGoodsInventory';
import { finishedPipeInventory, validStorageLocation, storageLocationFor, compatibleStorageLocations, finishedGoodsSummary } from './finishedGoodsInventory';
import type {
  User, Role, Theme, Notification, MaterialRequest, Transfer, RRRecord,
  Customer, CustomerOrder, ManufacturingOrder, ProductionOrder,
  PelletInventory, FinishedGood, RejectedMaterial, RecyclingBatch,
  ShiftAttendance, ShiftTurnover, AuditLog, Transaction, Employee, BarcodeRegistryRecord,
  ColorantInventory, MaterialUsageTransaction, ProductSpecification
} from './types';
import { colorCodeFromProductColor, colorCodeFromStripe, specificationKey, specificationKeyFromRecord, specificationLength, READABLE_MATERIAL_GRADES, isActiveMaterialGrade, MATERIAL_GRADES } from './productMaster';
import { requestCategory, transferCategory } from './inventoryCategories';
import { newPelletColor, normalizeRecycledPelletColor, incompatibleRecycledCarry, RECYCLED_PELLET_COLORS, repairPelletColor, pelletDocumentColor } from './pelletColors';

// ─── SEED DATA ────────────────────────────────────────────────────────────────

// Backward-compatible display metadata only; never triggers an automatic reset.
const BARCODE_TEST_RESET_VERSION = 'material-balance-wip-lifecycle-2026-10-01-v5';
const APP_STATE_STORAGE_KEY = 'hpai:shared-app-state-v1';

// TEST / PROTOTYPE DEFAULTS ONLY. Replace these values with the approved HPAI
// BOM or recipe dosage when it becomes available.
export const TEST_BASE_COLORANT_RATE = 0.0175;
export const TEST_STRIPE_COLORANT_RATE = 0.0025;
export const TEST_BASE_COLORANT_USAGE = TEST_BASE_COLORANT_RATE;
export const TEST_STRIPE_COLORANT_USAGE = TEST_STRIPE_COLORANT_RATE;
export const TEST_MATERIAL_DENSITY_KG_M3 = 950;
const MASS_TOLERANCE_KG = 0.001;
const roundKg = (value: number) => Math.round(Math.max(0, value) * 1000) / 1000;
export const normalizeMaterialGrade = (value: string) => {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[\s-]+/g, '').toUpperCase();
  if (compact === 'PE80') return 'PE80';
  if (compact === 'PE100') return 'PE100';
  if (compact === 'HDPESTANDARD') return 'HDPE Standard';
  if (compact === 'COMMERCIALGRADE' || compact === 'COMMERCIALGRADE(CGPE)' || compact === 'CGPE') return 'Commercial Grade (CGPE)';
  if (compact === 'CTSGRADE') return 'CTS Grade';
  return normalized;
};
export const isSupportedMaterialGrade = (value: string) =>
  READABLE_MATERIAL_GRADES.some(grade => grade === normalizeMaterialGrade(value));

export const USERS: User[] = [
  { id: 'u0', username: 'owner', password: 'HPAI@2026!', role: 'OWNER_SUPER_ADMIN', name: 'Roberto Lim', plant: 'Company Wide', employeeId: 'HQ-OWN-001', status: 'active', lastLogin: '2026-09-30 08:30' },
  { id: 'u1', username: 'accounting', password: 'Accounting123!', role: 'accounting', name: 'Ana Reyes', plant: 'Main Plant', employeeId: 'MP-ACC-001', status: 'active', lastLogin: '2026-09-30 07:45' },
  { id: 'u2', username: 'marketing', password: 'Marketing123!', role: 'marketing', name: 'Luis Santos', plant: 'Main Plant', employeeId: 'MP-MKT-001', status: 'active', lastLogin: '2026-09-30 08:02' },
  { id: 'u3', username: 'management', password: 'Management123!', role: 'management', name: 'Carlo Mendoza', plant: 'Branch Plant', employeeId: 'BP-MGT-001', status: 'active', lastLogin: '2026-09-30 06:58' },
  { id: 'u4', username: 'plantmanager', password: 'Plant123!', role: 'plantmanager', name: 'Rosa Villanueva', plant: 'Branch Plant', employeeId: 'BP-PM-001', status: 'active', lastLogin: '2026-09-30 06:30' },
  { id: 'u5', username: 'production.demo', password: 'Production123!', role: 'production', name: 'Juan Dela Cruz', plant: 'Branch Plant', employeeId: 'BP-PRD-003', status: 'active', defaultShift: 'Day', lastLogin: '2026-09-30 06:02' },
];

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 'n1', title: 'New Material Request', description: 'MR-2026-0018 submitted by Branch Plant — 500 kg Virgin PE100', datetime: '2026-09-30 08:15', priority: 'Action Required', read: false, roles: ['accounting'] },
  { id: 'n2', title: 'Low Pellet Inventory', description: 'Virgin PE100 pellets below minimum threshold (120 kg remaining)', datetime: '2026-09-30 07:50', priority: 'Urgent', read: false, roles: ['accounting', 'management'] },
  { id: 'n3', title: 'Transfer MT-2026-0017 Received', description: 'Branch Plant confirmed receipt of 480 kg Virgin PE100', datetime: '2026-09-29 16:45', priority: 'Information', read: true, roles: ['accounting'] },
  { id: 'n4', title: 'MO Created — MO-2026-0045', description: 'Manufacturing Order for SO-2026-0058: 500 units HDPE 110mm SDR17', datetime: '2026-09-30 09:00', priority: 'Information', read: false, roles: ['marketing'] },
  { id: 'n5', title: 'Production Started — PO-2026-0012', description: 'Production Order PO-2026-0012 is now In Production', datetime: '2026-09-30 06:30', priority: 'Information', read: false, roles: ['marketing'] },
  { id: 'n6', title: 'Finished Goods Ready', description: '350 units HDPE 110mm are ready for customer SO-2026-0055', datetime: '2026-09-29 15:30', priority: 'Action Required', read: false, roles: ['marketing'] },
  { id: 'n7', title: 'Rejected Material Near Limit', description: 'Branch Plant rejected materials at 42 kg — approaching 50 kg limit', datetime: '2026-09-30 10:15', priority: 'Urgent', read: false, roles: ['management', 'plantmanager', 'production'] },
  { id: 'n8', title: 'Production Behind Schedule', description: 'PO-2026-0012 completion at 65% — required date is today', datetime: '2026-09-30 09:30', priority: 'Urgent', read: false, roles: ['management'] },
  { id: 'n9', title: 'New Manufacturing Order', description: 'MO-2026-0045 received — 500 units HDPE 110mm SDR17 PE100', datetime: '2026-09-30 09:00', priority: 'Action Required', read: false, roles: ['plantmanager'] },
  { id: 'n10', title: 'Material Request Approved', description: 'MR-2026-0017 approved — 500 kg Virgin PE100 transfer in preparation', datetime: '2026-09-29 14:00', priority: 'Information', read: true, roles: ['plantmanager'] },
  { id: 'n11', title: 'Shift Turnover Submitted', description: 'Day Shift turnover submitted by Juan Dela Cruz for PO-2026-0012', datetime: '2026-09-30 06:00', priority: 'Action Required', read: false, roles: ['plantmanager'] },
  { id: 'n12', title: 'PO Assigned', description: 'Production Order PO-2026-0012 assigned to Day Shift', datetime: '2026-09-30 06:00', priority: 'Action Required', read: false, roles: ['production'] },
  { id: 'n13', title: 'Pending Shift Turnover', description: 'Incoming shift has a pending turnover from Night Shift on PO-2026-0012', datetime: '2026-09-30 06:01', priority: 'Action Required', read: false, roles: ['production'] },
];

const INITIAL_MATERIAL_REQUESTS: MaterialRequest[] = [
  { id: 'mr1', refNo: 'MR-2026-0018', date: '2026-09-30', requestedBy: 'Rosa Villanueva', materialCategory: 'Virgin Pellet', pelletType: 'Virgin', grade: 'PE100', color: 'Black (BK)', requestedKg: 500, requestedBags: 20, destination: 'Branch Plant', status: 'New', moRef: 'MO-2026-0045', poRef: 'PO-2026-0012' },
  { id: 'mr2', refNo: 'MR-2026-0017', date: '2026-09-28', requestedBy: 'Rosa Villanueva', pelletType: 'Virgin', grade: 'PE100', color: 'Blue (BE)', requestedKg: 480, status: 'Approved', moRef: 'MO-2026-0043', poRef: 'PO-2026-0011', approvedBy: 'Ana Reyes', approvedDate: '2026-09-29' },
  { id: 'mr3', refNo: 'MR-2026-0016', date: '2026-09-25', requestedBy: 'Rosa Villanueva', pelletType: 'Virgin', grade: 'PE80', color: 'Black (BK)', requestedKg: 300, status: 'Rejected', notes: 'Insufficient stock', approvedBy: 'Ana Reyes', approvedDate: '2026-09-26' },
  { id: 'mr4', refNo: 'MR-2026-0015', date: '2026-09-22', requestedBy: 'Rosa Villanueva', pelletType: 'Virgin', grade: 'PE100', color: 'Black (BK)', requestedKg: 600, status: 'Pending', moRef: 'MO-2026-0041' },
];

const INITIAL_TRANSFERS: Transfer[] = [
  { id: 't1', refNo: 'MT-2026-0018', date: '2026-09-30', pelletType: 'Virgin', grade: 'PE100', color: 'Black (BK)', batchNo: 'VPE-2026-0042', numberOfBags: 20, weightKg: 500, source: 'Main Plant', destination: 'Branch Plant', status: 'Preparing', requestRef: 'MR-2026-0018' },
  { id: 't2', refNo: 'MT-2026-0017', date: '2026-09-29', pelletType: 'Virgin', grade: 'PE100', color: 'Blue (BE)', batchNo: 'VPE-2026-0041', numberOfBags: 19, weightKg: 475, source: 'Main Plant', destination: 'Branch Plant', status: 'Received', requestRef: 'MR-2026-0017', receivedBy: 'Juan Dela Cruz', receivedDate: '2026-09-29 15:30' },
  { id: 't3', refNo: 'MT-2026-0016', date: '2026-09-28', pelletType: 'Virgin', grade: 'PE80', color: 'Black (BK)', batchNo: 'VPE-2026-0040', numberOfBags: 14, weightKg: 350, source: 'Main Plant', destination: 'Branch Plant', status: 'In Transit', requestRef: 'MR-2026-0014' },
];

const INITIAL_RR: RRRecord[] = [
  { id: 'rr-test-0015', rrNumber: 'RR-2026-0015', date: '2026-09-30', material: 'HDPE Pellets', pelletType: 'Virgin', grade: 'PE100', color: 'Black (BK)', batchNo: 'VP-2026-0015', numberOfBags: 5, weightPerBagKg: 25, weightKg: 125, supplier: 'Petron Chemicals', referenceNo: 'TEST-RR-0015', destination: 'Branch Plant Warehouse', status: 'Completed', remarks: 'Clean barcode workflow test inventory' },
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Metro Water Corp.', code: 'MWC-001', contact: 'Eng. Roberto Cruz', address: 'Quezon City, Metro Manila', email: 'procurement@metrowater.com.ph', status: 'Active' },
  { id: 'c2', name: 'National Irrigation Authority', code: 'NIA-001', contact: 'Eng. Marites Bautista', address: 'Diliman, Quezon City', status: 'Active' },
  { id: 'c3', name: 'SM Prime Holdings', code: 'SM-001', contact: 'Mark Tan', address: 'Pasay City, Metro Manila', email: 'supply@smholdings.com', status: 'Active' },
  { id: 'c4', name: 'Ayala Land Inc.', code: 'ALI-001', contact: 'Jess Ramos', address: 'Makati City', email: 'procurement@ayalaland.com', status: 'Active' },
];

const INITIAL_ORDERS: CustomerOrder[] = [
  { id: 'so1', orderNo: 'SO-2026-0058', orderDate: '2026-09-30', customerId: 'c1', customerName: 'Metro Water Corp.', product: 'HDPE Pipe', diameter: '110mm', length: '6m', sdr: 'SDR17', grade: 'PE100', color: 'Black (BK)', stripe: 'Blue Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', quantity: 500, requiredDate: '2026-10-15', status: 'Ready for Release', moRef: 'MO-2026-0045', availableStock: 5 },
  { id: 'so2', orderNo: 'SO-2026-0057', orderDate: '2026-09-28', customerId: 'c2', customerName: 'National Irrigation Authority', product: 'HDPE Pipe', diameter: '90mm', length: '6m', sdr: 'SDR11', grade: 'PE100', color: 'Black (BK)', stripe: 'No Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', quantity: 800, requiredDate: '2026-10-20', status: 'Active', availableStock: 250 },
  { id: 'so3', orderNo: 'SO-2026-0056', orderDate: '2026-09-25', customerId: 'c3', customerName: 'SM Prime Holdings', product: 'HDPE Pipe', diameter: '63mm', length: '6m', sdr: 'SDR11', grade: 'PE80', color: 'Black (BK)', stripe: 'No Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', quantity: 300, requiredDate: '2026-10-05', status: 'Ready for Release', availableStock: 300 },
  { id: 'so4', orderNo: 'SO-2026-0055', orderDate: '2026-09-20', customerId: 'c4', customerName: 'Ayala Land Inc.', product: 'HDPE Pipe', diameter: '50mm', length: '100m', sdr: 'SDR11', grade: 'PE100', color: 'Black (BK)', stripe: 'No Stripe', construction: 'Solid Wall Pipe', productForm: 'Coil', quantity: 150, requiredDate: '2026-09-30', status: 'Completed', availableStock: 0 },
];

const INITIAL_MOS: ManufacturingOrder[] = [
  { id: 'mo1', moNo: 'MO-2026-0045', orderRef: 'SO-2026-0058', product: 'HDPE Pipe', diameter: '110mm', length: '6m', sdr: 'SDR17', grade: 'PE100', color: 'Black (BK)', stripe: 'Blue Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', requestedQty: 500, availableQty: 0, toManufactureQty: 500, requiredDate: '2026-10-15', createdBy: 'Luis Santos', createdDate: '2026-09-30', status: 'In Production', poRef: 'PO-2026-0012' },
  { id: 'mo2', moNo: 'MO-2026-0044', orderRef: 'SO-2026-0057', product: 'HDPE Pipe', diameter: '90mm', length: '6m', sdr: 'SDR11', grade: 'PE100', color: 'Black (BK)', stripe: 'No Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', requestedQty: 800, availableQty: 250, toManufactureQty: 550, requiredDate: '2026-10-20', createdBy: 'Luis Santos', createdDate: '2026-09-28', status: 'New' },
  { id: 'mo3', moNo: 'MO-2026-0043', orderRef: 'SO-2026-0054', product: 'HDPE Pipe', diameter: '75mm', length: '6m', sdr: 'SDR17', grade: 'PE80', color: 'Black (BK)', stripe: 'No Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', requestedQty: 400, availableQty: 400, toManufactureQty: 0, requiredDate: '2026-09-28', createdBy: 'Luis Santos', createdDate: '2026-09-22', status: 'Completed' },
];

const INITIAL_POS: ProductionOrder[] = [
  { id: 'po1', poNo: 'PO-2026-0012', moRef: 'MO-2026-0045', product: 'HDPE Pipe', diameter: '110mm', length: '6m', sdr: 'SDR17', grade: 'PE100', color: 'Black (BK)', stripe: 'Blue Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', targetQty: 500, completedQty: 13, pelletType: 'Virgin', requiredKg: 0, loadedKg: 0, productionLine: 'Line 2', priority: 'High', requiredDate: '2026-10-14', status: 'In Production', assignedShift: 'Day' },
  { id: 'po2', poNo: 'PO-2026-0011', moRef: 'MO-2026-0043', product: 'HDPE Pipe', diameter: '75mm', length: '6m', sdr: 'SDR17', grade: 'PE80', color: 'Black (BK)', stripe: 'No Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', targetQty: 400, completedQty: 400, pelletType: 'Virgin', requiredKg: 0, loadedKg: 1620, productionLine: 'Line 1', priority: 'Normal', requiredDate: '2026-09-28', status: 'Completed' },
  { id: 'po3', poNo: 'PO-2026-0013', moRef: 'MO-2026-0044', product: 'HDPE Pipe', diameter: '90mm', length: '6m', sdr: 'SDR11', grade: 'PE100', color: 'Black (BK)', stripe: 'No Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', targetQty: 550, completedQty: 0, pelletType: 'Virgin', requiredKg: 0, loadedKg: 0, productionLine: 'Line 1', priority: 'Normal', requiredDate: '2026-10-19', status: 'Scheduled' },
];

const makePelletBags = (
  count: number,
  data: Omit<PelletInventory, 'id' | 'bagNo' | 'availableKg' | 'barcode' | 'barcodeStatus' | 'printStatus' | 'inventoryStatus' | 'currentLocation' | 'locationStatus' | 'locationHistory'>,
  options: { available?: boolean; storageLocation?: string } = {},
): PelletInventory[] => Array.from({ length: count }, (_, index) => {
  const serial = String(index + 1).padStart(3, '0');
  const batchSerial = data.batchNo.replace(/^(VPE|VP|RP)-/, '');
  const available = options.available ?? data.type === 'Recycled';
  const barcode = `PEL-${data.type === 'Virgin' ? 'V' : 'R'}-${batchSerial}-${serial}`;
  return {
    ...data,
    color: newPelletColor(data.type, data.color),
    id: `${data.batchNo}-bag-${serial}`,
    bagNo: `Bag ${serial}`,
    availableKg: available ? 25 : 0,
    originalKg: 25,
    barcode,
    barcodeStatus: 'Generated',
    printStatus: 'Not Printed',
    inventoryStatus: available ? 'Available' : 'Pending Receipt',
    currentLocation: options.storageLocation || (data.type === 'Virgin'
      ? 'In Transit / Awaiting Receipt'
      : 'Recycling Area / Awaiting Storage'),
    locationStatus: options.storageLocation ? 'Stored' : data.type === 'Virgin' ? 'Awaiting Receipt' : 'Awaiting Storage',
    locationHistory: [],
    isTestData: data.batchNo.startsWith('TEST'),
  };
});

const TEST_VIRGIN_GRADES = MATERIAL_GRADES.map(grade => [grade, grade] as const);

const INITIAL_PELLETS: PelletInventory[] = [
  ...makePelletBags(1, {
    type: 'Virgin',
    batchNo: 'VP-2026-0018',
    grade: 'PE100',
    color: 'Black (BK)',
    receivedDate: '2026-10-01',
    rrRef: 'RR-2026-0018',
  }, { available: true, storageLocation: 'Virgin Pellet Storage' }),
  ...TEST_VIRGIN_GRADES.flatMap(([grade, code]) => makePelletBags(20, {
    type: 'Virgin',
    batchNo: `TEST-${code}`,
    grade,
    color: 'Test Inventory',
    receivedDate: '2026-10-01',
    rrRef: `TEST-SEED-${code}`,
  }, { available: true, storageLocation: 'Virgin Pellet Storage' })),
  ...makePelletBags(40, {
    type: 'Recycled',
    batchNo: 'TEST',
    grade: 'PE100',
    color: 'Black',
    receivedDate: '2026-10-01',
    recyclingBatchRef: 'TEST-SEED-RECYCLED',
  }, { available: true, storageLocation: 'Recycled Pellet Storage' }).map((bag, index) =>
    ({ ...bag, color: RECYCLED_PELLET_COLORS[index % RECYCLED_PELLET_COLORS.length] })),
];

const makeFinishedPipes = (
  count: number,
  data: Omit<FinishedGood, 'id' | 'fgId' | 'barcode' | 'barcodeStatus' | 'printStatus' | 'storageStatus' | 'releaseStatus' | 'quantity' | 'availableQty' | 'reservedQty' | 'currentLocation' | 'locationStatus' | 'locationHistory'>,
  options: { reserved?: boolean } = {},
): FinishedGood[] => Array.from({ length: count }, (_, index) => {
  const serial = String(index + 1).padStart(3, '0');
  const batchSerial = data.batch.replace(/\D/g, '').slice(-4);
  const productionYear = data.batch.match(/BATCH-(\d{4})-/)?.[1] || data.productionDate.slice(0, 4);
  const barcode = `PIPE-${productionYear}-${batchSerial}-${serial}`;
  return {
    ...data,
    id: `${data.batch}-pipe-${serial}`,
    fgId: barcode,
    barcode,
    barcodeStatus: 'Generated',
    printStatus: 'Not Printed',
    storageStatus: 'Not Stored',
    currentLocation: 'Production Area / Awaiting Storage',
    locationStatus: 'Awaiting Storage',
    locationHistory: [],
    releaseStatus: 'Not Released',
    quantity: 1,
    availableQty: 0,
    reservedQty: options.reserved ? 1 : 0,
    qualityStatus: 'Pass',
    status: options.reserved ? 'Reserved' : 'Quality Pending',
    inventoryPurpose: options.reserved ? 'Customer Order' : 'Unassigned',
    reservationStatus: options.reserved ? 'Reserved' : 'Unassigned',
    isTestData: data.batch === 'BATCH-2026-0021',
  };
});

const INITIAL_FG: FinishedGood[] = [
  ...makeFinishedPipes(5, { product: 'HDPE Pipe', diameter: '110mm', length: '6m', sdr: 'SDR17', grade: 'PE100', color: 'Black (BK)', stripe: 'Blue Stripe', construction: 'Solid Wall Pipe', productForm: 'Straight Length', batch: 'BATCH-2026-0021', poRef: 'PO-2026-0012', productionDate: '2026-09-30', shift: 'Day', storageLocation: '', status: 'Available' }),
];

const registryEntriesForPellets = (items: PelletInventory[], createdAt = new Date().toISOString()): BarcodeRegistryRecord[] =>
  items.map(item => ({
    barcode: item.barcode,
    itemId: item.id,
    itemType: item.type === 'Virgin' ? 'Virgin Pellet Bag' : 'Recycled Pellet Bag',
    category: 'Pellet',
    createdAt,
  }));

const registryEntriesForFinishedGoods = (items: FinishedGood[], createdAt = new Date().toISOString()): BarcodeRegistryRecord[] =>
  items.map(item => ({
    barcode: item.barcode,
    itemId: item.id,
    itemType: 'Finished Pipe',
    category: 'Finished Pipe',
    createdAt,
  }));

export const normalizeBarcodeValue = (value: string) =>
  value.normalize('NFKC').replace(/[\r\n\t]+/g, '').trim().toUpperCase();

const nextAnnualSequence = (
  barcodes: Iterable<string>,
  prefix: 'PEL-V' | 'PEL-R' | 'PIPE',
  year: number,
) => {
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)(?:-|$)`);
  let highest = 0;
  for (const barcode of barcodes) {
    const match = normalizeBarcodeValue(barcode).match(pattern);
    if (match) highest = Math.max(highest, Number(match[1]) || 0);
  }
  return highest + 1;
};

const makePermanentPelletBags = (
  count: number,
  data: Parameters<typeof makePelletBags>[1],
  registry: BarcodeRegistryRecord[],
  physicalRecords: PelletInventory[],
  options: Parameters<typeof makePelletBags>[2] = {},
) => {
  if (!isSupportedMaterialGrade(data.grade)) {
    throw new Error('INVALID PELLET GRADE — Select a supported material grade.');
  }
  if (!newPelletColor(data.type, data.color)) throw new Error('Select a valid pellet color from the shared master.');
  const year = Number(data.receivedDate.slice(0, 4)) || new Date().getFullYear();
  const prefix = data.type === 'Virgin' ? 'PEL-V' : 'PEL-R';
  const permanentlyUsed = new Set([
    ...registry.map(item => normalizeBarcodeValue(item.barcode)),
    ...physicalRecords.map(item => normalizeBarcodeValue(item.barcode)),
  ]);
  let parentSequence = nextAnnualSequence(permanentlyUsed, prefix, year);
  while (true) {
    const parent = `${prefix}-${year}-${String(parentSequence).padStart(4, '0')}`;
    const candidates = Array.from({ length: count }, (_, index) => `${parent}-${String(index + 1).padStart(3, '0')}`);
    if (candidates.every(barcode => !permanentlyUsed.has(barcode))) {
      return makePelletBags(count, data, options).map((item, index) => ({
        ...item,
        id: `${parent}-bag-${String(index + 1).padStart(3, '0')}`,
        barcode: candidates[index],
      }));
    }
    parentSequence += 1;
  }
};

const makePermanentFinishedPipes = (
  count: number,
  data: Parameters<typeof makeFinishedPipes>[1],
  registry: BarcodeRegistryRecord[],
  physicalRecords: FinishedGood[],
  serialFloor = 0,
) => {
  const year = Number(data.productionDate.slice(0, 4)) || new Date().getFullYear();
  const permanentlyUsed = new Set([
    ...registry.map(item => normalizeBarcodeValue(item.barcode)),
    ...physicalRecords.map(item => normalizeBarcodeValue(item.fgId)),
  ]);
  const physicalBarcodes = allocateFinishedPipeBarcodes(count, data, [...registry.map(row => row.barcode), ...physicalRecords.map(pipe => pipe.barcode)], serialFloor);
  let parentSequence = nextAnnualSequence(permanentlyUsed, 'PIPE', year);
  while (true) {
    const parent = `PIPE-${year}-${String(parentSequence).padStart(4, '0')}`;
    const candidates = Array.from({ length: count }, (_, index) => `${parent}-${String(index + 1).padStart(3, '0')}`);
    if (candidates.every(barcode => !permanentlyUsed.has(barcode))) {
      return makeFinishedPipes(count, data).map((item, index) => ({
        ...item,
        id: `${parent}-pipe-${String(index + 1).padStart(3, '0')}`,
        fgId: candidates[index],
        ...physicalBarcodes[index],
      }));
    }
    parentSequence += 1;
  }
};

const INITIAL_BARCODE_REGISTRY: BarcodeRegistryRecord[] = [
  ...registryEntriesForPellets(INITIAL_PELLETS, '2026-09-30T00:00:00.000Z'),
  ...registryEntriesForFinishedGoods(INITIAL_FG, '2026-09-30T00:00:00.000Z'),
];

const INITIAL_REJECTED: RejectedMaterial[] = [
  { id: 'rj1', rejectionId: 'RJ-2026-0045', poRef: 'PO-2026-0012', product: 'HDPE Pipe 110mm', batch: 'BATCH-2026-0145', quantity: 8, weightKg: 42, reason: 'Incorrect Diameter', employee: 'Juan Dela Cruz', shift: 'Day', date: '2026-09-30', allocatedWeightKg: 0, allocationStatus: 'Unallocated', isTestData: true },
  { id: 'rj2', rejectionId: 'RJ-2026-0044', poRef: 'PO-2026-0011', product: 'HDPE Pipe 75mm', batch: 'BATCH-2026-0130', quantity: 3, weightKg: 8, reason: 'Surface Defect', employee: 'Maria Santos', shift: 'Night', date: '2026-09-28', recyclingBatchRef: 'RP-2026-0008', allocatedWeightKg: 8, allocationStatus: 'Completed', isTestData: true },
];

const INITIAL_RECYCLING: RecyclingBatch[] = [
  { id: 'rb2', batchNo: 'RP-2026-0008', originalKg: 50, date: '2026-09-27', status: 'Completed', employees: ['Maria Santos', 'Mark Reyes'], sourcePO: 'PO-2026-0011', product: 'HDPE Pipe 75mm', rejectReasons: ['Surface Defect'], recoveredKg: 50, lossKg: 0, completeBags: 2, looseKg: 0, confirmationStatus: 'Confirmed' },
];

const INITIAL_ATTENDANCE: ShiftAttendance[] = [
  { id: 'att1', employeeId: 'BP-PRD-003', employeeName: 'Juan Dela Cruz', shift: 'Day', date: '2026-09-30', clockIn: '06:02', clockOut: '14:02', status: 'Completed' },
  { id: 'att2', employeeId: 'BP-PRD-002', employeeName: 'Maria Santos', shift: 'Night', date: '2026-09-29', clockIn: '18:05', clockOut: '06:00', status: 'Completed' },
];

const INITIAL_TURNOVER: ShiftTurnover[] = [
  { id: 'sto1', turnoverNo: 'STO-2026-0044', outgoingEmployee: 'Maria Santos', outgoingEmployeeId: 'BP-PRD-002', outgoingShift: 'Night', incomingShift: 'Day', poRef: 'PO-2026-0012', productionLine: 'Line 2', targetQty: 500, completedThisShift: 125, totalCompleted: 325, remaining: 175, pelletType: 'Virgin PE100', pelletBatch: 'VPE-2026-0042', pelletLoaded: 900, pelletUsed: 875, rejectedQty: 5, rejectedKg: 26, productionStage: 'Extrusion', machineCondition: 'Normal', issuesEncountered: 'Minor temperature fluctuation at startup, resolved after 15 minutes.', notesForIncoming: 'Line 2 running smoothly. Continue with current settings. Pellet batch VPE-2026-0042 still has ~25 kg.', date: '2026-09-30', time: '06:00', status: 'Pending' },
];

const INITIAL_AUDIT: AuditLog[] = [
  { id: 'al1', user: 'Juan Dela Cruz', employeeId: 'BP-PRD-003', role: 'Production', action: 'Clock In', date: '2026-09-30', time: '06:02', reference: 'ATT-2026-0301' },
  { id: 'al2', user: 'Ana Reyes', employeeId: 'MP-ACC-001', role: 'Accounting', action: 'RR Verified', date: '2026-09-30', time: '07:50', reference: 'RR-2026-0088' },
  { id: 'al3', user: 'Luis Santos', employeeId: 'MP-MKT-001', role: 'Marketing', action: 'Customer Order Created', date: '2026-09-30', time: '09:00', reference: 'SO-2026-0058' },
  { id: 'al4', user: 'Luis Santos', employeeId: 'MP-MKT-001', role: 'Marketing', action: 'MO Created', date: '2026-09-30', time: '09:01', reference: 'MO-2026-0045' },
  { id: 'al5', user: 'Rosa Villanueva', employeeId: 'BP-PM-001', role: 'Plant Manager', action: 'Material Request Submitted', date: '2026-09-30', time: '08:15', reference: 'MR-2026-0018' },
  { id: 'al6', user: 'Rosa Villanueva', employeeId: 'BP-PM-001', role: 'Plant Manager', action: 'Production Order Created', date: '2026-09-30', time: '06:25', reference: 'PO-2026-0012' },
  { id: 'al7', user: 'Maria Santos', employeeId: 'BP-PRD-002', role: 'Production', action: 'Shift Turnover Submitted', date: '2026-09-30', time: '06:00', reference: 'STO-2026-0044' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [];

const INITIAL_COLORANTS: ColorantInventory[] = [
  ...([
    ['BK', 'Black'],
    ['BE', 'Blue'],
    ['OR', 'Orange'],
    ['RO', 'Red Orange'],
    ['GRN', 'Green'],
  ] as const).map(([colorCode, color]) => ({
    id: `test-colorant-base-${colorCode.toLowerCase()}`,
    colorantId: `COL-TEST-BASE-${colorCode}`,
    name: `${color} Base Colorant`,
    color,
    colorCode,
    usageType: 'BASE_COLORANT' as const,
    availableKg: 50,
    unit: 'kg' as const,
    inventoryClass: 'Raw Materials' as const,
    status: 'Available' as const,
    dateReceived: '2026-10-01',
    lastUpdated: '2026-10-01 00:00',
    sourceReference: 'TEST-SEED-COLORANT',
    isTestData: true,
  })),
  ...([
    ['BE', 'Blue'],
    ['OR', 'Orange'],
    ['GRN', 'Green'],
    ['BK', 'Black'],
  ] as const).map(([colorCode, color]) => ({
    id: `test-colorant-stripe-${colorCode.toLowerCase()}`,
    colorantId: `COL-TEST-STRIPE-${colorCode}`,
    name: `${color} Stripe Colorant`,
    color,
    colorCode,
    usageType: 'STRIPE_COLORANT' as const,
    availableKg: 20,
    unit: 'kg' as const,
    inventoryClass: 'Raw Materials' as const,
    status: 'Available' as const,
    dateReceived: '2026-10-01',
    lastUpdated: '2026-10-01 00:00',
    sourceReference: 'TEST-SEED-COLORANT',
    isTestData: true,
  })),
];

const INITIAL_MATERIAL_USAGE: MaterialUsageTransaction[] = [];

const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'e1', employeeId: 'BP-PRD-001', firstName: 'Mark', lastName: 'Reyes', username: 'mark.reyes', role: 'production', plant: 'Branch Plant', defaultShift: 'Night', status: 'Active', lastLogin: '2026-09-29 18:03' },
  { id: 'e2', employeeId: 'BP-PRD-002', firstName: 'Maria', lastName: 'Santos', username: 'maria.santos', role: 'production', plant: 'Branch Plant', defaultShift: 'Night', status: 'Active', lastLogin: '2026-09-29 18:05' },
  { id: 'e3', employeeId: 'BP-PRD-003', firstName: 'Juan', lastName: 'Dela Cruz', username: 'production.demo', role: 'production', plant: 'Branch Plant', defaultShift: 'Day', status: 'Active', lastLogin: '2026-09-30 06:02' },
  { id: 'e4', employeeId: 'BP-PM-001', firstName: 'Rosa', lastName: 'Villanueva', username: 'plantmanager', role: 'plantmanager', plant: 'Branch Plant', defaultShift: 'Day', status: 'Active', lastLogin: '2026-09-30 06:30' },
];

export interface ProductionMaterialPlan {
  unitWeightKg: number;
  unitWeightSource: 'Theoretical solid-wall calculation' | 'Theoretical solid-wall calculation · TEST density configuration' | 'Configured product recipe' | 'UNIT WEIGHT CONFIGURATION REQUIRED';
  physicalPipeMaterialKg: number;
  baseColorantKg: number;
  stripeColorantKg: number;
  totalColorantKg: number;
  pelletRequiredKg: number;
  processLossKg: number;
  totalMaterialConsumedKg: number;
}

export const calculateProcessLoss = (actualMaterialConsumedKg: number, physicalOutputKg: number) => {
  if (!Number.isFinite(actualMaterialConsumedKg) || !Number.isFinite(physicalOutputKg)) {
    return { lossKg: 0, reconciliationError: true };
  }
  const difference = actualMaterialConsumedKg - physicalOutputKg;
  if (difference < -MASS_TOLERANCE_KG) {
    return { lossKg: 0, reconciliationError: true };
  }
  return {
    lossKg: Math.abs(difference) <= MASS_TOLERANCE_KG ? 0 : roundKg(difference),
    reconciliationError: false,
  };
};

export const calculateCuttingLoss = (originalRejectedKg: number, cutMaterialKg: number) =>
  calculateProcessLoss(originalRejectedKg, cutMaterialKg);

export const calculateRecyclingMetrics = (
  originalRejectedKg: number,
  cutMaterialKg: number,
  recoveredPelletKg: number,
) => {
  const cutting = calculateCuttingLoss(originalRejectedKg, cutMaterialKg);
  const recycling = calculateProcessLoss(cutMaterialKg, recoveredPelletKg);
  const total = calculateProcessLoss(originalRejectedKg, recoveredPelletKg);
  const validOriginal = Number.isFinite(originalRejectedKg) && originalRejectedKg > MASS_TOLERANCE_KG;
  return {
    cuttingLossKg: cutting.lossKg,
    recyclingProcessLossKg: recycling.lossKg,
    totalRecyclingLossKg: total.lossKg,
    recoveryRate: validOriginal && !total.reconciliationError
      ? Math.round((recoveredPelletKg / originalRejectedKg) * 10000) / 100
      : 0,
    reconciliationError: cutting.reconciliationError || recycling.reconciliationError || total.reconciliationError,
  };
};

export const calculateRecycledBagging = (recoveredPelletKg: number, existingLooseKg = 0) => {
  const safeRecoveredKg = Number.isFinite(recoveredPelletKg) ? Math.max(0, recoveredPelletKg) : 0;
  const safeLooseKg = Number.isFinite(existingLooseKg) ? Math.max(0, existingLooseKg) : 0;
  const pelletizableKg = roundKg(safeRecoveredKg + safeLooseKg);
  const completeBags = Math.floor((pelletizableKg + MASS_TOLERANCE_KG) / 25);
  return {
    completeBags,
    baggedWeightKg: completeBags * 25,
    looseKg: roundKg(pelletizableKg - completeBags * 25),
  };
};

export const calculateUnitPipeWeightKg = (po: ProductionOrder) => {
  if (Number.isFinite(po.unitWeightKg) && (po.unitWeightKg || 0) > 0) {
    return { value: roundKg(po.unitWeightKg!), source: 'Configured product recipe' as const };
  }
  const diameterMm = Number.parseFloat(po.diameter);
  const sdr = Number.parseFloat(po.sdr.replace(/[^\d.]/g, ''));
  const lengthM = Number.parseFloat(po.length);
  const hasConfiguredDensity = Number.isFinite(po.materialDensityKgM3) && (po.materialDensityKgM3 || 0) > 0;
  const density = hasConfiguredDensity ? po.materialDensityKgM3! : TEST_MATERIAL_DENSITY_KG_M3;
  if (
    /solid wall/i.test(po.construction)
    && Number.isFinite(diameterMm) && diameterMm > 0
    && Number.isFinite(sdr) && sdr > 2
    && Number.isFinite(lengthM) && lengthM > 0
    && Number.isFinite(density) && density > 0
  ) {
    const outsideDiameterM = diameterMm / 1000;
    const wallThicknessM = outsideDiameterM / sdr;
    const insideDiameterM = outsideDiameterM - (2 * wallThicknessM);
    const materialAreaM2 = Math.PI / 4 * ((outsideDiameterM ** 2) - (insideDiameterM ** 2));
    const calculated = materialAreaM2 * lengthM * density;
    if (Number.isFinite(calculated) && calculated > 0) {
      return {
        value: roundKg(calculated),
        source: hasConfiguredDensity
          ? 'Theoretical solid-wall calculation' as const
          : 'Theoretical solid-wall calculation · TEST density configuration' as const,
      };
    }
  }
  return { value: 0, source: 'UNIT WEIGHT CONFIGURATION REQUIRED' as const };
};

export const calculateProductionMaterialPlan = (
  po: ProductionOrder,
  outputQuantity: number,
): ProductionMaterialPlan => {
  const quantity = Number.isFinite(outputQuantity) ? Math.max(0, Math.floor(outputQuantity)) : 0;
  const unitWeight = calculateUnitPipeWeightKg(po);
  const physicalPipeMaterialKg = roundKg(quantity * unitWeight.value);
  const stripeColorantKg = po.stripe === 'No Stripe' ? 0 : roundKg(physicalPipeMaterialKg * TEST_STRIPE_COLORANT_RATE);
  const baseColorantKg = roundKg(physicalPipeMaterialKg * TEST_BASE_COLORANT_RATE);
  const totalColorantKg = roundKg(baseColorantKg + stripeColorantKg);
  // Pellet alone controls production capacity. Colorant is tracked separately and
  // must never reduce the resin requirement used to validate possible output.
  const pelletRequiredKg = physicalPipeMaterialKg;
  const actualMaterialConsumedKg = roundKg(pelletRequiredKg + totalColorantKg);
  const processLoss = calculateProcessLoss(actualMaterialConsumedKg, physicalPipeMaterialKg);
  return {
    unitWeightKg: unitWeight.value,
    unitWeightSource: unitWeight.source,
    physicalPipeMaterialKg,
    baseColorantKg,
    stripeColorantKg,
    totalColorantKg,
    pelletRequiredKg,
    processLossKg: processLoss.lossKg,
    totalMaterialConsumedKg: actualMaterialConsumedKg,
  };
};

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

interface AppState extends PrintWorkflowState {
  finishedPipeSerialHighWater?: number;
  theme: Theme;
  currentUser: User | null;
  currentPage: string;
  clockedIn: boolean;
  clockInTime: string;
  currentShift: 'Day' | 'Night';
  notifications: Notification[];
  materialRequests: MaterialRequest[];
  transfers: Transfer[];
  rrRecords: RRRecord[];
  customers: Customer[];
  orders: CustomerOrder[];
  manufacturingOrders: ManufacturingOrder[];
  productionOrders: ProductionOrder[];
  pellets: PelletInventory[];
  finishedGoods: FinishedGood[];
  rejectedMaterials: RejectedMaterial[];
  recyclingBatches: RecyclingBatch[];
  attendance: ShiftAttendance[];
  turnovers: ShiftTurnover[];
  auditLogs: AuditLog[];
  transactions: Transaction[];
  colorants: ColorantInventory[];
  materialUsageTransactions: MaterialUsageTransaction[];
  employees: Employee[];
  barcodeRegistry: BarcodeRegistryRecord[];
  pendingTurnover: ShiftTurnover | null;
  totalRejectedKg: number;
}

interface AppContextValue extends AppState {
  selectedReprintRequestId: string | null;
  openReprintRequest: (id: string | null) => void;
  submitReprintRequest: (key: string, reason: string) => { success: boolean; error?: string };
  decideReprintRequest: (id: string, decision: 'APPROVED' | 'REJECTED', reason?: string) => { success: boolean; error?: string };
  beginPrint: (keys: string[], approvalId?: string) => Promise<{ success: boolean; error?: string; ticket?: string }>;
  finishPrint: (ticket: string, successful: boolean) => { success: boolean; error?: string };
  barcodeResetVersion: string;
  activeAttendance: ShiftAttendance | null;
  activeProductionOrder: ProductionOrder | null;
  currentSessionTurnover: ShiftTurnover | null;
  currentSessionTransactions: Transaction[];
  currentMaterialUsage: {
    virginBags: number;
    virginWeightKg: number;
    recycledBags: number;
    recycledWeightKg: number;
    colorantWeightKg: number;
    colorantNames: string[];
    baseColorantWeightKg: number;
    baseColorantNames: string[];
    stripeColorantWeightKg: number;
    stripeColorantNames: string[];
    totalPelletWeightKg: number;
    totalMaterialWeightKg: number;
  };
  setTheme: (t: Theme) => void;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  navigate: (page: string) => void;
  clockIn: (employeeName: string) => { success: boolean; error?: string };
  clockOut: () => void;
  markNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  approveMaterialRequest: (id: string) => void;
  rejectMaterialRequest: (id: string) => void;
  acceptTurnover: () => void;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  assignEmployeeShift: (id: string, shift: 'Day' | 'Night') => { success: boolean; error?: string };
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  createCustomerOrder: (order: Omit<CustomerOrder, 'id' | 'orderNo' | 'orderDate' | 'status' | 'moRef' | 'availableStock' | 'reservedQuantity' | 'releasedQuantity'>) => { success: boolean; orderNo?: string; moNo?: string; reserved: number; shortage: number; error?: string };
  createReceivingReport: (data: {
    storageLocation: string;
    pelletType: 'Virgin' | 'Recycled';
    grade: string;
    color: string;
    numberOfBags: number;
    supplier: string;
    referenceNo: string;
    destination: string;
    remarks?: string;
  }) => void;
  createTransfer: (requestId: string) => string | null;
  ensureExpectedPelletBags: (requestId: string) => { success: boolean; error?: string };
  dispatchTransfer: (transferId: string) => { success: boolean; error?: string };
  updatePO: (id: string, updates: Partial<ProductionOrder>) => void;
  finishWipBag: (pelletId: string) => { success: boolean; error?: string };
  startProduction: (poId: string) => { success: boolean; error?: string };
  recordOutput: (poId: string, qty: number, rejections: Array<{ weightKg: number; reason: string }>, entryId?: string) => { success: boolean; error?: string };
  addMaterialRequest: (req: Omit<MaterialRequest, 'id'>) => { success: boolean; requestRef?: string; error?: string };
  loadPellets: (pelletId: string, poId: string, scannerMeta?: { shift: string; scannerMode: string }) => boolean;
  recordColorantUsage: (colorantId: string, quantityKg: number, poId: string, usageType?: 'BASE_COLORANT' | 'STRIPE_COLORANT') => { success: boolean; error?: string };
  submitTurnover: (data: Pick<ShiftTurnover, 'machineCondition' | 'lineCondition' | 'lineConditionOther' | 'issueCategory' | 'issueDescription' | 'issuesEncountered' | 'nextRequiredAction' | 'nextRequiredActionOther' | 'notesForIncoming' | 'instructionType' | 'importantInstructions'>, poId: string) => { success: boolean; turnoverNo?: string; error?: string };
  updateFinishedGoodStorage: (fgId: string, location: string, purpose: 'General Inventory' | 'Customer Order', orderId?: string, scannerMeta?: PhysicalScanMeta) => boolean;
  createProductionOrder: (moId: string) => string | null;
  createStockReplenishmentPO: (input: {
    specification: ProductSpecification;
    targetQty: number;
    requiredDate: string;
    productionLine: string;
    priority: ProductionOrder['priority'];
    reason: string;
  }) => { success: boolean; poNo?: string; error?: string };
  receivePellet: (pelletId: string, scannerMeta?: PhysicalScanMeta, storageLocation?: string) => boolean;
  acceptScannedPelletTransfer: (transferId: string, barcodes: string[], location: string) => { success: boolean; error?: string };
  confirmTransferReceipt: (transferId: string, receivedQuantity: number, reason?: Transfer['discrepancyReason'], notes?: string, storageLocation?: string) => { success: boolean; error?: string };
  relocatePhysicalItem: (category: 'Pellet' | 'Finished Pipe', itemId: string, location: string, reason: string) => boolean;
  reserveFinishedGoods: (orderId: string, quantity: number) => { success: boolean; error?: string };
  rejectFinishedGood: (fgId: string, weightKg: number, reason: string) => { success: boolean; error?: string };
  releaseFinishedGood: (fgId: string, scannerMeta?: PhysicalScanMeta) => boolean;
  markFinishedGoodLoaded: (fgId: string) => boolean;
  completeRecyclingBatch: (batchId: string, recoveredKg: number, color: string) => void;
  updateRecyclingStage: (batchId: string, action: 'start-cutting' | 'complete-cutting' | 'submit-weight' | 'start-crushing' | 'complete-crushing' | 'start-pelletizing', weightKg?: number) => { success: boolean; error?: string };
  confirmRecyclingForCrushing: (batchId: string) => boolean;
}

// Keep one context identity across Vite/Figma Make hot module replacements.
// Without this, a refreshed useApp hook can briefly read from a newly-created
// context while the mounted provider still belongs to the previous module.
const contextGlobal = globalThis as typeof globalThis & {
  __HPAI_APP_CONTEXT__?: React.Context<AppContextValue | null>;
};
const AppContext = contextGlobal.__HPAI_APP_CONTEXT__
  ?? (contextGlobal.__HPAI_APP_CONTEXT__ = createContext<AppContextValue | null>(null));

const createInitialState = (): AppState => ({
  printMetadata: {},
  reprintRequests: [],
  theme: 'light',
  currentUser: null,
  currentPage: 'login',
  clockedIn: false,
  clockInTime: '',
  currentShift: 'Day',
  notifications: INITIAL_NOTIFICATIONS,
  materialRequests: INITIAL_MATERIAL_REQUESTS.map(pelletDocumentColor),
  transfers: INITIAL_TRANSFERS.map(pelletDocumentColor),
  rrRecords: INITIAL_RR.map(pelletDocumentColor),
  customers: INITIAL_CUSTOMERS,
  orders: INITIAL_ORDERS,
  manufacturingOrders: INITIAL_MOS,
  productionOrders: INITIAL_POS,
  pellets: INITIAL_PELLETS,
  finishedGoods: INITIAL_FG,
  rejectedMaterials: INITIAL_REJECTED,
  recyclingBatches: INITIAL_RECYCLING,
  attendance: INITIAL_ATTENDANCE,
  turnovers: INITIAL_TURNOVER,
  auditLogs: INITIAL_AUDIT,
  transactions: INITIAL_TRANSACTIONS,
  colorants: INITIAL_COLORANTS,
  materialUsageTransactions: INITIAL_MATERIAL_USAGE,
  employees: INITIAL_EMPLOYEES,
  barcodeRegistry: INITIAL_BARCODE_REGISTRY,
  pendingTurnover: INITIAL_TURNOVER[0],
  totalRejectedKg: 42,
});

// One additive sample was explicitly requested. Never replace existing physical records.
export function addReplenishmentSample<T extends AppState>(state: T): T {
  if (state.productionOrders.some(po => po.id === 'hpai-replenishment-sample-po-v1')) return state;
  if (state.finishedGoods.some(pipe => pipe.id === 'hpai-replenishment-sample-pipe-v1' || (pipe.qualityStatus === 'Pass' && resolveFinishedPipe(pipe, state).source === 'Stock Replenishment'))) return state;
  const example = state.finishedGoods.find(pipe => pipe.qualityStatus === 'Pass');
  if (!example) return state;
  const now = new Date();
  const year = now.getFullYear();
  const next = Math.max(0, ...state.productionOrders.filter(po => po.poNo.startsWith(`PO-${year}-`)).map(po => Number(po.poNo.split('-').pop()) || 0)) + 1;
  const poNo = `PO-${year}-${String(next).padStart(4, '0')}`;
  const batchSequence = Math.max(0, ...[...state.finishedGoods, ...state.rejectedMaterials].map(item => Number(item.batch.split('-').pop()) || 0)) + 1;
  const batch = `BATCH-${year}-${String(batchSequence).padStart(4, '0')}`;
  const po: ProductionOrder = { id: 'hpai-replenishment-sample-po-v1', poNo, moRef: 'STOCK REPLENISHMENT', source: 'Stock Replenishment', originGroup: `REPLENISH-${year}-${String(next).padStart(4, '0')}`, product: example.product, grade: example.grade, diameter: example.diameter, sdr: example.sdr, length: example.length, color: example.color, stripe: example.stripe, construction: example.construction, productForm: example.productForm, targetQty: 1, completedQty: 1, pelletType: 'Virgin', requiredKg: 0, loadedKg: 0, productionLine: 'Line 1', priority: 'Normal', requiredDate: now.toISOString().slice(0, 10), status: 'Completed', replenishmentReason: 'One localhost relationship sample — not a live transaction' };
  const [generated] = makePermanentFinishedPipes(1, { product: po.product, grade: po.grade, diameter: po.diameter, sdr: po.sdr, length: po.length, color: po.color, stripe: po.stripe, construction: po.construction, productForm: po.productForm, batch, poRef: poNo, productionDate: po.requiredDate, shift: 'Day', storageLocation: 'A', status: 'Available' }, state.barcodeRegistry, state.finishedGoods, state.finishedPipeSerialHighWater || 0);
  const pipe: FinishedGood = { ...generated, id: 'hpai-replenishment-sample-pipe-v1', source: 'Stock Replenishment', productionOrderId: po.id, originGroup: po.originGroup, inventoryPurpose: 'General Inventory', status: 'Available', reservationStatus: 'Available', storageStatus: 'Stored', locationStatus: 'Stored', currentLocation: 'A', availableQty: 1, qualityStatus: 'Pass', isTestData: true, storedBy: 'Localhost Sample', storedAt: now.toISOString(), locationHistory: [{ from: 'Production Area / Awaiting Storage', to: 'A', action: 'Stored', employee: 'Localhost Sample', employeeId: 'LOCALHOST-SAMPLE', dateTime: now.toISOString(), reason: 'Explicitly requested replenishment relationship sample' }] };
  return { ...state, productionOrders: [...state.productionOrders, po], finishedGoods: [...state.finishedGoods, pipe], barcodeRegistry: [...state.barcodeRegistry, ...registryEntriesForFinishedGoods([pipe], now.toISOString())] };
}

const restoreAppState = (): AppState => {
  const initial = createInitialState();
  // Server rendering has no browser storage or print history to initialize.
  if (typeof window === 'undefined') return addReplenishmentSample(migrateSampleLocations(migrateFinishedPipeBarcodes(initial)));
  try {
    const stored = window.localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!stored) {
      const demo = seedReprintSamples(initial, USERS);
      const fresh = { ...initial, ...demo, notifications: [...demo.notifications, ...initial.notifications], auditLogs: [...demo.auditLogs, ...initial.auditLogs] };
      return addReplenishmentSample(migrateSampleLocations(migrateFinishedPipeBarcodes(fresh)));
    }
    const saved = JSON.parse(stored);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid saved state');
    // A schema gap is not permission to reseed transactions. Existing/empty collections win.
    const collections: Record<string, unknown[]> = {};
    for (const [key, value] of Object.entries(initial)) {
      if (Array.isArray(value) && key in saved && !Array.isArray(saved[key])) throw new Error(`Invalid saved collection: ${key}`);
      if (Array.isArray(value)) collections[key] = key in saved ? saved[key] : [];
    }
    const restored = { ...initial, ...saved, ...collections } as AppState;
    Object.assign(restored, hydratePrintWorkflow(restored, restored));
    if (restored.currentUser?.username === 'owner.admin' || restored.currentUser?.employeeId === 'HQ-OWN-TEST') {
      restored.currentUser = null;
      restored.currentPage = 'login';
    } else if (restored.currentUser?.username === 'owner') {
      restored.currentUser = USERS[0];
    }
    restored.colorants = Array.isArray(restored.colorants) ? restored.colorants : INITIAL_COLORANTS;
    restored.materialUsageTransactions = Array.isArray(restored.materialUsageTransactions)
      ? restored.materialUsageTransactions
      : [];
    restored.pellets = restored.pellets.map(item => {
      const legacy = item as PelletInventory & { materialGrade?: string; pelletGrade?: string; material_type?: string };
      return repairPelletColor({ ...item, grade: normalizeMaterialGrade(item.grade || legacy.materialGrade || legacy.pelletGrade || legacy.material_type || '') });
    });
    restored.materialRequests = restored.materialRequests.map(pelletDocumentColor);
    restored.transfers = restored.transfers.map(pelletDocumentColor);
    restored.rrRecords = restored.rrRecords.map(pelletDocumentColor);
    restored.finishedGoods = restored.finishedGoods.map(item => ({
      ...item,
      grade: item.grade ? normalizeMaterialGrade(item.grade) : item.grade,
      inventoryPurpose: item.inventoryPurpose || (item.reservedForOrderId ? 'Customer Order' : item.locationStatus === 'Stored' ? 'General Inventory' : 'Unassigned'),
      reservationStatus: item.reservationStatus || (item.releaseStatus === 'Released' ? 'Shipped Out' : item.status === 'Ready for Release' ? 'Ready for Ship Out' : item.status === 'Reserved' ? 'Reserved' : item.status === 'Available' ? 'Available' : 'Unassigned'),
      availableQty: item.availableQty ?? (item.locationStatus === 'Stored' && item.status === 'Available' ? item.quantity : 0),
    }));
    const supportedGrade = (grade: string) => grade ? normalizeMaterialGrade(grade) : grade;
    restored.materialRequests = restored.materialRequests.map(item => ({ ...item, grade: requestCategory(item) === 'Colorant' ? item.grade : supportedGrade(item.grade) }));
    restored.transfers = restored.transfers.map(item => ({ ...item, grade: transferCategory(item) === 'Colorant' ? item.grade : supportedGrade(item.grade) }));
    restored.rrRecords = restored.rrRecords.map(item => ({ ...item, grade: supportedGrade(item.grade) }));
    restored.orders = restored.orders.map(item => ({ ...item, grade: supportedGrade(item.grade) }));
    restored.manufacturingOrders = restored.manufacturingOrders.map(item => ({ ...item, grade: supportedGrade(item.grade) }));
    restored.productionOrders = restored.productionOrders.map(item => ({ ...item, grade: supportedGrade(item.grade) }));
    if (restored.materialUsageTransactions.length === 0) {
      restored.materialUsageTransactions = restored.transactions
        .filter(transaction =>
          transaction.transactionType === 'Pellet Consumed'
          && transaction.status === 'Completed'
          && transaction.attendanceSessionId
        )
        .map(transaction => {
          const po = restored.productionOrders.find(order =>
            order.id === transaction.productionOrderId || order.poNo === transaction.reference
          );
          const pellet = restored.pellets.find(item =>
            item.id === transaction.batch || item.barcode === transaction.barcode
          );
          return {
            id: `mu-migrated-${transaction.id}`,
            transactionId: transaction.txId,
            productionOrderId: transaction.productionOrderId || po?.id || '',
            productionOrderRef: transaction.reference,
            employeeId: transaction.employeeId,
            employeeName: transaction.employee,
            attendanceSessionId: transaction.attendanceSessionId!,
            shift: transaction.shift === 'Night' ? 'Night' as const : 'Day' as const,
            materialType: transaction.item.startsWith('Recycled') ? 'RECYCLED_PELLET' as const : 'VIRGIN_PELLET' as const,
            materialId: pellet?.id || transaction.barcode || transaction.id,
            materialName: transaction.item,
            quantity: Math.abs(transaction.qtyChanged),
            unit: 'kg' as const,
            dateTime: `${transaction.date}T${transaction.time}:00`,
            sourceReference: transaction.batch,
            physicalBagId: pellet?.id,
            barcode: transaction.barcode,
          };
        })
        .filter(transaction => transaction.productionOrderId);
    }
    const activeAttendance = restored.currentUser
      ? restored.attendance.find(record =>
          record.employeeId === restored.currentUser?.employeeId && record.status === 'Active'
        )
      : undefined;
    return activeAttendance
      ? {
          ...restored,
          clockedIn: true,
          clockInTime: activeAttendance.clockIn,
          currentShift: activeAttendance.shift,
        }
      : restored;
  } catch {
    // Fail closed: persisting fresh seeds here would overwrite the unreadable user's data.
    throw new Error('Saved HPAI data could not be read safely. No reset was performed. Export/repair the existing browser backup before continuing.');
  }
};

const transactionBelongsToSession = (transaction: Transaction, attendance: ShiftAttendance) => {
  if (transaction.attendanceSessionId) return transaction.attendanceSessionId === attendance.id;
  if (transaction.employeeId !== attendance.employeeId || transaction.shift !== attendance.shift) return false;
  if (transaction.date < attendance.date) return false;
  if (transaction.date === attendance.date && transaction.time < attendance.clockIn) return false;
  return true;
};

const isUnfinishedProductionOrder = (order: ProductionOrder) =>
  order.completedQty < order.targetQty
  && order.status !== 'Completed'
  && order.status !== 'Cancelled';

const findPendingTurnover = (
  turnovers: ShiftTurnover[],
  productionOrders: ProductionOrder[],
  incomingShift: 'Day' | 'Night',
  employeeId: string,
) => turnovers.find(turnover => {
  if (
    turnover.status !== 'Pending'
    || turnover.incomingShift !== incomingShift
    || turnover.outgoingEmployeeId === employeeId
  ) return false;
  const linkedOrder = productionOrders.find(order =>
    order.id === turnover.productionOrderId || order.poNo === turnover.poRef
  );
  return !!linkedOrder && isUnfinishedProductionOrder(linkedOrder);
}) || null;

const findSessionProductionOrder = (
  productionOrders: ProductionOrder[],
  transactions: Transaction[],
  attendance: ShiftAttendance,
) => {
  const selected = productionOrders.find(order => order.id === attendance.productionOrderId
    && isUnfinishedProductionOrder(order) && order.status === 'In Production');
  if (selected) return selected;
  const sessionProductionOrderIds = new Set(
    transactions
      .filter(transaction => transactionBelongsToSession(transaction, attendance))
      .map(transaction => transaction.productionOrderId)
      .filter(Boolean)
  );
  return productionOrders.find(order =>
    isUnfinishedProductionOrder(order)
    && order.status === 'In Production'
    && sessionProductionOrderIds.has(order.id)
  ) || productionOrders.find(order =>
    isUnfinishedProductionOrder(order)
    && order.status === 'In Production'
    && (!order.assignedShift || order.assignedShift === attendance.shift)
  ) || null;
};

const durationInMinutes = (attendance: ShiftAttendance, clockOut: Date) => {
  const [hours, minutes] = attendance.clockIn.split(':').map(Number);
  const clockIn = new Date(`${attendance.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  return Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
};

const calculateMaterialUsage = (
  materialTransactions: MaterialUsageTransaction[],
  attendance: ShiftAttendance | undefined,
  productionOrder: ProductionOrder | undefined,
) => {
  const sessionMaterials = !attendance || !productionOrder
    ? []
    : materialTransactions.filter(transaction =>
        transaction.productionOrderId === productionOrder.id
        && transaction.attendanceSessionId === attendance.id
      );
  const pelletConsumption = sessionMaterials.filter(transaction => transaction.materialType !== 'COLORANT');
  const uniqueBags = Array.from(new Map(
    pelletConsumption.map(transaction => [transaction.barcode || transaction.physicalBagId || transaction.id, transaction])
  ).values());
  const virginBags = uniqueBags.filter(transaction => transaction.materialType === 'VIRGIN_PELLET').length;
  const recycledBags = uniqueBags.filter(transaction => transaction.materialType === 'RECYCLED_PELLET').length;
  const colorantTransactions = sessionMaterials.filter(transaction => transaction.materialType === 'COLORANT');
  const baseColorantTransactions = colorantTransactions.filter(transaction => (transaction.usageType || 'BASE_COLORANT') === 'BASE_COLORANT');
  const stripeColorantTransactions = colorantTransactions.filter(transaction => transaction.usageType === 'STRIPE_COLORANT');
  const colorantWeightKg = colorantTransactions.reduce((sum, transaction) => sum + transaction.quantity, 0);
  const totalPelletWeightKg = roundKg(pelletConsumption.reduce((sum, transaction) => sum + transaction.quantity, 0));
  return {
    virginBags,
    virginWeightKg: roundKg(pelletConsumption.filter(transaction => transaction.materialType === 'VIRGIN_PELLET').reduce((sum, transaction) => sum + transaction.quantity, 0)),
    recycledBags,
    recycledWeightKg: roundKg(pelletConsumption.filter(transaction => transaction.materialType === 'RECYCLED_PELLET').reduce((sum, transaction) => sum + transaction.quantity, 0)),
    colorantWeightKg,
    colorantNames: Array.from(new Set(colorantTransactions.map(transaction => transaction.materialName))),
    baseColorantWeightKg: baseColorantTransactions.reduce((sum, transaction) => sum + transaction.quantity, 0),
    baseColorantNames: Array.from(new Set(baseColorantTransactions.map(transaction => transaction.materialName))),
    stripeColorantWeightKg: stripeColorantTransactions.reduce((sum, transaction) => sum + transaction.quantity, 0),
    stripeColorantNames: Array.from(new Set(stripeColorantTransactions.map(transaction => transaction.materialName))),
    totalPelletWeightKg,
    totalMaterialWeightKg: totalPelletWeightKg + colorantWeightKg,
  };
};

export const formatProductionTime = (value?: string) => {
  if (!value) return '—';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${match[2]} ${suffix}`;
};

/** One existing physical receipt transition, shared by individual and atomic scanned-bag acceptance. */
export function applyPhysicalPelletReceipt(s: AppState, pelletId: string, scannerMeta?: PhysicalScanMeta, storageLocation?: string): AppState {
  // Plant Manager already receives transfers; Production already receives/scans bags.
  if (!s.currentUser || !['production', 'plantmanager'].includes(s.currentUser.role)) return s;
  if (!storageLocation || !activeLocationCodes(readStorageLocations()).includes(storageLocation as never)) return s;
  const pellet = s.pellets.find(item => item.id === pelletId);
  if (!pellet || !exactPhysicalScan(scannerMeta, pellet, s.pellets)) return s;
  if (pellet.inventoryStatus === 'Pending Receipt') {
    if (expectedPelletError(pellet, s.transfers, s.materialRequests)) return s;
  } else if (s.currentUser?.role !== 'production' || pellet.type !== 'Recycled' || pellet.availableKg !== 25 || pellet.originalKg !== 25 || pellet.locationStatus !== 'Awaiting Storage') return s;
  if (pellet && !['Pending Receipt', 'Available'].includes(pellet.inventoryStatus)) return s;
  if (!pellet || (pellet.currentLocation && !['Awaiting Receipt', 'Awaiting Storage'].includes(pellet.locationStatus))) return s;
  const transfer = s.transfers.find(item => item.refNo === pellet.transferRef && item.batchNo === pellet.batchNo && ['In Transit', 'Receiving Discrepancy'].includes(item.status));
  const destination = storageLocation;
  const action = pellet.inventoryStatus === 'Pending Receipt' ? 'Received' as const : 'Stored' as const;
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return {
    ...s,
    pellets: s.pellets.map(item => item.id === pelletId
      ? {
          ...item,
          availableKg: 25,
          inventoryStatus: 'Available' as const,
          currentLocation: destination,
          locationStatus: 'Stored' as const,
          receivedDate: pellet.inventoryStatus === 'Pending Receipt' ? date : item.receivedDate,
          receivedBy: pellet.inventoryStatus === 'Pending Receipt' ? s.currentUser!.name : item.receivedBy,
          receivedAt: pellet.inventoryStatus === 'Pending Receipt' ? now.toISOString() : item.receivedAt,
          storedBy: s.currentUser!.name,
          storedAt: now.toISOString(),
          lastScan: `${date} ${time}`,
          scannedBy: s.currentUser!.name,
          locationHistory: [...(item.locationHistory || []), {
            from: item.currentLocation || 'Not Yet Assigned',
            to: destination,
            action,
            employee: s.currentUser!.name,
            employeeId: s.currentUser!.employeeId,
            dateTime: now.toISOString(),
          }],
        }
      : item),
    transfers: transfer ? s.transfers.map(item => item.id === transfer.id
      ? {
          ...item,
          receivedQuantity: Math.min(item.sentQuantity || item.numberOfBags || 0, (item.receivedQuantity || 0) + 1),
          status: s.pellets.filter(bag => bag.transferRef === transfer.refNo && bag.batchNo === pellet.batchNo && bag.inventoryStatus === 'Pending Receipt').length <= 1 ? 'Received' as const : item.status,
          discrepancyQuantity: item.status === 'Receiving Discrepancy' ? Math.max(0, (item.sentQuantity ?? item.numberOfBags ?? 0) - (item.receivedQuantity || 0) - 1) : item.discrepancyQuantity,
          discrepancyReason: item.status === 'Receiving Discrepancy' && (item.receivedQuantity || 0) + 1 >= (item.sentQuantity ?? item.numberOfBags ?? 0) ? undefined : item.discrepancyReason,
          receivedBy: s.currentUser!.name,
          receivedDate: `${date} ${time}`,
        }
      : item) : s.transfers,
    transactions: [{
      id: `tx-pellet-${now.getTime()}-${pellet.id}`,
      txId: `TX-PELLET-${now.getTime()}-${pellet.id}`,
      date, time,
      employee: s.currentUser.name,
      employeeId: s.currentUser.employeeId,
      role: s.currentUser.role === 'plantmanager' ? 'Plant Manager' : 'Production',
      transactionType: pellet.inventoryStatus === 'Pending Receipt' ? 'Pellets Received' : 'Recycled Pellet Stored',
      materialCategory: pellet.type === 'Virgin' ? 'Virgin Pellet' : 'Recycled Pellet',
      item: `${pellet.type} Pellets ${pellet.grade}`,
      batch: pellet.batchNo,
      barcode: pellet.barcode,
      qtyBefore: pellet.availableKg,
      qtyChanged: pellet.inventoryStatus === 'Pending Receipt' ? 25 : 0,
      qtyAfter: 25,
      source: pellet.currentLocation || 'Not Yet Assigned',
      destination,
      reference: pellet.inventoryStatus === 'Pending Receipt' ? s.materialRequests.find(request => request.refNo === transfer?.requestRef)?.refNo || transfer!.refNo : pellet.rrRef || pellet.recyclingBatchRef || pellet.batchNo,
      status: 'Completed',
      shift: scannerMeta?.shift,
      scannerMode: scannerMeta?.scannerMode,
    }, ...s.transactions],
    auditLogs: [{
      id: `al-pellet-${now.getTime()}-${pellet.id}`,
      user: s.currentUser.name,
      employeeId: s.currentUser.employeeId,
      role: s.currentUser.role === 'plantmanager' ? 'Plant Manager' : 'Production',
      action: pellet.inventoryStatus === 'Pending Receipt' ? 'Pellet Received and Stored' : 'Recycled Pellet Stored',
      date, time,
      reference: pellet.barcode,
      previousValue: pellet.currentLocation || 'Not Yet Assigned',
      newValue: destination,
    }, ...s.auditLogs],
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => hydratePipeRelationships(migrateFinishedPipeBarcodes(restoreAppState())));
  const stateRef = useRef(state);
  stateRef.current = state;
  const printTickets = useRef(new Map<string, { keys: string[]; approvalId?: string; employeeId: string; release?: () => void }>());
  const refreshPrintState = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(APP_STATE_STORAGE_KEY) || 'null');
      if (stored?.printMetadata && Array.isArray(stored.reprintRequests)) {
        stateRef.current = { ...stateRef.current, printMetadata: stored.printMetadata, reprintRequests: stored.reprintRequests, notifications: stored.notifications || stateRef.current.notifications, auditLogs: stored.auditLogs || stateRef.current.auditLogs };
      }
    } catch { /* Keep the current state when storage is unavailable. */ }
    return stateRef.current;
  };
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== APP_STATE_STORAGE_KEY) return;
      const refreshed = refreshPrintState();
      setState(previous => ({ ...previous, printMetadata: refreshed.printMetadata, reprintRequests: refreshed.reprintRequests, notifications: refreshed.notifications, auditLogs: refreshed.auditLogs }));
    };
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('storage', sync); printTickets.current.forEach(ticket => ticket.release?.()); printTickets.current.clear(); };
  }, []);
  const [selectedReprintRequestId, selectReprintRequest] = useState<string | null>(null);
  const openReprintRequest = (id: string | null) => {
    const request = stateRef.current.reprintRequests.find(item => item.id === id);
    selectReprintRequest(id && request && canViewRequest(stateRef.current.currentUser, request) ? id : null);
  };
  const savePrintEvent = (workflow: PrintWorkflowState, action: string, record: PrintableRecord, request?: PrintWorkflowState['reprintRequests'][number]) => {
    const current = stateRef.current;
    const user = current.currentUser!;
    const datetime = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const notifications: Notification[] = request && action === 'Reprint Requested'
      ? [{ id: `reprint-${eventId}`, title: 'Reprint Approval Requested', description: `${record.reference} · Requested by ${user.name} · ${request.reason}`, datetime, priority: 'Action Required', read: false, roles: ['management'], reference: record.reference, reprintRequestId: request.id }]
      : request && ['Reprint Approved', 'Reprint Rejected'].includes(action)
        ? [{ id: `reprint-${eventId}`, title: action === 'Reprint Approved' ? 'Reprint Approved' : 'Reprint Request Rejected', description: action === 'Reprint Approved' ? `${record.reference} · Management approved one Reprint.` : `${record.reference} · ${request.rejectionReason}`, datetime, priority: 'Information', read: false, roles: [request.requesterRole], recipientEmployeeId: request.requestedBy, reference: record.reference, reprintRequestId: request.id }]
        : [];
    const localDate = new Date();
    const audit: AuditLog = { id: `print-${eventId}`, date: `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`, time: localDate.toLocaleTimeString('en-GB', { hour12: false }), user: user.name, employeeId: user.employeeId, role: printAuditRole(user.role), action, reference: record.reference, newValue: `${record.key}${request ? ` · ${request.id} · ${request.reason}${request.rejectionReason ? ` · Rejected: ${request.rejectionReason}` : ''}` : ''}` };
    const updated = { ...current, ...workflow, notifications: [...notifications, ...current.notifications], auditLogs: [audit, ...current.auditLogs] };
    stateRef.current = updated;
    setState(previous => ({ ...previous, ...workflow, notifications: [...notifications, ...previous.notifications], auditLogs: [audit, ...previous.auditLogs] }));
    // Persist administrative changes synchronously: refresh cannot lose a consumed approval.
    try { window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(updated)); } catch { /* In-memory workflow remains usable. */ }
  };
  const submitReprintRequest = (key: string, reason: string) => {
    const current = refreshPrintState();
    const record = printableRecords(current).find(item => item.key === key);
    if (!record) return { success: false, error: 'Printable record not found.' };
    if ([...printTickets.current.values()].some(ticket => ticket.keys.includes(key))) return { success: false, error: 'Finish or cancel the current print first.' };
    const result = requestReprint(current, current.currentUser, record, reason, new Date().toISOString(), `RP-${crypto.randomUUID()}`);
    if (result.success) savePrintEvent(result.state, 'Reprint Requested', record, result.request);
    return result.success ? { success: true } : result;
  };
  const decideReprintRequest = (id: string, decision: 'APPROVED' | 'REJECTED', reason = '') => {
    const current = refreshPrintState();
    const result = reviewReprint(current, current.currentUser, id, decision, reason, new Date().toISOString());
    if (result.success) savePrintEvent(result.state, decision === 'APPROVED' ? 'Reprint Approved' : 'Reprint Rejected', result.request!.printable, result.request);
    return result.success ? { success: true } : result;
  };
  const reservePrint = (keys: string[], approvalId?: string, release?: () => void) => {
    const current = refreshPrintState();
    if (!keys.length || new Set(keys).size !== keys.length || (approvalId && keys.length !== 1)) return { success: false, error: 'Invalid print selection.' };
    const records = printableRecords(current);
    for (const key of keys) {
      const record = records.find(item => item.key === key);
      if (!record) return { success: false, error: 'Printable record not found.' };
      if ([...printTickets.current.values()].some(ticket => ticket.keys.includes(key))) return { success: false, error: 'This record is already being printed.' };
      const error = validatePrint(current, current.currentUser, record, approvalId);
      if (error) return { success: false, error };
    }
    const ticket = crypto.randomUUID();
    printTickets.current.set(ticket, { keys, approvalId, employeeId: current.currentUser!.employeeId, release });
    return { success: true, ticket };
  };
  const beginPrint = async (keys: string[], approvalId?: string) => {
    // A browser-native origin lock prevents two tabs from opening the same approved print.
    // The lock is released on completion, cancellation, unmount, or browser refresh.
    if (typeof navigator === 'undefined' || !navigator.locks) return reservePrint(keys, approvalId);
    return new Promise<{ success: boolean; error?: string; ticket?: string }>(resolve => {
      navigator.locks.request('hpai:print-session-v1', { ifAvailable: true }, async lock => {
        if (!lock) { resolve({ success: false, error: 'Another HPAI print session is open. Finish or cancel it first.' }); return; }
        let release!: () => void;
        const done = new Promise<void>(complete => { release = complete; });
        const result = reservePrint(keys, approvalId, release);
        resolve(result);
        if (result.success) await done;
      }).catch(() => resolve({ success: false, error: 'Print session lock could not be acquired.' }));
    });
  };
  const finishPrint = (id: string, successful: boolean) => {
    const ticket = printTickets.current.get(id);
    if (!ticket) return { success: false, error: 'Print session already completed or cancelled.' };
    printTickets.current.delete(id);
    ticket.release?.();
    if (!successful) return { success: true };
    const current = refreshPrintState();
    if (ticket.employeeId !== current.currentUser?.employeeId) return { success: false, error: 'Print session belongs to another user.' };
    const records = printableRecords(current);
    // Validate the entire batch before recording any print event.
    for (const key of ticket.keys) {
      const record = records.find(item => item.key === key);
      const error = record ? validatePrint(current, current.currentUser, record, ticket.approvalId) : 'Printable record not found.';
      if (error) return { success: false, error };
    }
    for (const key of ticket.keys) {
      const record = records.find(item => item.key === key)!;
      const result = completePrint(stateRef.current, current.currentUser, record, new Date().toISOString(), ticket.approvalId);
      if (result.success) savePrintEvent(result.state, ticket.approvalId ? `${record.kind} Reprinted` : 'Initial Print', record, result.request);
    }
    return { success: true };
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Keep the application usable when persistent browser storage is unavailable.
    }
  }, [state]);

  useEffect(() => { setState(current => hydratePipeRelationships(migrateFinishedPipeBarcodes(current))); }, []);

  const setTheme = useCallback((t: Theme) => {
    setState(s => ({ ...s, theme: t }));
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);

  const login = useCallback((username: string, password: string) => {
    const user = USERS.find(u => u.username === username);
    if (!user) return { success: false, error: 'Invalid username or password.' };
    if (user.password !== password) return { success: false, error: 'Invalid username or password.' };
    if (user.status === 'inactive') return { success: false, error: 'This account has been deactivated. Contact your administrator.' };

    const defaultPage = {
      OWNER_SUPER_ADMIN: 'owner-dashboard',
      accounting: 'accounting-dashboard',
      marketing: 'marketing-dashboard',
      management: 'management-dashboard',
      plantmanager: 'pm-dashboard',
      production: 'shift-attendance',
    }[user.role];

    setState(s => ({
      ...s,
      currentUser: user,
      currentPage: defaultPage,
    }));
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setState(s => ({ ...s, currentUser: null, currentPage: 'login', clockedIn: false, clockInTime: '' }));
  }, []);

  const navigate = useCallback((page: string) => {
    setState(s => ({ ...s, currentPage: page }));
  }, []);

  const clockIn = useCallback((employeeName: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    const shift: 'Day' | 'Night' = now.getHours() >= 6 && now.getHours() < 18 ? 'Day' : 'Night';
    let result: { success: boolean; error?: string } = { success: false, error: 'Clock In could not be saved.' };
    setState(s => {
      if (!s.currentUser || s.currentUser.role !== 'production') {
        result = { success: false, error: 'A valid authenticated Production employee is required.' };
        return s;
      }
      const normalizedName = employeeName.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
      const employee = s.employees.find(record =>
        `${record.firstName} ${record.lastName}`.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName
        && record.role === 'production'
        && record.status === 'Active'
      );
      if (!employee) {
        result = { success: false, error: 'EMPLOYEE NOT FOUND' };
        return s;
      }
      if (employee.employeeId !== s.currentUser.employeeId || employee.username !== s.currentUser.username) {
        result = { success: false, error: 'EMPLOYEE MISMATCH' };
        return s;
      }
      if (employee.defaultShift !== 'Day' && employee.defaultShift !== 'Night') {
        result = { success: false, error: 'SHIFT NOT ASSIGNED\nManagement must assign a Day Shift or Night Shift before Clock In.' };
        return s;
      }
      if (employee.defaultShift !== shift) {
        result = {
          success: false,
          error: `SHIFT NOT YET ACTIVE\nYour assigned ${employee.defaultShift} Shift begins at ${employee.defaultShift === 'Day' ? '6:00 AM' : '6:00 PM'}.\nThe current active shift is ${shift} Shift.`,
        };
        return s;
      }
      if (s.clockedIn) {
        result = { success: false, error: 'This employee is already clocked in.' };
        return s;
      }
      const existingActive = s.attendance.find(a => a.employeeId === s.currentUser?.employeeId && a.status === 'Active');
      if (existingActive) {
        const pending = findPendingTurnover(s.turnovers, s.productionOrders, existingActive.shift, s.currentUser.employeeId);
        result = { success: true };
        return {
          ...s,
          pendingTurnover: pending,
          clockedIn: true,
          clockInTime: existingActive.clockIn,
          currentShift: existingActive.shift,
          currentPage: pending ? 'prod-turnover' : 'production-dashboard',
        };
      }
      const attendanceRecord: ShiftAttendance = {
        id: `att${Date.now()}`,
        employeeId: s.currentUser.employeeId,
        employeeName: s.currentUser.name,
        shift,
        date: dateStr,
        clockIn: timeStr,
        status: 'Active',
      };
      const pending = findPendingTurnover(s.turnovers, s.productionOrders, shift, s.currentUser.employeeId);
      result = { success: true };
      return {
        ...s,
        attendance: [attendanceRecord, ...s.attendance],
        auditLogs: [{
          id: `al-clockin-${now.getTime()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Production',
          action: 'Clock In',
          date: attendanceRecord.date,
          time: timeStr,
          reference: attendanceRecord.id,
          newValue: `${shift} Shift`,
        }, ...s.auditLogs],
        pendingTurnover: pending,
        clockedIn: true,
        clockInTime: timeStr,
        currentShift: shift,
        currentPage: pending ? 'prod-turnover' : 'production-dashboard',
      };
    });
    return result;
  }, []);

  const clockOut = useCallback(() => {
    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    setState(s => {
      const attendanceRecord = s.attendance.find(record =>
        record.employeeId === s.currentUser?.employeeId && record.status === 'Active'
      );
      if (!attendanceRecord || !s.currentUser) return s;
      const unfinishedProductionOrder = findSessionProductionOrder(s.productionOrders, s.transactions, attendanceRecord);
      const completedTurnover = unfinishedProductionOrder && s.turnovers.some(turnover =>
        turnover.attendanceSessionId === attendanceRecord.id
        && turnover.productionOrderId === unfinishedProductionOrder.id
      );
      if (unfinishedProductionOrder && !completedTurnover) return s;
      return {
        ...s,
        attendance: s.attendance.map(record =>
          record.id === attendanceRecord.id
            ? { ...record, clockOut: time, durationMinutes: durationInMinutes(record, now), status: 'Completed' as const }
            : record
        ),
        auditLogs: [{
          id: `al-clockout-${now.getTime()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Production',
          action: completedTurnover
            ? 'Clock Out — Shift Turnover Already Completed'
            : 'Clock Out — No Active Production Order',
          date: now.toISOString().slice(0, 10),
          time,
          reference: attendanceRecord.id,
        }, ...s.auditLogs],
        clockedIn: false,
        clockInTime: '',
        currentUser: null,
        currentPage: 'login',
      };
    });
  }, []);

  const markNotificationsRead = useCallback(() => {
    setState(s => ({
      ...s,
      notifications: s.notifications.map(n =>
        s.currentUser && (s.currentUser.role === 'OWNER_SUPER_ADMIN' || n.roles.includes(s.currentUser.role))
          ? { ...n, read: true }
          : n
      )
    }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setState(s => ({
      ...s,
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    }));
  }, []);

  const approveMaterialRequest = useCallback((id: string) => {
    setState(s => ({
      ...s,
      materialRequests: s.materialRequests.map(r =>
        r.id === id && ['New', 'Pending'].includes(r.status) && s.currentUser?.role === 'accounting' ? { ...r, status: 'Approved' as const, approvedBy: s.currentUser?.name, approvedDate: new Date().toISOString().slice(0,10) } : r
      ),
    }));
  }, []);

  const rejectMaterialRequest = useCallback((id: string) => {
    setState(s => ({
      ...s,
      materialRequests: s.materialRequests.map(r =>
        r.id === id && ['New', 'Pending'].includes(r.status) && s.currentUser?.role === 'accounting' ? { ...r, status: 'Rejected' as const, approvedBy: s.currentUser?.name, approvedDate: new Date().toISOString().slice(0,10) } : r
      ),
    }));
  }, []);

  const acceptTurnover = useCallback(() => {
    setState(s => {
      const activeSession = s.attendance.find(record =>
        record.employeeId === s.currentUser?.employeeId && record.status === 'Active'
      );
      if (!s.pendingTurnover || s.pendingTurnover.status !== 'Pending' || !s.currentUser || !activeSession
        || s.pendingTurnover.incomingShift !== s.currentShift) return s;
      const now = new Date();
      const productionOrder = s.productionOrders.find(po =>
        po.id === s.pendingTurnover?.productionOrderId || po.poNo === s.pendingTurnover?.poRef
      );
      if (!productionOrder || !isUnfinishedProductionOrder(productionOrder)) {
        return { ...s, pendingTurnover: null };
      }
      return {
        ...s,
        pendingTurnover: null,
        turnovers: s.turnovers.map(t => t.id === s.pendingTurnover?.id ? {
          ...t,
          status: 'Accepted' as const,
          acceptedBy: s.currentUser?.name,
          acceptedByEmployeeId: s.currentUser?.employeeId,
          acceptedIncomingShift: s.currentShift,
          acceptedAttendanceSessionId: activeSession.id,
          acceptedProductionOrderId: productionOrder?.id,
          acceptedTime: now.toTimeString().slice(0, 5),
          acceptedAt: now.toISOString(),
        } : t),
        productionOrders: s.productionOrders.map(po => po.poNo === s.pendingTurnover?.poRef ? { ...po, status: 'In Production' as const, assignedShift: s.currentShift } : po),
        auditLogs: [{
          id: `al-turnover-accepted-${now.getTime()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Production',
          action: 'Shift Turnover Accepted',
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5),
          reference: s.pendingTurnover.turnoverNo,
          newValue: `${s.pendingTurnover.outgoingShift} Shift → ${s.currentShift} Shift · ${s.pendingTurnover.poRef} · Session ${activeSession.id}`,
        }, ...s.auditLogs],
      };
    });
  }, []);

  const addEmployee = useCallback((emp: Omit<Employee, 'id'>) => {
    const newEmp: Employee = { ...emp, id: `e${Date.now()}` };
    setState(s => {
      const now = new Date();
      return {
        ...s,
        employees: [...s.employees, newEmp],
        auditLogs: [{
          id: `al${Date.now()}`, user: s.currentUser?.name || 'System', employeeId: s.currentUser?.employeeId || 'SYSTEM',
          role: s.currentUser?.role === 'OWNER_SUPER_ADMIN' ? 'Owner / Super Admin' : 'Management',
          action: 'Employee Account Created', date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5),
          reference: newEmp.employeeId, previousValue: 'Not existing', newValue: `${newEmp.status} · ${newEmp.role}`,
        }, ...s.auditLogs],
      };
    });
  }, []);

  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    setState(s => {
      const employee = s.employees.find(item => item.id === id);
      if (!employee) return s;
      const now = new Date();
      return {
        ...s,
        employees: s.employees.map(item => item.id === id ? { ...item, ...updates } : item),
        auditLogs: [{
          id: `al${Date.now()}`, user: s.currentUser?.name || 'System', employeeId: s.currentUser?.employeeId || 'SYSTEM',
          role: s.currentUser?.role === 'OWNER_SUPER_ADMIN' ? 'Owner / Super Admin' : 'Management',
          action: 'Employee Access Updated', date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5),
          reference: employee.employeeId, previousValue: JSON.stringify({ role: employee.role, status: employee.status }),
          newValue: JSON.stringify({ role: updates.role || employee.role, status: updates.status || employee.status }),
        }, ...s.auditLogs],
      };
    });
  }, []);

  const assignEmployeeShift = useCallback((id: string, shift: 'Day' | 'Night') => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Shift assignment could not be saved.' };
    setState(s => {
      if (s.currentUser?.role !== 'management') {
        result = { success: false, error: 'Only Management may change Production shift assignments.' };
        return s;
      }
      const employee = s.employees.find(item => item.id === id);
      if (!employee || employee.role !== 'production' || employee.status !== 'Active') {
        result = { success: false, error: 'Select an active Production employee.' };
        return s;
      }
      if (employee.defaultShift === shift) {
        result = { success: false, error: `${employee.firstName} ${employee.lastName} is already assigned to ${shift} Shift.` };
        return s;
      }
      const now = new Date();
      result = { success: true };
      return {
        ...s,
        employees: s.employees.map(item => item.id === id ? { ...item, defaultShift: shift } : item),
        auditLogs: [{
          id: `al-shift-${now.getTime()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Management',
          action: 'Employee Shift Changed',
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5),
          reference: employee.employeeId,
          previousValue: `${employee.firstName} ${employee.lastName} · ${employee.defaultShift} Shift`,
          newValue: `${employee.firstName} ${employee.lastName} · ${shift} Shift`,
        }, ...s.auditLogs],
      };
    });
    return result;
  }, []);

  const addCustomer = useCallback((customer: Omit<Customer, 'id'>) => {
    setState(s => ({
      ...s,
      customers: [...s.customers, { ...customer, id: `c${Date.now()}` }],
    }));
  }, []);

  const createCustomerOrder = useCallback((data: Omit<CustomerOrder, 'id' | 'orderNo' | 'orderDate' | 'status' | 'moRef' | 'availableStock' | 'reservedQuantity' | 'releasedQuantity'>) => {
    let result: { success: boolean; orderNo?: string; moNo?: string; reserved: number; shortage: number; error?: string } = {
      success: false, reserved: 0, shortage: 0, error: 'Customer Order could not be created.',
    };
    setState(s => {
      if (s.currentUser?.role !== 'marketing' || !Number.isInteger(data.quantity) || data.quantity < 1) return s;
      const customer = s.customers.find(item => item.id === data.customerId);
      if (!customer) {
        result.error = 'Select a valid customer.';
        return s;
      }
      const grade = normalizeMaterialGrade(data.grade);
      if (!isActiveMaterialGrade(grade)) {
        result.error = 'INVALID PELLET GRADE — Select a supported material grade.';
        return s;
      }
      const eligible = s.finishedGoods.filter(item =>
        finishedPipeInventory(item, s).available === 1
        && item.qualityStatus === 'Pass'
        && item.locationStatus === 'Stored'
        && item.releaseStatus !== 'Released'
        && item.status === 'Available'
        && item.availableQty === 1
        && item.product === data.product
        && item.diameter === data.diameter
        && item.length === data.length
        && item.sdr === data.sdr
        && normalizeMaterialGrade(item.grade) === grade
        && item.color === data.color
        && item.stripe === data.stripe
        && item.construction === data.construction
        && item.productForm === data.productForm
      );
      const reserved = Math.min(data.quantity, eligible.length);
      const shortage = data.quantity - reserved;
      const now = new Date();
      const year = now.getFullYear();
      const nextOrder = Math.max(0, ...s.orders
        .filter(item => item.orderNo.startsWith(`SO-${year}-`))
        .map(item => Number(item.orderNo.split('-').pop()) || 0)) + 1;
      const orderNo = `SO-${year}-${String(nextOrder).padStart(4, '0')}`;
      const nextMo = Math.max(0, ...s.manufacturingOrders
        .filter(item => item.moNo.startsWith(`MO-${year}-`))
        .map(item => Number(item.moNo.split('-').pop()) || 0)) + 1;
      const moNo = shortage > 0 ? `MO-${year}-${String(nextMo).padStart(4, '0')}` : undefined;
      const fulfillmentType = shortage === 0 ? 'From Inventory' : reserved > 0 ? 'Mixed Fulfillment' : 'Made to Order';
      const order: CustomerOrder = {
        ...data,
        id: `so-${now.getTime()}`,
        orderNo,
        orderDate: now.toISOString().slice(0, 10),
        customerName: customer.name,
        grade,
        status: shortage > 0 ? 'In Production' : 'Active',
        moRef: moNo,
        availableStock: Math.max(0, eligible.length - reserved),
        reservedQuantity: reserved,
        releasedQuantity: 0,
        matchedInventoryQuantity: reserved,
        manufacturingRequiredQuantity: shortage,
        manufacturedQuantity: 0,
        fulfillmentType,
      };
      const reservedIds = new Set(eligible.slice(0, reserved).map(item => item.id));
      const reservationTransactions: Transaction[] = eligible.slice(0, reserved).map((item, index) => ({
        id: `tx-order-reserve-${now.getTime()}-${index}`,
        txId: `TX-RES-${now.getTime()}-${index}`,
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 5),
        employee: s.currentUser!.name,
        employeeId: s.currentUser!.employeeId,
        role: 'Marketing',
        transactionType: 'Finished Pipe Reserved',
        materialCategory: 'Finished Pipe',
        productType: item.product,
        item: `${item.product} ${item.diameter}`,
        batch: item.batch,
        barcode: item.barcode,
        qtyBefore: 1,
        qtyChanged: 0,
        qtyAfter: 1,
        source: item.currentLocation,
        destination: `Reserved for ${orderNo}`,
        reference: orderNo,
        status: 'Completed',
      }));
      const mo: ManufacturingOrder | undefined = moNo ? {
        id: `mo-${now.getTime()}`,
        moNo,
        orderRef: orderNo,
        product: data.product,
        diameter: data.diameter,
        length: data.length,
        sdr: data.sdr,
        grade,
        color: data.color,
        stripe: data.stripe,
        construction: data.construction,
        productForm: data.productForm,
        requestedQty: data.quantity,
        availableQty: reserved,
        toManufactureQty: shortage,
        requiredDate: data.requiredDate,
        createdBy: s.currentUser.name,
        createdDate: now.toISOString().slice(0, 10),
        status: 'New',
      } : undefined;
      result = { success: true, orderNo, moNo, reserved, shortage };
      return {
        ...s,
        orders: [order, ...s.orders],
        manufacturingOrders: mo ? [mo, ...s.manufacturingOrders] : s.manufacturingOrders,
        transactions: [...reservationTransactions, ...s.transactions],
        finishedGoods: s.finishedGoods.map(item => reservedIds.has(item.id) ? {
          ...item,
          availableQty: 0,
          reservedQty: 1,
          status: 'Reserved' as const,
          inventoryPurpose: 'General Inventory' as const,
          reservationStatus: 'Reserved' as const,
          reservedForOrderId: order.id,
          reservedForOrderRef: order.orderNo,
          orderReference: order.orderNo,
          buyer: order.customerName,
        } : item),
        auditLogs: [{
          id: `al-order-${now.getTime()}`, user: s.currentUser.name, employeeId: s.currentUser.employeeId,
          role: 'Marketing', action: mo ? 'Customer Order Created — Inventory Reserved and Shortage MO Created' : 'Customer Order Created — Fulfilled From Inventory',
          date: order.orderDate, time: now.toTimeString().slice(0, 5), reference: orderNo,
          previousValue: `${eligible.length} matching available`, newValue: `${reserved} reserved; ${shortage} to manufacture`,
        }, ...s.auditLogs],
      };
    });
    return result;
  }, []);

  const createReceivingReport = useCallback((data: {
    storageLocation: string;
    pelletType: 'Virgin' | 'Recycled';
    grade: string;
    color: string;
    numberOfBags: number;
    supplier: string;
    referenceNo: string;
    destination: string;
    remarks?: string;
  }) => {
    setState(s => {
      const numberOfBags = Math.max(0, Math.floor(data.numberOfBags));
      if (!activeLocationCodes(readStorageLocations()).includes(data.storageLocation as never)) return s;
      if (!numberOfBags || !isActiveMaterialGrade(normalizeMaterialGrade(data.grade))) return s;
      const color = newPelletColor(data.pelletType, data.color);
      if (!color) return s;
      const year = String(new Date().getFullYear());
      const currentYearNumbers = s.rrRecords
        .filter(item => item.rrNumber.startsWith(`RR-${year}-`))
        .map(item => Number(item.rrNumber.split('-').pop()) || 0);
      const next = Math.max(0, ...currentYearNumbers) + 1;
      const serial = String(next).padStart(4, '0');
      const rrNumber = `RR-${year}-${serial}`;
      const batchNo = `${data.pelletType === 'Virgin' ? 'VP' : 'RP'}-${year}-${serial}`;
      const today = new Date().toISOString().slice(0, 10);
      const rr: RRRecord = {
        id: `rr-${year}-${serial}`,
        rrNumber,
        date: today,
        material: 'HDPE Pellets',
        pelletType: data.pelletType,
        grade: normalizeMaterialGrade(data.grade),
        color,
        batchNo,
        numberOfBags,
        weightPerBagKg: 25,
        weightKg: numberOfBags * 25,
        supplier: data.supplier,
        referenceNo: data.referenceNo,
        destination: data.destination,
        receivingLocation: data.storageLocation,
        status: 'Completed',
        remarks: data.remarks,
      };
      const bags = makePermanentPelletBags(numberOfBags, {
        type: data.pelletType,
        batchNo,
        grade: normalizeMaterialGrade(data.grade),
        color: data.color,
        receivedDate: today,
        rrRef: rrNumber,
      }, s.barcodeRegistry, s.pellets, { available: true, storageLocation: data.storageLocation });
      return {
        ...s,
        rrRecords: [rr, ...s.rrRecords],
        pellets: [...bags, ...s.pellets],
        barcodeRegistry: [...registryEntriesForPellets(bags), ...s.barcodeRegistry],
        transactions: [...bags.map((bag, index) => ({ id: `tx-rr-${rr.id}-${index}`, txId: `TX-${rrNumber}-${index}`, date: today, time: new Date().toTimeString().slice(0, 5), employee: s.currentUser?.name || '', employeeId: s.currentUser?.employeeId || '', role: s.currentUser?.role || 'accounting', transactionType: 'Pellets Received', materialCategory: bag.type === 'Virgin' ? 'Virgin Pellet' as const : 'Recycled Pellet' as const, item: `${bag.type} Pellets ${bag.grade}`, batch: bag.batchNo, barcode: bag.barcode, qtyBefore: 0, qtyChanged: 25, qtyAfter: 25, source: data.supplier, destination: data.storageLocation, reference: rrNumber, status: 'Received' })), ...s.transactions],
      };
    });
  }, []);

  const ensureExpectedPelletBags = useCallback((requestId: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Only Plant Manager can prepare approved incoming bag labels.' };
    flushSync(() => setState(s => {
      if (s.currentUser?.role !== 'plantmanager') return s;
      const plan = expectedPelletPlan(s, requestId);
      if (plan.error || !plan.request) { result.error = plan.error; return s; }
      const request = plan.request;
      if (plan.bags.some(bag => s.barcodeRegistry.some(record => normalizeBarcodeValue(record.barcode) === normalizeBarcodeValue(bag.barcode) && record.itemId !== bag.id))) {
        result.error = 'An existing barcode registry entry belongs to another item. No records were overwritten.'; return s;
      }
      if (plan.missing && (!isSupportedMaterialGrade(request.grade) || newPelletColor(request.pelletType, request.color) !== request.color)) {
        result.error = 'Valid pellet grade and color are required before adding missing labels.'; return s;
      }
      const added = plan.missing ? makePermanentPelletBags(plan.missing, {
        type: request.pelletType, batchNo: plan.batchNo, grade: request.grade,
        color: newPelletColor(request.pelletType, request.color)!, receivedDate: '—',
        materialRequestRef: request.refNo, transferRef: plan.transfer?.refNo,
      }, s.barcodeRegistry, s.pellets, { available: false }) : [];
      const missingRegistry = plan.bags.filter(bag => !s.barcodeRegistry.some(record => normalizeBarcodeValue(record.barcode) === normalizeBarcodeValue(bag.barcode)));
      result = { success: true };
      if (!added.length && !missingRegistry.length) return s;
      return { ...s, pellets: [...added, ...s.pellets], barcodeRegistry: [...registryEntriesForPellets([...added, ...missingRegistry]), ...s.barcodeRegistry] };
    }));
    return result;
  }, []);

  const createTransfer = useCallback((requestId: string) => {
    let transferNo: string | null = null;
    setState(s => {
      const request = s.materialRequests.find(item => item.id === requestId);
      if (!request || request.status !== 'Approved' || s.currentUser?.role !== 'accounting') return s;
      const existing = s.transfers.find(item => item.requestRef === request.refNo);
      if (existing) {
        transferNo = existing.refNo;
        return s;
      }
      const year = new Date().getFullYear();
      const next = Math.max(0, ...s.transfers
        .filter(item => item.refNo.startsWith(`MT-${year}-`))
        .map(item => Number(item.refNo.split('-').pop()) || 0)) + 1;
      transferNo = `MT-${year}-${String(next).padStart(4, '0')}`;
      const category = requestCategory(request);
      const isColorant = category === 'Colorant';
      const prepared = isColorant ? undefined : expectedPelletPlan(s, request.id);
      if (prepared?.error || prepared?.bags.some(bag => bag.transferRef || bag.inventoryStatus !== 'Pending Receipt' || bag.availableKg !== 0)) { transferNo = null; return s; }
      if (!isColorant && request.pelletType !== (category === 'Virgin Pellet' ? 'Virgin' : 'Recycled')) { transferNo = null; return s; }
      const color = isColorant ? request.color : newPelletColor(request.pelletType, request.color);
      if (!color) { transferNo = null; return s; }
      if (!isColorant && !isSupportedMaterialGrade(request.grade)) return s;
      const numberOfBags = isColorant ? undefined : Math.floor(request.requestedKg / 25);
      if (!isColorant && (!numberOfBags || numberOfBags < 1 || request.requestedKg !== numberOfBags * 25 || (request.requestedBags !== undefined && request.requestedBags !== numberOfBags))) return s;
      const batchNo = prepared?.bags.length ? prepared.batchNo : isColorant ? `COL-${year}-${String(next).padStart(4, '0')}` : `${category === 'Recycled Pellet' ? 'RPE' : 'VPE'}-${year}-${String(next).padStart(4, '0')}`;
      const colorant = isColorant
        ? s.colorants.find(item => item.usageType === request.colorantUsageType && (item.name === request.color || item.color === request.color.replace(/\s+\([A-Z]+\)$/, '')))
        : undefined;
      const transfer: Transfer = {
        id: `t${Date.now()}`,
        refNo: transferNo,
        date: new Date().toISOString().slice(0, 10),
        materialCategory: category,
        pelletType: request.pelletType,
        grade: normalizeMaterialGrade(request.grade),
        color,
        colorantUsageType: request.colorantUsageType,
        colorantId: colorant?.id,
        batchNo,
        numberOfBags,
        weightKg: isColorant ? request.requestedKg : (numberOfBags || 0) * 25,
        sentQuantity: isColorant ? request.requestedKg : numberOfBags,
        source: 'Main Plant',
        destination: 'Branch Plant',
        status: 'Preparing',
        requestRef: request.refNo,
      };
      const bags = isColorant || prepared?.missing === 0 ? [] : makePermanentPelletBags(prepared?.missing ?? numberOfBags ?? 0, {
        type: request.pelletType, batchNo, grade: normalizeMaterialGrade(request.grade), color,
        receivedDate: '—', transferRef: transfer.refNo, materialRequestRef: request.refNo,
      }, s.barcodeRegistry, s.pellets, { available: false });
      return {
        ...s,
        transfers: [transfer, ...s.transfers],
        pellets: [...bags, ...s.pellets.map(bag => prepared?.bags.includes(bag) && !bag.transferRef ? { ...bag, transferRef: transfer.refNo } : bag)],
        barcodeRegistry: [...registryEntriesForPellets(bags), ...s.barcodeRegistry],
      };
    });
    return transferNo;
  }, []);

  const dispatchTransfer = useCallback((transferId: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Only Accounting can dispatch a Preparing transfer.' };
    flushSync(() => setState(s => {
      const transfer = s.transfers.find(item => item.id === transferId);
      if (s.currentUser?.role !== 'accounting' || !transfer || !['Preparing', 'In Transit'].includes(transfer.status)) return s;
      result = { success: true };
      if (transfer.status === 'In Transit') return s;
      const now = new Date();
      return { ...s, transfers: s.transfers.map(item => item.id === transferId ? { ...item, status: 'In Transit' as const } : item),
        auditLogs: [{ id: `al-dispatch-${now.getTime()}`, user: s.currentUser.name, employeeId: s.currentUser.employeeId, role: 'Accounting', action: 'Material Transfer Dispatched', date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5), reference: transfer.refNo }, ...s.auditLogs] };
    }));
    return result;
  }, []);

  const finishWipBag = useCallback((pelletId: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Only zero-balance WIP can be marked Finished.' };
    flushSync(() => setState(s => {
      if (s.currentUser?.role !== 'production' || !s.attendance.some(item => item.employeeId === s.currentUser?.employeeId && item.status === 'Active')) {
        result.error = 'An active Production shift is required.'; return s;
      }
      const bag = s.pellets.find(item => item.id === pelletId);
      if (bag?.inventoryStatus === 'Fully Consumed' && bag.availableKg === 0) { result = { success: true }; return s; }
      if (!bag || !canFinishWip(bag)) return s;
      const now = new Date(); result = { success: true };
      return { ...s, pellets: s.pellets.map(item => item.id === pelletId ? {
        ...item, inventoryStatus: 'Fully Consumed' as const, currentLocation: 'Fully Consumed Pellet History', locationStatus: 'Released' as const,
        fullyConsumedAt: item.fullyConsumedAt || now.toISOString(),
        locationHistory: [...(item.locationHistory || []), { from: item.currentLocation, to: 'Fully Consumed Pellet History', action: 'Released' as const, employee: s.currentUser!.name, employeeId: s.currentUser!.employeeId, dateTime: now.toISOString(), reason: 'Zero-balance WIP marked Finished' }],
      } : item), auditLogs: [{ id: `al-wip-finished-${now.getTime()}`, user: s.currentUser.name, employeeId: s.currentUser.employeeId, role: 'Production', action: 'Zero-balance WIP marked Finished', date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5), reference: bag.barcode }, ...s.auditLogs] };
    }));
    return result;
  }, []);

  const updatePO = useCallback((id: string, updates: Partial<ProductionOrder>) => {
    setState(s => ({
      ...s,
      productionOrders: s.productionOrders.map(po => po.id === id ? { ...po, ...updates } : po),
    }));
  }, []);

  const startProduction = useCallback((poId: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Production could not be started.' };
    flushSync(() => setState(s => {
      const attendanceRecord = s.attendance.find(record => record.employeeId === s.currentUser?.employeeId && record.status === 'Active');
      const po = s.productionOrders.find(item => item.id === poId);
      if (s.currentUser?.role !== 'production' || !attendanceRecord) {
        result = { success: false, error: 'Clock in to an active Production shift before starting production.' };
        return s;
      }
      if (!po || !canRecordProduction(po)) {
        result = { success: false, error: 'This Production Order is not available to start or continue.' };
        return s;
      }
      if ((po.assignedShift && po.assignedShift !== attendanceRecord.shift)
        || findPendingTurnover(s.turnovers, s.productionOrders, attendanceRecord.shift, s.currentUser.employeeId)) {
        result = { success: false, error: 'Review the assigned shift and accept any pending shift turnover before starting production.' };
        return s;
      }
      const otherSessionWork = s.transactions.some(transaction => transaction.productionOrderId
        && transaction.productionOrderId !== poId && transactionBelongsToSession(transaction, attendanceRecord)
        && s.productionOrders.some(order => order.id === transaction.productionOrderId && isUnfinishedProductionOrder(order)));
      if (otherSessionWork) {
        result = { success: false, error: 'Complete or turn over the current Production Order before starting another PO.' };
        return s;
      }
      result = { success: true };
      if (po.status === 'In Production' && attendanceRecord.productionOrderId === poId) return s;
      return {
        ...s,
        productionOrders: s.productionOrders.map(item => item.id === poId ? { ...item, status: 'In Production' as const, assignedShift: attendanceRecord.shift } : item),
        attendance: s.attendance.map(item => item.id === attendanceRecord.id ? { ...item, productionOrderId: poId } : item),
      };
    }));
    return result;
  }, []);

  const recordOutput = useCallback((poId: string, qty: number, rejections: Array<{ weightKg: number; reason: string }>, entryId?: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Output could not be recorded.' };
    flushSync(() => setState(s => {
      const po = s.productionOrders.find(item => item.id === poId);
      const validRejections = rejections.filter(rejection => Number.isFinite(rejection.weightKg) && rejection.weightKg > 0 && rejection.reason.trim());
      const attendanceRecord = s.attendance.find(record =>
        record.employeeId === s.currentUser?.employeeId && record.status === 'Active'
      );
      if (!po || !attendanceRecord || s.currentUser?.role !== 'production') {
        result = { success: false, error: 'An active Production shift and Production Order are required.' };
        return s;
      }
      if (entryId && s.transactions.some(transaction => transaction.transactionType === 'Production Output'
        && transaction.productionOrderId === poId && transaction.productionOutputEntryId === entryId)) {
        result = { success: true };
        return s;
      }
      if (po.status !== 'In Production'
        || (po.assignedShift && po.assignedShift !== attendanceRecord.shift)
        || (attendanceRecord.productionOrderId && attendanceRecord.productionOrderId !== poId)) {
        result = { success: false, error: 'Start / Continue this Production Order in your active shift before recording output.' };
        return s;
      }
      if (!Number.isInteger(qty) || qty < 1 || validRejections.length !== rejections.length || validRejections.length > qty) {
        result = { success: false, error: 'Enter valid whole-number output and complete rejection details.' };
        return s;
      }
      if (po.completedQty + qty > po.targetQty) {
        result = { success: false, error: 'Completed quantity cannot exceed the remaining PO target.' };
        return s;
      }

      const plan = calculateProductionMaterialPlan(po, qty);
      if (plan.unitWeightKg <= MASS_TOLERANCE_KG) {
        result = { success: false, error: 'UNIT WEIGHT CONFIGURATION REQUIRED|Configure a product-specific unit weight, BOM / recipe, or valid solid-wall geometry before recording output.' };
        return s;
      }
      const loadedBags = s.pellets
        .filter(item =>
          ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus)
          && normalizeMaterialGrade(item.grade) === normalizeMaterialGrade(po.grade)
          && item.availableKg > MASS_TOLERANCE_KG
        )
        .sort((a, b) => (a.loadedAt || '').localeCompare(b.loadedAt || '') || a.id.localeCompare(b.id));
      const wipAvailableKg = roundKg(loadedBags.reduce((sum, bag) => sum + bag.availableKg, 0));
      if (plan.pelletRequiredKg - wipAvailableKg > MASS_TOLERANCE_KG) {
        const shortage = roundKg(plan.pelletRequiredKg - wipAvailableKg);
        result = {
          success: false,
          error: `INSUFFICIENT LOADED MATERIAL|Required: ${plan.pelletRequiredKg.toFixed(2)} kg|Available: ${wipAvailableKg.toFixed(2)} kg|Shortage: ${shortage.toFixed(2)} kg`,
        };
        return s;
      }

      const baseCode = colorCodeFromProductColor(po.color);
      const stripeCode = po.stripe === 'No Stripe' ? undefined : colorCodeFromStripe(po.stripe);
      const baseColorant = s.colorants.find(item => item.usageType === 'BASE_COLORANT' && item.colorCode === baseCode);
      const stripeColorant = stripeCode
        ? s.colorants.find(item => item.usageType === 'STRIPE_COLORANT' && item.colorCode === stripeCode)
        : undefined;
      const insufficientColorant = (
        colorant: ColorantInventory | undefined,
        required: number,
        label: string,
      ) => {
        const available = colorant?.availableKg || 0;
        if (required - available <= MASS_TOLERANCE_KG) return undefined;
        return `INSUFFICIENT COLORANT|${label}|Required: ${required.toFixed(2)} kg|Available: ${available.toFixed(2)} kg|Shortage: ${roundKg(required - available).toFixed(2)} kg`;
      };
      const colorantError = insufficientColorant(baseColorant, plan.baseColorantKg, 'Base Colorant')
        || insufficientColorant(stripeColorant, plan.stripeColorantKg, 'Stripe Colorant');
      if (!baseCode || colorantError) {
        result = { success: false, error: colorantError || `No Base Colorant is configured for ${po.color}.` };
        return s;
      }

      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 5);
      const outputTransactionId = `TX-OUT-${now.getTime()}`;
      let pelletRemaining = plan.pelletRequiredKg;
      const bagConsumption = new Map<string, number>();
      const hasVirgin = loadedBags.some(item => item.type === 'Virgin');
      const hasRecycled = loadedBags.some(item => item.type === 'Recycled');
      const ratioTotal = (po.virginRatio || 0) + (po.recycledRatio || 0);
      const hasConfiguredBlend = hasVirgin && hasRecycled
        && (po.virginRatio || 0) >= 0 && (po.recycledRatio || 0) >= 0
        && Math.abs(ratioTotal - 1) <= MASS_TOLERANCE_KG;
      if (hasConfiguredBlend) {
        const targets = {
          Virgin: roundKg(plan.pelletRequiredKg * (po.virginRatio || 0)),
          Recycled: 0,
        };
        targets.Recycled = roundKg(plan.pelletRequiredKg - targets.Virgin);
        for (const type of ['Virgin', 'Recycled'] as const) {
          const available = roundKg(loadedBags.filter(item => item.type === type).reduce((sum, item) => sum + item.availableKg, 0));
          if (targets[type] - available > MASS_TOLERANCE_KG) {
            result = { success: false, error: `INSUFFICIENT ${type.toUpperCase()} WIP|Required by recipe: ${targets[type].toFixed(2)} kg|Available: ${available.toFixed(2)} kg|Shortage: ${roundKg(targets[type] - available).toFixed(2)} kg` };
            return s;
          }
          let typeRemaining = targets[type];
          for (const bag of loadedBags.filter(item => item.type === type)) {
            if (typeRemaining <= MASS_TOLERANCE_KG) break;
            const consumed = roundKg(Math.min(bag.availableKg, typeRemaining));
            bagConsumption.set(bag.id, consumed);
            typeRemaining = roundKg(typeRemaining - consumed);
            pelletRemaining = roundKg(pelletRemaining - consumed);
          }
        }
      } else {
        // No approved blend is present: deterministic FIFO is prototype behavior, not an HPAI formula.
        for (const bag of loadedBags) {
          if (pelletRemaining <= MASS_TOLERANCE_KG) break;
          const consumed = roundKg(Math.min(bag.availableKg, pelletRemaining));
          bagConsumption.set(bag.id, consumed);
          pelletRemaining = roundKg(pelletRemaining - consumed);
        }
      }
      if (pelletRemaining > MASS_TOLERANCE_KG) {
        result = { success: false, error: 'INSUFFICIENT LOADED MATERIAL — WIP changed before this output could be saved.' };
        return s;
      }

      const pelletUsage: MaterialUsageTransaction[] = loadedBags.flatMap((bag, index) => {
        const consumed = bagConsumption.get(bag.id) || 0;
        return consumed <= 0 ? [] : [{
          id: `mu-pellet-${now.getTime()}-${index}`,
          transactionId: `${outputTransactionId}-PEL-${index}`,
          productionOrderId: po.id,
          productionOrderRef: po.poNo,
          employeeId: s.currentUser!.employeeId,
          employeeName: s.currentUser!.name,
          attendanceSessionId: attendanceRecord.id,
          shift: attendanceRecord.shift,
          materialType: bag.type === 'Virgin' ? 'VIRGIN_PELLET' : 'RECYCLED_PELLET',
          materialId: bag.id,
          materialName: `${bag.type} Pellets ${bag.grade}`,
          quantity: consumed,
          unit: 'kg',
          dateTime: now.toISOString(),
          sourceReference: bag.batchNo,
          physicalBagId: bag.id,
          barcode: bag.barcode,
          pelletType: bag.type,
          usageStage: 'CONSUMED',
          outputTransactionId,
          isTestData: bag.isTestData,
        }];
      });
      const colorantRequirements = [
        { colorant: baseColorant!, quantity: plan.baseColorantKg, usageType: 'BASE_COLORANT' as const },
        ...(stripeColorant && plan.stripeColorantKg > 0
          ? [{ colorant: stripeColorant, quantity: plan.stripeColorantKg, usageType: 'STRIPE_COLORANT' as const }]
          : []),
      ];
      const colorantUsage: MaterialUsageTransaction[] = colorantRequirements.map(({ colorant, quantity, usageType }, index) => ({
        id: `mu-colorant-${now.getTime()}-${index}`,
        transactionId: `${outputTransactionId}-COL-${index}`,
        productionOrderId: po.id,
        productionOrderRef: po.poNo,
        employeeId: s.currentUser!.employeeId,
        employeeName: s.currentUser!.name,
        attendanceSessionId: attendanceRecord.id,
        shift: attendanceRecord.shift,
        materialType: 'COLORANT',
        materialId: colorant.id,
        materialName: colorant.name,
        quantity,
        unit: 'kg',
        dateTime: now.toISOString(),
        sourceReference: colorant.sourceReference || colorant.colorantId,
        color: colorant.color,
        usageType,
        usageStage: 'CONSUMED',
        outputTransactionId,
        isTestData: colorant.isTestData,
      }));

      const rejectedQty = validRejections.length;
      const passedQty = qty - rejectedQty;
      const previousTotals = productionOutputTotals(po, s.rejectedMaterials);
      const rejectedKg = roundKg(validRejections.reduce((sum, rejection) => sum + rejection.weightKg, 0));
      const batchSerial = Math.max(0, ...s.finishedGoods.map(item => Number(item.batch.split('-').pop()) || 0)) + 1;
      const batch = `BATCH-${now.getFullYear()}-${String(batchSerial).padStart(4, '0')}`;
      const finishedGoods = makePermanentFinishedPipes(passedQty, {
        product: po.product, diameter: po.diameter, length: po.length, sdr: po.sdr,
        grade: po.grade, color: po.color, stripe: po.stripe, construction: po.construction,
        productForm: po.productForm, batch, poRef: po.poNo, moRef: po.source === 'Stock Replenishment' ? undefined : po.moRef,
        productionDate: date, shift: s.currentShift,
        storageLocation: '', status: 'Available',
      }, s.barcodeRegistry, s.finishedGoods, s.finishedPipeSerialHighWater || 0).map(item => ({
        ...item,
        qualityStatus: 'Pass' as const,
        isTestData: loadedBags.some(bag => bag.isTestData) || colorantRequirements.some(entry => entry.colorant.isTestData),
      }));
      const sourceMo = po.source === 'Stock Replenishment' ? undefined : s.manufacturingOrders.find(item => item.moNo === po.moRef);
      const sourceOrder = sourceMo && s.orders.find(item => item.orderNo === sourceMo.orderRef);
      const allocatedFinishedGoods = sourceOrder ? finishedGoods.map(item => ({
        ...item,
        moRef: sourceMo.moNo,
        status: 'Awaiting Storage' as const,
        inventoryPurpose: 'Customer Order' as const,
        reservationStatus: 'Reserved' as const,
        reservedQty: 0,
        reservedForOrderId: sourceOrder.id,
        reservedForOrderRef: sourceOrder.orderNo,
        orderReference: sourceOrder.orderNo,
        buyer: sourceOrder.customerName,
        unitWeightKg: plan.unitWeightKg,
      })) : finishedGoods.map(item => ({ ...item, unitWeightKg: plan.unitWeightKg }));
      const newRejected: RejectedMaterial[] = validRejections.map((rejection, index) => ({
        id: `rj-${now.getTime()}-${index}`,
        rejectionId: `RJ-${now.getFullYear()}-${String(now.getTime()).slice(-6)}-${index + 1}`,
        poRef: po.poNo,
        product: `${po.product} ${po.diameter}`,
        batch,
        quantity: 1,
        weightKg: roundKg(rejection.weightKg),
        reason: rejection.reason.trim(),
        employee: s.currentUser!.name,
        shift: s.currentShift,
        date,
        allocatedWeightKg: 0,
        allocationStatus: 'Unallocated',
        isTestData: loadedBags.some(bag => bag.isTestData) || colorantRequirements.some(entry => entry.colorant.isTestData),
      }));

      let allocatedRejected = [...newRejected, ...s.rejectedMaterials].map(item => ({ ...item }));
      const newRecyclingBatches: RecyclingBatch[] = [];
      let unallocatedKg = roundKg(allocatedRejected.reduce(
        (sum, item) => sum + Math.max(0, item.weightKg - (item.allocatedWeightKg || 0)),
        0,
      ));
      let nextRecyclingNumber = Math.max(0, ...s.recyclingBatches.map(item => Number(item.batchNo.split('-').pop()) || 0)) + 1;
      while (unallocatedKg + MASS_TOLERANCE_KG >= 50) {
        const batchNo = `RP-${now.getFullYear()}-${String(nextRecyclingNumber++).padStart(4, '0')}`;
        let toAllocate = 50;
        const sourceRecords: RejectedMaterial[] = [];
        allocatedRejected = allocatedRejected.map(item => {
          if (toAllocate <= MASS_TOLERANCE_KG) return item;
          const available = Math.max(0, item.weightKg - (item.allocatedWeightKg || 0));
          if (available <= MASS_TOLERANCE_KG) return item;
          const allocation = Math.min(available, toAllocate);
          toAllocate = roundKg(toAllocate - allocation);
          sourceRecords.push(item);
          const allocatedWeightKg = roundKg((item.allocatedWeightKg || 0) + allocation);
          return {
            ...item,
            allocatedWeightKg,
            recyclingBatchRef: item.recyclingBatchRef || batchNo,
            allocationStatus: allocatedWeightKg + MASS_TOLERANCE_KG >= item.weightKg ? 'Allocated' as const : 'Unallocated' as const,
          };
        });
        newRecyclingBatches.push({
          id: `rb-${now.getTime()}-${nextRecyclingNumber}`,
          batchNo,
          originalKg: roundKg(50 - toAllocate),
          date,
          status: 'Ready for Cutting',
          employees: Array.from(new Set(sourceRecords.map(item => item.employee))),
          sourcePO: Array.from(new Set(sourceRecords.map(item => item.poRef))).join(', '),
          product: Array.from(new Set(sourceRecords.map(item => item.product))).join(', '),
          rejectReasons: Array.from(new Set(sourceRecords.map(item => item.reason))),
        });
        unallocatedKg = roundKg(unallocatedKg - 50);
      }

      const outputTransaction: Transaction = {
        productionOutputEntryId: entryId,
        id: `tx-output-${now.getTime()}`, txId: outputTransactionId,
        date, time, employee: s.currentUser.name, employeeId: s.currentUser.employeeId, role: 'Production',
        transactionType: 'Production Output', item: `${po.product} ${po.diameter}`, batch,
        materialCategory: 'Finished Pipe', finishedGoodsQuantity: passedQty,
        qtyBefore: po.completedQty, qtyChanged: qty, qtyAfter: po.completedQty + qty,
        source: po.productionLine, destination: 'Quality Pass / Rejected Material', reference: po.poNo,
        status: 'Completed', shift: s.currentShift, attendanceSessionId: attendanceRecord.id,
        productionOrderId: po.id, processLossKg: plan.processLossKg,
        unitWeightKg: plan.unitWeightKg, totalMaterialKg: plan.totalMaterialConsumedKg,
        isTestData: loadedBags.some(bag => bag.isTestData) || colorantRequirements.some(entry => entry.colorant.isTestData),
      };
      const materialTransactions: Transaction[] = pelletUsage.map((usage, index) => {
        const bag = loadedBags.find(item => item.id === usage.physicalBagId)!;
        return {
          id: `tx-pellet-consumed-${now.getTime()}-${index}`,
          txId: usage.transactionId,
          date, time, employee: s.currentUser!.name, employeeId: s.currentUser!.employeeId, role: 'Production',
          transactionType: roundKg(bag.availableKg - usage.quantity) <= MASS_TOLERANCE_KG ? 'Pellet Fully Consumed' : 'Pellet Partially Consumed',
          materialCategory: bag.type === 'Virgin' ? 'Virgin Pellet' : 'Recycled Pellet',
          item: usage.materialName, batch: bag.batchNo, barcode: bag.barcode,
          qtyBefore: bag.availableKg, qtyChanged: -usage.quantity, qtyAfter: roundKg(bag.availableKg - usage.quantity),
          source: `${po.productionLine} WIP`, destination: 'Manufactured Pipe Material', reference: po.poNo,
          status: 'Completed', shift: s.currentShift, scannerMode: 'Automatic FIFO Consumption',
          attendanceSessionId: attendanceRecord.id, productionOrderId: po.id, isTestData: bag.isTestData,
        };
      });
      const colorantTransactions: Transaction[] = colorantRequirements.map(({ colorant, quantity, usageType }, index) => ({
        id: `tx-colorant-consumed-${now.getTime()}-${index}`,
        txId: `${outputTransactionId}-COL-${index}`,
        date, time, employee: s.currentUser!.name, employeeId: s.currentUser!.employeeId, role: 'Production',
        transactionType: usageType === 'BASE_COLORANT' ? 'Base Colorant Consumed' : 'Stripe Colorant Consumed',
        item: colorant.name, batch: colorant.colorantId, qtyBefore: colorant.availableKg,
        qtyChanged: -quantity, qtyAfter: roundKg(colorant.availableKg - quantity),
        source: 'Colorant Inventory', destination: 'Manufactured Pipe Material', reference: po.poNo,
        status: 'Completed', shift: s.currentShift, scannerMode: 'Automatic PO Recipe',
        attendanceSessionId: attendanceRecord.id, productionOrderId: po.id, isTestData: colorant.isTestData,
      }));

      result = { success: true };
      return {
        ...s,
        productionOrders: s.productionOrders.map(item => item.id === poId ? {
          ...item,
          completedQty: item.completedQty + qty,
          totalGoodQty: previousTotals.good + passedQty,
          totalRejectedQty: previousTotals.rejected + rejectedQty,
          status: item.completedQty + qty >= item.targetQty ? 'Completed' as const : item.status,
          totalRejectedWeightKg: roundKg((item.totalRejectedWeightKg || 0) + rejectedKg),
          totalPelletConsumedKg: roundKg((item.totalPelletConsumedKg || 0) + plan.pelletRequiredKg),
          totalColorantConsumedKg: roundKg((item.totalColorantConsumedKg || 0) + plan.totalColorantKg),
          totalProcessLossKg: roundKg((item.totalProcessLossKg || 0) + plan.processLossKg),
        } : item),
        pellets: s.pellets.map(item => {
          const consumed = bagConsumption.get(item.id);
          if (!consumed) return item;
          const availableKg = roundKg(item.availableKg - consumed);
          return {
            ...item,
            availableKg,
            inventoryStatus: availableKg <= MASS_TOLERANCE_KG ? 'Fully Consumed' as const : 'Partially Consumed' as const,
            loadedForPOId: po.id,
            loadedForPORef: po.poNo,
            fullyConsumedAt: availableKg <= MASS_TOLERANCE_KG ? now.toISOString() : undefined,
            currentLocation: availableKg <= MASS_TOLERANCE_KG ? 'Fully Consumed Pellet History' : item.currentLocation,
            locationStatus: availableKg <= MASS_TOLERANCE_KG ? 'Released' as const : item.locationStatus,
            locationHistory: availableKg <= MASS_TOLERANCE_KG ? [...(item.locationHistory || []), {
              from: item.currentLocation,
              to: 'Fully Consumed Pellet History',
              action: 'Released' as const,
              employee: s.currentUser!.name,
              employeeId: s.currentUser!.employeeId,
              dateTime: now.toISOString(),
              reason: `Fully consumed for ${po.poNo}`,
            }] : item.locationHistory,
          };
        }),
        colorants: s.colorants.map(item => {
          const requirement = colorantRequirements.find(entry => entry.colorant.id === item.id);
          if (!requirement) return item;
          const availableKg = roundKg(item.availableKg - requirement.quantity);
          return {
            ...item,
            availableKg,
            status: availableKg <= MASS_TOLERANCE_KG ? 'Out of Stock' as const : availableKg < 5 ? 'Low Stock' as const : 'Available' as const,
            locationBalances: consumeLocationBalances(item.locationBalances, requirement.quantity),
            lastUpdated: `${date} ${time}`,
          };
        }),
        finishedGoods: [...allocatedFinishedGoods.map(pipe => hydrateFinishedPipe(pipe, s)), ...s.finishedGoods],
        finishedPipeSerialHighWater: Math.max(s.finishedPipeSerialHighWater || 0, ...allocatedFinishedGoods.map(pipe => Number(pipe.serialNumber?.slice(2)) || 0)),
        orders: sourceOrder ? s.orders.map(item => item.id === sourceOrder.id ? {
          ...item,
          reservedQuantity: Math.min(item.quantity, (item.reservedQuantity || 0) + passedQty),
          manufacturedQuantity: (item.manufacturedQuantity || 0) + passedQty,
        } : item) : s.orders,
        rejectedMaterials: allocatedRejected,
        recyclingBatches: [...newRecyclingBatches, ...s.recyclingBatches],
        barcodeRegistry: [...registryEntriesForFinishedGoods(allocatedFinishedGoods), ...s.barcodeRegistry],
        materialUsageTransactions: [...pelletUsage, ...colorantUsage, ...s.materialUsageTransactions],
        transactions: [outputTransaction, ...materialTransactions, ...colorantTransactions, ...s.transactions],
        auditLogs: [{
          id: `al-output-${now.getTime()}`, user: s.currentUser.name, employeeId: s.currentUser.employeeId,
          role: 'Production', action: 'Production Output & Material Consumption Recorded',
          date, time, reference: `${po.poNo} · ${batch}`,
          previousValue: `WIP ${wipAvailableKg.toFixed(3)} kg`,
          newValue: `WIP ${roundKg(wipAvailableKg - plan.pelletRequiredKg).toFixed(3)} kg`,
        }, ...s.auditLogs],
      };
    }));
    return result;
  }, []);

  const addMaterialRequest = useCallback((req: Omit<MaterialRequest, 'id'>) => {
    const category = requestCategory(req as MaterialRequest);
    if (category !== 'Colorant' && req.pelletType !== (category === 'Virgin Pellet' ? 'Virgin' : 'Recycled')) return { success: false, error: 'Pellet Type must match the material category.' };
    const color = category === 'Colorant' ? req.color : newPelletColor(req.pelletType, req.color);
    if (!color) return { success: false, error: 'Select a valid recycled pellet color from the shared master.' };
    if (category !== 'Colorant' && !isActiveMaterialGrade(normalizeMaterialGrade(req.grade))) return { success: false, error: 'Select a supported material grade.' };
    let result: { success: boolean; requestRef?: string; error?: string } = { success: false, error: 'Unable to create Material Request.' };
    setState(s => {
      if (s.currentUser?.role !== 'plantmanager') {
        result = { success: false, error: 'Plant Manager authorization is required.' };
        return s;
      }
      const duplicate = s.materialRequests.find(item => {
        const replenishmentReceived = s.transfers.some(transfer => transfer.requestRef === item.refNo && transfer.status === 'Received');
        if (replenishmentReceived || !['New', 'Pending', 'Approved'].includes(item.status) || requestCategory(item) !== category || (item.destination || 'Branch Plant') !== (req.destination || 'Branch Plant')) return false;
        if (category === 'Colorant') return item.color === req.color && item.colorantUsageType === req.colorantUsageType;
        return normalizeMaterialGrade(item.grade) === normalizeMaterialGrade(req.grade);
      });
      if (duplicate) {
        result = { success: false, requestRef: duplicate.refNo, error: `A request is already in progress under ${duplicate.refNo}.` };
        return s;
      }
      const id = `mr${Date.now()}`;
      const newReq: MaterialRequest = { ...req, color, grade: category === 'Colorant' ? req.grade : normalizeMaterialGrade(req.grade), id };
      const notif: Notification = {
        id: `n${Date.now()}`, title: 'New Material Request',
        description: `${req.refNo} · ${category} · ${req.requestedKg} kg · ${req.destination || 'Branch Plant'} · Requested by ${req.requestedBy}`,
        datetime: new Date().toISOString().slice(0, 16).replace('T', ' '), priority: 'Action Required', read: false, roles: ['accounting'],
      };
      result = { success: true, requestRef: req.refNo };
      return { ...s, materialRequests: [newReq, ...s.materialRequests], notifications: [notif, ...s.notifications] };
    });
    return result;
  }, []);

  const loadPellets = useCallback((pelletId: string, poId: string, scannerMeta?: { shift: string; scannerMode: string }) => {
    let loaded = false;
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    setState(s => {
      const pellet = s.pellets.find(p => p.id === pelletId);
      if (!pellet || pellet.availableKg !== 25 || pellet.inventoryStatus !== 'Available') return s;
      const po = s.productionOrders.find(p => p.id === poId);
      if (!po || !isSupportedMaterialGrade(pellet.grade) || !isSupportedMaterialGrade(po.grade)
        || normalizeMaterialGrade(pellet.grade) !== normalizeMaterialGrade(po.grade)) return s;
      const attendanceRecord = s.attendance.find(record =>
        record.employeeId === s.currentUser?.employeeId && record.status === 'Active'
      );
      if (!attendanceRecord) return s;
      loaded = true;
      const newTx: Transaction = {
        id: `tx${Date.now()}`,
        txId: `TX-${Date.now()}`,
        date, time,
        employee: s.currentUser?.name || '',
        employeeId: s.currentUser?.employeeId || '',
        role: 'Production',
        transactionType: 'Pellet Loaded',
        item: `${pellet.type} Pellets ${pellet.grade}`,
        batch: pellet.batchNo,
        barcode: pellet.barcode,
        qtyBefore: pellet.availableKg,
        qtyChanged: -25,
        qtyAfter: 0,
        source: `${pellet.type} Pellet Raw Inventory`,
        destination: `${po.productionLine} WIP`,
        reference: po.poNo,
        status: 'Completed',
        shift: scannerMeta?.shift,
        scannerMode: scannerMeta?.scannerMode,
        attendanceSessionId: attendanceRecord.id,
        productionOrderId: po.id,
      };
      const newAudit: AuditLog = {
        id: `al${Date.now()}`,
        user: s.currentUser?.name || '',
        employeeId: s.currentUser?.employeeId || '',
        role: 'Production',
        action: 'Pellet Bag Loaded to WIP',
        date, time,
        reference: pellet.barcode,
      };
      return {
        ...s,
        pellets: s.pellets.map(p => p.id === pelletId ? {
          ...p, inventoryStatus: 'Loaded' as const,
          currentLocation: po.productionLine,
          locationStatus: 'In Production' as const,
          loadedForPOId: po.id,
          loadedForPORef: po.poNo,
          loadedAt: now.toISOString(),
          locationHistory: [...(p.locationHistory || []), {
            from: p.currentLocation || 'Not Yet Assigned',
            to: po.productionLine,
            action: 'Loaded' as const,
            employee: s.currentUser?.name || '',
            employeeId: s.currentUser?.employeeId || '',
            dateTime: now.toISOString(),
          }],
          lastScan: `${date} ${time}`, scannedBy: s.currentUser?.name || '',
        } : p),
        productionOrders: s.productionOrders.map(p => p.id === poId ? { ...p, loadedKg: p.loadedKg + 25 } : p),
        transactions: [newTx, ...s.transactions],
        auditLogs: [newAudit, ...s.auditLogs],
      };
    });
    return loaded;
  }, []);

  const recordColorantUsage = useCallback((colorantId: string, quantityKg: number, poId: string, usageType: 'BASE_COLORANT' | 'STRIPE_COLORANT' = 'BASE_COLORANT') => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Colorant usage could not be recorded.' };
    setState(s => {
      const colorant = s.colorants.find(item => item.id === colorantId);
      const po = s.productionOrders.find(item => item.id === poId);
      const attendanceRecord = s.attendance.find(record =>
        record.employeeId === s.currentUser?.employeeId && record.status === 'Active'
      );
      if (!s.currentUser || !attendanceRecord || !po) {
        result = { success: false, error: 'An active Production shift and Production Order are required.' };
        return s;
      }
      if (!colorant) {
        result = { success: false, error: 'No valid Colorant Inventory record was selected.' };
        return s;
      }
      const requiredColorCode = usageType === 'STRIPE_COLORANT'
        ? colorCodeFromStripe(po.stripe)
        : colorCodeFromProductColor(po.color);
      if (!requiredColorCode) {
        result = { success: false, error: usageType === 'STRIPE_COLORANT'
          ? `${po.poNo} has No Stripe, so stripe Colorant is not required.`
          : `The ${po.color} specification does not define a supported colorant requirement.` };
        return s;
      }
      if (colorant.colorCode !== requiredColorCode) {
        const requiredSpecification = usageType === 'STRIPE_COLORANT' ? po.stripe : po.color;
        result = { success: false, error: `${po.poNo} requires ${requiredSpecification}. Select the matching ${requiredColorCode} colorant.` };
        return s;
      }
      if (colorant.usageType !== usageType) {
        result = { success: false, error: `${colorant.name} is not configured for ${usageType === 'BASE_COLORANT' ? 'base' : 'stripe'} usage.` };
        return s;
      }
      if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
        result = { success: false, error: 'Enter a valid Colorant quantity greater than 0 kg.' };
        return s;
      }
      if (quantityKg > colorant.availableKg) {
        result = { success: false, error: `Only ${colorant.availableKg.toFixed(2)} kg of ${colorant.name} is available.` };
        return s;
      }
      const now = new Date();
      const transactionId = `TX-COL-${now.getTime()}`;
      const remainingKg = Math.round((colorant.availableKg - quantityKg) * 1000) / 1000;
      const usage: MaterialUsageTransaction = {
        id: `mu-colorant-${now.getTime()}`,
        transactionId,
        productionOrderId: po.id,
        productionOrderRef: po.poNo,
        employeeId: s.currentUser.employeeId,
        employeeName: s.currentUser.name,
        attendanceSessionId: attendanceRecord.id,
        shift: attendanceRecord.shift,
        materialType: 'COLORANT',
        materialId: colorant.id,
        materialName: colorant.name,
        quantity: quantityKg,
        unit: 'kg',
        dateTime: now.toISOString(),
        sourceReference: colorant.sourceReference || colorant.colorantId,
        color: colorant.color,
        usageType,
      };
      const inventoryTransaction: Transaction = {
        id: `tx-colorant-${now.getTime()}`,
        txId: transactionId,
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 5),
        employee: s.currentUser.name,
        employeeId: s.currentUser.employeeId,
        role: 'Production',
        transactionType: usageType === 'STRIPE_COLORANT' ? 'Stripe Colorant Used' : 'Base Colorant Used',
        item: colorant.name,
        batch: colorant.colorantId,
        qtyBefore: colorant.availableKg,
        qtyChanged: -quantityKg,
        qtyAfter: remainingKg,
        source: 'Colorant Inventory',
        destination: po.productionLine,
        reference: po.poNo,
        status: 'Completed',
        shift: attendanceRecord.shift,
        scannerMode: 'Record Colorant Usage',
        attendanceSessionId: attendanceRecord.id,
        productionOrderId: po.id,
      };
      result = { success: true };
      return {
        ...s,
        colorants: s.colorants.map(item => item.id === colorant.id ? {
          ...item,
          availableKg: remainingKg,
          locationBalances: consumeLocationBalances(item.locationBalances, quantityKg),
          status: remainingKg <= 0 ? 'Out of Stock' as const : remainingKg < 5 ? 'Low Stock' as const : 'Available' as const,
          lastUpdated: `${inventoryTransaction.date} ${inventoryTransaction.time}`,
        } : item),
        materialUsageTransactions: [usage, ...s.materialUsageTransactions],
        transactions: [inventoryTransaction, ...s.transactions],
        auditLogs: [{
          id: `al-colorant-${now.getTime()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Production',
          action: usageType === 'STRIPE_COLORANT' ? 'Stripe Colorant Usage Recorded' : 'Base Colorant Usage Recorded',
          date: inventoryTransaction.date,
          time: inventoryTransaction.time,
          reference: po.poNo,
          previousValue: `${colorant.availableKg} kg`,
          newValue: `${remainingKg} kg`,
        }, ...s.auditLogs],
      };
    });
    return result;
  }, []);

  const submitTurnover = useCallback((data: Pick<ShiftTurnover, 'machineCondition' | 'lineCondition' | 'lineConditionOther' | 'issueCategory' | 'issueDescription' | 'issuesEncountered' | 'nextRequiredAction' | 'nextRequiredActionOther' | 'notesForIncoming' | 'instructionType' | 'importantInstructions'>, poId: string) => {
    let result: { success: boolean; turnoverNo?: string; error?: string } = { success: false, error: 'Shift Turnover could not be saved.' };
    setState(s => {
      const po = s.productionOrders.find(item => item.id === poId);
      const now = new Date();
      const attendanceRecord = s.attendance.find(a => a.employeeId === s.currentUser?.employeeId && a.status === 'Active');
      if (!po || !s.currentUser || !attendanceRecord) {
        result = { success: false, error: 'The active attendance session or Production Order is no longer available.' };
        return s;
      }
      if (!isUnfinishedProductionOrder(po)) {
        result = { success: false, error: 'This Production Order is complete and does not require Shift Turnover.' };
        return s;
      }
      const duplicate = s.turnovers.find(turnover =>
        turnover.attendanceSessionId === attendanceRecord.id
        && turnover.productionOrderId === po.id
        && turnover.outgoingShift === attendanceRecord.shift
      );
      if (duplicate) {
        result = { success: false, error: `Turnover ${duplicate.turnoverNo} was already submitted for this shift session.` };
        return s;
      }
      const outputTransactions = s.transactions.filter(transaction =>
        transaction.transactionType === 'Production Output'
        && transaction.productionOrderId === po.id
        && transaction.attendanceSessionId === attendanceRecord.id
      );
      const completedThisShift = outputTransactions.reduce((sum, transaction) => sum + Math.max(0, transaction.qtyChanged), 0);
      const outputBatches = new Set(outputTransactions.map(transaction => transaction.batch));
      const shiftRejected = s.rejectedMaterials.filter(rejected =>
        rejected.poRef === po.poNo
        && rejected.employee === s.currentUser?.name
        && outputBatches.has(rejected.batch)
      );
      const rejectedQty = shiftRejected.reduce((sum, rejected) => sum + rejected.quantity, 0);
      const rejectedKg = Math.round(shiftRejected.reduce((sum, rejected) => sum + rejected.weightKg, 0) * 10) / 10;
      const pelletTransactions = attendanceRecord
        ? s.transactions.filter(transaction =>
            transaction.transactionType === 'Pellet Loaded'
            && transaction.scannerMode === 'Load Pellets'
            && transaction.status === 'Completed'
            && transaction.reference === po.poNo
            && transactionBelongsToSession(transaction, attendanceRecord)
          )
        : [];
      const materialUsage = calculateMaterialUsage(s.materialUsageTransactions, attendanceRecord, po);
      const stripeRequired = po.stripe !== 'No Stripe';
      if (completedThisShift > 0 && (
        materialUsage.totalPelletWeightKg <= 0
        || materialUsage.baseColorantWeightKg <= 0
        || (stripeRequired && materialUsage.stripeColorantWeightKg <= 0)
      )) {
        result = { success: false, error: 'Resolve missing pellet, base Colorant, or stripe Colorant usage before finalizing this Shift Turnover.' };
        return s;
      }
      const turnoverNo = `TRN-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
      const pelletLoadedThisShift = roundKg(pelletTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.qtyChanged), 0));
      const pelletWipRemaining = roundKg(s.pellets
        .filter(item => item.loadedForPOId === po.id && ['Loaded', 'Partially Consumed'].includes(item.inventoryStatus))
        .reduce((sum, item) => sum + item.availableKg, 0));
      const processLossThisShift = roundKg(outputTransactions.reduce((sum, transaction) => sum + (transaction.processLossKg || 0), 0));
      const mo = s.manufacturingOrders.find(item => item.moNo === po.moRef);
      const turnover: ShiftTurnover = {
        id: `sto${Date.now()}`,
        turnoverNo,
        outgoingEmployee: s.currentUser.name,
        outgoingEmployeeId: s.currentUser.employeeId,
        outgoingShift: s.currentShift,
        incomingShift: s.currentShift === 'Day' ? 'Night' : 'Day',
        poRef: po.poNo,
        productionLine: po.productionLine,
        targetQty: po.targetQty,
        completedThisShift,
        totalCompleted: po.completedQty,
        remaining: Math.max(0, po.targetQty - po.completedQty),
        pelletType: `${po.pelletType} ${po.grade}`,
        pelletBatch: Array.from(new Set(pelletTransactions.map(transaction => transaction.batch))).join(', ') || 'None loaded',
        pelletLoaded: pelletLoadedThisShift,
        pelletUsed: materialUsage.totalPelletWeightKg,
        pelletWipRemaining,
        processLossKg: processLossThisShift,
        rejectedQty,
        rejectedKg,
        goodQty: Math.max(0, completedThisShift - rejectedQty),
        rejectReasons: Array.from(new Set(shiftRejected.map(rejected => rejected.reason))),
        virginBagsUsed: materialUsage.virginBags,
        virginWeightUsed: materialUsage.virginWeightKg,
        recycledBagsUsed: materialUsage.recycledBags,
        recycledWeightUsed: materialUsage.recycledWeightKg,
        colorantUsed: materialUsage.colorantWeightKg,
        colorantTypes: materialUsage.colorantNames,
        baseColorantUsed: materialUsage.baseColorantWeightKg,
        baseColorantTypes: materialUsage.baseColorantNames,
        stripeColorantUsed: materialUsage.stripeColorantWeightKg,
        stripeColorantTypes: materialUsage.stripeColorantNames,
        totalColorantWeight: materialUsage.colorantWeightKg,
        totalPelletWeight: materialUsage.totalPelletWeightKg,
        totalMaterialWeight: materialUsage.totalMaterialWeightKg,
        clockIn: attendanceRecord?.clockIn || s.clockInTime,
        moRef: po.moRef,
        customerOrderRef: mo?.orderRef,
        product: `${po.product} ${po.diameter} × ${po.length}`,
        specifications: `${po.sdr} · ${po.grade} · ${po.color} · ${po.stripe}`,
        productionStage: po.status,
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 5),
        submittedAt: now.toISOString(),
        clockOut: now.toTimeString().slice(0, 5),
        attendanceSessionId: attendanceRecord.id,
        productionOrderId: po.id,
        status: 'Pending',
        ...data,
      };
      const attendance = s.attendance.map(a =>
        a.id === attendanceRecord.id
          ? { ...a, clockOut: turnover.time, durationMinutes: durationInMinutes(a, now), status: 'Completed' as const }
          : a
      );
      const notification: Notification = {
        id: `n${Date.now()}`,
        title: 'Shift Turnover Submitted',
        description: `${turnoverNo} submitted for ${po.poNo} by ${s.currentUser.name}`,
        datetime: `${turnover.date} ${turnover.time}`,
        priority: 'Action Required',
        read: false,
        roles: ['plantmanager', 'production'],
      };
      result = { success: true, turnoverNo };
      return {
        ...s,
        turnovers: [turnover, ...s.turnovers],
        pendingTurnover: turnover,
        productionOrders: s.productionOrders.map(item => item.id === poId ? {
          ...item,
          status: 'Awaiting Shift Turnover' as const,
        } : item),
        attendance,
        notifications: [notification, ...s.notifications],
        auditLogs: [{
          id: `al${Date.now()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Production',
          action: 'Shift Turnover Submitted',
          date: turnover.date,
          time: turnover.time,
          reference: turnoverNo,
        }, ...s.auditLogs],
        clockedIn: false,
        clockInTime: '',
        currentUser: null,
        currentPage: 'login',
      };
    });
    return result;
  }, []);

  const updateFinishedGoodStorage = useCallback((fgId: string, location: string, purpose: 'General Inventory' | 'Customer Order', orderId?: string, scannerMeta?: PhysicalScanMeta) => {
    let stored = false;
    flushSync(() => setState(s => {
      const fg = s.finishedGoods.find(item => item.id === fgId);
      if (!fg || !exactPhysicalScan(scannerMeta, fg, s.finishedGoods) || finishedPipeInventory(fg, s).bucket !== 'Awaiting Storage') return s;
      const origin = fg ? resolveFinishedPipe(fg, s) : undefined;
      const expectedPurpose = origin?.source === 'Stock Replenishment' ? 'General Inventory' : origin?.source === 'Manufacturing Order' ? 'Customer Order' : undefined;
      const order = origin?.order;
      const alreadyReservedForOrder = !!fg?.reservedForOrderId && fg.reservedForOrderId === order?.id;
      if (
        !fg || s.currentUser?.role !== 'plantmanager' || fg.locationStatus === 'Stored' || fg.releaseStatus === 'Released' || fg.qualityStatus !== 'Pass'
        || !expectedPurpose || purpose !== expectedPurpose || !validStorageLocation(location, origin?.inventory.purpose)
        || (origin?.source === 'Manufacturing Order' && !order)
        || (!!orderId && orderId !== order?.id)
        || (!!fg.reservedForOrderId && !alreadyReservedForOrder)
      ) return s;
      const now = new Date();
      stored = true;
      const reserved = origin?.source === 'Stock Replenishment' && !!order;
      const buyerSpecific = origin?.source === 'Manufacturing Order';
      return {
        ...s,
        finishedGoods: s.finishedGoods.map(item => item.id === fgId ? {
          ...item,
          storageLocation: location,
          storageStatus: 'Stored' as const,
          currentLocation: location,
          locationStatus: 'Stored' as const,
          storedBy: s.currentUser?.name || '',
          storedAt: now.toISOString(),
          inventoryPurpose: purpose,
          availableQty: buyerSpecific || reserved ? 0 : 1,
          reservedQty: reserved ? 1 : 0,
          status: buyerSpecific ? 'Stored' as const : reserved ? 'Reserved' as const : 'Available' as const,
          reservationStatus: order ? 'Reserved' as const : 'Available' as const,
          reservedForOrderId: order?.id,
          reservedForOrderRef: order?.orderNo,
          orderReference: order?.orderNo,
          buyer: order?.customerName,
          locationHistory: [...(item.locationHistory || []), {
            from: item.currentLocation || 'Not Yet Assigned',
            to: location,
            action: 'Stored' as const,
            employee: s.currentUser?.name || '',
            employeeId: s.currentUser?.employeeId || '',
            dateTime: now.toISOString(),
          }],
        } : item),
        orders: s.orders,
        transactions: [{
          id: `tx${Date.now()}`,
          txId: `TX-${Date.now()}`,
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5),
          employee: s.currentUser?.name || '',
          employeeId: s.currentUser?.employeeId || '',
          role: 'Plant Manager',
          transactionType: 'Finished Pipe Stored',
          materialCategory: 'Finished Pipe',
          item: `${fg.product} ${fg.diameter}`,
          batch: fg.batch,
          barcode: fg.barcode,
          qtyBefore: finishedGoodsSummary(s.finishedGoods, s).onHand,
          qtyChanged: 0,
          qtyAfter: finishedGoodsSummary(s.finishedGoods, s).onHand,
          source: fg.currentLocation || 'Not Yet Assigned',
          destination: location,
          reference: fg.poRef,
          status: 'Completed',
          shift: scannerMeta?.shift,
          scannerMode: scannerMeta?.scannerMode,
        }, ...s.transactions],
        auditLogs: [{
          id: `al${Date.now()}`,
          user: s.currentUser?.name || '',
          employeeId: s.currentUser?.employeeId || '',
          role: 'Plant Manager',
          action: 'Finished Pipe Stored',
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5),
          reference: fg.fgId,
          previousValue: fg.currentLocation || 'Not Yet Assigned',
          newValue: location,
        }, ...s.auditLogs],
      };
    }));
    return stored;
  }, []);

  const createProductionOrder = useCallback((moId: string) => {
    let poNumber: string | null = null;
    setState(s => {
      if (s.currentUser?.role !== 'plantmanager') return s;
      const mo = s.manufacturingOrders.find(item => item.id === moId);
      if (!mo) return s;
      if (mo.toManufactureQty <= 0) return s;
      const existing = s.productionOrders.find(item => item.moRef === mo.moNo);
      if (existing) {
        poNumber = existing.poNo;
        return s;
      }
      const next = Math.max(0, ...s.productionOrders.map(item => Number(item.poNo.split('-').pop()) || 0)) + 1;
      poNumber = `PO-2026-${String(next).padStart(4, '0')}`;
      const po: ProductionOrder = {
        id: `po${Date.now()}`,
        poNo: poNumber,
        moRef: mo.moNo,
        source: 'Manufacturing Order',
        originGroup: mo.moNo,
        product: mo.product,
        diameter: mo.diameter,
        length: mo.length,
        sdr: mo.sdr,
        grade: mo.grade,
        color: mo.color,
        stripe: mo.stripe,
        construction: mo.construction,
        productForm: mo.productForm,
        targetQty: mo.toManufactureQty,
        completedQty: 0,
        pelletType: 'Virgin',
        requiredKg: 0,
        loadedKg: 0,
        productionLine: 'To Be Assigned',
        priority: 'Normal',
        requiredDate: mo.requiredDate,
        status: 'Scheduled',
      };
      const now = new Date();
      return {
        ...s,
        productionOrders: [...s.productionOrders, po],
        manufacturingOrders: s.manufacturingOrders.map(item =>
          item.id === moId ? { ...item, poRef: po.poNo } : item
        ),
        auditLogs: [{
          id: `al${Date.now()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Plant Manager',
          action: 'Production Order Created',
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5),
          reference: po.poNo,
        }, ...s.auditLogs],
      };
    });
    return poNumber;
  }, []);

  const createStockReplenishmentPO = useCallback((input: {
    specification: ProductSpecification;
    targetQty: number;
    requiredDate: string;
    productionLine: string;
    priority: ProductionOrder['priority'];
    reason: string;
  }) => {
    let result: { success: boolean; poNo?: string; error?: string } = { success: false, error: 'Unable to create Stock Replenishment PO.' };
    setState(s => {
      if (s.currentUser?.role !== 'plantmanager') {
        result = { success: false, error: 'Plant Manager authorization is required.' };
        return s;
      }
      if (!Number.isInteger(input.targetQty) || input.targetQty <= 0 || !input.requiredDate || !input.reason.trim()) {
        result = { success: false, error: 'Target Quantity, Required Date, and Reason are required.' };
        return s;
      }
      if (!isActiveMaterialGrade(input.specification.materialGrade)) {
        result = { success: false, error: 'Select PE80 or PE100 for new Stock Replenishment production.' };
        return s;
      }
      const duplicate = s.productionOrders.find(item =>
        item.source === 'Stock Replenishment'
        && !['Completed', 'Cancelled'].includes(item.status)
        && specificationKeyFromRecord(item) === specificationKey(input.specification)
      );
      if (duplicate) {
        result = { success: false, error: `Replenishment is already in progress under ${duplicate.poNo}.` };
        return s;
      }
      const next = Math.max(0, ...s.productionOrders.map(item => Number(item.poNo.split('-').pop()) || 0)) + 1;
      const now = new Date();
      const poNo = `PO-${now.getFullYear()}-${String(next).padStart(4, '0')}`;
      const spec = input.specification;
      const po: ProductionOrder = {
        id: `po${Date.now()}`,
        poNo,
        moRef: 'STOCK REPLENISHMENT',
        source: 'Stock Replenishment',
        replenishmentReason: input.reason.trim(),
        originGroup: `REPLENISH-${now.getFullYear()}-${String(next).padStart(4, '0')}`,
        product: spec.productType,
        diameter: spec.size,
        length: specificationLength(spec),
        sdr: spec.sdr,
        grade: spec.materialGrade,
        color: spec.color,
        stripe: spec.stripe,
        construction: spec.pipeConstruction,
        productForm: spec.productForm,
        targetQty: Math.floor(input.targetQty),
        completedQty: 0,
        pelletType: 'Virgin',
        requiredKg: 0,
        loadedKg: 0,
        productionLine: input.productionLine || 'To Be Assigned',
        priority: input.priority,
        requiredDate: input.requiredDate,
        status: 'Scheduled',
        unitWeightKg: spec.unitWeightKg,
      };
      result = { success: true, poNo };
      return {
        ...s,
        productionOrders: [po, ...s.productionOrders],
        auditLogs: [{
          id: `al${Date.now()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Plant Manager',
          action: 'Stock Replenishment Production Order Created',
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5),
          reference: poNo,
          newValue: `${spec.productType} ${spec.materialGrade} ${spec.size} ${spec.sdr} ${specificationLength(spec)} · ${po.targetQty} units · Reason: ${input.reason.trim()}`,
        }, ...s.auditLogs],
      };
    });
    return result;
  }, []);

  const receivePellet = useCallback((pelletId: string, scannerMeta?: PhysicalScanMeta, storageLocation?: string) => {
    let received = false;
    flushSync(() => setState(s => {
      const next = applyPhysicalPelletReceipt(s, pelletId, scannerMeta, storageLocation);
      received = next !== s;
      return next;
    }));
    return received;
  }, []);

  const acceptScannedPelletTransfer = useCallback((transferId: string, barcodes: string[], location: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Scan at least one expected bag before Accept Transfer.' };
    flushSync(() => setState(s => {
      if (s.currentUser?.role !== 'plantmanager') { result.error = 'Only Plant Manager can accept this delivery.'; return s; }
      const transfer = s.transfers.find(item => item.id === transferId);
      if (!transfer || !['In Transit', 'Receiving Discrepancy'].includes(transfer.status)) { result.error = 'Delivery must be In Transit or Partially Received.'; return s; }
      if (!barcodes.length) return s;
      if (!activeLocationCodes(readStorageLocations()).includes(location as never)) { result.error = 'Select Storage Location A-I before accepting.'; return s; }
      const normalized = barcodes.map(normalizeBarcodeValue);
      if (new Set(normalized).size !== normalized.length) { result.error = 'Duplicate scan. No bags were accepted.'; return s; }
      const bags = normalized.map(barcode => s.pellets.find(item => exactPhysicalScan({ shift: s.currentShift, scannerMode: 'Receive Pellets', barcode }, item, s.pellets)));
      if (bags.some(bag => !bag || bag.transferRef !== transfer.refNo || bag.batchNo !== transfer.batchNo || expectedPelletError(bag, s.transfers, s.materialRequests))) { result.error = 'Unknown, duplicate, unapproved or mismatched bag. Re-scan this delivery; no stock changed.'; return s; }
      const sent = transfer.sentQuantity ?? transfer.numberOfBags ?? 0;
      const existing = s.pellets.filter(bag => bag.transferRef === transfer.refNo && bag.batchNo === transfer.batchNo && bag.inventoryStatus !== 'Pending Receipt').length;
      if (existing !== (transfer.receivedQuantity ?? existing)) { result.error = 'Existing received totals conflict with physical bag history. Restore canonical references first; no quantities were overwritten.'; return s; }
      if (existing + bags.length > sent) { result.error = 'Scanned bags exceed Sent Quantity. Existing quantities were preserved.'; return s; }
      let next = s;
      for (const bag of bags) {
        const updated = applyPhysicalPelletReceipt(next, bag!.id, { shift: s.currentShift, scannerMode: 'Receive Pellets', barcode: bag!.barcode }, location);
        if (updated === next) { result.error = 'Receipt validation changed. No bags were accepted; re-scan.'; return s; }
        next = updated;
      }
      const received = existing + bags.length, missing = sent - received;
      result = { success: true };
      return { ...next, transfers: next.transfers.map(item => item.id === transferId ? {
        ...item, receivedQuantity: received, discrepancyQuantity: missing,
        status: missing ? 'Receiving Discrepancy' as const : 'Received' as const,
        discrepancyReason: missing ? item.discrepancyReason || 'Missing' as const : undefined,
        discrepancyNotes: missing ? item.discrepancyNotes : undefined,
        receivingLocation: item.receivingLocation && item.receivingLocation !== location ? 'Multiple Locations' : location,
      } : item) };
    }));
    return result;
  }, []);

  const confirmTransferReceipt = useCallback((transferId: string, receivedQuantity: number, reason?: Transfer['discrepancyReason'], notes?: string, storageLocation?: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Transfer receipt could not be saved.' };
    setState(s => {
      if (!storageLocation || !activeLocationCodes(readStorageLocations()).includes(storageLocation as never)) { result.error = 'Storage Location is required.'; return s; }
      const transfer = s.transfers.find(item => item.id === transferId);
      const isColorant = !!transfer && transferCategory(transfer) === 'Colorant';
      const sentQuantity = transfer?.sentQuantity ?? (isColorant ? transfer?.weightKg : transfer?.numberOfBags) ?? 0;
      if (!transfer || !s.currentUser || transfer.status !== 'In Transit') return s;
      if (!isColorant && receivedQuantity >= sentQuantity) { result.error = 'Scan and confirm each expected pellet bag individually. Bulk receipt cannot activate unscanned bags.'; return s; }
      if (!isColorant && receivedQuantity < s.pellets.filter(bag => bag.transferRef === transfer.refNo && bag.batchNo === transfer.batchNo && bag.receivedAt && bag.inventoryStatus !== 'Pending Receipt').length) { result.error = 'Received quantity cannot be less than bags already physically scanned and received.'; return s; }
      if ((!isColorant && !Number.isInteger(receivedQuantity)) || !Number.isFinite(receivedQuantity) || receivedQuantity < 0 || receivedQuantity > sentQuantity) {
        result = { success: false, error: `Received quantity must be ${isColorant ? 'a kg value' : 'a whole bag count'} from 0 to ${sentQuantity}.` };
        return s;
      }
      const discrepancyQuantity = sentQuantity - receivedQuantity;
      if (discrepancyQuantity > 0 && !reason) {
        result = { success: false, error: 'Select a discrepancy reason when received quantity is less than sent quantity.' };
        return s;
      }
      const now = new Date();
      result = { success: true };
      const colorant = isColorant
        ? s.colorants.find(item => item.id === transfer.colorantId)
          || s.colorants.find(item => item.usageType === transfer.colorantUsageType && (item.name === transfer.color || item.color === transfer.color.replace(/\s+\([A-Z]+\)$/, '')))
        : undefined;
      return {
        ...s,
        colorants: colorant && discrepancyQuantity === 0 ? s.colorants.map(item => item.id === colorant.id ? {
          ...item,
          availableKg: roundKg(item.availableKg + receivedQuantity),
          currentLocation: item.currentLocation && item.currentLocation !== storageLocation ? 'Multiple Locations' : storageLocation,
          locationBalances: { ...(item.locationBalances || (item.currentLocation ? { [item.currentLocation]: item.availableKg } : { Unassigned: item.availableKg })), [storageLocation]: (item.locationBalances?.[storageLocation] || (item.currentLocation === storageLocation ? item.availableKg : 0)) + receivedQuantity },
          status: 'Available' as const,
          lastUpdated: now.toISOString().slice(0, 16).replace('T', ' '),
          sourceReference: transfer.refNo,
        } : item) : s.colorants,
        transactions: colorant && discrepancyQuantity === 0 ? [{
          id: `tx-colorant-receipt-${now.getTime()}`,
          txId: `TX-${now.getTime()}`,
          date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5),
          employee: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: s.currentUser.role,
          transactionType: 'Colorant Transfer Receipt',
          materialCategory: 'Colorant' as const,
          item: colorant.name,
          batch: transfer.batchNo,
          qtyBefore: colorant.availableKg,
          qtyChanged: receivedQuantity,
          qtyAfter: roundKg(colorant.availableKg + receivedQuantity),
          source: transfer.source,
          destination: storageLocation,
          reference: transfer.refNo,
          status: 'Received',
        }, ...s.transactions] : !isColorant && discrepancyQuantity === 0 ? [...s.pellets.filter(bag => bag.batchNo === transfer.batchNo && bag.inventoryStatus === 'Pending Receipt').map((bag, index) => ({ id: `tx-transfer-receipt-${now.getTime()}-${index}`, txId: `TX-TR-${now.getTime()}-${index}`, date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5), employee: s.currentUser!.name, employeeId: s.currentUser!.employeeId, role: s.currentUser!.role, transactionType: 'Pellets Received', materialCategory: bag.type === 'Virgin' ? 'Virgin Pellet' as const : 'Recycled Pellet' as const, item: `${bag.type} Pellets ${bag.grade}`, batch: bag.batchNo, barcode: bag.barcode, qtyBefore: bag.availableKg, qtyChanged: 25, qtyAfter: 25, source: bag.currentLocation, destination: storageLocation, reference: transfer.refNo, status: 'Received' })), ...s.transactions] : s.transactions,
        pellets: !isColorant && discrepancyQuantity === 0 ? s.pellets.map(bag => bag.batchNo === transfer.batchNo && bag.inventoryStatus === 'Pending Receipt' ? { ...bag, availableKg: 25, inventoryStatus: 'Available' as const, currentLocation: storageLocation, locationStatus: 'Stored' as const, receivedBy: s.currentUser!.name, receivedAt: now.toISOString(), storedBy: s.currentUser!.name, storedAt: now.toISOString(), locationHistory: [...bag.locationHistory, { from: bag.currentLocation, to: storageLocation, action: 'Received' as const, employee: s.currentUser!.name, employeeId: s.currentUser!.employeeId, dateTime: now.toISOString() }] } : bag) : s.pellets,
        transfers: s.transfers.map(item => item.id === transferId ? {
          ...item,
          sentQuantity,
          receivedQuantity,
          receivingLocation: storageLocation,
          discrepancyQuantity,
          status: discrepancyQuantity > 0 ? 'Receiving Discrepancy' as const : 'Received' as const,
          receivedBy: s.currentUser!.name,
          receivedDate: now.toISOString().slice(0, 16).replace('T', ' '),
          discrepancyReason: discrepancyQuantity > 0 ? reason : undefined,
          discrepancyNotes: discrepancyQuantity > 0 ? notes?.trim() : undefined,
        } : item),
        auditLogs: [{
          id: `al-transfer-receipt-${now.getTime()}`, user: s.currentUser.name,
          employeeId: s.currentUser.employeeId, role: s.currentUser.role === 'plantmanager' ? 'Plant Manager' : 'Production',
          action: discrepancyQuantity > 0 ? 'Transfer Receipt Discrepancy Recorded' : 'Transfer Receipt Completed',
          date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5), reference: transfer.refNo,
          previousValue: `Sent ${sentQuantity}`, newValue: `Received ${receivedQuantity}; discrepancy ${discrepancyQuantity}`,
        }, ...s.auditLogs],
      };
    });
    return result;
  }, []);

  const relocatePhysicalItem = useCallback((category: 'Pellet' | 'Finished Pipe', itemId: string, location: string, reason: string) => {
    let relocated = false;
    setState(s => {
      if (!s.currentUser || !reason.trim()) return s;
      const now = new Date();
      if (category === 'Pellet' && !activeLocationCodes(readStorageLocations()).includes(location as never)) return s;
      const pellet = category === 'Pellet' ? s.pellets.find(item => item.id === itemId) : undefined;
      const fg = category === 'Finished Pipe' ? s.finishedGoods.find(item => item.id === itemId) : undefined;
      const inventory = fg ? finishedPipeInventory(fg, s) : undefined;
      const destination = storageLocationFor(location);
      const ready = destination?.status === 'Active' && destination.plant === 'Branch Plant' && destination.locationType === 'Ready for Ship Out';
      const compatible = inventory && (validStorageLocation(location, inventory.purpose) || (inventory.allocated && (ready || validStorageLocation(location, 'Temporary Storage'))));
      if (
        (!pellet && !fg)
        || (pellet && (pellet.locationStatus !== 'Stored' || ['Fully Consumed', 'Loaded', 'Partially Consumed'].includes(pellet.inventoryStatus)))
        || (fg && (s.currentUser.role !== 'plantmanager' || fg.releaseStatus === 'Released' || fg.qualityStatus !== 'Pass' || !compatible || !inventory || ['Awaiting Storage', 'Quality Pending'].includes(inventory.bucket)))
      ) return s;
      const currentLocation = pellet?.currentLocation || fg?.currentLocation || 'Not Yet Assigned';
      if (currentLocation === location) return s;
      relocated = true;
      const history = {
        from: currentLocation,
        to: location,
        action: 'Relocated' as const,
        employee: s.currentUser.name,
        employeeId: s.currentUser.employeeId,
        dateTime: now.toISOString(),
        reason: reason.trim(),
      };
      return {
        ...s,
        pellets: pellet ? s.pellets.map(item => item.id === itemId ? {
          ...item, currentLocation: location, locationStatus: 'Stored' as const,
          locationHistory: [...(item.locationHistory || []), history], lastScan: now.toISOString().slice(0, 16).replace('T', ' '),
          scannedBy: s.currentUser!.name,
        } : item) : s.pellets,
        finishedGoods: fg ? s.finishedGoods.map(item => item.id === itemId ? {
          ...item, currentLocation: location, storageLocation: location, locationStatus: 'Stored' as const,
          status: ready ? 'Ready for Release' as const : inventory?.source === 'Manufacturing Order' ? 'Stored' as const : inventory?.allocated ? 'Reserved' as const : 'Available' as const,
          availableQty: !inventory?.allocated && inventory?.source === 'Stock Replenishment' ? item.quantity : 0,
          reservedQty: !ready && inventory?.source === 'Stock Replenishment' && inventory.allocated ? item.quantity : 0,
          reservationStatus: ready ? 'Ready for Ship Out' as const : inventory?.allocated ? 'Reserved' as const : 'Available' as const,
          fulfillmentStatus: ready ? 'Ready for Ship Out' as const : inventory?.allocated ? 'Allocated' as const : undefined,
          locationHistory: [...(item.locationHistory || []), history],
        } : item) : s.finishedGoods,
        transactions: fg ? [{
          id: `tx-move-${now.getTime()}`, txId: `TX-MOVE-${now.getTime()}`, date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5),
          employee: s.currentUser.name, employeeId: s.currentUser.employeeId, role: 'Plant Manager', transactionType: ready ? 'Finished Pipe Ready for Ship Out' : 'Finished Pipe Internal Storage Move',
          materialCategory: 'Finished Pipe' as const, item: `${fg.product} ${fg.diameter}`, batch: fg.batch, barcode: fg.barcode,
          qtyBefore: finishedGoodsSummary(s.finishedGoods, s).onHand, qtyChanged: 0, qtyAfter: finishedGoodsSummary(s.finishedGoods, s).onHand,
          source: currentLocation, destination: location, reference: fg.reservedForOrderRef || fg.poRef, status: 'Completed',
        }, ...s.transactions] : s.transactions,
        auditLogs: [{
          id: `al${Date.now()}`, user: s.currentUser.name, employeeId: s.currentUser.employeeId,
          role: s.currentUser.role === 'plantmanager' ? 'Plant Manager' : 'Production',
          action: 'Physical Item Relocated', date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5), reference: pellet?.barcode || fg?.barcode,
          previousValue: currentLocation, newValue: `${location} — ${reason.trim()}`,
        }, ...s.auditLogs],
      };
    });
    return relocated;
  }, []);

  const reserveFinishedGoods = useCallback((orderId: string, quantity: number) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Reservation could not be saved.' };
    setState(s => {
      const order = s.orders.find(item => item.id === orderId);
      if (!order || s.currentUser?.role !== 'marketing' || !Number.isInteger(quantity) || quantity < 1) return s;
      if ((order.reservedQuantity || 0) + (order.releasedQuantity || 0) + quantity > order.quantity) { result.error = 'Reservation exceeds the remaining order quantity.'; return s; }
      const eligible = s.finishedGoods.filter(item =>
        finishedPipeInventory(item, s).available === 1
        && item.qualityStatus === 'Pass'
        && item.releaseStatus !== 'Released'
        && item.status === 'Available'
        && item.locationStatus === 'Stored'
        && item.availableQty === 1
        && item.product === order.product
        && item.diameter === order.diameter
        && item.length === order.length
        && item.sdr === order.sdr
        && normalizeMaterialGrade(item.grade) === normalizeMaterialGrade(order.grade)
        && item.color === order.color
        && item.stripe === order.stripe
        && item.construction === order.construction
        && item.productForm === order.productForm
      );
      if (quantity > eligible.length) {
        result = { success: false, error: `INSUFFICIENT FINISHED GOODS|Requested: ${quantity}|Available for new reservation: ${eligible.length}|Shortage: ${quantity - eligible.length}` };
        return s;
      }
      const ids = new Set(eligible.slice(0, quantity).map(item => item.id));
      const now = new Date();
      const reserveTransactions: Transaction[] = eligible.slice(0, quantity).map((item, index) => ({
        id: `tx-reserve-${now.getTime()}-${index}`,
        txId: `TX-RES-${now.getTime()}-${index}`,
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 5),
        employee: s.currentUser!.name,
        employeeId: s.currentUser!.employeeId,
        role: 'Marketing',
        transactionType: 'Finished Pipe Reserved',
        materialCategory: 'Finished Pipe',
        productType: item.product,
        item: `${item.product} ${item.diameter}`,
        batch: item.batch,
        barcode: item.barcode,
        qtyBefore: 1,
        qtyChanged: 0,
        qtyAfter: 1,
        source: item.currentLocation,
        destination: `Reserved for ${order.orderNo}`,
        reference: order.orderNo,
        status: 'Completed',
      }));
      result = { success: true };
      return {
        ...s,
        finishedGoods: s.finishedGoods.map(item => ids.has(item.id) ? {
          ...item,
          availableQty: 0,
          reservedQty: 1,
          status: 'Reserved' as const,
          inventoryPurpose: 'General Inventory' as const,
          reservationStatus: 'Reserved' as const,
          reservedForOrderId: order.id,
          reservedForOrderRef: order.orderNo,
          orderReference: order.orderNo,
          buyer: order.customerName,
        } : item),
        orders: s.orders.map(item => item.id === order.id ? {
          ...item,
          reservedQuantity: (item.reservedQuantity || 0) + quantity,
          availableStock: eligible.length - quantity,
          status: (item.reservedQuantity || 0) + quantity >= item.quantity ? 'Active' as const : item.status,
        } : item),
        transactions: [...reserveTransactions, ...s.transactions],
        auditLogs: [{
          id: `al-reservation-${now.getTime()}`, user: s.currentUser.name, employeeId: s.currentUser.employeeId,
          role: 'Marketing', action: 'Finished Goods Reserved', date: now.toISOString().slice(0, 10),
          time: now.toTimeString().slice(0, 5), reference: order.orderNo,
          previousValue: `${eligible.length} available`, newValue: `${quantity} reserved`,
        }, ...s.auditLogs],
      };
    });
    return result;
  }, []);

  const rejectFinishedGood = useCallback((fgId: string, weightKg: number, reason: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: 'Quality rejection could not be saved.' };
    setState(s => {
      const fg = s.finishedGoods.find(item => item.id === fgId);
      const po = fg && s.productionOrders.find(item => item.poNo === fg.poRef);
      if (
        !fg || !po || s.currentUser?.role !== 'plantmanager'
        || fg.releaseStatus === 'Released' || fg.qualityStatus === 'Reject'
        || !Number.isFinite(weightKg) || weightKg <= 0 || !reason.trim()
      ) return s;
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const rejection: RejectedMaterial = {
        id: `rj-quality-${now.getTime()}`,
        rejectionId: `RJ-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`,
        poRef: po.poNo,
        product: `${fg.product} ${fg.diameter}`,
        batch: fg.batch,
        quantity: 1,
        weightKg: roundKg(weightKg),
        reason: reason.trim(),
        employee: s.currentUser.name,
        shift: fg.shift,
        date,
        allocatedWeightKg: 0,
        allocationStatus: 'Unallocated',
      };
      result = { success: true };
      return {
        ...s,
        finishedGoods: s.finishedGoods.map(item => item.id === fgId ? {
          ...item,
          qualityStatus: 'Reject' as const,
          status: 'Quality Reject' as const,
          availableQty: 0,
          reservedQty: 0,
          locationStatus: 'Rejected Material' as const,
          currentLocation: 'Rejected Material / Awaiting Recycling',
          reservedForOrderId: undefined,
          reservedForOrderRef: undefined,
        } : item),
        productionOrders: s.productionOrders.map(item => item.id === po.id ? {
          ...item,
          totalGoodQty: Math.max(0, (item.totalGoodQty || item.completedQty - (item.totalRejectedQty || 0)) - 1),
          totalRejectedQty: (item.totalRejectedQty || 0) + 1,
          totalRejectedWeightKg: roundKg((item.totalRejectedWeightKg || 0) + weightKg),
        } : item),
        orders: fg.reservedForOrderId ? s.orders.map(item => item.id === fg.reservedForOrderId ? {
          ...item,
          reservedQuantity: Math.max(0, (item.reservedQuantity || 0) - 1),
        } : item) : s.orders,
        rejectedMaterials: [rejection, ...s.rejectedMaterials],
        auditLogs: [{
          id: `al-quality-reject-${now.getTime()}`, user: s.currentUser.name, employeeId: s.currentUser.employeeId,
          role: 'Plant Manager', action: 'Finished Pipe Quality Rejected',
          date, time: now.toTimeString().slice(0, 5), reference: fg.barcode,
          previousValue: fg.status, newValue: `Quality Reject · ${reason.trim()} · ${roundKg(weightKg)} kg`,
        }, ...s.auditLogs],
      };
    });
    return result;
  }, []);

  const markFinishedGoodLoaded = useCallback((fgId: string) => {
    let loaded = false;
    setState(s => {
      const fg = s.finishedGoods.find(pipe => pipe.id === fgId);
      if (s.currentUser?.role !== 'production' || !fg || fg.fulfillmentStatus === 'Loaded' || finishedPipeInventory(fg, s).bucket !== 'Ready for Ship Out') return s;
      const now = new Date(); loaded = true;
      const onHand = finishedGoodsSummary(s.finishedGoods, s).onHand;
      return { ...s,
        finishedGoods: s.finishedGoods.map(pipe => pipe.id === fgId ? { ...pipe, fulfillmentStatus: 'Loaded' as const } : pipe),
        transactions: [{ id: `tx-loaded-${now.getTime()}`, txId: `TX-LOADED-${now.getTime()}`, date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5), employee: s.currentUser.name, employeeId: s.currentUser.employeeId, role: 'Production', transactionType: 'Finished Pipe Loaded', materialCategory: 'Finished Pipe' as const, item: `${fg.product} ${fg.diameter}`, batch: fg.batch, barcode: fg.barcode, qtyBefore: onHand, qtyChanged: 0, qtyAfter: onHand, source: fg.currentLocation, destination: fg.currentLocation, reference: fg.reservedForOrderRef || fg.poRef, status: 'Completed' }, ...s.transactions],
      };
    });
    return loaded;
  }, []);

  const releaseFinishedGood = useCallback((fgId: string, scannerMeta?: PhysicalScanMeta) => {
    let released = false;
    flushSync(() => setState(s => {
      if (s.currentUser?.role !== 'production') return s;
      const fg = s.finishedGoods.find(item => item.id === fgId);
      const order = fg ? resolveFinishedPipe(fg, s).order : undefined;
      if (!fg || !exactPhysicalScan(scannerMeta, fg, s.finishedGoods) || !order || scannerMeta?.orderId !== order.id) return s;
      if (
        !fg || !order || fg.releaseStatus === 'Released' || fg.qualityStatus !== 'Pass'
        || finishedPipeInventory(fg, s).bucket !== 'Ready for Ship Out'
        || (!!fg.reservedForOrderId && fg.reservedForOrderId !== order.id)
      ) return s;
      released = true;
      const quantity = 1;
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 5);
      return {
        ...s,
        finishedGoods: s.finishedGoods.map(item => item.id === fgId
          ? {
              ...item, availableQty: 0, reservedQty: 0, status: 'Released' as const,
              releaseStatus: 'Released' as const, locationStatus: 'Released' as const,
              reservationStatus: 'Shipped Out' as const,
              fulfillmentStatus: 'Shipped' as const,
              releasedBy: s.currentUser!.name, releasedAt: now.toISOString(),
              releaseReference: order.orderNo,
              currentLocation: 'Released / Shipped Out',
              locationHistory: [...(item.locationHistory || []), {
                from: item.currentLocation || 'Not Yet Assigned',
                to: 'Released / Shipped Out',
                action: 'Released' as const,
                employee: s.currentUser!.name,
                employeeId: s.currentUser!.employeeId,
                dateTime: now.toISOString(),
              }],
            }
          : item),
        orders: s.orders.map(item => item.id === order.id ? {
          ...item,
          releasedQuantity: (item.releasedQuantity || 0) + 1,
          reservedQuantity: Math.max(0, (item.reservedQuantity || 0) - quantity),
          status: (item.releasedQuantity || 0) + 1 >= item.quantity ? 'Released' as const : item.status,
          availableStock: Math.max(0, item.availableStock || 0),
        } : item),
        transactions: [{
          id: `tx${Date.now()}`,
          txId: `TX-${Date.now()}`,
          date, time,
          employee: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Production',
          transactionType: 'Finished Pipe Released',
          materialCategory: 'Finished Pipe',
          productType: fg.product,
          item: `${fg.product} ${fg.diameter}`,
          batch: fg.batch,
          barcode: fg.barcode,
          qtyBefore: finishedGoodsSummary(s.finishedGoods, s).onHand,
          qtyChanged: -quantity,
          qtyAfter: Math.max(0, finishedGoodsSummary(s.finishedGoods, s).onHand - quantity),
          source: fg.currentLocation,
          destination: order.customerName,
          reference: order.orderNo,
          status: 'Completed',
          shift: scannerMeta?.shift,
          scannerMode: scannerMeta?.scannerMode,
        }, ...s.transactions],
        auditLogs: [{
          id: `al${Date.now()}`,
          user: s.currentUser.name,
          employeeId: s.currentUser.employeeId,
          role: 'Production',
          action: 'Finished Goods Released',
          date, time,
          reference: order.orderNo,
        }, ...s.auditLogs],
      };
    }));
    return released;
  }, []);

  const completeRecyclingBatch = useCallback((batchId: string, recoveredKg: number, outputColor: string) => {
    setState(s => {
      const color = newPelletColor('Recycled', outputColor);
      if (!color) return s;
      const batch = s.recyclingBatches.find(item => item.id === batchId);
      if (!batch || batch.status !== 'Pelletizing' || recoveredKg < 0 || recoveredKg > (batch.cutMaterialKg ?? batch.originalKg)) return s;
      const sourceGrade = normalizeMaterialGrade(
        s.productionOrders.find(item => item.poNo === batch.sourcePO)?.grade || 'PE100'
      );
      if (!isSupportedMaterialGrade(sourceGrade)) return s;
      if (incompatibleRecycledCarry(s.recyclingBatches, batch, color, item => normalizeMaterialGrade(s.productionOrders.find(po => po.poNo === item.sourcePO)?.grade || 'PE100'))) return s;
      const carriedLooseKg = roundKg(s.recyclingBatches
        .filter(item =>
          item.id !== batchId
          && item.status === 'Completed'
          && normalizeMaterialGrade(s.productionOrders.find(po => po.poNo === item.sourcePO)?.grade || 'PE100') === sourceGrade
        )
        .reduce((sum, item) => sum + (item.looseKg || 0), 0));
      const bagging = calculateRecycledBagging(recoveredKg, carriedLooseKg);
      const metrics = calculateRecyclingMetrics(
        batch.originalKg,
        batch.cutMaterialKg ?? batch.originalKg,
        recoveredKg,
      );
      const existingBags = s.pellets.filter(item => item.recyclingBatchRef === batch.batchNo);
      if (existingBags.some(bag => normalizeRecycledPelletColor(bag.color) !== color)) return s;
      const bags = existingBags.length || !bagging.completeBags
        ? []
        : makePermanentPelletBags(bagging.completeBags, {
            type: 'Recycled',
            batchNo: batch.batchNo,
            grade: sourceGrade,
            color,
            receivedDate: new Date().toISOString().slice(0, 10),
            recyclingBatchRef: batch.batchNo,
          }, s.barcodeRegistry, s.pellets);
      return {
        ...s,
        recyclingBatches: s.recyclingBatches.map(item => item.id === batchId ? {
          ...item,
          status: 'Completed' as const,
          color,
          recoveredKg: roundKg(recoveredKg),
          lossKg: metrics.recyclingProcessLossKg,
          recyclingProcessLossKg: metrics.recyclingProcessLossKg,
          totalRecyclingLossKg: metrics.totalRecyclingLossKg,
          recoveryRate: metrics.recoveryRate,
          completeBags: bagging.completeBags,
          looseKg: bagging.looseKg,
        } : item.status === 'Completed'
          && (item.looseKg || 0) > 0
          && normalizeMaterialGrade(s.productionOrders.find(po => po.poNo === item.sourcePO)?.grade || 'PE100') === sourceGrade
          ? { ...item, looseKg: 0 }
          : item),
        rejectedMaterials: s.rejectedMaterials.map(item =>
          item.recyclingBatchRef === batch.batchNo ? { ...item, allocationStatus: 'Completed' as const } : item
        ),
        pellets: bags.length ? [...bags, ...s.pellets] : s.pellets,
        barcodeRegistry: bags.length
          ? [...registryEntriesForPellets(bags), ...s.barcodeRegistry]
          : s.barcodeRegistry,
      };
    });
  }, []);

  const updateRecyclingStage = useCallback((batchId: string, action: 'start-cutting' | 'complete-cutting' | 'submit-weight' | 'start-crushing' | 'complete-crushing' | 'start-pelletizing', weightKg?: number) => {
    let result: { success: boolean; error?: string } = { success: false };
    setState(s => {
      const batch = s.recyclingBatches.find(item => item.id === batchId);
      if (!batch || s.currentUser?.role !== 'production') return s;
      const now = new Date();
      let updates: Partial<RecyclingBatch> | null = null;
      if (action === 'start-cutting' && batch.status === 'Ready for Cutting') {
        updates = { status: 'Cutting', cutBy: s.currentUser.name, cutAt: now.toISOString() };
      } else if (action === 'complete-cutting' && batch.status === 'Cutting') {
        updates = { status: 'Weighing' };
      } else if (action === 'submit-weight' && batch.status === 'Weighing') {
        if (!Number.isFinite(weightKg) || (weightKg ?? 0) <= 0 || (weightKg ?? 0) > batch.originalKg) {
          result = { success: false, error: 'Enter a cut material weight that does not exceed the original rejected weight.' };
          return s;
        }
        const cutting = calculateCuttingLoss(batch.originalKg, weightKg!);
        updates = {
          status: 'Awaiting Crushing Confirmation',
          cutMaterialKg: weightKg,
          cuttingLossKg: cutting.lossKg,
          weighedBy: s.currentUser.name,
          weighedAt: now.toISOString(),
          confirmationStatus: 'Pending',
        };
      } else if (action === 'start-crushing') {
        if (batch.status === 'Awaiting Crushing Confirmation' || batch.confirmationStatus !== 'Confirmed') {
          result = { success: false, error: 'CRUSHING NOT YET APPROVED — This recycling batch must be confirmed by the Plant Manager before Crushing can begin.' };
          return s;
        }
        if (batch.status === 'Ready for Crushing') updates = { status: 'Crushing' };
      } else if (action === 'complete-crushing' && batch.status === 'Crushing') {
        updates = { status: 'Ready for Pelletizing' };
      } else if (action === 'start-pelletizing' && batch.status === 'Ready for Pelletizing') {
        updates = { status: 'Pelletizing' };
      }
      if (!updates) return s;
      result = { success: true };
      return {
        ...s,
        recyclingBatches: s.recyclingBatches.map(item => item.id === batchId ? { ...item, ...updates } : item),
      };
    });
    return result;
  }, []);

  const confirmRecyclingForCrushing = useCallback((batchId: string) => {
    let confirmed = false;
    setState(s => {
      const batch = s.recyclingBatches.find(item => item.id === batchId);
      if (!batch || batch.status !== 'Awaiting Crushing Confirmation' || s.currentUser?.role !== 'plantmanager' || batch.confirmationStatus === 'Confirmed') return s;
      confirmed = true;
      const now = new Date();
      return {
        ...s,
        recyclingBatches: s.recyclingBatches.map(item => item.id === batchId ? {
          ...item,
          status: 'Ready for Crushing' as const,
          confirmationStatus: 'Confirmed' as const,
          confirmedBy: s.currentUser!.name,
          confirmedAt: now.toISOString(),
        } : item),
        notifications: [{
          id: `n${Date.now()}`,
          title: 'Recycling Batch Ready for Crushing',
          description: `Recycling Batch ${batch.batchNo} is ready for Crushing.`,
          datetime: now.toISOString().slice(0, 16).replace('T', ' '),
          priority: 'Action Required',
          read: false,
          roles: ['production'],
        }, ...s.notifications],
      };
    });
    return confirmed;
  }, []);

  // Physical records are authoritative. Reconcile them into the shared registry
  // so every barcode shown in inventory remains searchable even if older state
  // was created before its registry entry was persisted.
  const sharedBarcodeRegistry = useMemo(() => {
    const records = new Map<string, BarcodeRegistryRecord>();
    state.barcodeRegistry.forEach(record => {
      const key = normalizeBarcodeValue(record.barcode);
      if (key) records.set(key, record);
    });
    [
      ...registryEntriesForPellets(state.pellets),
      ...registryEntriesForFinishedGoods(state.finishedGoods),
    ].forEach(record => {
      const key = normalizeBarcodeValue(record.barcode);
      if (key && !records.has(key)) records.set(key, record);
    });
    return Array.from(records.values());
  }, [state.barcodeRegistry, state.pellets, state.finishedGoods]);
  const sharedRejectedKg = useMemo(() =>
    roundKg(state.rejectedMaterials.reduce(
      (sum, item) => sum + Math.max(0, item.weightKg - (item.allocatedWeightKg || 0)),
      0,
    )),
  [state.rejectedMaterials]);
  const activeAttendance = useMemo(() =>
    state.attendance.find(record =>
      record.employeeId === state.currentUser?.employeeId && record.status === 'Active'
    ) || null,
  [state.attendance, state.currentUser]);
  const currentSessionTransactions = useMemo(() =>
    activeAttendance
      ? state.transactions.filter(transaction => transactionBelongsToSession(transaction, activeAttendance))
      : [],
  [state.transactions, activeAttendance]);
  const activeProductionOrder = useMemo(() =>
    activeAttendance
      ? findSessionProductionOrder(state.productionOrders, state.transactions, activeAttendance)
      : null,
  [state.productionOrders, state.transactions, activeAttendance]);
  const currentSessionTurnover = useMemo(() =>
    activeAttendance
      ? state.turnovers.find(turnover => turnover.attendanceSessionId === activeAttendance.id) || null
      : null,
  [state.turnovers, activeAttendance]);
  const currentMaterialUsage = useMemo(() =>
    calculateMaterialUsage(state.materialUsageTransactions || [], activeAttendance || undefined, activeProductionOrder || undefined),
  [state.materialUsageTransactions, activeAttendance, activeProductionOrder]);
  const verifiedPendingTurnover = useMemo(() =>
    state.currentUser
      ? findPendingTurnover(state.turnovers, state.productionOrders, state.currentShift, state.currentUser.employeeId)
      : null,
  [state.turnovers, state.productionOrders, state.currentShift, state.currentUser]);

  const value: AppContextValue = {
    ...state,
    selectedReprintRequestId, openReprintRequest, submitReprintRequest, decideReprintRequest, beginPrint, finishPrint,
    pendingTurnover: verifiedPendingTurnover,
    colorants: state.colorants || INITIAL_COLORANTS,
    materialUsageTransactions: state.materialUsageTransactions || [],
    totalRejectedKg: sharedRejectedKg,
    barcodeRegistry: sharedBarcodeRegistry,
    barcodeResetVersion: BARCODE_TEST_RESET_VERSION,
    activeAttendance,
    activeProductionOrder,
    currentSessionTurnover,
    currentSessionTransactions,
    currentMaterialUsage,
    setTheme, login, logout, navigate, clockIn, clockOut,
    markNotificationsRead, markNotificationRead, approveMaterialRequest, rejectMaterialRequest,
    acceptTurnover, addEmployee, updateEmployee, assignEmployeeShift, addCustomer, createCustomerOrder, createReceivingReport, createTransfer, ensureExpectedPelletBags, updatePO, startProduction, recordOutput,
    dispatchTransfer, finishWipBag, addMaterialRequest, loadPellets, recordColorantUsage, submitTurnover, updateFinishedGoodStorage,
    createProductionOrder, createStockReplenishmentPO,
    receivePellet, acceptScannedPelletTransfer, confirmTransferReceipt, relocatePhysicalItem, reserveFinishedGoods, rejectFinishedGood, releaseFinishedGood, markFinishedGoodLoaded, completeRecyclingBatch,
    updateRecyclingStage, confirmRecyclingForCrushing,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
