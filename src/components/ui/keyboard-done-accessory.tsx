import { InputAccessoryView, Keyboard, Platform, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, opacity, radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

/**
 * The id the bar is registered under. Pass it to the field's `inputAccessoryViewID` and
 * render `<KeyboardDoneAccessory />` anywhere in the same screen.
 */
export const DONE_ACCESSORY_ID = 'keyboard-done';

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
 * `InputAccessoryView` is iOS-only; on Android the pad is dismissed with the system back
 * gesture, so nothing is rendered there.
 */
export function KeyboardDoneAccessory({ onClear, clearDisabled }: KeyboardDoneAccessoryProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={DONE_ACCESSORY_ID}>
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
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
