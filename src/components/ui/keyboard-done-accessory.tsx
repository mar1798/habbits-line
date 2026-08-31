import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import {
  useKeyboardState,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, opacity, radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

/**
 * How much room the bar takes above the keyboard. The screens that render it add this to
 * the bottom of their scroll content, so the last control does not end up underneath it.
 */
export const KEYBOARD_BAR_HEIGHT = minHitSlop + spacing.sm * 2;

type KeyboardDoneAccessoryProps = {
  /** Empties the field. Omit it and the bar carries "Готово" alone. */
  onClear?: () => void;
  /** True while the field is already empty — clearing it is then a no-op. */
  clearDisabled?: boolean;
};

/**
 * A bar above the keyboard, for the fields whose keyboard has no return key of its own —
 * `number-pad` on iOS gives no way out except tapping the screen. Text fields don't need
 * it: `returnKeyType="done"` already blurs them.
 *
 * It is our own view riding on the keyboard's height, not an `InputAccessoryView`. That
 * component binds itself to a text input once, by `nativeID`, when it first reaches the
 * window; when the binding does not happen — and it stopped happening after a language
 * switch — there is nothing in JS that can re-establish it, and the bar was then gone
 * for the rest of the session. A view positioned from the keyboard's own height has
 * nothing to bind to and cannot come up missing.
 *
 * The position comes from keyboard-controller, frame by frame on the UI thread, so the
 * bar also follows a keyboard being dragged away interactively. Rebuilding this from
 * `Keyboard.addListener` and a timing animation cannot: the event arrives on the JS
 * thread after the keyboard has already started moving, and it rides a private system
 * curve no duration of ours matches.
 *
 * iOS only, as before: on Android the pad is dismissed with the system back gesture.
 */
export function KeyboardDoneAccessory({ onClear, clearDisabled }: KeyboardDoneAccessoryProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  // `height` is already negative — 0 down to minus the keyboard's height — and `progress`
  // runs 0 → 1 with it. Both are shared values, written on the UI thread.
  const { height, progress } = useReanimatedKeyboardAnimation();
  /** Drives touchability only: an invisible bar must not swallow taps meant for the form. */
  const keyboardUp = useKeyboardState((state) => state.isVisible);

  const animatedStyle = useAnimatedStyle(() => ({
    // `height` is measured to the top of the safe area, not to the bottom of the window,
    // and the bar hangs from the window's own edge — without the inset it comes to rest a
    // home indicator's worth of screen below the keyboard, half-hidden behind it.
    transform: [{ translateY: height.get() - insets.bottom }],
    // Nothing to sit above once the keyboard is down. It stays laid out at the bottom
    // edge, so the next keyboard lifts it from there rather than fading it in mid-screen.
    opacity: progress.get(),
  }));

  if (Platform.OS !== 'ios') return null;

  return (
    <Animated.View
      pointerEvents={keyboardUp ? 'box-none' : 'none'}
      // The screens render this inside a Screen, whose bottom inset would otherwise lift
      // the bar off the keyboard by the height of the home indicator.
      style={[styles.layer, { bottom: -insets.bottom }, animatedStyle]}>
      <View
        style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {onClear ? (
          <PressableScale
            onPress={onClear}
            disabled={clearDisabled}
            accessibilityRole="button"
            accessibilityLabel={t('clear')}
            accessibilityState={{ disabled: Boolean(clearDisabled) }}
            style={[styles.button, clearDisabled && { opacity: opacity.disabled }]}>
            <Text variant="callout" color={colors.textSecondary}>
              {t('clear')}
            </Text>
          </PressableScale>
        ) : (
          // Keeps "Готово" on the right when there is nothing to its left.
          <View />
        )}

        <PressableScale
          onPress={() => Keyboard.dismiss()}
          accessibilityRole="button"
          accessibilityLabel={t('done')}
          style={[styles.button, styles.done, { backgroundColor: colors.accentSoft }]}>
          <Text variant="callout" color={colors.accent}>
            {t('done')}
          </Text>
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: KEYBOARD_BAR_HEIGHT,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    minHeight: minHitSlop,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  done: {
    // The one action with a fill: the bar's other half only empties the field.
    paddingHorizontal: spacing.xl,
  },
});
