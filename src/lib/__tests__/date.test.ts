import {
  forEachDateKey,
  isValidDateKey,
  isValidTimeOfDay,
  shiftDateKey,
  todayKey,
  toDateKey,
  weekDates,
  weekStartKey,
} from '../date';

describe('shiftDateKey', () => {
  it('crosses a month boundary going back', () => {
    expect(shiftDateKey('2026-03-04', -7)).toBe('2026-02-25');
  });

  it('crosses a month boundary going forward', () => {
    expect(shiftDateKey('2026-02-25', 7)).toBe('2026-03-04');
  });

  it('steps back through the 1st into the previous month', () => {
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('steps forward through the last day into the next month', () => {
    expect(shiftDateKey('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('crosses a year boundary', () => {
    expect(shiftDateKey('2026-01-03', -7)).toBe('2025-12-27');
  });
});

describe('weekStartKey', () => {
  it('returns the Monday of a mid-week date', () => {
    expect(weekStartKey('2026-08-26')).toBe('2026-08-24');
  });

  it('returns the Monday of the same week for the Sunday that ends it', () => {
    // 2026-08-30 is itself a Sunday — the tricky edge date-fns' getDay() mishandles
    // without weekStartsOn: 1.
    expect(weekStartKey('2026-08-30')).toBe('2026-08-24');
  });

  it('returns the date itself when it is already a Monday', () => {
    expect(weekStartKey('2026-08-24')).toBe('2026-08-24');
  });
});

describe('weekDates', () => {
  it('returns the 7 Monday-first date keys of the containing week', () => {
    const dates = weekDates(new Date(2026, 7, 26));
    expect(dates).toEqual([
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
  });

  it('gives the same week for the Sunday that ends it', () => {
    expect(weekDates(new Date(2026, 7, 30))[0]).toBe('2026-08-24');
  });
});

describe('toDateKey / todayKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('todayKey matches toDateKey(new Date())', () => {
    expect(todayKey()).toBe(toDateKey(new Date()));
  });
});

describe('isValidDateKey', () => {
  it('accepts a real calendar day', () => {
    expect(isValidDateKey('2026-02-28')).toBe(true);
  });

  it('accepts a leap day in a leap year', () => {
    expect(isValidDateKey('2024-02-29')).toBe(true);
  });

  // The regex-only check these replace let all four of these through, and every one of
  // them made shiftDateKey throw RangeError out of the statistics render.
  it('rejects a day the month does not have', () => {
    expect(isValidDateKey('2026-02-31')).toBe(false);
  });

  it('rejects a leap day in a common year', () => {
    expect(isValidDateKey('2026-02-29')).toBe(false);
  });

  it('rejects an out-of-range month', () => {
    expect(isValidDateKey('2026-13-01')).toBe(false);
  });

  it('rejects anything not shaped as YYYY-MM-DD', () => {
    expect(isValidDateKey('2026-8-29')).toBe(false);
    expect(isValidDateKey('29.08.2026')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });
});

describe('isValidTimeOfDay', () => {
  it('accepts a padded 24-hour time', () => {
    expect(isValidTimeOfDay('00:00')).toBe(true);
    expect(isValidTimeOfDay('09:05')).toBe(true);
    expect(isValidTimeOfDay('23:59')).toBe(true);
  });

  it('rejects out-of-range and unpadded values', () => {
    expect(isValidTimeOfDay('24:00')).toBe(false);
    expect(isValidTimeOfDay('09:60')).toBe(false);
    expect(isValidTimeOfDay('9:05')).toBe(false);
    expect(isValidTimeOfDay('вечером')).toBe(false);
  });
});

describe('forEachDateKey', () => {
  const collect = (from: string, to: string) => {
    const keys: string[] = [];
    forEachDateKey(from, to, (key) => keys.push(key));
    return keys;
  };

  it('includes both ends of the range', () => {
    expect(collect('2026-08-27', '2026-08-30')).toEqual([
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
    ]);
  });

  it('visits a single day when both ends are the same', () => {
    expect(collect('2026-08-29', '2026-08-29')).toEqual(['2026-08-29']);
  });

  it('crosses a month and a year boundary', () => {
    expect(collect('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('walks February of a leap year correctly', () => {
    expect(collect('2024-02-28', '2024-03-01')).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it('hands the visitor the date-fns weekday of each key', () => {
    const weekdays: number[] = [];
    // 2026-08-29 is a Saturday (6), 2026-08-30 a Sunday (0).
    forEachDateKey('2026-08-29', '2026-08-30', (_key, dayOfWeek) => weekdays.push(dayOfWeek));
    expect(weekdays).toEqual([6, 0]);
  });

  it('visits nothing when the range runs backwards', () => {
    expect(collect('2026-08-30', '2026-08-27')).toEqual([]);
  });

  it('visits nothing rather than throwing on an impossible date', () => {
    expect(collect('2026-02-31', '2026-08-29')).toEqual([]);
  });
});
