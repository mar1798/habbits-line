import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { habitColors } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

export type ConfettiHandle = {
  fire: () => void;
};

const PARTICLE_COUNT = 18;
/** Longest possible delay + duration a particle can draw, so the burst can be cleared safely after this. */
const MAX_LIFETIME_MS = 1900;

type ParticleSpec = {
  key: string;
  color: string;
  size: number;
  left: number;
  drift: number;
  rotateTo: number;
  duration: number;
  delay: number;
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function buildParticles(colors: string[], burst: number): ParticleSpec[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
    key: `${burst}-${index}`,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: randomBetween(6, 11),
    left: randomBetween(0.04, 0.96),
    drift: randomBetween(-70, 70),
    rotateTo: randomBetween(240, 640) * (Math.random() < 0.5 ? -1 : 1),
    duration: randomBetween(900, 1500),
    delay: randomBetween(0, 150),
  }));
}

function Particle({ spec, height }: { spec: ParticleSpec; height: number }) {
  const fall = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    fall.value = withDelay(
      spec.delay,
      withTiming(1, {
        duration: spec.duration,
        easing: Easing.in(Easing.quad),
        reduceMotion: ReduceMotion.System,
      })
    );
    opacity.value = withDelay(
      spec.delay + spec.duration * 0.6,
      withTiming(0, { duration: spec.duration * 0.4, reduceMotion: ReduceMotion.System })
    );
    // Fired once per mount: each burst remounts a fresh set of particles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: fall.value * height },
      { translateX: fall.value * spec.drift },
      { rotate: `${fall.value * spec.rotateTo}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          left: `${spec.left * 100}%`,
          width: spec.size,
          height: spec.size,
          backgroundColor: spec.color,
          borderRadius: spec.size * 0.25,
        },
      ]}
    />
  );
}

/**
 * Fullscreen, non-interactive particle burst. Sits above screen content as the last
 * sibling in a `Screen`; `fire()` is imperative rather than prop-driven so callers
 * trigger it from inside an event handler at the exact moment a day closes, not from
 * a state transition that would also need to guard against replaying on re-render.
 */
export const Confetti = forwardRef<ConfettiHandle>(function Confetti(_props, ref) {
  const { scheme } = useTheme();
  const { height } = useWindowDimensions();
  const burstRef = useRef(0);
  const [particles, setParticles] = useState<ParticleSpec[]>([]);

  const fire = () => {
    const burst = ++burstRef.current;
    const palette = Object.values(habitColors).map((color) => color[scheme]);
    setParticles(buildParticles(palette, burst));
    setTimeout(() => {
      if (burstRef.current === burst) setParticles([]);
    }, MAX_LIFETIME_MS);
  };

  useImperativeHandle(ref, () => ({ fire }));

  if (particles.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((spec) => (
        <Particle key={spec.key} spec={spec} height={height} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
  },
});
