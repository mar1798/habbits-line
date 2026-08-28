import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey } from '@/lib/date';

/**
 * Local-date key that stays correct across midnight: recomputed on a timer aimed at
 * the next local midnight, and again whenever the app returns to the foreground
 * (covers the case where the device slept through the timer).
 *
 * Shared by every screen that has a notion of "today": a screen that captured the key
 * once at mount would keep marking yesterday as today after a rollover — on "Today"
 * the whole day strip, on "Statistics" the streak cut-off and the heatmap's last cell.
 */
export function useTodayKey(): string {
  const [today, setToday] = useState(todayKey());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNextTick = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => {
        setToday(todayKey());
        scheduleNextTick();
      }, nextMidnight.getTime() - now.getTime());
    };
    scheduleNextTick();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setToday(todayKey());
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
