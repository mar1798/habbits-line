import { format } from 'date-fns/format';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { periodLabel } from '@/components/expense/balance-card';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import {
  KEYBOARD_BAR_HEIGHT,
  KeyboardDoneAccessory,
} from '@/components/ui/keyboard-done-accessory';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import type { ExpenseIncomeRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useMoney } from '@/hooks/use-money';
import { useTheme } from '@/hooks/use-theme';
import { useTodayKey } from '@/hooks/use-today-key';
import { isValidDateKey, parseDateKey, todayKey } from '@/lib/date';
import { availableBudget, sumAmounts } from '@/lib/expenses';
import { normalizeAmountInput } from '@/lib/money';
import {
  MAX_PERIOD_START_DAY,
  MIN_PERIOD_START_DAY,
  periodEndFor,
  periodStartFor,
} from '@/lib/period';
import { useExpensesStore } from '@/store/expenses-store';
import { useSettingsStore } from '@/store/settings-store';

const DAYS = Array.from(
  { length: MAX_PERIOD_START_DAY - MIN_PERIOD_START_DAY + 1 },
  (_, index) => MIN_PERIOD_START_DAY + index
);

const DAY_CHIP_SIZE = minHitSlop;
const DAY_CHIP_STRIDE = DAY_CHIP_SIZE + spacing.sm;

/**
 * Everything behind the number on the balance card, in one modal opened from the card
 * itself rather than from Settings: the period's budget, the income added to it, and the
 * day periods start on. They are about that number and are changed while looking at it.
 *
 * The budget is written for the period of the day the strip is on — the same period the
 * card shows — and never for the one it may have inherited its amount from.
 */
