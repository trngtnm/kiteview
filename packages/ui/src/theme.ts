export type Theme = {
  windowBg: string;
  railBg: string;
  railBorder: string;
  stageBg: string;
  pageSurface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentText: string;
  gutterBg: string;
};

export const theme: Theme = {
  windowBg: '#1C1C1E',
  railBg: '#2C2C2E',
  railBorder: '#3A3A3C',
  stageBg: '#F5F5F7',
  pageSurface: '#FFFFFF',
  textPrimary: '#1D1D1F',
  textSecondary: '#6E6E73',
  accent: '#0071E3',
  accentText: '#FFFFFF',
  gutterBg: 'transparent',
};

/** Max width of the centered PDF column (Fora-style gutters on the sides). */
export const PDF_COLUMN_MAX_WIDTH = 820;
export const RAIL_WIDTH = 200;
export const GUTTER_MIN_WIDTH = 120;
