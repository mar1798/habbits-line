import { SymbolView } from 'expo-symbols';
import { SQLiteProvider } from 'expo-sqlite';
import { Component, type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

import { migrate } from './migrations';

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <DatabaseErrorBoundary>
      <SQLiteProvider databaseName="habits.db" onInit={migrate} useSuspense>
        {children}
      </SQLiteProvider>
    </DatabaseErrorBoundary>
  );
}

type BoundaryState = { error: Error | null };

/**
 * A failed migration (corrupt file, disk full) throws inside SQLiteProvider's
 * suspenseful open — uncaught, that's a blank white screen with no way back in,
 * since nothing below this point ever mounts to explain what happened.
 */
class DatabaseErrorBoundary extends Component<PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Database failed to open', error);
  }

  render(): ReactNode {
    return this.state.error ? <DatabaseErrorScreen /> : this.props.children;
  }
}

function DatabaseErrorScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SymbolView name="exclamationmark.triangle" size={40} tintColor={colors.danger} />
      <Text variant="headline" style={styles.title}>
        Не удалось открыть базу данных
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
        Попробуйте перезапустить приложение. Если это повторится, данные могли повредиться.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
});
