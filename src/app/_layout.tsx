import * as Notifications from 'expo-notifications';
import { router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Suspense, useEffect } from 'react';

import { fontFamily } from '@/constants/design-tokens';
import { DatabaseProvider } from '@/db/provider';
import { useNavigationTheme, useTheme } from '@/hooks/use-theme';
// Side effect: registers the foreground notification handler on import.
import '@/lib/notifications';

/**
 * Without an anchor a route opened directly — a deep link, or a notification tap —
 * has no tab stack underneath, so the back gesture leads nowhere.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already visible or already hidden (fast refresh, dev client reload).
});

export default function RootLayout() {
  const { colors } = useTheme();
  const navigationTheme = useNavigationTheme();

  useEffect(() => {
    // The window behind the React root; without it a system-coloured frame shows
    // through on cold start and during rotation.
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="auto" />
      <Suspense fallback={null}>
        <DatabaseProvider>
          <RootStack />
        </DatabaseProvider>
      </Suspense>
    </ThemeProvider>
  );
}

function RootStack() {
  const { colors } = useTheme();

  // Hidden from here, not from RootLayout: stage 2 wraps this component in
  // <Suspense><SQLiteProvider useSuspense>, so the effect then runs only once the
  // database is open and the splash never uncovers an empty frame.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // A tap opens "Today" from both cold start and background: getLastNotificationResponse
  // covers the cold-start case, which the response listener alone would miss entirely.
  useEffect(() => {
    const goToToday = () => router.navigate('/');

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      goToToday();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(goToToday);
    return () => subscription.remove();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.textPrimary, fontFamily },
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="habit/new"
        options={{ presentation: 'modal', headerShown: true, title: 'Новая привычка' }}
      />
      <Stack.Screen
        name="habit/[id]"
        options={{ presentation: 'modal', headerShown: true, title: 'Изменить привычку' }}
      />
    </Stack>
  );
}
