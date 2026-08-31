import { SymbolView } from 'expo-symbols';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, radius, spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

type CollapsibleSectionProps = PropsWithChildren<{
  title: string;
  /**
   * A word about what is behind a shut section — the selected range, on the statistics
   * screen. Without it a folded section says the same thing whether the user has picked
   * anything or not.
   */
  summary?: string;
  expanded: boolean;
  onToggle: () => void;
}>;

/**
 * A titled block that opens on a tap, for content worth keeping but not worth the height
 * it takes unasked — the two date-range blocks of the statistics screen, each of which
 * carries a whole calendar.
 *
 * Same shape as the accordions on the settings screen, which are their own component
 * there: those are rows of a `FlatList` header and footer and carry a count, this one
 * wraps its children and carries a summary line.
 */
export function CollapsibleSection({
  title,
  summary,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.block}>
      <PressableScale
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="headline" style={styles.title}>
          {title}
        </Text>
        {/* Only when shut: open, the block below says it better than one line can. */}
        {!expanded && summary ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
        <SymbolView
          name={expanded ? 'chevron.up' : 'chevron.down'}
          size={14}
          tintColor={colors.textSecondary}
        />
      </PressableScale>

      {/* Unmounted rather than hidden: the calendars inside are the reason this exists. */}
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minHitSlop,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    // Takes the row, so the summary and the chevron stay against the right edge.
    flex: 1,
  },
  body: {
    gap: spacing.sm,
  },
});
