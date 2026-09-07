import type { ColorKey } from '@/constants/design-tokens';
import type { MessageKey } from '@/i18n';

/**
 * Starter habits offered on the empty "Today" screen. Unlike the eight expense
 * categories, these are not seeded by a migration: a habit the user never asked for
 * would sit in their list with a streak of its own, and archiving all of them could not
 * bring them back. They are a one-tap offer instead, shown only while the list is empty.
 *
 * The name is stored in the language the UI was in when the template was tapped, and is
 * plain user data from that moment on — there is no `category-name.ts`-style translation
 * map behind it. The user picked a word they had read; rewriting it later, when they
 * switch the language, would rename a habit they consider theirs.
 *
 * Every template is scheduled on all seven days on purpose. A template limited to, say,
 * Mon/Wed/Fri would create a habit that is not scheduled for today — and the tap would
 * look like it did nothing, since the screen would swap one empty state for another.
 */
export type HabitTemplate = {
  /** Stable key for React and for the pending-tap guard; never stored. */
  id: string;
  nameKey: MessageKey;
  emoji: string;
  colorKey: ColorKey;
  targetPerDay: number;
};

const EVERY_DAY_MASK = 127;

export const HABIT_TEMPLATE_SCHEDULE_MASK = EVERY_DAY_MASK;

export const HABIT_TEMPLATES: readonly HabitTemplate[] = [
  { id: 'water', nameKey: 'today_template_water', emoji: '💧', colorKey: 'sky', targetPerDay: 8 },
  { id: 'steps', nameKey: 'today_template_steps', emoji: '🚶', colorKey: 'green', targetPerDay: 1 },
  {
    id: 'reading',
    nameKey: 'today_template_reading',
    emoji: '📚',
    colorKey: 'indigo',
    targetPerDay: 1,
  },
  {
    id: 'vitamins',
    nameKey: 'today_template_vitamins',
    emoji: '💊',
    colorKey: 'amber',
    targetPerDay: 1,
  },
  {
    id: 'exercise',
    nameKey: 'today_template_exercise',
    emoji: '💪',
    colorKey: 'coral',
    targetPerDay: 1,
  },
  {
    id: 'meditation',
    nameKey: 'today_template_meditation',
    emoji: '🧘',
    colorKey: 'teal',
    targetPerDay: 1,
  },
] as const;
