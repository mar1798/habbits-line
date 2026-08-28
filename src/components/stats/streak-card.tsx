import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

type StreakCardProps = {
  current: number;
  best: number;
};

/** Russian plural for "N days": 1 день, 2–4 дня, 5+ (and 11–14) дней. */
function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

export function StreakCard({ current, best }: StreakCardProps) {
  const { colors } = useTheme();

  return (
    <Card style={styles.card}>
      <View style={styles.stat}>
        <View style={styles.label}>
          <SymbolView name="flame.fill" size={16} tintColor={colors.accent} />
          <Text variant="caption" color={colors.textSecondary}>
            Текущий стрик
          </Text>
        </View>
        <Text variant="display">{current}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {daysWord(current)}
        </Text>
      </View>
      <View style={[styles.stat, styles.divider, { borderLeftColor: colors.border }]}>
        <View style={styles.label}>
          <SymbolView name="trophy.fill" size={16} tintColor={colors.textTertiary} />
          <Text variant="caption" color={colors.textSecondary}>
            Лучший
          </Text>
        </View>
        <Text variant="title1">{best}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {daysWord(best)}
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
