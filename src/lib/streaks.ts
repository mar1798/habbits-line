import { forEachDateKey, shiftDateKey, timestampDateKey } from './date';
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

/**
 * One habit's history in the shape every statistic reads: its schedule, its target, its
 * per-day counts, and the first day it existed.
 *
 * Statistics are computed over a *list* of these, so one selected habit and the "all habits"
 * overview go through exactly the same code — a list of one behaves identically to how
 * a single habit was computed before.
 */
export interface HabitSeries {
  scheduleMask: number;
  targetPerDay: number;
  counts: Record<string, number>;
  /** Days before this one aren't the habit's to miss — see `toHabitSeries`. */
  startDate: string;
}

/** Start for a habit whose `created_at` can't be read and that has no entries either. */
const UNKNOWN_START = '1970-01-01';

/**
 * Builds a series from a habit row and its entries.
 *
 * The start is the day the habit was created — a habit added today was not missed
 * yesterday, and counting the days before it existed against it turned every new habit
 * into an instant 0%. It moves back to the earliest entry when there is an older one:
 * a past day marked through the day strip, or an imported history, is still the habit's.
 */
export function toHabitSeries(
  habit: { schedule_mask: number; target_per_day: number; created_at: string },
  counts: Record<string, number>
): HabitSeries {
  const dates = Object.keys(counts);
  const firstEntry = dates.length > 0 ? dates.reduce((min, date) => (date < min ? date : min)) : null;
  const created = timestampDateKey(habit.created_at);

  let startDate = created ?? firstEntry ?? UNKNOWN_START;
  if (firstEntry && firstEntry < startDate) {
    startDate = firstEntry;
  }

  return {
    scheduleMask: habit.schedule_mask,
    targetPerDay: habit.target_per_day,
    counts,
    startDate,
  };
}

/** What one calendar day looks like across a list of series. */
export interface DayTally {
  /** Series that are scheduled on this day and had already started. */
  scheduled: number;
  /** How many of those reached their target. */
  closed: number;
  /**
   * Scheduled series plus any unscheduled one with progress on the day — what the
   * heatmap fills in. A bonus mark on an off day still shows, it just never counts
   * towards a streak or a completion rate.
   */
  active: number;
  /** Mean completion ratio across `active`; 0 when nothing is active. */
  ratio: number;
}

export function tallyDay(series: HabitSeries[], date: string, dayOfWeek: number): DayTally {
  let scheduled = 0;
  let closed = 0;
  let active = 0;
  let ratioSum = 0;

  for (const habit of series) {
    if (date < habit.startDate) continue;

    const count = habit.counts[date] ?? 0;
    if (isScheduledOnWeekday(habit.scheduleMask, dayOfWeek)) {
      scheduled += 1;
      if (count >= habit.targetPerDay) closed += 1;
    } else if (count === 0) {
      continue;
    }

    active += 1;
    ratioSum += dayCompletionRatio(count, habit.targetPerDay);
  }

  return { scheduled, closed, active, ratio: active === 0 ? 0 : ratioSum / active };
}

export interface Streaks {
  current: number;
  best: number;
}

/**
 * Current and best streak, counted only over days that have at least one scheduled
 * habit. A day counts when *every* habit scheduled on it is closed, so for a single
 * habit this is its own streak and for the whole list it's the "everything done" streak.
 * Days with nothing scheduled neither break nor extend it, and an unfinished `today`
 * isn't counted yet rather than resetting the run.
 *
 * Scans forward from the earliest date with an entry. Days before that have no row, so
 * a scheduled one would read as not closed and reset a running streak to 0 anyway —
 * starting the scan there instead of at the earliest start date changes nothing and
 * keeps the walk short.
 */
export function computeStreaks(series: HabitSeries[], today: string): Streaks {
  let from: string | null = null;
  for (const habit of series) {
    for (const date of Object.keys(habit.counts)) {
      if (from === null || date < from) from = date;
    }
  }
  if (from === null) {
    return { current: 0, best: 0 };
  }

  let running = 0;
  let best = 0;

  forEachDateKey(from, today, (date, dayOfWeek) => {
    const { scheduled, closed } = tallyDay(series, date, dayOfWeek);
    if (scheduled === 0) return;

    if (closed === scheduled) {
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
 * Share of scheduled habit-days closed within the `windowDays` calendar days ending on
 * `today` (inclusive). The denominator is scheduled days, not calendar days — a
 * 3-day-a-week habit needs to be able to reach 100%, not cap out around 43% — and over
 * several habits it's every habit's scheduled day, so a day where one of three was
 * missed reads as 2/3 rather than a flat miss.
 */
export function computeCompletionRate(
  series: HabitSeries[],
  today: string,
  windowDays: number
): number {
  let scheduled = 0;
  let closed = 0;

  forEachDateKey(shiftDateKey(today, -(windowDays - 1)), today, (date, dayOfWeek) => {
    const tally = tallyDay(series, date, dayOfWeek);
    scheduled += tally.scheduled;
    closed += tally.closed;
  });

  return scheduled === 0 ? 0 : closed / scheduled;
}
