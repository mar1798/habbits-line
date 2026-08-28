import { SFSymbol, SymbolView } from 'expo-symbols';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { minHitSlop, radius } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

import { PressableScale } from './pressable-scale';

type IconButtonProps = {
  name: SFSymbol;
  onPress: () => void;
  /** Required: an icon alone gives VoiceOver nothing to announce. */
  accessibilityLabel: string;
  disabled?: boolean;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  disabled,
  size = 20,
  color,
  backgroundColor,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[
        styles.base,
        { backgroundColor: disabled ? colors.disabled : (backgroundColor ?? colors.surfaceAlt) },
        style,
      ]}>
      <SymbolView
        name={name}
        size={size}
        tintColor={disabled ? colors.textTertiary : (color ?? colors.textPrimary)}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: minHitSlop,
    height: minHitSlop,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
