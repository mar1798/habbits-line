import { differenceInCalendarDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { periodLabel } from '@/components/expense/balance-card';
import { RangeCalendar } from '@/components/stats/range-calendar';
import { Card } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { parseDateKey } from '@/lib/date';
import type { DateRange } from '@/lib/date-range';
import { computeRangeStats, type HabitSeries } from '@/lib/streaks';

type HabitRangeProps = {
  /** Today's local date key — the last day the calendar lets the user reach. */
  todayDate: string;
  /** Whichever habits the chips above have selected — "all" or a single one. */
  series: HabitSeries[];
  color: string;
};

/**
 * Completion over dates the user picks, next to the fixed 7/30-day cards above it. Its
 * own calendar, unrelated to the expense block's range below: linking the two would mean
 * rewriting the expense block's already-working query for no reason the user asked for.
 *
 * No query to run: unlike `ExpenseRange`, the whole history is already in memory as
 * `series`, so a finished range is pure derivation — no `isPending`, no loading state.
 */
export function HabitRange({ todayDate, series, color }: HabitRangeProps) {
  const { colors } = useTheme();
  const { t, plural, locale } = useI18n();

  const [expanded, setExpanded] = useState(false);
  const [range, setRange] = useState<DateRange | null>(null);
  const start = range?.start ?? null;
  const end = range?.end ?? null;

  const stats = useMemo(() => {
    if (start === null || end === null) return null;
    return computeRangeStats(series, start, end);
  }, [series, start, end]);

  const dayCount =
    start !== null && end !== null
      ? differenceInCalendarDays(parseDateKey(end), parseDateKey(start)) + 1
      : 0;

  const percent = stats !== null && stats.rate !== null ? Math.floor(stats.rate * 100) : null;

  return (
    // Shut by default: a calendar is a screen's worth of height for a question most
    // visits to this screen are not asking. What was picked survives the fold.
    <CollapsibleSection
      title={t('stats_habits_range')}
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
            accessibilityLabel={t('stats_habits_range_clear')}
            style={styles.clear}>
            <Text variant="caption" color={colors.accent}>
              {t('stats_habits_range_clear')}
            </Text>
          </PressableScale>
        </View>
      ) : null}

      <Card>
        <RangeCalendar range={range} maxDate={todayDate} onChange={setRange} />
      </Card>

      {start === null ? (
        <Text variant="body" color={colors.textSecondary}>
          {t('stats_habits_range_hint')}
        </Text>
      ) : end === null ? (
        <Text variant="body" color={colors.textSecondary}>
          {t('stats_habits_range_pending')}
        </Text>
      ) : stats === null || stats.rate === null ? (
        <Text variant="body" color={colors.textSecondary}>
          {t('stats_habits_range_empty')}
        </Text>
      ) : (
        <Card style={styles.total}>
          <Text variant="caption" color={colors.textSecondary}>
            {periodLabel(start, end, todayDate, locale)}
          </Text>
          <Text variant="title1" color={color}>
            {`${percent}%`}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {t('stats_habits_range_closed', {
              closed: stats.closed,
              scheduled: stats.scheduled,
              days: plural('days', stats.scheduled),
            })}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            {t('stats_habits_range_days', { count: dayCount, days: plural('days', dayCount) })}
          </Text>
        </Card>
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
