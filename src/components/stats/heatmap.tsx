import { format, type Locale } from 'date-fns';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { DAYS_IN_WEEK, parseDateKey, toDateKey, weekday } from '@/lib/date';
import { type HabitSeries, tallyDay } from '@/lib/streaks';

/** The current month and the two before it, oldest on the left. */
const MONTHS = 3;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Alpha for the ratio fill: 0 stays a faint tint (still readable as "scheduled, not done"), 1 is opaque. */
function alphaHex(ratio: number): string {
  const alpha = Math.round((0.12 + 0.88 * Math.min(Math.max(ratio, 0), 1)) * 255);
  return alpha.toString(16).padStart(2, '0');
}

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
  const { locale, weekdays } = useI18n();
  // Rebuilt only when the day rolls over or the language changes, not on every habit the
  // user taps through.
  const months = useMemo(() => buildMonths(todayDate, locale), [todayDate, locale]);

  const cellFill = (date: string): string | undefined => {
    // Nothing to show for a day that hasn't happened yet — an empty slot, not a "missed"
    // one, or the rest of the current month would read as a wall of failures.
    if (date > todayDate) return undefined;
    // Same for a day before the habits existed: `tallyDay` leaves those inactive, so
    // they read as "nothing planned" rather than as a missed day.
    const { active, ratio } = tallyDay(series, date, weekday(parseDateKey(date)));
    return active === 0 ? colors.unscheduled : `${color}${alphaHex(ratio)}`;
  };

  return (
    // Three months side by side rather than stacked: each one then keeps the squares
    // large enough to read while the whole quarter still fits on one screen.
    <View style={styles.row}>
      {months.map((month) => (
        <View key={month.key} style={styles.month}>
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
                  style={[styles.cell, date ? { backgroundColor: cellFill(date) } : null]}
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
