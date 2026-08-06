/**
 * Artwork and scan-check suite.
 *
 *   node --experimental-strip-types scripts/test-render.mjs
 *
 * The claim under test is that a design the app calls "Verified" reads as
 * well as the plain black-and-white code it came from. That is measured as a
 * controlled comparison, not an assertion about any single image: both ZXing
 * and jsQR have symbols they sporadically fail to locate — verified by
 * feeding them the *reference* encoder's own rendering of the same payload,
 * which fails identically. So a plain-code control group establishes the
 * noise floor, and styled designs are measured against it.
 */
import { encodeText } from '../src/qr/encode.ts';
import { buildArtwork, renderSvg } from '../src/qr/render.ts';
import { rasterize } from '../src/qr/raster.ts';
import { verifyArtwork, maxSafeLogoScale } from '../src/qr/verify.ts';
import jsQR from 'jsqr';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); }
}
function section(n) { console.log('\n' + n); }
function pct(x) { return (x * 100).toFixed(1) + '%'; }

const MODULE_STYLES = ['square', 'rounded', 'dot', 'diamond', 'classy', 'fluid'];
const EYE_FRAMES = ['square', 'rounded', 'circle', 'leaf', 'shield'];
const EYE_BALLS = ['square', 'rounded', 'circle', 'diamond', 'leaf'];

const PAYLOADS = [
  'https://apps.apple.com/app/id0000000000',
  'WIFI:T:WPA;S:Studio 5G;P:correct-horse;;',
  'BEGIN:VCARD\nVERSION:3.0\nFN:Hasan Zafar\nTEL:+14165550123\nEND:VCARD',
  'https://github.com/keyfive5/QR-Code-Generator#why-this-one',
  '8675309',
  'mailto:hello@example.com?subject=Hi',
  'tel:+14165550123',
  'geo:43.5183,-79.8774',
  'https://qrforge.app/menu/table-14',
  'SMSTO:+14165550123:Table 14 is ready',
  'https://example.org/a-fairly-long-path/that/goes/on?with=query&and=more#fragment',
  'BEGIN:VEVENT\nSUMMARY:Studio open house\nDTSTART:20260912T180000\nEND:VEVENT',
];

const SCALES = [6, 9, 12];
const SUPERSAMPLE = 2;

const zxingReader = new MultiFormatReader();
zxingReader.setHints(
  new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
    [DecodeHintType.TRY_HARDER, true],
  ]),
);

function zxingDecode(raster) {
  const { data, width, height } = raster;
  const luminances = new Int32Array(width * height);
  for (let i = 0, p = 0; i < luminances.length; i++, p += 4) {
    luminances[i] = (data[p] << 16) | (data[p + 1] << 8) | data[p + 2];
  }
  try {
    const source = new RGBLuminanceSource(luminances, width, height);
    return zxingReader.decode(new BinaryBitmap(new HybridBinarizer(source))).getText();
  } catch {
    return null;
  } finally {
    zxingReader.reset();
  }
}

function jsqrDecode(raster) {
  const res = jsQR(raster.data, raster.width, raster.height);
  return res ? res.data : null;
}

/** Reads a design at every scale with both decoders. */
function readExternally(art, text) {
  let zx = 0;
  let js = 0;
  for (const ppm of SCALES) {
    const raster = rasterize(art, Math.round(art.extent * ppm), SUPERSAMPLE);
    if (zxingDecode(raster) === text) zx++;
    if (jsqrDecode(raster) === text) js++;
  }
  return { zxing: zx / SCALES.length, jsqr: js / SCALES.length, reads: SCALES.length };
}

const PLAIN = {
  moduleStyle: 'square', eyeFrameStyle: 'square', eyeBallStyle: 'square',
  foreground: '#000000', background: '#FFFFFF', moduleGap: 0, quietZone: 4,
};

