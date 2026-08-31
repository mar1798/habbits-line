import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { CategoryGrid } from '@/components/expense/category-grid';
import { AmountInput } from '@/components/ui/amount-input';
import { Button } from '@/components/ui/button';
import {
  KEYBOARD_BAR_HEIGHT,
  KeyboardDoneAccessory,
} from '@/components/ui/keyboard-done-accessory';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import {
  fontFamily,
  minHitSlop,
  radius,
  spacing,
  typography,
} from '@/constants/design-tokens';
import type { ExpenseInput } from '@/db/expenses-repo';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { normalizeAmountInput } from '@/lib/money';
import { useExpenseCategoriesStore } from '@/store/expense-categories-store';

/** Long enough for a line about what was bought, short enough to stay one line in the list. */
const MAX_NOTE_LENGTH = 80;

export type ExpenseFormValues = {
  amount: number | null;
  categoryId: string | null;
  /** The expense's description, null when it has none. */
  note: string | null;
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
  const [note, setNote] = useState(initialValues.note ?? '');
  const [submitting, setSubmitting] = useState(false);
  /**
   * Which field the keyboard bar's "Clear" belongs to. The bar is one view over the whole
   * screen rather than an accessory bound to an input, so without this it would keep
   * emptying the amount while the description is the field being typed in.
   */
  const [focusedField, setFocusedField] = useState<'amount' | 'note'>('amount');

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
      // Trimmed, and an empty description is null rather than '': the row list branches on
      // "has a description at all", and a string of spaces is not one.
      const trimmedNote = note.trim();
      await onSubmit({
        categoryId,
        amount: amountValue,
        date: initialValues.date,
        note: trimmedNote === '' ? null : trimmedNote,
      });
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
          <AmountInput
            value={amount}
            onChangeValue={setAmount}
            placeholder={t('expense_form_amount_placeholder')}
            accessibilityLabel={t('expense_form_amount')}
            onFocus={() => setFocusedField('amount')}
            // The amount is the one thing every expense needs, and the modal is opened to
            // type it — the keyboard comes up with the screen.
            autoFocus
          />
        </Section>

        {/* Optional, and said so on the label rather than left to the user to find out by
            saving without it. One line: the list shows it on one, and a description that
            wraps here would promise room the row does not have. */}
        <Section title={`${t('expense_form_note')} — ${t('expense_form_note_optional')}`}>
          <TextInput
            value={note}
            onChangeText={setNote}
            onFocus={() => setFocusedField('note')}
            placeholder={t('expense_form_note_placeholder')}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="done"
            maxLength={MAX_NOTE_LENGTH}
            accessibilityLabel={t('expense_form_note')}
            // Same rule as components/ui/text.tsx: sizes are fixed by the design system.
            allowFontScaling={false}
            style={[
              styles.note,
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

      <KeyboardDoneAccessory
        onClear={() => (focusedField === 'note' ? setNote('') : setAmount(''))}
        clearDisabled={focusedField === 'note' ? note === '' : amount === ''}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    // The keyboard bar rides above the keyboard, and `automaticallyAdjustKeyboardInsets`
    // only knows about the keyboard itself — without this the submit button ends up
    // underneath the bar.
    paddingBottom: spacing.lg + KEYBOARD_BAR_HEIGHT,
    gap: spacing.xl,
  },
  note: {
    minHeight: minHitSlop,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    // Body type from the tokens, minus its lineHeight, like the name field of the
    // category form: on iOS a TextInput with an explicit lineHeight clips its own text.
    fontFamily,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
  },
  submit: {
    marginTop: spacing.md,
  },
});
