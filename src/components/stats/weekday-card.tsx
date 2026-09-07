import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import type { WeekdayStats } from '@/lib/streaks';

/** Height of a column's track. Tall enough for the difference between 60% and 80% to read. */
const TRACK_HEIGHT = 72;

type WeekdayCardProps = {
  /** Seven buckets, Monday first — `computeWeekdayStats` output. */
  stats: WeekdayStats[];
  /** How many days the buckets were counted over; named on the caption. */
  windowDays: number;
  color: string;
};

/**
 * The completion rate of the cards above, split across the seven weekdays: the same
 * numbers, arranged so a weekday that is quietly carrying the whole miss count stops
 * hiding inside the average.
 *
 * Bars rather than the seven stacked rows the rate card uses: the question here is which
 * column is shorter than the others, which is a shape, and seven full-width rows would
 * take a screen's height to answer it.
 */
export function WeekdayCard({ stats, windowDays, color }: WeekdayCardProps) {
  const { colors } = useTheme();
  const { t, plural, weekdays } = useI18n();

  // Nothing scheduled on any weekday in the window — an archived selection, or a habit
  // added today. Seven empty tracks would read as seven failures.
  const hasScheduled = stats.some((day) => day.rate !== null);

  return (
    <View style={styles.section}>
      <Text variant="headline">{t('stats_weekdays')}</Text>
      <Text variant="caption" color={colors.textSecondary}>
        {t('stats_weekdays_window', { count: windowDays, days: plural('days', windowDays) })}
      </Text>

      {hasScheduled ? (
        <Card style={styles.card}>
          {stats.map((day, bit) => {
            // Floor, not round — the same rule as the rate card and the "Today" ring.
            const percent = day.rate === null ? null : Math.floor(day.rate * 100);
            return (
              <View
                key={bit}
                style={styles.column}
                accessible
                accessibilityLabel={
                  percent === null
                    ? t('stats_weekday_summary_empty', { day: weekdays.full[bit] })
                    : t('stats_weekday_summary', {
                        day: weekdays.full[bit],
                        closed: day.closed,
                        scheduled: day.scheduled,
                        // Genitive: the noun stands after «из», as in the range card.
                        days: plural('days_of', day.scheduled),
                      })
                }>
                <Text variant="micro" color={colors.textSecondary}>
                  {/* A dash, not the rate card's «Не запланировано»: the column is a
                      seventh of a card wide, and the spoken label above already says it. */}
                  {percent === null ? '—' : `${percent}%`}
                </Text>
                {/* An empty track for a weekday with nothing scheduled, same as the rate
                    card's: there is nothing to be part-way through. */}
                <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
                  {percent === null ? null : (
                    <View style={[styles.fill, { height: `${percent}%`, backgroundColor: color }]} />
                  )}
                </View>
                <Text variant="micro" color={colors.textTertiary}>
                  {weekdays.short[bit]}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : (
        <Text variant="body" color={colors.textSecondary}>
          {t('stats_weekdays_empty')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  track: {
    width: '100%',
    height: TRACK_HEIGHT,
    borderRadius: radius.sm,
    overflow: 'hidden',
    // The fill grows from the bottom, the way the column is read.
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    borderRadius: radius.sm,
  },
});
