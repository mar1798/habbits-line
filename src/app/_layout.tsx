import * as Notifications from 'expo-notifications';
import { router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useSQLiteContext } from 'expo-sqlite';
import * as SystemUI from 'expo-system-ui';
import { Suspense, useEffect } from 'react';
import { Appearance, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { IconButton } from '@/components/ui/icon-button';
import { fontFamily } from '@/constants/design-tokens';
import { DatabaseProvider } from '@/db/provider';
import { useI18n } from '@/hooks/use-i18n';
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
  const themeMode = useSettingsStore((state) => state.themeMode);

  useEffect(() => {
    // The window behind the React root; without it a system-coloured frame shows
    // through on cold start and during rotation.
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  // Everything iOS draws itself — the long-press context menus on the habit and expense
  // rows, Alert, the keyboard — reads the window's interface style, not our tokens. With
  // the theme set to Dark on a phone left in Light, those all came up light on top of a
  // dark app. 'unspecified' is this API's way of handing the decision back to the OS,
  // which is also what keeps `useColorScheme` in useTheme meaningful in 'system' mode.
  useEffect(() => {
    Appearance.setColorScheme(themeMode === 'system' ? 'unspecified' : themeMode);
  }, [themeMode]);

  return (
    // Gesture handler does nothing, and says nothing, without a root view of its own —
    // the week strip's swipe is the first gesture in the app that needs it.
    <GestureHandlerRootView style={styles.root}>
      {/* The keyboard bar over the amount fields reads its position from here. */}
      <KeyboardProvider>
        <ThemeProvider value={navigationTheme}>
          {/* Not "auto": that follows the OS scheme, which the theme setting can override. */}
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Suspense fallback={null}>
            <DatabaseProvider>
              <RootStack />
            </DatabaseProvider>
          </Suspense>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const db = useSQLiteContext();
  const loadSettings = useSettingsStore((state) => state.load);

  // Hidden from here, not from RootLayout: stage 2 wraps this component in
  // <Suspense><SQLiteProvider useSuspense>, so the effect then runs only once the
  // database is open and the splash never uncovers an empty frame.
  //
  // It also waits on the stored theme and language — until those rows are read the app
  // renders in the system scheme and in Russian, and a user who chose otherwise would
  // see a frame of the wrong one. A failed read is not worth holding the splash for:
  // the defaults are 'system' and Russian.
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
          title: t('habit_new_title'),
          headerRight: ModalCloseButton,
        }}
      />
      <Stack.Screen
        name="habit/[id]"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: t('habit_edit_title'),
          headerRight: ModalCloseButton,
        }}
      />
      <Stack.Screen
        name="expense/new"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: t('expense_new_title'),
          headerRight: ModalCloseButton,
        }}
      />
      <Stack.Screen
        name="expense/[id]"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: t('expense_edit_title'),
          headerRight: ModalCloseButton,
        }}
      />
      <Stack.Screen
        name="expense/budget"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: t('expense_budget_title'),
          headerRight: ModalCloseButton,
        }}
      />
      <Stack.Screen
        name="expense-category/new"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: t('category_new_title'),
          headerRight: ModalCloseButton,
        }}
      />
      <Stack.Screen
        name="expense-category/[id]"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: t('category_edit_title'),
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
 * of the header than a "Cancel" label did.
 */
function ModalCloseButton() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <IconButton
      name="xmark"
      compact
      onPress={() => router.back()}
      accessibilityLabel={t('close')}
      color={colors.textSecondary}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
