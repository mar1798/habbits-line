import { format, getDay, parse } from 'date-fns';

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
