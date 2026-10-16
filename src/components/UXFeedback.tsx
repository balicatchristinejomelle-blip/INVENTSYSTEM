import React, { useEffect, useId, useRef, useState } from 'react';

export function ActiveFilters({ items, onClear, onRemove, compact = false, clearLabel = 'Clear filters' }: {
  items: readonly (readonly [string, string | undefined])[]; onClear: () => void; onRemove?: (label: string) => void; clearLabel?: string; compact?: boolean;
}) {
  const active = items.filter(([,value]) => !!value && !/^(all(?:\s.*)?|select .*?)$/i.test(value));
  if (!active.length) return null;
  return <div className="active-filter-summary" role="region" aria-label="Active filters">
    <span className="field-label">Active filters</span>
    <ul>{active.map(([label,value]) => <li key={label} title={`${label}: ${value}`}>{!compact && <strong>{label}: </strong>}{value}{onRemove && <button type="button" aria-label={`Clear ${label}`} onClick={() => onRemove(label)}>×</button>}</li>)}</ul>
    <button type="button" className="btn-secondary btn-compact" onClick={onClear}>{clearLabel}</button>
  </div>;
}
export function EmptyState({ message = 'No records match the selected filters.' }: { message?: string }) {
  return <div className="empty-state" role="status"><strong>{message}</strong><div>Try another search or clear the filters above.</div></div>;
}
export function TableBody({ children, emptyMessage, ...props }: React.ComponentProps<'tbody'> & { emptyMessage?: string }) {
  const body = useRef<HTMLTableSectionElement>(null), [columns, setColumns] = useState(1);
  const populated = React.Children.toArray(children).length > 0;
  useEffect(() => {
    if (populated) return;
    const header = body.current?.closest('table')?.tHead?.rows[0];
    if (header) setColumns(Array.from(header.cells).reduce((sum, cell) => sum + cell.colSpan, 0));
  }, [populated]);
  return <tbody {...props} ref={body}>{populated ? children : <tr><td colSpan={columns}><EmptyState message={emptyMessage} /></td></tr>}</tbody>;
}
const HELP: Record<string, string> = {
  Available: 'Unallocated general inventory that is physically stored and ready to reserve.',
  Reserved: 'General inventory allocated to a Customer Order; not available to another buyer.',
  'Temporary Storage': 'Customer-order production held in temporary storage; not general available stock.',
  'Ready for Ship Out': 'Physically staged for shipment; still included in company On Hand.',
  'On Hand': 'Available + Reserved + Temporary Storage + Ready for Ship Out + Awaiting Storage + Quality Pending + Held Rejected. Counts each physical pipe once; shipped pipes are excluded.',
  'Origin Group': 'The original Manufacturing Order or replenishment group; moving stock does not change it.',
  'Storage Purpose': 'Derived from the production source, not selected by the storage operator.',
  'Pipe Record ID': 'Permanent system identity of this physical pipe; different from its printable barcode.',
  'Physical Barcode': 'The current active physical label. Legacy migrated labels are obsolete.',
  'Current Location': 'The current physical storage location, not the production source or storage purpose.',
  'Material Grade': 'PE80 and PE100 are the active material grades. Historical records retain their original grade.',
};
export function TermHelp({ term, compact = false }: { term: string; compact?: boolean }) {
  const id = useId();
  const help = HELP[term];
  if (help && compact) return <span className="metric-help">
    <button type="button" className="metric-help-trigger" aria-label={`Explain ${term}`} popoverTarget={id}>?</button>
    <span id={id} popover="auto" className="metric-help-popover"><strong>{term}</strong><span>{help}</span></span>
  </span>;
  return help ? <details className="term-help"><summary aria-label={`Explain ${term}`}>?</summary><div>{help}</div></details> : null;
}
export function LastUpdated({ records }: { records: readonly object[] }) {
  const timestamps = records.flatMap(record => ['lastUpdated','storedAt','releasedAt','createdAt','dateTime','productionDate','receivedDate','date'].map(key => (record as Record<string, unknown>)[key])).filter((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && Number.isFinite(Date.parse(value)));
  const latest = timestamps.sort((a,b) => Date.parse(b) - Date.parse(a))[0];
  return latest ? <div className="last-updated">Last recorded update: <time dateTime={latest}>{latest.replace('T',' ').replace(/\.\d+Z$/, ' UTC')}</time><span> · From saved records, not a live-sync timestamp.</span></div> : null;
}
/** Observes actual newly saved IDs; never manufactures references or writes business state. */
export function useCreatedRecordNotice<T extends { id: string }>(records: readonly T[], reference: (record: T) => string) {
  const pending = useRef<{ ids: Set<string>; expires: number } | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!pending.current) return;
    const created = Date.now() <= pending.current.expires ? records.filter(record => !pending.current!.ids.has(record.id)) : [];
    pending.current = null;
    if (created.length) setMessage(`${created.map(reference).join(', ')} saved successfully.`);
  }, [records]);
  return { message, begin: () => { pending.current = { ids: new Set(records.map(record => record.id)), expires: Date.now() + 1000 }; setMessage(''); } };
}
