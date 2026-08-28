import { SFSymbol, SymbolView } from 'expo-symbols';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { minHitSlop, radius } from '@/constants/design-tokens';
import { useTheme } from '@/hooks/use-theme';

import { PressableScale } from './pressable-scale';

type IconButtonProps = {
  name: SFSymbol;
  onPress: () => void;
  size?: number;
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ name, onPress, size = 20, color, backgroundColor, style }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.base, { backgroundColor: backgroundColor ?? colors.surfaceAlt }, style]}>
      <SymbolView name={name} size={size} tintColor={color ?? colors.textPrimary} />
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