/* ---------------------------------------------------------------- */
section('1. SVG output is well formed');
{
  const qr = encodeText('https://example.com/hello', { ecLevel: 'M' });
  let bad = 0;
  const seen = new Set();
  for (const moduleStyle of MODULE_STYLES) {
    for (const eyeFrameStyle of EYE_FRAMES) {
      for (const eyeBallStyle of EYE_BALLS) {
        const svg = renderSvg(qr, { moduleStyle, eyeFrameStyle, eyeBallStyle });
        if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) bad++;
        if (svg.includes('NaN') || svg.includes('undefined')) bad++;
        seen.add(svg);
      }
    }
  }
  const total = MODULE_STYLES.length * EYE_FRAMES.length * EYE_BALLS.length;
  check(`${total} style combinations produce clean SVG`, bad === 0, `${bad} malformed`);
  check('every style combination is visually distinct', seen.size === total,
    `${seen.size} of ${total} unique`);
}

/* ---------------------------------------------------------------- */
section('2. Controlled comparison: plain codes vs styled codes');
let controlZxing = 0;
{
  // --- Control group: plain black-on-white, no styling at all. ---
  let controlReads = 0;
  let controlHits = 0;
  let controlJsHits = 0;
  process.stdout.write('   control ');
  for (const text of PAYLOADS) {
    process.stdout.write('.');
    for (const ecLevel of ['M', 'Q']) {
      const art = buildArtwork(encodeText(text, { ecLevel }), PLAIN);
      const r = readExternally(art, text);
      controlReads += r.reads;
      controlHits += r.zxing * r.reads;
      controlJsHits += r.jsqr * r.reads;
    }
  }
  controlZxing = controlHits / controlReads;
  const controlJsqr = controlJsHits / controlReads;
  console.log('');
  console.log(`   plain codes:  ZXing ${pct(controlZxing)}  jsQR ${pct(controlJsqr)}  (${controlReads} reads)`);

  // --- Treatment group: every module style, at the app's own defaults. ---
  const perStyle = new Map();
  let styledReads = 0;
  let styledHits = 0;
  let styledJsHits = 0;
  let verifierOk = 0;
  let designs = 0;

  process.stdout.write('   styled  ');
  for (const text of PAYLOADS) {
    process.stdout.write('.');
    for (const moduleStyle of MODULE_STYLES) {
      const eyeFrameStyle = EYE_FRAMES[PAYLOADS.indexOf(text) % EYE_FRAMES.length];
      const eyeBallStyle = EYE_BALLS[MODULE_STYLES.indexOf(moduleStyle) % EYE_BALLS.length];
      const art = buildArtwork(encodeText(text, { ecLevel: 'Q' }), {
        moduleStyle, eyeFrameStyle, eyeBallStyle, moduleGap: 0.06,
      });
      const report = verifyArtwork(art, text);
      const r = readExternally(art, text);
      designs++;
      if (report.decodes) verifierOk++;
      styledReads += r.reads;
      styledHits += r.zxing * r.reads;
      styledJsHits += r.jsqr * r.reads;
      const acc = perStyle.get(moduleStyle) ?? { reads: 0, hits: 0 };
      acc.reads += r.reads;
      acc.hits += r.zxing * r.reads;
      perStyle.set(moduleStyle, acc);
    }
  }
  const styledZxing = styledHits / styledReads;
  console.log('');
  console.log(`   styled codes: ZXing ${pct(styledZxing)}  jsQR ${pct(styledJsHits / styledReads)}  (${styledReads} reads across ${designs} designs)`);
  console.log('   by module shape — ' +
    [...perStyle.entries()].map(([k, v]) => `${k} ${pct(v.hits / v.reads)}`).join('  '));

  check('styling does not reduce readability versus plain codes',
    styledZxing >= controlZxing - 0.02, `styled ${pct(styledZxing)} vs plain ${pct(controlZxing)}`);
  check('no single module shape is an outlier',
    [...perStyle.values()].every((v) => v.hits / v.reads >= controlZxing - 0.05),
    [...perStyle.entries()].filter(([, v]) => v.hits / v.reads < controlZxing - 0.05)
      .map(([k, v]) => `${k} ${pct(v.hits / v.reads)}`).join(', '));
  check(`all ${designs} styled designs pass our own scan check`, verifierOk === designs,
    `${designs - verifierOk} failed`);
}

