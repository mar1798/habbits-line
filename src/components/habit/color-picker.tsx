import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { radius, spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

/**
 * Eight swatches share the row width, so each circle is only ~36–38pt across. The slop
 * takes exactly half the 8pt gap on each side, which brings the target to 44pt without
 * letting neighbouring targets overlap.
 */
const SWATCH_HIT_SLOP = { top: 4, bottom: 4, left: spacing.xs, right: spacing.xs };
const COLUMNS = 8;

/** A palette as design-tokens.ts writes them: one key per color, one hex per scheme. */
export type Palette<K extends string> = Record<K, { light: string; dark: string }>;

type ColorPickerProps<K extends string> = {
  /**
   * The palette to show. Passed in rather than read from the tokens directly: habits and
   * expense categories pick from two different palettes, and a second copy of this file
   * would drift from the first on the next change to a swatch.
   */
  colors: Palette<K>;
  value: string;
  onChange: (value: K) => void;
};

/**
 * Fixed rows of eight rather than one wrapping row: with `flexWrap` the swatches would
 * have to carry a percentage width, which cannot subtract the gaps between them, and the
 * eighth one of every row would drop to the next line. Chunking keeps `flex: 1`, so a
 * swatch is exactly the same size in the eight-color habit palette and in the sixteen-
 * color expense one, and a short last row stays aligned under the first.
 */
function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export function ColorPicker<K extends string>({ colors, value, onChange }: ColorPickerProps<K>) {
  const { scheme, colors: themeColors } = useTheme();
  const rows = chunk(Object.keys(colors) as K[], COLUMNS);

  return (
    <View style={styles.grid}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((key) => {
            const isSelected = key === value;
            const swatch = colors[key][scheme];
            return (
              <PressableScale
                key={key}
                onPress={() => onChange(key)}
                hitSlop={SWATCH_HIT_SLOP}
                // iOS has no radio/checkbox trait: with `radio` the swatch is exported as
                // a plain element and VoiceOver announces neither a control nor its
                // selection.
                accessibilityRole="button"
                accessibilityLabel={key}
                accessibilityState={{ selected: isSelected }}
                style={[styles.swatch, { backgroundColor: swatch }]}>
                {isSelected ? (
                  <SymbolView name="checkmark" size={18} tintColor={themeColors.onAccent} />
                ) : null}
              </PressableScale>
            );
          })}
          {/* Keeps a short last row's swatches the size of a full row's. */}
          {Array.from({ length: COLUMNS - row.length }, (_, filler) => (
            <View key={`filler-${filler}`} style={styles.swatch} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
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
