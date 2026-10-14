import type { FinishedGood, PelletInventory, CustomerOrder, ManufacturingOrder, ProductionOrder, RRRecord, MaterialRequest, Transfer, RecyclingBatch } from './types';
import { printableKey, printState, metadataFor, type PrintableRecord, type PrintWorkflowState } from './reprintWorkflow';
import { customerOrderDocument, manufacturingOrderDocument, productionOrderDocument, receivingReportDocument, materialRequestDocument, transferDocument, recyclingDocument } from './documentPrint';
import { pipeSearchRecord, readPipeSpecifications } from './finishedPipeRelations';
import type { Customer } from './types';
import { productFilterRecord } from './productFilters';

export interface PrintableSource {
  customers?: Customer[];
  pellets: PelletInventory[]; finishedGoods: FinishedGood[]; orders: CustomerOrder[];
  manufacturingOrders: ManufacturingOrder[]; productionOrders: ProductionOrder[]; rrRecords: RRRecord[];
  materialRequests: MaterialRequest[]; transfers: Transfer[]; recyclingBatches: RecyclingBatch[];
}
export function printableRecords(source: PrintableSource): PrintableRecord[] {
  const documents = [
    ...source.orders.map(customerOrderDocument), ...source.manufacturingOrders.map(item => manufacturingOrderDocument(item)),
    ...source.productionOrders.map(productionOrderDocument), ...source.rrRecords.map(receivingReportDocument),
    ...source.materialRequests.map(materialRequestDocument), ...source.transfers.map(transferDocument), ...source.recyclingBatches.map(recyclingDocument),
  ];
  const roles: Record<string, PrintableRecord['allowedRoles']> = {
    'CUSTOMER ORDER': ['OWNER_SUPER_ADMIN', 'marketing'], 'MANUFACTURING ORDER': ['OWNER_SUPER_ADMIN', 'marketing', 'plantmanager'],
    'PRODUCTION ORDER': ['OWNER_SUPER_ADMIN', 'management', 'plantmanager', 'production'],
    'RECEIVING REPORT': ['OWNER_SUPER_ADMIN', 'accounting'], 'MATERIAL REQUEST': ['OWNER_SUPER_ADMIN', 'accounting', 'plantmanager'],
    'MATERIAL TRANSFER': ['OWNER_SUPER_ADMIN', 'accounting', 'plantmanager'], 'RECYCLING RECORD': ['OWNER_SUPER_ADMIN', 'production'],
  };
  return [
    ...documents.map(doc => ({ key: printableKey('Document', doc.type, doc.recordId), kind: 'Document' as const, recordType: doc.type, recordId: doc.recordId, reference: doc.reference, context: doc.sections.flatMap(section => section.fields.map(field => `${field.label}: ${field.value}`)).join(' '), allowedRoles: roles[doc.type] || [] })),
    ...source.pellets.filter(item => !!item.barcode).map(item => ({ key: printableKey('Barcode', 'Pellet', item.id), kind: 'Barcode' as const, recordType: 'Pellet', recordId: item.id, reference: item.bagNo, value: item.barcode, context: `${item.type} ${item.grade} ${item.batchNo}`, allowedRoles: ['plantmanager'] as PrintableRecord['allowedRoles'] })),
    ...source.finishedGoods.filter(item => !!item.barcode).map(item => ({ key: printableKey('Barcode', 'Finished Pipe', item.id), kind: 'Barcode' as const, recordType: 'Finished Pipe', recordId: item.id, reference: item.fgId, value: item.barcode, context: `${item.product} ${item.diameter} ${item.sdr} ${item.length} ${item.poRef} ${item.batch}`, allowedRoles: ['plantmanager'] as PrintableRecord['allowedRoles'] })),
  ];
}
export function hydratePrintWorkflow(source: PrintableSource, stored: Partial<PrintWorkflowState>): PrintWorkflowState {
  const printMetadata = { ...(stored.printMetadata || {}) };
  for (const record of printableRecords(source).filter(item => item.kind === 'Barcode')) {
    const physical = [...source.pellets, ...source.finishedGoods].find(item => item.id === record.recordId);
    if (printMetadata[record.key]?.printCount === undefined && physical?.printStatus === 'Printed') printMetadata[record.key] = { ...printMetadata[record.key], printCount: 1 };
  }
  return { printMetadata, reprintRequests: Array.isArray(stored.reprintRequests) ? stored.reprintRequests : [] };
}
export function documentFor(source: PrintableSource, record: PrintableRecord) {
  const records = [
    ...source.orders.map(customerOrderDocument), ...source.manufacturingOrders.map(item => manufacturingOrderDocument(item)),
    ...source.productionOrders.map(productionOrderDocument), ...source.rrRecords.map(receivingReportDocument),
    ...source.materialRequests.map(materialRequestDocument), ...source.transfers.map(transferDocument), ...source.recyclingBatches.map(recyclingDocument),
  ];
  return records.find(doc => doc.type === record.recordType && doc.recordId === record.recordId) ?? null;
}

/** Read-only search enrichment; never writes print fields into operational inventory records. */
export function withPrintSearch<T extends { id: string }>(source: PrintableSource & PrintWorkflowState, businessRecord: T): T & { printStatus?: string; reprintStatus?: string } {
  const record = printableRecords(source).find(item => item.recordId === businessRecord.id);
  if (!record) return businessRecord;
  const latestRequest = source.reprintRequests?.find(request => request.printable.key === record.key);
  const pipe = source.finishedGoods.find(item => item.id === businessRecord.id);
  const enriched = pipe ? pipeSearchRecord(pipe, { ...source, customers: source.customers || [], specifications: readPipeSpecifications() }) : productFilterRecord(businessRecord, { ...source, customers: source.customers || [], specifications: readPipeSpecifications() });
  return { ...businessRecord, ...enriched, ...metadataFor(source, record), printStatus: printState(source, record), reprintStatus: latestRequest?.status };
}
