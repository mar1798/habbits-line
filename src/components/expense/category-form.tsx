import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ColorPicker } from '@/components/habit/color-picker';
import { EmojiPicker } from '@/components/habit/emoji-picker';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import {
  DEFAULT_EXPENSE_COLOR,
  expenseColors,
  fontFamily,
  minHitSlop,
  radius,
  resolveExpenseColorKey,
  spacing,
  typography,
} from '@/constants/design-tokens';
import { DEFAULT_CATEGORY_EMOJI } from '@/constants/emoji';
import type { ExpenseCategoryInput } from '@/db/expense-categories-repo';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

export const DEFAULT_CATEGORY_FORM_VALUES: ExpenseCategoryInput = {
  name: '',
  emoji: DEFAULT_CATEGORY_EMOJI,
  colorKey: DEFAULT_EXPENSE_COLOR,
};

type CategoryFormProps = {
  initialValues: ExpenseCategoryInput;
  submitLabel: string;
  onSubmit: (input: ExpenseCategoryInput) => Promise<void>;
};

/**
 * The habit form minus everything that is about doing something on a schedule: a category
 * has a name, an emoji and a color, and no target, weekdays or reminder. The emoji picker
 * is shared as-is; the color picker takes the sixteen-key expense palette.
 */
export function CategoryForm({ initialValues, submitLabel, onSubmit }: CategoryFormProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  // A stored color_key outside the palette (an older build, an import file) is pulled
  // back onto violet here, so the picker always has a selected swatch and saving rewrites
  // the unknown key instead of preserving it.
  const [values, setValues] = useState<ExpenseCategoryInput>(() => ({
    ...initialValues,
    colorKey: resolveExpenseColorKey(initialValues.colorKey),
  }));
  const [submitting, setSubmitting] = useState(false);

  const nameIsValid = values.name.trim().length > 0;
  const canSave = nameIsValid && !submitting;

  const patch = (next: Partial<ExpenseCategoryInput>) =>
    setValues((current) => ({ ...current, ...next }));

  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
    } catch (error) {
      console.error('Failed to save expense category', error);
      setSubmitting(false);
      Alert.alert(t('category_form_save_failed'), t('try_again'));
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets>
      <Section title={t('category_form_name')}>
        <TextInput
          value={values.name}
          onChangeText={(name) => patch({ name })}
          placeholder={t('category_form_name_placeholder')}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          autoFocus={initialValues.name === ''}
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
        {!nameIsValid ? (
          <Text variant="caption" color={colors.textSecondary}>
            {t('category_form_name_required')}
          </Text>
        ) : null}
      </Section>

      <Section title={t('category_form_emoji')}>
        <EmojiPicker value={values.emoji} onChange={(emoji) => patch({ emoji })} />
      </Section>

      <Section title={t('category_form_color')}>
        <ColorPicker
          colors={expenseColors}
          value={values.colorKey}
          onChange={(colorKey) => patch({ colorKey })}
        />
      </Section>

      <Button title={submitLabel} onPress={handleSubmit} disabled={!canSave} style={styles.submit} />
    </ScrollView>
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
    // Body type from the tokens, minus its lineHeight: on iOS a TextInput with an
    // explicit lineHeight clips its own text vertically.
    fontFamily,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
  },
  submit: {
    marginTop: spacing.md,
  },
});
