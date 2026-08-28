import { SymbolView } from 'expo-symbols';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Component, useEffect, type PropsWithChildren, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

import { migrate } from './migrations';

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <FatalErrorBoundary
      logLabel="Database failed to open"
      fallback={
        <FatalErrorScreen
          title="Не удалось открыть базу данных"
          subtitle="Попробуйте перезапустить приложение. Если это повторится, данные могли повредиться."
        />
      }>
      <SQLiteProvider databaseName="habits.db" onInit={migrate} useSuspense>
        {/*
          Screens have to live inside the provider, so a crash in any of them would
          otherwise reach the boundary above and be reported as a database failure.
          This inner one takes those, leaving the outer boundary with the only thing it
          can actually see — the suspenseful open.
        */}
        <FatalErrorBoundary
          logLabel="Render failed"
          fallback={
            <FatalErrorScreen
              title="Что-то пошло не так"
              subtitle="Перезапустите приложение — сохранённые данные останутся на месте."
            />
          }>
          {children}
        </FatalErrorBoundary>
      </SQLiteProvider>
    </FatalErrorBoundary>
  );
}

type BoundaryProps = PropsWithChildren<{
  fallback: ReactNode;
  /** Prefix for the console entry — the screen itself says nothing about the cause. */
  logLabel: string;
}>;

type BoundaryState = { error: Error | null };

/**
 * A failed migration (corrupt file, disk full) throws inside SQLiteProvider's
 * suspenseful open — uncaught, that's a blank white screen with no way back in,
 * since nothing below this point ever mounts to explain what happened.
 */
class FatalErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(this.props.logLabel, error);
  }

  render(): ReactNode {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}

type FatalErrorScreenProps = {
  title: string;
  subtitle: string;
};

function FatalErrorScreen({ title, subtitle }: FatalErrorScreenProps) {
  const { colors } = useTheme();

  // The splash is hidden by the root stack, which never mounts once the tree below a
  // boundary has failed. Without this the message would sit behind the splash forever
  // and the user would see exactly the blank screen the boundary exists to prevent.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SymbolView name="exclamationmark.triangle" size={40} tintColor={colors.danger} />
      <Text variant="headline" style={styles.title}>
        {title}
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {subtitle}
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
