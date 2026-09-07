import { DAYS_IN_WEEK, forEachDateKey, shiftDateKey, timestampDateKey } from './date';
import { bitForNativeWeekday, isScheduledOnWeekday } from './schedule';

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
 * per-day counts, and the span of days it existed for.
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
  /** Last day the habit was the user's to keep; null while it is still active. */
  endDate: string | null;
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
 *
 * The end is the mirror of that: an archived habit stops being the user's to keep on
 * the day it was archived. Without it every scheduled day since archiving read as a
 * miss, so a habit dropped with a streak of 40 showed 0 and 0%, and the longer it sat
 * in the archive the worse its own history looked. It moves forward to the latest entry
 * for the same reason the start moves back — a day with progress on it is the habit's,
 * whatever the timestamps say.
 */
export function toHabitSeries(
  habit: {
    schedule_mask: number;
    target_per_day: number;
    created_at: string;
    archived_at?: string | null;
  },
  counts: Record<string, number>
): HabitSeries {
  const dates = Object.keys(counts);
  const firstEntry = dates.length > 0 ? dates.reduce((min, date) => (date < min ? date : min)) : null;
  const lastEntry = dates.length > 0 ? dates.reduce((max, date) => (date > max ? date : max)) : null;
  const created = timestampDateKey(habit.created_at);

  let startDate = created ?? firstEntry ?? UNKNOWN_START;
  if (firstEntry && firstEntry < startDate) {
    startDate = firstEntry;
  }

  // An unreadable `archived_at` leaves the habit open rather than ending it on a
  // guessed day: showing a few days too many is recoverable, cutting the history is not.
  let endDate = habit.archived_at ? timestampDateKey(habit.archived_at) : null;
  if (endDate !== null && lastEntry && lastEntry > endDate) {
    endDate = lastEntry;
  }

  return {
    scheduleMask: habit.schedule_mask,
    targetPerDay: habit.target_per_day,
    counts,
    startDate,
    endDate,
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
    if (habit.endDate !== null && date > habit.endDate) continue;

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
 * Earliest day any of the series has a row for, or null when none of them has one.
 *
 * The scans that walk a whole history start here rather than at the earliest start date:
 * a scheduled day before the first entry has no row, so it reads as not closed, and both
 * a streak and a run of misses begin at the same place either way — while an unreadable
 * `created_at` leaves a start date in 1970 that would make the walk decades long.
 */
function firstEntryDate(series: HabitSeries[]): string | null {
  let from: string | null = null;
  for (const habit of series) {
    for (const date of Object.keys(habit.counts)) {
      if (from === null || date < from) from = date;
    }
  }
  return from;
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
  const from = firstEntryDate(series);
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
 *
 * Null when the window holds no scheduled day at all — a Sunday-only habit looked at on a
 * Saturday, or an archived one whose whole window is past its end. That is not a zero:
 * zero means every scheduled day was missed, and the card printing "0%" over an empty bar
 * accused the user of failing days that were never theirs to close.
 */
export function computeCompletionRate(
  series: HabitSeries[],
  today: string,
  windowDays: number
): number | null {
  let scheduled = 0;
  let closed = 0;

  forEachDateKey(shiftDateKey(today, -(windowDays - 1)), today, (date, dayOfWeek) => {
    const tally = tallyDay(series, date, dayOfWeek);
    scheduled += tally.scheduled;
    closed += tally.closed;
  });

  return scheduled === 0 ? null : closed / scheduled;
}

export interface RangeStats {
  scheduled: number;
  closed: number;
  /** Null when the range holds no scheduled day — see `computeCompletionRate`. */
  rate: number | null;
}

/**
 * Scheduled/closed days and their rate over an arbitrary `start`..`end` range, for the
 * habit statistics screen's own calendar. Same denominator rule as `computeCompletionRate`
 * — scheduled days, not calendar days, and `rate` is null rather than 0 when the range has
 * no scheduled day at all.
 */
export function computeRangeStats(series: HabitSeries[], start: string, end: string): RangeStats {
  let scheduled = 0;
  let closed = 0;

  forEachDateKey(start, end, (date, dayOfWeek) => {
    const tally = tallyDay(series, date, dayOfWeek);
    scheduled += tally.scheduled;
    closed += tally.closed;
  });

  return { scheduled, closed, rate: scheduled === 0 ? null : closed / scheduled };
}

/** How one weekday of the week did over a window. Index in the array is the `schedule_mask` bit. */
export interface WeekdayStats {
  scheduled: number;
  closed: number;
  /** Null when the weekday held no scheduled day at all — see `computeCompletionRate`. */
  rate: number | null;
}

/**
 * The same rate as `computeCompletionRate`, split into the seven weekdays instead of
 * summed — what turns "83% over 30 days" into "every Friday goes".
 *
 * Bounded by a window rather than walking the whole history: the answer is about how the
 * user lives now, and a Friday abandoned two years ago should not still be dragging the
 * bar down. Indexed Monday-first to match `schedule_mask` bit 0, so the weekday labels,
 * the picker and this chart all read in the same order.
 */
export function computeWeekdayStats(
  series: HabitSeries[],
  today: string,
  windowDays: number
): WeekdayStats[] {
  const buckets = Array.from({ length: DAYS_IN_WEEK }, () => ({ scheduled: 0, closed: 0 }));

  forEachDateKey(shiftDateKey(today, -(windowDays - 1)), today, (date, dayOfWeek) => {
    const tally = tallyDay(series, date, dayOfWeek);
    if (tally.scheduled === 0) return;
    const bucket = buckets[bitForNativeWeekday(dayOfWeek)];
    bucket.scheduled += tally.scheduled;
    bucket.closed += tally.closed;
  });

  return buckets.map(({ scheduled, closed }) => ({
    scheduled,
    closed,
    rate: scheduled === 0 ? null : closed / scheduled,
  }));
}

export interface RecoveryStats {
  /** Runs of missed days that fell out of a closed day and ended on another one. */
  breaks: number;
  /** Mean length of those runs in missed days; null when there are none. */
  averageDays: number | null;
  /** The longest of them; 0 when there are none. */
  longestDays: number;
}

/**
 * How long it takes to come back after a slip: over the same days a streak is counted on,
 * every run of missed days between two closed ones, averaged.
 *
 * A run only counts once it has been recovered from — the days since the last closed one
 * are not a recovery time yet, they are the current gap, and averaging them in would make
 * the number fall the longer the user stays away. A run before the first closed day is not
 * a slip either: nothing had been established to fall from, which is the difference between
 * "started late" and "gave up for a week".
 *
 * Counted in missed *scheduled* days, the unit every other habit statistic uses: for a
 * Mon/Wed/Fri habit, skipping Friday and closing Monday is one day missed, not three.
 */
export function computeRecovery(series: HabitSeries[], today: string): RecoveryStats {
  const from = firstEntryDate(series);
  if (from === null) {
    return { breaks: 0, averageDays: null, longestDays: 0 };
  }

  let seenClosed = false;
  let running = 0;
  let breaks = 0;
  let missed = 0;
  let longestDays = 0;

  forEachDateKey(from, today, (date, dayOfWeek) => {
    const { scheduled, closed } = tallyDay(series, date, dayOfWeek);
    if (scheduled === 0) return;

    if (closed === scheduled) {
      if (running > 0) {
        breaks += 1;
        missed += running;
        longestDays = Math.max(longestDays, running);
      }
      running = 0;
      seenClosed = true;
      return;
    }

    // Today is still open, not yet missed — the same rule `computeStreaks` walks by.
    if (date === today) return;
    if (seenClosed) running += 1;
  });

  return { breaks, averageDays: breaks === 0 ? null : missed / breaks, longestDays };
}
