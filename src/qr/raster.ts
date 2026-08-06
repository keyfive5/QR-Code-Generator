/**
 * Colour maths and an analytic rasteriser for the artwork model.
 *
 * "Analytic" means there is no drawing surface involved: a point is tested
 * directly against the shape list, so this runs identically on device, in
 * node, and in a browser, with no canvas dependency.
 */

import type { Artwork, Gradient, Shape } from './render.ts';

export type Rgba = { r: number; g: number; b: number; a: number };

const NAMED: Record<string, Rgba> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
};

// Colour strings are re-parsed for every sample of every module otherwise,
// which dominates the cost of both rasterising and verifying.
const colorCache = new Map<string, Rgba>();

export function parseColor(css: string): Rgba {
  const hit = colorCache.get(css);
  if (hit) return hit;
  const parsed = parseColorUncached(css);
  if (colorCache.size < 512) colorCache.set(css, parsed);
  return parsed;
}

function parseColorUncached(css: string): Rgba {
  const s = css.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];

  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const expand = (c: string) => parseInt(c + c, 16);
    if (hex.length === 3 || hex.length === 4) {
      return {
        r: expand(hex[0]),
        g: expand(hex[1]),
        b: expand(hex[2]),
        a: hex.length === 4 ? expand(hex[3]) / 255 : 1,
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 };
  }
  // Unknown colour strings are treated as opaque black rather than throwing;
  // a wrong shade is better than a crashed preview.
  return { r: 0, g: 0, b: 0, a: 1 };
}

// sRGB -> linear, tabulated. The three Math.pow calls per sample are
// otherwise the second-largest cost after colour parsing.
const LINEARIZE = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const x = i / 255;
  LINEARIZE[i] = x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(c: Rgba): number {
  const r = LINEARIZE[c.r < 0 ? 0 : c.r > 255 ? 255 : c.r | 0];
  const g = LINEARIZE[c.g < 0 ? 0 : c.g > 255 ? 255 : c.g | 0];
  const b = LINEARIZE[c.b < 0 ? 0 : c.b > 255 ? 255 : c.b | 0];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function mixOver(fg: Rgba, bg: Rgba): Rgba {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

/* ------------------------------------------------------------------ */
/* Point-in-shape tests                                                 */
/* ------------------------------------------------------------------ */

export function pointInShape(s: Shape, px: number, py: number): boolean {
  if (s.kind === 'circle') {
    const dx = px - s.cx;
    const dy = py - s.cy;
    return dx * dx + dy * dy <= s.r * s.r;
  }
  if (s.kind === 'polygon') {
    let inside = false;
    const pts = s.points;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  const { x, y, w, h } = s;
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const max = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = s.r.map((r) => Math.max(0, Math.min(max, r)));
  // Only the corner squares need the circular test.
  if (tl > 0 && px < x + tl && py < y + tl) {
    return (px - (x + tl)) ** 2 + (py - (y + tl)) ** 2 <= tl * tl;
  }
  if (tr > 0 && px > x + w - tr && py < y + tr) {
    return (px - (x + w - tr)) ** 2 + (py - (y + tr)) ** 2 <= tr * tr;
  }
  if (br > 0 && px > x + w - br && py > y + h - br) {
    return (px - (x + w - br)) ** 2 + (py - (y + h - br)) ** 2 <= br * br;
  }
  if (bl > 0 && px < x + bl && py > y + h - bl) {
    return (px - (x + bl)) ** 2 + (py - (y + h - bl)) ** 2 <= bl * bl;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Gradient evaluation                                                  */
/* ------------------------------------------------------------------ */

export function evaluateGradient(g: Gradient, px: number, py: number, extent: number): Rgba {
  let t: number;
  if (g.type === 'radial') {
    const dx = px - extent / 2;
    const dy = py - extent / 2;
    t = Math.sqrt(dx * dx + dy * dy) / (extent * 0.7);
  } else {
    const rad = (g.angle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    // Project onto the gradient axis, normalised across the artwork.
    const cx = px / extent - 0.5;
    const cy = py / extent - 0.5;
    t = (cx * dx + cy * dy) + 0.5;
  }
  t = Math.max(0, Math.min(1, t));

  const stops = g.stops.slice().sort((a, b) => a.offset - b.offset);
  if (stops.length === 0) return { r: 0, g: 0, b: 0, a: 1 };
  if (t <= stops[0].offset) return parseColor(stops[0].color);
  if (t >= stops[stops.length - 1].offset) return parseColor(stops[stops.length - 1].color);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].offset) {
      const a = stops[i - 1];
      const b = stops[i];
      const span = b.offset - a.offset || 1;
      const k = (t - a.offset) / span;
      const ca = parseColor(a.color);
      const cb = parseColor(b.color);
      return {
        r: ca.r + (cb.r - ca.r) * k,
        g: ca.g + (cb.g - ca.g) * k,
        b: ca.b + (cb.b - ca.b) * k,
        a: ca.a + (cb.a - ca.a) * k,
      };
    }
  }
  return parseColor(stops[stops.length - 1].color);
}

/* ------------------------------------------------------------------ */
/* Sampling                                                             */
/* ------------------------------------------------------------------ */

/**
 * One-module-per-cell bucket index over the shape list. Without it a sample
 * would test every shape in the symbol, which turns a full-resolution raster
 * into billions of point tests.
 */
export type ShapeIndex = { cells: number[][]; width: number };

function shapeBounds(s: Shape): [number, number, number, number] {
  if (s.kind === 'circle') return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
  if (s.kind === 'polygon') {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of s.points) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  }
  return [s.x, s.y, s.x + s.w, s.y + s.h];
}

const indexCache = new WeakMap<Artwork, ShapeIndex>();

export function shapeIndex(art: Artwork): ShapeIndex {
  const cached = indexCache.get(art);
  if (cached) return cached;

  const width = Math.ceil(art.extent);
  const cells: number[][] = new Array(width * width);
  for (let i = 0; i < art.shapes.length; i++) {
    const [x0, y0, x1, y1] = shapeBounds(art.shapes[i]);
    const cx0 = Math.max(0, Math.floor(x0));
    const cy0 = Math.max(0, Math.floor(y0));
    const cx1 = Math.min(width - 1, Math.floor(x1));
    const cy1 = Math.min(width - 1, Math.floor(y1));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const k = cy * width + cx;
        (cells[k] ||= []).push(i);
      }
    }
  }
  const index = { cells, width };
  indexCache.set(art, index);
  return index;
}