/* ---------------------------------------------------------------- */
section('3. Colour and gradient handling');
{
  const text = 'https://qrforge.app/demo';
  const palettes = [
    { foreground: '#000000', background: '#FFFFFF' },
    { foreground: '#0B1F3A', background: '#F4F1EA' },
    { foreground: '#7A1F2B', background: '#FFF8F0' },
    { foreground: '#1B4332', background: '#EAF4EC' },
    {
      foreground: '#000000', background: '#FFFFFF',
      gradient: { type: 'linear', angle: 45, stops: [{ offset: 0, color: '#3B1D6E' }, { offset: 1, color: '#0E7490' }] },
    },
    {
      foreground: '#000000', background: '#FFFFFF',
      gradient: { type: 'radial', angle: 0, stops: [{ offset: 0, color: '#B45309' }, { offset: 1, color: '#7C2D12' }] },
    },
  ];
  let bad = 0;
  const notes = [];
  for (const palette of palettes) {
    const art = buildArtwork(encodeText(text, { ecLevel: 'Q' }), { ...palette, moduleStyle: 'rounded' });
    const report = verifyArtwork(art, text);
    const r = readExternally(art, text);
    if (!report.decodes || r.zxing < 1) {
      bad++;
      notes.push(`${palette.foreground}/${palette.background}${palette.gradient ? '+grad' : ''} zxing=${pct(r.zxing)}`);
    }
  }
  check(`${palettes.length} palettes including gradients decode`, bad === 0, notes.join(', '));

  const qr = encodeText(text, { ecLevel: 'Q' });
  const lowContrast = verifyArtwork(buildArtwork(qr, { foreground: '#8A8A8A', background: '#9C9C9C' }), text);
  check('low contrast is flagged', lowContrast.warnings.some((w) => w.includes('Contrast')),
    JSON.stringify(lowContrast.warnings));
  check('low contrast loses points', lowContrast.score < 80, `score ${lowContrast.score}`);

  const inv = verifyArtwork(buildArtwork(qr, { foreground: '#FFFFFF', background: '#101010' }), text);
  check('inverted polarity is flagged', inv.inverted && inv.warnings.some((w) => w.includes('inverted')),
    JSON.stringify(inv.warnings));
}

/* ---------------------------------------------------------------- */
section('4. Quiet zone');
{
  const text = 'https://qrforge.app/quiet';
  const qr = encodeText(text, { ecLevel: 'M' });
  const full = verifyArtwork(buildArtwork(qr, { quietZone: 4 }), text);
  const none = verifyArtwork(buildArtwork(qr, { quietZone: 0 }), text);
  check('4-module quiet zone passes clean', full.warnings.length === 0, JSON.stringify(full.warnings));
  check('missing quiet zone is flagged', none.warnings.some((w) => w.includes('Quiet zone')),
    JSON.stringify(none.warnings));
  check('missing quiet zone lowers the grade', none.score < full.score,
    `${none.score} vs ${full.score}`);
}

