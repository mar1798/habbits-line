import { SFSymbol, SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './text';

type EmptyStateProps = {
  icon: SFSymbol;
  title: string;
  subtitle?: string;
};

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <SymbolView name={icon} size={40} tintColor={colors.textTertiary} />
      <Text variant="headline" style={styles.title}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
          {subtitle}
        </Text>
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
});
