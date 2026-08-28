import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { typography } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

type Variant = keyof typeof typography;

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: string;
};

export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      allowFontScaling={false}
      style={[typography[variant], { color: color ?? colors.textPrimary }, style]}
      {...rest}
    />
  );
}
