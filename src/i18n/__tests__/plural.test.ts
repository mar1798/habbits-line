import { en, enPlurals, enWeekdays } from '../en';
import { englishPlural, russianPlural } from '../plural';
import { ru, ruPlurals, ruWeekdays } from '../ru';

describe('russianPlural', () => {
  const forms = { one: 'день', few: 'дня', many: 'дней' };

  it('picks `one` for 1, 21 and 101', () => {
    expect(russianPlural(1, forms)).toBe('день');
    expect(russianPlural(21, forms)).toBe('день');
    expect(russianPlural(101, forms)).toBe('день');
  });

  it('picks `few` for 2–4 and 22–24', () => {
    expect(russianPlural(2, forms)).toBe('дня');
    expect(russianPlural(4, forms)).toBe('дня');
    expect(russianPlural(22, forms)).toBe('дня');
  });

  it('picks `many` for 5 and up, and for the whole 11–14 band', () => {
    expect(russianPlural(5, forms)).toBe('дней');
    expect(russianPlural(11, forms)).toBe('дней');
    expect(russianPlural(12, forms)).toBe('дней');
    expect(russianPlural(14, forms)).toBe('дней');
    expect(russianPlural(111, forms)).toBe('дней');
  });

  // The streak card shows 0 while the streak is broken.
  it('picks `many` for 0', () => {
    expect(russianPlural(0, forms)).toBe('дней');
  });
});

describe('englishPlural', () => {
  const forms = { one: 'day', other: 'days' };

  it('picks `one` only for 1', () => {
    expect(englishPlural(1, forms)).toBe('day');
    expect(englishPlural(21, forms)).toBe('days');
  });

  it('picks `other` for 0 and for everything above 1', () => {
    expect(englishPlural(0, forms)).toBe('days');
    expect(englishPlural(2, forms)).toBe('days');
    expect(englishPlural(11, forms)).toBe('days');
  });
});

// The types already guarantee both dictionaries carry the same keys; these guard the
// two things they cannot — an empty string, and a placeholder that only one side has.
describe('dictionaries', () => {
  it('has no empty strings', () => {
    for (const value of Object.values(ru)) {
      expect(value.length).toBeGreaterThan(0);
    }
    for (const value of Object.values(en)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(ru) as (keyof typeof ru)[]) {
      expect(placeholders(en[key])).toEqual(placeholders(ru[key]));
    }
  });

  it('has a plural set and seven weekday labels in both languages', () => {
    expect(Object.keys(enPlurals).sort()).toEqual(Object.keys(ruPlurals).sort());
    expect(ruWeekdays.short).toHaveLength(7);
    expect(ruWeekdays.initial).toHaveLength(7);
    expect(enWeekdays.short).toHaveLength(7);
    expect(enWeekdays.initial).toHaveLength(7);
  });
});
