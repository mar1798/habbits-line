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

type ProgressBarProps = {
  /** 0..1; not clamped here — caller owns the min(count/target, 1) rule. */
  progress: number;
  height?: number;
  color?: string;
  trackColor?: string;
};

export function ProgressBar({ progress, height = 8, color, trackColor }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.min(Math.max(progress, 0), 1);
  // The fill is animated in pixels rather than as a percentage string: a numeric width
  // is what the layout measurement gives us, and it interpolates on the UI thread.
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useSharedValue(0);
  const measuredRef = useRef(false);

  useEffect(() => {
    if (trackWidth === 0) return;
    const next = trackWidth * clamped;
    // The first measured layout jumps straight to the value: without this the bar sweeps
    // out from zero on every mount and on every width change (rotation, split view).
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
  }, [clamped, trackWidth, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: radius.pill, backgroundColor: trackColor ?? colors.surfaceAlt },
      ]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: radius.pill, backgroundColor: color ?? colors.accent },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
