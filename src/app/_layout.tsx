import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
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
    </ThemeProvider>
  );
}
