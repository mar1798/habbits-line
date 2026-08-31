import { router, useIsFocused } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { BalanceCard } from '@/components/expense/balance-card';
import { ExpenseBar, type ExpenseBarSegment } from '@/components/expense/expense-bar';
import { ExpenseRow } from '@/components/expense/expense-row';
import { Button } from '@/components/ui/button';
import { DayStrip } from '@/components/ui/day-strip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { resolveExpenseColor, spacing } from '@/constants/design-tokens';
import type { ExpenseRow as ExpenseRowData } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { useTodayKey } from '@/hooks/use-today-key';
import { parseDateKey, shiftDateKey, weekDates, weekStartKey } from '@/lib/date';
import { barTotal, categoryTotals, expensesOnDate, sumAmounts } from '@/lib/expenses';
import { formatAmount } from '@/lib/money';
import { periodEndFor, periodStartFor } from '@/lib/period';
import { useExpenseCategoriesStore } from '@/store/expense-categories-store';
import { useExpensesStore } from '@/store/expenses-store';
import { useSettingsStore } from '@/store/settings-store';

/** Stable identity for "the store isn't holding this period yet" — see `loaded` below. */
const NO_EXPENSES: ExpenseRowData[] = [];

export default function ExpensesScreen() {
  const db = useSQLiteContext();
  const { scheme } = useTheme();
  const { t } = useI18n();
  const isFocused = useIsFocused();

  const loadedExpenses = useExpensesStore((state) => state.expenses);
  const loadedBudget = useExpensesStore((state) => state.budget);
  const loadedPeriod = useExpensesStore((state) => state.period);
  const ensurePeriod = useExpensesStore((state) => state.ensurePeriod);
  const removeExpense = useExpensesStore((state) => state.remove);

  // Archived categories included: an expense written into one before it was archived
  // still has to show its name and color in the day list. The grid in the expense modal
  // filters them back out itself.
  const categories = useExpenseCategoriesStore((state) => state.categories);
  const loadCategories = useExpenseCategoriesStore((state) => state.load);

  const periodStartDay = useSettingsStore((state) => state.periodStartDay);

  const today = useTodayKey();
  // The strip is anchored on a week rather than derived from today, so it can be paged
  // back into history; `selectedDate` always sits inside the anchored week.
  const [weekStart, setWeekStart] = useState(() => weekStartKey(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const previousTodayRef = useRef(today);

  const week = useMemo(() => weekDates(parseDateKey(weekStart)), [weekStart]);
  const canGoNext = week[6] < today;

  // Left open over midnight, exactly like the "Today" screen: a strip showing the current
  // week follows the rollover, a week paged back to deliberately stays put, and the
  // selection follows only if it was tracking "today".
  useEffect(() => {
    if (previousTodayRef.current === today) return;
    const previousToday = previousTodayRef.current;
    previousTodayRef.current = today;

    const nextWeekStart =
      weekStart === weekStartKey(previousToday) ? weekStartKey(today) : weekStart;
    const nextWeek = weekDates(parseDateKey(nextWeekStart));
    setWeekStart(nextWeekStart);
    setSelectedDate((current) =>
      current === previousToday || !nextWeek.includes(current) ? today : current
    );
  }, [today, weekStart]);

  const goToWeek = (weeks: number) => {
    const nextWeekStart = shiftDateKey(weekStart, weeks * 7);
    const nextWeek = weekDates(parseDateKey(nextWeekStart));
    const weekdayIndex = Math.max(week.indexOf(selectedDate), 0);
    const target = nextWeek[weekdayIndex];

    setWeekStart(nextWeekStart);
    setSelectedDate(target > today ? today : target);
  };

  useEffect(() => {
    loadCategories(db, { includeArchived: true });
  }, [db, loadCategories]);

  /**
   * The top block follows the selected date into whatever period it falls in, with that
   * period's budget — its own or the one it inherited. `ensurePeriod` only queries when
   * the bounds actually change, so moving between days of the same period costs nothing.
   *
   * Re-run on focus as well: an import replaces the whole table while this tab stays
   * mounted, and the settings screen can move the start day out from under it.
   */
  useEffect(() => {
    if (!isFocused) return;
    const start = periodStartFor(selectedDate, periodStartDay);
    const end = periodEndFor(selectedDate, periodStartDay);
    ensurePeriod(db, start, end).catch((error) =>
      console.warn('Failed to load the expense period', error)
    );
  }, [db, ensurePeriod, isFocused, periodStartDay, selectedDate]);

  const periodStart = periodStartFor(selectedDate, periodStartDay);
  const periodEnd = periodEndFor(selectedDate, periodStartDay);

  /**
   * The dates above are recomputed synchronously from `selectedDate`; the store still
   * holds the period the strip just left until `ensurePeriod` lands. Reading its money
   * in the meantime puts last period's totals under this period's heading — a frame of
   * it when the load is quick, and permanently when the load fails, since its rejection
   * is only logged. So nothing from the store is read until it is holding this period.
   */
  const loaded = loadedPeriod?.start === periodStart && loadedPeriod.end === periodEnd;
  const expenses = loaded ? loadedExpenses : NO_EXPENSES;
  const budget = loaded ? loadedBudget : null;

  const spent = useMemo(() => sumAmounts(expenses), [expenses]);
  const total = barTotal(budget, spent);

  const segments = useMemo<ExpenseBarSegment[]>(
    () =>
      categoryTotals(expenses, total).map((entry) => ({
        key: entry.categoryId,
        share: entry.share,
        color: resolveExpenseColor(
          categories.find((category) => category.id === entry.categoryId)?.color_key ?? '',
          scheme
        ),
      })),
    [categories, expenses, scheme, total]
  );

  const dayExpenses = useMemo(
    () => expensesOnDate(expenses, selectedDate),
    [expenses, selectedDate]
  );

  // A future day is a plan, not a spend — the strip still pages onto it, but nothing can
  // be written there.
  const canAdd = selectedDate <= today;

  const openNewExpense = () => {
    router.push({ pathname: '/expense/new', params: { date: selectedDate } });
  };

  const confirmDelete = (expense: ExpenseRowData) => {
    Alert.alert(t('expense_delete_title'), t('expense_delete_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        // The rejection is swallowed rather than left floating: unhandled, it surfaces as
        // a Metro warning over a failure the user can only retry anyway.
        onPress: () =>
          removeExpense(db, expense.id).catch((error) =>
            console.warn('Failed to delete expense', error)
          ),
      },
    ]);
  };

  return (
    <Screen>
      <FlatList
        data={dayExpenses}
        keyExtractor={(expense) => expense.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text variant="title1">{t('expenses_title')}</Text>
              <IconButton
                name="plus"
                compact
                accessibilityLabel={t('expenses_add')}
                disabled={!canAdd}
                onPress={openNewExpense}
              />
            </View>

            <DayStrip
              dates={week}
              selectedDate={selectedDate}
              todayDate={today}
              onSelect={setSelectedDate}
              onPreviousWeek={() => goToWeek(-1)}
              onNextWeek={() => goToWeek(1)}
              canGoNext={canGoNext}
            />

            <View style={styles.headerBlock}>
              <BalanceCard
                budget={budget}
                spent={spent}
                periodStart={periodStart}
                periodEnd={periodEnd}
                todayDate={today}
                pending={!loaded}
                onPress={() =>
                  router.push({ pathname: '/expense/budget', params: { date: selectedDate } })
                }
              />

              <ExpenseBar
                segments={segments}
                accessibilityLabel={
                  budget === null
                    ? t('expenses_bar_label_no_budget', { spent: formatAmount(spent) })
                    : t('expenses_bar_label', {
                        spent: formatAmount(spent),
                        total: formatAmount(budget),
                      })
                }
              />

              <Button
                title={t('expenses_add_action')}
                onPress={openNewExpense}
                disabled={!canAdd}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          // Gated on the load: the store is empty for a frame on a cold start, and an
          // ungated empty state greets every launch with "nothing was spent".
          loaded ? (
            <View style={styles.empty}>
              <EmptyState icon="creditcard" title={t('expenses_empty_day')} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <ExpenseRow
              expense={item}
              category={categories.find((category) => category.id === item.category_id)}
              onEdit={() => router.push({ pathname: '/expense/[id]', params: { id: item.id } })}
              onDelete={() => confirmDelete(item)}
            />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: spacing.md,
  },
  // The title row and the block under the strip pad themselves, so that the strip lands
  // at the same height as on the "Today" screen — the day cells of both tabs line up.
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // The strip's week arrows sit directly under the "+" button; without this they
    // touch it and the two rows of controls read as one crowded block.
    paddingBottom: spacing.md,
  },
  headerBlock: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    paddingHorizontal: spacing.lg,
  },
  empty: {
    paddingVertical: spacing.xl,
  },
});
