import { format } from 'date-fns';
// Deep import, not `date-fns/locale`: that barrel re-exports every locale date-fns
// ships and pulls all of them into the bundle (+522 modules when measured).
import { ru } from 'date-fns/locale/ru';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';
import { parseDateKey } from '@/lib/date';

/** Bit 0 = Monday … bit 6 = Sunday, matching schedule_mask and lib/date's weekDates(). */
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type DayStripProps = {
  /** The 7 date keys of one week, Monday first — see lib/date's weekDates(). */
  dates: string[];
  selectedDate: string;
  todayDate: string;
  onSelect: (date: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  /**
   * False once the strip has reached the week containing today. Paging back is
   * unlimited (that is the whole point — editing past days), forward stops here:
   * beyond today there is nothing to mark, and an unbounded forward strip is an easy
   * way to wander off into a month the user then has to tap their way back from.
   */
  canGoNext: boolean;
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Names the week the strip is showing: "Август", "Август — сентябрь", or
 * "Декабрь 2026 — январь 2027". Without it the strip is seven bare day numbers and,
 * once paging exists, nothing says which week they belong to.
 *
 * The year appears only when the week falls outside the current one — on this year it
 * is noise on every single render.
 */
function weekLabel(dates: string[], todayDate: string): string {
  const currentYear = todayDate.slice(0, 4);
  const monthOf = (key: string) => {
    const year = key.slice(0, 4);
    const month = format(parseDateKey(key), 'LLLL', { locale: ru });
    return year === currentYear ? month : `${month} ${year}`;
  };

  const from = dates[0];
  const to = dates[dates.length - 1];
  // Same calendar month means same year too — a week never spans 12 months.
  if (from.slice(0, 7) === to.slice(0, 7)) {
    return capitalize(monthOf(from));
  }
  return `${capitalize(monthOf(from))} — ${monthOf(to)}`;
}

export function DayStrip({
  dates,
  selectedDate,
  todayDate,
  onSelect,
  onPreviousWeek,
  onNextWeek,
  canGoNext,
}: DayStripProps) {
  const { colors } = useTheme();

  return (
    <View>
      <View style={styles.nav}>
        <IconButton
          name="chevron.left"
          accessibilityLabel="Предыдущая неделя"
          onPress={onPreviousWeek}
        />
        <Text variant="callout" color={colors.textSecondary}>
          {weekLabel(dates, todayDate)}
        </Text>
        <IconButton
          name="chevron.right"
          accessibilityLabel="Следующая неделя"
          onPress={onNextWeek}
          disabled={!canGoNext}
        />
      </View>

      <View style={styles.row}>
        {dates.map((date, index) => {
          const isSelected = date === selectedDate;
          const isToday = date === todayDate;
          const isFuture = date > todayDate;
          const dayNumber = format(parseDateKey(date), 'd');
          // A future day stays readable but recedes — both of its lines, not just the
          // number, or the weekday label reads as brighter than the date it belongs to.
          const textColor = isSelected
            ? colors.onAccent
            : isFuture
              ? colors.textTertiary
              : colors.textPrimary;
          const labelColor = isSelected
            ? colors.onAccent
            : isFuture
              ? colors.textTertiary
              : colors.textSecondary;

          return (
            <PressableScale
              key={date}
              onPress={() => onSelect(date)}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAY_LABELS[index]}, ${dayNumber}`}
              accessibilityState={{ selected: isSelected }}
              style={[styles.cell, { backgroundColor: isSelected ? colors.accent : 'transparent' }]}>
              <Text variant="caption" color={labelColor}>
                {WEEKDAY_LABELS[index]}
              </Text>
              <Text variant="headline" color={textColor}>
                {dayNumber}
              </Text>
              <View
                style={[
                  styles.todayDot,
                  {
                    backgroundColor: isToday
                      ? isSelected
                        ? colors.onAccent
                        : colors.accent
                      : 'transparent',
                  },
                ]}
              />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  cell: {
    flex: 1,
    minHeight: minHitSlop,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: radius.pill,
  },
});
