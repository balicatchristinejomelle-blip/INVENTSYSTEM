import React, { useContext, useEffect, useState } from 'react';
import { useViewState } from '../uiViewState';
import { ActiveFilters } from './UXFeedback';
import { DateFilterRangeContext, DateSearchContext } from './DateSearchContext';
import { businessToday, effectiveDateRange, parseSpecificDate, PERIODS, specificDateLabel, shiftPeriodAnchor, type DatePeriod } from '../datePeriods';
export { dateInPeriod } from '../datePeriods';
export type { PeriodRange } from '../datePeriods';

export function usePeriod(_legacyDefault = 'all', search?: string) {
  const context = useContext(DateSearchContext);
  const query = parseSpecificDate(search || '') ? search! : parseSpecificDate(context.query) ? context.query : search ?? context.query;
  // Preserve the existing unfiltered initial view; quick periods are explicit user selections.
  const initial: DatePeriod = 'all';
  const [scope, setScope] = useViewState<DatePeriod>('date-period:v2', initial, PERIODS);
  const [anchor, setAnchor] = useViewState('date-period-anchor:v2', businessToday());
  const [today, setToday] = useState(() => businessToday());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(businessToday()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const exactDate = parseSpecificDate(query);
  const range = effectiveDateRange(scope, query, parseSpecificDate(anchor) || today);
  // Compatibility for existing Clear Filters actions; the old floating date state is never restored.
  const setDate = (value: string) => { setAnchor(parseSpecificDate(value) || ''); setScope(value && parseSpecificDate(value) ? 'day' : 'all'); };
  const changeScope = (next: DatePeriod) => { if (!parseSpecificDate(anchor)) setAnchor(today); setScope(next); };
  const move = (direction: -1 | 1) => { setAnchor(shiftPeriodAnchor(parseSpecificDate(anchor) || today, scope === 'all' ? 'day' : scope, direction)); if (scope === 'all') setScope('day'); };
  return { scope, setScope: changeScope, date: anchor, setDate, range, exactDate, clearExact: context.clear, move };
}
export type DateController = ReturnType<typeof usePeriod>;

export function DatePeriodFilter({ period, onChange, onClearExact }: {
  period: DateController; onChange?: () => void; onClearExact?: () => void;
}) {
  const publishRange = useContext(DateFilterRangeContext);
  useEffect(() => { publishRange?.(period.range); }, [publishRange, period.range.start, period.range.end, period.range.label]);
  return <div className="date-period-filter">
    <div className="date-period-group" role="group" aria-label="Date period">
      <span className="field-label">Date</span>
      <div className="date-period-buttons">
        {PERIODS.map(scope => <button key={scope} type="button" aria-pressed={scope === period.scope}
          className="date-period-button" onClick={() => { period.setScope(scope); onChange?.(); }}>
          {scope[0].toUpperCase() + scope.slice(1)}
        </button>)}
      </div>
      <div className={period.scope !== 'all' || period.exactDate ? 'date-navigation-controls' : 'date-all-summary'}>
      {(period.scope !== 'all' || period.exactDate) && <button type="button" className="date-period-button date-previous" aria-label="Previous period" disabled={!!period.exactDate} title={period.exactDate ? 'Clear the specific date search to navigate periods' : 'Previous period'} onClick={() => { period.move(-1); onChange?.(); }}>←</button>}
      <div className="date-active-range date-period-summary" aria-live="polite" role="region" aria-label="Active date filter">
        <span>{period.exactDate ? 'Date: ' + specificDateLabel(period.exactDate) : period.range.label}</span>
        {(period.exactDate || period.scope !== 'all') && <button type="button" className="date-filter-clear" aria-label={period.exactDate ? 'Clear specific date search' : 'Clear period filter'}
          onClick={() => { if (period.exactDate) (onClearExact || period.clearExact)(); else period.setDate(''); onChange?.(); }}>×</button>}
      </div>
      {(period.scope !== 'all' || period.exactDate) && <button type="button" className="date-period-button date-next" aria-label="Next period" disabled={!!period.exactDate} title={period.exactDate ? 'Clear the specific date search to navigate periods' : 'Next period'} onClick={() => { period.move(1); onChange?.(); }}>→</button>}
      </div>
    </div>
  </div>;
}

export default function PeriodSelector({ period, search, onSearchChange, onDateChange,
  placeholder = 'Search reference, product, barcode, location, date, or status...', compact = false, filters,
}: {
  period: DateController; search?: string; onSearchChange?: (value: string) => void;
  onDateChange?: (value: string) => void; placeholder?: string; compact?: boolean; filters?: React.ReactNode;
}) {
  return <div className={'record-filter-bar' + (compact ? ' record-filter-bar-compact' : '')}>
    {onSearchChange && <div className="record-search-control"><input className="app-input record-search" type="search" value={search || ''}
      onChange={event => onSearchChange(event.target.value)}
      placeholder={/\bdate\b/i.test(placeholder) ? placeholder : placeholder.replace(/\.{3}$/, '') + ', or date...'}
      aria-label="Search authorized records" /></div>}
    <DatePeriodFilter period={period} onChange={() => onDateChange?.(period.scope)}
      onClearExact={onSearchChange ? () => onSearchChange('') : undefined} />
    {onSearchChange && <ActiveFilters items={parseSpecificDate(search || '') ? [] : [['Search', search]]}
      onClear={() => onSearchChange('')} clearLabel="Clear search" />}
    {filters && <div className="record-filter-controls">{filters}</div>}
  </div>;
}
