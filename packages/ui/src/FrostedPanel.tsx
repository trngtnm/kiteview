import React, {
  type ComponentType,
  type ReactNode,
  useEffect,
  useState,
} from 'react';
import {
  Platform,
  StyleSheet,
  UIManager,
  View,
  type StyleProp,
  type ViewStyle,
  requireNativeComponent,
} from 'react-native';

/** Light-on-dark tokens for frosted definition / annotation panels. */
export const frostedPanelChrome = {
  textPrimary: '#F2F4F8',
  textSecondary: '#A8B2C4',
  accent: '#79AFFF',
  accentText: '#FFFFFF',
  chipBg: 'rgba(255, 255, 255, 0.12)',
  chipBgActive: 'rgba(121, 175, 255, 0.9)',
  chipText: '#C5CEDC',
  chipTextActive: '#FFFFFF',
  inputBg: 'rgba(0, 0, 0, 0.28)',
  inputBorder: 'rgba(255, 255, 255, 0.18)',
  border: 'rgba(121, 175, 255, 0.55)',
  danger: '#FF8A80',
  shadow: '#000000',
} as const;

type FrostedPanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

type NativeProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  accessibilityLabel?: string;
};

const NATIVE_NAME = 'KiteViewVibrancyView';

let cachedNative: ComponentType<NativeProps> | null | undefined;

function getNativeVibrancy(): ComponentType<NativeProps> | null {
  if (cachedNative !== undefined) return cachedNative;
  if (Platform.OS !== 'macos') {
    cachedNative = null;
    return null;
  }
  try {
    const config =
      typeof UIManager.getViewManagerConfig === 'function'
        ? UIManager.getViewManagerConfig(NATIVE_NAME)
        : null;
    if (config == null) {
      return null;
    }
    cachedNative = requireNativeComponent<NativeProps>(NATIVE_NAME);
    return cachedNative;
  } catch {
    cachedNative = null;
    return null;
  }
}

/**
 * Dark translucent blurred panel shell (NSVisualEffectView on macOS).
 * Falls back to a dark translucent fill when the native view isn't linked yet.
 */
export function FrostedPanel({
  children,
  style,
  accessibilityLabel,
}: FrostedPanelProps) {
  const [NativeView, setNativeView] = useState<ComponentType<NativeProps> | null>(
    () => getNativeVibrancy(),
  );

  useEffect(() => {
    if (NativeView || cachedNative === null) return;
    const id = setInterval(() => {
      const next = getNativeVibrancy();
      if (next) {
        setNativeView(next);
        clearInterval(id);
      } else if (cachedNative === null) {
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [NativeView]);

  if (NativeView) {
    return (
      <NativeView
        accessibilityLabel={accessibilityLabel}
        style={[styles.native, style]}>
        {children}
      </NativeView>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.fallback, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  native: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: 'rgba(18, 22, 30, 0.78)',
    overflow: 'hidden',
  },
});
