/**
 * Names are compared for "is this one already taken" case- and whitespace-insensitively:
 * "Пить воду" and "пить  воду " are the same habit to a person, and two rows that read
 * identically in the list are a bug the user cannot see the cause of.
 *
 * `toLocaleLowerCase` rather than SQL `LOWER()`: SQLite lowercases ASCII only, so a
 * comparison done in the query would treat "Еда" and "еда" as different names.
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** True when `name` collides with one of the already-normalized `takenNames`. */
export function isNameTaken(name: string, takenNames: readonly string[]): boolean {
  const normalized = normalizeName(name);
  return normalized.length > 0 && takenNames.includes(normalized);
}

/**
 * The rule the forms actually apply: a name blocks the save when it is another row's —
 * unless it is the one the form opened with.
 *
 * The exemption is what keeps an existing duplicate editable. Two rows can already read
 * the same: a build before this check wrote them, or an import brought them (the backup
 * format carries names verbatim and has no reason to rewrite the user's words). Without
 * the exemption, opening either one to change its emoji or its reminder would fail on a
 * name the user never touched, and the only way out would be renaming a habit they came
 * to edit for something else entirely.
 *
 * A translated starter category reaches the same state from a different direction: a
 * category typed as "Food" while the UI was Russian sits beside the seeded "Еда", which
 * an English UI then also shows as "Food". Neither was a duplicate when it was written.
 *
 * Comparing normalized forms rather than the raw strings means re-spacing a name — the
 * one edit that leaves it the same name — still counts as unchanged.
 */
export function isNameTakenByAnother(
  name: string,
  takenNames: readonly string[],
  initialName: string
): boolean {
  if (normalizeName(name) === normalizeName(initialName)) return false;
  return isNameTaken(name, takenNames);
}
