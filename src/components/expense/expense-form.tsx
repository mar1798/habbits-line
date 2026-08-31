import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CategoryGrid } from '@/components/expense/category-grid';
import { Button } from '@/components/ui/button';
import {
  DONE_ACCESSORY_ID,
  KeyboardDoneAccessory,
} from '@/components/ui/keyboard-done-accessory';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { fontFamily, minHitSlop, radius, spacing, typography } from '@/constants/design-tokens';
import type { ExpenseInput } from '@/db/expenses-repo';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { formatAmount, normalizeAmountInput } from '@/lib/money';
import { useExpenseCategoriesStore } from '@/store/expense-categories-store';

export type ExpenseFormValues = {
  amount: number | null;
  categoryId: string | null;
  /** The day the expense belongs to. Never editable — see the stage 12.2 notes in PLAN.md. */
  date: string;
};

type ExpenseFormProps = {
  initialValues: ExpenseFormValues;
  submitLabel: string;
  onSubmit: (input: ExpenseInput) => Promise<void>;
};

export function ExpenseForm({ initialValues, submitLabel, onSubmit }: ExpenseFormProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { t } = useI18n();

  const categories = useExpenseCategoriesStore((state) => state.categories);
  const loadCategories = useExpenseCategoriesStore((state) => state.load);

  const [amount, setAmount] = useState(() =>
    initialValues.amount === null ? '' : normalizeAmountInput(String(initialValues.amount))
  );
  const [categoryId, setCategoryId] = useState(initialValues.categoryId);
  const [submitting, setSubmitting] = useState(false);

  /** Ids known before the category modal was opened; null while none is pending. */
  const knownCategoriesRef = useRef<Set<string> | null>(null);

  // The modal can also be reached without the expenses screen ever having mounted — a
  // deep link — and then the store is empty. Archived categories are loaded too: the
  // grid filters them out itself, and an expense being edited may well sit in one.
  useEffect(() => {
    loadCategories(db, { includeArchived: true });
  }, [db, loadCategories]);

  /**
   * Selects the category that came back from the modal. There is no return value to read
   * from a pushed route, so the form remembers what it knew before opening it and picks
   * up whatever id is new. The ref is only cleared once something is found: cancelling
   * the modal leaves the intent standing for the next attempt.
   */
  useEffect(() => {
    const known = knownCategoriesRef.current;
    if (!known) return;
    const created = categories.find((category) => !known.has(category.id));
    if (created) {
      knownCategoriesRef.current = null;
      setCategoryId(created.id);
    }
  }, [categories]);

  const openNewCategory = () => {
    knownCategoriesRef.current = new Set(categories.map((category) => category.id));
    router.push('/expense-category/new');
  };

  // An archived category is not offered, but the one this expense already sits in stays
  // in the grid — otherwise opening the form would silently clear the selection.
  const visibleCategories = categories.filter(
    (category) => !category.archived_at || category.id === initialValues.categoryId
  );

  const amountValue = amount === '' ? 0 : Number(amount);
  const canSave = amountValue > 0 && categoryId !== null && !submitting;

  const handleSubmit = async () => {
    if (!canSave || categoryId === null) return;
    setSubmitting(true);
    try {
      await onSubmit({ categoryId, amount: amountValue, date: initialValues.date });
    } catch (error) {
      // Without this the rejection escapes as an unhandled promise and the screen just
      // sits there looking saved.
      console.error('Failed to save expense', error);
      setSubmitting(false);
      Alert.alert(t('expense_form_save_failed'), t('try_again'));
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // The submit button sits under the number pad otherwise.
        automaticallyAdjustKeyboardInsets>
        <Section title={t('expense_form_amount')}>
          <TextInput
            value={amount === '' ? '' : formatAmount(amountValue)}
            onChangeText={(text) => setAmount(normalizeAmountInput(text))}
            placeholder={t('expense_form_amount_placeholder')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            // The number pad has no return key of its own, so without this bar the
            // keyboard can only be closed by tapping the screen.
            inputAccessoryViewID={DONE_ACCESSORY_ID}
            // The amount is the one thing every expense needs, and the modal is opened to
            // type it — the keyboard comes up with the screen.
            autoFocus
            // Same rule as components/ui/text.tsx: sizes are fixed by the design system.
            allowFontScaling={false}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceAlt,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
          />
        </Section>

        <Section title={t('expense_form_category')}>
          <CategoryGrid
            categories={visibleCategories}
            value={categoryId}
            onChange={setCategoryId}
            onAdd={openNewCategory}
          />
          {categoryId === null ? (
            <Text variant="caption" color={colors.textSecondary}>
              {t('expense_form_category_required')}
            </Text>
          ) : null}
        </Section>

        <View style={styles.submit}>
          <Button title={submitLabel} onPress={handleSubmit} disabled={!canSave} />
        </View>
      </ScrollView>

      <KeyboardDoneAccessory onClear={() => setAmount('')} clearDisabled={amount === ''} />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  input: {
    minHeight: minHitSlop,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    textAlign: 'right',
    // Title type from the tokens, minus its lineHeight: on iOS a TextInput with an
    // explicit lineHeight clips its own text vertically.
    fontFamily,
    fontSize: typography.title1.fontSize,
    fontWeight: typography.title1.fontWeight,
  },
  submit: {
    marginTop: spacing.md,
  },
});
