import React from 'react';
import { useApp } from '../store';
import { readPipeSpecifications } from '../finishedPipeRelations';
import { batchOriginTrace } from '../productionGroups';
import type { FinishedGood } from '../types';
import RecordReference, { RelatedRecords } from './RecordReference';

export default function BatchTraceability({ pipes }: { pipes: readonly FinishedGood[] }) {
  const app = useApp();
  const trace = batchOriginTrace(pipes, { ...app, specifications: readPipeSpecifications() });
  const fields = { 'Origin Group': trace.originGroup, 'Group Type': trace.groupType, 'Item Code': trace.itemCode, 'Product Barcode': trace.productBarcode, 'Production Order': trace.po,
    'Manufacturing Order': trace.mo, 'Customer Order': trace.order, Buyer: trace.buyer, 'Storage Purpose': trace.purpose, Shift: trace.shift, 'Temporary Storage': trace.temporary };
  return <section className="batch-traceability">
    <div className="section-title">Production Origin {trace.seasonal && <span className="badge-amber">SEASONAL</span>}</div>
    <div className="responsive-grid">{Object.entries(fields).map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value"><RecordReference value={value} /></div></div>)}</div>
    <RelatedRecords references={[trace.originGroup, trace.po, trace.mo, trace.order].filter((value): value is string => typeof value === 'string')} />
  </section>;
}
