import { StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';

export default function NewHabitScreen() {
  return (
    <Screen style={styles.container}>
      <Text variant="body">Форма создания привычки появится на этапе 4.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },
});
