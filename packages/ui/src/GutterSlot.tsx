import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {theme} from './theme';

type GutterSlotProps = {
  side: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/**
 * Side margin next to the PDF column.
 * Left gutter hosts the definition panel and clips overflow so it cannot cover the PDF.
 */
export function GutterSlot({side, style, children}: GutterSlotProps) {
  const isLeft = side === 'left';
  return (
    <View
      accessibilityLabel={`${side} annotation gutter`}
      style={[
        styles.gutter,
        isLeft && styles.leftGutter,
        style,
      ]}>
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
  leftGutter: {
    alignItems: 'stretch',
    overflow: 'hidden',
  },
});
