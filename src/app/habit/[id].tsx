import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen style={styles.container}>
      <Text variant="body">Форма редактирования привычки (id: {id}) появится на этапе 4.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
});
