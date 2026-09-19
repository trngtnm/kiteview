import React, {useRef, useState} from 'react';
import {
  Animated,
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
  const [hovered, setHovered] = useState(false);
  const hoverProgress = useRef(new Animated.Value(0)).current;

  const setHover = (value: boolean) => {
    setHovered(value);
    Animated.timing(hoverProgress, {
      toValue: value ? 1 : 0,
      duration: value ? 650 : 450,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({pressed}) => [
        styles.button,
        compact && styles.compact,
        hovered && styles.hovered,
        style,
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.hoverFill, {opacity: hoverProgress}]}
      />
      <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#367EDB',
    borderWidth: 1,
    borderColor: '#79AFFF',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
  },
  compact: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pressed: {
    opacity: 0.85,
  },
  hoverFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  hovered: {
    backgroundColor: '#4B91E7',
    borderColor: '#A8CBF8',
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
