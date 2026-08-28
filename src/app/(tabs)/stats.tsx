import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';

export default function StatsScreen() {
  return (
    <Screen>
      <Text variant="title1" style={styles.title}>
        Статистика
      </Text>
      <EmptyState
        icon="chart.bar"
        title="Пока нет данных"
        subtitle="Статистика появится, когда вы начнёте отмечать привычки"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
