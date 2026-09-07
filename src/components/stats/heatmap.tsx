import { format } from 'date-fns/format';
import type { Locale } from 'date-fns';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { DAYS_IN_WEEK, parseDateKey, toDateKey, weekday } from '@/lib/date';
import { type DayTally, type HabitSeries, tallyDay } from '@/lib/streaks';

/**
 * A year of history, always — one strip of month grids scrolled sideways rather than a
 * range to choose. A control that has to be found and tapped before the older months
 * exist is a worse answer than the months simply being there, off the edge of the screen,
 * where every other horizontal list in the app already keeps its past.
 *
 * Twelve of the same month grids, not a 53-week GitHub strip: the grid exists so a square
 * can be pointed at as a date, and a week-aligned band trades that away exactly when
 * there is the most history to point at.
 */
const MONTHS = 12;

/**
 * How many months fill the viewport, which is what fixes a month's width. Three keeps a
 * cell the size it has always been, and the strip opens scrolled to the end, so these are
 * the last three months — the range this screen showed before it grew the other nine.
 */
const MONTHS_VISIBLE = 3;

/** The gap between two months, in the strip and in the width arithmetic below. */
const MONTH_GAP = spacing.md;

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
      // No year on the label: the strip ends on the current month, so its twelve names
      // are all different and none of them is ambiguous.
      label: capitalize(format(first, 'LLLL', { locale })),
      weeks,
    };
  });
}

type HeatmapProps = {
  /** Full history of the habits being shown — the drawn year is sliced out here. */
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
   * The strip's own width, measured rather than assumed: a month has to be exactly a third
   * of it for three of them to fill the screen, and the card's padding and the screen's
   * gutters are not this component's to know. Zero until the first layout, which is what
   * holds the strip back for one frame — laying it out at a guessed width and correcting
   * afterwards would show the year sliding sideways on every open.
   */
  const [width, setWidth] = useState(0);
  const monthWidth = (width - MONTH_GAP * (MONTHS_VISIBLE - 1)) / MONTHS_VISIBLE;

  /**
   * Where the strip is allowed to come to rest: one offset per whole month it can start
   * on, from January at the far left to the last three months at the far right. Snapping
   * to these is what keeps a month whole — free scrolling parks the strip mid-month, and
   * a grid sliced down the middle of a week reads as a rendering bug rather than as
   * something to swipe.
   *
   * The last offset is exactly the end of the content — twelve months minus the three
   * that fit is nine steps — so the right edge is a resting place like any other, with no
   * short final step that would bounce the strip back.
   */
  const snapOffsets = useMemo(
    () =>
      Array.from(
        { length: MONTHS - MONTHS_VISIBLE + 1 },
        (_, index) => index * (monthWidth + MONTH_GAP)
      ),
    [monthWidth]
  );

  /**
   * Opens on the last three months, with the rest of the year behind the left edge: the
   * recent end is the one being read, and a strip that opened on a January nobody asked
   * for would need a swipe before it said anything.
   *
   * Memoised so its identity survives a re-render. Rebuilding the object on every render
   * hands the native scroll view a "new" offset each time the selected habit changes,
   * which would yank the strip back to the end under a user who had scrolled away.
   */
  const contentOffset = useMemo(
    () => ({ x: snapOffsets[snapOffsets.length - 1] ?? 0, y: 0 }),
    [snapOffsets]
  );

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
      <Text variant="headline">{t('stats_heatmap')}</Text>

      {/* Measured on the wrapper, not on the scroll view: a horizontal ScrollView's own
          layout width is the viewport, but reading it from `onLayout` there would race
          with the content it is being used to size. */}
      <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {width === 0 ? null : (
          <ScrollView
            horizontal
            // The strip is twelve fixed-width months, not a list that grows with the data:
            // it has a ceiling by construction, so there is nothing here to virtualise.
            showsHorizontalScrollIndicator={false}
            contentOffset={contentOffset}
            snapToOffsets={snapOffsets}
            // Snapping without this still decelerates across several months first, which
            // reads as the strip drifting to a stop and then correcting itself.
            decelerationRate="fast"
            contentContainerStyle={styles.strip}>
            {months.map((month) => (
              <View
                key={month.key}
                style={[styles.month, { width: monthWidth }]}
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
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  strip: {
    flexDirection: 'row',
    gap: MONTH_GAP,
    // Months differ by a row; without this the shorter ones would stretch their cells.
    alignItems: 'flex-start',
  },
  month: {
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
