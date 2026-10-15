import React, { createContext, useContext, useMemo, useState } from 'react';
import { useApp } from '../store';
import { buildUniversalIndex, type SearchResult } from './UniversalSearch';
import { referenceTargets, relatedReferenceValues, reverseReferenceValues, legacyReferenceMessage } from '../recordReferences';
import Modal from './Modal';
import Pagination, { pageRecords } from './Pagination';
import StatusBadge from './StatusBadge';

const ReferenceIndex = createContext<readonly SearchResult[] | null>(null);
export function RecordReferenceProvider({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const index = useMemo(() => buildUniversalIndex(app), [app]);
  return <ReferenceIndex.Provider value={index}>{children}</ReferenceIndex.Provider>;
}
function useReferenceIndex() {
  const provided = useContext(ReferenceIndex), app = useApp();
  return useMemo(() => provided ?? buildUniversalIndex(app), [provided, app]);
}
export function RelatedRecords({ record, references = [] }: { record?: object; references?: readonly string[] }) {
  const index = useReferenceIndex();
  const [page, setPage] = useState(1);
  const values = [...new Set([...references, ...(record ? [...relatedReferenceValues(record), ...reverseReferenceValues(index, record)] : [])])].filter(value => referenceTargets(index, value).length);
  return values.length ? <section className="related-reference-section"><div className="section-title">Related Records</div><div className="related-reference-list">{pageRecords(values, page).map(value => <RecordReference key={value} value={value} />)}</div>{values.length > 10 && <Pagination page={page} totalRecords={values.length} onPageChange={setPage} noun="references" />}</section> : null;
}
/** Opens read-only authorized records in place: list filters/tab/page are never replaced. */
export default function RecordReference({ value }: { value: React.ReactNode }) {
  const index = useReferenceIndex(), [open, setOpen] = useState(false), [page, setPage] = useState(1);
  const matches = typeof value === 'string' ? referenceTargets(index, value) : [];
  if (!matches.length) return <>{value}</>;
  const legacy = matches.map(result => legacyReferenceMessage(result.record, String(value))).find(Boolean);
  return <><button type="button" className="record-reference" title={legacy || `View authorized record: ${value}`} onClick={event => { event.stopPropagation(); setPage(1); setOpen(true); }}>{value}</button>
    <Modal open={open} title={`Related record · ${value}`} onClose={() => setOpen(false)} width="720px">
      <div className="page-stack">
        {legacy && <div className="alert-warning" role="status">{legacy} The old physical label is obsolete. This is read-only record traceability.</div>}
        {matches.length > 1 && <p className="helper-text">{matches.length} authorized physical records linked to this reference. No separate record is created.</p>}
        {pageRecords(matches, page).map(result => {
          const record = result.record as Record<string,unknown>;
          return <article className="app-card detail-card page-stack" key={`${result.group}:${result.id}`}>
            <div className="field-label">{result.group}</div><strong>{result.title}</strong><p>{result.subtitle}</p>
            <dl className="reference-detail-grid">{['currentLocation','receivingLocation','storageLocation','fgId','barcode','batch','batchNo','originGroup','productionDate','requiredDate'].map(key => typeof record[key] === 'string' && record[key] ? <div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{String(record[key])}</dd></div> : null)}</dl>
            {typeof record.status === 'string' && <StatusBadge status={record.status} />}
            <RelatedRecords record={result.record} />
          </article>;
        })}
        <Pagination page={page} totalRecords={matches.length} onPageChange={setPage} noun="related records" />
        <div className="form-actions"><button className="btn-secondary" onClick={() => setOpen(false)}>Close</button></div>
      </div>
    </Modal>
  </>;
}
