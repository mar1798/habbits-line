import { daysToMask } from '../schedule';
import {
  computeCompletionRate,
  computeStreaks,
  dayCompletionRatio,
  type HabitSeries,
  tallyDay,
  toHabitSeries,
} from '../streaks';

// Mon / Wed / Fri, matching the example habit in PLAN.md's stage 6 acceptance criteria.
const MON_WED_FRI = daysToMask([0, 2, 4]);
const EVERY_DAY = daysToMask([0, 1, 2, 3, 4, 5, 6]);

/** One habit's series, started long before every date these tests use and still active. */
function series(
  counts: Record<string, number>,
  scheduleMask: number,
  targetPerDay = 1,
  startDate = '2000-01-01',
  endDate: string | null = null
): HabitSeries[] {
  return [{ counts, scheduleMask, targetPerDay, startDate, endDate }];
}

describe('dayCompletionRatio', () => {
  it('clamps a count above target to 1 (target lowered after the fact)', () => {
    expect(dayCompletionRatio(3, 1)).toBe(1);
  });

  it('divides count by target within range', () => {
    expect(dayCompletionRatio(2, 4)).toBe(0.5);
  });

  it('is 0 for no progress', () => {
    expect(dayCompletionRatio(0, 5)).toBe(0);
  });

  it('is 0 for a non-positive target', () => {
    expect(dayCompletionRatio(1, 0)).toBe(0);
  });
});

describe('computeStreaks', () => {
  it('counts only scheduled days: Mon+Wed closed, Tue skipped (unscheduled) — streak 2', () => {
    const entryCounts = { '2026-08-24': 1, '2026-08-26': 1 };
    const { current, best } = computeStreaks(series(entryCounts, MON_WED_FRI), '2026-08-26');
    expect(current).toBe(2);
    expect(best).toBe(2);
  });

  it('an unfinished today does not reset the running streak', () => {
    const entryCounts = { '2026-08-24': 1, '2026-08-26': 1 }; // Friday 08-28 left open
    const { current, best } = computeStreaks(series(entryCounts, MON_WED_FRI), '2026-08-28');
    expect(current).toBe(2);
    expect(best).toBe(2);
  });

  it('a past scheduled day left open breaks the streak', () => {
    // Mon closed, Wed missed (past, scheduled, no entry), Fri closed.
    const entryCounts = { '2026-08-24': 1, '2026-08-28': 1 };
    const { current, best } = computeStreaks(series(entryCounts, MON_WED_FRI), '2026-08-28');
    expect(current).toBe(1);
    expect(best).toBe(1);
  });

  it('best streak survives a later break in the current one', () => {
    const entryCounts = {
      '2026-08-24': 1, // Mon — closed
      '2026-08-26': 1, // Wed — closed
      '2026-08-28': 1, // Fri — closed, running streak of 3
      // 2026-08-31 Mon — missed, breaks the run
      '2026-09-02': 1, // Wed — closed, new run of 1
    };
    const { current, best } = computeStreaks(series(entryCounts, MON_WED_FRI), '2026-09-02');
    expect(current).toBe(1);
    expect(best).toBe(3);
  });

  it('no entries at all gives a zero streak', () => {
    expect(computeStreaks(series({}, MON_WED_FRI), '2026-08-28')).toEqual({ current: 0, best: 0 });
  });

  it('an empty selection gives a zero streak', () => {
    expect(computeStreaks([], '2026-08-28')).toEqual({ current: 0, best: 0 });
  });

  it('a lowered target still closes old rows via the clamp', () => {
    const entryCounts = { '2026-08-24': 3 };
    const { current } = computeStreaks(series(entryCounts, MON_WED_FRI), '2026-08-24');
    expect(current).toBe(1);
  });

  it('days before the start are not the habit’s to miss', () => {
    // Created Wednesday, closed that day: the Monday before is not counted as a break,
    // so the streak still stands at 1 rather than being reset by a day it did not exist.
    const entryCounts = { '2026-08-26': 1 };
    const { current, best } = computeStreaks(
      series(entryCounts, MON_WED_FRI, 1, '2026-08-26'),
      '2026-08-26'
    );
    expect(current).toBe(1);
    expect(best).toBe(1);
  });
});

