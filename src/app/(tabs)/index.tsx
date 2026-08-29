import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { DayStrip } from '@/components/habit/day-strip';
import { HabitCard } from '@/components/habit/habit-card';
import { ProgressBar } from '@/components/habit/progress-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import type { HabitRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTodayKey } from '@/hooks/use-today-key';
import {
  parseDateKey,
  shiftDateKey,
  timestampDateKey,
  weekDates,
  weekStartKey,
} from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { isScheduledOn } from '@/lib/schedule';
import { useEntriesStore } from '@/store/entries-store';
import { useHabitsStore } from '@/store/habits-store';

/** Stable identity for a day with no marks, so the schedule filter isn't rebuilt each render. */
const NO_COUNTS: Record<string, number> = {};

export default function TodayScreen() {
  const db = useSQLiteContext();
  const { t } = useI18n();

  const habits = useHabitsStore((state) => state.habits);
  const habitsLoaded = useHabitsStore((state) => state.loaded);
  const loadHabits = useHabitsStore((state) => state.load);
  const archiveHabit = useHabitsStore((state) => state.archive);

  const counts = useEntriesStore((state) => state.counts);
  const loadWeek = useEntriesStore((state) => state.loadWeek);
  const cycleCount = useEntriesStore((state) => state.cycle);

  const today = useTodayKey();
  // The strip is anchored on a week rather than derived from today, so it can be paged
  // back into history; `selectedDate` always sits inside the anchored week.
  const [weekStart, setWeekStart] = useState(() => weekStartKey(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const previousTodayRef = useRef(today);

  const week = useMemo(() => weekDates(parseDateKey(weekStart)), [weekStart]);
  /** Paging forward stops at the week containing today — see DayStrip's `canGoNext`. */
  const canGoNext = week[6] < today;

  // Left open over midnight. A strip that was showing the current week follows the
  // rollover into the new one; a week the user paged back to deliberately stays put.
  // The selection follows only if it was tracking "today", and is pulled back onto the
  // strip if the new week no longer contains it — otherwise no cell would be
  // highlighted while the list below still showed the old day.
  useEffect(() => {
    if (previousTodayRef.current === today) {
      return;
    }
    const previousToday = previousTodayRef.current;
    previousTodayRef.current = today;

    const nextWeekStart =
      weekStart === weekStartKey(previousToday) ? weekStartKey(today) : weekStart;
    const nextWeek = weekDates(parseDateKey(nextWeekStart));
    setWeekStart(nextWeekStart);
    setSelectedDate((current) =>
      current === previousToday || !nextWeek.includes(current) ? today : current
    );
  }, [today, weekStart]);

  /**
   * Pages the strip by `weeks` and keeps the weekday the user was looking at, so
   * stepping back through Mondays stays on Mondays. Landing past today is impossible
   * going back and clamped going forward, where the target week is at most the current
   * one and therefore always contains today.
   */
  const goToWeek = (weeks: number) => {
    const nextWeekStart = shiftDateKey(weekStart, weeks * 7);
    const nextWeek = weekDates(parseDateKey(nextWeekStart));
    const weekdayIndex = Math.max(week.indexOf(selectedDate), 0);
    const target = nextWeek[weekdayIndex];

    setWeekStart(nextWeekStart);
    setSelectedDate(target > today ? today : target);
  };

  useEffect(() => {
    loadHabits(db);
  }, [db, loadHabits]);

  useEffect(() => {
    loadWeek(db, week[0], week[6]);
  }, [db, loadWeek, week]);

  // Settings loads this same store with archived habits included (needed so editing
  // one finds it) — filter them back out here, since that scope persists globally.
  const activeHabits = useMemo(() => habits.filter((habit) => !habit.archived_at), [habits]);

  const dayCounts = counts[selectedDate] ?? NO_COUNTS;

  const scheduledHabits = useMemo(
    () =>
      activeHabits.filter((habit) => {
        if (!isScheduledOn(habit.schedule_mask, parseDateKey(selectedDate))) return false;
        // A habit exists only from the day it was added: paging back must not list it on
        // days it wasn't around for, where it could only ever read as missed. A day it
        // already has progress on stays visible either way — a past day marked through
        // the strip before, or an imported history, is still its own.
        const created = timestampDateKey(habit.created_at);
        return created === null || created <= selectedDate || (dayCounts[habit.id] ?? 0) > 0;
      }),
    [activeHabits, selectedDate, dayCounts]
  );
  const isEditable = selectedDate <= today;

  const dayProgress = scheduledHabits.length
    ? scheduledHabits.reduce((sum, habit) => {
        const count = dayCounts[habit.id] ?? 0;
        return sum + Math.min(count / habit.target_per_day, 1);
      }, 0) / scheduledHabits.length
    : 0;

  // Floor, not round: 99.6% of the day rounds to a "100%" the user hasn't earned yet.
  const dayPercent = Math.floor(dayProgress * 100);

  const isDayComplete = (dayEntries: Record<string, number> | undefined) =>
    scheduledHabits.length > 0 &&
    scheduledHabits.every((habit) => (dayEntries?.[habit.id] ?? 0) >= habit.target_per_day);

  /**
   * One tap on a habit's check button, and the single place that decides its haptic:
   * closing the day upgrades the light tick to a success pattern, so firing one inside
   * the button as well would run two overlapping patterns on the same tap.
   *
   * Both readings come from the store rather than from render props. `cycle` patches
   * its cell synchronously and only then awaits the write, so the state read right
   * after the call is already the post-tap one — while props inside a fast series of
   * taps still show the pre-tap count and would mislabel a wrap-to-0 as a step forward.
   * Watching `dayProgress` across renders instead is what fails on load: entries arrive
   * after the first render, so an already-closed day would congratulate the user for
   * opening the app or for paging onto it.
   */
  const handleToggle = (habit: HabitRow) => {
    const before = useEntriesStore.getState().counts[selectedDate];
    void cycleCount(db, habit.id, selectedDate, habit.target_per_day);
    const after = useEntriesStore.getState().counts[selectedDate];

    if (!isDayComplete(before) && isDayComplete(after)) {
      haptics.success();
    } else if ((after?.[habit.id] ?? 0) === 0) {
      haptics.reset();
    } else {
      haptics.tick();
    }
  };

  /**
   * Archiving from the card's context menu. The rejection is swallowed rather than
   * left floating: unhandled, it shows up as a Metro warning for a failure the user
   * can only retry anyway.
   */
  const handleArchive = (habit: HabitRow) => {
    archiveHabit(db, habit.id).catch((error) => console.warn('Failed to archive habit', error));
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title1">{t('today_title')}</Text>
        <IconButton
          name="plus"
          compact
          accessibilityLabel={t('today_add_habit')}
          onPress={() => router.push('/habit/new')}
        />
      </View>

      <DayStrip
        dates={week}
        selectedDate={selectedDate}
        todayDate={today}
        onSelect={setSelectedDate}
        onPreviousWeek={() => goToWeek(-1)}
        onNextWeek={() => goToWeek(1)}
        canGoNext={canGoNext}
      />

      {scheduledHabits.length > 0 ? (
        <View
          style={styles.progress}
          accessibilityRole="progressbar"
          accessibilityLabel={t('today_day_progress')}
          accessibilityValue={{ min: 0, max: 100, now: dayPercent }}
        >
          <View style={styles.progressBar}>
            <ProgressBar progress={dayProgress} />
          </View>
          <Text variant="callout" style={styles.progressPercent}>
            {dayPercent}%
          </Text>
        </View>
      ) : null}

      {scheduledHabits.length > 0 ? (
        <FlatList
          data={scheduledHabits}
          keyExtractor={(habit) => habit.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <HabitCard
              habit={item}
              count={dayCounts[item.id] ?? 0}
              disabled={!isEditable}
              onToggle={() => handleToggle(item)}
              onEdit={() => router.push({ pathname: '/habit/[id]', params: { id: item.id } })}
              onArchive={() => handleArchive(item)}
            />
          )}
        />
      ) : habitsLoaded ? (
        // Gated on the load: the store is empty for a frame on a cold start, and an
        // ungated empty state greets every launch with "no habits yet".
        <EmptyState
          icon="checkmark.circle"
          title={t(activeHabits.length === 0 ? 'empty_no_habits' : 'today_nothing_title')}
          subtitle={t(
            activeHabits.length === 0 ? 'today_empty_subtitle' : 'today_nothing_subtitle'
          )}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    // The strip's week arrows sit directly under the "+" button; without this they
    // touch it and the two rows of controls read as one crowded block.
    paddingBottom: spacing.md,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  progressBar: {
    flex: 1,
  },
  progressPercent: {
    // Fixed width so the bar does not jump sideways as the label goes 9% → 100%.
    width: 40,
    textAlign: 'right',
  },
  list: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
