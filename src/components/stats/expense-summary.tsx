import { useIsFocused } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { periodLabel } from '@/components/expense/balance-card';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { radius, resolveExpenseColor, spacing } from '@/constants/design-tokens';
import * as categoriesRepo from '@/db/expense-categories-repo';
import * as expensesRepo from '@/db/expenses-repo';
import type { ExpenseCategoryRow, ExpenseRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { categoryTotals, sumAmounts } from '@/lib/expenses';
import { formatAmount } from '@/lib/money';
import { periodEndFor, periodStartFor, shiftPeriod } from '@/lib/period';
import { useSettingsStore } from '@/store/settings-store';

/**
 * How far back the history reaches. A year of periods is enough to see a trend, and the
 * list is rendered by `map` rather than in a `FlatList` precisely because it has this
 * ceiling — the rule about long lists is about lists that grow with the data.
 */
const HISTORY_PERIODS = 12;

type ExpenseSummaryProps = {
  /** Today's local date key, from the screen's own `useTodayKey`. */
  todayDate: string;
};

/**
 * The expense block of the statistics screen: this period against the previous one, the
 * periods before it, and where this period's money went.
 *
 * Reads the repositories directly rather than the expenses store, for the same reason the
 * habit statistics above it do: the store holds exactly one period for the expenses
 * screen, and widening its scope from here would make that screen reload a range it never
 * asked for. Both queries re-run on every focus — the tabs stay mounted, so an expense
 * written after this block first rendered would otherwise never appear.
 */
export function ExpenseSummary({ todayDate }: ExpenseSummaryProps) {
  const db = useSQLiteContext();
  const { colors, scheme } = useTheme();
  const { t, locale } = useI18n();
  const isFocused = useIsFocused();
  const periodStartDay = useSettingsStore((state) => state.periodStartDay);

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);

  const currentStart = periodStartFor(todayDate, periodStartDay);
  const currentEnd = periodEndFor(todayDate, periodStartDay);

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;

    const start = periodStartFor(todayDate, periodStartDay);
    const from = shiftPeriod(start, -HISTORY_PERIODS);
    const to = periodEndFor(todayDate, periodStartDay);

    Promise.all([
      expensesRepo.listExpensesBetween(db, from, to),
      // Archived categories included: they still hold the expenses of past periods.
      categoriesRepo.listExpenseCategories(db, { includeArchived: true }),
    ])
      .then(([expenseRows, categoryRows]) => {
        if (cancelled) return;
        setExpenses(expenseRows);
        setCategories(categoryRows);
      })
      .catch((error) => console.warn('Failed to load expense statistics', error));

    return () => {
      cancelled = true;
    };
  }, [db, isFocused, periodStartDay, todayDate]);

  /** One sum per period in the loaded window, keyed by the period's first day. */
  const totalsByPeriod = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      const key = periodStartFor(expense.date, periodStartDay);
      totals.set(key, (totals.get(key) ?? 0) + expense.amount);
    }
    return totals;
  }, [expenses, periodStartDay]);

  const currentExpenses = useMemo(
    () => expenses.filter((expense) => expense.date >= currentStart && expense.date <= currentEnd),
    [currentEnd, currentStart, expenses]
  );
  const currentTotal = sumAmounts(currentExpenses);
  const previousTotal = totalsByPeriod.get(shiftPeriod(currentStart, -1)) ?? 0;

  // The shares read as "of what I spent this period", so the denominator is the period's
  // own sum — not the budget the bar on the expenses screen divides by.
  const breakdown = useMemo(
    () => categoryTotals(currentExpenses, currentTotal),
    [currentExpenses, currentTotal]
  );

  /** Past periods that actually hold expenses, newest first — an unused month is not history. */
  const history = useMemo(() => {
    const periods: { start: string; end: string; amount: number }[] = [];
    for (let index = 1; index <= HISTORY_PERIODS; index++) {
      const start = shiftPeriod(currentStart, -index);
      const amount = totalsByPeriod.get(start) ?? 0;
      if (amount > 0) {
        periods.push({ start, end: periodEndFor(start, periodStartDay), amount });
      }
    }
    return periods;
  }, [currentStart, periodStartDay, totalsByPeriod]);

  const delta = describeDelta(currentTotal, previousTotal);

  return (
    <View style={styles.section}>
      <Text variant="title2">{t('stats_expenses')}</Text>

      <Card style={styles.comparison}>
        <View style={styles.current}>
          <Text variant="caption" color={colors.textSecondary}>
            {t('stats_expenses_current')}
          </Text>
          <Text variant="display">{formatAmount(currentTotal)}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {periodLabel(currentStart, currentEnd, todayDate, locale)}
          </Text>
        </View>

        <View style={[styles.previous, { borderLeftColor: colors.border }]}>
          <Text variant="caption" color={colors.textSecondary}>
            {t('stats_expenses_previous')}
          </Text>
          <Text variant="title1">{formatAmount(previousTotal)}</Text>
          <Text
            variant="caption"
            color={
              delta.kind === 'up'
                ? colors.danger
                : delta.kind === 'down'
                  ? colors.success
                  : colors.textSecondary
            }>
            {delta.kind === 'up'
              ? t('stats_expenses_delta_up', { percent: delta.percent })
              : delta.kind === 'down'
                ? t('stats_expenses_delta_down', { percent: delta.percent })
                : delta.kind === 'same'
                  ? t('stats_expenses_delta_same')
                  : t('stats_expenses_delta_new')}
          </Text>
        </View>
      </Card>

      <View style={styles.block}>
        <Text variant="headline">{t('stats_expenses_by_category')}</Text>
        {breakdown.length > 0 ? (
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
                    {category ? `${category.emoji} ${category.name}` : '—'}
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
        ) : (
          <Text variant="body" color={colors.textSecondary}>
            {t('stats_expenses_empty')}
          </Text>
        )}
      </View>

      {history.length > 0 ? (
        <View style={styles.block}>
          <Text variant="headline">{t('stats_expenses_history')}</Text>
          <Card style={styles.rows}>
            {history.map((period) => (
              <View key={period.start} style={styles.row}>
                <Text variant="body" style={styles.rowName}>
                  {periodLabel(period.start, period.end, todayDate, locale)}
                </Text>
                <Text variant="callout" style={styles.rowAmount}>
                  {formatAmount(period.amount)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </View>
  );
}

type Delta =
  | { kind: 'up' | 'down'; percent: number }
  | { kind: 'same'; percent: 0 }
  | { kind: 'new'; percent: 0 };

/**
 * The change against the previous period. A previous period of zero has no percentage to
 * take — "infinitely more" says nothing — so it is named rather than computed. Rounding
 * to whole percents keeps the line short; the two sums are right above it either way.
 */
function describeDelta(current: number, previous: number): Delta {
  if (previous === 0) return { kind: 'new', percent: 0 };
  const percent = Math.round((Math.abs(current - previous) / previous) * 100);
  if (percent === 0) return { kind: 'same', percent: 0 };
  return { kind: current > previous ? 'up' : 'down', percent };
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  comparison: {
    flexDirection: 'row',
  },
  current: {
    flex: 1,
    gap: spacing.xs,
  },
  previous: {
    flex: 1,
    gap: spacing.xs,
    borderLeftWidth: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
    paddingLeft: spacing.lg,
  },
  block: {
    gap: spacing.sm,
  },
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
