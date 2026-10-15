import React, { useContext, useEffect, useState } from 'react';
import { useViewState } from '../uiViewState';
import { ActiveFilters } from './UXFeedback';
import { DateSearchContext } from './DateSearchContext';
import { businessToday, effectiveDateRange, parseSpecificDate, PERIODS, specificDateLabel, type DatePeriod } from '../datePeriods';
export { dateInPeriod } from '../datePeriods';
export type { PeriodRange } from '../datePeriods';

export function usePeriod(_legacyDefault = 'all', search?: string) {
  const context = useContext(DateSearchContext);
  const query = parseSpecificDate(search || '') ? search! : parseSpecificDate(context.query) ? context.query : search ?? context.query;
  // Preserve the existing unfiltered initial view; quick periods are explicit user selections.
  const initial: DatePeriod = 'all';
  const [scope, setScope] = useViewState<DatePeriod>('date-period:v2', initial, PERIODS);
  const [anchor, setAnchor] = useViewState('date-period-anchor:v2', '');
  const [today, setToday] = useState(() => businessToday());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(businessToday()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const exactDate = parseSpecificDate(query);
  const range = effectiveDateRange(scope, query, parseSpecificDate(anchor) || today);
  // Compatibility for existing Clear Filters actions; the old floating date state is never restored.
  const setDate = (value: string) => { setAnchor(parseSpecificDate(value) || ''); setScope(value && parseSpecificDate(value) ? 'day' : 'all'); };
  return { scope, setScope, date: anchor, setDate, range, exactDate, clearExact: context.clear };
}
export type DateController = ReturnType<typeof usePeriod>;

export function DatePeriodFilter({ period, onChange, onClearExact }: {
  period: DateController; onChange?: () => void; onClearExact?: () => void;
}) {
  return <div className="date-period-filter">
    <div className="date-period-group" role="group" aria-label="Date period">
      <span className="field-label">Date</span>
      <div className="date-period-buttons">
        {PERIODS.map(scope => <button key={scope} type="button" aria-pressed={scope === period.scope}
          className="date-period-button" onClick={() => { period.setScope(scope); onChange?.(); }}>
          {scope[0].toUpperCase() + scope.slice(1)}
        </button>)}
      </div>
    </div>
    {(period.exactDate || period.scope !== 'all') && <div className="date-period-summary" role="region" aria-label="Active date filter">
      <span>{period.exactDate ? 'Date: ' + specificDateLabel(period.exactDate) : 'Period: ' + period.range.label}</span>
      <button type="button" className="date-filter-clear" aria-label={period.exactDate ? 'Clear specific date search' : 'Clear period filter'}
        onClick={() => { if (period.exactDate) (onClearExact || period.clearExact)(); else period.setDate(''); onChange?.(); }}>×</button>
    </div>}
  </div>;
}

export default function PeriodSelector({ period, search, onSearchChange, onDateChange,
  placeholder = 'Search reference, product, barcode, location, date, or status...', compact = false, filters,
}: {
  period: DateController; search?: string; onSearchChange?: (value: string) => void;
  onDateChange?: (value: string) => void; placeholder?: string; compact?: boolean; filters?: React.ReactNode;
}) {
  return <div className={'record-filter-bar' + (compact ? ' record-filter-bar-compact' : '')}>
    {onSearchChange && <input className="app-input record-search" type="search" value={search || ''}
      onChange={event => onSearchChange(event.target.value)}
      placeholder={/\bdate\b/i.test(placeholder) ? placeholder : placeholder.replace(/\.{3}$/, '') + ', or date...'}
      aria-label="Search authorized records" />}
    <DatePeriodFilter period={period} onChange={() => onDateChange?.(period.scope)}
      onClearExact={onSearchChange ? () => onSearchChange('') : undefined} />
    {onSearchChange && <ActiveFilters items={parseSpecificDate(search || '') ? [] : [['Search', search]]}
      onClear={() => onSearchChange('')} clearLabel="Clear search" />}
    {filters && <div className="record-filter-controls">{filters}</div>}
  </div>;
}
