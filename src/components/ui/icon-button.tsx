import { SFSymbol, SymbolView } from 'expo-symbols';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { minHitSlop, opacity, radius } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

import { PressableScale } from './pressable-scale';

/**
 * Frame of a `compact` button. The 44pt default is right for a primary action standing
 * on its own, but reads as oversized for the small controls that sit next to a title or
 * a label — the hitSlop below keeps the touch target at 44pt regardless.
 */
const COMPACT_SIZE = 32;
const COMPACT_HIT_SLOP = (minHitSlop - COMPACT_SIZE) / 2;

type IconButtonProps = {
  name: SFSymbol;
  onPress: () => void;
  /** Required: an icon alone gives VoiceOver nothing to announce. */
  accessibilityLabel: string;
  disabled?: boolean;
  /** Smaller frame, same 44pt touch target. */
  compact?: boolean;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  disabled,
  compact = false,
  size,
  color,
  backgroundColor,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const frame = compact ? COMPACT_SIZE : minHitSlop;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      hitSlop={compact ? COMPACT_HIT_SLOP : undefined}
      style={[
        styles.base,
        { width: frame, height: frame },
        { backgroundColor: disabled ? colors.disabled : (backgroundColor ?? colors.surfaceAlt) },
        disabled && { opacity: opacity.disabled },
        style,
      ]}>
      <SymbolView
        name={name}
        size={size ?? (compact ? 15 : 20)}
        tintColor={disabled ? colors.textTertiary : (color ?? colors.textPrimary)}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
