import type {
  CustomerOrder,
  ManufacturingOrder,
  MaterialRequest,
  ProductionOrder,
  RecyclingBatch,
  RRRecord,
  Transfer,
} from './types';
import type { DocumentField, PrintableDocument } from './components/DocumentViewer';
import { requestCategory, transferCategory } from './inventoryCategories';

const fields = (values: Array<[string, unknown]>): DocumentField[] =>
  values
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => ({ label, value: String(value) }));

export const customerOrderDocument = (order: CustomerOrder): PrintableDocument => ({
  type: 'CUSTOMER ORDER',
  reference: order.orderNo,
  date: order.orderDate,
  status: order.status,
  sections: [
    { title: 'Customer & Order', fields: fields([
      ['Order Number', order.orderNo], ['Customer', order.customerName], ['Required Date', order.requiredDate],
      ['Fulfillment Type', order.fulfillmentType], ['Notes', order.notes],
    ]) },
    { title: 'Product Specifications', fields: fields([
      ['Product', order.product], ['Diameter / Size', order.diameter], ['SDR', order.sdr], ['Length / Coil Length', order.length],
      ['Material Grade', order.grade], ['Color', order.color], ['Stripe', order.stripe],
      ['Construction', order.construction], ['Product Form', order.productForm],
    ]) },
    { title: 'Fulfillment', fields: fields([
      ['Order Quantity', order.quantity], ['Reserved Quantity', order.reservedQuantity ?? 0],
      ['Manufacturing Required', order.manufacturingRequiredQuantity ?? 0], ['Manufactured Quantity', order.manufacturedQuantity ?? 0],
      ['Ready for Ship Out', Math.max(0, (order.reservedQuantity ?? 0) - (order.releasedQuantity ?? 0))],
      ['Shipped Quantity', order.releasedQuantity ?? 0], ['MO Reference', order.moRef],
    ]) },
  ],
});

export const manufacturingOrderDocument = (mo: ManufacturingOrder, customer?: string): PrintableDocument => ({
  type: 'MANUFACTURING ORDER',
  reference: mo.moNo,
  date: mo.createdDate,
  status: mo.status,
  sections: [
    { title: 'Order Information', fields: fields([
      ['MO Number', mo.moNo], ['Customer Order Reference', mo.orderRef], ['Customer', customer],
      ['Created By', mo.createdBy], ['Required Date', mo.requiredDate], ['Production Order Reference', mo.poRef],
    ]) },
    { title: 'Product Specifications', fields: fields([
      ['Product Type', mo.product], ['Material Grade', mo.grade], ['Diameter / Size', mo.diameter], ['SDR', mo.sdr],
      ['Length / Coil Length', mo.length], ['Color', mo.color], ['Stripe', mo.stripe],
      ['Construction', mo.construction], ['Product Form', mo.productForm],
    ]) },
    { title: 'Quantity', fields: fields([
      ['Required Quantity', mo.requestedQty], ['Available Quantity', mo.availableQty], ['Quantity to Manufacture', mo.toManufactureQty],
    ]) },
  ],
});

export const productionOrderDocument = (po: ProductionOrder): PrintableDocument => ({
  type: 'PRODUCTION ORDER',
  reference: po.poNo,
  date: po.requiredDate,
  status: po.status,
  plant: 'Branch Plant / Production',
  sections: [
    { title: 'Order Information', fields: fields([
      ['PO Number', po.poNo], ['MO Reference', po.moRef], ['Required Production Date', po.requiredDate],
      ['Production Line', po.productionLine], ['Assigned Shift', po.assignedShift], ['Priority', po.priority],
    ]) },
    { title: 'Product Specifications', fields: fields([
      ['Product', po.product], ['Material Grade', po.grade], ['Pellet Type', po.pelletType],
      ['Diameter / Size', po.diameter], ['SDR', po.sdr], ['Length', po.length], ['Color', po.color],
      ['Stripe', po.stripe], ['Construction', po.construction], ['Product Form', po.productForm],
    ]) },
    { title: 'Production Target', fields: fields([
      ['Target Quantity', po.targetQty], ['Required Material', po.requiredKg ? `${po.requiredKg} kg` : undefined],
    ]) },
  ],
});

