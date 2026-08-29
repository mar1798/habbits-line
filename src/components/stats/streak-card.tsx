import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

type StreakCardProps = {
  current: number;
  best: number;
};

export function StreakCard({ current, best }: StreakCardProps) {
  const { colors } = useTheme();
  const { t, plural } = useI18n();

  return (
    <Card style={styles.card}>
      <View style={styles.stat}>
        <View style={styles.label}>
          <SymbolView name="flame.fill" size={16} tintColor={colors.accent} />
          <Text variant="caption" color={colors.textSecondary}>
            {t('streak_current')}
          </Text>
        </View>
        <Text variant="display">{current}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {plural('days', current)}
        </Text>
      </View>
      <View style={[styles.stat, styles.divider, { borderLeftColor: colors.border }]}>
        <View style={styles.label}>
          <SymbolView name="trophy.fill" size={16} tintColor={colors.textTertiary} />
          <Text variant="caption" color={colors.textSecondary}>
            {t('streak_best')}
          </Text>
        </View>
        <Text variant="title1">{best}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {plural('days', best)}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    gap: spacing.xs,
  },
  divider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg,
    paddingLeft: spacing.lg,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
