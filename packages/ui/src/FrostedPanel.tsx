import React, {type ComponentType, type ReactNode} from 'react';
import {
  Platform,
  StyleSheet,
  UIManager,
  View,
  type StyleProp,
  type ViewStyle,
  requireNativeComponent,
} from 'react-native';
import type {ColorScheme} from './theme';
import {useColorScheme} from './ThemeProvider';

export type FrostedPanelChrome = {
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  chipBg: string;
  chipBgActive: string;
  chipText: string;
  chipTextActive: string;
  inputBg: string;
  inputBorder: string;
  border: string;
  danger: string;
};

const lightChrome: FrostedPanelChrome = {
  textPrimary: '#172235',
  textSecondary: '#6B7890',
  accent: '#2D7FF9',
  accentText: '#FFFFFF',
  chipBg: 'rgba(23, 34, 53, 0.08)',
  chipBgActive: '#2D7FF9',
  chipText: '#6B7890',
  chipTextActive: '#FFFFFF',
  inputBg: 'rgba(255, 255, 255, 0.72)',
  inputBorder: 'rgba(23, 34, 53, 0.14)',
  border: '#79AFFF',
  danger: '#C62828',
};

const darkChrome: FrostedPanelChrome = {
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
};

/** @deprecated Prefer frostedPanelChromeFor(scheme) */
export const frostedPanelChrome = darkChrome;

export function frostedPanelChromeFor(scheme: ColorScheme): FrostedPanelChrome {
  return scheme === 'light' ? lightChrome : darkChrome;
}

type FrostedPanelProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Defaults to the active ThemeProvider scheme. */
  scheme?: ColorScheme;
};

type NativeProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  accessibilityLabel?: string;
  colorScheme?: ColorScheme;
};

const NATIVE_NAME = 'KiteViewVibrancyView';

let NativeVibrancyView: ComponentType<NativeProps> | null = null;

function resolveNativeVibrancy(): ComponentType<NativeProps> | null {
  if (Platform.OS !== 'macos') return null;
  if (NativeVibrancyView) return NativeVibrancyView;
  try {
    const hasConfig =
      (typeof UIManager.getViewManagerConfig === 'function' &&
        UIManager.getViewManagerConfig(NATIVE_NAME) != null) ||
      (typeof (UIManager as {hasViewManagerConfig?: (n: string) => boolean})
        .hasViewManagerConfig === 'function' &&
        (
          UIManager as {hasViewManagerConfig: (n: string) => boolean}
        ).hasViewManagerConfig(NATIVE_NAME));
    if (!hasConfig) return null;
    NativeVibrancyView = requireNativeComponent<NativeProps>(NATIVE_NAME);
    return NativeVibrancyView;
  } catch {
    return null;
  }
}

/**
 * Translucent blurred panel shell (NSVisualEffectView on macOS).
 * Follows light/dark scheme for material + fallback fill.
 */
export function FrostedPanel({
  children,
  style,
  accessibilityLabel,
  scheme: schemeProp,
}: FrostedPanelProps) {
  const themeScheme = useColorScheme();
  const scheme = schemeProp ?? themeScheme;
  const NativeView = resolveNativeVibrancy();

  if (NativeView) {
    return (
      <NativeView
        accessibilityLabel={accessibilityLabel}
        colorScheme={scheme}
        style={[styles.native, style]}>
        {children}
      </NativeView>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.fallback,
        scheme === 'light' ? styles.fallbackLight : styles.fallbackDark,
        style,
      ]}>
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
    overflow: 'hidden',
  },
  fallbackLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
  },
  fallbackDark: {
    backgroundColor: 'rgba(18, 22, 30, 0.78)',
  },
});
