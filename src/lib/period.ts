import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';

import { parseDateKey, shiftDateKey, toDateKey } from './date';

/**
 * The period start day is limited to 1..28.
 *
 * Days 29 to 31 do not exist in every month, and any of them would need a "pull back to
 * the last day" rule that breaks the one equality the rest of this module rests on:
 * the next period starts the day after the current one ends. The limit removes a whole
 * class of edge cases at the cost of one day a year for someone paid on the 29th.
 */
export const MIN_PERIOD_START_DAY = 1;
export const MAX_PERIOD_START_DAY = 28;
export const DEFAULT_PERIOD_START_DAY = 1;

export function clampPeriodStartDay(day: number): number {
  if (!Number.isFinite(day)) return DEFAULT_PERIOD_START_DAY;
  return Math.min(Math.max(Math.trunc(day), MIN_PERIOD_START_DAY), MAX_PERIOD_START_DAY);
}

/** Reads the `expense_period_start_day` setting; anything unparseable falls back to the 1st. */
export function parsePeriodStartDay(value: string | null): number {
  if (value === null) return DEFAULT_PERIOD_START_DAY;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? DEFAULT_PERIOD_START_DAY : clampPeriodStartDay(parsed);
}

/**
 * First day of the period `dateKey` falls into. A date landing exactly on the start day
 * opens the new period rather than closing the previous one.
 *
 * A period is identified by this key — the date of its first day — and not by `'YYYY-MM'`:
 * with a start day of the 6th, the period from 6 August to 5 September is neither August
 * nor September, while the start date is unambiguous for any start day.
 */
export function periodStartFor(dateKey: string, startDay: number): string {
  const day = clampPeriodStartDay(startDay);
  const date = parseDateKey(dateKey);
  const month = date.getDate() >= day ? date.getMonth() : date.getMonth() - 1;
  // A month index of -1 rolls back into December of the previous year on its own.
  return toDateKey(new Date(date.getFullYear(), month, day));
}

/** Last day of the period `dateKey` falls into, inclusive. */
export function periodEndFor(dateKey: string, startDay: number): string {
  return shiftDateKey(shiftPeriod(periodStartFor(dateKey, startDay), 1), -1);
}

/**
 * The period `delta` periods away from the one starting at `periodStart` (negative moves
 * back). One period is one month, and because the start day can never exceed 28 the day
 * of month always survives the shift — no clamping to a short February.
 *
 * The start day is not a parameter: `periodStart` already carries it.
 */
export function shiftPeriod(periodStart: string, delta: number): string {
  const date = parseDateKey(periodStart);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + delta, date.getDate()));
}

/** Days in the period starting at `periodStart`, counting both ends. */
export function periodLength(periodStart: string, startDay: number): number {
  const end = periodEndFor(periodStart, startDay);
  return differenceInCalendarDays(parseDateKey(end), parseDateKey(periodStart)) + 1;
}
