import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, frame } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Linking, Switch, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { minHitSlop, spacing } from '@/constants/design-tokens';
import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';
import { useNotificationPermissionStatus } from '@/lib/notifications';

/** Turning the reminder on lands on a sane morning slot, not on the current minute. */
const DEFAULT_REMINDER_TIME = '09:00';

/**
 * Height of the compact date picker. A UISwitch is a fixed 31pt tall and cannot be
 * resized, so the picker is pinned to match it — left to its intrinsic size it sits a
 * few points taller than the switch and the two controls read as mismatched.
 */
const CONTROL_HEIGHT = 31;

/** The link's text alone is well under 44pt; hitSlop tops the target up to size. */
const SETTINGS_LINK_HIT_SLOP = { top: 14, bottom: 14, left: 12, right: 12 };

type TimePickerFieldProps = {
  /** 'HH:mm' local time, or null for no reminder. */
  value: string | null;
  onChange: (value: string | null) => void;
};

function timeToDate(time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function dateToTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function TimePickerField({ value, onChange }: TimePickerFieldProps) {
  const { colors, scheme } = useTheme();
  const { t } = useI18n();
  const permission = useNotificationPermissionStatus();
  // Toggling the reminder off clears the stored time; remembering it here means
  // toggling back on returns to the time the user picked, not to the default.
  const [lastTime, setLastTime] = useState(value ?? DEFAULT_REMINDER_TIME);
  const enabled = value !== null;

  const handleTimeChange = (date: Date) => {
    const time = dateToTime(date);
    setLastTime(time);
    onChange(time);
  };

  return (
    <View style={styles.container}>
      {/*
        The title, the time picker and the switch form one line; the hint sits on its
        own line below. Keeping the hint inside the row made the label column two lines
        tall and squeezed the picker, so the three controls no longer read as one row.
      */}
      <View style={styles.row}>
        <Text variant="body" style={styles.title}>
          {t('reminder')}
        </Text>
        <View style={styles.control}>
          {/*
            SwiftUI reads its own colour scheme from the system, not from the app's theme
            row — so with the theme forced to dark over a light iOS the picker rendered
            black digits on the dark surface. The host is told the app's scheme instead,
            and tinted with the accent so the highlighted field matches the rest of the
            form.
          */}
          {enabled ? (
            <Host
              matchContents
              style={styles.picker}
              colorScheme={scheme}
              seedColor={colors.accent}>
              <DatePicker
                selection={timeToDate(value)}
                displayedComponents={['hourAndMinute']}
                onDateChange={handleTimeChange}
                modifiers={[datePickerStyle('compact'), frame({ height: CONTROL_HEIGHT })]}
              />
            </Host>
          ) : null}
          <Switch
            value={enabled}
            onValueChange={(next) => onChange(next ? lastTime : null)}
            // The row's label is a sibling Text, which VoiceOver does not associate with
            // the switch — without this it is announced as a bare "switch".
            accessibilityLabel={t('reminder')}
            trackColor={{ false: colors.disabled, true: colors.accent }}
          />
        </View>
      </View>
      <Text variant="caption" color={colors.textSecondary}>
        {t('reminder_hint')}
      </Text>
      {enabled && permission === 'denied' ? (
        <View style={styles.warning}>
          <Text variant="caption" color={colors.danger} style={styles.warningText}>
            {t('reminder_denied')}
          </Text>
          <PressableScale
            onPress={() => Linking.openSettings()}
            hitSlop={SETTINGS_LINK_HIT_SLOP}>
            <Text variant="caption" color={colors.accent}>
              {t('settings_title')}
            </Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: minHitSlop,
  },
  title: {
    flexShrink: 1,
  },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // The SwiftUI host measures its own content; without a matching height the row would
  // still be laid out around the picker's intrinsic one.
  picker: {
    height: CONTROL_HEIGHT,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  warningText: {
    flex: 1,
  },
});
