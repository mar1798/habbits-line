import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { radius, resolveExpenseColor, spacing } from '@/constants/design-tokens';
import type { ExpenseCategoryRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { categoryName } from '@/lib/category-name';
import type { CategoryTotal } from '@/lib/expenses';
import { formatAmount } from '@/lib/money';

type CategoryBreakdownProps = {
  /** Per-category sums, largest first — from `categoryTotals`. */
  breakdown: CategoryTotal[];
  /** Every category the rows may name, archived ones included. */
  categories: ExpenseCategoryRow[];
};

/**
 * Where a span of money went, one row per category. Shared by the period block and the
 * picked-range block below it: the two differ only in which expenses they sum, and a
 * second copy of these rows drifted from the first the moment either was touched.
 *
 * The empty case belongs to the caller — "nothing this period" and "nothing on these
 * dates" are different sentences.
 */
export function CategoryBreakdown({ breakdown, categories }: CategoryBreakdownProps) {
  const { colors, scheme } = useTheme();
  const { t } = useI18n();

  return (
    <Card style={styles.rows}>
      {breakdown.map((entry) => {
        const category = categories.find((item) => item.id === entry.categoryId);
        return (
          <View key={entry.categoryId} style={styles.row}>
            <View
              style={[
                styles.mark,
                { backgroundColor: resolveExpenseColor(category?.color_key ?? '', scheme) },
              ]}
            />
            <Text variant="body" numberOfLines={1} style={styles.rowName}>
              {category ? `${category.emoji} ${categoryName(category.name, t)}` : '—'}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {Math.round(entry.share * 100)}%
            </Text>
            <Text variant="callout" style={styles.rowAmount}>
              {formatAmount(entry.amount)}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.pill,
  },
  rowName: {
    flex: 1,
  },
  rowAmount: {
    // Keeps the amounts of neighbouring rows aligned on the right edge of the card.
    textAlign: 'right',
  },
});
