import React from 'react';
import { useApp } from '../store';
import { readPipeSpecifications } from '../finishedPipeRelations';
import { batchOriginTrace } from '../productionGroups';
import type { FinishedGood } from '../types';

export default function BatchTraceability({ pipes }: { pipes: readonly FinishedGood[] }) {
  const app = useApp();
  const trace = batchOriginTrace(pipes, { ...app, specifications: readPipeSpecifications() });
  const fields = { 'Origin Group': trace.originGroup, 'Group Type': trace.groupType, 'Item Code': trace.itemCode, 'Product Barcode': trace.productBarcode, 'Production Order': trace.po,
    'Manufacturing Order': trace.mo, 'Customer Order': trace.order, Buyer: trace.buyer, 'Storage Purpose': trace.purpose, Shift: trace.shift, 'Temporary Storage': trace.temporary };
  return <section className="batch-traceability">
    <div className="section-title">Production Origin {trace.seasonal && <span className="badge-amber">SEASONAL</span>}</div>
    <div className="responsive-grid">{Object.entries(fields).map(([label, value]) => <div key={label}><div className="field-label">{label}</div><div className="field-value">{value}</div></div>)}</div>
  </section>;
}
