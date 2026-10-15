import React, { useMemo, useState } from 'react';
import { useViewState } from '../uiViewState';
import { ActiveFilters } from './UXFeedback';

export interface PeriodRange {
  start: string;
  end: string;
  label: string;
}

const normalizedDate = (value?: string) => value?.slice(0, 10) || '';

export const dateInPeriod = (value: string | undefined, range: PeriodRange) =>
  !range.start || normalizedDate(value) === range.start;

export function usePeriod(_legacyDefault?: string) {
  const [date, setDate] = useViewState('period-date', '');
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
  filters,
}: {
  period: DateController;
  search?: string;
  onSearchChange?: (value: string) => void;
  onDateChange?: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  filters?: React.ReactNode;
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
      <ActiveFilters items={[["Search", search], ["Date", period.date]]} onClear={() => { onSearchChange?.(''); period.setDate(''); onDateChange?.(''); }} clearLabel="Clear search and date" />
      <div className="record-filter-controls">
        {filters}
        <label className="date-filter-field">
          <span className="field-label">Date (optional)</span>
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
        </label>
      </div>
    </div>
  );
}
