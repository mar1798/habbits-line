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
import { DEFAULT_HABIT_COLOR, radius, resolveColorKey, spacing } from '@/constants/design-tokens';
import { HABIT_EMOJIS } from '@/constants/emoji';
import type { HabitInput } from '@/db/habits-repo';
import { useTheme } from '@/hooks/use-theme';

const MIN_TARGET = 1;
const MAX_TARGET = 20;
const DEFAULT_SCHEDULE_MASK = 127;

export const DEFAULT_HABIT_FORM_VALUES: HabitInput = {
  name: '',
  emoji: HABIT_EMOJIS[0],
  colorKey: DEFAULT_HABIT_COLOR,
  targetPerDay: 1,
  scheduleMask: DEFAULT_SCHEDULE_MASK,
  reminderTime: null,
};

type HabitFormProps = {
  initialValues: HabitInput;
  submitLabel: string;
  /** True while editing an existing habit — schedule/target edits rewrite its past stats. */
  isEditing?: boolean;
  onSubmit: (input: HabitInput) => Promise<void>;
};

export function HabitForm({ initialValues, submitLabel, isEditing, onSubmit }: HabitFormProps) {
  const { colors } = useTheme();
  // A stored color_key outside the palette (foreign or future import file) is pulled
  // back onto violet here, so the picker always has a selected swatch and a save
  // rewrites the unknown key instead of preserving it.
  const [values, setValues] = useState<HabitInput>(() => ({
    ...initialValues,
    colorKey: resolveColorKey(initialValues.colorKey),
  }));
  const [submitting, setSubmitting] = useState(false);

  const nameIsValid = values.name.trim().length > 0;
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
      Alert.alert('Не удалось сохранить', 'Попробуйте ещё раз.');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      // The submit button sits under the keyboard on a modal this tall otherwise.
      automaticallyAdjustKeyboardInsets>
      <Section title="Название">
        <TextInput
          value={values.name}
          onChangeText={(name) => patch({ name })}
          placeholder="Например, Пить воду"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          style={[
            styles.input,
            { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.border },
          ]}
        />
        {!nameIsValid ? (
          <Text variant="caption" color={colors.textSecondary}>
            Введите название — без него привычку не сохранить
          </Text>
        ) : null}
      </Section>

      <Section title="Эмодзи">
        <EmojiPicker value={values.emoji} onChange={(emoji) => patch({ emoji })} />
      </Section>

      <Section title="Цвет">
        <ColorPicker value={values.colorKey} onChange={(colorKey) => patch({ colorKey })} />
      </Section>

      <Section title="Дни недели">
        <WeekdayPicker value={values.scheduleMask} onChange={(scheduleMask) => patch({ scheduleMask })} />
        {!scheduleIsValid ? (
          <Text variant="caption" color={colors.danger}>
            Выберите хотя бы один день — иначе привычка нигде не появится
          </Text>
        ) : null}
        {isEditing ? (
          <Text variant="caption" color={colors.textSecondary}>
            Изменение дней или цели задним числом меняет прошлую статистику
          </Text>
        ) : null}
      </Section>

      <Section title="Цель в день">
        <View style={styles.stepper}>
          <IconButton
            name="minus"
            accessibilityLabel="Уменьшить цель"
            disabled={values.targetPerDay <= MIN_TARGET}
            onPress={() => patch({ targetPerDay: Math.max(MIN_TARGET, values.targetPerDay - 1) })}
          />
          <Text variant="title2" style={styles.stepperValue}>
            {values.targetPerDay}
          </Text>
          <IconButton
            name="plus"
            accessibilityLabel="Увеличить цель"
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
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    fontSize: 16,
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
