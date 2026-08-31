import { useIsFocused } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { periodLabel } from '@/components/expense/balance-card';
import { CategoryBreakdown } from '@/components/stats/category-breakdown';
import { ExpenseRange } from '@/components/stats/expense-range';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
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
 * The expense block of the statistics screen: what this period cost and where its money
 * went, a span of dates the user picks for themselves, and the periods before this one.
 *
 * Reads the repositories directly rather than the expenses store, for the same reason the
 * habit statistics above it do: the store holds exactly one period for the expenses
 * screen, and widening its scope from here would make that screen reload a range it never
 * asked for. Both queries re-run on every focus — the tabs stay mounted, so an expense
 * written after this block first rendered would otherwise never appear.
 */
export function ExpenseSummary({ todayDate }: ExpenseSummaryProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
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

  return (
    <View style={styles.section}>
      <Text variant="title2">{t('stats_expenses')}</Text>

      {/* The period's own total, on its own: the first thing the block answers is "how
          much this period", and nothing else in the block competes for that first glance. */}
      <Card style={styles.total}>
        <Text variant="caption" color={colors.textSecondary}>
          {t('stats_expenses_current')}
        </Text>
        <Text variant="display">{formatAmount(currentTotal)}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {periodLabel(currentStart, currentEnd, todayDate, locale)}
        </Text>
      </Card>

      <View style={styles.block}>
        <Text variant="headline">{t('stats_expenses_by_category')}</Text>
        {breakdown.length > 0 ? (
          <CategoryBreakdown breakdown={breakdown} categories={categories} />
        ) : (
          <Text variant="body" color={colors.textSecondary}>
            {t('stats_expenses_empty')}
          </Text>
        )}
      </View>

      {/* Where the period comparison used to be. The two sums it put side by side both
          answered a question the card above already answers; the dates the user actually
          wants to look at are the ones only they can name. */}
      <ExpenseRange todayDate={todayDate} categories={categories} />

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

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  total: {
    gap: spacing.xs,
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
  rowName: {
    flex: 1,
  },
  rowAmount: {
    // Keeps the amounts of neighbouring rows aligned on the right edge of the card.
    textAlign: 'right',
  },
});
