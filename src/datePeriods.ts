export const BUSINESS_TIME_ZONE = 'Asia/Manila';
export const PERIODS = ['all', 'day', 'week', 'month', 'year'] as const;
export type DatePeriod = typeof PERIODS[number];
export interface PeriodRange { start: string; end: string; label: string }
const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function validDate(year: number, month: number, day: number): string | null {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1) return null;
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day
    ? [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-') : null;
}

/** Only whole, complete calendar dates qualify; record references never become dates. */
export function parseSpecificDate(query: string): string | null {
  const text = query.normalize('NFKC').trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) return validDate(+match[1], +match[2], +match[3]);
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) return validDate(+match[3], +match[1], +match[2]);
  match = /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const month = months.findIndex(value => value === name || value.slice(0, 3) === name);
  return month < 0 ? null : validDate(+match[3], month + 1, +match[2]);
}

export function businessToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)!.value).join('-');
}

/** Zoned timestamps use Manila; date-only and unzoned business dates keep their calendar day. */
export function calendarDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const plain = parseSpecificDate(text);
  if (plain) return plain;
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text) || !parseSpecificDate(text.slice(0, 10))) return null;
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const instant = new Date(text);
    return Number.isFinite(instant.getTime()) ? businessToday(instant) : null;
  }
  return parseSpecificDate(text.slice(0, 10));
}

const dateLabel = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z'));
export const specificDateLabel = (value: string) => dateLabel(value, { month: 'short', day: 'numeric', year: 'numeric' });

export function periodRange(scope: DatePeriod, anchor = businessToday()): PeriodRange {
  if (scope === 'all') return { start: '', end: '', label: 'All dates' };
  const date = parseSpecificDate(anchor);
  if (!date) throw new Error('A valid calendar date is required');
  const [year, month] = date.split('-').map(Number);
  if (scope === 'day') return { start: date, end: date, label: 'Day: ' + specificDateLabel(date) };
  if (scope === 'month') return { start: validDate(year, month, 1)!, end: validDate(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate())!, label: dateLabel(date, { month: 'long', year: 'numeric' }) };
  if (scope === 'year') return { start: year + '-01-01', end: year + '-12-31', label: String(year) };
  const monday = new Date(date + 'T00:00:00Z');
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const start = monday.toISOString().slice(0, 10), end = sunday.toISOString().slice(0, 10);
  return { start, end, label: 'Week: ' + specificDateLabel(start) + ' – ' + specificDateLabel(end) };
}

export function effectiveDateRange(scope: DatePeriod, query: string, anchor = businessToday()): PeriodRange {
  const exact = parseSpecificDate(query);
  return exact ? { start: exact, end: exact, label: specificDateLabel(exact) } : periodRange(scope, anchor);
}

export function dateInPeriod(value: string | undefined, range: PeriodRange): boolean {
  if (!range.start) return true;
  const date = calendarDate(value);
  return !!date && date >= range.start && date <= range.end;
}

/** Explicit primary date fields prevent references or unrelated joined history from setting the scope. */
export const COLLECTION_DATE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  orders: ['orderDate'], manufacturingOrders: ['createdDate'], productionOrders: ['requiredDate'],
  finishedGoods: ['productionDate'], pellets: ['receivedDate'], colorants: ['lastUpdated'],
  transactions: ['date'], materialUsageTransactions: ['dateTime'], attendance: ['date'],
  turnovers: ['date'], rejectedMaterials: ['date'], recyclingBatches: ['date'],
  rrRecords: ['date'], transfers: ['date'], materialRequests: ['date'],
  auditLogs: ['date'], notifications: ['datetime'], reprintRequests: ['requestedAt'],
};
export function primaryRecordDate(record: unknown, fields?: readonly string[]): string | undefined {
  if (!record || typeof record !== 'object') return undefined;
  const item = record as Record<string, unknown>;
  for (const field of fields || ['date', 'dateTime', 'datetime', 'orderDate', 'productionDate', 'receivedDate', 'createdDate', 'requiredDate', 'createdAt', 'requestedAt', 'lastUpdated']) {
    if (typeof item[field] === 'string' && calendarDate(item[field])) return item[field] as string;
  }
  return undefined;
}
export function matchesRecordDate(record: unknown, exact: string): boolean {
  return calendarDate(primaryRecordDate(record)) === exact;
}
