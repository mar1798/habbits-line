import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, StyleSheet, View } from 'react-native';

import { DayStrip } from '@/components/habit/day-strip';
import { HabitCard } from '@/components/habit/habit-card';
import { ProgressRing } from '@/components/habit/progress-ring';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { parseDateKey, shiftDateKey, todayKey, weekDates, weekStartKey } from '@/lib/date';
import { isScheduledOn } from '@/lib/schedule';
import { useEntriesStore } from '@/store/entries-store';
import { useHabitsStore } from '@/store/habits-store';

export default function TodayScreen() {
  const db = useSQLiteContext();

  const habits = useHabitsStore((state) => state.habits);
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

  const scheduledHabits = useMemo(
    () => habits.filter((habit) => isScheduledOn(habit.schedule_mask, parseDateKey(selectedDate))),
    [habits, selectedDate]
  );

  const dayCounts = counts[selectedDate] ?? {};
  const isEditable = selectedDate <= today;

  const dayProgress = scheduledHabits.length
    ? scheduledHabits.reduce((sum, habit) => {
        const count = dayCounts[habit.id] ?? 0;
        return sum + Math.min(count / habit.target_per_day, 1);
      }, 0) / scheduledHabits.length
    : 0;

  // Floor, not round: 99.6% of the day rounds to a "100%" the user hasn't earned yet.
  const dayPercent = Math.floor(dayProgress * 100);

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title1">Сегодня</Text>
        <IconButton
          name="plus"
          accessibilityLabel="Добавить привычку"
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
        <View style={styles.ring}>
          <ProgressRing progress={dayProgress} size={72} strokeWidth={7}>
            <Text variant="headline">{dayPercent}%</Text>
          </ProgressRing>
        </View>
      ) : null}

      {scheduledHabits.length === 0 ? (
        <EmptyState
          icon="checkmark.circle"
          title={habits.length === 0 ? 'Привычек пока нет' : 'На этот день ничего не запланировано'}
          subtitle={
            habits.length === 0
              ? 'Нажмите «+», чтобы добавить первую привычку'
              : 'Выберите другой день или измените расписание привычки'
          }
        />
      ) : (
        <FlatList
          data={scheduledHabits}
          keyExtractor={(habit) => habit.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <HabitCard
              habit={item}
              count={dayCounts[item.id] ?? 0}
              disabled={!isEditable}
              onToggle={() => cycleCount(db, item.id, selectedDate, item.target_per_day)}
              onEdit={() => router.push({ pathname: '/habit/[id]', params: { id: item.id } })}
              onArchive={() => archiveHabit(db, item.id)}
            />
          )}
        />
      )}
    </Screen>
  );
}

/**
 * Local-date key that stays correct across midnight: recomputed on a timer aimed at
 * the next local midnight, and again whenever the app returns to the foreground
 * (covers the case where the device slept through the timer).
 */
function useTodayKey(): string {
  const [today, setToday] = useState(todayKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNextTick = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => {
        setToday(todayKey());
        scheduleNextTick();
      }, nextMidnight.getTime() - now.getTime());
    };
    scheduleNextTick();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setToday(todayKey());
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  ring: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  list: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
