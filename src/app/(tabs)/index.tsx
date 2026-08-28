import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';

export default function TodayScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title1">Сегодня</Text>
        <IconButton
          name="plus"
          accessibilityLabel="Добавить привычку"
          onPress={() => router.push('/habit/new')}
        />
      </View>
      <EmptyState
        icon="checkmark.circle"
        title="Привычек пока нет"
        subtitle="Нажмите «+», чтобы добавить первую привычку"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
