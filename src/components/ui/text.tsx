import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { typography } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

type Variant = keyof typeof typography;

/** `allowFontScaling` is omitted on purpose: sizes are fixed by the design system. */
export type TextProps = Omit<RNTextProps, 'allowFontScaling'> & {
  variant?: Variant;
  color?: string;
};

export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      style={[typography[variant], { color: color ?? colors.textPrimary }, style]}
      {...rest}
      allowFontScaling={false}
    />
  );
}
