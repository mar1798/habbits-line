import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
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

  // The fill is pre-composited rather than faded with the label: dimming the whole
  // control put the label at ~1.3:1 — "Создать" on an inactive Create button was there
  // but unreadable. `disabledSurface` recedes exactly as far as the fade did.
  const backgroundColor = disabled
    ? colors.disabledSurface
    : isPrimary
      ? colors.accent
      : colors.surfaceAlt;
  const textColor = disabled ? colors.textSecondary : isPrimary ? colors.onAccent : colors.textPrimary;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[styles.base, { backgroundColor }, style]}>
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
