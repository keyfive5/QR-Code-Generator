/**
 * Artwork model and SVG serialiser.
 *
 * The renderer does not emit SVG directly. It first builds a list of
 * primitive shapes in module coordinates, and *that* list is what both the
 * SVG serialiser and the rasteriser consume. The consequence matters: the
 * scan check in `verify.ts` measures the same geometry that gets exported,
 * not an idealised black-and-white grid that happens to look similar.
 */

import { isDark } from './encode.ts';
import type { QrCode } from './encode.ts';

export type ModuleStyle = 'square' | 'rounded' | 'dot' | 'diamond' | 'classy' | 'fluid';
export type EyeFrameStyle = 'square' | 'rounded' | 'circle' | 'leaf' | 'shield';
export type EyeBallStyle = 'square' | 'rounded' | 'circle' | 'diamond' | 'leaf';

export type Gradient = {
  type: 'linear' | 'radial';
  /** Degrees clockwise from "left to right". Ignored for radial. */
  angle: number;
  stops: { offset: number; color: string }[];
};

export type LogoSpec = {
  /** Logo width as a fraction of the symbol width, excluding quiet zone. */
  scale: number;
  /** Background ring around the logo, in modules. */
  padding: number;
  shape: 'square' | 'rounded' | 'circle';
  /** Image source for the SVG output. The geometry alone drives verification. */
  href?: string;
};

export type RenderStyle = {
  moduleStyle: ModuleStyle;
  eyeFrameStyle: EyeFrameStyle;
  eyeBallStyle: EyeBallStyle;
  foreground: string;
  background: string;
  /** Overrides `foreground` for the three finder patterns. */
  eyeColor?: string;
  gradient?: Gradient;
  /** Quiet zone width in modules. The standard requires at least 4. */
  quietZone: number;
  /** 0 to 0.3 — shrinks each module to open up space between them. */
  moduleGap: number;
  /** Background corner rounding, in modules. */
  backgroundRadius: number;
  logo?: LogoSpec;
};

export const DEFAULT_STYLE: RenderStyle = {
  moduleStyle: 'square',
  eyeFrameStyle: 'square',
  eyeBallStyle: 'square',
  foreground: '#000000',
  background: '#FFFFFF',
  quietZone: 4,
  moduleGap: 0,
  backgroundRadius: 0,
};

/* ------------------------------------------------------------------ */
/* Primitive shapes                                                     */
/* ------------------------------------------------------------------ */

export type Fill = { kind: 'solid'; color: string } | { kind: 'gradient' };

/** Rounded rectangle with independent corner radii: [tl, tr, br, bl]. */
export type RRect = {
  kind: 'rrect';
  x: number;
  y: number;
  w: number;
  h: number;
  r: [number, number, number, number];
  fill: Fill;
};

export type Circle = { kind: 'circle'; cx: number; cy: number; r: number; fill: Fill };

export type Polygon = { kind: 'polygon'; points: [number, number][]; fill: Fill };

export type Shape = RRect | Circle | Polygon;

export type Artwork = {
  /** Width and height of the drawing in module units, quiet zone included. */
  extent: number;
  /** Painter's order: later shapes cover earlier ones. */
  shapes: Shape[];
  background: string;
  gradient?: Gradient;
  /** Region occupied by the logo image, in module coordinates. */
  logoBox?: { x: number; y: number; w: number; h: number };
  logo?: LogoSpec;
  style: RenderStyle;
  qr: QrCode;
};

function solid(color: string): Fill {
  return { kind: 'solid', color };
}

function inFinder(qr: QrCode, row: number, col: number): boolean {
  const s = qr.size;
  return (
    (row < 7 && col < 7) || (row < 7 && col >= s - 7) || (row >= s - 7 && col < 7)
  );
}

/* ------------------------------------------------------------------ */
/* Module shapes                                                        */
/* ------------------------------------------------------------------ */

