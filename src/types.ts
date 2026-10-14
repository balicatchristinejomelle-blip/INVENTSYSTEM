export type Role = 'OWNER_SUPER_ADMIN' | 'accounting' | 'marketing' | 'management' | 'plantmanager' | 'production';
export type Plant = 'Main Plant' | 'Branch Plant' | 'Company Wide';
export type Theme = 'light' | 'dark';
export type ProductType = 'HDPE Pipe' | 'CTS HDPE Pipe' | 'Commercial HDPE Pipe (CGPE)' | 'Spiral Pipe' | 'Polytube';
export type MaterialGrade = 'HDPE Standard' | 'PE100' | 'Commercial Grade (CGPE)' | 'CTS Grade';
export type ProductMaterialGrade = MaterialGrade | 'PE80';

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  name: string;
  plant: Plant;
  employeeId: string;
  status: 'active' | 'inactive';
  defaultShift?: 'Day' | 'Night' | 'Rotating';
  lastLogin?: string;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  datetime: string;
  priority: 'Information' | 'Action Required' | 'Urgent';
  read: boolean;
  link?: string;
  reference?: string;
  roles: Role[];
  recipientEmployeeId?: string;
  reprintRequestId?: string;
}

export interface ProductSpecification {
  itemCode?: string;
  seasonal?: boolean;
  id: string;
  productType: ProductType;
  materialGrade: ProductMaterialGrade;
  size: string;
  sizeUnit: 'mm' | 'in' | 'configured';
  sdr: string;
  productForm: 'Straight Length' | 'Coil';
  straightLength?: string;
  coilLength?: string;
  color: string;
  stripe: string;
  pipeConstruction: 'Solid Wall Pipe' | 'CTS Pipe' | 'Commercial Pipe' | 'Spiral Tube' | 'Polytube';
  unitWeightKg?: number;
  active: boolean;
}

export interface StockTarget {
  id: string;
  plant: Exclude<Plant, 'Company Wide'>;
  inventoryType: 'Finished Pipe' | 'Virgin Pellet' | 'Recycled Pellet' | 'Colorant';
  productSpecificationId?: string;
  materialGrade?: MaterialGrade;
  color?: string;
  colorantUsageType?: 'BASE_COLORANT' | 'STRIPE_COLORANT';
  minimumStock: number;
  targetStock: number;
  status: 'Active' | 'Inactive';
}

