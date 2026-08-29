import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';
import { daysToMask, maskToDays } from '@/lib/schedule';

/** Bit 0 = Monday … bit 6 = Sunday, matching schedule_mask and day-strip.tsx. */
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type WeekdayPickerProps = {
  value: number;
  onChange: (mask: number) => void;
};

export function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  const { colors } = useTheme();
  const activeDays = new Set(maskToDays(value));

  const toggle = (bit: number) => {
    const next = new Set(activeDays);
    if (next.has(bit)) {
      next.delete(bit);
    } else {
      next.add(bit);
    }
    onChange(daysToMask(Array.from(next)));
  };

  return (
    <View style={styles.row}>
      {WEEKDAY_LABELS.map((label, bit) => {
        const isSelected = activeDays.has(bit);
        return (
          <PressableScale
            key={label}
            onPress={() => toggle(bit)}
            // See color-picker: `checkbox` is not a role iOS understands.
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: isSelected }}
            style={[styles.day, { backgroundColor: isSelected ? colors.accent : colors.surfaceAlt }]}>
            <Text variant="callout" color={isSelected ? colors.onAccent : colors.textPrimary}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  day: {
    flex: 1,
    minHeight: minHitSlop,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
