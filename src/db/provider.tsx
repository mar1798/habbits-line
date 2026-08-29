import { Directory, File } from 'expo-file-system';
import { SymbolView } from 'expo-symbols';
import * as SplashScreen from 'expo-splash-screen';
import { defaultDatabaseDirectory, SQLiteProvider } from 'expo-sqlite';
import { Component, useEffect, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

import { migrate } from './migrations';

const DATABASE_NAME = 'habits.db';

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <FatalErrorBoundary
      logLabel="Database failed to open"
      fallback={() => <DatabaseErrorScreen />}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate} useSuspense>
        {/*
          Screens have to live inside the provider, so a crash in any of them would
          otherwise reach the boundary above and be reported as a database failure.
          This inner one takes those, leaving the outer boundary with the only thing it
          can actually see — the suspenseful open.
        */}
        <FatalErrorBoundary
          logLabel="Render failed"
          fallback={() => (
            <FatalErrorScreen
              title="Что-то пошло не так"
              subtitle="Перезапустите приложение — сохранённые данные останутся на месте."
            />
          )}>
          {children}
        </FatalErrorBoundary>
      </SQLiteProvider>
    </FatalErrorBoundary>
  );
}

/**
 * The screen behind a database that cannot be opened at all, plus the only way out of it.
 *
 * Without a reset this is a dead end: "перезапустите приложение" cannot help, because the
 * file that failed is still there on the next launch, and nothing below the provider ever
 * mounts, so the import in settings is unreachable. Deleting rather than repairing —
 * a file SQLite refuses to open has nothing left to read out of it — puts the user back
 * on an empty database they can then restore a backup into.
 */
function DatabaseErrorScreen() {
  const [didReset, setDidReset] = useState(false);

  if (didReset) {
    return (
      <FatalErrorScreen
        // Not an error any more — the triangle would keep saying something is wrong.
        tone="done"
        title="База данных сброшена"
        subtitle="Запустите приложение заново. Если у вас есть файл резервной копии, его можно импортировать в настройках."
      />
    );
  }

  const confirm = () => {
    Alert.alert(
      'Сбросить базу данных?',
      'Все привычки и отметки на этом устройстве будут удалены без возможности восстановления. Если у вас есть файл резервной копии, после сброса его можно импортировать в настройках.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сбросить',
          style: 'destructive',
          onPress: () => {
            try {
              deleteDatabaseFiles();
              setDidReset(true);
            } catch (error) {
              console.error('Failed to reset database', error);
              Alert.alert(
                'Не удалось сбросить базу',
                'Переустановите приложение, чтобы очистить данные.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <FatalErrorScreen
      title="Не удалось открыть базу данных"
      subtitle="Попробуйте перезапустить приложение. Если это повторится, данные могли повредиться — базу можно сбросить и восстановить из резервной копии."
      action={{ label: 'Сбросить базу данных', onPress: confirm }}
    />
  );
}

/**
 * Unlinks the database and its WAL sidecars directly instead of calling
 * `deleteDatabaseAsync`, which refuses with "Unable to delete database that is currently
 * open": `SQLiteProvider` opens the file successfully and only fails on the first
 * statement inside `migrate`, so its connection is live and there is no handle to it out
 * here. Native connections are ref-counted, so reopening just to close cannot free it
 * either.
 *
 * Which is also why this cannot hand control back to a retry: the native cache would
 * serve the same broken connection for that path. Unlinking works regardless of open
 * handles, and the next launch builds a fresh database — hence the restart the screen
 * then asks for.
 */
function deleteDatabaseFiles(): void {
  const directory = new Directory(defaultDatabaseDirectory);
  for (const suffix of ['', '-wal', '-shm']) {
    const file = new File(directory, `${DATABASE_NAME}${suffix}`);
    if (file.exists) {
      file.delete();
    }
  }
}

type BoundaryProps = PropsWithChildren<{
  fallback: () => ReactNode;
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
    return this.state.error ? this.props.fallback() : this.props.children;
  }
}

type FatalErrorScreenProps = {
  title: string;
  subtitle: string;
  /** `done` marks a resolved state — same layout, no alarm. */
  tone?: 'error' | 'done';
  action?: { label: string; onPress: () => void };
};

function FatalErrorScreen({ title, subtitle, tone = 'error', action }: FatalErrorScreenProps) {
  const { colors } = useTheme();
  const isError = tone === 'error';

  // The splash is hidden by the root stack, which never mounts once the tree below a
  // boundary has failed. Without this the message would sit behind the splash forever
  // and the user would see exactly the blank screen the boundary exists to prevent.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SymbolView
        name={isError ? 'exclamationmark.triangle' : 'checkmark.circle'}
        size={40}
        tintColor={isError ? colors.danger : colors.success}
      />
      <Text variant="headline" style={styles.title}>
        {title}
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
        {subtitle}
      </Text>
      {action ? (
        <Button
          title={action.label}
          variant="secondary"
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
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
  action: {
    marginTop: spacing.lg,
  },
});
