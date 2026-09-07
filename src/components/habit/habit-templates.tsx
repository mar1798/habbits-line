import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, resolveHabitColor, spacing } from '@/constants/design-tokens';
import { HABIT_TEMPLATES, type HabitTemplate } from '@/constants/habit-templates';
import { useI18n } from '@/hooks/use-i18n';
import { useTakenHabitNames } from '@/hooks/use-taken-names';
import { useTheme } from '@/hooks/use-theme';
import { isNameTaken } from '@/lib/name-match';

type HabitTemplatesProps = {
  /** Creates the habit. Must not reject — the caller owns the failure alert. */
  onSelect: (template: HabitTemplate) => Promise<void>;
};

/**
 * The one-tap offer under the empty "Today" screen: six starter habits, each created
 * with its own emoji, color and goal. The "+" button above stays the way to make one
 * from scratch.
 *
 * Mounted only while there is no active habit, which is also what keeps the name read
 * below off the normal render path.
 */
export function HabitTemplates({ onSelect }: HabitTemplatesProps) {
  const { t } = useI18n();
  const { colors, scheme } = useTheme();
  // Archived habits count: their names are taken (see listHabitNames), and the list can
  // be empty while the archive holds a "Вода" the user put away last month. Offering it
  // again would create a second row the settings list shows next to the first.
  const takenNames = useTakenHabitNames();
  const [pending, setPending] = useState<string | null>(null);

  const available = useMemo(
    () => HABIT_TEMPLATES.filter((template) => !isNameTaken(t(template.nameKey), takenNames)),
    [t, takenNames]
  );

  /**
   * One creation at a time. Without the guard a double tap writes the habit twice —
   * the second tap lands while the first insert is still in flight, so the name check
   * above has nothing to catch it with.
   */
  const handlePress = (template: HabitTemplate) => {
    if (pending !== null) return;
    setPending(template.id);
    onSelect(template).finally(() => setPending(null));
  };

  if (available.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text variant="caption" color={colors.textSecondary}>
        {t('today_templates_title')}
      </Text>
      <View style={styles.chips}>
        {available.map((template) => {
          const accentColor = resolveHabitColor(template.colorKey, scheme);
          const name = t(template.nameKey);
          return (
            <PressableScale
              key={template.id}
              onPress={() => handlePress(template)}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityHint={t('today_templates_hint')}
              // Same tint as the habit card's emoji bubble, so a chip already reads as
              // the card it is about to become.
              style={[styles.chip, { backgroundColor: `${accentColor}33` }]}>
              <Text variant="body">{template.emoji}</Text>
              <Text variant="callout">{name}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  // Content-sized chips, so `flexWrap` is safe here in a way it is not in the color
  // picker: nothing carries a percentage width that the gaps could push over the edge.
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
});
