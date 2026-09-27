import { format } from 'date-fns/format';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { radius, resolveExpenseColor, spacing } from '@/constants/design-tokens';
import type { ExpenseCategoryRow, ExpenseRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useMoney } from '@/hooks/use-money';
import { useTheme } from '@/hooks/use-theme';
import { categoryName } from '@/lib/category-name';
import { parseDateKey } from '@/lib/date';
import type { CategoryTotal } from '@/lib/expenses';

type CategoryBreakdownProps = {
  /** Per-category sums, largest first — from `categoryTotals`. */
  breakdown: CategoryTotal[];
  /** Every category the rows may name, archived ones included. */
  categories: ExpenseCategoryRow[];
  /**
   * The expenses the breakdown was summed from, newest first — the repo's own order. When
   * given, each category opens on a tap to list them; without it the rows are plain.
   */
  expenses?: ExpenseRow[];
};

/**
 * Where a span of money went, one row per category. Shared by the period block and the
 * picked-range block below it: the two differ only in which expenses they sum, and a
 * second copy of these rows drifted from the first the moment either was touched.
 *
 * Only the period block passes `expenses` and so gets the accordions. One category is
 * open at a time: two lists of expenses open one under the other read as a single list.
 *
 * The empty case belongs to the caller — "nothing this period" and "nothing on these
 * dates" are different sentences.
 */
export function CategoryBreakdown({ breakdown, categories, expenses }: CategoryBreakdownProps) {
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const money = useMoney();
  const [openId, setOpenId] = useState<string | null>(null);

  const openExpenses = useMemo(
    () => (openId && expenses ? expenses.filter((expense) => expense.category_id === openId) : []),
    [expenses, openId]
  );

  return (
    <Card style={styles.rows}>
      {breakdown.map((entry) => {
        const category = categories.find((item) => item.id === entry.categoryId);
        const name = category ? `${category.emoji} ${categoryName(category.name, t)}` : '—';
        const isOpen = entry.categoryId === openId;

        const content = (
          <>
            <View
              style={[
                styles.mark,
                { backgroundColor: resolveExpenseColor(category?.color_key ?? '', scheme) },
              ]}
            />
            <Text variant="body" numberOfLines={1} style={styles.rowName}>
              {name}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {Math.round(entry.share * 100)}%
            </Text>
            <Text variant="callout" style={styles.rowAmount}>
              {money(entry.amount)}
            </Text>
          </>
        );

        if (!expenses) {
          return (
            <View key={entry.categoryId} style={styles.row}>
              {content}
            </View>
          );
        }

        return (
          <View key={entry.categoryId} style={styles.group}>
            <PressableScale
              onPress={() => setOpenId(isOpen ? null : entry.categoryId)}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${money(entry.amount)}`}
              accessibilityState={{ expanded: isOpen }}
              // The rows sit `spacing.md` apart; this spreads the tap target over that gap
              // instead of growing every row to 44pt and loosening the whole card.
              hitSlop={{ top: spacing.md / 2, bottom: spacing.md / 2 }}
              style={styles.row}>
              {content}
              <SymbolView
                name={isOpen ? 'chevron.up' : 'chevron.down'}
                size={12}
                tintColor={isOpen ? colors.accent : colors.textTertiary}
              />
            </PressableScale>

            {/* Unmounted when shut, and drawn with `map`: the list is bounded by one
                period of one category, and a FlatList here would be a VirtualizedList
                nested in the screen's ScrollView. */}
            {isOpen ? (
              <View style={styles.expenses}>
                {openExpenses.map((expense) => {
                  const note = expense.note || t('stats_expenses_no_note');
                  const date = format(parseDateKey(expense.date), 'dd.MM');
                  // Rows written before the time column existed carry only the date.
                  const when = expense.time ? `${date} · ${expense.time}` : date;
                  return (
                    <PressableScale
                      key={expense.id}
                      onPress={() =>
                        router.push({ pathname: '/expense/[id]', params: { id: expense.id } })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${note}, ${when}, ${money(expense.amount)}`}
                      accessibilityHint={t('expense_edit_title')}
                      hitSlop={{ top: spacing.sm / 2, bottom: spacing.sm / 2 }}
                      style={styles.expense}>
                      <Text
                        variant="callout"
                        numberOfLines={1}
                        color={expense.note ? colors.textPrimary : colors.textTertiary}
                        style={styles.rowName}>
                        {note}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {when}
                      </Text>
                      <Text variant="callout" style={styles.rowAmount}>
                        {money(expense.amount)}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            ) : null}
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
  group: {
    gap: spacing.sm,
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
  expenses: {
    gap: spacing.sm,
    // Lines the expenses up under the category name: the mark's width plus the row gap.
    paddingLeft: spacing.sm + spacing.sm,
  },
  expense: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