export const receivingReportDocument = (rr: RRRecord): PrintableDocument => ({
  type: 'RECEIVING REPORT',
  reference: rr.rrNumber,
  date: rr.date,
  status: rr.status,
  plant: rr.destination,
  sections: [
    { title: 'Receiving Information', fields: fields([
      ['RR Number', rr.rrNumber], ['Material Category', rr.material], ['Pellet Type', rr.pelletType],
      ['Material Grade', rr.grade], ['Color', rr.color], ['Batch / Receiving Reference', rr.batchNo],
      ['Supplier / Source', rr.supplier], ['Supplier Reference', rr.referenceNo],
    ]) },
    { title: 'Quantity', fields: fields([
      ['Bag Quantity', rr.numberOfBags], ['Weight per Bag', rr.weightPerBagKg ? `${rr.weightPerBagKg} kg` : undefined],
      ['Total Weight', `${rr.weightKg} kg`], ['Remarks', rr.remarks],
    ]) },
  ],
});

export const materialRequestDocument = (request: MaterialRequest): PrintableDocument => ({
  type: 'MATERIAL REQUEST',
  reference: request.refNo,
  date: request.date,
  status: request.status,
  plant: request.destination,
  sections: [
    { title: 'Request Information', fields: fields([
      ['Request Number', request.refNo], ['Requesting Plant / Department', request.destination],
      ['Requested By', request.requestedBy], ['Material Category', requestCategory(request)],
      ['Material Grade', requestCategory(request) === 'Colorant' ? undefined : request.grade],
      ['Pellet Type', requestCategory(request) === 'Colorant' ? undefined : request.pelletType],
      ['Color / Usage', requestCategory(request) === 'Colorant' ? `${request.colorantUsageType === 'STRIPE_COLORANT' ? 'Stripe' : 'Base'} · ${request.color}` : request.color],
      ['Bag Quantity', request.requestedBags], ['Requested Weight', `${request.requestedKg} kg`],
      ['MO Reference', request.moRef], ['PO Reference', request.poRef], ['Notes', request.notes],
    ]) },
    { title: 'Review', fields: fields([
      ['Reviewed By', request.approvedBy], ['Review Date', request.approvedDate],
    ]) },
  ],
});

export const transferDocument = (transfer: Transfer): PrintableDocument => ({
  type: 'MATERIAL TRANSFER',
  reference: transfer.refNo,
  date: transfer.date,
  status: transfer.status,
  plant: `${transfer.source} to ${transfer.destination}`,
  sections: [
    { title: 'Transfer Information', fields: fields([
      ['Transfer Number', transfer.refNo], ['From', transfer.source], ['To', transfer.destination],
      ['Material Category', transferCategory(transfer)], ['Material Grade', transfer.grade],
      ['Pellet Type', transfer.pelletType], ['Color', transfer.color], ['Batch Number', transfer.batchNo],
      ['Related Request', transfer.requestRef],
    ]) },
    { title: 'Quantity & Receipt', fields: fields([
      ['Number of Bags', transfer.numberOfBags], ['Total Weight', `${transfer.weightKg} kg`],
      ['Quantity Sent', transfer.sentQuantity], ['Quantity Received', transfer.receivedQuantity],
      ['Discrepancy', transfer.discrepancyQuantity], ['Discrepancy Reason', transfer.discrepancyReason],
      ['Discrepancy Notes', transfer.discrepancyNotes], ['Received By', transfer.receivedBy], ['Received Date', transfer.receivedDate],
      ['Resolved By', transfer.resolvedBy], ['Resolved Role', transfer.resolvedRole], ['Resolved At', transfer.resolvedAt],
    ]) },
  ],
});

export const recyclingDocument = (batch: RecyclingBatch): PrintableDocument => ({
  type: 'RECYCLING RECORD',
  reference: batch.batchNo,
  date: batch.date,
  status: batch.status,
  plant: 'Branch Plant / Recycling',
  sections: [
    { title: 'Source', fields: fields([
      ['Batch Number', batch.batchNo], ['Source PO', batch.sourcePO], ['Product', batch.product],
      ['Reject Reasons', batch.rejectReasons?.join(', ')], ['Original Rejected Weight', `${batch.originalKg} kg`],
    ]) },
    { title: 'Recorded Processing', fields: fields([
      ['Cut Material Weight', batch.cutMaterialKg == null ? undefined : `${batch.cutMaterialKg} kg`],
      ['Cutting Loss', batch.cuttingLossKg == null ? undefined : `${batch.cuttingLossKg} kg`],
      ['Recovered Pellet Weight', batch.recoveredKg == null ? undefined : `${batch.recoveredKg} kg`],
      ['Complete 25 kg Bags', batch.completeBags], ['Loose Recycled Pellets', batch.looseKg == null ? undefined : `${batch.looseKg} kg`],
      ['Cut By', batch.cutBy], ['Cut At', batch.cutAt], ['Weighed By', batch.weighedBy], ['Weighed At', batch.weighedAt],
      ['Confirmed By', batch.confirmedBy], ['Confirmed At', batch.confirmedAt],
    ]) },
  ],
});
