import { weekday } from './date';

const DAYS_IN_WEEK = 7;

/** Bit 0 = Monday … bit 6 = Sunday, matching habits.schedule_mask. */
export function maskToDays(mask: number): number[] {
  const days: number[] = [];
  for (let bit = 0; bit < DAYS_IN_WEEK; bit++) {
    if (mask & (1 << bit)) {
      days.push(bit);
    }
  }
  return days;
}

export function daysToMask(days: number[]): number {
  return days.reduce((mask, bit) => mask | (1 << bit), 0);
}

/**
 * date-fns getDay() returns 0 = Sunday … 6 = Saturday; schedule_mask uses bit 0 =
 * Monday … bit 6 = Sunday. This is the one place in the app that converts between
 * the two weekday numberings (a third, WeeklyTriggerInput's 1 = Sunday, joins this
 * file in stage 7).
 */
function bitForNativeWeekday(nativeWeekday: number): number {
  return (nativeWeekday + 6) % 7;
}

export function isScheduledOn(mask: number, date: Date): boolean {
  const bit = bitForNativeWeekday(weekday(date));
  return (mask & (1 << bit)) !== 0;
}

/**
 * The third weekday numbering in the app: iOS's `CalendarTriggerInput.weekday`
 * (also `WeeklyTriggerInput` on Android) is 1 = Sunday … 7 = Saturday. Bit 0 (Monday)
 * maps to 2, bit 6 (Sunday) wraps to 1.
 */
export function bitToAppleWeekday(bit: number): number {
  return ((bit + 1) % DAYS_IN_WEEK) + 1;
}
