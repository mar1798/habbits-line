import { useCallback } from 'react';

import { formatAmount } from '@/lib/money';
import { useSettingsStore } from '@/store/settings-store';

/**
 * `formatAmount` with the currency the user set, for everything inside the component tree.
 *
 * A hook rather than a global read, for the reason `useI18n` is one: changing the symbol in
 * settings has to repaint every amount on every screen without a restart, and only a
 * subscription does that. The store holds one `Currency` object and replaces it as a whole,
 * so the returned formatter keeps its identity until the setting actually changes — it ends
 * up in the dependency lists of the memoized rows and labels that use it.
 */
export function useMoney(): (value: number) => string {
  const currency = useSettingsStore((state) => state.currency);
  return useCallback((value: number) => formatAmount(value, currency), [currency]);
}
