import { shiftDateKey } from '../date';
import {
  clampPeriodStartDay,
  MAX_PERIOD_START_DAY,
  MIN_PERIOD_START_DAY,
  parsePeriodStartDay,
  periodEndFor,
  periodLength,
  periodStartDayOf,
  periodStartFor,
  shiftPeriod,
} from '../period';

describe('periodStartFor / periodEndFor', () => {
  it('with a start day of 1 a period is exactly its calendar month', () => {
    expect(periodStartFor('2026-08-15', 1)).toBe('2026-08-01');
    expect(periodEndFor('2026-08-15', 1)).toBe('2026-08-31');
  });

  it('with a start day of 6 the period straddles two months', () => {
    expect(periodStartFor('2026-08-20', 6)).toBe('2026-08-06');
    expect(periodEndFor('2026-08-20', 6)).toBe('2026-09-05');
  });

  // The boundary rule the whole module rests on: the start day opens the new period, it
  // does not close the previous one.
  it('a date landing on the start day opens the new period', () => {
    expect(periodStartFor('2026-08-06', 6)).toBe('2026-08-06');
    expect(periodStartFor('2026-08-05', 6)).toBe('2026-07-06');
  });

  it('the day before the start day still belongs to the previous period', () => {
    expect(periodEndFor('2026-08-05', 6)).toBe('2026-08-05');
    expect(periodStartFor('2026-08-05', 6)).toBe('2026-07-06');
  });

  it('crosses the year boundary backwards', () => {
    expect(periodStartFor('2026-01-03', 6)).toBe('2025-12-06');
    expect(periodEndFor('2026-01-03', 6)).toBe('2026-01-05');
  });

  it('crosses the year boundary forwards', () => {
    expect(periodStartFor('2025-12-20', 6)).toBe('2025-12-06');
    expect(periodEndFor('2025-12-20', 6)).toBe('2026-01-05');
  });

  // 28 is the largest allowed start day and the reason for the limit: it is the only one
  // that still exists in February, so no month needs a "pull back to the last day" rule.
  it('handles February with a start day of 28', () => {
    expect(periodStartFor('2026-02-28', 28)).toBe('2026-02-28');
    expect(periodEndFor('2026-02-28', 28)).toBe('2026-03-27');
    expect(periodStartFor('2026-02-27', 28)).toBe('2026-01-28');
    expect(periodEndFor('2026-02-27', 28)).toBe('2026-02-27');
  });

  it('the next period starts the day after the current one ends', () => {
    for (const startDay of [1, 6, 15, 28]) {
      const end = periodEndFor('2026-02-10', startDay);
      const nextStart = periodStartFor(shiftDateKey(end, 1), startDay);
      expect(nextStart).toBe(shiftDateKey(end, 1));
      expect(nextStart).toBe(shiftPeriod(periodStartFor('2026-02-10', startDay), 1));
    }
  });
});

describe('periodLength', () => {
  it('matches the calendar month when the period starts on the 1st', () => {
    expect(periodLength('2026-01-01', 1)).toBe(31);
    expect(periodLength('2026-04-01', 1)).toBe(30);
    expect(periodLength('2026-02-01', 1)).toBe(28);
    expect(periodLength('2024-02-01', 1)).toBe(29); // leap year
  });

  it('spans the two months it straddles when the period starts mid-month', () => {
    // 6 Feb 2026 -> 5 Mar 2026: 23 days of February plus 5 of March.
    expect(periodLength('2026-02-06', 6)).toBe(28);
    // The same period in a leap year gains February's extra day.
    expect(periodLength('2024-02-06', 6)).toBe(29);
  });
});

describe('shiftPeriod', () => {
  it('moves one period forward across 1 January', () => {
    expect(shiftPeriod('2025-12-06', 1)).toBe('2026-01-06');
  });

  it('moves one period back across 1 January', () => {
    expect(shiftPeriod('2026-01-06', -1)).toBe('2025-12-06');
  });

  it('keeps the day of month, including the largest allowed one', () => {
    expect(shiftPeriod('2026-01-28', 1)).toBe('2026-02-28');
    expect(shiftPeriod('2026-01-28', 2)).toBe('2026-03-28');
  });

  it('a shift of zero is the identity', () => {
    expect(shiftPeriod('2026-08-06', 0)).toBe('2026-08-06');
  });
});

describe('clampPeriodStartDay / parsePeriodStartDay', () => {
  it('holds the start day inside 1..28', () => {
    expect(clampPeriodStartDay(0)).toBe(1);
    expect(clampPeriodStartDay(31)).toBe(28);
    expect(clampPeriodStartDay(6)).toBe(6);
  });

  it('falls back to the 1st for a missing or unreadable setting', () => {
    expect(parsePeriodStartDay(null)).toBe(1);
    expect(parsePeriodStartDay('')).toBe(1);
    expect(parsePeriodStartDay('nonsense')).toBe(1);
    expect(parsePeriodStartDay('29')).toBe(28);
    expect(parsePeriodStartDay('6')).toBe(6);
  });
});

describe('periodStartDayOf', () => {
  // The inverse of `periodStartFor`: what start day produced this period start.
  it('reads the start day back off a period start', () => {
    expect(periodStartDayOf('2026-08-06')).toBe(6);
    expect(periodStartDayOf('2026-01-01')).toBe(1);
    expect(periodStartDayOf('2026-12-28')).toBe(28);
  });

  it('round-trips every legal start day, February included', () => {
    for (let day = MIN_PERIOD_START_DAY; day <= MAX_PERIOD_START_DAY; day++) {
      expect(periodStartDayOf(periodStartFor('2026-02-15', day))).toBe(day);
      expect(periodStartDayOf(periodStartFor('2026-08-31', day))).toBe(day);
    }
  });
});
