/**
 * Fixed emoji set for the picker grid — no free text entry, so every habit's and every
 * expense category's `emoji` is exactly one of these. The name predates expense
 * categories; the grid is one set because `emoji-picker.tsx` is shared by both forms.
 *
 * The last six were added for the seeded expense categories: an emoji the grid doesn't
 * hold could not be shown as selected when its category is edited.
 */
export const HABIT_EMOJIS = [
  '💪',
  '🏃',
  '🚴',
  '🏋️',
  '🧘',
  '⚽️',
  '🏊',
  '🚶',
  '📚',
  '✍️',
  '🎨',
  '🎸',
  '🎹',
  '🗣️',
  '💻',
  '🧠',
  '💧',
  '🥗',
  '🍎',
  '☕️',
  '🚭',
  '🍺',
  '😴',
  '⏰',
  '🧹',
  '🧺',
  '🧾',
  '🪥',
  '🧴',
  '🌱',
  '☀️',
  '🌙',
  '💰',
  '📅',
  '🙏',
  '❤️',
  '🎯',
  '✅',
  '🐾',
  '📵',
  '💊',
  '🏠',
  '🎬',
  '🛍️',
  '🚌',
  '📦',
] as const;

/**
 * What a form starts on before the user picks. They differ because the grid is ordered
 * for habits: its first entry is 💪, which is a fine default for a habit and a strange
 * one for a spending category — a new category opened on "flex" until this existed.
 */
export const DEFAULT_HABIT_EMOJI = HABIT_EMOJIS[0];
export const DEFAULT_CATEGORY_EMOJI = '🧾';

