import { createContext } from 'react';
import type { PeriodRange } from '../datePeriods';
export const DateFilterRangeContext = createContext<((range: PeriodRange) => void) | null>(null);
export const DateSearchContext = createContext<{ query: string; clear: () => void }>({ query: '', clear: () => {} });
