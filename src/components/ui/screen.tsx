import { StyleSheet } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

/**
 * Screen background plus safe-area padding.
 *
 * Tab screens keep the default `edges`: native tabs give every tab screen its own
 * SafeAreaProvider, so the bottom inset there already accounts for the tab bar.
 * A screen rendered under a native header must pass `edges={['bottom']}` — the stack
 * reuses the root provider, so its top inset is the window inset and would add another
 * status bar of padding below the header.
 */
export function Screen({ style, ...rest }: SafeAreaViewProps) {
  const { colors } = useTheme();
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
