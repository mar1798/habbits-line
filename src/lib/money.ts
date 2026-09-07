/**
 * Narrow no-break space (U+202F) between groups of three digits: it never wraps and never
 * grows with the font the way a normal space does, so a long amount stays one number.
 */
const GROUP_SEPARATOR = ' ';
const GROUP_SIZE = 3;

/**
 * A no-break space between the number and its currency symbol: the pair is one token and
 * must never break across lines. Wider than the group separator above on purpose — the
 * gap before the symbol reads as a word boundary, the ones inside the number do not.
 */
const CURRENCY_GAP = '\u00a0';

/** Which side of the number the currency symbol is written on. */
export type CurrencyPosition = 'prefix' | 'suffix';

export const CURRENCY_POSITIONS: readonly CurrencyPosition[] = ['prefix', 'suffix'];

/**
 * The ruble sign after the number: the app's default language is Russian, the same reason
 * the starter categories are seeded in Russian. It is a preference, not a locale — the
 * symbol is free text and clearing it brings back the bare number this app used to show.
 */
export const DEFAULT_CURRENCY_SYMBOL = '\u20bd';
export const DEFAULT_CURRENCY_POSITION: CurrencyPosition = 'suffix';

/**
 * Three characters covers every symbol ('$', '₽', '€'), the three-letter codes people
 * write instead ('USD'), and the short words some currencies are written with ('грн').
 * Past that the symbol starts competing with the amount for the width of the card.
 */
export const MAX_CURRENCY_SYMBOL_LENGTH = 3;

export interface Currency {
  /** Free text, `''` when the app should show the bare number. */
  symbol: string;
  position: CurrencyPosition;
}

/** The bare number — what `formatAmount` shows when no symbol is set. */
export const NO_CURRENCY: Currency = { symbol: '', position: DEFAULT_CURRENCY_POSITION };

/**
 * What the currency field keeps of what was typed: no whitespace, no control characters,
 * at most `MAX_CURRENCY_SYMBOL_LENGTH` characters.
 *
 * Whitespace goes because the gap between number and symbol is the formatter's to write —
 * a symbol typed as " ₽" would double it — and a symbol of nothing but spaces would look
 * cleared while still being stored. Sliced by code point rather than by UTF-16 unit, so a
 * symbol outside the basic plane is not cut in half into a replacement character.
 */
export function normalizeCurrencySymbol(text: string): string {
  const cleaned = text.replace(/[\s\u0000-\u001f\u007f]/g, '');
  return Array.from(cleaned).slice(0, MAX_CURRENCY_SYMBOL_LENGTH).join('');
}

/** Reads the `currency_position` setting; anything unparseable falls back to the suffix. */
export function parseCurrencyPosition(value: string | null): CurrencyPosition {
  return CURRENCY_POSITIONS.includes(value as CurrencyPosition)
    ? (value as CurrencyPosition)
    : DEFAULT_CURRENCY_POSITION;
}

/**
 * An amount as it is shown anywhere in the app: whole units, digits grouped, a leading
 * minus when the budget is overspent, and the currency symbol the user set — on the side
 * they chose, or nowhere at all while they have set none.
 *
 * Written by hand rather than through `Intl.NumberFormat`: ICU behaviour on Hermes depends
 * on how the runtime was built, which would have to be verified separately on every SDK
 * bump, and a currency the user typed by hand is not an ISO code ICU would know anyway.
 * This stays pure and tested.
 *
 * The symbol is a display detail and never touches what is stored: amounts are integers in
 * one unspoken unit, exactly as they were before there was a symbol to print.
 */
export function formatAmount(value: number, currency: Currency = NO_CURRENCY): string {
  const number = groupDigits(Number.isFinite(value) ? Math.trunc(value) : 0);
  if (currency.symbol === '') return number;
  if (currency.position === 'suffix') return `${number}${CURRENCY_GAP}${currency.symbol}`;

  // The minus belongs to the amount, not to the symbol: "-$5", never "$-5". Split by hand
  // rather than through `replace`, whose replacement string would read a `$` in the
  // user-typed symbol as a capture reference.
  const negative = number.startsWith('-');
  return `${negative ? '-' : ''}${currency.symbol}${negative ? number.slice(1) : number}`;
}

function groupDigits(whole: number): string {
  const digits = String(Math.abs(whole));

  let grouped = '';
  for (let i = 0; i < digits.length; i++) {
    // Group from the right: a separator goes before every digit whose distance from the
    // end is a multiple of three, except at the very start.
    if (i > 0 && (digits.length - i) % GROUP_SIZE === 0) {
      grouped += GROUP_SEPARATOR;
    }
    grouped += digits[i];
  }

  return whole < 0 ? `-${grouped}` : grouped;
}

/**
 * Nine digits is already a billion — past that the grouped number stops fitting the field
 * on the narrowest phone, and an amount is an SQLite INTEGER either way.
 */
export const MAX_AMOUNT_DIGITS = 9;

/**
 * What an amount field keeps of what was typed: digits only, leading zeros eaten, capped
 * at `MAX_AMOUNT_DIGITS`. The number pad still lets a paste or a hardware keyboard
 * through, and "007" would otherwise be stored and shown as typed.
 *
 * A fractional amount is truncated, not flattened: everything from the first `.` or `,`
 * on is dropped before the digits are read. Stripping every non-digit instead glued the
 * fraction onto the whole part, so a pasted "1 250,50" became 125 050 — a hundredfold
 * error the field then showed back, grouped and plausible.
 *
 * An empty string is a valid intermediate state — it is what an empty field holds — and
 * simply fails its caller's "greater than zero" check.
 *
 * Shared by the expense form and the budget modal rather than copied into both: the two
 * fields are the same field, and a copy would drift the first time the rule changes.
 */
export function normalizeAmountInput(text: string): string {
  const whole = text.split(/[.,]/, 1)[0];
  return whole.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_AMOUNT_DIGITS);
}
