import { Platform } from 'react-native';

export const lightColors = {
  bg: '#F6F5FA',
  surface: '#FDFCFF',
  surfaceAlt: '#EFEDF7',
  border: '#E3E0EE',
  textPrimary: '#16141F',
  textSecondary: '#5C5870',
  textTertiary: '#8E8AA3',
  accent: '#6C4DFF',
  accentPressed: '#5B3EE0',
  accentSoft: '#EAE4FF',
  onAccent: '#FBFAFF',
  // Dark enough to carry their own text on `bg` at 4.5:1 — all three are used as a text
  // color (the reminder-denied notes, the notification-limit banner), where the lighter
  // originals sat at 2.2–3.6:1.
  success: '#227E5A',
  danger: '#D42D23',
  warning: '#926716',
  overlay: '#16141FA6',
  shadowColor: '#2A2440',
  unscheduled: '#E9E7F1',
  disabled: '#D9D6E4',
} as const;

export const darkColors = {
  bg: '#0F0D17',
  surface: '#191624',
  surfaceAlt: '#221E30',
  border: '#2C2739',
  textPrimary: '#F2F0F7',
  textSecondary: '#A9A4BD',
  textTertiary: '#6F6A85',
  accent: '#9C86FF',
  accentPressed: '#8A73F0',
  accentSoft: '#241E3A',
  onAccent: '#121020',
  success: '#3FD39A',
  danger: '#FF6B61',
  warning: '#F2B944',
  overlay: '#08060FBF',
  shadowColor: '#05030B',
  unscheduled: '#1E1A2A',
  disabled: '#2A2537',
} as const;

export type ThemeColors = Record<keyof typeof lightColors, string>;

export type ColorKey = 'violet' | 'indigo' | 'sky' | 'teal' | 'green' | 'amber' | 'coral' | 'pink';

/**
 * Light variants are all tuned to ~4.85:1 against `onAccent`, the color the check
 * button's `N/M` label is drawn in when a habit is done. The original hues were picked
 * for equal lightness alone and left six of the eight between 2.8:1 and 4.4:1 — the
 * count sat on them as pale-on-pale. Hue and saturation are unchanged; only lightness
 * moved, so the family still reads as one scale and violet still twins the accent.
 *
 * Dark variants already clear 6.5:1 against their own `onAccent` and are untouched.
 */
export const habitColors: Record<ColorKey, { light: string; dark: string }> = {
  violet: { light: '#6C4DFF', dark: '#9C86FF' },
  indigo: { light: '#4961E8', dark: '#8093FF' },
  sky: { light: '#2073B1', dark: '#63B4F0' },
  teal: { light: '#0E7C70', dark: '#4CD4C0' },
  green: { light: '#327D41', dark: '#6FD186' },
  amber: { light: '#946612', dark: '#F0B64A' },
  coral: { light: '#CB3925', dark: '#FF8875' },
  pink: { light: '#BA3C94', dark: '#F075C4' },
};

export const DEFAULT_HABIT_COLOR: ColorKey = 'violet';

const habitColorKeys = new Set<string>(Object.keys(habitColors));

/**
 * Unknown color_key (foreign or future import file) falls back to violet.
 *
 * The lookup goes through the key set rather than `habitColors[key] ?? default`:
 * an inherited name such as 'constructor' or 'toString' resolves to a prototype
 * member, slips past `??` and yields `undefined` instead of a color.
 */
export function resolveColorKey(key: string): ColorKey {
  return habitColorKeys.has(key) ? (key as ColorKey) : DEFAULT_HABIT_COLOR;
}

export function resolveHabitColor(key: string, scheme: 'light' | 'dark'): string {
  return habitColors[resolveColorKey(key)][scheme];
}

export type ExpenseColorKey =
  | 'violet'
  | 'indigo'
  | 'blue'
  | 'sky'
  | 'teal'
  | 'mint'
  | 'green'
  | 'olive'
  | 'amber'
  | 'orange'
  | 'coral'
  | 'rose'
  | 'pink'
  | 'plum'
  | 'brown'
  | 'slate';