export interface StorageLocation {
  id: string;
  name: string;
  plant: Exclude<Plant, 'Company Wide'>;
  locationType: 'Production Area' | 'Finished Goods Area' | 'Raw Material Area' | 'Staging Area';
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface RecordHistoryEvent {
  id: string;
  datetime: string;
  title: string;
  description?: string;
  actor?: string;
}

export interface LinkedRecord {
  id: string;
  label: string;
  reference: string;
  page: string;
  status?: string;
}

export interface LifecycleStep {
  label: string;
  state: 'complete' | 'current' | 'upcoming';
}

export interface MaterialRequest {
  id: string;
  refNo: string;
  date: string;
  requestedBy: string;
  materialCategory?: 'Virgin Pellet' | 'Recycled Pellet' | 'Colorant';
  pelletType: 'Virgin' | 'Recycled';
  grade: string;
  color: string;
  requestedKg: number;
  requestedBags?: number;
  colorantUsageType?: 'BASE_COLORANT' | 'STRIPE_COLORANT';
  destination?: string;
  status: 'New' | 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
  approvedBy?: string;
  approvedDate?: string;
  moRef?: string;
  poRef?: string;
}

export interface Transfer {
  id: string;
  refNo: string;
  date: string;
  materialCategory?: 'Virgin Pellet' | 'Recycled Pellet' | 'Colorant';
  pelletType: string;
  grade: string;
  color: string;
  colorantUsageType?: 'BASE_COLORANT' | 'STRIPE_COLORANT';
  colorantId?: string;
  batchNo: string;
  weightKg: number;
  numberOfBags?: number;
  source: string;
  destination: string;
  status: 'Preparing' | 'In Transit' | 'Receiving Discrepancy' | 'Received';
  sentQuantity?: number;
  receivedQuantity?: number;
  discrepancyQuantity?: number;
  discrepancyReason?: 'Missing' | 'Damaged' | 'Wrong Item' | 'Quantity Error' | 'Other';
  discrepancyNotes?: string;
  resolvedBy?: string;
  resolvedRole?: string;
  resolvedAt?: string;
  requestRef?: string;
  receivedBy?: string;
  receivedDate?: string;
}

export interface RRRecord {
  id: string;
  rrNumber: string;
  date: string;
  material: string;
  pelletType: string;
  grade: string;
  color: string;
  batchNo: string;
  weightKg: number;
  numberOfBags?: number;
  weightPerBagKg?: number;
  supplier: string;
  referenceNo: string;
  destination: string;
  status: 'Pending' | 'Verified' | 'Ready for Transfer' | 'In Transit' | 'Received' | 'Completed';
  remarks?: string;
}

export interface Customer {
  id: string;
  name: string;
  code: string;
  contact: string;
  address: string;
  email?: string;
  status: 'Active' | 'Inactive';
}

export interface CustomerOrder {
  id: string;
  orderNo: string;
  orderDate: string;
  customerId: string;
  customerName: string;
  product: string;
  diameter: string;
  length: string;
  sdr: string;
  grade: string;
  color: string;
  stripe: string;
  construction: string;
  productForm: string;
  quantity: number;
  requiredDate: string;
  notes?: string;
  status: 'New' | 'Active' | 'In Production' | 'Ready for Release' | 'Released' | 'Completed';
  moRef?: string;
  availableStock?: number;
  reservedQuantity?: number;
  releasedQuantity?: number;
  matchedInventoryQuantity?: number;
  manufacturingRequiredQuantity?: number;
  manufacturedQuantity?: number;
  fulfillmentType?: 'From Inventory' | 'Mixed Fulfillment' | 'Made to Order';
}

export interface ManufacturingOrder {
  id: string;
  moNo: string;
  orderRef: string;
  product: string;
  diameter: string;
  length: string;
  sdr: string;
  grade: string;
  color: string;
  stripe: string;
  construction: string;
  productForm: string;
  requestedQty: number;
  availableQty: number;
  toManufactureQty: number;
  requiredDate: string;
  createdBy: string;
  createdDate: string;
  status: 'New' | 'In Production' | 'Completed' | 'Cancelled';
  poRef?: string;
}

export interface ProductionOrder {
  originGroup?: string;
  id: string;
  poNo: string;
  moRef: string;
  product: string;
  diameter: string;
  length: string;
  sdr: string;
  grade: string;
  color: string;
  stripe: string;
  construction: string;
  productForm: string;
  targetQty: number;
  completedQty: number;
  pelletType: string;
  requiredKg: number;
  loadedKg: number;
  productionLine: string;
  priority: 'Normal' | 'High' | 'Urgent';
  requiredDate: string;
  status: 'Scheduled' | 'Ready' | 'In Production' | 'Partially Completed' | 'Awaiting Shift Turnover' | 'Completed' | 'Cancelled';
  source?: 'Manufacturing Order' | 'Stock Replenishment';
  replenishmentReason?: string;
  assignedShift?: string;
  unitWeightKg?: number;
  materialDensityKgM3?: number;
  virginRatio?: number;
  recycledRatio?: number;
  totalGoodQty?: number;
  totalRejectedQty?: number;
  totalRejectedWeightKg?: number;
  totalPelletConsumedKg?: number;
  totalColorantConsumedKg?: number;
  totalProcessLossKg?: number;
}

export interface PelletInventory {
  id: string;
  bagNo: string;
  type: 'Virgin' | 'Recycled';
  batchNo: string;
  grade: string;
  color: string;
  availableKg: number;
  barcode: string;
  barcodeStatus: 'Generated';
  printStatus: 'Not Printed' | 'Printed';
  inventoryStatus: 'Pending Receipt' | 'Available' | 'Loaded' | 'Partially Consumed' | 'Fully Consumed';
  currentLocation: string;
  locationStatus: 'Awaiting Receipt' | 'Awaiting Storage' | 'Stored' | 'In Production' | 'Released';
  locationHistory: LocationHistoryEntry[];
  receivedDate: string;
  receivedBy?: string;
  receivedAt?: string;
  storedBy?: string;
  storedAt?: string;
  transferRef?: string;
  rrRef?: string;
  recyclingBatchRef?: string;
  lastScan?: string;
  scannedBy?: string;
  originalKg?: number;
  loadedForPOId?: string;
  loadedForPORef?: string;
  loadedAt?: string;
  fullyConsumedAt?: string;
  isTestData?: boolean;
}

export interface FinishedGood {
  source?: ProductionOrder['source'];
  productionOrderId?: string;
  manufacturingOrderId?: string;
  customerOrderId?: string;
  productSpecificationId?: string;
  itemCode?: string;
  productBarcode?: string;
  seasonal?: boolean;
  originGroup?: string;
  id: string;
  fgId: string;
  barcode: string;
  barcodeStatus: 'Generated';
  printStatus: 'Not Printed' | 'Printed';
  product: string;
  diameter: string;
  length: string;
  sdr: string;
  grade: string;
  color: string;
  stripe: string;
  construction: string;
  productForm: string;
  quantity: number;
  batch: string;
  poRef: string;
  moRef?: string;
  productionDate: string;
  shift: string;
  storageLocation: string;
  storageStatus: 'Not Stored' | 'Stored';
  currentLocation: string;
  locationStatus: 'Quality Pending' | 'Awaiting Storage' | 'Stored' | 'Released' | 'Rejected Material';
  locationHistory: LocationHistoryEntry[];
  storedBy?: string;
  storedAt?: string;
  releaseStatus: 'Not Released' | 'Released';
  availableQty: number;
  reservedQty: number;
  status: 'Quality Pending' | 'Awaiting Storage' | 'Stored' | 'Available' | 'Reserved' | 'Ready for Release' | 'Released' | 'Quality Reject' | 'Low Stock';
  qualityStatus?: 'Pending' | 'Pass' | 'Reject';
  unitWeightKg?: number;
  inventoryPurpose?: 'Unassigned' | 'General Inventory' | 'Customer Order';
  buyer?: string;
  orderReference?: string;
  reservationStatus?: 'Unassigned' | 'Available' | 'Reserved' | 'Ready for Ship Out' | 'Shipped Out';
  reservedForOrderId?: string;
  reservedForOrderRef?: string;
  releasedBy?: string;
  releasedAt?: string;
  releaseReference?: string;
  shipmentReference?: string;
  isTestData?: boolean;
}

export interface LocationHistoryEntry {
  from: string;
  to: string;
  action: 'Received' | 'Stored' | 'Loaded' | 'Reserved' | 'Released' | 'Relocated';
  employee: string;
  employeeId: string;
  dateTime: string;
  reason?: string;
}

export interface BarcodeRegistryRecord {
  barcode: string;
  itemId: string;
  itemType: 'Virgin Pellet Bag' | 'Recycled Pellet Bag' | 'Finished Pipe';
  category: 'Pellet' | 'Finished Pipe';
  createdAt: string;
}

export interface RejectedMaterial {
  id: string;
  rejectionId: string;
  poRef: string;
  product: string;
  batch: string;
  quantity: number;
  weightKg: number;
  reason: string;
  employee: string;
  shift: string;
  date: string;
  recyclingBatchRef?: string;
  allocatedWeightKg?: number;
  allocationStatus?: 'Unallocated' | 'Allocated' | 'Processing' | 'Completed';
  isTestData?: boolean;
}

export interface RecyclingBatch {
  id: string;
  batchNo: string;
  originalKg: number;
  date: string;
  status: 'Collecting' | 'Ready for Cutting' | 'Cutting' | 'Weighing' | 'Awaiting Crushing Confirmation' | 'Ready for Crushing' | 'Crushing' | 'Ready for Pelletizing' | 'Pelletizing' | 'Completed';
  employees: string[];
  sourcePO?: string;
  product?: string;
  rejectReasons?: string[];
  cutMaterialKg?: number;
  cuttingLossKg?: number;
  cutBy?: string;
  cutAt?: string;
  weighedBy?: string;
  weighedAt?: string;
  confirmationStatus?: 'Pending' | 'Confirmed';
  confirmedBy?: string;
  confirmedAt?: string;
  recoveredKg?: number;
  /** Legacy alias for recyclingProcessLossKg. */
  lossKg?: number;
  recyclingProcessLossKg?: number;
  totalRecyclingLossKg?: number;
  recoveryRate?: number;
  completeBags?: number;
  looseKg?: number;
  recycledBatchBarcode?: string;
}

export interface ShiftAttendance {
  id: string;
  employeeId: string;
  employeeName: string;
  shift: 'Day' | 'Night';
  date: string;
  clockIn: string;
  clockOut?: string;
  durationMinutes?: number;
  status: 'Active' | 'Completed';
}

export interface ShiftTurnover {
  id: string;
  turnoverNo: string;
  outgoingEmployee: string;
  outgoingEmployeeId: string;
  outgoingShift: 'Day' | 'Night';
  incomingShift: 'Day' | 'Night';
  poRef: string;
  productionLine: string;
  targetQty: number;
  completedThisShift: number;
  totalCompleted: number;
  remaining: number;
  pelletType: string;
  pelletBatch: string;
  pelletLoaded: number;
  pelletUsed: number;
  rejectedQty: number;
  rejectedKg: number;
  goodQty?: number;
  rejectReasons?: string[];
  virginBagsUsed?: number;
  virginWeightUsed?: number;
  recycledBagsUsed?: number;
  recycledWeightUsed?: number;
  colorantUsed?: number;
  colorantTypes?: string[];
  baseColorantUsed?: number;
  baseColorantTypes?: string[];
  stripeColorantUsed?: number;
  stripeColorantTypes?: string[];
  totalColorantWeight?: number;
  totalPelletWeight?: number;
  totalMaterialWeight?: number;
  pelletWipRemaining?: number;
  processLossKg?: number;
  clockIn?: string;
  moRef?: string;
  customerOrderRef?: string;
  product?: string;
  specifications?: string;
  productionStage: string;
  machineCondition: 'Normal' | 'Needs Attention' | 'Maintenance Required';
  lineCondition?: string;
  lineConditionOther?: string;
  issueCategory?: string;
  issueDescription?: string;
  issuesEncountered: string;
  nextRequiredAction?: string;
  nextRequiredActionOther?: string;
  notesForIncoming: string;
  instructionType?: string;
  importantInstructions?: string;
  date: string;
  time: string;
  submittedAt?: string;
  clockOut?: string;
  attendanceSessionId?: string;
  productionOrderId?: string;
  status: 'Pending' | 'Accepted';
  acceptedBy?: string;
  acceptedByEmployeeId?: string;
  acceptedIncomingShift?: 'Day' | 'Night';
  acceptedAttendanceSessionId?: string;
  acceptedProductionOrderId?: string;
  acceptedTime?: string;
  acceptedAt?: string;
}

export interface AuditLog {
  id: string;
  user: string;
  employeeId: string;
  role: string;
  action: string;
  date: string;
  time: string;
  reference?: string;
  previousValue?: string;
  newValue?: string;
}

export interface Transaction {
  id: string;
  txId: string;
  date: string;
  time: string;
  employee: string;
  employeeId: string;
  role: string;
  transactionType: string;
  materialCategory?: 'Virgin Pellet' | 'Recycled Pellet' | 'Colorant' | 'Finished Pipe';
  productType?: string;
  poRef?: string;
  item: string;
  batch: string;
  barcode?: string;
  qtyBefore: number;
  qtyChanged: number;
  qtyAfter: number;
  source: string;
  destination: string;
  reference: string;
  status: string;
  shift?: string;
  scannerMode?: string;
  attendanceSessionId?: string;
  productionOrderId?: string;
  isTestData?: boolean;
  processLossKg?: number;
  unitWeightKg?: number;
  totalMaterialKg?: number;
}

export interface ColorantInventory {
  id: string;
  colorantId: string;
  name: string;
  color: string;
  colorCode: 'BK' | 'BE' | 'OR' | 'RO' | 'GRN';
  usageType: 'BASE_COLORANT' | 'STRIPE_COLORANT';
  availableKg: number;
  unit: 'kg';
  inventoryClass: 'Raw Materials';
  status: 'Available' | 'Low Stock' | 'Out of Stock';
  dateReceived?: string;
  lastUpdated: string;
  sourceReference?: string;
  isTestData?: boolean;
}

export interface MaterialUsageTransaction {
  id: string;
  transactionId: string;
  productionOrderId: string;
  productionOrderRef: string;
  employeeId: string;
  employeeName: string;
  attendanceSessionId: string;
  shift: 'Day' | 'Night';
  materialType: 'VIRGIN_PELLET' | 'RECYCLED_PELLET' | 'COLORANT';
  materialId: string;
  materialName: string;
  quantity: number;
  unit: 'kg';
  dateTime: string;
  sourceReference?: string;
  physicalBagId?: string;
  barcode?: string;
  pelletType?: 'Virgin' | 'Recycled';
  color?: string;
  usageType?: 'BASE_COLORANT' | 'STRIPE_COLORANT';
  usageStage?: 'CONSUMED';
  outputTransactionId?: string;
  isTestData?: boolean;
}

export interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  username: string;
  role: 'production' | 'plantmanager';
  plant: 'Branch Plant';
  defaultShift: 'Day' | 'Night' | 'Rotating' | 'Assign Later';
  status: 'Active' | 'Inactive';
  lastLogin?: string;
}
