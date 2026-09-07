import { format } from 'date-fns/format';
import type { Locale } from 'date-fns';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { DAYS_IN_WEEK, parseDateKey, toDateKey, weekday } from '@/lib/date';
import { type DayTally, type HabitSeries, tallyDay } from '@/lib/streaks';

/**
 * How many calendar months each range draws, ending with the current one. A year is
 * twelve of the same month grids on four rows, not a different chart: the grid exists so
 * a square can be pointed at as a date, and a 53-week strip would trade that away exactly
 * when there is the most history to point at.
 */
const RANGE_MONTHS = { quarter: 3, year: 12 } as const;

type Range = keyof typeof RANGE_MONTHS;

/** Months per row, in both ranges — three keeps a cell readable at phone width. */
const MONTHS_PER_ROW = 3;

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

/** Same ring, drawn in the neutral border token: the slot exists, nothing is known yet. */
const FUTURE_BORDER_WIDTH = 1;

type Month = {
  key: string;
  label: string;
  /** Whole weeks, Monday first; `null` is a slot outside the month. */
  weeks: (string | null)[][];
};

/**
 * The last `count` calendar months as real month grids: every column is one weekday, so
 * a month starting on Wednesday opens with two empty slots and its first row holds five
 * days. A rolling 13-week strip lined the squares up by week instead, which made it
 * impossible to point at a date — the whole reason the months are drawn as calendars.
 */
function buildMonths(todayDate: string, locale: Locale, count: number): Month[] {
  const today = parseDateKey(todayDate);

  return Array.from({ length: count }, (_, index) => {
    // The Date constructor normalises a negative month into the previous year.
    const first = new Date(today.getFullYear(), today.getMonth() - (count - 1 - index), 1);
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
      // No year on the label even across the twelve-month range: it ends on the current
      // month, so the twelve names are all different and none of them is ambiguous.
      label: capitalize(format(first, 'LLLL', { locale })),
      weeks,
    };
  });
}

type HeatmapProps = {
  /** Full history of the habits being shown — the visible range is sliced out here. */
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
  // The range lives here rather than on the screen: nothing above the heatmap reads it,
  // and holding it here keeps the choice across a switch between habits, which is exactly
  // when the two views are being compared.
  const [range, setRange] = useState<Range>('quarter');
  // Rebuilt only when the day rolls over, the language changes or the range is switched,
  // not on every habit the user taps through.
  const months = useMemo(
    () => buildMonths(todayDate, locale, RANGE_MONTHS[range]),
    [todayDate, locale, range]
  );

  /** Whole rows of `MONTHS_PER_ROW`; the last one of the year range is full too. */
  const rows = useMemo(() => {
    const chunks: Month[][] = [];
    for (let start = 0; start < months.length; start += MONTHS_PER_ROW) {
      chunks.push(months.slice(start, start + MONTHS_PER_ROW));
    }
    return chunks;
  }, [months]);

  /**
   * Every drawn day tallied once, keyed by date. The cells and the spoken month summaries
   * read the same map instead of walking the same months twice; a day that has not
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
    // A day that hasn't happened yet gets an outline and no fill — not the "missed"
    // treatment, or the rest of the current month would read as a wall of failures, and
    // not nothing at all: on the 1st of a month the whole third column went invisible
    // and the month looked broken rather than unwritten.
    const tally = tallies.get(date);
    if (!tally) {
      return { borderWidth: FUTURE_BORDER_WIDTH, borderColor: colors.border };
    }
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
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="headline">{t('stats_heatmap')}</Text>
        {/* Two pills rather than a switch: the control names both ranges, so the one that
            is not shown is still readable as what tapping would give. */}
        <View style={styles.ranges}>
          {(Object.keys(RANGE_MONTHS) as Range[]).map((option) => {
            const isSelected = option === range;
            const label = t(option === 'year' ? 'stats_heatmap_year' : 'stats_heatmap_quarter');
            return (
              <PressableScale
                key={option}
                onPress={() => setRange(option)}
                // Same reasoning as the archive toggle on the screen above: iOS has no
                // checkbox trait, and a radio role leaves VoiceOver silent about state.
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.rangeButton,
                  { backgroundColor: isSelected ? colors.accentSoft : colors.surfaceAlt },
                ]}>
                <Text
                  variant="caption"
                  color={isSelected ? colors.accent : colors.textSecondary}>
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Three months side by side rather than stacked: each one then keeps the squares
          large enough to read, and the year is the same three-wide row four times over
          rather than a second, denser chart to learn. */}
      {rows.map((row, rowIndex) => (
        <View key={row[0]?.key ?? rowIndex} style={styles.row}>
          {row.map((month) => (
            <View
              key={month.key}
              style={styles.month}
              accessible
              accessibilityLabel={monthSummary(month)}>
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ranges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rangeButton: {
    justifyContent: 'center',
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
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