/**
 * Expense categories get their own sixteen-key palette rather than sharing `habitColors`.
 * The two are used differently — a habit color is the fill under an `N/M` label, a
 * category color fills a segment of the period bar and a grid tile — and a shared type
 * would immediately push all sixteen into the habit picker, where eight are enough and
 * a row of sixteen stops reading as a scale.
 *
 * The first eight keys repeat the habit hex values verbatim: one family of tones across
 * the whole app is the point, the duplication is deliberate. The eight added here are
 * intermediate hues, ordered around the wheel so the picker still reads as a scale, with
 * the two neutrals last.
 *
 * Tuned by the same rule as the habit palette — aligned on contrast, not on lightness.
 * Light variants sit at ~4.85:1 against `onAccent` (a selected tile in the expense modal
 * is filled with the category color and carries its name on top), dark variants at
 * ~7:1 against `bg`, above the 6.5:1 floor.
 */
export const expenseColors: Record<ExpenseColorKey, { light: string; dark: string }> = {
  violet: { light: '#6C4DFF', dark: '#9C86FF' },
  indigo: { light: '#4961E8', dark: '#8093FF' },
  blue: { light: '#2769DB', dark: '#689CF5' },
  sky: { light: '#2073B1', dark: '#63B4F0' },
  teal: { light: '#0E7C70', dark: '#4CD4C0' },
  mint: { light: '#157E5B', dark: '#29B083' },
  green: { light: '#327D41', dark: '#6FD186' },
  olive: { light: '#5C7826', dark: '#81A931' },
  amber: { light: '#946612', dark: '#F0B64A' },
  orange: { light: '#AD561B', dark: '#F47928' },
  coral: { light: '#CB3925', dark: '#FF8875' },
  rose: { light: '#D02B57', dark: '#F66F93' },
  pink: { light: '#BA3C94', dark: '#F075C4' },
  plum: { light: '#B232C6', dark: '#CD7EDA' },
  brown: { light: '#91654B', dark: '#BC937C' },
  slate: { light: '#656E8C', dark: '#939BB7' },
};

export const DEFAULT_EXPENSE_COLOR: ExpenseColorKey = 'violet';

const expenseColorKeys = new Set<string>(Object.keys(expenseColors));

/**
 * Unknown `color_key` falls back to violet, for the same reason and through the same
 * key-set lookup as `resolveColorKey` — `expenseColors[key] ?? default` would resolve
 * an inherited name such as 'constructor' to a prototype member and hand back
 * `undefined` instead of a color.
 *
 * This is also the single place the category form normalizes its value on open, so
 * saving rewrites a foreign key rather than putting it back into the database.
 */
export function resolveExpenseColorKey(key: string): ExpenseColorKey {
  return expenseColorKeys.has(key) ? (key as ExpenseColorKey) : DEFAULT_EXPENSE_COLOR;
}

export function resolveExpenseColor(key: string, scheme: 'light' | 'dark'): string {
  return expenseColors[resolveExpenseColorKey(key)][scheme];
}

export const fontFamily = Platform.select({ ios: 'ui-rounded', default: undefined });

export const typography = {
  display: { fontFamily, fontSize: 40, lineHeight: 44, fontWeight: '700' },
  title1: { fontFamily, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  headline: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '400' },
  callout: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  caption: { fontFamily, fontSize: 13, lineHeight: 16, fontWeight: '500' },
  micro: { fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600' },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Minimum hit target on any interactive element, per design system. */
export const minHitSlop = 44;

/**
 * A disabled control has to recede, and its fill alone cannot do that: `disabled` is
 * darker than `surfaceAlt` in the light theme, so a disabled icon button drew *more*
 * attention than an enabled one next to it. Fading the whole control puts the composited
 * fill below `surfaceAlt` in both themes and dims the glyph with it.
 */
export const opacity = {
  disabled: 0.4,
} as const;

export const motion = {
  spring: {
    press: { damping: 18, stiffness: 320 },
    check: { damping: 12, stiffness: 260 },
  },
  timing: {
    fast: 140,
    base: 220,
  },
} as const;

type ShadowLevel = 'level1' | 'level2' | 'level3';

const shadowLevels: Record<ShadowLevel, { y: number; blur: number; opacity: number }> = {
  level1: { y: 2, blur: 8, opacity: 0.06 },
  level2: { y: 6, blur: 18, opacity: 0.1 },
  level3: { y: 12, blur: 32, opacity: 0.14 },
};

/**
 * In dark theme the shadow barely reads; depth there comes from surfaceAlt + border
 * instead, per the design system — callers still apply this, it just recedes.
 */
export function shadow(level: ShadowLevel, colors: ThemeColors) {
  const { y, blur, opacity } = shadowLevels[level];
  return {
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: y },
    shadowRadius: blur,
    shadowOpacity: opacity,
  };
}
