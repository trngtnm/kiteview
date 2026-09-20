import React, {createContext, useContext, useMemo} from 'react';
import type {ColorScheme, Theme} from './theme';
import {themeForScheme} from './theme';

type ThemeContextValue = {
  scheme: ColorScheme;
  theme: Theme;
};

const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'light',
  theme: themeForScheme('light'),
});

type ThemeProviderProps = {
  scheme: ColorScheme;
  children: React.ReactNode;
};

export function ThemeProvider({scheme, children}: ThemeProviderProps) {
  const value = useMemo(
    () => ({
      scheme,
      theme: themeForScheme(scheme),
    }),
    [scheme],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useColorScheme(): ColorScheme {
  return useContext(ThemeContext).scheme;
}
