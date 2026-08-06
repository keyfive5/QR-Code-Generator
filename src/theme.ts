import { Platform } from 'react-native';

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceHi: string;
  border: string;
  borderStrong: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  excellent: string;
  good: string;
  risky: string;
  fails: string;
  /** Paper the preview sits on, so a white code stays visible in dark mode. */
  paper: string;
  scrim: string;
};

const dark: Palette = {
  bg: '#0A0B0E',
  surface: '#141721',
  surfaceAlt: '#1B1F2B',
  surfaceHi: '#242938',
  border: '#252A38',
  borderStrong: '#39405480',
  text: '#F4F5F8',
  textDim: '#9CA3B4',
  textFaint: '#6A7285',
  accent: '#7C6CF6',
  accentSoft: '#7C6CF622',
  onAccent: '#FFFFFF',
  excellent: '#38D39A',
  good: '#8FD14F',
  risky: '#F5A524',
  fails: '#F0466E',
  paper: '#E9EAEE',
  scrim: '#00000099',
};

const light: Palette = {
  bg: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F1F4',
  surfaceHi: '#E7E9EE',
  border: '#E2E4EA',
  borderStrong: '#CDD1DA',
  text: '#111420',
  textDim: '#5C6478',
  textFaint: '#8A91A3',
  accent: '#5B48E0',
  accentSoft: '#5B48E014',
  onAccent: '#FFFFFF',
  excellent: '#12A06B',
  good: '#5C9E1F',
  risky: '#C77700',
  fails: '#D62B54',
  paper: '#FFFFFF',
  scrim: '#0A0B0E88',
};

export const palettes = { dark, light };

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
};

export const type = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.6 },
  title: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.35 },
  heading: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.1 },
  caption: { fontSize: 12, fontWeight: '500' as const },
  mono: {
    fontSize: 12.5,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
};

export function gradeColor(p: Palette, grade: string): string {
  switch (grade) {
    case 'excellent': return p.excellent;
    case 'good': return p.good;
    case 'risky': return p.risky;
    default: return p.fails;
  }
}

export const GRADE_LABEL: Record<string, string> = {
  excellent: 'Verified',
  good: 'Verified',
  risky: 'Risky',
  fails: "Won't scan",
};
