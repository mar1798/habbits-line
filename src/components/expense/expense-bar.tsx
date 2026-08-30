import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion, radius } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

// Strong ease-out, matching the rest of the app's UI motion (see expo-animation skill).
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export type ExpenseBarSegment = {
  key: string;
  color: string;
  /** Share of the whole track, 0..1. The caller's shares never add up to more than 1. */
  share: number;
};

type ExpenseBarProps = {
  segments: ExpenseBarSegment[];
  /** Spoken instead of the bar itself — a row of colored slices says nothing to VoiceOver. */
  accessibilityLabel: string;
  height?: number;
};

/**
 * The period split into one slice per category, with the unspent part of the budget left
 * as bare track.
 *
 * Like the day progress bar this animates width in pixels rather than a transform, and
 * for the same reason: a numeric width is what the layout measurement gives us, it
 * interpolates on the UI thread, and there is exactly one of these bars on screen. The
 * clamping that keeps the slices inside the track lives in `barTotal` — an overspent bar
 * is normalized to the amount spent instead of running past its end.
 */
export function ExpenseBar({ segments, accessibilityLabel, height = 12 }: ExpenseBarProps) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, { height, backgroundColor: colors.surfaceAlt }]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
      {segments.map((segment) => (
        <Segment
          key={segment.key}
          color={segment.color}
          share={segment.share}
          trackWidth={trackWidth}
        />
      ))}
    </View>
  );
}

function Segment({
  color,
  share,
  trackWidth,
}: {
  color: string;
  share: number;
  trackWidth: number;
}) {
  const width = useSharedValue(0);
  const measuredRef = useRef(false);

  useEffect(() => {
    if (trackWidth === 0) return;
    const next = trackWidth * Math.min(Math.max(share, 0), 1);
    // The first measured layout jumps straight to the value: without this every slice
    // sweeps out from zero on mount and on every width change (rotation, split view).
    if (!measuredRef.current) {
      measuredRef.current = true;
      width.value = next;
      return;
    }
    width.value = withTiming(next, {
      duration: motion.timing.base,
      easing: EASE_OUT,
      reduceMotion: ReduceMotion.System,
    });
  }, [share, trackWidth, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: width.value }));

  return <Animated.View style={[styles.segment, { backgroundColor: color }, animatedStyle]} />;
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
});
