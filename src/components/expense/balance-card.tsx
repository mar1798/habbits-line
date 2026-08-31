import { format, type Locale } from 'date-fns';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { parseDateKey } from '@/lib/date';
import { budgetRemainder } from '@/lib/expenses';
import { formatAmount } from '@/lib/money';

/**
 * Names the period the card is showing: "6 авг. — 5 сент.", or "26 дек. 2026 — 25 янв. 2027"
 * once it leaves the current year. Same rule as the day strip's week label — the year is
 * noise on every render while the period is in this year, and the one thing missing from
 * the label once the strip has been paged back into an earlier one.
 */
export function periodLabel(
  periodStart: string,
  periodEnd: string,
  todayDate: string,
  locale: Locale
): string {
  const currentYear = todayDate.slice(0, 4);
  const withinCurrentYear =
    periodStart.slice(0, 4) === currentYear && periodEnd.slice(0, 4) === currentYear;
  const pattern = withinCurrentYear ? 'd MMM' : 'd MMM yyyy';

  const from = format(parseDateKey(periodStart), pattern, { locale });
  const to = format(parseDateKey(periodEnd), pattern, { locale });
  return `${from} — ${to}`;
}

type BalanceCardProps = {
  /** Budget in force for the period — its own or inherited. Null when none applies. */
  budget: number | null;
  spent: number;
  periodStart: string;
  periodEnd: string;
  todayDate: string;
  /** True until the period's first read lands — see the placeholder below. */
  pending?: boolean;
  onPress: () => void;
};

/**
 * The top block always shows the period, never the selected day: the remainder of the
 * period is the number this screen is opened for, and the day picked below it only
 * changes the list of expenses.
 */
export function BalanceCard({
  budget,
  spent,
  periodStart,
  periodEnd,
  todayDate,
  pending = false,
  onPress,
}: BalanceCardProps) {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const remainder = budgetRemainder(budget, spent);
  const isOverspent = remainder !== null && remainder < 0;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('expenses_open_budget')}
      scaleTo={0.99}>
      <Card style={styles.card}>
        <Text variant="caption" color={colors.textSecondary}>
          {periodLabel(periodStart, periodEnd, todayDate, locale)}
        </Text>

        {pending ? (
          // Holds the card's height for the length of the period's first query. Without
          // it the very first visit to the tab paints "no budget set" with its button —
          // the store is empty before the read lands — and then pops to the real number.
          <View style={styles.amount}>
            <Text variant="display" color="transparent">
              0
            </Text>
            <Text variant="callout" color="transparent">
              0
            </Text>
          </View>
        ) : remainder === null ? (
          <View style={styles.noBudget}>
            <Text variant="title2">{t('expenses_no_budget')}</Text>
            <Button title={t('expenses_set_budget')} variant="secondary" onPress={onPress} />
          </View>
        ) : (
          <View style={styles.amount}>
            <Text variant="display" color={isOverspent ? colors.danger : undefined}>
              {formatAmount(remainder)}
            </Text>
            {/* The big number is what is left; what was spent to get there stands beside
                it rather than under it, so the period reads as one line of two halves.
                Both shrink and clip at one line: two long amounts in a wide currency
                would otherwise wrap the row into a second line of its own. */}
            <View style={styles.captions}>
              <Text
                variant="callout"
                numberOfLines={1}
                style={styles.caption}
                color={isOverspent ? colors.danger : colors.textSecondary}>
                {isOverspent
                  ? t('expenses_overspent')
                  : t('expenses_remaining', { budget: formatAmount(budget ?? 0) })}
              </Text>
              <Text
                variant="callout"
                numberOfLines={1}
                style={styles.caption}
                color={colors.textSecondary}>
                {t('expenses_spent', { amount: formatAmount(spent) })}
              </Text>
            </View>
          </View>
        )}
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  amount: {
    gap: spacing.xs,
  },
  captions: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  caption: {
    flexShrink: 1,
  },
  noBudget: {
    gap: spacing.md,
  },
});
