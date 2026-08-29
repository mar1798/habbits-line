import { daysToMask } from '../schedule';
import { computeCompletionRate, computeStreaks, dayCompletionRatio } from '../streaks';

// Mon / Wed / Fri, matching the example habit in PLAN.md's stage 6 acceptance criteria.
const MON_WED_FRI = daysToMask([0, 2, 4]);
const EVERY_DAY = daysToMask([0, 1, 2, 3, 4, 5, 6]);

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
    const { current, best } = computeStreaks(entryCounts, MON_WED_FRI, 1, '2026-08-26');
    expect(current).toBe(2);
    expect(best).toBe(2);
  });

  it('an unfinished today does not reset the running streak', () => {
    const entryCounts = { '2026-08-24': 1, '2026-08-26': 1 }; // Friday 08-28 left open
    const { current, best } = computeStreaks(entryCounts, MON_WED_FRI, 1, '2026-08-28');
    expect(current).toBe(2);
    expect(best).toBe(2);
  });

  it('a past scheduled day left open breaks the streak', () => {
    // Mon closed, Wed missed (past, scheduled, no entry), Fri closed.
    const entryCounts = { '2026-08-24': 1, '2026-08-28': 1 };
    const { current, best } = computeStreaks(entryCounts, MON_WED_FRI, 1, '2026-08-28');
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
    const { current, best } = computeStreaks(entryCounts, MON_WED_FRI, 1, '2026-09-02');
    expect(current).toBe(1);
    expect(best).toBe(3);
  });

  it('no entries at all gives a zero streak', () => {
    expect(computeStreaks({}, MON_WED_FRI, 1, '2026-08-28')).toEqual({ current: 0, best: 0 });
  });

  it('a lowered target still closes old rows via the clamp', () => {
    const entryCounts = { '2026-08-24': 3 };
    const { current } = computeStreaks(entryCounts, MON_WED_FRI, 1, '2026-08-24');
    expect(current).toBe(1);
  });
});

describe('computeCompletionRate', () => {
  it('is computed from scheduled days in the window, not calendar days', () => {
    // Window 2026-08-24..2026-08-30 (7 days) contains exactly 3 scheduled days.
    const entryCounts = { '2026-08-24': 1, '2026-08-26': 1, '2026-08-28': 1 };
    const rate = computeCompletionRate(entryCounts, MON_WED_FRI, 1, '2026-08-30', 7);
    expect(rate).toBe(1);
  });

  it('a 3-day-a-week habit is not capped around 43%', () => {
    const entryCounts = { '2026-08-24': 1, '2026-08-26': 1, '2026-08-28': 1 };
    const rate = computeCompletionRate(entryCounts, MON_WED_FRI, 1, '2026-08-30', 7);
    expect(rate).toBeGreaterThan(0.43);
  });

  it('counts a partially completed window', () => {
    const entryCounts = { '2026-08-24': 1, '2026-08-28': 1 }; // Wed missed
    const rate = computeCompletionRate(entryCounts, MON_WED_FRI, 1, '2026-08-30', 7);
    expect(rate).toBeCloseTo(2 / 3);
  });

  it('is 0 when the window has no scheduled days', () => {
    const sundayOnly = daysToMask([6]);
    // 2026-08-24..2026-08-29 is 6 days, none of them a Sunday.
    const rate = computeCompletionRate({}, sundayOnly, 1, '2026-08-29', 6);
    expect(rate).toBe(0);
  });
});

describe('computeStreaks with a malformed history', () => {
  // Only reachable from a database written before lib/backup.ts validated dates. The
  // walk used to throw RangeError out of the statistics render, which the error boundary
  // then showed on every visit to that habit.
  it('reads as empty instead of throwing on an impossible date', () => {
    const entryCounts = { '2026-02-31': 1, '2026-08-28': 1 };
    expect(() => computeStreaks(entryCounts, EVERY_DAY, 1, '2026-08-29')).not.toThrow();
    expect(computeStreaks(entryCounts, EVERY_DAY, 1, '2026-08-29')).toEqual({
      current: 0,
      best: 0,
    });
  });
});
