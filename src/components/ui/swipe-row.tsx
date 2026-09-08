import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { radius, shadow, spacing } from '@/constants/design-tokens';
import { useScaledSize } from '@/hooks/use-font-scale';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

/** `accent` is the ordinary action, `neutral` the reversible one, `danger` the last one. */
export type SwipeActionTone = 'accent' | 'neutral' | 'danger';

export type SwipeAction = {
  id: string;
  /** Short enough for two lines in a column this narrow — the `swipe_*` keys, not `menu_*`. */
  label: string;
  icon: SFSymbol;
  tone: SwipeActionTone;
  onPress: () => void;
};

type SwipeRowProps = {
  /**
   * Left to right, so the last one sits at the trailing edge and is the first thing a
   * swipe uncovers. A destructive action goes last, like iOS puts it.
   */
  actions: SwipeAction[];
  /** Adds the card shadow — the two list screens are raised, the settings rows are flat. */
  elevated?: boolean;
  /** Outer style: the margins around the row. Its surface is drawn here. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** One action column at the base text size; grows with Dynamic Type. */
const ACTION_WIDTH = 76;

/**
 * The row that is currently showing its actions, app-wide. Two open rows at once read as
 * a list that has lost its place, and a `Swipeable` has no way to hear about a swipe on a
 * sibling — so the one that opens closes the previous one itself.
 */
let openRow: SwipeableMethods | null = null;

type ActionButtonProps = {
  action: SwipeAction;
  /** Its place in the panel, counted from the leading edge. */
  index: number;
  count: number;
  width: number;
  /** 0 closed, 1 open — the panel's own progress, not the row's translation. */
  progress: SharedValue<number>;
  onActivate: () => void;
};

/**
 * One action column, parked under the row and pulled out from behind its trailing edge.
 *
 * Laid out at its open position and pushed back to the right by the distance still to be
 * uncovered, each button by its own share of it: the outermost one appears the moment the
 * row starts to move, the ones behind it catch up as the gap widens. Without that offset
 * the whole panel is already in place at the first pixel of the drag and the row merely
 * slides off it — the panel has to look like it is coming out of the edge.
 */
function ActionButton({ action, index, count, width, progress, onActivate }: ActionButtonProps) {
  const { colors } = useTheme();

  // `textSecondary` as a fill, deliberately: the tokens have no solid neutral, and the
  // two that come close both fail here — `surfaceAlt` is a shade off the page background
  // and the button vanishes into it, `warning` is a dark olive that fights the accent
  // beside it. This one is the same grey the secondary text is drawn in, and carries
  // `onAccent` at well over 4.5:1 in both themes.
  const fill =
    action.tone === 'danger'
      ? colors.danger
      : action.tone === 'neutral'
        ? colors.textSecondary
        : colors.accent;

  const animatedStyle = useAnimatedStyle(() => {
    // Clamped: `progress` runs past 1 on an overshoot, which would drag the columns back
    // out through the trailing edge they just came from.
    const revealed = Math.min(progress.value, 1);
    return { transform: [{ translateX: (count - index) * width * (1 - revealed) }] };
  });

  return (
    <Animated.View style={[styles.action, { width, backgroundColor: fill }, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        // Full-bleed columns can't scale on press the way the cards do — a shrinking
        // column opens a gap onto whatever is behind the panel. Dimming is what iOS does.
        style={({ pressed }) => [styles.actionPressable, pressed && styles.actionPressed]}
        onPress={onActivate}>
        <SymbolView name={action.icon} size={20} tintColor={colors.onAccent} />
        <Text variant="caption" color={colors.onAccent} numberOfLines={2} style={styles.label}>
          {action.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * A list row whose actions are revealed by a short swipe to the left.
 *
 * The surface — background, border, corner radius, optional shadow — belongs to this rather
 * than to the row inside it: `Swipeable` clips its container to hide the action panel,
 * which would cut a shadow drawn underneath and square off the corners the panel slides
 * out from. The fill is repeated on the sliding layer, which is the part that matters:
 * the panel is an `absoluteFill` sibling *under* the row, so a transparent row shows the
 * buttons straight through the card for the whole length of the swipe. The children supply
 * their own padding and nothing else.
 *
 * The swipe has no equivalent a screen reader can perform, so the panel is hidden from
 * accessibility entirely and every caller offers the same actions through
 * `accessibilityActions` on the row itself.
 */
export function SwipeRow({ actions, elevated = false, style, children }: SwipeRowProps) {
  const { colors } = useTheme();
  const swipeable = useRef<SwipeableMethods | null>(null);
  const actionWidth = useScaledSize(ACTION_WIDTH);

  // A row swiped open and then scrolled out of a FlatList window is unmounted with the
  // registry still pointing at it; the next swipe would call close() on a dead handle.
  useEffect(
    () => () => {
      if (openRow === swipeable.current) openRow = null;
    },
    []
  );

  const renderActions = (progress: SharedValue<number>) => (
    <View
      style={styles.actions}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {actions.map((action, index) => (
        <ActionButton
          key={action.id}
          action={action}
          index={index}
          count={actions.length}
          width={actionWidth}
          progress={progress}
          onActivate={() => {
            // Closed first: an action either navigates away or opens an alert, and a row
            // left open under either one is still open when the user comes back to it.
            swipeable.current?.close();
            action.onPress();
          }}
        />
      ))}
    </View>
  );

  return (
    <View
      style={[
        styles.host,
        { backgroundColor: colors.surface, borderColor: colors.border },
        elevated && shadow('level1', colors),
        style,
      ]}>
      <ReanimatedSwipeable
        ref={swipeable}
        containerStyle={styles.clip}
        childrenContainerStyle={[styles.content, { backgroundColor: colors.surface }]}
        renderRightActions={renderActions}
        // No left panel to pull out to, so overshooting to the right only detaches the
        // row from the edge of the screen.
        overshootRight={false}
        // A short drag is enough — the default is half the panel, which on three actions
        // is most of the screen and turns "light swipe" into a haul.
        rightThreshold={actionWidth / 2}
        onSwipeableWillOpen={() => {
          if (openRow && openRow !== swipeable.current) openRow.close();
          openRow = swipeable.current;
          haptics.tick();
        }}
        onSwipeableWillClose={() => {
          if (openRow === swipeable.current) openRow = null;
        }}>
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Repeats the host's radius so the action panel is clipped to the same corners.
  clip: {
    borderRadius: radius.lg,
  },
  // The opaque layer the row rides on. Rounded to the same corners: it is the top layer,
  // and a square one would paint over the host's rounded border on the leading edge.
  content: {
    borderRadius: radius.lg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  action: {
    // The columns overlap while they are catching up with each other, so the one nearer
    // the trailing edge has to be drawn over its neighbour rather than beside it.
    overflow: 'hidden',
  },
  actionPressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  actionPressed: {
    opacity: 0.7,
  },
  label: {
    textAlign: 'center',
  },
});
