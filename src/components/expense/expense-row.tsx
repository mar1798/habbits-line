import { type AccessibilityActionEvent, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { radius, resolveExpenseColor, spacing } from '@/constants/design-tokens';
import type { ExpenseCategoryRow, ExpenseRow as ExpenseRowData } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { showActionSheet } from '@/lib/action-sheet';
import { categoryName } from '@/lib/category-name';
import { formatAmount } from '@/lib/money';

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
  const accentColor = resolveExpenseColor(category?.color_key ?? '', scheme);

  const openMenu = () => {
    showActionSheet(
      {
        scheme,
        cancelLabel: t('cancel'),
        actions: [
          { id: 'edit', title: t('menu_edit') },
          { id: 'delete', title: t('delete'), destructive: true },
        ],
      },
      (id) => {
        if (id === 'edit') onEdit();
        if (id === 'delete') onDelete();
      }
    );
  };

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'edit') onEdit();
    if (event.nativeEvent.actionName === 'delete') onDelete();
  };

  // What the row draws, in reading order: the tap target hides its own children from a
  // screen reader, so the label has to carry the content instead of naming the action —
  // that name is what the hint is for. The emoji is left out; the category names it.
  const label = [
    category ? categoryName(category.name, t) : '—',
    formatAmount(expense.amount),
    expense.note || null,
    category?.archived_at ? t('settings_archived_badge') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    // A plain tap edits, and the long press opens the menu — the only visible affordance
    // this row has, since nothing about it says "hold me". The menu has no gesture a
    // screen reader can make, so it is offered as custom actions too.
    <PressableScale
      style={styles.wrapper}
      onPress={onEdit}
      onLongPress={openMenu}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('expense_edit_title')}
      accessibilityActions={[
        { name: 'edit', label: t('menu_edit') },
        { name: 'delete', label: t('delete') },
      ]}
      onAccessibilityAction={handleAccessibilityAction}>
      <Card style={styles.card}>
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
        <Text variant="headline">{formatAmount(expense.amount)}</Text>
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
