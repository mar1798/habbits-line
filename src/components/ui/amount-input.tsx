import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing, typography } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, MAX_AMOUNT_DIGITS, normalizeAmountInput } from '@/lib/money';

/** Roughly iOS's own caret cadence. */
const CARET_BLINK_MS = 530;

type AmountInputProps = {
  /** Digits only, as `normalizeAmountInput` returns them; `''` is an empty field. */
  value: string;
  onChangeValue: (digits: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  /** Told when the field takes focus — the expense form points its keyboard bar at it. */
  onFocus?: () => void;
  autoFocus?: boolean;
};

/**
 * The amount field of the expense form and the budget modal: a grouped number the user
 * types on the number pad.
 *
 * What is on screen is a `Text`, not the input. A `TextInput` whose `value` is the
 * *formatted* amount has to be corrected by React after every keystroke — the pad puts
 * "1250" in the field, the next render puts "1 250" back — and each correction replaces
 * the native text and moves the caret with it, which is the flicker the field had on
 * every digit typed and every digit erased. Here the input holds the raw digits it was
 * given, so its own text never needs rewriting, and the grouped number is rendered
 * beside it from state, where nothing can jump.
 *
 * The input itself stays a real, focusable `TextInput` — invisible, over the whole field
 * — so focus, the pad, editing and VoiceOver are the platform's, not a reimplementation.
 */
export function AmountInput({
  value,
  onChangeValue,
  placeholder,
  accessibilityLabel,
  onFocus,
  autoFocus,
}: AmountInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const text = value === '' ? '' : formatAmount(Number(value));

  return (
    <Pressable
      // The whole field is the target, not just the digits at its right edge.
      onPress={() => inputRef.current?.focus()}
      // One control, and it is the input below: without this the row would be exported
      // as an element of its own and swallow the field.
      accessible={false}
      style={[
        styles.field,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: focused ? colors.accent : colors.border,
        },
      ]}>
      <Text variant="title1" color={text === '' ? colors.textTertiary : colors.textPrimary}>
        {text === '' ? placeholder : text}
      </Text>
      {focused ? <Caret color={colors.accent} /> : null}

      <TextInput
        ref={inputRef}
        // Raw digits, which is exactly what the pad produces — see the note above.
        value={value}
        onChangeText={(next) => onChangeValue(normalizeAmountInput(next))}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        // Refuses the keystroke itself once the field is full. Normalizing alone only
        // dropped the extra digit on the next render, so it appeared in the field and
        // was taken back out a frame later.
        maxLength={MAX_AMOUNT_DIGITS}
        autoFocus={autoFocus}
        // Same rule as components/ui/text.tsx: sizes are fixed by the design system.
        allowFontScaling={false}
        accessibilityLabel={accessibilityLabel}
        caretHidden
        style={[StyleSheet.absoluteFill, styles.input]}
      />
    </Pressable>
  );
}

/**
 * Stands in for the caret the invisible input cannot show. Blinking is what says the
 * field is focused; with reduced motion on it stays solid rather than disappearing.
 */
function Caret({ color }: { color: string }) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(withTiming(0, { duration: CARET_BLINK_MS }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.caret, animatedStyle, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    // The caret sits inside the field's own padding.
    overflow: 'hidden',
  },
  input: {
    // Present for the keyboard and for VoiceOver, never for the eye.
    opacity: 0,
  },
  caret: {
    width: 2,
    height: typography.title1.fontSize,
    borderRadius: 1,
  },
});