export default function BudgetScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const money = useMoney();
  const today = useTodayKey();
  const { date } = useLocalSearchParams<{ date?: string }>();

  const budget = useExpensesStore((state) => state.budget);
  const ownBudget = useExpensesStore((state) => state.ownBudget);
  const ensurePeriod = useExpensesStore((state) => state.ensurePeriod);
  const setBudget = useExpensesStore((state) => state.setBudget);
  const clearBudget = useExpensesStore((state) => state.clearBudget);
  const incomes = useExpensesStore((state) => state.incomes);
  const addIncome = useExpensesStore((state) => state.addIncome);
  const removeIncome = useExpensesStore((state) => state.removeIncome);
  const periodStartDay = useSettingsStore((state) => state.periodStartDay);
  const setPeriodStartDay = useSettingsStore((state) => state.setPeriodStartDay);

  const anchorDate = date && isValidDateKey(date) ? date : todayKey();
  /** What has been typed, or null while the field is still showing the stored amount. */
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const [startDay, setStartDay] = useState(periodStartDay);
  const [submitting, setSubmitting] = useState(false);
  /** The income being typed. Its own field, written by its own button — see below. */
  const [incomeAmount, setIncomeAmount] = useState('');
  const [addingIncome, setAddingIncome] = useState(false);
  /**
   * Which field the keyboard bar's "Clear" belongs to, as in the expense form: the bar is
   * one view over the whole screen, and without this it would empty the budget while the
   * income field is the one being typed in.
   */
  const [focusedField, setFocusedField] = useState<'budget' | 'income'>('budget');

  // Follows the day picker live, so the label says which period the amount will land in.
  const periodStart = periodStartFor(anchorDate, startDay);
  const periodEnd = periodEndFor(anchorDate, startDay);

  /**
   * The store holds the period the expenses tab loaded, and this modal has its own route:
   * opened by `habbitsline://expense/budget` it mounts with no period at all, so `budget`
   * is null and the field opened empty on a period that has one. Loading the period the
   * saved start day describes — not the one the picker is currently showing — is what
   * gives the field something to show, and the save below then costs no second query.
   */
  useEffect(() => {
    ensurePeriod(
      db,
      periodStartFor(anchorDate, periodStartDay),
      periodEndFor(anchorDate, periodStartDay)
    ).catch((error) => console.warn('Failed to load the budget period', error));
  }, [db, ensurePeriod, anchorDate, periodStartDay]);

  /**
   * Until the field is touched it shows the amount in force, inherited or not: the common
   * edit is a nudge to the number already on the card, not typing one from scratch. Derived
   * rather than copied into state by an effect, so an amount that arrives a moment after
   * the modal opened still lands in an untouched field — and never on top of one being
   * typed, since the first keystroke gives `typedAmount` a value of its own.
   */
  const amount = typedAmount ?? (budget === null ? '' : normalizeAmountInput(String(budget)));
  const amountValue = amount === '' ? 0 : Number(amount);
  /**
   * An emptied field means "remove it" only for a period that owns its budget row: the
   * amount in force may have been inherited from an earlier period, and `clearBudget`
   * deletes by `period_start`, so on an inherited amount it deleted nothing and Save
   * closed the modal having changed what the card shows by nothing at all. Now the field
   * says so instead, and there is nothing to save.
   */
  const inherited = budget !== null && ownBudget === null;
  const clearing = amount === '' && ownBudget !== null;
  // An empty amount is still savable while the start day has moved: someone who has not
  // set a budget yet may still want their periods to open on the 6th.
  const canSave = (amountValue > 0 || clearing || startDay !== periodStartDay) && !submitting;

  /**
   * The start day is written first, and the period is then loaded into the store: the
   * store writes the budget for the period it currently holds, which is the one computed
   * with the *old* start day until it is told otherwise.
   *
   * `ensurePeriod` is called on every save, not only after the start day moved: the day
   * picker changes which period the amount belongs to, and the store must be holding that
   * one before it is written. It only queries when the bounds are not the ones already
   * loaded, so the common save costs nothing extra.
   *
   * Writing the prefilled amount again after a start-day change is what keeps the hint
   * under the picker true: the row it lands on is the new period's, so moving the start
   * day — in either direction — leaves the period with the budget it had.
   */
  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (startDay !== periodStartDay) {
        await setPeriodStartDay(db, startDay);
      }
      await ensurePeriod(db, periodStart, periodEnd);
      if (amountValue > 0) {
        await setBudget(db, amountValue);
      } else if (clearing) {
        await clearBudget(db);
      }
      router.back();
    } catch (error) {
      console.error('Failed to save budget', error);
      setSubmitting(false);
      Alert.alert(t('expense_budget_save_failed'), t('try_again'));
    }
  };

  const incomeValue = incomeAmount === '' ? 0 : Number(incomeAmount);
  const canAddIncome = incomeValue > 0 && !addingIncome;
  const incomeTotal = useMemo(() => sumAmounts(incomes), [incomes]);

  /**
   * What the card will show for this period: the budget as the field currently reads it,
   * plus the income listed below. The typed amount rather than the stored one, so the sum
   * answers "what am I about to end up with" while a new budget is being typed. An emptied
   * field still leaves an inherited amount standing — Save cannot delete a row this period
   * does not own — so that is the one case where clearing the field does not zero it.
   */
  const previewAvailable = availableBudget(
    amountValue > 0 ? amountValue : inherited ? budget : null,
    incomeTotal
  );

  /**
   * Income is written on its own button, not on Save: it is a row of its own rather than
   * a field of the budget, and the list below has to show it immediately. `ensurePeriod`
   * for the same reason `handleSubmit` calls it — reached by a deep link this modal may
   * still be waiting on its first load, and the store lists an income only for the period
   * it is holding.
   */
  const handleAddIncome = async () => {
    if (!canAddIncome) return;
    setAddingIncome(true);
    try {
      await ensurePeriod(
        db,
        periodStartFor(anchorDate, periodStartDay),
        periodEndFor(anchorDate, periodStartDay)
      );
      await addIncome(db, { amount: incomeValue, date: anchorDate });
      setIncomeAmount('');
    } catch (error) {
      console.error('Failed to add income', error);
      Alert.alert(t('expense_income_save_failed'), t('try_again'));
    } finally {
      setAddingIncome(false);
    }
  };

  const confirmDeleteIncome = (income: ExpenseIncomeRow) => {
    Alert.alert(t('expense_income_delete_title'), t('expense_income_delete_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        // Swallowed rather than left floating, as on the expenses tab: unhandled, it
        // surfaces as a Metro warning over a failure the user can only retry anyway.
        onPress: () =>
          removeIncome(db, income.id).catch((error) =>
            console.warn('Failed to delete income', error)
          ),
      },
    ]);
  };

  // edges: the native header already covers the top inset.
  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets>
        <Section title={t('expense_budget_amount')}>
          <AmountInput
            value={amount}
            onChangeValue={setTypedAmount}
            placeholder="0"
            accessibilityLabel={t('expense_budget_amount')}
            onFocus={() => setFocusedField('budget')}
            autoFocus
          />
          <Text variant="caption" color={colors.textSecondary}>
            {t('expense_budget_period', {
              period: periodLabel(periodStart, periodEnd, today, locale),
            })}
          </Text>
          {inherited ? (
            <Text variant="caption" color={colors.textSecondary}>
              {t('expense_budget_inherited')}
            </Text>
          ) : null}
        </Section>

        <Section title={t('expense_budget_start_day')}>
          <FlatList
            horizontal
            data={DAYS}
            extraData={startDay}
            keyExtractor={(day) => String(day)}
            showsHorizontalScrollIndicator={false}
            // Every chip is the same size, so the list can jump straight to the selected
            // day instead of opening on the 1st with the current one off-screen.
            getItemLayout={(_, index) => ({
              length: DAY_CHIP_STRIDE,
              offset: DAY_CHIP_STRIDE * index,
              index,
            })}
            initialScrollIndex={periodStartDay - MIN_PERIOD_START_DAY}
            // A horizontal list inherits ScrollView's `flexGrow: 1` and would otherwise
            // split this screen's height with the content below it.
            style={styles.daysList}
            contentContainerStyle={styles.days}
            renderItem={({ item }) => {
              const isSelected = item === startDay;
              return (
                <PressableScale
                  onPress={() => setStartDay(item)}
                  // iOS has no radio trait — see color-picker.tsx.
                  accessibilityRole="button"
                  accessibilityLabel={t('expense_budget_day', { day: item })}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.day,
                    { backgroundColor: isSelected ? colors.accent : colors.surfaceAlt },
                  ]}>
                  <Text variant="callout" color={isSelected ? colors.onAccent : colors.textPrimary}>
                    {item}
                  </Text>
                </PressableScale>
              );
            }}
          />
          <Text variant="caption" color={colors.textSecondary}>
            {t('expense_budget_start_day_hint')}
          </Text>
        </Section>

        <View style={styles.submit}>
          <Button title={t('save')} onPress={handleSubmit} disabled={!canSave} />
        </View>

        {/* Below the button, behind a rule: "Save" commits the budget and the start day,
            and income is written by a button of its own the moment it is added. Inside
            the form the two read as one thing to be saved together, and the section had
            to say in words that it was not. */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Section title={t('expense_income_section')}>
          <Text variant="caption" color={colors.textSecondary}>
            {t('expense_income_hint')}
          </Text>
          <AmountInput
            value={incomeAmount}
            onChangeValue={setIncomeAmount}
            placeholder="0"
            accessibilityLabel={t('expense_income_amount')}
            onFocus={() => setFocusedField('income')}
          />
          <Button
            title={t('expense_income_add')}
            variant="secondary"
            onPress={handleAddIncome}
            disabled={!canAddIncome}
          />

          {incomes.length === 0 ? null : (
            // Mapped, not a FlatList: a period holds a handful of these, and a
            // VirtualizedList nested in a ScrollView of the same orientation is exactly
            // what React Native warns about.
            <View style={styles.incomes}>
              {incomes.map((income) => (
                <View
                  key={income.id}
                  style={[styles.income, { backgroundColor: colors.surfaceAlt }]}>
                  <Text variant="caption" color={colors.textSecondary}>
                    {format(parseDateKey(income.date), 'd MMM', { locale })}
                  </Text>
                  <Text variant="callout" style={styles.incomeAmount}>
                    {money(income.amount)}
                  </Text>
                  <IconButton
                    name="trash"
                    compact
                    accessibilityLabel={t('expense_income_delete', {
                      amount: money(income.amount),
                    })}
                    onPress={() => confirmDeleteIncome(income)}
                  />
                </View>
              ))}
            </View>
          )}

          {previewAvailable === null ? null : (
            <Text variant="caption" color={colors.textSecondary}>
              {t('expense_income_available', { amount: money(previewAvailable) })}
            </Text>
          )}
        </Section>
      </ScrollView>

      <KeyboardDoneAccessory
        onClear={() => (focusedField === 'income' ? setIncomeAmount('') : setTypedAmount(''))}
        clearDisabled={focusedField === 'income' ? incomeAmount === '' : amount === ''}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    // Room for the keyboard bar — see the same note in the expense form.
    paddingBottom: spacing.lg + KEYBOARD_BAR_HEIGHT,
    gap: spacing.xl,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    // Cancels the content's gap on the side the button is on, so the rule reads as the
    // end of the form rather than as a divider floating between two equal blocks.
    marginTop: spacing.sm,
  },
  incomes: {
    gap: spacing.sm,
  },
  income: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  // Takes the room between the date and the delete button, so every amount in the list
  // starts at the same place however long the date beside it is.
  incomeAmount: {
    flex: 1,
  },
  daysList: {
    flexGrow: 0,
    flexShrink: 0,
  },
  days: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  day: {
    width: DAY_CHIP_SIZE,
    height: DAY_CHIP_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    marginTop: spacing.md,
  },
});
