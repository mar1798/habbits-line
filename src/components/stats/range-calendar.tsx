import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { DAYS_IN_WEEK, parseDateKey, toDateKey, weekday } from '@/lib/date';
import { extendRange, type DateRange } from '@/lib/date-range';

/** First day of the month `key` falls into — the calendar is anchored on this. */
function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** The month `delta` months away from the one starting at `anchor`. */
function shiftMonth(anchor: string, delta: number): string {
  const date = parseDateKey(anchor);
  // A month index outside 0..11 rolls into the neighbouring year on its own.
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

/**
 * One month as whole weeks, Monday first; `null` is a slot outside the month. Same shape
 * as the heatmap's grid and for the same reason — every column is one weekday, so a date
 * can be pointed at rather than counted to.
 */
function buildWeeks(anchor: string): (string | null)[][] {
  const first = parseDateKey(anchor);
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
  return weeks;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

type RangeCalendarProps = {
  range: DateRange | null;
  /** Last selectable day — today. There is nothing to have spent in the future. */
  maxDate: string;
  onChange: (range: DateRange) => void;
};

/**
 * Month calendar with an inclusive two-tap range selection. Paging back is unlimited —
 * the whole point is reaching an arbitrary past span — while forward stops at the month
 * of `maxDate`, for the same reason the day strip stops at the current week.
 */
export function RangeCalendar({ range, maxDate, onChange }: RangeCalendarProps) {
  const { colors } = useTheme();
  const { t, locale, weekdays } = useI18n();

  // Opens on the month of the current selection, so a range picked earlier is in view
  // when the block is scrolled back to.
  const [anchor, setAnchor] = useState(() => monthStart(range?.start ?? maxDate));

  const weeks = useMemo(() => buildWeeks(anchor), [anchor]);
  const label = capitalize(format(parseDateKey(anchor), 'LLLL yyyy', { locale }));
  const canGoNext = anchor < monthStart(maxDate);

  /** Fill and corners of one day: the two ends are solid, the days between them a band. */
  const cellStyle = (date: string): ViewStyle | undefined => {
    if (range === null) return undefined;
    const end = range.end;
    const isStart = date === range.start;
    const isEnd = end !== null && date === end;

    if (isStart || isEnd) {
      return {
        backgroundColor: colors.accent,
        // Square on the side the band continues on, so the ends and the days between
        // them read as one shape rather than three.
        borderTopLeftRadius: isStart ? radius.sm : 0,
        borderBottomLeftRadius: isStart ? radius.sm : 0,
        borderTopRightRadius: isEnd || end === null ? radius.sm : 0,
        borderBottomRightRadius: isEnd || end === null ? radius.sm : 0,
      };
    }
    if (end !== null && date > range.start && date < end) {
      return { backgroundColor: colors.accentSoft, borderRadius: 0 };
    }
    return undefined;
  };

  const isSelected = (date: string): boolean =>
    range !== null &&
    date >= range.start &&
    (range.end === null ? date === range.start : date <= range.end);

  return (
    <View style={styles.calendar}>
      <View style={styles.nav}>
        <IconButton
          name="chevron.left"
          compact
          accessibilityLabel={t('calendar_prev_month')}
          onPress={() => setAnchor((current) => shiftMonth(current, -1))}
        />
        <Text variant="callout" color={colors.textSecondary}>
          {label}
        </Text>
        <IconButton
          name="chevron.right"
          compact
          accessibilityLabel={t('calendar_next_month')}
          onPress={() => setAnchor((current) => shiftMonth(current, 1))}
          disabled={!canGoNext}
        />
      </View>

      <View style={styles.week}>
        {weekdays.short.map((short, index) => (
          <Text
            key={index}
            variant="micro"
            color={colors.textTertiary}
            style={styles.weekdayLabel}>
            {short}
          </Text>
        ))}
      </View>

      {weeks.map((week, index) => (
        <View key={`${anchor}-week-${index}`} style={styles.week}>
          {week.map((date, slot) => {
            if (date === null) {
              return <View key={`${anchor}-${index}-${slot}`} style={styles.cell} />;
            }

            const isFuture = date > maxDate;
            const selected = isSelected(date);
            const isToday = date === maxDate;
            const textColor = selected
              ? date === range?.start || date === range?.end
                ? colors.onAccent
                : colors.textPrimary
              : isFuture
                ? colors.textTertiary
                : colors.textPrimary;

            return (
              <PressableScale
                key={date}
                onPress={() => onChange(extendRange(range, date))}
                disabled={isFuture}
                accessibilityRole="button"
                accessibilityLabel={format(parseDateKey(date), 'd MMMM yyyy', { locale })}
                accessibilityState={{ selected, disabled: isFuture }}
                style={[styles.cell, cellStyle(date)]}>
                <Text variant="callout" color={textColor}>
                  {format(parseDateKey(date), 'd')}
                </Text>
                <View
                  style={[
                    styles.todayDot,
                    { backgroundColor: isToday ? textColor : 'transparent' },
                  ]}
                />
              </PressableScale>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    gap: spacing.xs,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  week: {
    flexDirection: 'row',
    // No gap between the cells on purpose: the days between the two ends carry a tinted
    // fill, and any gap would break it into separate squares instead of one band.
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  cell: {
    flex: 1,
    height: minHitSlop,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: radius.pill,
  },
});
