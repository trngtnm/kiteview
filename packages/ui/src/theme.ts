export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  windowBg: string;
  railBg: string;
  railHeaderBg: string;
  railBorder: string;
  stageBg: string;
  pageSurface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentHover: string;
  accentBorder: string;
  accentText: string;
  gutterBg: string;
  chipBg: string;
  chipBgActive: string;
  chipText: string;
  chipTextActive: string;
  inputBg: string;
  inputBorder: string;
  danger: string;
  hoverFill: string;
  tabBg: string;
  tabBgActive: string;
  tabBorder: string;
  tabBorderActive: string;
  fileBarBg: string;
  fileInputBg: string;
  shadow: string;
};

export const lightTheme: Theme = {
  scheme: 'light',
  windowBg: '#F7F8FA',
  railBg: '#FDFEFF',
  railHeaderBg: '#F7FAFE',
  railBorder: '#E1E5EB',
  stageBg: '#F7F8FA',
  pageSurface: '#FFFFFF',
  textPrimary: '#172235',
  textSecondary: '#6B7890',
  accent: '#2D7FF9',
  accentHover: '#4B91E7',
  accentBorder: '#79AFFF',
  accentText: '#FFFFFF',
  gutterBg: 'transparent',
  chipBg: '#F0F0F2',
  chipBgActive: '#2D7FF9',
  chipText: '#6B7890',
  chipTextActive: '#FFFFFF',
  inputBg: '#F7F8FA',
  inputBorder: '#E1E5EB',
  danger: '#C62828',
  hoverFill: 'rgba(255, 255, 255, 0.28)',
  tabBg: '#EEF4FB',
  tabBgActive: '#DCEBFC',
  tabBorder: '#E4E9F0',
  tabBorderActive: '#B7D2FA',
  fileBarBg: '#FFFFFF',
  fileInputBg: 'rgba(255, 255, 255, 0.92)',
  shadow: '#000000',
};

export const darkTheme: Theme = {
  scheme: 'dark',
  windowBg: '#0F1218',
  railBg: '#161B24',
  railHeaderBg: '#1A2130',
  railBorder: '#2A3344',
  stageBg: '#0F1218',
  pageSurface: '#1C2433',
  textPrimary: '#E8EDF5',
  textSecondary: '#9AA8BC',
  accent: '#4B91E7',
  accentHover: '#6AA4EE',
  accentBorder: '#3D6FB0',
  accentText: '#FFFFFF',
  gutterBg: 'transparent',
  chipBg: '#2A3344',
  chipBgActive: '#4B91E7',
  chipText: '#9AA8BC',
  chipTextActive: '#FFFFFF',
  inputBg: '#121820',
  inputBorder: '#2A3344',
  danger: '#EF5350',
  hoverFill: 'rgba(255, 255, 255, 0.12)',
  tabBg: '#1E2736',
  tabBgActive: '#243247',
  tabBorder: '#2A3344',
  tabBorderActive: '#3D6FB0',
  fileBarBg: '#161B24',
  fileInputBg: 'rgba(28, 36, 51, 0.96)',
  shadow: '#000000',
};

/** @deprecated Prefer useTheme(); kept as light default for static fallbacks. */
export const theme: Theme = lightTheme;

export function themeForScheme(scheme: ColorScheme): Theme {
  return scheme === 'dark' ? darkTheme : lightTheme;
}

/** Max width of the centered PDF column (Fora-style gutters on the sides). */
export const PDF_COLUMN_MAX_WIDTH = 820;
export const RAIL_WIDTH = 220;
export const GUTTER_MIN_WIDTH = 120;
/** Space reserved so overlay gutters do not cover the stage scrollbar. */
export const STAGE_SCROLLBAR_WIDTH = 16;
