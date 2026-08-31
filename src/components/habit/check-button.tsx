import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { PRESS_SCALE, PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, motion, opacity, radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

const checkSpring = { ...motion.spring.check, reduceMotion: ReduceMotion.System };
const pressSpring = { ...motion.spring.press, reduceMotion: ReduceMotion.System };

/** Scale the bounce reaches on a tick, and the one the wrap back to 0 squashes to. */
const BOUNCE_UP = 1.18;
const BOUNCE_DOWN = 0.88;

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
  const { t } = useI18n();
  const done = count >= target;
  const showsCount = target > 1;
  const bounce = useSharedValue(1);
  const press = useSharedValue(1);

  // Both animations, on the one layer that may be transformed.
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value * press.value }],
  }));

  const fill = disabled ? colors.disabled : done ? color : colors.surfaceAlt;

  const handlePress = () => {
    // Squashes on the wrap back to 0 and overshoots on every other step, so the reset
    // reads as undo rather than as one more tick.
    const isReset = count >= target;
    bounce.value = withSequence(
      withSpring(isReset ? BOUNCE_DOWN : BOUNCE_UP, checkSpring),
      withSpring(1, checkSpring)
    );
    onPress();
  };

  const handlePressIn = () => {
    press.value = withSpring(PRESS_SCALE, pressSpring);
  };

  const handlePressOut = () => {
    press.value = withSpring(1, pressSpring);
  };

  return (
    <PressableScale
      onPress={handlePress}
      // Nothing this button draws may be transformed, so `PressableScale`'s own scale
      // is switched off and the press is handed to the fill along with the tick.
      scaleTo={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        showsCount
          ? t('check_progress', { count, target })
          : t(done ? 'check_mark_undone' : 'check_mark_done')
      }
      accessibilityState={{ disabled: Boolean(disabled), checked: done }}
      style={[styles.base, showsCount && styles.withLabel, disabled && { opacity: opacity.disabled }]}>
      {/*
        The bounce and the press run on the pill behind the label, never on the label
        itself: iOS draws text and symbols once at the size they were laid out, and a
        transform only resamples that bitmap — so scaling either one, up or down, costs
        it its edges.
      */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: fill }, fillStyle]}
      />
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
  // The counter keeps the circle's diameter as a floor, so a habit with a target of
  // 3 draws the same 44pt pill as the checkmark next to it in the list; only counts
  // too wide for that — "10/12" — push it out.
  withLabel: {
    width: undefined,
    minWidth: minHitSlop,
    paddingHorizontal: spacing.sm,
  },
  // Its own layer so the animations have something to scale that isn't the label; the
  // pill it draws is the one `base` would have drawn as a plain background.
  fill: {
    borderRadius: radius.pill,
  },
});
