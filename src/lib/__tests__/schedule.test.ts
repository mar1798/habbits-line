import { bitToAppleWeekday, daysToMask, isScheduledOn, maskToDays } from '../schedule';

describe('maskToDays / daysToMask', () => {
  it('round-trips an arbitrary set of days', () => {
    const days = [0, 2, 4]; // Mon, Wed, Fri
    expect(maskToDays(daysToMask(days))).toEqual(days);
  });

  it('bit 0 is Monday and bit 6 is Sunday', () => {
    expect(maskToDays(1)).toEqual([0]);
    expect(maskToDays(64)).toEqual([6]);
  });

  it('daysToMask combines bits with OR', () => {
    expect(daysToMask([0, 6])).toBe(1 | 64);
  });
});

describe('isScheduledOn', () => {
  // date-fns getDay(): 0 = Sunday … 6 = Saturday. schedule_mask: bit 0 = Monday … bit
  // 6 = Sunday. This is the one place the two numberings meet, so both ends of the
  // week get a dedicated case.
  const monday = new Date(2026, 7, 24);
  const sunday = new Date(2026, 7, 30);

  it('matches Monday against bit 0', () => {
    expect(isScheduledOn(daysToMask([0]), monday)).toBe(true);
    expect(isScheduledOn(daysToMask([6]), monday)).toBe(false);
  });

  it('matches Sunday against bit 6, not bit 0', () => {
    expect(isScheduledOn(daysToMask([6]), sunday)).toBe(true);
    expect(isScheduledOn(daysToMask([0]), sunday)).toBe(false);
  });

  it('a full week mask matches every day', () => {
    expect(isScheduledOn(127, monday)).toBe(true);
    expect(isScheduledOn(127, sunday)).toBe(true);
  });
});

describe('bitToAppleWeekday', () => {
  // CalendarTriggerInput/WeeklyTriggerInput's weekday: 1 = Sunday … 7 = Saturday —
  // the third weekday numbering in the app, alongside date-fns's getDay() and our mask.
  it('maps bit 0 (Monday) to 2', () => {
    expect(bitToAppleWeekday(0)).toBe(2);
  });

  it('wraps bit 6 (Sunday) to 1', () => {
    expect(bitToAppleWeekday(6)).toBe(1);
  });

  it('maps bit 5 (Saturday) to 7', () => {
    expect(bitToAppleWeekday(5)).toBe(7);
  });
});