/* ---------------------------------------------------------------- */
section('5. Logo occlusion, modelled worst-case');
{
  let monotonic = true;
  let lastScore = 101;
  const scores = [];
  const text = 'https://qrforge.app/logo-test';
  for (const scale of [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35]) {
    const art = buildArtwork(encodeText(text, { ecLevel: 'H' }), {
      moduleStyle: 'rounded', logo: { scale, padding: 1, shape: 'rounded' },
    });
    const report = verifyArtwork(art, text);
    scores.push(`${scale}:${report.score}${report.decodes ? '' : '(x)'}`);
    if (report.score > lastScore) monotonic = false;
    lastScore = report.score;
  }
  console.log('   score by logo scale — ' + scores.join('  '));
  check('bigger logos never score higher', monotonic, scores.join(' '));

  // Across many payloads, logos sized by the "fit safely" search must read as
  // well as the plain control.
  let fitReads = 0;
  let fitHits = 0;
  const sizes = [];
  process.stdout.write('   fitting ');
  for (const payload of PAYLOADS.slice(0, 8)) {
    process.stdout.write('.');
    const qr = encodeText(payload, { ecLevel: 'H' });
    const best = maxSafeLogoScale(
      (scale) => buildArtwork(qr, { moduleStyle: 'rounded', logo: { scale, padding: 1, shape: 'rounded' } }),
      payload,
    );
    sizes.push(Math.round(best * 100));
    const art = buildArtwork(qr, { moduleStyle: 'rounded', logo: { scale: best, padding: 1, shape: 'rounded' } });
    const r = readExternally(art, payload);
    fitReads += r.reads;
    fitHits += r.zxing * r.reads;
  }
  console.log('');
  console.log(`   fitted logo sizes: ${sizes.join('%, ')}%  ->  ZXing ${pct(fitHits / fitReads)}`);
  check('logos sized by the fit search read as well as plain codes',
    fitHits / fitReads >= controlZxing - 0.02,
    `${pct(fitHits / fitReads)} vs control ${pct(controlZxing)}`);

  const hugeArt = buildArtwork(encodeText(text, { ecLevel: 'H' }), {
    moduleStyle: 'rounded', logo: { scale: 0.4, padding: 2, shape: 'square' },
  });
  check('an oversized logo is not graded excellent',
    verifyArtwork(hugeArt, text).grade !== 'excellent');
}

/* ---------------------------------------------------------------- */
section('6. The scan check has real discrimination');
{
  // Sweep aggressive designs, including ones that should be rejected, and
  // compare how the two groups actually read. A check that approves
  // everything, or warns about everything, would be worthless.
  let recommendedReads = 0;
  let recommendedHits = 0;
  let warnedReads = 0;
  let warnedHits = 0;
  let recommended = 0;
  let warned = 0;

  process.stdout.write('   sweeping ');
  for (const text of PAYLOADS.slice(0, 6)) {
    process.stdout.write('.');
    for (const ecLevel of ['L', 'Q']) {
      for (const moduleStyle of MODULE_STYLES) {
        for (const gap of [0, 0.15, 0.3]) {
          for (const logoScale of [0, 0.2, 0.32]) {
            const art = buildArtwork(encodeText(text, { ecLevel }), {
              moduleStyle,
              eyeFrameStyle: 'rounded',
              eyeBallStyle: 'circle',
              moduleGap: gap,
              logo: logoScale ? { scale: logoScale, padding: 1, shape: 'rounded' } : undefined,
            });
            const report = verifyArtwork(art, text);
            const r = readExternally(art, text);
            if (report.grade === 'excellent' || report.grade === 'good') {
              recommended++;
              recommendedReads += r.reads;
              recommendedHits += r.zxing * r.reads;
            } else {
              warned++;
              warnedReads += r.reads;
              warnedHits += r.zxing * r.reads;
            }
          }
        }
      }
    }
  }
  const recRate = recommendedHits / recommendedReads;
  const warnRate = warnedHits / warnedReads;
  console.log('');
  console.log(`   recommended: ${recommended} designs, ZXing ${pct(recRate)}`);
  console.log(`   warned about: ${warned} designs, ZXing ${pct(warnRate)}`);
  check('designs the app recommends read as well as plain codes',
    recRate >= controlZxing - 0.02, `${pct(recRate)} vs control ${pct(controlZxing)}`);
  check('designs the app warns about really do read worse',
    warnRate < recRate - 0.1, `warned ${pct(warnRate)} vs recommended ${pct(recRate)}`);
  check('the check is not just rejecting everything', recommended >= warned * 0.15,
    `${recommended} recommended vs ${warned} warned`);
}

/* ---------------------------------------------------------------- */
console.log('\n' + '='.repeat(60));
console.log(`Artwork: ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  - ' + f);
}
process.exit(fail ? 1 : 0);
