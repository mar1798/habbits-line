import { format } from 'date-fns';
// Deep import, not `date-fns/locale`: that barrel pulls in every locale date-fns ships.
import { ru } from 'date-fns/locale/ru';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';
import { parseDateKey, shiftDateKey, weekStartKey } from '@/lib/date';
import { isScheduledOn } from '@/lib/schedule';
import { dayCompletionRatio } from '@/lib/streaks';

const WEEKS = 13; // ~3 months, Monday-first columns, the current week last.
const DAYS_IN_WEEK = 7;
const CELL_SIZE = 13;
const LABEL_HEIGHT = 14;
/** Room for a 3-letter month name; it overflows its column on purpose, see `monthLabel`. */
const LABEL_WIDTH = 40;

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Alpha for the ratio fill: 0 stays a faint tint (still readable as "scheduled, not done"), 1 is opaque. */
function alphaHex(ratio: number): string {
  const alpha = Math.round((0.12 + 0.88 * Math.min(Math.max(ratio, 0), 1)) * 255);
  return alpha.toString(16).padStart(2, '0');
}

type HeatmapProps = {
  /** Full entry history for the habit — the last 3 months are sliced out here. */
  entryCounts: Record<string, number>;
  scheduleMask: number;
  targetPerDay: number;
  /** The habit's resolved accent color; cell fill is this color at a ratio-based alpha. */
  color: string;
  todayDate: string;
};

export function Heatmap({ entryCounts, scheduleMask, targetPerDay, color, todayDate }: HeatmapProps) {
  const { colors } = useTheme();
  const firstWeekStart = shiftDateKey(weekStartKey(todayDate), -(WEEKS - 1) * DAYS_IN_WEEK);

  const weeks = Array.from({ length: WEEKS }, (_, week) => {
    const weekStart = shiftDateKey(firstWeekStart, week * DAYS_IN_WEEK);
    return Array.from({ length: DAYS_IN_WEEK }, (_, day) => shiftDateKey(weekStart, day));
  });

  // A month's name sits above the first week-column that contains its 1st — otherwise
  // 13 bare columns of squares don't say which 3 months they cover.
  const monthLabels = weeks.map((week) => {
    const monthStart = week.find((date) => date.endsWith('-01'));
    return monthStart ? capitalize(format(parseDateKey(monthStart), 'LLL', { locale: ru })) : null;
  });

  return (
    <View>
      <View style={styles.grid}>
        {weeks.map((week, index) => (
          <View key={week[0]} style={styles.column}>
            <View style={styles.labelSlot}>
              {monthLabels[index] ? (
                <Text
                  variant="micro"
                  color={colors.textTertiary}
                  style={styles.monthLabel}
                  numberOfLines={1}>
                  {monthLabels[index]}
                </Text>
              ) : null}
            </View>
            {week.map((date) => {
              if (date > todayDate) {
                return <View key={date} style={styles.cell} />;
              }
              const count = entryCounts[date] ?? 0;
              const scheduled = isScheduledOn(scheduleMask, parseDateKey(date));
              const fill =
                !scheduled && count === 0
                  ? colors.unscheduled
                  : `${color}${alphaHex(dayCompletionRatio(count, targetPerDay))}`;
              return <View key={date} style={[styles.cell, { backgroundColor: fill }]} />;
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  column: {
    width: CELL_SIZE,
    gap: spacing.xs,
  },
  labelSlot: {
    height: LABEL_HEIGHT,
  },
  // Absolute and wider than the column on purpose: a month name is ~20pt wide, and in
  // the flow it would stretch its column past CELL_SIZE and knock the grid out of
  // alignment. Labels sit at least four columns apart, so the overhang never collides.
  monthLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LABEL_WIDTH,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
});
