import type { MessageKey } from '@/i18n';

/**
 * The eight starter categories seeded by the v1 -> v2 migration, keyed by the Russian
 * name they were written with.
 *
 * Categories are user data and their names are stored, not translated — but the starter
 * eight were never typed by anyone, so leaving them Russian in an English UI reads as a
 * bug rather than as respect for the user's words. Matching on the stored name keeps the
 * database untouched and makes renaming the natural opt-out: the moment the row's name
 * stops being one of these, it is the user's own and is shown verbatim ever after.
 *
 * The cost of matching on the name is that a hand-made category called exactly "Еда" is
 * translated too. That is the accepted trade for not carrying a `seed_key` column
 * through the schema, the backup format and its validation.
 */
const SEED_CATEGORY_KEYS: Record<string, MessageKey> = {
  Здоровье: 'category_seed_health',
  Досуг: 'category_seed_leisure',
  Дом: 'category_seed_home',
  Еда: 'category_seed_food',
  Развлечение: 'category_seed_entertainment',
  Покупки: 'category_seed_shopping',
  Транспорт: 'category_seed_transport',
  Прочее: 'category_seed_other',
};

/**
 * What to show for a category's name: the translation for a starter category, the stored
 * name for everything else. Every place a category is named goes through this — including
 * the edit form's initial value, so what the user sees is what they edit.
 */
export function categoryName(name: string, t: (key: MessageKey) => string): string {
  const key = SEED_CATEGORY_KEYS[name];
  return key ? t(key) : name;
}
