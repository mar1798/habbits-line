import { type AccessibilityActionEvent, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { SwipeRow, type SwipeAction } from '@/components/ui/swipe-row';
import { Text } from '@/components/ui/text';
import { radius, resolveExpenseColor, spacing } from '@/constants/design-tokens';
import type { ExpenseCategoryRow, ExpenseRow as ExpenseRowData } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useMoney } from '@/hooks/use-money';
import { useTheme } from '@/hooks/use-theme';
import { categoryName } from '@/lib/category-name';

type ExpenseRowProps = {
  expense: ExpenseRowData;
  /**
   * The expense's category, archived ones included — the screen loads the full list for
   * exactly this reason. Undefined only if the row outlived its category, which the
   * ON DELETE RESTRICT foreign key makes impossible in practice.
   */
  category: ExpenseCategoryRow | undefined;
  onEdit: () => void;
  onDelete: () => void;
};

export function ExpenseRow({ expense, category, onEdit, onDelete }: ExpenseRowProps) {
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const money = useMoney();
  const accentColor = resolveExpenseColor(category?.color_key ?? '', scheme);

  const actions: SwipeAction[] = [
    { id: 'edit', label: t('swipe_edit'), icon: 'square.and.pencil', tone: 'accent', onPress: onEdit },
    { id: 'delete', label: t('swipe_delete'), icon: 'trash', tone: 'danger', onPress: onDelete },
  ];

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'edit') onEdit();
    if (event.nativeEvent.actionName === 'delete') onDelete();
  };

  // What the row draws, in reading order: the tap target hides its own children from a
  // screen reader, so the label has to carry the content instead of naming the action —
  // that name is what the hint is for. The emoji is left out; the category names it.
  const label = [
    category ? categoryName(category.name, t) : '—',
    money(expense.amount),
    expense.note || null,
    category?.archived_at ? t('settings_archived_badge') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    // A plain tap edits, and a short swipe to the left uncovers the rest. The swipe is
    // not a gesture a screen reader can make, so the same two actions are offered as
    // custom actions here.
    <SwipeRow actions={actions} elevated>
      <PressableScale
        style={styles.card}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('expense_edit_title')}
        accessibilityActions={[
          { name: 'edit', label: t('menu_edit') },
          { name: 'delete', label: t('delete') },
        ]}
        onAccessibilityAction={handleAccessibilityAction}>
        <View style={[styles.emoji, { backgroundColor: `${accentColor}33` }]}>
          <Text variant="headline">{category?.emoji ?? '📦'}</Text>
        </View>
        <View style={styles.info}>
          <Text variant="headline" numberOfLines={1}>
            {category ? categoryName(category.name, t) : '—'}
          </Text>
          {/* One line, ellipsised: the row is a fixed height in a list, and a description
              that wrapped would push the amount beside it out of line with its neighbours.
              Under the category name rather than replacing it — the name is what the row
              is grouped and coloured by. */}
          {expense.note ? (
            <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
              {expense.note}
            </Text>
          ) : null}
          {category?.archived_at ? (
            <Text variant="caption" color={colors.textTertiary}>
              {t('settings_archived_badge')}
            </Text>
          ) : null}
        </View>
        <Text variant="headline">{money(expense.amount)}</Text>
      </PressableScale>
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
