import { Stack, router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { spacing } from '@/constants/design-tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Не найдено' }} />
      <Screen edges={['bottom']} style={styles.container}>
        <EmptyState
          icon="questionmark.circle"
          title="Экран не найден"
          subtitle="Возможно, ссылка устарела"
        />
        <Button title="На главную" onPress={() => router.replace('/')} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
});
