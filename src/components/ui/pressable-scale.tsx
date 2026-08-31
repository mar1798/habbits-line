import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { motion } from '@/constants/design-tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const pressSpring = { ...motion.spring.press, reduceMotion: ReduceMotion.System };

/** Exported so a caller that runs the press on its own layer scales by the same amount. */
export const PRESS_SCALE = 0.96;

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

export function PressableScale({
  style,
  scaleTo = PRESS_SCALE,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={(event) => {
        // Reanimated shared values are mutated via `.value` by design; the compiler's
        // purity check doesn't know that and flags it as a false positive.
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(scaleTo, pressSpring);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(1, pressSpring);
        onPressOut?.(event);
      }}
      {...rest}
    />
  );
}
