import * as Haptics from 'expo-haptics';

/**
 * Feedback is best-effort: a device without a Taptic Engine rejects instead of
 * no-opping, and an unhandled rejection here would surface as a Metro warning over
 * something the user is not meant to notice either way.
 */
function fire(run: () => Promise<void>) {
  run().catch(() => {});
}

/** Thin wrapper over expo-haptics so call sites read as intent, not raw feedback styles. */
export const haptics = {
  /** A step forward that isn't a reset — incrementing a counter, checking a habit. */
  tick: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Cycling a counter back to 0 — deliberately duller than `tick` so it reads as undo. */
  reset: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  /** A whole day fully completed. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
