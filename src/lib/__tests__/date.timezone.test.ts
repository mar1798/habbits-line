import {
  forEachDateKey,
  parseDateKey,
  shiftDateKey,
  timestampDateKey,
  toDateKey,
  weekDates,
  weekStartKey,
} from '../date';

/**
 * The app has no timezone of its own: a date key is whatever calendar day the device is
 * on. This suite pins that down without touching the clock — it asserts only things that
 * must hold in *every* zone, so running it under a different TZ is what changes the
 * device. `npm run test:tz` replays it across the extremes (UTC+14 to UTC-10, the
 * southern-hemisphere DST zones, and half-hour offsets).
 *
 * `process.env.TZ` cannot do this from inside a test: jest hands each test file a copy of
 * the environment, so assigning to it never reaches the ICU data behind `Date`. The zone
 * has to be set before the worker starts, which is why this lives in its own file.
 */

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Independent oracle for `toDateKey`: the same instant rendered as a local calendar day
 * by ICU rather than by our own getFullYear/getMonth/getDate arithmetic.
 */
const localDayViaIntl = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format;

/** Independent oracle for day stepping: plain calendar arithmetic, no Date involved. */
function nextCalendarDay(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < lengths[month - 1]) return `${key.slice(0, 8)}${String(day + 1).padStart(2, '0')}`;
  if (month < 12) return `${key.slice(0, 4)}-${String(month + 1).padStart(2, '0')}-01`;
  return `${year + 1}-01-01`;
}

function calendarYear(year: number): string[] {
  const keys = [`${year}-01-01`];
  while (true) {
    const next = nextCalendarDay(keys[keys.length - 1]);
    if (next.slice(0, 4) !== String(year)) return keys;
    keys.push(next);
  }
}

describe(`date keys under ${TIME_ZONE}`, () => {
  it('keys an instant by the local day, never the UTC one', () => {
    // Every 6 hours through 2026 — whatever the zone's offset and DST rules, each of
    // these lands on the day ICU reports for it.
    for (let hours = 0; hours < 365 * 24; hours += 6) {
      const instant = new Date(Date.UTC(2026, 0, 1, hours));
      expect(toDateKey(instant)).toBe(localDayViaIntl(instant));
    }
  });

  it('keys the last and first minute of a local day as that day', () => {
    // The two edges toISOString() gets wrong: late evening west of UTC reads as
    // tomorrow, early morning east of UTC as yesterday.
    expect(toDateKey(new Date(2026, 7, 29, 23, 59))).toBe('2026-08-29');
    expect(toDateKey(new Date(2026, 7, 29, 0, 0))).toBe('2026-08-29');
  });

  it('round-trips a stored key through local midnight and back', () => {
    // What guarantees a day the user already ticked off does not move when the device
    // changes zone: the key is a calendar day, not an instant.
    for (const key of calendarYear(2026)) {
      expect(toDateKey(parseDateKey(key))).toBe(key);
    }
  });

  it('parses a key to a moment inside that local day', () => {
    // parseDateKey aims at local midnight; in a zone whose DST jump happens at midnight
    // that hour does not exist and the Date lands on 01:00 — still the same day, which
    // is all any caller depends on.
    for (const key of calendarYear(2026)) {
      const date = parseDateKey(key);
      expect(Number.isNaN(date.getTime())).toBe(false);
      expect(toDateKey(date)).toBe(key);
    }
  });

  it('steps exactly one calendar day across every DST transition of the year', () => {
    // A naive +24h loses or repeats a day wherever the clock shifts; whichever days
    // this zone shifts on are somewhere in this walk.
    for (const key of calendarYear(2026)) {
      expect(shiftDateKey(key, 1)).toBe(nextCalendarDay(key));
      expect(shiftDateKey(shiftDateKey(key, 1), -1)).toBe(key);
    }
  });

  it('visits every day of the year exactly once', () => {
    const expected = calendarYear(2026);
    const visited: string[] = [];
    forEachDateKey('2026-01-01', '2026-12-31', (key) => visited.push(key));
    expect(visited).toEqual(expected);
  });

  it('anchors every day of the year on the Monday of its week', () => {
    for (const key of calendarYear(2026)) {
      const start = weekStartKey(key);
      const week = weekDates(parseDateKey(key));
      expect(week[0]).toBe(start);
      expect(week).toContain(key);
      expect(parseDateKey(start).getDay()).toBe(1);
    }
  });

  it('reads a UTC timestamp as the day it fell on locally', () => {
    // created_at is written in UTC, so this is the one value whose day a zone change can
    // legitimately move — it must move to the local day, not stay on the UTC one.
    for (let hours = 0; hours < 365 * 24; hours += 6) {
      const instant = new Date(Date.UTC(2026, 0, 1, hours));
      expect(timestampDateKey(instant.toISOString())).toBe(localDayViaIntl(instant));
    }
  });
});
