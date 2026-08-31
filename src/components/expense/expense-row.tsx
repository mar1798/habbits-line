import { MenuView } from '@expo/ui/community/menu';
import type { NativeActionEvent } from '@expo/ui/community/menu';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { radius, resolveExpenseColor, spacing } from '@/constants/design-tokens';
import type { ExpenseCategoryRow, ExpenseRow as ExpenseRowData } from '@/db/types';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
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

  return (
    <MenuView
      style={styles.menu}
      shouldOpenOnLongPress
      actions={[
        { id: 'edit', title: t('menu_edit'), image: 'pencil' },
        { id: 'delete', title: t('delete'), image: 'trash', attributes: { destructive: true } },
      ]}
      onPressAction={({ nativeEvent }: NativeActionEvent) => {
        if (nativeEvent.event === 'edit') onEdit();
        if (nativeEvent.event === 'delete') onDelete();
      }}>
      {/* A plain tap edits, and the long press keeps the full menu. Without this the row
          had no visible affordance at all: nothing about it says "hold me", and the menu
          was the only way to reach an expense once it was written. The context menu is
          an interaction on the MenuView above, so the pressable underneath does not take
          the long press away from it. */}
      <PressableScale
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={t('expense_edit_title')}>
        <Card style={styles.card}>
          <View style={[styles.emoji, { backgroundColor: `${accentColor}33` }]}>
            <Text variant="headline">{category?.emoji ?? '📦'}</Text>
          </View>
          <View style={styles.info}>
            <Text variant="headline" numberOfLines={1}>
              {category ? categoryName(category.name, t) : '—'}
            </Text>
            {category?.archived_at ? (
              <Text variant="caption" color={colors.textTertiary}>
                {t('settings_archived_badge')}
              </Text>
            ) : null}
          </View>
          <Text variant="headline">{formatAmount(expense.amount)}</Text>
        </Card>
      </PressableScale>
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
