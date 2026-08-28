import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';
import {
  getScheduledCountAsync,
  NOTIFICATION_WARNING_THRESHOLD,
  useNotificationPermissionStatus,
} from '@/lib/notifications';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const permission = useNotificationPermissionStatus();
  const [scheduledCount, setScheduledCount] = useState(0);

  // Re-read on every focus: a reminder saved on another screen recomputes the
  // schedule after this tab has already mounted.
  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    getScheduledCountAsync().then((count) => {
      if (!cancelled) setScheduledCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  return (
    <Screen>
      <Text variant="title1" style={styles.title}>
        Настройки
      </Text>

      {permission === 'denied' ? (
        <Card style={styles.banner}>
          <Text variant="body">
            Уведомления запрещены в настройках iOS — напоминания не будут приходить.
          </Text>
          <Button title="Открыть настройки" variant="secondary" onPress={() => Linking.openSettings()} />
        </Card>
      ) : null}

      {scheduledCount >= NOTIFICATION_WARNING_THRESHOLD ? (
        <Card style={styles.banner}>
          <Text variant="body" color={colors.warning}>
            Запланировано {scheduledCount} напоминаний — iOS ограничивает их число, часть новых
            может не встать в расписание
          </Text>
        </Card>
      ) : null}

      <EmptyState
        icon="gearshape"
        title="Остальные настройки скоро появятся"
        subtitle="Архив, порядок привычек и экспорт — на следующих этапах"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  banner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.md,
  },
});
