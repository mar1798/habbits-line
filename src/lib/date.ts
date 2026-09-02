import { addDays } from 'date-fns/addDays';
import { getDay } from 'date-fns/getDay';
import { startOfWeek } from 'date-fns/startOfWeek';

/**
 * Local-timezone date key. `toISOString()` is banned here — it goes through UTC and
 * hands back yesterday's date past midnight in western timezones.
 *
 * Assembled by hand rather than through `format(date, 'yyyy-MM-dd')`: this is the
 * hottest function in the app (the streak scan calls it once per day of history) and
 * date-fns re-parses its format string on every call. The output is identical, the
 * Invalid Date guard included.
 */
export function toDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('Invalid time value');
  }
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Inverse of `toDateKey`: local midnight on the key's day.
 *
 * Sliced by hand rather than through `parse(key, 'yyyy-MM-dd', new Date())` — that is the
 * one entry point into date-fns's general format-string parser, which Metro cannot
 * tree-shake, so reading a single fixed pattern pulled all 34 token parsers into the
 * bundle (~96 KB of JS, 49 KB of bytecode) for a shape this file already validates with a
 * regex. A malformed key yields an Invalid Date here exactly as it did before.
 *
 * `setFullYear`, not `new Date(year, ...)`: the two-digit-year remap would turn a year
 * below 100 into 19xx.
 */
export function parseDateKey(key: string): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setFullYear(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
  return date;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only for a key that is both shaped like `YYYY-MM-DD` and a real calendar day.
 *
 * The shape alone is not enough: `2026-02-31` matches the pattern but is not a day —
 * it rolls forward to 2026-03-03, and the round-trip below is what catches it. Import is
 * the only way such a key can reach the database, so this is what guards it there.
 */
export function isValidDateKey(key: string): boolean {
  if (!DATE_KEY_PATTERN.test(key)) return false;
  const parsed = parseDateKey(key);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === key;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * True for a `HH:mm` local time of day — the shape `habits.reminder_time` is stored in.
 * Guards the same boundary as `isValidDateKey`: a malformed time turns into `NaN` hour
 * and minute at scheduling time, which iOS rejects.
 */
export function isValidTimeOfDay(value: string): boolean {
  return TIME_OF_DAY_PATTERN.test(value);
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

/**
 * Visits every date key from `fromKey` to `toKey` inclusive, handing each one to
 * `visit` along with its date-fns weekday (0 = Sunday) so the caller never has to
 * re-parse the key it was just given.
 *
 * Walks a single mutable Date. The obvious loop — `shiftDateKey(cursor, 1)` — parses
 * and formats a string on every day, and the streak scan runs it across a habit's whole
 * history on each stats render: measured at ~35 ms for three years of entries and
 * ~59 ms for ten, against a few ms here.
 *
 * A range that isn't two real calendar days visits nothing. That can only happen with a
 * key written by a build older than the import validation in lib/backup.ts, and a habit
 * whose statistics read as empty is a far better outcome than the `RangeError` such a
 * key used to throw out of the render.
 */
export function forEachDateKey(
  fromKey: string,
  toKey: string,
  visit: (key: string, dayOfWeek: number) => void
): void {
  if (!isValidDateKey(fromKey) || !isValidDateKey(toKey)) return;

  const cursor = parseDateKey(fromKey);
  let key = fromKey;
  while (key <= toKey) {
    visit(key, cursor.getDay());
    cursor.setDate(cursor.getDate() + 1);
    key = toDateKey(cursor);
  }
}

/** Date key of the Monday of the week containing `key`. Paging anchors on this. */
export function weekStartKey(key: string): string {
  return toDateKey(startOfWeek(parseDateKey(key), { weekStartsOn: 1 }));
}

export const DAYS_IN_WEEK = 7;

/**
 * Local date key of an ISO timestamp — the day a `created_at` was written.
 *
 * Null for a timestamp that can't be read: lib/backup.ts checks on import that the
 * field is a string, not that it parses, so a hand-edited backup can carry anything.
 * Callers treat that as "no known start" rather than throwing out of a render.
 */
export function timestampDateKey(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : toDateKey(date);
}
