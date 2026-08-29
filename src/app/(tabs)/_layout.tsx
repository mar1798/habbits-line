import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useI18n } from '@/hooks/use-i18n';
import { useTheme } from '@/hooks/use-theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      tintColor={colors.accent}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.accent },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tab_habits')}</NativeTabs.Trigger.Label>
        {/*
          The app's own mark instead of an SF Symbol. `template` makes iOS tint it with
          the icon colors above, so one image covers both the default and selected
          states — the PNGs are the icon.svg mark, minus its background square, built by
          scripts/build-tab-icon.py. The @1x file the path names is deliberately absent —
          no iOS device runs at that scale, and the suffixed variants resolve without it.
        */}
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tab-habits.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <NativeTabs.Trigger.Label>{t('tab_stats')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('tab_settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
