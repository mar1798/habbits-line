import { StyleSheet } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

export function Screen({ style, ...rest }: SafeAreaViewProps) {
  const { colors } = useTheme();
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
