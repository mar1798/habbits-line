import type { Locale } from 'date-fns';
// Deep imports, not `date-fns/locale`: that barrel re-exports every locale date-fns
// ships and pulls all of them into the bundle.
import { enUS } from 'date-fns/locale/en-US';
import { ru as ruDateLocale } from 'date-fns/locale/ru';

import { en, enPlurals, enWeekdays } from './en';
import { englishPlural, russianPlural } from './plural';
import { ru, ruPlurals, ruWeekdays, type WeekdayLabels } from './ru';

/**
 * Russian is the default; English is a deliberate choice in settings. There is no
 * "follow the system" mode — this is a personal app whose first language is Russian,
 * and a third value would only add a state to test for no one it serves.
 */
export type Language = 'ru' | 'en';

export const LANGUAGES: readonly Language[] = ['ru', 'en'];

export const DEFAULT_LANGUAGE: Language = 'ru';

/** Anything else in the row (older build, hand-edited file) falls back to Russian. */
export function parseLanguage(value: string | null): Language {
  return LANGUAGES.includes(value as Language) ? (value as Language) : DEFAULT_LANGUAGE;
}

export type MessageKey = keyof typeof ru;
export type PluralKey = keyof typeof ruPlurals;

/** Values substituted into a message's `{placeholder}` slots. */
export type MessageParams = Record<string, string | number>;

const MESSAGES: Record<Language, Record<MessageKey, string>> = { ru, en };

const PLACEHOLDER = /\{(\w+)\}/g;

/**
 * A message with its placeholders filled in. An unknown placeholder is left as-is
 * rather than blanked: it shows up in the UI as `{name}`, which is what a missing
 * parameter should look like while it is still a bug.
 */
export function translate(
  language: Language,
  key: MessageKey,
  params?: MessageParams
): string {
  const message = MESSAGES[language][key];
  if (!params) return message;
  return message.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

/** The plural form of `key` for `n` — the noun alone, to be substituted into a message. */
export function pluralize(language: Language, key: PluralKey, n: number): string {
  return language === 'ru'
    ? russianPlural(n, ruPlurals[key])
    : englishPlural(n, enPlurals[key]);
}

/**
 * The date-fns locale used for *formatting only*. It never reaches `startOfWeek` or any
 * other arithmetic in lib/date.ts: `enUS` starts its week on Sunday, and a locale that
 * leaked into the arithmetic would shift the day strip, the heatmap grid and the meaning
 * of `schedule_mask`, where bit 0 is Monday.
 */
export function dateLocale(language: Language): Locale {
  return language === 'ru' ? ruDateLocale : enUS;
}

export function weekdayLabels(language: Language): WeekdayLabels {
  return language === 'ru' ? ruWeekdays : enWeekdays;
}