function moduleShape(
  style: RenderStyle,
  qr: QrCode,
  row: number,
  col: number,
  ox: number,
  oy: number,
  fill: Fill,
): Shape {
  const gap = Math.max(0, Math.min(0.3, style.moduleGap));
  const inset = gap / 2;
  const x = col + ox + inset;
  const y = row + oy + inset;
  const w = 1 - gap;

  switch (style.moduleStyle) {
    case 'square':
      return { kind: 'rrect', x, y, w, h: w, r: [0, 0, 0, 0], fill };
    case 'rounded': {
      const r = w * 0.28;
      return { kind: 'rrect', x, y, w, h: w, r: [r, r, r, r], fill };
    }
    case 'dot':
      return { kind: 'circle', cx: x + w / 2, cy: y + w / 2, r: w / 2, fill };
    case 'diamond':
      return {
        kind: 'polygon',
        points: [
          [x + w / 2, y],
          [x + w, y + w / 2],
          [x + w / 2, y + w],
          [x, y + w / 2],
        ],
        fill,
      };
    case 'classy':
    case 'fluid': {
      // Round only the corners that are not shared with a neighbouring dark
      // module, which is what makes runs of modules read as one shape.
      const radius = style.moduleStyle === 'fluid' ? w * 0.5 : w * 0.42;
      const up = isDark(qr, row - 1, col);
      const down = isDark(qr, row + 1, col);
      const left = isDark(qr, row, col - 1);
      const right = isDark(qr, row, col + 1);
      const r: [number, number, number, number] = [
        !up && !left ? radius : 0,
        !up && !right ? radius : 0,
        !down && !right ? radius : 0,
        !down && !left ? radius : 0,
      ];
      return { kind: 'rrect', x, y, w, h: w, r, fill };
    }
  }
}

function eyeFrameShapes(
  style: RenderStyle,
  x: number,
  y: number,
  fill: Fill,
  background: string,
): Shape[] {
  const outer = (r: [number, number, number, number]): RRect => ({
    kind: 'rrect', x, y, w: 7, h: 7, r, fill,
  });
  const inner = (r: [number, number, number, number]): RRect => ({
    kind: 'rrect', x: x + 1, y: y + 1, w: 5, h: 5, r, fill: solid(background),
  });

  switch (style.eyeFrameStyle) {
    case 'square':
      return [outer([0, 0, 0, 0]), inner([0, 0, 0, 0])];
    case 'rounded':
      return [outer([1.9, 1.9, 1.9, 1.9]), inner([1.2, 1.2, 1.2, 1.2])];
    case 'circle':
      return [
        { kind: 'circle', cx: x + 3.5, cy: y + 3.5, r: 3.5, fill },
        { kind: 'circle', cx: x + 3.5, cy: y + 3.5, r: 2.5, fill: solid(background) },
      ];
    case 'leaf':
      return [outer([3.5, 0, 3.5, 0]), inner([2.5, 0, 2.5, 0])];
    case 'shield':
      return [outer([3.5, 3.5, 3.5, 0]), inner([2.5, 2.5, 2.5, 0])];
  }
}

function eyeBallShape(style: RenderStyle, x: number, y: number, fill: Fill): Shape {
  const bx = x + 2;
  const by = y + 2;
  switch (style.eyeBallStyle) {
    case 'square':
      return { kind: 'rrect', x: bx, y: by, w: 3, h: 3, r: [0, 0, 0, 0], fill };
    case 'rounded':
      return { kind: 'rrect', x: bx, y: by, w: 3, h: 3, r: [0.9, 0.9, 0.9, 0.9], fill };
    case 'circle':
      return { kind: 'circle', cx: bx + 1.5, cy: by + 1.5, r: 1.5, fill };
    case 'diamond':
      return {
        kind: 'polygon',
        points: [
          [bx + 1.5, by],
          [bx + 3, by + 1.5],
          [bx + 1.5, by + 3],
          [bx, by + 1.5],
        ],
        fill,
      };
    case 'leaf':
      return { kind: 'rrect', x: bx, y: by, w: 3, h: 3, r: [1.5, 0, 1.5, 0], fill };
  }
}

/* ------------------------------------------------------------------ */
/* Artwork assembly                                                     */
/* ------------------------------------------------------------------ */

