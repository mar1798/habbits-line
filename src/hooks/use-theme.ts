import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, ThemeColors } from '@/constants/design-tokens';

export type ThemeScheme = 'light' | 'dark';

export function useTheme(): { scheme: ThemeScheme; colors: ThemeColors } {
  const scheme: ThemeScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: scheme === 'dark' ? darkColors : lightColors };
}

/**
 * React Navigation's own DefaultTheme/DarkTheme carry hardcoded colors — among them
 * `rgb(255,255,255)` for headers and `rgb(1,1,1)` for the stack background, which the
 * native stack applies to its container. Both are banned by the design system, so the
 * theme is rebuilt from tokens; only `fonts` is taken from the base theme.
 */
export function useNavigationTheme(): Theme {
  const { scheme, colors } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...base,
    colors: {
      primary: colors.accent,
      background: colors.bg,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger,
    },
  };
}
