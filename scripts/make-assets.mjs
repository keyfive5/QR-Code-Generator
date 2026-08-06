/**
 * Generates the app icon, splash and Android adaptive icon layers.
 *   node scripts/make-assets.mjs
 *
 * The mark is three QR finder patterns with a check where the fourth corner
 * would be — the app's whole argument in one glyph.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const BG_DARK = '#0A0B0E';
const ACCENT = '#7C6CF6';
const INK = '#F4F5F8';

/** One finder-pattern "eye" at the given top-left, sized `s`. */
function eye(x, y, s, fill, hole) {
  const r1 = s * 0.29;
  const ring = s * 0.145;
  const inner = s - ring * 2;
  const r2 = r1 - ring * 0.55;
  const ball = s * 0.42;
  const r3 = ball * 0.3;
  const bx = x + (s - ball) / 2;
  const by = y + (s - ball) / 2;
  return `
    <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r1}" fill="${fill}"/>
    <rect x="${x + ring}" y="${y + ring}" width="${inner}" height="${inner}" rx="${r2}" fill="${hole}"/>
    <rect x="${bx}" y="${by}" width="${ball}" height="${ball}" rx="${r3}" fill="${fill}"/>`;
}

function mark({ size = 1024, pad = 0.176, background = null, ink = INK, accent = ACCENT }) {
  const p = size * pad;
  const area = size - p * 2;
  const cell = area * 0.4217;
  const gap = area - cell * 2;
  const x2 = p + cell + gap;
  const y2 = p + cell + gap;
  const holeColour = background ?? BG_DARK;

  // Check mark occupying the fourth corner.
  const cx = x2;
  const cy = y2;
  const sw = cell * 0.215;
  const d = `M${cx + cell * 0.06} ${cy + cell * 0.55}` +
    `L${cx + cell * 0.38} ${cy + cell * 0.87}` +
    `L${cx + cell * 0.98} ${cy + cell * 0.14}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
    ${eye(p, p, cell, ink, holeColour)}
    ${eye(x2, p, cell, ink, holeColour)}
    ${eye(p, y2, cell, ink, holeColour)}
    <path d="${d}" fill="none" stroke="${accent}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

async function write(svg, file, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  console.log('wrote ' + file);
}

mkdirSync('assets', { recursive: true });

// App Store icon: opaque, no transparency, no rounded corners of our own.
await write(mark({ size: 1024, background: BG_DARK }), 'assets/icon.png', 1024);

// Splash: the same mark, smaller, on the same dark field.
await write(mark({ size: 1024, pad: 0.3, background: BG_DARK }), 'assets/splash.png', 1024);
await write(mark({ size: 1024, pad: 0.3, background: BG_DARK }), 'assets/splash-icon.png', 1024);

// Android adaptive layers. The foreground needs generous padding because the
// launcher masks it down to about 66% of the canvas.
await write(mark({ size: 1024, pad: 0.29, background: null }), 'assets/android-icon-foreground.png', 1024);
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: BG_DARK },
}).png().toFile('assets/android-icon-background.png');
console.log('wrote assets/android-icon-background.png');
await write(
  mark({ size: 1024, pad: 0.29, background: null, ink: '#FFFFFF', accent: '#FFFFFF' }),
  'assets/android-icon-monochrome.png',
  1024,
);

await write(mark({ size: 256, background: BG_DARK }), 'assets/favicon.png', 48);
