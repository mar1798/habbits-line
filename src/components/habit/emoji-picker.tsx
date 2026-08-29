import { FlatList, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/design-tokens';
import { HABIT_EMOJIS } from '@/constants/emoji';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 6;
const SELECTED_BORDER_WIDTH = 2;

type EmojiCell = { key: string; emoji: string | null };

/**
 * The emoji set padded out to a whole number of rows, with `emoji: null` standing in for
 * the empty slots.
 *
 * A partial last row cannot be left partial: the cells are `flex: 1`, so a row holding
 * four of six items splits the full width between those four and — through
 * `aspectRatio` — grows taller to match. Invisible fillers keep the grid square.
 */
const EMOJI_CELLS: EmojiCell[] = (() => {
  const cells: EmojiCell[] = HABIT_EMOJIS.map((emoji) => ({ key: emoji, emoji }));
  const remainder = cells.length % COLUMNS;
  for (let i = remainder; i !== 0 && i < COLUMNS; i++) {
    cells.push({ key: `filler-${i}`, emoji: null });
  }
  return cells;
})();

type EmojiPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const { colors } = useTheme();

  return (
    <FlatList
      data={EMOJI_CELLS}
      keyExtractor={(cell) => cell.key}
      numColumns={COLUMNS}
      scrollEnabled={false}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => {
        if (item.emoji === null) {
          return <View style={styles.cell} />;
        }

        const emoji = item.emoji;
        const isSelected = emoji === value;
        return (
          <PressableScale
            onPress={() => onChange(emoji)}
            // `radio` is not a role iOS understands: it exports the cell as a plain
            // element, so VoiceOver announces neither "button" nor the selection. Same
            // reason the state is `selected` rather than `checked`.
            accessibilityRole="button"
            accessibilityLabel={emoji}
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.cell,
              // accentSoft alone is a couple of percent away from surfaceAlt in the light
              // theme — the ring is what actually shows which emoji is picked.
              {
                backgroundColor: isSelected ? colors.accentSoft : colors.surfaceAlt,
                borderColor: isSelected ? colors.accent : 'transparent',
              },
            ]}>
            <Text variant="title2">{emoji}</Text>
          </PressableScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  row: {
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: SELECTED_BORDER_WIDTH,
    // Filler cells carry no background or border color of their own; without this the
    // border would fall back to opaque black.
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
