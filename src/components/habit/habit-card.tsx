import { StyleSheet, View } from 'react-native';

import { CheckButton } from '@/components/habit/check-button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { radius, resolveHabitColor, spacing } from '@/constants/design-tokens';
import type { HabitRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { showActionSheet } from '@/lib/action-sheet';

type HabitCardProps = {
  habit: HabitRow;
  count: number;
  /** True once the card's date is in the future — its progress can't be edited. */
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

export function HabitCard({ habit, count, disabled, onToggle, onEdit, onArchive }: HabitCardProps) {
  const { colors, scheme } = useTheme();
  const { t, plural } = useI18n();
  const accentColor = resolveHabitColor(habit.color_key, scheme);

  const openMenu = () => {
    showActionSheet(
      {
        scheme,
        cancelLabel: t('cancel'),
        actions: [
          { id: 'edit', title: t('menu_edit') },
          { id: 'archive', title: t('menu_archive') },
        ],
      },
      (id) => {
        if (id === 'edit') onEdit();
        if (id === 'archive') onArchive();
      }
    );
  };

  return (
    // No onPress: a tap over the check button is claimed by its own Pressable before this
    // one ever sees it, and elsewhere on the card a plain tap has never done anything —
    // long press opening the menu is the only behavior this wrapper adds.
    <PressableScale style={styles.wrapper} onLongPress={openMenu}>
      <Card style={styles.card}>
        <View style={[styles.emoji, { backgroundColor: `${accentColor}33` }]}>
          <Text variant="headline">{habit.emoji}</Text>
        </View>
        <View style={styles.info}>
          {/* Two lines, not one: the check button and the emoji leave the name about
              half the card, and "Читать 30 минут перед сном" — an ordinary habit name —
              was cut at "перед сн…". The rows already vary in height with the goal
              caption, so a taller card costs the list nothing it had. */}
          <Text variant="headline" numberOfLines={2}>
            {habit.name}
          </Text>
          {habit.target_per_day > 1 ? (
            <Text variant="caption" color={colors.textSecondary}>
              {t('habit_card_target', {
                count: habit.target_per_day,
                times: plural('times', habit.target_per_day),
              })}
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
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: {
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
