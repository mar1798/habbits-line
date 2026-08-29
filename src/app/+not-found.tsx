import { Stack, router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';

export default function NotFoundScreen() {
  const { t } = useI18n();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('not_found_title') }} />
      <Screen edges={['bottom']} style={styles.container}>
        <EmptyState
          icon="questionmark.circle"
          title={t('not_found_heading')}
          subtitle={t('not_found_subtitle')}
        />
        <Button title={t('not_found_action')} onPress={() => router.replace('/')} />
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