describe('computeStreaks over several habits', () => {
  const both: HabitSeries[] = [
    { counts: { '2026-08-24': 1, '2026-08-25': 1 }, scheduleMask: EVERY_DAY, targetPerDay: 1, startDate: '2026-08-24', endDate: null },
    { counts: { '2026-08-24': 1 }, scheduleMask: EVERY_DAY, targetPerDay: 1, startDate: '2026-08-24', endDate: null },
  ];

  it('counts a day only when every habit scheduled on it is closed', () => {
    // 08-24 both closed, 08-25 only one — that day breaks the shared streak once it is
    // in the past, leaving a best of 1.
    const { current, best } = computeStreaks(both, '2026-08-26');
    expect(current).toBe(0);
    expect(best).toBe(1);
  });

  it('a habit that had not started yet cannot break the day', () => {
    const later: HabitSeries[] = [
      both[0],
      { counts: {}, scheduleMask: EVERY_DAY, targetPerDay: 1, startDate: '2026-08-26', endDate: null },
    ];
    const { best } = computeStreaks(later, '2026-08-25');
    expect(best).toBe(2);
  });
});

describe('computeCompletionRate', () => {
  it('is computed from scheduled days in the window, not calendar days', () => {
    // Window 2026-08-24..2026-08-30 (7 days) contains exactly 3 scheduled days.
    const entryCounts = { '2026-08-24': 1, '2026-08-26': 1, '2026-08-28': 1 };
    const rate = computeCompletionRate(series(entryCounts, MON_WED_FRI), '2026-08-30', 7);
    expect(rate).toBe(1);
  });

  it('a 3-day-a-week habit is not capped around 43%', () => {
    const entryCounts = { '2026-08-24': 1, '2026-08-26': 1, '2026-08-28': 1 };
    const rate = computeCompletionRate(series(entryCounts, MON_WED_FRI), '2026-08-30', 7);
    expect(rate).toBeGreaterThan(0.43);
  });

  it('counts a partially completed window', () => {
    const entryCounts = { '2026-08-24': 1, '2026-08-28': 1 }; // Wed missed
    const rate = computeCompletionRate(series(entryCounts, MON_WED_FRI), '2026-08-30', 7);
    expect(rate).toBeCloseTo(2 / 3);
  });

  it('is null, not 0, when the window has no scheduled days', () => {
    const sundayOnly = daysToMask([6]);
    // 2026-08-24..2026-08-29 is 6 days, none of them a Sunday.
    const rate = computeCompletionRate(series({}, sundayOnly), '2026-08-29', 6);
    expect(rate).toBeNull();
  });

  it('a habit added today is measured only from the day it was added', () => {
    // Every day of the window is scheduled, but only 2026-08-29 counts — and it's closed.
    const rate = computeCompletionRate(
      series({ '2026-08-29': 1 }, EVERY_DAY, 1, '2026-08-29'),
      '2026-08-29',
      30
    );
    expect(rate).toBe(1);
  });

  it('over several habits the denominator is every habit’s scheduled day', () => {
    const two: HabitSeries[] = [
      { counts: { '2026-08-29': 1 }, scheduleMask: EVERY_DAY, targetPerDay: 1, startDate: '2026-08-29', endDate: null },
      { counts: {}, scheduleMask: EVERY_DAY, targetPerDay: 1, startDate: '2026-08-29', endDate: null },
    ];
    expect(computeCompletionRate(two, '2026-08-29', 7)).toBe(0.5);
  });
});

describe('tallyDay', () => {
  it('fills an unscheduled day that has progress anyway, and leaves an empty one inactive', () => {
    const [habit] = series({ '2026-08-25': 1 }, MON_WED_FRI); // Tuesday, unscheduled
    // 2026-08-25 is a Tuesday: date-fns weekday 2.
    expect(tallyDay([habit], '2026-08-25', 2)).toEqual({
      scheduled: 0,
      closed: 0,
      active: 1,
      ratio: 1,
    });
    expect(tallyDay([habit], '2026-09-01', 2)).toEqual({
      scheduled: 0,
      closed: 0,
      active: 0,
      ratio: 0,
    });
  });

  it('averages the ratio across the habits active on the day', () => {
    const two: HabitSeries[] = [
      { counts: { '2026-08-24': 1 }, scheduleMask: EVERY_DAY, targetPerDay: 1, startDate: '2026-08-01', endDate: null },
      { counts: {}, scheduleMask: EVERY_DAY, targetPerDay: 1, startDate: '2026-08-01', endDate: null },
    ];
    // 2026-08-24 is a Monday: date-fns weekday 1.
    expect(tallyDay(two, '2026-08-24', 1)).toEqual({
      scheduled: 2,
      closed: 1,
      active: 2,
      ratio: 0.5,
    });
  });
});

