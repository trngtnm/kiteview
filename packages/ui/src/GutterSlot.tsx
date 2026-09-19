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
 * Left: definitions; right: form fields after opt-in detect.
 */
export function GutterSlot({side, style, children}: GutterSlotProps) {
  const isLeft = side === 'left';
  const isRight = side === 'right';
  return (
    <View
      accessibilityLabel={`${side} annotation gutter`}
      style={[
        styles.gutter,
        isLeft && styles.leftGutter,
        isRight && styles.rightGutter,
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
  rightGutter: {
    alignItems: 'stretch',
    overflow: 'hidden',
  },
});
