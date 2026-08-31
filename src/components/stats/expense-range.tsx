import { differenceInCalendarDays } from 'date-fns';
import { useIsFocused } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { periodLabel } from '@/components/expense/balance-card';
import { CategoryBreakdown } from '@/components/stats/category-breakdown';
import { RangeCalendar } from '@/components/stats/range-calendar';
import { Card } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import * as expensesRepo from '@/db/expenses-repo';
import type { ExpenseCategoryRow, ExpenseRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { parseDateKey } from '@/lib/date';
import type { DateRange } from '@/lib/date-range';
import { categoryTotals, sumAmounts } from '@/lib/expenses';
import { formatAmount } from '@/lib/money';

/** Stable identity so the sums below don't rebuild on every render before a range is picked. */
const NO_EXPENSES: ExpenseRow[] = [];

type ExpenseRangeProps = {
  /** Today's local date key — the last day the calendar lets the user reach. */
  todayDate: string;
  /** Categories the breakdown names, archived ones included. Loaded once by the block above. */
  categories: ExpenseCategoryRow[];
};

/**
 * Spending over dates the user picks, rather than over the period the rest of the screen
 * is fixed to. Nothing is selected on open and the block is deliberately empty under its
 * calendar: any default span here would be a second, quieter answer to "how much this
 * period" that the card above already gives.
 *
 * Its own query, not a filter over the block above: that one loads the last twelve
 * periods, and a range reaching further back would silently come out short. Runs only for
 * a finished range, so tapping the opening day costs nothing.
 */
export function ExpenseRange({ todayDate, categories }: ExpenseRangeProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, plural, locale } = useI18n();
  const isFocused = useIsFocused();

  const [expanded, setExpanded] = useState(false);
  const [range, setRange] = useState<DateRange | null>(null);
  const [loaded, setLoaded] = useState<{ start: string; end: string; expenses: ExpenseRow[] } | null>(
    null
  );

  const start = range?.start ?? null;
  const end = range?.end ?? null;

  useEffect(() => {
    if (!isFocused || start === null || end === null) return;
    let cancelled = false;

    expensesRepo
      .listExpensesBetween(db, start, end)
      .then((rows) => {
        if (cancelled) return;
        setLoaded({ start, end, expenses: rows });
      })
      // Caught for the same reason as the reads above it: unhandled it is a Metro warning,
      // and leaving `loaded` behind keeps the block on its hint rather than on a zero.
      .catch((error) => console.warn('Failed to load expenses for the selected range', error));

    return () => {
      cancelled = true;
    };
  }, [db, isFocused, start, end]);

  /**
   * Only the rows that belong to the range currently selected. Keyed on the dates they
   * were read for, so the moment a new range is tapped the totals go back to their
   * placeholder instead of showing the previous range's money under the new label.
   */
  const matching =
    loaded !== null && loaded.start === start && loaded.end === end ? loaded : null;
  const expenses = matching?.expenses ?? NO_EXPENSES;
  /** A finished range whose read has not landed yet — see the transparent amount below. */
  const isPending = start !== null && end !== null && matching === null;

  const total = useMemo(() => sumAmounts(expenses), [expenses]);
  const breakdown = useMemo(() => categoryTotals(expenses, total), [expenses, total]);

  const dayCount =
    start !== null && end !== null
      ? differenceInCalendarDays(parseDateKey(end), parseDateKey(start)) + 1
      : 0;

  return (
    // Shut by default, like the habit range above it — see the note there.
    <CollapsibleSection
      title={t('stats_expenses_range')}
      summary={
        start !== null && end !== null ? periodLabel(start, end, todayDate, locale) : undefined
      }
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}>
      {range !== null ? (
        <View style={styles.header}>
          <PressableScale
            onPress={() => setRange(null)}
            accessibilityRole="button"
            accessibilityLabel={t('stats_expenses_range_clear')}
            style={styles.clear}>
            <Text variant="caption" color={colors.accent}>
              {t('stats_expenses_range_clear')}
            </Text>
          </PressableScale>
        </View>
      ) : null}

      <Card>
        <RangeCalendar range={range} maxDate={todayDate} onChange={setRange} />
      </Card>

      {start === null ? (
        <Text variant="body" color={colors.textSecondary}>
          {t('stats_expenses_range_hint')}
        </Text>
      ) : end === null ? (
        <Text variant="body" color={colors.textSecondary}>
          {t('stats_expenses_range_pending')}
        </Text>
      ) : (
        <>
          <Card style={styles.total}>
            <Text variant="caption" color={colors.textSecondary}>
              {periodLabel(start, end, todayDate, locale)}
            </Text>
            {/* Holds the card's height for the length of the read, the way the balance
                card does: without it every new range paints a total of 0 first and then
                pops to the real sum. */}
            <Text variant="title1" color={isPending ? 'transparent' : undefined}>
              {formatAmount(total)}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {t('stats_expenses_range_days', {
                count: dayCount,
                days: plural('days', dayCount),
              })}
            </Text>
          </Card>

          {isPending ? null : breakdown.length > 0 ? (
            <CategoryBreakdown breakdown={breakdown} categories={categories} />
          ) : (
            <Text variant="body" color={colors.textSecondary}>
              {t('stats_expenses_range_empty')}
            </Text>
          )}
        </>
      )}
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  clear: {
    minHeight: minHitSlop,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  total: {
    gap: spacing.xs,
  },
});
