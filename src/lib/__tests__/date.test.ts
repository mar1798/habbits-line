import { shiftDateKey, todayKey, toDateKey, weekDates, weekStartKey } from '../date';

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
