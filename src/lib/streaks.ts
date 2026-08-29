import { forEachDateKey, shiftDateKey } from './date';
import { isScheduledOnWeekday } from './schedule';

/**
 * count / target, clamped to 0..1 — the one shared rule for how "done" a day is.
 * Handles a target lowered after the fact: old rows with count > target must not read
 * as more than 100%.
 */
export function dayCompletionRatio(count: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.max(count, 0) / target, 1);
}

function isDayClosed(count: number, target: number): boolean {
  return count >= target;
}

export interface Streaks {
  current: number;
  best: number;
}

/**
 * Current and best streak, counted only over scheduled days — unscheduled days never
 * break or extend it. An unfinished `today` doesn't reset the running streak: it just
 * isn't counted yet, so the streak stands at whatever it was through the last closed
 * scheduled day.
 *
 * Scans forward from the earliest date with an entry. Days before that have no row,
 * so if they were scheduled they'd read as not closed and reset a running streak to 0
 * anyway — starting the scan there instead of further back changes nothing.
 */
export function computeStreaks(
  entryCounts: Record<string, number>,
  scheduleMask: number,
  targetPerDay: number,
  today: string
): Streaks {
  const dates = Object.keys(entryCounts);
  if (dates.length === 0) {
    return { current: 0, best: 0 };
  }

  const from = dates.reduce((min, date) => (date < min ? date : min));
  let running = 0;
  let best = 0;

  forEachDateKey(from, today, (date, dayOfWeek) => {
    if (!isScheduledOnWeekday(scheduleMask, dayOfWeek)) return;

    if (isDayClosed(entryCounts[date] ?? 0, targetPerDay)) {
      running += 1;
      best = Math.max(best, running);
    } else if (date !== today) {
      running = 0;
    }
    // else: today, still open — leave the running streak as-is.
  });

  return { current: running, best };
}

/**
 * Share of scheduled days closed within the `windowDays` calendar days ending on
 * `today` (inclusive). The denominator is scheduled days, not calendar days — a
 * 3-day-a-week habit needs to be able to reach 100%, not cap out around 43%.
 */
export function computeCompletionRate(
  entryCounts: Record<string, number>,
  scheduleMask: number,
  targetPerDay: number,
  today: string,
  windowDays: number
): number {
  let scheduled = 0;
  let closed = 0;

  forEachDateKey(shiftDateKey(today, -(windowDays - 1)), today, (date, dayOfWeek) => {
    if (!isScheduledOnWeekday(scheduleMask, dayOfWeek)) return;

    scheduled += 1;
    if (isDayClosed(entryCounts[date] ?? 0, targetPerDay)) {
      closed += 1;
    }
  });

  return scheduled === 0 ? 0 : closed / scheduled;
}
