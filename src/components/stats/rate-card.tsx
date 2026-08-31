import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { radius, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

type RateRowProps = {
  label: string;
  /** 0..1 share of scheduled days closed in the window; null when none were scheduled. */
  ratio: number | null;
  color: string;
};

function RateRow({ label, ratio, color }: RateRowProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  // Floor, not round — same rule as the "Today" ring: a 99.6% window hasn't earned
  // a full 100% yet.
  const percent = ratio === null ? null : Math.floor(ratio * 100);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text variant="callout">{label}</Text>
        <Text variant="callout" color={colors.textSecondary}>
          {percent === null ? t('rate_no_scheduled') : `${percent}%`}
        </Text>
      </View>
      {/* An empty track, not a zero-width fill: there is nothing to be part-way through. */}
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        {percent === null ? null : (
          <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
        )}
      </View>
    </View>
  );
}

type RateCardProps = {
  rate7: number | null;
  rate30: number | null;
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
