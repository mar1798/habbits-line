import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { periodLabel } from '@/components/expense/balance-card';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import {
  KEYBOARD_BAR_HEIGHT,
  KeyboardDoneAccessory,
} from '@/components/ui/keyboard-done-accessory';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { useTodayKey } from '@/hooks/use-today-key';
import { isValidDateKey, todayKey } from '@/lib/date';
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
 * Both money settings in one modal, opened from the balance card rather than from
 * Settings: they are about the number on that card and are changed while looking at it.
 *
 * The budget is written for the period of the day the strip is on — the same period the
 * card shows — and never for the one it may have inherited its amount from.
 */
export default function BudgetScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const today = useTodayKey();
  const { date } = useLocalSearchParams<{ date?: string }>();

  const budget = useExpensesStore((state) => state.budget);
  const ownBudget = useExpensesStore((state) => state.ownBudget);
  const ensurePeriod = useExpensesStore((state) => state.ensurePeriod);
  const setBudget = useExpensesStore((state) => state.setBudget);
  const clearBudget = useExpensesStore((state) => state.clearBudget);
  const periodStartDay = useSettingsStore((state) => state.periodStartDay);
  const setPeriodStartDay = useSettingsStore((state) => state.setPeriodStartDay);

  const anchorDate = date && isValidDateKey(date) ? date : todayKey();
  /** What has been typed, or null while the field is still showing the stored amount. */
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const [startDay, setStartDay] = useState(periodStartDay);
  const [submitting, setSubmitting] = useState(false);

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
      </ScrollView>

      <KeyboardDoneAccessory onClear={() => setTypedAmount('')} clearDisabled={amount === ''} />
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
