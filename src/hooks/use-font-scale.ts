import { useWindowDimensions } from 'react-native';

import { clampFontScale, scaleTypography, typography } from '@/constants/design-tokens';

/**
 * The system text size as a multiplier, clamped to the range the layout is verified at
 * — see `clampFontScale`.
 *
 * `useWindowDimensions` rather than `PixelRatio.getFontScale()`: both read the same iOS
 * accessibility multiplier, but only the hook re-renders when the user changes the size
 * in Settings while the app is in the background and comes back.
 */
export function useFontScale(): number {
  const { fontScale } = useWindowDimensions();
  return clampFontScale(fontScale);
}

/**
 * Font size alone for a variant, at the clamped system scale.
 *
 * For the text fields: a `TextInput` on iOS clips its own text when given an explicit
 * `lineHeight`, so they take the size without one and let the field's own `minHitSlop`
 * floor grow the box.
 */
export function useScaledFontSize(variant: keyof typeof typography): number {
  const scale = useFontScale();
  return scaleTypography(variant, scale).fontSize;
}

/**
 * A point size that is not text but has to grow with it — a box reserved for a number,
 * a fixed column width. Rounded, so it stays on whole points.
 */
export function useScaledSize(size: number): number {
  const scale = useFontScale();
  return Math.round(size * scale);
}
