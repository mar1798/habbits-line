import { useColorScheme } from 'react-native';

import { darkColors, lightColors, ThemeColors } from '@/constants/design-tokens';

export type ThemeScheme = 'light' | 'dark';

export function useTheme(): { scheme: ThemeScheme; colors: ThemeColors } {
  const scheme: ThemeScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: scheme === 'dark' ? darkColors : lightColors };
}
