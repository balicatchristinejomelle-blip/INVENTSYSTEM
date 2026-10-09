import React, { useMemo, useState } from 'react';

export interface PeriodRange {
  start: string;
  end: string;
  label: string;
}

const normalizedDate = (value?: string) => value?.slice(0, 10) || '';

export const dateInPeriod = (value: string | undefined, range: PeriodRange) =>
  !range.start || normalizedDate(value) === range.start;

export function usePeriod(_legacyDefault?: string) {
  const [date, setDate] = useState('');
  const range = useMemo<PeriodRange>(() => ({
    start: date,
    end: date,
    label: date || 'All dates',
  }), [date]);

  return { date, setDate, range };
}

type DateController = ReturnType<typeof usePeriod>;

export default function PeriodSelector({
  period,
  search,
  onSearchChange,
  onDateChange,
  placeholder = 'Search authorized records...',
  compact = false,
}: {
  period: DateController;
  search?: string;
  onSearchChange?: (value: string) => void;
  onDateChange?: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <div className={`record-filter-bar${compact ? ' record-filter-bar-compact' : ''}`}>
      {onSearchChange && (
        <input
          className="app-input record-search"
          type="search"
          value={search || ''}
          onChange={event => onSearchChange(event.target.value)}
          placeholder={placeholder}
          aria-label="Search authorized records"
        />
      )}
      <div className="date-filter">
        <input
          className="app-input"
          type="date"
          value={period.date}
          onChange={event => {
            period.setDate(event.target.value);
            onDateChange?.(event.target.value);
          }}
          aria-label="Filter by date"
          title="Date (MM/DD/YYYY)"
        />
        {period.date && (
          <button className="date-filter-clear" onClick={() => { period.setDate(''); onDateChange?.(''); }} aria-label="Clear date filter" title="Clear date">
            ×
          </button>
        )}
      </div>
    </div>
  );
}
