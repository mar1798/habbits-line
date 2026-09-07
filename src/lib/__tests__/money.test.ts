import {
  formatAmount,
  MAX_AMOUNT_DIGITS,
  MAX_CURRENCY_SYMBOL_LENGTH,
  normalizeAmountInput,
  normalizeCurrencySymbol,
  parseCurrencyPosition,
} from '../money';

// The separator is a narrow no-break space (U+202F), not a normal one — spelled out here
// so a test failure shows which character actually came back.
const NNBSP = ' ';

// The gap before a currency symbol is a plain no-break space, not the narrow one that
// groups the digits — spelled out for the same reason.
const NBSP = '\u00a0';

describe('formatAmount', () => {
  it('leaves numbers below a thousand ungrouped', () => {
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(1)).toBe('1');
    expect(formatAmount(999)).toBe('999');
  });

  it('groups digits in threes from the right', () => {
    expect(formatAmount(1000)).toBe(`1${NNBSP}000`);
    expect(formatAmount(12345)).toBe(`12${NNBSP}345`);
    expect(formatAmount(1000000)).toBe(`1${NNBSP}000${NNBSP}000`);
  });

  it('puts the minus in front of a negative remainder', () => {
    expect(formatAmount(-1)).toBe('-1');
    expect(formatAmount(-1500)).toBe(`-1${NNBSP}500`);
  });

  it('shows whole units only', () => {
    expect(formatAmount(1000.75)).toBe(`1${NNBSP}000`);
    expect(formatAmount(-0.5)).toBe('0');
  });

  it('falls back to zero for a value that is not a number', () => {
    expect(formatAmount(Number.NaN)).toBe('0');
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('normalizeAmountInput', () => {
  it('keeps digits and drops everything else', () => {
    expect(normalizeAmountInput('1234')).toBe('1234');
    expect(normalizeAmountInput('1 2a3-')).toBe('123');
    expect(normalizeAmountInput('abc')).toBe('');
  });

  it('truncates a pasted fraction instead of gluing it onto the whole part', () => {
    expect(normalizeAmountInput('12.50')).toBe('12');
    expect(normalizeAmountInput('1 250,50')).toBe('1250');
    expect(normalizeAmountInput('0.99')).toBe('');
  });

  it('eats leading zeros', () => {
    expect(normalizeAmountInput('007')).toBe('7');
    expect(normalizeAmountInput('000')).toBe('');
  });

  it('treats an empty field as an empty string, not a zero', () => {
    expect(normalizeAmountInput('')).toBe('');
  });

  it('caps the length so the grouped number still fits the field', () => {
    expect(normalizeAmountInput('1234567890123')).toHaveLength(MAX_AMOUNT_DIGITS);
    expect(normalizeAmountInput('1234567890123')).toBe('123456789');
  });
});

describe('formatAmount with a currency', () => {
  it('shows the bare number while no symbol is set', () => {
    expect(formatAmount(1200, { symbol: '', position: 'suffix' })).toBe(`1${NNBSP}200`);
    expect(formatAmount(1200, { symbol: '', position: 'prefix' })).toBe(`1${NNBSP}200`);
  });

  it('writes the symbol on the side it was given', () => {
    expect(formatAmount(1200, { symbol: '\u20bd', position: 'suffix' })).toBe(
      `1${NNBSP}200${NBSP}\u20bd`
    );
    expect(formatAmount(1200, { symbol: '$', position: 'prefix' })).toBe(`$1${NNBSP}200`);
  });

  it('keeps the minus in front of the whole amount, symbol included', () => {
    expect(formatAmount(-500, { symbol: '$', position: 'prefix' })).toBe('-$500');
    expect(formatAmount(-500, { symbol: '\u20bd', position: 'suffix' })).toBe(`-500${NBSP}\u20bd`);
  });

  it('takes a symbol containing a replacement pattern literally', () => {
    expect(formatAmount(5, { symbol: '$&', position: 'prefix' })).toBe('$&5');
  });
});

describe('normalizeCurrencySymbol', () => {
  it('drops whitespace and control characters', () => {
    expect(normalizeCurrencySymbol(' \u20bd ')).toBe('\u20bd');
    expect(normalizeCurrencySymbol('\n\t')).toBe('');
    expect(normalizeCurrencySymbol('U S D')).toBe('USD');
  });

  it('caps the length', () => {
    expect(normalizeCurrencySymbol('рублей')).toHaveLength(MAX_CURRENCY_SYMBOL_LENGTH);
    expect(normalizeCurrencySymbol('USDT')).toBe('USD');
  });

  it('cuts by code point, so a symbol outside the basic plane survives whole', () => {
    expect(normalizeCurrencySymbol('\u{1f4b0}')).toBe('\u{1f4b0}');
  });

  it('treats an emptied field as a real setting', () => {
    expect(normalizeCurrencySymbol('')).toBe('');
  });
});

describe('parseCurrencyPosition', () => {
  it('reads the two known values', () => {
    expect(parseCurrencyPosition('prefix')).toBe('prefix');
    expect(parseCurrencyPosition('suffix')).toBe('suffix');
  });

  it('falls back to the suffix for a missing or unknown row', () => {
    expect(parseCurrencyPosition(null)).toBe('suffix');
    expect(parseCurrencyPosition('above')).toBe('suffix');
  });
});
