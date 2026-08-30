/**
 * Narrow no-break space (U+202F) between groups of three digits: it never wraps and never
 * grows with the font the way a normal space does, so a long amount stays one number.
 */
const GROUP_SEPARATOR = ' ';
const GROUP_SIZE = 3;

/**
 * An amount as it is shown anywhere in the app: whole units, digits grouped, a leading
 * minus when the budget is overspent. There are no fractional units and no currency
 * symbol — the app deliberately shows "just a number".
 *
 * Written by hand rather than through `Intl.NumberFormat`: with no currency there is
 * nothing to localize, and ICU behaviour on Hermes depends on how the runtime was built,
 * which would have to be verified separately on every SDK bump. This stays pure and tested.
 */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '0';

  const whole = Math.trunc(value);
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
 * An empty string is a valid intermediate state — it is what an empty field holds — and
 * simply fails its caller's "greater than zero" check.
 *
 * Shared by the expense form and the budget modal rather than copied into both: the two
 * fields are the same field, and a copy would drift the first time the rule changes.
 */
export function normalizeAmountInput(text: string): string {
  return text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_AMOUNT_DIGITS);
}