export function buildArtwork(qr: QrCode, styleInput: Partial<RenderStyle> = {}): Artwork {
  const style: RenderStyle = { ...DEFAULT_STYLE, ...styleInput };
  const quiet = Math.max(0, Math.round(style.quietZone));
  const extent = qr.size + quiet * 2;
  const shapes: Shape[] = [];

  const moduleFill: Fill = style.gradient ? { kind: 'gradient' } : solid(style.foreground);
  const eyeFill: Fill = style.eyeColor
    ? solid(style.eyeColor)
    : style.gradient
      ? { kind: 'gradient' }
      : solid(style.foreground);

  // Data modules, skipping the three finder patterns which are styled below.
  for (let row = 0; row < qr.size; row++) {
    for (let col = 0; col < qr.size; col++) {
      if (!isDark(qr, row, col)) continue;
      if (inFinder(qr, row, col)) continue;
      shapes.push(moduleShape(style, qr, row, col, quiet, quiet, moduleFill));
    }
  }

  // Finder patterns.
  const corners: [number, number][] = [
    [quiet, quiet],
    [quiet + qr.size - 7, quiet],
    [quiet, quiet + qr.size - 7],
  ];
  for (const [cx, cy] of corners) {
    shapes.push(...eyeFrameShapes(style, cx, cy, eyeFill, style.background));
    shapes.push(eyeBallShape(style, cx, cy, eyeFill));
  }

  // Logo plate and image box.
  let logoBox: Artwork['logoBox'];
  if (style.logo && style.logo.scale > 0) {
    const scale = Math.max(0.05, Math.min(0.4, style.logo.scale));
    const w = qr.size * scale;
    const pad = Math.max(0, style.logo.padding);
    const cx = extent / 2;
    const plateW = w + pad * 2;
    const plate: Shape =
      style.logo.shape === 'circle'
        ? { kind: 'circle', cx, cy: cx, r: plateW / 2, fill: solid(style.background) }
        : {
            kind: 'rrect',
            x: cx - plateW / 2,
            y: cx - plateW / 2,
            w: plateW,
            h: plateW,
            r:
              style.logo.shape === 'rounded'
                ? [plateW * 0.22, plateW * 0.22, plateW * 0.22, plateW * 0.22]
                : [0, 0, 0, 0],
            fill: solid(style.background),
          };
    shapes.push(plate);
    logoBox = { x: cx - w / 2, y: cx - w / 2, w, h: w };
  }

  return {
    extent,
    shapes,
    background: style.background,
    gradient: style.gradient,
    logoBox,
    logo: style.logo,
    style,
    qr,
  };
}

/* ------------------------------------------------------------------ */
/* SVG serialisation                                                    */
/* ------------------------------------------------------------------ */

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function rrectPath(s: RRect): string {
  const { x, y, w, h } = s;
  const max = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = s.r.map((r) => Math.max(0, Math.min(max, r))) as [
    number, number, number, number,
  ];
  if (tl === 0 && tr === 0 && br === 0 && bl === 0) {
    return `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}z`;
  }
  const p: string[] = [];
  p.push(`M${fmt(x + tl)} ${fmt(y)}`);
  p.push(`H${fmt(x + w - tr)}`);
  if (tr) p.push(`A${fmt(tr)} ${fmt(tr)} 0 0 1 ${fmt(x + w)} ${fmt(y + tr)}`);
  p.push(`V${fmt(y + h - br)}`);
  if (br) p.push(`A${fmt(br)} ${fmt(br)} 0 0 1 ${fmt(x + w - br)} ${fmt(y + h)}`);
  p.push(`H${fmt(x + bl)}`);
  if (bl) p.push(`A${fmt(bl)} ${fmt(bl)} 0 0 1 ${fmt(x)} ${fmt(y + h - bl)}`);
  p.push(`V${fmt(y + tl)}`);
  if (tl) p.push(`A${fmt(tl)} ${fmt(tl)} 0 0 1 ${fmt(x + tl)} ${fmt(y)}`);
  p.push('z');
  return p.join('');
}

function fillAttr(fill: Fill, gradientId: string): string {
  return fill.kind === 'gradient' ? `url(#${gradientId})` : fill.color;
}

