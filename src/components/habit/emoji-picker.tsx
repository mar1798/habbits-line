import { FlatList, StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/design-tokens';
import { HABIT_EMOJIS } from '@/constants/emoji';
import { useTheme } from '@/hooks/use-theme';

const COLUMNS = 6;
const SELECTED_BORDER_WIDTH = 2;

type EmojiPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const { colors } = useTheme();

  return (
    <FlatList
      data={HABIT_EMOJIS}
      keyExtractor={(emoji) => emoji}
      numColumns={COLUMNS}
      scrollEnabled={false}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => {
        const isSelected = item === value;
        return (
          <PressableScale
            onPress={() => onChange(item)}
            accessibilityRole="radio"
            accessibilityLabel={item}
            accessibilityState={{ checked: isSelected }}
            style={[
              styles.cell,
              // accentSoft alone is a couple of percent away from surfaceAlt in the light
              // theme — the ring is what actually shows which emoji is picked.
              {
                backgroundColor: isSelected ? colors.accentSoft : colors.surfaceAlt,
                borderColor: isSelected ? colors.accent : 'transparent',
              },
            ]}>
            <Text variant="title2">{item}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
