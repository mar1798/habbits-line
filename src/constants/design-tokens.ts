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
  success: '#2FAE7C',
  danger: '#E2564D',
  warning: '#E0A32E',
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

export const habitColors: Record<ColorKey, { light: string; dark: string }> = {
  violet: { light: '#6C4DFF', dark: '#9C86FF' },
  indigo: { light: '#4B63E8', dark: '#8093FF' },
  sky: { light: '#2E90D9', dark: '#63B4F0' },
  teal: { light: '#12A594', dark: '#4CD4C0' },
  green: { light: '#3D9A50', dark: '#6FD186' },
  amber: { light: '#C98A18', dark: '#F0B64A' },
  coral: { light: '#DE5C4A', dark: '#FF8875' },
  pink: { light: '#C2439B', dark: '#F075C4' },
};

export const DEFAULT_HABIT_COLOR: ColorKey = 'violet';

/** Unknown color_key (foreign or future import file) falls back to violet. */
export function resolveHabitColor(key: string, scheme: 'light' | 'dark'): string {
  const entry = habitColors[key as ColorKey] ?? habitColors[DEFAULT_HABIT_COLOR];
  return entry[scheme];
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
