import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';

export default function SettingsScreen() {
  return (
    <Screen>
      <Text variant="title1" style={styles.title}>
        Настройки
      </Text>
      <EmptyState icon="gearshape" title="Настроек пока нет" subtitle="Они появятся на следующих этапах" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
