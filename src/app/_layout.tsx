import * as Notifications from 'expo-notifications';
import { router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useSQLiteContext } from 'expo-sqlite';
import * as SystemUI from 'expo-system-ui';
import { Suspense, useEffect } from 'react';

import { IconButton } from '@/components/ui/icon-button';
import { fontFamily } from '@/constants/design-tokens';
import { DatabaseProvider } from '@/db/provider';
import { useNavigationTheme, useTheme } from '@/hooks/use-theme';
// Importing this module also registers the foreground notification handler.
import { useReminderSync } from '@/lib/notifications';
import { useSettingsStore } from '@/store/settings-store';

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
  const { colors, scheme } = useTheme();
  const navigationTheme = useNavigationTheme();

  useEffect(() => {
    // The window behind the React root; without it a system-coloured frame shows
    // through on cold start and during rotation.
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  return (
    <ThemeProvider value={navigationTheme}>
      {/* Not "auto": that follows the OS scheme, which the theme setting can override. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
  const db = useSQLiteContext();
  const loadSettings = useSettingsStore((state) => state.load);

  // Hidden from here, not from RootLayout: stage 2 wraps this component in
  // <Suspense><SQLiteProvider useSuspense>, so the effect then runs only once the
  // database is open and the splash never uncovers an empty frame.
  //
  // It also waits on the stored theme — until that row is read the app renders in the
  // system scheme, and a user who chose the other one would see a frame of the wrong
  // theme. A failed read is not worth holding the splash for: the default is 'system'.
  useEffect(() => {
    loadSettings(db)
      .catch((error) => console.warn('Failed to load settings', error))
      .finally(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
  }, [db, loadSettings]);

  // A tap opens "Today" from both cold start and background: getLastNotificationResponse
  // covers the cold-start case, which the response listener alone would miss entirely.
  // It keeps returning that same response on every later launch, so it is cleared once
  // handled — otherwise a single tap would redirect every cold start from then on.
  useEffect(() => {
    const goToToday = () => router.navigate('/');

    if (Notifications.getLastNotificationResponse()) {
      goToToday();
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(goToToday);
    return () => subscription.remove();
  }, []);

  // Repairs a schedule that iOS refused while the permission was denied, once it is
  // granted (and re-asserts it at launch). Lives here because the root stack is the one
  // place mounted for the whole app lifetime.
  useReminderSync(db);

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
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Новая привычка',
          headerRight: ModalCloseButton,
        }}
      />
      <Stack.Screen
        name="habit/[id]"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Изменить привычку',
          headerRight: ModalCloseButton,
        }}
      />
    </Stack>
  );
}

/**
 * Modal routes otherwise close only by dragging the sheet down — a gesture with nothing
 * on screen to announce it, and one VoiceOver users cannot perform at all.
 *
 * On the right, where iOS puts the dismiss control of a sheet, and as a filled glyph
 * rather than a word: it is the same close affordance on both modals and takes far less
 * of the header than "Отмена" did.
 */
function ModalCloseButton() {
  const { colors } = useTheme();

  return (
    <IconButton
      name="xmark"
      compact
      onPress={() => router.back()}
      accessibilityLabel="Закрыть"
      color={colors.textSecondary}
    />
  );
}
