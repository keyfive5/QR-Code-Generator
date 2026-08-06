/**
 * Scan check.
 *
 * Takes the finished artwork — styled modules, gradient, logo and all — and
 * puts it through the sampling a real reader performs: pick the module
 * centres, binarise against the midpoint of the observed luminance range,
 * rebuild the matrix, and run the full Reed-Solomon decode. If the payload
 * does not come back out byte-for-byte, the design does not scan, and the app
 * says so before anything is exported.
 *
 * Two modelling choices are deliberately pessimistic, so the reported
 * headroom is a floor rather than a hope:
 *   - every module the logo artwork overlaps is assumed to be read WRONG,
 *     because the logo's own pixels are unknown;
 *   - the error budget is reported as consumed even when Reed-Solomon
 *     repaired the symbol perfectly.
 */

import { decodeMatrix, isDecodeFailure } from './decode.ts';
import { isDark } from './encode.ts';
import type { Artwork } from './render.ts';
import { contrastRatio, parseColor, relativeLuminance, sampleColorAt } from './raster.ts';
import type { Rgba } from './raster.ts';

export type ScanGrade = 'excellent' | 'good' | 'risky' | 'fails';

export type ScanReport = {
  /** Did the artwork decode back to the exact payload? */
  decodes: boolean;
  decodedText: string | null;
  failure: string | null;

  /** Codewords Reed-Solomon had to repair, and the symbol's total budget. */
  errorsCorrected: number;
  errorBudget: number;
  /** 0-1. How much of the correction budget the design itself consumes. */
  budgetUsed: number;
  /** 0-1. Share of off-centre reads that still recovered the payload. */
  registrationTolerance: number;
  /** 0-1. Mean share of each dark module's area that carries ink. */
  inkCoverage: number;

  contrastRatio: number;
  /** True when the modules are lighter than the background. */
  inverted: boolean;
  quietZone: number;
  /** Fraction of the symbol's area hidden by the logo. */
  logoCoverage: number;
  /** Smallest print width in millimetres that keeps modules readable. */
  minPrintMm: number;

  score: number;
  grade: ScanGrade;
  warnings: string[];
  notes: string[];
};

/** Samples per module edge, taken across the central part of each module. */
const SAMPLES_PER_EDGE = 3;
/** Fraction of the module width a reader can be trusted to hit. */
const SAMPLE_WINDOW = 0.5;
/**
 * Grid mis-registration, in modules. A reader locates the grid from the
 * finder patterns and interpolates; on a real photo that estimate drifts.
 * Sampling at these offsets is what separates a design that only survives a
 * perfect read from one that survives an ordinary one.
 */
const REGISTRATION_OFFSETS: [number, number][] = [
  [0, 0],
  [0.16, 0],
  [-0.16, 0],
  [0, 0.16],
  [0, -0.16],
];
/** Industry guidance for the smallest dependable printed module. */
const MIN_MODULE_MM = 0.4;
/** Below this mean ink coverage, marks are too thin for a local binariser. */
const THIN_MARK_COVERAGE = 0.55;

function effectiveForeground(art: Artwork): Rgba {
  if (art.style.gradient && art.style.gradient.stops.length) {
    const stops = art.style.gradient.stops.map((s) => parseColor(s.color));
    return {
      r: stops.reduce((n, c) => n + c.r, 0) / stops.length,
      g: stops.reduce((n, c) => n + c.g, 0) / stops.length,
      b: stops.reduce((n, c) => n + c.b, 0) / stops.length,
      a: 1,
    };
  }
  return parseColor(art.style.foreground);
}

function logoOverlapsModule(art: Artwork, row: number, col: number, quiet: number): boolean {
  const box = art.logoBox;
  if (!box) return false;
  const x0 = col + quiet;
  const y0 = row + quiet;
  return !(x0 + 1 <= box.x || x0 >= box.x + box.w || y0 + 1 <= box.y || y0 >= box.y + box.h);
}

