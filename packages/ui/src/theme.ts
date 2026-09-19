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
  windowBg: '#F7F8FA',
  railBg: '#FFFFFF',
  railBorder: '#E1E5EB',
  stageBg: '#F7F8FA',
  pageSurface: '#FFFFFF',
  textPrimary: '#172235',
  textSecondary: '#6B7890',
  accent: '#2D7FF9',
  accentText: '#FFFFFF',
  gutterBg: 'transparent',
};

/** Max width of the centered PDF column (Fora-style gutters on the sides). */
export const PDF_COLUMN_MAX_WIDTH = 820;
export const RAIL_WIDTH = 220;
export const GUTTER_MIN_WIDTH = 120;
/** Space reserved so overlay gutters do not cover the stage scrollbar. */
export const STAGE_SCROLLBAR_WIDTH = 16;