function gradientDef(g: Gradient, id: string, extent: number): string {
  const stops = g.stops
    .map((s) => `<stop offset="${fmt(s.offset)}" stop-color="${s.color}"/>`)
    .join('');
  if (g.type === 'radial') {
    return `<radialGradient id="${id}" cx="50%" cy="50%" r="70%">${stops}</radialGradient>`;
  }
  const rad = (g.angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const x1 = fmt(extent * (0.5 - dx / 2));
  const y1 = fmt(extent * (0.5 - dy / 2));
  const x2 = fmt(extent * (0.5 + dx / 2));
  const y2 = fmt(extent * (0.5 + dy / 2));
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
}

export const GRADIENT_ID = 'qrGradient';

export type PathGroup = { fill: string; d: string };

/**
 * Flattens the shape list into drawable path groups.
 *
 * Only *consecutive* same-fill shapes are merged. Merging across
 * non-adjacent runs would reorder the painter's stack and let the light
 * centre of an eye frame paint over the eye ball.
 *
 * Both the SVG string exporter and the on-screen react-native-svg component
 * consume this, so what you see is exactly what you export.
 */
export function artworkToPathGroups(art: Artwork): PathGroup[] {
  const groups: PathGroup[] = [];
  let runFill: string | null = null;
  let runPaths: string[] = [];

  const flush = () => {
    if (runFill !== null && runPaths.length) {
      groups.push({ fill: runFill, d: runPaths.join('') });
    }
    runPaths = [];
  };

  for (const s of art.shapes) {
    const fill = fillAttr(s.fill, GRADIENT_ID);
    if (fill !== runFill) {
      flush();
      runFill = fill;
    }
    if (s.kind === 'rrect') runPaths.push(rrectPath(s));
    else if (s.kind === 'circle') {
      const { cx, cy, r } = s;
      runPaths.push(
        `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r * 2)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r * 2)} 0z`,
      );
    } else {
      runPaths.push(`M${s.points.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join('L')}z`);
    }
  }
  flush();
  return groups;
}

/** Gradient coordinates in user space, shared by both render targets. */
export function gradientGeometry(g: Gradient, extent: number) {
  const rad = (g.angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return {
    x1: extent * (0.5 - dx / 2),
    y1: extent * (0.5 - dy / 2),
    x2: extent * (0.5 + dx / 2),
    y2: extent * (0.5 + dy / 2),
  };
}

export type SvgOptions = {
  /** Output width and height in pixels. Omit for a viewBox-only SVG. */
  pixelSize?: number;
  /** Suppress the background rectangle for a transparent export. */
  transparentBackground?: boolean;
};

export function artworkToSvg(art: Artwork, options: SvgOptions = {}): string {
  const parts: string[] = [];
  const dim = options.pixelSize ? ` width="${options.pixelSize}" height="${options.pixelSize}"` : '';
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${dim} viewBox="0 0 ${fmt(art.extent)} ${fmt(art.extent)}" shape-rendering="geometricPrecision">`,
  );

  if (art.gradient) {
    parts.push(`<defs>${gradientDef(art.gradient, GRADIENT_ID, art.extent)}</defs>`);
  }

  if (!options.transparentBackground && art.background !== 'transparent') {
    const r = Math.max(0, art.style.backgroundRadius);
    parts.push(
      `<rect x="0" y="0" width="${fmt(art.extent)}" height="${fmt(art.extent)}" rx="${fmt(r)}" ry="${fmt(r)}" fill="${art.background}"/>`,
    );
  }

  for (const group of artworkToPathGroups(art)) {
    parts.push(`<path fill="${group.fill}" d="${group.d}"/>`);
  }

  if (art.logoBox && art.logo?.href) {
    const { x, y, w, h } = art.logoBox;
    const clip = art.logo.shape === 'circle' ? ` clip-path="circle(50%)"` : '';
    parts.push(
      `<image href="${art.logo.href}" xlink:href="${art.logo.href}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" preserveAspectRatio="xMidYMid meet"${clip}/>`,
    );
  }

  parts.push('</svg>');
  return parts.join('');
}

export function renderSvg(
  qr: QrCode,
  style: Partial<RenderStyle> = {},
  options: SvgOptions = {},
): string {
  return artworkToSvg(buildArtwork(qr, style), options);
}
