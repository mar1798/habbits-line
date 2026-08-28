import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

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

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={showsCount ? `${count} из ${target}` : done ? 'Отметить невыполненным' : 'Отметить выполненным'}
      accessibilityState={{ disabled: Boolean(disabled), checked: done }}
      style={[
        styles.base,
        showsCount && styles.withLabel,
        { backgroundColor: disabled ? colors.disabled : done ? color : colors.surfaceAlt },
      ]}>
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
  withLabel: {
    width: undefined,
    paddingHorizontal: spacing.md,
  },
});