/** Samples the symbol into a matrix under one grid-registration offset. */
function sampleAtOffset(
  art: Artwork,
  logoHit: Uint8Array,
  inverted: boolean,
  dx: number,
  dy: number,
): Uint8Array {
  const qr = art.qr;
  const size = qr.size;
  const quiet = Math.round(art.style.quietZone);
  const luminance = new Float64Array(size * size);
  const start = (1 - SAMPLE_WINDOW) / 2;
  const step = SAMPLES_PER_EDGE > 1 ? SAMPLE_WINDOW / (SAMPLES_PER_EDGE - 1) : 0;

  let lumMin = Infinity;
  let lumMax = -Infinity;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const idx = row * size + col;
      if (logoHit[idx]) continue;
      let sum = 0;
      for (let sy = 0; sy < SAMPLES_PER_EDGE; sy++) {
        for (let sx = 0; sx < SAMPLES_PER_EDGE; sx++) {
          const px = col + quiet + start + sx * step + dx;
          const py = row + quiet + start + sy * step + dy;
          sum += relativeLuminance(sampleColorAt(art, px, py));
        }
      }
      const value = sum / (SAMPLES_PER_EDGE * SAMPLES_PER_EDGE);
      luminance[idx] = value;
      if (value < lumMin) lumMin = value;
      if (value > lumMax) lumMax = value;
    }
  }

  const threshold = (lumMin + lumMax) / 2;
  const sampled = new Uint8Array(size * size);
  for (let i = 0; i < sampled.length; i++) {
    if (logoHit[i]) {
      // Worst case: assume the logo's own pixels are read as the wrong value.
      sampled[i] = qr.modules[i] ? 0 : 1;
    } else {
      const dark = inverted ? luminance[i] > threshold : luminance[i] < threshold;
      sampled[i] = dark ? 1 : 0;
    }
  }
  return sampled;
}

/** Mean fraction of each dark module's area that actually carries ink. */
function meanInkCoverage(art: Artwork, logoHit: Uint8Array, inverted: boolean): number {
  const qr = art.qr;
  const size = qr.size;
  const quiet = Math.round(art.style.quietZone);
  const fgLum = relativeLuminance(effectiveForeground(art));
  const bgLum = relativeLuminance(
    parseColor(art.style.background === 'transparent' ? '#FFFFFF' : art.style.background),
  );
  const mid = (fgLum + bgLum) / 2;
  const N = 6;

  let total = 0;
  let count = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const idx = row * size + col;
      if (logoHit[idx] || !qr.modules[idx]) continue;
      let inked = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const px = col + quiet + (sx + 0.5) / N;
          const py = row + quiet + (sy + 0.5) / N;
          const lum = relativeLuminance(sampleColorAt(art, px, py));
          if (inverted ? lum > mid : lum < mid) inked++;
        }
      }
      total += inked / (N * N);
      count++;
    }
  }
  return count ? total / count : 1;
}

