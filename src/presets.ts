import type { RenderStyle } from './qr/render';

export type Preset = {
  id: string;
  name: string;
  style: Partial<RenderStyle>;
};

/**
 * Curated looks. Every one of these is covered by the artwork test suite and
 * reads at least as well as a plain black-and-white code, so the presets are
 * safe to pick blind.
 */
export const PRESETS: Preset[] = [
  {
    id: 'classic',
    name: 'Classic',
    style: {
      moduleStyle: 'square', eyeFrameStyle: 'square', eyeBallStyle: 'square',
      foreground: '#000000', background: '#FFFFFF', moduleGap: 0, backgroundRadius: 0,
      gradient: undefined, eyeColor: undefined,
    },
  },
  {
    id: 'soft',
    name: 'Soft',
    style: {
      moduleStyle: 'rounded', eyeFrameStyle: 'rounded', eyeBallStyle: 'rounded',
      foreground: '#14161C', background: '#FFFFFF', moduleGap: 0.06, backgroundRadius: 3,
      gradient: undefined, eyeColor: undefined,
    },
  },
  {
    id: 'ink',
    name: 'Ink',
    style: {
      moduleStyle: 'classy', eyeFrameStyle: 'rounded', eyeBallStyle: 'circle',
      foreground: '#0B1F3A', background: '#F4F1EA', moduleGap: 0, backgroundRadius: 3,
      gradient: undefined, eyeColor: undefined,
    },
  },
  {
    id: 'dotmatrix',
    name: 'Dot matrix',
    style: {
      moduleStyle: 'dot', eyeFrameStyle: 'circle', eyeBallStyle: 'circle',
      foreground: '#111318', background: '#FFFFFF', moduleGap: 0, backgroundRadius: 4,
      gradient: undefined, eyeColor: undefined,
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    style: {
      moduleStyle: 'rounded', eyeFrameStyle: 'leaf', eyeBallStyle: 'leaf',
      foreground: '#14432A', background: '#EDF4EE', moduleGap: 0.05, backgroundRadius: 3,
      gradient: undefined, eyeColor: undefined,
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    style: {
      moduleStyle: 'rounded', eyeFrameStyle: 'rounded', eyeBallStyle: 'rounded',
      foreground: '#7A1F2B', background: '#FFF8F2', moduleGap: 0.05, backgroundRadius: 3,
      eyeColor: '#3A0E15', gradient: undefined,
    },
  },
  {
    id: 'dusk',
    name: 'Dusk',
    style: {
      moduleStyle: 'fluid', eyeFrameStyle: 'rounded', eyeBallStyle: 'circle',
      foreground: '#000000', background: '#FFFFFF', moduleGap: 0, backgroundRadius: 4,
      eyeColor: undefined,
      gradient: {
        type: 'linear', angle: 45,
        stops: [{ offset: 0, color: '#3B1D6E' }, { offset: 1, color: '#0E7490' }],
      },
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    style: {
      moduleStyle: 'rounded', eyeFrameStyle: 'shield', eyeBallStyle: 'rounded',
      foreground: '#000000', background: '#FFF7ED', moduleGap: 0.05, backgroundRadius: 4,
      eyeColor: undefined,
      gradient: {
        type: 'linear', angle: 120,
        stops: [{ offset: 0, color: '#B4400F' }, { offset: 1, color: '#7A1750' }],
      },
    },
  },
  {
    id: 'graphite',
    name: 'Graphite',
    style: {
      moduleStyle: 'classy', eyeFrameStyle: 'square', eyeBallStyle: 'square',
      foreground: '#1C1F26', background: '#E9EAEC', moduleGap: 0, backgroundRadius: 0,
      gradient: undefined, eyeColor: undefined,
    },
  },
  {
    id: 'orbit',
    name: 'Orbit',
    style: {
      moduleStyle: 'rounded', eyeFrameStyle: 'circle', eyeBallStyle: 'circle',
      foreground: '#000000', background: '#FFFFFF', moduleGap: 0.05, backgroundRadius: 30,
      eyeColor: undefined,
      gradient: {
        type: 'radial', angle: 0,
        stops: [{ offset: 0, color: '#1E3A8A' }, { offset: 1, color: '#0B1120' }],
      },
    },
  },
];

/** Palettes offered in the colour picker, chosen to clear the contrast bar. */
export const FOREGROUND_SWATCHES = [
  '#000000', '#14161C', '#0B1F3A', '#14432A', '#4C1D95',
  '#7A1F2B', '#164E63', '#3F2E1E', '#1F2937', '#5B21B6',
];

export const BACKGROUND_SWATCHES = [
  '#FFFFFF', '#F7F5F0', '#F4F1EA', '#EDF4EE', '#FFF8F2',
  '#EEF2FF', '#E9EAEC', '#FFFBEB', '#F0FDFA', 'transparent',
];

export const GRADIENT_PRESETS: { name: string; stops: { offset: number; color: string }[] }[] = [
  { name: 'Dusk', stops: [{ offset: 0, color: '#3B1D6E' }, { offset: 1, color: '#0E7490' }] },
  { name: 'Ember', stops: [{ offset: 0, color: '#B4400F' }, { offset: 1, color: '#7A1750' }] },
  { name: 'Pine', stops: [{ offset: 0, color: '#14432A' }, { offset: 1, color: '#134E4A' }] },
  { name: 'Steel', stops: [{ offset: 0, color: '#111827' }, { offset: 1, color: '#3F4A5F' }] },
  { name: 'Plum', stops: [{ offset: 0, color: '#581C87' }, { offset: 1, color: '#9D174D' }] },
];