// Sheets and screens behind a transparent export are treated as white.
const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/** Colour of the artwork at a point in module coordinates. */
export function sampleColorAt(art: Artwork, px: number, py: number): Rgba {
  const bg = art.background === 'transparent' ? WHITE : parseColor(art.background);
  const index = shapeIndex(art);
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  if (cx < 0 || cy < 0 || cx >= index.width || cy >= index.width) return bg;
  const bucket = index.cells[cy * index.width + cx];
  if (!bucket) return bg;

  // Painter's order: the last shape containing the point wins.
  for (let i = bucket.length - 1; i >= 0; i--) {
    const s = art.shapes[bucket[i]];
    if (pointInShape(s, px, py)) {
      const c =
        s.fill.kind === 'gradient'
          ? evaluateGradient(art.gradient!, px, py, art.extent)
          : parseColor(s.fill.color);
      return c.a >= 1 ? c : mixOver(c, bg);
    }
  }
  return bg;
}

export type Raster = { data: Uint8ClampedArray; width: number; height: number };

/**
 * Renders the artwork to an RGBA buffer. Used by the test suite to hand real
 * pixels to an independent third-party decoder.
 */
export function rasterize(art: Artwork, pixelSize: number, supersample = 2): Raster {
  const data = new Uint8ClampedArray(pixelSize * pixelSize * 4);
  const scale = art.extent / pixelSize;
  const step = 1 / supersample;
  const samples = supersample * supersample;

  for (let py = 0; py < pixelSize; py++) {
    for (let px = 0; px < pixelSize; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const mx = (px + (sx + 0.5) * step) * scale;
          const my = (py + (sy + 0.5) * step) * scale;
          const c = sampleColorAt(art, mx, my);
          r += c.r;
          g += c.g;
          b += c.b;
        }
      }
      const i = (py * pixelSize + px) * 4;
      data[i] = r / samples;
      data[i + 1] = g / samples;
      data[i + 2] = b / samples;
      data[i + 3] = 255;
    }
  }
  return { data, width: pixelSize, height: pixelSize };
}
