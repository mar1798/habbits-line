import { format } from 'date-fns/format';
import type { Locale } from 'date-fns';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, motion, radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { parseDateKey } from '@/lib/date';
import { haptics } from '@/lib/haptics';

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

/** How far, or how fast, the strip has to be dragged for the week to actually turn. */
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 500;
/** Only the horizontal intent pages the strip; below this the list underneath scrolls. */
const PAN_ACTIVATION = 14;
const PAN_FAIL_Y = 12;
/** Resistance past the current week, where there is nothing to page to. */
const RUBBER_BAND = 0.25;

const settleSpring = {
  ...motion.spring.press,
  reduceMotion: ReduceMotion.System,
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Names the week the strip is showing: "Август", "Август — сентябрь", or
 * "December 2026 — January 2027". Without it the strip is seven bare day numbers and,
 * once paging exists, nothing says which week they belong to.
 *
 * The year appears only when the week falls outside the current one — on this year it
 * is noise on every single render. The locale is used for the month name only; the week
 * itself is still Monday-first in both languages, from lib/date's weekDates().
 */
function weekLabel(dates: string[], todayDate: string, locale: Locale): string {
  const currentYear = todayDate.slice(0, 4);
  const monthOf = (key: string) => {
    const year = key.slice(0, 4);
    const month = format(parseDateKey(key), 'LLLL', { locale });
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
  const { t, locale, weekdays } = useI18n();

  const translateX = useSharedValue(0);

  /**
   * Turns the week the swipe asked for and answers the finger — one hop back to the JS
   * runtime for both, at the end of the gesture rather than per frame.
   */
  const commitWeek = (weeks: -1 | 1) => {
    if (weeks === -1) onPreviousWeek();
    else onNextWeek();
    haptics.tick();
  };

  /**
   * The arrows are still the explicit control; this is the same paging under the finger,
   * which is how a week strip is expected to move. It follows the drag and settles back
   * on release — the week itself changes at once, so a committed swipe hands the new
   * dates back to the same cells rather than sliding a second copy of the strip in.
   */
  const pan = Gesture.Pan()
    .activeOffsetX([-PAN_ACTIVATION, PAN_ACTIVATION])
    .failOffsetY([-PAN_FAIL_Y, PAN_FAIL_Y])
    .onUpdate((event) => {
      // Dragging left asks for the next week; past today there is none, so it resists.
      const blocked = event.translationX < 0 && !canGoNext;
      translateX.value = blocked ? event.translationX * RUBBER_BAND : event.translationX;
    })
    .onEnd((event) => {
      // Distance or velocity: a flick that never travelled far is still a page turn.
      const committed =
        Math.abs(event.translationX) > SWIPE_DISTANCE || Math.abs(event.velocityX) > SWIPE_VELOCITY;

      if (committed && event.translationX > 0) {
        scheduleOnRN(commitWeek, -1);
      } else if (committed && event.translationX < 0 && canGoNext) {
        scheduleOnRN(commitWeek, 1);
      }

      translateX.value = withSpring(0, { ...settleSpring, velocity: event.velocityX });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View>
        <View style={styles.nav}>
          <IconButton
            name="chevron.left"
            compact
            accessibilityLabel={t('day_strip_prev_week')}
            onPress={onPreviousWeek}
          />
          <Animated.View style={animatedStyle}>
            <Text variant="callout" color={colors.textSecondary}>
              {weekLabel(dates, todayDate, locale)}
            </Text>
          </Animated.View>
          <IconButton
            name="chevron.right"
            compact
            accessibilityLabel={t('day_strip_next_week')}
            onPress={onNextWeek}
            disabled={!canGoNext}
          />
        </View>

        <Animated.View style={[styles.row, animatedStyle]}>
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
                accessibilityLabel={`${weekdays.short[index]}, ${dayNumber}`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.cell,
                  {
                    backgroundColor: isSelected ? colors.accent : 'transparent',
                  },
                ]}>
                <Text variant="caption" color={labelColor}>
                  {weekdays.short[index]}
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
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    // Same gutter as the nav above it and the cards below: at spacing.md the tinted cell
    // of the selected day stuck out of the screen's margin by 4pt.
    paddingHorizontal: spacing.lg,
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
