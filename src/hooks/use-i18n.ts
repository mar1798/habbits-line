import type { Locale } from 'date-fns';

import {
  dateLocale,
  pluralize,
  translate,
  weekdayLabels,
  type Language,
  type MessageKey,
  type MessageParams,
  type PluralKey,
} from '@/i18n';
import type { WeekdayLabels } from '@/i18n/ru';
import { useSettingsStore } from '@/store/settings-store';

type I18n = {
  language: Language;
  /** A translated message, with `{placeholder}` slots filled from `params`. */
  t: (key: MessageKey, params?: MessageParams) => string;
  /** The plural form of a noun for `n`, to be passed back into `t` as a parameter. */
  plural: (key: PluralKey, n: number) => string;
  /** date-fns locale — for `format` only, never for week arithmetic. See i18n/index.ts. */
  locale: Locale;
  weekdays: WeekdayLabels;
};

/**
 * One frozen bundle per language, built on first use. Identity matters: `t` and `locale`
 * end up in the dependency lists of the stats chips and the heatmap grid, and a fresh
 * closure on every render would rebuild both every time. There are two languages, so the
 * cache holds at most two entries for the life of the process.
 */
const BUNDLES = new Map<Language, I18n>();

function bundle(language: Language): I18n {
  const cached = BUNDLES.get(language);
  if (cached) return cached;

  const created: I18n = {
    language,
    t: (key, params) => translate(language, key, params),
    plural: (key, n) => pluralize(language, key, n),
    locale: dateLocale(language),
    weekdays: weekdayLabels(language),
  };
  BUNDLES.set(language, created);
  return created;
}

/**
 * Everything inside the component tree reads the language through this hook, so
 * switching it repaints the UI without a restart. Code outside the tree
 * (lib/notifications.ts) reads `useSettingsStore.getState().language` instead.
 */
export function useI18n(): I18n {
  return bundle(useSettingsStore((state) => state.language));
}
