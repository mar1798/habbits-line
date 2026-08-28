import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { listHabits } from '@/db/habits-repo';
import type { HabitRow } from '@/db/types';
import { bitToAppleWeekday, maskToDays } from '@/lib/schedule';

/** Warn in settings when the scheduled count nears iOS's ~64-request ceiling. */
export const NOTIFICATION_WARNING_THRESHOLD = 55;

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

// Without a handler, a notification that arrives while the app is foregrounded is
// silently dropped instead of shown.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * iOS permissions are more granular than the root `status` — always read `ios.status`,
 * per the docs' warning that the root field alone misreports provisional/ephemeral
 * grants as ungranted.
 */
function toPermissionStatus(response: Notifications.NotificationPermissionsStatus): PermissionStatus {
  const iosStatus = response.ios?.status;
  switch (iosStatus) {
    case Notifications.IosAuthorizationStatus.AUTHORIZED:
    case Notifications.IosAuthorizationStatus.PROVISIONAL:
    case Notifications.IosAuthorizationStatus.EPHEMERAL:
      return 'granted';
    case Notifications.IosAuthorizationStatus.DENIED:
      return 'denied';
    default:
      return 'undetermined';
  }
}

export async function getPermissionStatusAsync(): Promise<PermissionStatus> {
  return toPermissionStatus(await Notifications.getPermissionsAsync());
}

async function requestPermissionsAsync(): Promise<PermissionStatus> {
  return toPermissionStatus(
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    })
  );
}

/**
 * Permission status that re-checks itself whenever the app returns to the foreground —
 * covers a user who denied at the prompt, went to iOS Settings to flip it, and came
 * back. A one-shot read at mount would keep showing the stale "denied" state.
 */
export function useNotificationPermissionStatus(): PermissionStatus {
  const [status, setStatus] = useState<PermissionStatus>('undetermined');

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      getPermissionStatusAsync().then((next) => {
        if (!cancelled) setStatus(next);
      });
    };
    check();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return status;
}

function buildContent(habit: HabitRow): Notifications.NotificationContentInput {
  return {
    title: `${habit.emoji} ${habit.name}`,
    body: 'Не забудьте отметить привычку сегодня',
    data: { habitId: habit.id },
  };
}

/**
 * One habit's reminders. A full 7-day schedule collapses to a single DAILY trigger
 * instead of seven WEEKLY/CALENDAR ones — see the iOS ~64-scheduled-notification
 * ceiling in PLAN.md. Returns how many notifications it scheduled, for the caller's
 * running total.
 */
async function scheduleForHabit(habit: HabitRow): Promise<number> {
  const [hour, minute] = habit.reminder_time!.split(':').map(Number);
  const days = maskToDays(habit.schedule_mask);
  const content = buildContent(habit);

  if (days.length === 7) {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
    });
    return 1;
  }

  for (const bit of days) {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        weekday: bitToAppleWeekday(bit),
        hour,
        minute,
        repeats: true,
      },
    });
  }
  return days.length;
}

// Serializes full recomputes: two saves in quick succession, or a save racing an
// import's recompute, must cancel-then-reschedule one at a time, not interleaved.
let schedulingChain: Promise<unknown> = Promise.resolve();

/**
 * Full recompute — cancels every scheduled notification and reschedules from the
 * current active habits. Called after any habit mutation (create, update, archive,
 * unarchive, delete) rather than patched incrementally, per PLAN.md: incremental
 * updates are the source of drift, and every notification in the app is ours, so
 * cancelling all of them is safe.
 *
 * Requests permission here, not at habit-creation time specifically, so the first
 * habit that ends up with a reminder — created or edited into one — is what triggers
 * the OS prompt.
 */
export function scheduleAllReminders(db: SQLiteDatabase): Promise<number> {
  const run = async () => {
    const habits = await listHabits(db, { includeArchived: false });
    const withReminders = habits.filter((habit) => habit.reminder_time !== null);

    await Notifications.cancelAllScheduledNotificationsAsync();
    if (withReminders.length === 0) {
      return 0;
    }

    await requestPermissionsAsync();

    let scheduledCount = 0;
    for (const habit of withReminders) {
      scheduledCount += await scheduleForHabit(habit);
    }
    return scheduledCount;
  };

  const result = schedulingChain.then(run, run);
  schedulingChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export async function getScheduledCountAsync(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}
