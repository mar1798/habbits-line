import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getEntry, setEntryCount } from '@/db/entries-repo';
import { getHabit, listHabits } from '@/db/habits-repo';
import type { HabitRow } from '@/db/types';
import { translate } from '@/i18n';
import { isValidTimeOfDay, toDateKey, todayKey } from '@/lib/date';
import { bitToAppleWeekday, maskToDays } from '@/lib/schedule';
import { useEntriesStore } from '@/store/entries-store';
import { useSettingsStore } from '@/store/settings-store';

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
 * Current status, prompting only when asked to and only while the user has not answered
 * yet — iOS shows its dialog once per install, so a repeat request after a denial
 * returns `denied` without showing anything.
 */
async function ensurePermissionAsync(request: boolean): Promise<PermissionStatus> {
  const current = await getPermissionStatusAsync();
  if (current === 'granted' || !request) {
    return current;
  }
  return requestPermissionsAsync();
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

/**
 * The category carrying the banner's "Mark" button. iOS matches a delivered notification
 * to it by this string, so it must not contain `:` or `-` — the docs single those two out
 * as characters that silently break the match.
 */
export const REMINDER_CATEGORY_ID = 'habitreminder';

/** `actionIdentifier` of a response that came from that button rather than from a tap. */
export const MARK_ACTION_ID = 'mark';

/**
 * (Re)declares the category. Like a notification's body, the button title is read by iOS
 * from what was registered, so a language switch has to run this again — which it does,
 * through the same full recompute that rewrites the bodies.
 */
async function registerReminderCategoryAsync(): Promise<void> {
  const { language } = useSettingsStore.getState();
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
    {
      identifier: MARK_ACTION_ID,
      buttonTitle: translate(language, 'notification_action_mark'),
      // The whole point of the button is to save the trip into the app; foregrounding
      // would put that trip back.
      options: { opensAppToForeground: false },
    },
  ]);
}

/**
 * The body is baked into the trigger at scheduling time, so it is written in the
 * language selected right now — which is why changing the language recomputes the whole
 * schedule (see `setLanguage`). This module lives outside the component tree, so it
 * reads the store directly instead of going through `useI18n`.
 */
function buildContent(habit: HabitRow): Notifications.NotificationContentInput {
  const { language } = useSettingsStore.getState();
  return {
    title: `${habit.emoji} ${habit.name}`,
    body: translate(language, 'notification_body'),
    categoryIdentifier: REMINDER_CATEGORY_ID,
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
  const reminderTime = habit.reminder_time;
  // Import validates this shape, but a row written by an older build could still hold
  // something else, and a NaN hour aborts the whole recompute — taking every habit
  // after this one down with it. Skipping one habit's reminders is the smaller loss.
  if (reminderTime === null || !isValidTimeOfDay(reminderTime)) {
    console.warn(`Skipping reminders for habit ${habit.id}: bad reminder_time`);
    return 0;
  }

  const [hour, minute] = reminderTime.split(':').map(Number);
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
 * `requestPermission` belongs to a save, not to a background resync: the OS prompt
 * should appear on the first habit that ends up with a reminder — created or edited
 * into one — and never on its own during launch.
 */
export function scheduleAllReminders(
  db: SQLiteDatabase,
  options: { requestPermission?: boolean } = {}
): Promise<number> {
  const run = async () => {
    const habits = await listHabits(db, { includeArchived: false });
    const withReminders = habits.filter((habit) => habit.reminder_time !== null);

    await Notifications.cancelAllScheduledNotificationsAsync();
    if (withReminders.length === 0) {
      return 0;
    }

    // iOS rejects every request scheduled without authorization, so going ahead while
    // denied would only produce errors; the habit keeps its time and the banner in the
    // form and in settings explains why nothing arrives.
    const status = await ensurePermissionAsync(options.requestPermission ?? false);
    if (status !== 'granted') {
      return 0;
    }

    // Failing to declare the category costs the button, not the reminders — so it is
    // logged and stepped over rather than taking the whole recompute down.
    try {
      await registerReminderCategoryAsync();
    } catch (error) {
      console.warn('Failed to register the reminder notification category', error);
    }

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

/**
 * Writes the mark behind the banner's "Mark" button: one step towards the habit's
 * target, never the wrap back to 0 that the check button does — a banner offers no way
 * to see that a press has just cleared the day, so the action only ever adds.
 *
 * Dated by when the reminder was *delivered*, not by today. With no background task
 * registered (that would mean `expo-task-manager`), a press that lands while the app is
 * not running is only seen at the next launch, through `getLastNotificationResponse` —
 * which can be days later, and `todayKey()` would then mark the wrong day.
 *
 * `notification.date` is seconds on iOS (`timeIntervalSince1970`, no `* 1000` in the
 * native record) even though the type is the same `number` Android fills with
 * milliseconds. This app is iOS-only; anything unusable falls back to today.
 */
export async function applyReminderMark(
  db: SQLiteDatabase,
  response: Notifications.NotificationResponse
): Promise<void> {
  const habitId = response.notification.request.content.data?.habitId;
  if (typeof habitId !== 'string') return;

  const deliveredAt = response.notification.date;
  const date =
    Number.isFinite(deliveredAt) && deliveredAt > 0
      ? toDateKey(new Date(deliveredAt * 1000))
      : todayKey();

  // The habit can have been deleted or archived between the reminder being delivered
  // and the press being handled.
  const habit = await getHabit(db, habitId);
  if (habit === null || habit.archived_at !== null) return;

  const current = (await getEntry(db, habitId, date))?.count ?? 0;
  if (current >= habit.target_per_day) return;
  await setEntryCount(db, habitId, date, current + 1);

  // The write went around the entries store, so the visible week has to be re-read —
  // the same reason an import ends with a reload. A no-op while no week is loaded yet,
  // which is the cold-start case: the screen reads the row itself when it mounts.
  await useEntriesStore.getState().reload(db);
}

/**
 * Keeps the OS schedule in step with the database at launch and on the foreground that
 * follows a permission change. Without it, scheduling only ever runs on a habit
 * mutation: a user who denied the prompt, flipped the switch in iOS Settings and came
 * back would have no reminders at all until the next time they edited a habit, because
 * everything scheduled while denied was rejected by iOS.
 *
 * Recomputes only when the status just became `granted` (the mount check counts as a
 * change), so an ordinary foreground costs one permission read.
 */
export function useReminderSync(db: SQLiteDatabase): void {
  useEffect(() => {
    let cancelled = false;
    let lastStatus: PermissionStatus | null = null;

    const sync = async () => {
      const status = await getPermissionStatusAsync();
      const becameGranted = status === 'granted' && status !== lastStatus;
      lastStatus = status;
      if (cancelled || !becameGranted) return;

      try {
        await scheduleAllReminders(db);
      } catch (error) {
        console.error('Failed to sync reminders', error);
      }
    };

    sync();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [db]);
}
