import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { spacing, typography } from '@/constants/design-tokens';
import { useScaledSize } from '@/hooks/use-font-scale';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import type { RecoveryStats } from '@/lib/streaks';

type RecoveryCardProps = {
  recovery: RecoveryStats;
};

/**
 * How many times the run has been broken, and how long it usually takes to pick it back
 * up — the other half of the streak card, which only ever shows the runs that held.
 *
 * The screen renders this only once there is a recovered slip to report: a user who has
 * never dropped a day should not be shown a card whose whole subject is dropping days,
 * and one who is still in their first gap has no recovery time yet to average.
 */
export function RecoveryCard({ recovery }: RecoveryCardProps) {
  const { colors } = useTheme();
  const { t, plural } = useI18n();
  const valueHeight = useScaledSize(typography.title1.lineHeight);

  // Whole days: `plural` truncates its argument, so «2.5 день» is what a fraction would
  // print. The average is over runs of at least one missed day, so it never rounds to 0.
  const average = Math.round(recovery.averageDays ?? 0);

  return (
    <Card style={styles.card}>
      <View style={styles.stat}>
        <View style={styles.label}>
          <SymbolView name="xmark.circle" size={16} tintColor={colors.textTertiary} />
          <Text variant="caption" color={colors.textSecondary}>
            {t('stats_recovery_breaks')}
          </Text>
        </View>
        <View style={[styles.value, { height: valueHeight }]}>
          <Text variant="title1">{recovery.breaks}</Text>
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          {plural('breaks', recovery.breaks)}
        </Text>
      </View>
      <View style={[styles.stat, styles.divider, { borderLeftColor: colors.border }]}>
        <View style={styles.label}>
          <SymbolView name="arrow.counterclockwise" size={16} tintColor={colors.accent} />
          <Text variant="caption" color={colors.textSecondary}>
            {t('stats_recovery_average')}
          </Text>
        </View>
        <View style={[styles.value, { height: valueHeight }]}>
          <Text variant="title1">{average}</Text>
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          {plural('days', average)}
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
  // Same trick as the streak card, height and all: a box the height of the number,
  // filled from the bottom, keeps the two captions on one baseline.
  value: {
    justifyContent: 'flex-end',
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
