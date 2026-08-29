import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { minHitSlop, opacity, radius, spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

import { PressableScale } from './pressable-scale';
import { Text } from './text';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, onPress, variant = 'primary', disabled, style }: ButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';

  const backgroundColor = disabled
    ? colors.disabled
    : isPrimary
      ? colors.accent
      : colors.surfaceAlt;
  // onAccent on the disabled fill lands at ~1.4:1, so disabled text drops to tertiary.
  const textColor = disabled ? colors.textTertiary : isPrimary ? colors.onAccent : colors.textPrimary;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[styles.base, { backgroundColor }, disabled && { opacity: opacity.disabled }, style]}>
      <Text variant="callout" color={textColor}>
        {title}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minHitSlop,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
