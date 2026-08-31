import { format } from 'date-fns/format';
import type { Locale } from 'date-fns';
import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { DAYS_IN_WEEK, parseDateKey, toDateKey, weekday } from '@/lib/date';
import { type DayTally, type HabitSeries, tallyDay } from '@/lib/streaks';

/** The current month and the two before it, oldest on the left. */
const MONTHS = 3;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toAlphaHex(alpha: number): string {
  return Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
}

/** Alpha for the ratio fill: 0 stays a faint tint (still readable as "scheduled, not done"), 1 is opaque. */
function alphaHex(ratio: number): string {
  return toAlphaHex(0.12 + 0.88 * Math.min(Math.max(ratio, 0), 1));
}

/**
 * A scheduled day that went unmarked gets a ring in the habit's color as well as the
 * faint fill. The fill alone put it one step away from the `unscheduled` token — two
 * opposite meanings, "you missed this" and "nothing was planned", separated by a shade
 * of the same pale lavender for every violet and indigo habit, which is most of the
 * palette. A ring separates them by shape, which survives a dimmed screen and a
 * color-blind eye where a hue step does not.
 */
const MISSED_RING_ALPHA = 0.45;
const MISSED_RING_WIDTH = 1;

type Month = {
  key: string;
  label: string;
  /** Whole weeks, Monday first; `null` is a slot outside the month. */
  weeks: (string | null)[][];
};

/**
 * The last `MONTHS` calendar months as real month grids: every column is one weekday, so
 * a month starting on Wednesday opens with two empty slots and its first row holds five
 * days. A rolling 13-week strip lined the squares up by week instead, which made it
 * impossible to point at a date — the whole reason the months are drawn as calendars.
 */
function buildMonths(todayDate: string, locale: Locale): Month[] {
  const today = parseDateKey(todayDate);

  return Array.from({ length: MONTHS }, (_, index) => {
    // The Date constructor normalises a negative month into the previous year.
    const first = new Date(today.getFullYear(), today.getMonth() - (MONTHS - 1 - index), 1);
    const year = first.getFullYear();
    const month = first.getMonth();
    // Day 0 of the next month is the last day of this one.
    const dayCount = new Date(year, month + 1, 0).getDate();
    // date-fns counts from Sunday; the grid starts on Monday.
    const leadingBlanks = (weekday(first) + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;

    const slots: (string | null)[] = Array.from({ length: leadingBlanks }, () => null);
    for (let day = 1; day <= dayCount; day += 1) {
      slots.push(toDateKey(new Date(year, month, day)));
    }
    while (slots.length % DAYS_IN_WEEK !== 0) {
      slots.push(null);
    }

    const weeks: (string | null)[][] = [];
    for (let start = 0; start < slots.length; start += DAYS_IN_WEEK) {
      weeks.push(slots.slice(start, start + DAYS_IN_WEEK));
    }

    return {
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: capitalize(format(first, 'LLLL', { locale })),
      weeks,
    };
  });
}

type HeatmapProps = {
  /** Full history of the habits being shown — the last 3 months are sliced out here. */
  series: HabitSeries[];
  /** The selection's accent color; cell fill is this color at a ratio-based alpha. */
  color: string;
  todayDate: string;
};

export function Heatmap({ series, color, todayDate }: HeatmapProps) {
  const { colors } = useTheme();
  // The grid stays Monday-first in both languages — the locale names the months, it does
  // not lay out the weeks.
  const { t, locale, weekdays } = useI18n();
  // Rebuilt only when the day rolls over or the language changes, not on every habit the
  // user taps through.
  const months = useMemo(() => buildMonths(todayDate, locale), [todayDate, locale]);

  /**
   * Every drawn day tallied once, keyed by date. The cells and the spoken month summaries
   * read the same map instead of walking the same three months twice; a day that has not
   * happened yet is simply absent from it.
   */
  const tallies = useMemo(() => {
    const byDate = new Map<string, DayTally>();
    for (const month of months) {
      for (const week of month.weeks) {
        for (const date of week) {
          if (date === null || date > todayDate) continue;
          byDate.set(date, tallyDay(series, date, weekday(parseDateKey(date))));
        }
      }
    }
    return byDate;
  }, [months, series, todayDate]);

  const cellStyle = (date: string): ViewStyle | undefined => {
    // Nothing to show for a day that hasn't happened yet — an empty slot, not a "missed"
    // one, or the rest of the current month would read as a wall of failures.
    const tally = tallies.get(date);
    if (!tally) return undefined;
    // Same for a day before the habits existed, or after they were archived: `tallyDay`
    // leaves those inactive, so they read as "nothing planned" rather than as a miss.
    if (tally.active === 0) {
      return { backgroundColor: colors.unscheduled };
    }
    if (tally.ratio > 0) {
      return { backgroundColor: `${color}${alphaHex(tally.ratio)}` };
    }
    return {
      backgroundColor: `${color}${alphaHex(0)}`,
      borderWidth: MISSED_RING_WIDTH,
      borderColor: `${color}${toAlphaHex(MISSED_RING_ALPHA)}`,
    };
  };

  /**
   * What VoiceOver gets instead of the grid. Every cell here says its meaning in colour
   * and in a ring, and neither survives being read aloud; 92 labelled squares a month
   * would be technically accessible and unusable. One sentence per month carries what the
   * grid is for — how much of it is closed — and the month keeps its own three cells of
   * the screen.
   */
  const monthSummary = (month: Month): string => {
    let scheduled = 0;
    let closed = 0;
    for (const week of month.weeks) {
      for (const date of week) {
        const tally = date === null ? undefined : tallies.get(date);
        if (tally === undefined) continue;
        scheduled += tally.scheduled;
        closed += tally.closed;
      }
    }

    return scheduled === 0
      ? t('stats_heatmap_month_empty', { month: month.label })
      : t('stats_heatmap_month', { month: month.label, closed, scheduled });
  };

  return (
    // Three months side by side rather than stacked: each one then keeps the squares
    // large enough to read while the whole quarter still fits on one screen.
    <View style={styles.row}>
      {months.map((month) => (
        <View key={month.key} style={styles.month} accessible accessibilityLabel={monthSummary(month)}>
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {month.label}
          </Text>
          <View style={styles.week}>
            {weekdays.initial.map((initial, index) => (
              <Text
                key={index}
                variant="micro"
                color={colors.textTertiary}
                style={styles.weekdayLabel}>
                {initial}
              </Text>
            ))}
          </View>
          {month.weeks.map((week, index) => (
            <View key={`${month.key}-${index}`} style={styles.week}>
              {week.map((date, slot) => (
                <View
                  key={date ?? `${month.key}-${index}-${slot}`}
                  style={[styles.cell, date ? cellStyle(date) : null]}
                />
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    // Months differ by a row; without this the shorter ones would stretch their cells.
    alignItems: 'flex-start',
  },
  month: {
    flex: 1,
    gap: spacing.xs,
  },
  week: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
  },
});
