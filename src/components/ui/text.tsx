import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { scaleTypography, typography } from '@/constants/design-tokens';
import { useFontScale } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';

type Variant = keyof typeof typography;

/**
 * `allowFontScaling` is omitted on purpose — the scaling is done here instead, by
 * multiplying the variant's own size and line height by the clamped system multiplier,
 * so the app follows Dynamic Type without letting it run past the range the layout was
 * checked at. See `scaleTypography`.
 */
export type TextProps = Omit<RNTextProps, 'allowFontScaling'> & {
  variant?: Variant;
  color?: string;
};

export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const scale = useFontScale();

  return (
    <RNText
      style={[
        typography[variant],
        scaleTypography(variant, scale),
        { color: color ?? colors.textPrimary },
        style,
      ]}
      {...rest}
      allowFontScaling={false}
    />
  );
}
