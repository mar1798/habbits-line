import { SymbolView } from 'expo-symbols';
import { FlatList, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { radius, resolveExpenseColor, spacing } from '@/constants/design-tokens';
import type { ExpenseCategoryRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { categoryName } from '@/lib/category-name';

const COLUMNS = 3;
const SELECTED_BORDER_WIDTH = 2;
const CELL_HEIGHT = 76;

type Cell =
  | { kind: 'category'; key: string; category: ExpenseCategoryRow }
  | { kind: 'add'; key: string }
  | { kind: 'filler'; key: string };

type CategoryGridProps = {
  /** Already filtered by the form: active categories, plus the archived one being edited. */
  categories: ExpenseCategoryRow[];
  value: string | null;
  onChange: (categoryId: string) => void;
  /** Opens the category modal — the last tile of the grid. */
  onAdd: () => void;
};

/**
 * The grid ends in a "+" tile rather than sending the user to settings: a missing
 * category is discovered here, while the expense is being written, and the modal it opens
 * hands the new category straight back to the form as the selected one.
 *
 * A partial last row is padded with invisible fillers for the same reason as the emoji
 * picker: the cells are `flex: 1`, so a row holding two of three items would split the
 * full width between those two.
 */
export function CategoryGrid({ categories, value, onChange, onAdd }: CategoryGridProps) {
  const { colors, scheme } = useTheme();
  const { t } = useI18n();

  const cells: Cell[] = [
    ...categories.map((category): Cell => ({ kind: 'category', key: category.id, category })),
    { kind: 'add', key: 'add' },
  ];
  const remainder = cells.length % COLUMNS;
  for (let i = remainder; i !== 0 && i < COLUMNS; i++) {
    cells.push({ kind: 'filler', key: `filler-${i}` });
  }

  return (
    <FlatList
      data={cells}
      keyExtractor={(cell) => cell.key}
      numColumns={COLUMNS}
      // Inside the form's own ScrollView — the grid is short and must not scroll itself.
      scrollEnabled={false}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      renderItem={({ item }) => {
        if (item.kind === 'filler') {
          return <View style={styles.cell} />;
        }

        if (item.kind === 'add') {
          return (
            <PressableScale
              onPress={onAdd}
              accessibilityRole="button"
              accessibilityLabel={t('category_add')}
              style={[
                styles.cell,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}>
              <SymbolView name="plus" size={22} tintColor={colors.textSecondary} />
            </PressableScale>
          );
        }

        const { category } = item;
        const isSelected = category.id === value;
        const accentColor = resolveExpenseColor(category.color_key, scheme);

        return (
          <PressableScale
            onPress={() => onChange(category.id)}
            // Same reason as the emoji picker: iOS has no radio trait, and a non-button
            // role leaves VoiceOver announcing neither a control nor its selection.
            accessibilityRole="button"
            accessibilityLabel={`${category.emoji} ${categoryName(category.name, t)}`}
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.cell,
              {
                backgroundColor: isSelected ? accentColor : colors.surfaceAlt,
                borderColor: isSelected ? accentColor : 'transparent',
              },
            ]}>
            <Text variant="title2">{category.emoji}</Text>
            <Text
              variant="caption"
              numberOfLines={1}
              color={isSelected ? colors.onAccent : colors.textSecondary}
              style={styles.name}>
              {categoryName(category.name, t)}
            </Text>
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
    height: CELL_HEIGHT,
    borderRadius: radius.md,
    borderWidth: SELECTED_BORDER_WIDTH,
    // Filler cells carry no background or border color of their own; without this the
    // border would fall back to opaque black.
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  name: {
    textAlign: 'center',
  },
});
