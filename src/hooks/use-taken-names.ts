import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import { listExpenseCategoryNames } from '@/db/expense-categories-repo';
import { listHabitNames } from '@/db/habits-repo';
import { useI18n } from '@/hooks/use-i18n';
import { categoryName } from '@/lib/category-name';
import { normalizeName } from '@/lib/name-match';

type NamedRow = { id: string; name: string };

/**
 * The names a form must not reuse, normalized for comparison.
 *
 * Read straight from the repository rather than from the store: the store holds whatever
 * scope the screen that filled it asked for — usually active rows only — and a name is
 * taken by an archived row just as much as by a visible one.
 *
 * Loaded once when the form opens. The forms live in modals over a list the user just
 * came from, so nothing can add a name behind their back while one is open.
 */
function useNamedRows(load: (db: ReturnType<typeof useSQLiteContext>) => Promise<NamedRow[]>) {
  const db = useSQLiteContext();
  const [rows, setRows] = useState<NamedRow[]>([]);

  useEffect(() => {
    let active = true;
    load(db)
      .then((loaded) => {
        if (active) setRows(loaded);
      })
      // A failed read must not block saving: the worst case is a duplicate that the
      // check would have caught, which is better than a form that cannot be submitted.
      .catch((error) => console.warn('Failed to load existing names', error));
    return () => {
      active = false;
    };
  }, [db, load]);

  return rows;
}

/** Habit names in use, excluding the habit being edited. */
export function useTakenHabitNames(excludeId?: string): string[] {
  const rows = useNamedRows(listHabitNames);
  return useMemo(
    () => rows.filter((row) => row.id !== excludeId).map((row) => normalizeName(row.name)),
    [rows, excludeId]
  );
}

/** Category names in use, excluding the category being edited. */
export function useTakenCategoryNames(excludeId?: string): string[] {
  const { t } = useI18n();
  const rows = useNamedRows(listExpenseCategoryNames);
  return useMemo(
    () =>
      rows
        .filter((row) => row.id !== excludeId)
        // Both the stored name and the displayed one: a starter category stored as "Еда"
        // reads as "Food" in an English UI, and typing either of those is a duplicate of
        // the same row from the user's point of view.
        .flatMap((row) => {
          const stored = normalizeName(row.name);
          const shown = normalizeName(categoryName(row.name, t));
          return stored === shown ? [stored] : [stored, shown];
        }),
    [rows, excludeId, t]
  );
}
