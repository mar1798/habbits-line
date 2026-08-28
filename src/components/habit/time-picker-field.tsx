import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Linking, Switch, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { spacing } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';
import { useNotificationPermissionStatus } from '@/lib/notifications';

/** Turning the reminder on lands on a sane morning slot, not on the current minute. */
const DEFAULT_REMINDER_TIME = '09:00';

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
  const { colors } = useTheme();
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
      <View style={styles.row}>
        <View style={styles.label}>
          <Text variant="body">Напоминание</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Придёт в выбранные дни недели
          </Text>
        </View>
        {enabled ? (
          <Host matchContents>
            <DatePicker
              selection={timeToDate(value)}
              displayedComponents={['hourAndMinute']}
              onDateChange={handleTimeChange}
              modifiers={[datePickerStyle('compact')]}
            />
          </Host>
        ) : null}
        <Switch
          value={enabled}
          onValueChange={(next) => onChange(next ? lastTime : null)}
          trackColor={{ false: colors.disabled, true: colors.accent }}
        />
      </View>
      {enabled && permission === 'denied' ? (
        <View style={styles.warning}>
          <Text variant="caption" color={colors.danger} style={styles.warningText}>
            Уведомления запрещены в настройках iOS — время сохранится, но напоминание не придёт
          </Text>
          <PressableScale onPress={() => Linking.openSettings()}>
            <Text variant="caption" color={colors.accent}>
              Настройки
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
    gap: spacing.sm,
  },
  label: {
    flex: 1,
    gap: spacing.xs,
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
