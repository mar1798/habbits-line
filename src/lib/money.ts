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
