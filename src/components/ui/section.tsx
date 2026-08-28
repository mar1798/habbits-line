import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { spacing } from '@/constants/design-tokens';

import { Text } from './text';

type SectionProps = PropsWithChildren<{
  title?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function Section({ title, children, style }: SectionProps) {
  return (
    <View style={[styles.container, style]}>
      {title ? (
        <Text variant="title2" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
});
