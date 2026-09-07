import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, resolveExpenseColor, spacing } from '@/constants/design-tokens';
import type { ExpenseCategoryRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { categoryName } from '@/lib/category-name';
import type { QuickEntry } from '@/lib/expenses';
import { formatAmount } from '@/lib/money';

type QuickAddProps = {
  /** Offers from `quickEntries`, in the order they are shown. */
  entries: QuickEntry[];
  /** Categories the offers are named and coloured by, archived ones included. */
  categories: ExpenseCategoryRow[];
  /** Writes the expense. Must not reject — the caller owns the failure alert. */
  onSelect: (entry: QuickEntry) => Promise<void>;
};

/**
 * The one-tap row above the day list: a handful of amounts already spent in a category
 * before, each writing the expense on the spot. The "+" button above stays the way to
 * enter anything else, and the row's own rules live in `quickEntries`.
 *
 * A chip carries only the category emoji and the amount. The name would double the width
 * of every chip for something the emoji already says, and this row is worth having only
 * while the whole of it is reachable without scrolling.
 */
export function QuickAdd({ entries, categories, onSelect }: QuickAddProps) {
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const [pending, setPending] = useState<string | null>(null);

  // An archived category is not offered, exactly as in the expense form's grid: the row
  // would otherwise keep proposing a category the form itself has stopped showing.
  const offers = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          category: categories.find((category) => category.id === entry.categoryId),
        }))
        .filter(
          (offer): offer is { entry: QuickEntry; category: ExpenseCategoryRow } =>
            offer.category !== undefined && offer.category.archived_at === null
        ),
    [categories, entries]
  );

  /**
   * One write at a time. Nothing here is idempotent — two taps mean two expenses, which
   * is a real thing to want — but the guard keeps a double tap on one chip from being it,
   * the same way the starter habits guard theirs.
   */
  const handlePress = (key: string, entry: QuickEntry) => {
    if (pending !== null) return;
    setPending(key);
    onSelect(entry).finally(() => setPending(null));
  };

  if (offers.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text variant="caption" color={colors.textSecondary}>
        {t('expenses_quick_title')}
      </Text>
      <View style={styles.chips}>
        {offers.map(({ entry, category }) => {
          const accentColor = resolveExpenseColor(category.color_key, scheme);
          const key = `${entry.categoryId}-${entry.amount}`;
          // The chip shows an emoji and a number; the label has to say what they mean,
          // and the description is part of what the tap is about to write.
          const label = [categoryName(category.name, t), formatAmount(entry.amount), entry.note]
            .filter(Boolean)
            .join(', ');

          return (
            <PressableScale
              key={key}
              onPress={() => handlePress(key, entry)}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={t('expenses_quick_hint')}
              // Same tint as the emoji bubble of the row this chip is about to create.
              style={[styles.chip, { backgroundColor: `${accentColor}33` }]}>
              <Text variant="body">{category.emoji}</Text>
              <Text variant="callout">{formatAmount(entry.amount)}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  // Content-sized chips, so wrapping is safe: nothing here carries a percentage width the
  // gaps could push over the edge.
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
});
