import { type AccessibilityActionEvent, StyleSheet, View } from 'react-native';

import { CheckButton } from '@/components/habit/check-button';
import { SwipeRow, type SwipeAction } from '@/components/ui/swipe-row';
import { Text } from '@/components/ui/text';
import { radius, resolveHabitColor, spacing } from '@/constants/design-tokens';
import type { HabitRow } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
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

export function HabitCard({ habit, count, disabled, onToggle, onEdit, onArchive }: HabitCardProps) {
  const { colors, scheme } = useTheme();
  const { t, plural } = useI18n();
  const accentColor = resolveHabitColor(habit.color_key, scheme);

  const actions: SwipeAction[] = [
    { id: 'edit', label: t('swipe_edit'), icon: 'square.and.pencil', tone: 'accent', onPress: onEdit },
    { id: 'archive', label: t('swipe_archive'), icon: 'archivebox', tone: 'neutral', onPress: onArchive },
  ];

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'edit') onEdit();
    if (event.nativeEvent.actionName === 'archive') onArchive();
  };

  return (
    // A short swipe to the left uncovers edit and archive. The card has no plain tap of
    // its own: over the check button the tap belongs to that button, and elsewhere on the
    // card there has never been anything for it to do.
    <SwipeRow actions={actions} elevated>
      <View style={styles.card}>
        <View style={[styles.emoji, { backgroundColor: `${accentColor}33` }]}>
          <Text variant="headline">{habit.emoji}</Text>
        </View>
        {/* The swipe has no accessible equivalent, so the actions are offered here as
            custom actions — on the info block, which is an accessibility element of its
            own and leaves CheckButton, the one control on the screen that does anything,
            reachable beside it. */}
        <View
          style={styles.info}
          accessible
          accessibilityActions={[
            { name: 'edit', label: t('menu_edit') },
            { name: 'archive', label: t('menu_archive') },
          ]}
          onAccessibilityAction={handleAccessibilityAction}>
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
      </View>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  // The surface itself is drawn by SwipeRow, which has to clip it; this is the padding
  // and the layout that used to come with Card.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
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
