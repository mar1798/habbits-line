/**
 * What the OS is asked to schedule, worked out from the habits alone — pure, so the rule
 * that decides how many notification slots the app spends can be tested without
 * expo-notifications. lib/notifications.ts turns a plan into requests.
 */

import { maskToDays } from './schedule';

const DAYS_IN_WEEK = 7;

/** The fields of a habit a reminder is built from. */
export interface ReminderHabit {
  id: string;
  name: string;
  emoji: string;
  /** `HH:mm`; a habit without one has no reminders and never reaches here. */
  reminder_time: string;
  schedule_mask: number;
}

/** One habit inside a plan, in the order the habit list has it. */
export interface ReminderSubject {
  id: string;
  name: string;
  emoji: string;
}

export interface ReminderPlan {
  /** `HH:mm`, kept for the notification's own text. */
  time: string;
  hour: number;
  minute: number;
  /** Weekday bit 0 (Monday) .. 6 (Sunday), or null for a plan that fires every day. */
  bit: number | null;
  /** Never empty. One subject means a reminder for that habit, several a joint one. */
  subjects: ReminderSubject[];
}

/**
 * Every habit due at the same time on the same day in **one** notification instead of one
 * each.
 *
 * iOS keeps ~64 scheduled requests and drops the rest silently, and the old rule spent one
 * per habit per weekday — twelve habits reminding at 9:00 on weekdays cost sixty slots and
 * pushed everything after them off the schedule. Grouping by time makes the cost depend on
 * how many distinct times the user reminds at, not on how many habits they keep: at most
 * seven requests per time, whatever the number of habits.
 *
 * A time whose habits are the same set on all seven days collapses further into a single
 * DAILY plan, which is what the previous "all seven days is one trigger" rule did for a
 * lone habit — that case still produces exactly one plan, so nothing changed for it.
 *
 * Habits keep the order they came in (the list is ordered by `sort_order`), so the joint
 * notification reads in the same order as the "Today" screen. Times are emitted in the
 * order they first appear for the same reason: a stable plan makes the tests readable, and
 * the OS does not care.
 */
export function buildReminderPlans(habits: ReminderHabit[]): ReminderPlan[] {
  const byTime = new Map<string, ReminderHabit[]>();
  for (const habit of habits) {
    const group = byTime.get(habit.reminder_time);
    if (group) {
      group.push(habit);
    } else {
      byTime.set(habit.reminder_time, [habit]);
    }
  }

  const plans: ReminderPlan[] = [];
  for (const [time, group] of byTime) {
    const [hour, minute] = time.split(':').map(Number);

    // Bit 0 (Monday) .. bit 6 (Sunday) — the numbering of `schedule_mask`.
    const perDay: ReminderSubject[][] = Array.from({ length: DAYS_IN_WEEK }, () => []);
    for (const habit of group) {
      const subject = { id: habit.id, name: habit.name, emoji: habit.emoji };
      for (const bit of maskToDays(habit.schedule_mask)) {
        perDay[bit].push(subject);
      }
    }

    if (isEveryDayAlike(perDay)) {
      plans.push({ time, hour, minute, bit: null, subjects: perDay[0] });
      continue;
    }

    for (const [bit, subjects] of perDay.entries()) {
      if (subjects.length > 0) {
        plans.push({ time, hour, minute, bit, subjects });
      }
    }
  }

  return plans;
}

/**
 * Whether all seven days carry the same habits in the same order — the condition for one
 * DAILY request instead of seven weekly ones. Compared by id: the arrays hold the same
 * subject objects, but identity would be an accident of how they were built.
 */
function isEveryDayAlike(perDay: ReminderSubject[][]): boolean {
  const first = perDay[0];
  if (first.length === 0) return false;

  return perDay.every(
    (day) =>
      day.length === first.length && day.every((subject, index) => subject.id === first[index].id)
  );
}
