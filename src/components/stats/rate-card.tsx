import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

type RateRowProps = {
  label: string;
  /** 0..1 share of scheduled days closed in the window. */
  ratio: number;
  color: string;
};

function RateRow({ label, ratio, color }: RateRowProps) {
  const { colors } = useTheme();
  // Floor, not round — same rule as the "Today" ring: a 99.6% window hasn't earned
  // a full 100% yet.
  const percent = Math.floor(ratio * 100);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text variant="callout">{label}</Text>
        <Text variant="callout" color={colors.textSecondary}>
          {percent}%
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

type RateCardProps = {
  rate7: number;
  rate30: number;
  color: string;
};

export function RateCard({ rate7, rate30, color }: RateCardProps) {
  const { t } = useI18n();

  return (
    <Card style={styles.card}>
      <RateRow label={t('rate_7_days')} ratio={rate7} color={color} />
      <RateRow label={t('rate_30_days')} ratio={rate30} color={color} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  row: {
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
