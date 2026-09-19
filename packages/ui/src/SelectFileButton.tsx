import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {theme} from './theme';

type SelectFileButtonProps = {
  onPress: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function SelectFileButton({
  onPress,
  label = 'Select file',
  style,
  compact = false,
}: SelectFileButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        compact && styles.compact,
        pressed && styles.pressed,
        style,
      ]}>
      <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: theme.accentText,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  compactLabel: {
    fontSize: 13,
  },
});
