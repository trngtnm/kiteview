import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {theme} from './theme';

type GutterSlotProps = {
  side: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * Reserved side margin for future AI annotations / comments / descriptions.
 * Currently empty — keep width so the PDF column stays centered Fora-style.
 */
export function GutterSlot({side, style, children}: GutterSlotProps) {
  return (
    <View
      accessibilityLabel={`${side} annotation gutter`}
      style={[styles.gutter, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: {
    flex: 1,
    minWidth: 120,
    backgroundColor: theme.gutterBg,
  },
});
