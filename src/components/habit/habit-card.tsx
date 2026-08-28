import { MenuView } from '@expo/ui/community/menu';
import type { NativeActionEvent } from '@expo/ui/community/menu';
import { StyleSheet, View } from 'react-native';

import { CheckButton } from '@/components/habit/check-button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { radius, resolveHabitColor, spacing } from '@/constants/design-tokens';
import type { HabitRow } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';

type HabitCardProps = {
  habit: HabitRow;
  count: number;
  /** True once the card's date is in the future — its progress can't be edited. */
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

/** Russian plural for "N times": 1 раз, 2–4 раза, 5+ (and 11–14) раз. */
function timesWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'раз';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'раза';
  return 'раз';
}

export function HabitCard({ habit, count, disabled, onToggle, onEdit, onArchive }: HabitCardProps) {
  const { colors, scheme } = useTheme();
  const accentColor = resolveHabitColor(habit.color_key, scheme);

  return (
    <MenuView
      style={styles.menu}
      shouldOpenOnLongPress
      actions={[
        { id: 'edit', title: 'Изменить', image: 'pencil' },
        { id: 'archive', title: 'Архивировать', image: 'archivebox' },
      ]}
      onPressAction={({ nativeEvent }: NativeActionEvent) => {
        if (nativeEvent.event === 'edit') onEdit();
        if (nativeEvent.event === 'archive') onArchive();
      }}>
      <Card style={styles.card}>
        <View style={[styles.emoji, { backgroundColor: `${accentColor}33` }]}>
          <Text variant="headline">{habit.emoji}</Text>
        </View>
        <View style={styles.info}>
          <Text variant="headline" numberOfLines={1}>
            {habit.name}
          </Text>
          {habit.target_per_day > 1 ? (
            <Text variant="caption" color={colors.textSecondary}>
              Цель: {habit.target_per_day} {timesWord(habit.target_per_day)} в день
            </Text>
          ) : null}
        </View>
        <CheckButton
          count={count}
          target={habit.target_per_day}
          disabled={disabled}
          color={accentColor}
          onPress={onToggle}
        />
      </Card>
    </MenuView>
  );
}

const styles = StyleSheet.create({
  menu: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
});