export function verifyArtwork(art: Artwork, expectedText: string): ScanReport {
  const qr = art.qr;
  const quiet = Math.round(art.style.quietZone);
  const size = qr.size;

  const logoHit = new Uint8Array(size * size);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (logoOverlapsModule(art, row, col, quiet)) logoHit[row * size + col] = 1;
    }
  }

  const fg = effectiveForeground(art);
  const bg = parseColor(art.style.background === 'transparent' ? '#FFFFFF' : art.style.background);
  const inverted = relativeLuminance(fg) > relativeLuminance(bg);

  // Read the symbol once per registration offset. The centred read drives the
  // reported numbers; the offset reads decide how much the design can be
  // trusted when the reader's grid estimate is imperfect.
  const centre = decodeMatrix({ size, modules: sampleAtOffset(art, logoHit, inverted, 0, 0) });
  const failed = isDecodeFailure(centre);
  const decodedText = failed ? null : centre.text;
  const decodes = !failed && decodedText === expectedText;

  let robustReads = 0;
  if (decodes) {
    for (const [dx, dy] of REGISTRATION_OFFSETS) {
      const r = decodeMatrix({ size, modules: sampleAtOffset(art, logoHit, inverted, dx, dy) });
      if (!isDecodeFailure(r) && r.text === expectedText) robustReads++;
    }
  }
  const registrationTolerance = robustReads / REGISTRATION_OFFSETS.length;
  const inkCoverage = meanInkCoverage(art, logoHit, inverted);

  const errorsCorrected = failed ? 0 : centre.errorsCorrected;
  const errorBudget = qr.correctableCodewords;
  const budgetUsed = errorBudget > 0 ? Math.min(1, errorsCorrected / errorBudget) : 0;

  // --- Descriptive measurements. ---
  const ratio = contrastRatio(fg, bg);
  let logoModules = 0;
  for (let i = 0; i < logoHit.length; i++) logoModules += logoHit[i];
  const logoCoverage = logoModules / (size * size);
  const minPrintMm = (size + quiet * 2) * MIN_MODULE_MM;

  // --- Grade. ---
  const warnings: string[] = [];
  const notes: string[] = [];
  let score = 100;

  if (failed) {
    warnings.push(`This design does not decode: ${(centre as { error: string }).error}.`);
    score = 0;
  } else if (!decodes) {
    warnings.push('This design decodes to different content than you entered.');
    score = 0;
  } else {
    score -= Math.round(budgetUsed * 55);
    if (budgetUsed > 0.6) {
      warnings.push(
        `The design uses ${Math.round(budgetUsed * 100)}% of the error-correction budget, leaving little room for print flaws, scratches or bad lighting.`,
      );
    } else if (budgetUsed > 0.3) {
      notes.push(
        `${Math.round(budgetUsed * 100)}% of the error-correction budget is spent on the styling. Still comfortable.`,
      );
    } else if (budgetUsed === 0) {
      notes.push('The styling costs nothing — every module reads exactly as encoded.');
    }

    if (registrationTolerance < 1) {
      const missed = REGISTRATION_OFFSETS.length - robustReads;
      score -= missed * 13;
      warnings.push(
        `The code failed ${missed} of ${REGISTRATION_OFFSETS.length} off-centre reads. A reader that lines the grid up slightly wrong — a photo at an angle, a curved surface — may miss it.`,
      );
    }

    // Ink coverage is what a reader's local binariser actually averages over.
    // Centre-sampling alone would happily approve a diamond grid that fills
    // half its cells and washes out on camera.
    if (inkCoverage < 0.5) {
      score -= 45;
      warnings.push(
        `Marks fill only ${Math.round(inkCoverage * 100)}% of each module. Readers average brightness over small patches, so marks this thin wash out. Reduce the spacing or choose a fuller shape.`,
      );
    } else if (inkCoverage < 0.6) {
      score -= 26;
      warnings.push(
        `Marks fill ${Math.round(inkCoverage * 100)}% of each module — thin enough that some readers will struggle. Reduce the spacing or choose a fuller shape.`,
      );
    } else if (inkCoverage < THIN_MARK_COVERAGE + 0.15) {
      score -= 10;
      notes.push(`Marks fill ${Math.round(inkCoverage * 100)}% of each module.`);
    }
  }

  if (ratio < 3) {
    score -= 30;
    warnings.push(
      `Contrast is only ${ratio.toFixed(1)}:1. Readers need a clear light/dark difference; aim for 4.5:1 or more.`,
    );
  } else if (ratio < 4.5) {
    score -= 12;
    warnings.push(`Contrast of ${ratio.toFixed(1)}:1 is workable but tight in poor lighting.`);
  }

  if (inverted) {
    score -= 25;
    warnings.push(
      'Light modules on a dark background. Many readers, including the iPhone camera, are unreliable with inverted codes.',
    );
  }

  if (quiet < 2) {
    score -= 35;
    warnings.push(`Quiet zone is ${quiet} modules. The standard requires 4; below 2 most readers fail.`);
  } else if (quiet < 4) {
    score -= 15;
    warnings.push(`Quiet zone is ${quiet} modules. The standard requires 4.`);
  }

  if (logoCoverage > 0.25) {
    score -= 15;
    warnings.push(
      `The logo covers ${Math.round(logoCoverage * 100)}% of the symbol. Above roughly 25% even level H runs out of headroom.`,
    );
  } else if (logoCoverage > 0) {
    notes.push(`The logo covers ${Math.round(logoCoverage * 100)}% of the symbol.`);
  }

  if (art.style.moduleGap > 0.2) {
    score -= 8;
    notes.push('Wide module spacing thins the marks; keep the printed size generous.');
  }

  score = Math.max(0, Math.min(100, score));
  const grade: ScanGrade =
    !decodes ? 'fails' : score >= 85 ? 'excellent' : score >= 68 ? 'good' : 'risky';

  notes.push(
    `Version ${qr.version} (${size}x${size}), level ${qr.ecLevel}, mask ${qr.mask}. Print at ${minPrintMm.toFixed(0)} mm or wider.`,
  );

  return {
    decodes,
    decodedText,
    failure: failed ? (centre as { error: string }).error : null,
    errorsCorrected,
    errorBudget,
    budgetUsed,
    registrationTolerance,
    inkCoverage,
    contrastRatio: ratio,
    inverted,
    quietZone: quiet,
    logoCoverage,
    minPrintMm,
    score,
    grade,
    warnings,
    notes,
  };
}

/**
 * Largest logo scale that still verifies, found by bisection. Powers the
 * "make it as big as it can safely be" control in the design sheet.
 */
export function maxSafeLogoScale(
  buildAt: (scale: number) => Artwork,
  expectedText: string,
  minScore = 70,
): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2;
    const report = verifyArtwork(buildAt(mid), expectedText);
    if (report.decodes && report.score >= minScore) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 100) / 100;
}