describe('an archived habit', () => {
  // Mon/Wed/Fri, kept for three weeks and then archived on 2026-08-14. Nothing after
  // that day is its to miss: the streak it was dropped with is the streak it keeps.
  const entryCounts = {
    '2026-07-27': 1,
    '2026-07-29': 1,
    '2026-07-31': 1,
    '2026-08-03': 1,
    '2026-08-05': 1,
    '2026-08-07': 1,
    '2026-08-10': 1,
    '2026-08-12': 1,
    '2026-08-14': 1,
  };
  const archived = series(entryCounts, MON_WED_FRI, 1, '2026-07-27', '2026-08-14');

  it('keeps the streak it was archived with instead of decaying to 0', () => {
    const { current, best } = computeStreaks(archived, '2026-08-31');
    expect(current).toBe(9);
    expect(best).toBe(9);
  });

  it('does not count days after archiving towards the completion rate', () => {
    expect(computeCompletionRate(archived, '2026-08-31', 30)).toBe(1);
  });

  it('drops out of the tally entirely on a day past its end', () => {
    // 2026-08-31 is a Monday: scheduled, but the habit is no longer around for it.
    expect(tallyDay(archived, '2026-08-31', 1)).toEqual({
      scheduled: 0,
      closed: 0,
      active: 0,
      ratio: 0,
    });
  });
});

describe('toHabitSeries', () => {
  // Built from a local Date rather than written as a UTC literal: the conversion under
  // test is ISO -> local day, so a fixed 'Z' timestamp lands on the previous day in
  // western zones and the assertion below would depend on where the test runs.
  const habit = {
    schedule_mask: EVERY_DAY,
    target_per_day: 1,
    created_at: new Date(2026, 7, 29, 9, 0).toISOString(),
  };

  it('starts the habit on the local day it was created', () => {
    expect(toHabitSeries(habit, {}).startDate).toBe('2026-08-29');
  });

  it('moves the start back to an older entry (a past day marked, or an import)', () => {
    expect(toHabitSeries(habit, { '2026-08-20': 1 }).startDate).toBe('2026-08-20');
  });

  it('falls back to the entries when created_at cannot be read', () => {
    const broken = { ...habit, created_at: 'not a date' };
    expect(toHabitSeries(broken, { '2026-08-20': 1 }).startDate).toBe('2026-08-20');
  });

  it('leaves an active habit open-ended', () => {
    expect(toHabitSeries(habit, {}).endDate).toBeNull();
  });

  it('ends an archived habit on the local day it was archived', () => {
    const archived = { ...habit, archived_at: new Date(2026, 8, 3, 21, 0).toISOString() };
    expect(toHabitSeries(archived, {}).endDate).toBe('2026-09-03');
  });

  it('moves the end forward to a later entry (a day marked, or an import)', () => {
    const archived = { ...habit, archived_at: new Date(2026, 8, 3, 21, 0).toISOString() };
    expect(toHabitSeries(archived, { '2026-09-10': 1 }).endDate).toBe('2026-09-10');
  });

  it('stays open when archived_at cannot be read, rather than cutting the history', () => {
    const archived = { ...habit, archived_at: 'not a date' };
    expect(toHabitSeries(archived, { '2026-08-20': 1 }).endDate).toBeNull();
  });
});

describe('computeStreaks with a malformed history', () => {
  // Only reachable from a database written before lib/backup.ts validated dates. The
  // walk used to throw RangeError out of the statistics render, which the error boundary
  // then showed on every visit to that habit.
  it('reads as empty instead of throwing on an impossible date', () => {
    const entryCounts = { '2026-02-31': 1, '2026-08-28': 1 };
    const habit = series(entryCounts, EVERY_DAY);
    expect(() => computeStreaks(habit, '2026-08-29')).not.toThrow();
    expect(computeStreaks(habit, '2026-08-29')).toEqual({ current: 0, best: 0 });
  });
});
