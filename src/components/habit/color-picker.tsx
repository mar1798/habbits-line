import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { habitColors, radius, spacing, type ColorKey } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

const COLOR_KEYS = Object.keys(habitColors) as ColorKey[];

/** Swatches share the row width, so each lands near 40pt — hitSlop tops the target up to 44. */
const SWATCH_HIT_SLOP = { top: 4, bottom: 4, left: 2, right: 2 };

type ColorPickerProps = {
  value: string;
  onChange: (value: ColorKey) => void;
};

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { scheme, colors } = useTheme();

  return (
    <View style={styles.row}>
      {COLOR_KEYS.map((key) => {
        const isSelected = key === value;
        const swatch = habitColors[key][scheme];
        return (
          <PressableScale
            key={key}
            onPress={() => onChange(key)}
            hitSlop={SWATCH_HIT_SLOP}
            accessibilityRole="radio"
            accessibilityLabel={key}
            accessibilityState={{ checked: isSelected }}
            style={[styles.swatch, { backgroundColor: swatch }]}>
            {isSelected ? <SymbolView name="checkmark" size={18} tintColor={colors.onAccent} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  swatch: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
