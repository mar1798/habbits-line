/**
 * The two plural rules the app needs. They stay separate functions on purpose: English
 * has two forms and Russian three, and a shared signature taking `one / few / many`
 * would make every English call site carry a form the language does not have.
 */

export type RussianForms = { one: string; few: string; many: string };
export type EnglishForms = { one: string; other: string };

/**
 * 1, 21, 31 → `one`; 2–4, 22–24 → `few`; everything else, including the whole 11–14
 * band, → `many`.
 */
export function russianPlural(n: number, forms: RussianForms): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return forms.one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms.few;
  return forms.many;
}

/** 1 → `one`, everything else (0 included) → `other`. */
export function englishPlural(n: number, forms: EnglishForms): string {
  return Math.abs(Math.trunc(n)) === 1 ? forms.one : forms.other;
}
