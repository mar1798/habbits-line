import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, motion, opacity, radius, spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

const checkSpring = { ...motion.spring.check, reduceMotion: ReduceMotion.System };

/**
 * Haptics are deliberately not fired here: the tap that closes the whole day upgrades
 * the light tick to a success pattern, and only the screen knows that. Firing here too
 * would run two overlapping patterns on the same tap.
 */
type CheckButtonProps = {
  /** Progress toward `target`, cycling 0 → 1 → … → target → 0 on each press. */
  count: number;
  target: number;
  onPress: () => void;
  disabled?: boolean;
  /** The habit's resolved color, used as the fill once done. */
  color: string;
};

export function CheckButton({ count, target, onPress, disabled, color }: CheckButtonProps) {
  const { colors } = useTheme();
  const done = count >= target;
  const showsCount = target > 1;
  const bounce = useSharedValue(1);

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value }],
  }));

  const handlePress = () => {
    // Squashes on the wrap back to 0 and overshoots on every other step, so the reset
    // reads as undo rather than as one more tick.
    const isReset = count >= target;
    // eslint-disable-next-line react-hooks/immutability
    bounce.value = withSequence(
      withSpring(isReset ? 0.88 : 1.18, checkSpring),
      withSpring(1, checkSpring)
    );
    onPress();
  };

  return (
    <PressableScale
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={showsCount ? `${count} из ${target}` : done ? 'Отметить невыполненным' : 'Отметить выполненным'}
      accessibilityState={{ disabled: Boolean(disabled), checked: done }}
      style={[
        styles.base,
        showsCount && styles.withLabel,
        { backgroundColor: disabled ? colors.disabled : done ? color : colors.surfaceAlt },
        disabled && { opacity: opacity.disabled },
      ]}>
      <Animated.View style={bounceStyle}>
        {showsCount ? (
          <Text variant="callout" color={done ? colors.onAccent : colors.textPrimary}>
            {count}/{target}
          </Text>
        ) : (
          <SymbolView
            name={done ? 'checkmark' : 'circle'}
            size={20}
            tintColor={disabled ? colors.textTertiary : done ? colors.onAccent : colors.textTertiary}
          />
        )}
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: minHitSlop,
    height: minHitSlop,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withLabel: {
    width: undefined,
    paddingHorizontal: spacing.md,
  },
});
