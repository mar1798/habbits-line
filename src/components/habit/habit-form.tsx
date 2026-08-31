import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ColorPicker } from '@/components/habit/color-picker';
import { EmojiPicker } from '@/components/habit/emoji-picker';
import { TimePickerField } from '@/components/habit/time-picker-field';
import { WeekdayPicker } from '@/components/habit/weekday-picker';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import {
  DEFAULT_HABIT_COLOR,
  fontFamily,
  habitColors,
  minHitSlop,
  radius,
  resolveColorKey,
  spacing,
  typography,
} from '@/constants/design-tokens';
import { DEFAULT_HABIT_EMOJI } from '@/constants/emoji';
import type { HabitInput } from '@/db/habits-repo';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { isNameTakenByAnother } from '@/lib/name-match';

const MIN_TARGET = 1;
const MAX_TARGET = 20;
const DEFAULT_SCHEDULE_MASK = 127;

export const DEFAULT_HABIT_FORM_VALUES: HabitInput = {
  name: '',
  emoji: DEFAULT_HABIT_EMOJI,
  colorKey: DEFAULT_HABIT_COLOR,
  targetPerDay: 1,
  scheduleMask: DEFAULT_SCHEDULE_MASK,
  reminderTime: null,
};

type HabitFormProps = {
  initialValues: HabitInput;
  submitLabel: string;
  /** Normalized names of every other habit — this one may not reuse any of them. */
  takenNames: readonly string[];
  /** True while editing an existing habit — schedule/target edits rewrite its past stats. */
  isEditing?: boolean;
  onSubmit: (input: HabitInput) => Promise<void>;
};

export function HabitForm({
  initialValues,
  submitLabel,
  takenNames,
  isEditing,
  onSubmit,
}: HabitFormProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  // A stored color_key outside the palette (foreign or future import file) is pulled
  // back onto violet here, so the picker always has a selected swatch and a save
  // rewrites the unknown key instead of preserving it.
  const [values, setValues] = useState<HabitInput>(() => ({
    ...initialValues,
    colorKey: resolveColorKey(initialValues.colorKey),
  }));
  const [submitting, setSubmitting] = useState(false);

  const nameIsFilled = values.name.trim().length > 0;
  // Two habits reading the same in the list are indistinguishable — in the list, in the
  // reminder, and in stats — so a name already in use blocks the save the same way an
  // empty one does.
  const nameIsTaken = isNameTakenByAnother(values.name, takenNames, initialValues.name);
  const nameIsValid = nameIsFilled && !nameIsTaken;
  const scheduleIsValid = values.scheduleMask > 0;
  const canSave = nameIsValid && scheduleIsValid && !submitting;

  const patch = (next: Partial<HabitInput>) => setValues((current) => ({ ...current, ...next }));

  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
    } catch (error) {
      // Without this the rejection escapes as an unhandled promise and the screen just
      // sits there looking saved.
      console.error('Failed to save habit', error);
      setSubmitting(false);
      Alert.alert(t('habit_form_save_failed'), t('try_again'));
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // The submit button sits under the keyboard on a modal this tall otherwise.
      automaticallyAdjustKeyboardInsets>
      <Section title={t('habit_form_name')}>
        <TextInput
          value={values.name}
          onChangeText={(name) => patch({ name })}
          placeholder={t('habit_form_name_placeholder')}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          // Same rule as components/ui/text.tsx: sizes are fixed by the design system,
          // so the field must not grow with Dynamic Type while everything around it stays.
          allowFontScaling={false}
          style={[
            styles.input,
            { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.border },
          ]}
        />
        {!nameIsFilled ? (
          <Text variant="caption" color={colors.textSecondary}>
            {t('habit_form_name_required')}
          </Text>
        ) : nameIsTaken ? (
          <Text variant="caption" color={colors.danger}>
            {t('habit_form_name_taken')}
          </Text>
        ) : null}
      </Section>

      <Section title={t('habit_form_emoji')}>
        <EmojiPicker value={values.emoji} onChange={(emoji) => patch({ emoji })} />
      </Section>

      <Section title={t('habit_form_color')}>
        <ColorPicker
          colors={habitColors}
          value={values.colorKey}
          onChange={(colorKey) => patch({ colorKey })}
        />
      </Section>

      <Section title={t('habit_form_weekdays')}>
        <WeekdayPicker value={values.scheduleMask} onChange={(scheduleMask) => patch({ scheduleMask })} />
        {!scheduleIsValid ? (
          <Text variant="caption" color={colors.danger}>
            {t('habit_form_weekdays_required')}
          </Text>
        ) : null}
        {isEditing ? (
          <Text variant="caption" color={colors.textSecondary}>
            {t('habit_form_editing_note')}
          </Text>
        ) : null}
      </Section>

      <Section title={t('habit_form_target')}>
        <View style={styles.stepper}>
          <IconButton
            name="minus"
            accessibilityLabel={t('habit_form_target_decrease')}
            disabled={values.targetPerDay <= MIN_TARGET}
            onPress={() => patch({ targetPerDay: Math.max(MIN_TARGET, values.targetPerDay - 1) })}
          />
          <Text variant="title2" style={styles.stepperValue}>
            {values.targetPerDay}
          </Text>
          <IconButton
            name="plus"
            accessibilityLabel={t('habit_form_target_increase')}
            disabled={values.targetPerDay >= MAX_TARGET}
            onPress={() => patch({ targetPerDay: Math.min(MAX_TARGET, values.targetPerDay + 1) })}
          />
        </View>
      </Section>

      <Section>
        <TimePickerField
          value={values.reminderTime}
          onChange={(reminderTime) => patch({ reminderTime })}
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stepperValue: {
    minWidth: 32,
    textAlign: 'center',
  },
  submit: {
    marginTop: spacing.md,
  },
});
