import { addDays, format, getDay, parse, startOfWeek } from 'date-fns';

const DATE_KEY_FORMAT = 'yyyy-MM-dd';

/**
 * Local-timezone date key. `toISOString()` is banned here — it goes through UTC and
 * hands back yesterday's date past midnight in western timezones.
 */
export function toDateKey(date: Date): string {
  return format(date, DATE_KEY_FORMAT);
}

export function parseDateKey(key: string): Date {
  return parse(key, DATE_KEY_FORMAT, new Date());
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** date-fns day-of-week: 0 = Sunday … 6 = Saturday. Bit-mask conversion lives in lib/schedule.ts. */
export function weekday(date: Date): number {
  return getDay(date);
}

/** The 7 date keys (Monday first, matching schedule_mask bit 0) of the week containing `date`. */
export function weekDates(date: Date): string[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => toDateKey(addDays(start, i)));
}

/**
 * `key` moved by `days` (negative moves back), still as a local date key.
 *
 * Goes through a Date rather than arithmetic on the string so month, year and — since
 * the intermediate Date is local — DST boundaries are handled by date-fns.
 */
export function shiftDateKey(key: string, days: number): string {
  return toDateKey(addDays(parseDateKey(key), days));
}

/** Date key of the Monday of the week containing `key`. Paging anchors on this. */
export function weekStartKey(key: string): string {
  return toDateKey(startOfWeek(parseDateKey(key), { weekStartsOn: 1 }));
}

export const DAYS_IN_WEEK = 7;
