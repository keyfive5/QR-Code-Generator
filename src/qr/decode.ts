/**
 * QR Code decoder operating on a sampled module matrix.
 *
 * This is what makes the app's proof-check possible: after the artwork is
 * rendered — rounded modules, gradients, a logo punched through the middle —
 * the renderer's own output is sampled back into a matrix and fed through
 * here. If the payload does not come back out, the code does not ship.
 */

import {
  EC_BLOCKS,
  EC_CODEWORDS_PER_BLOCK,
  EC_FORMAT_BITS,
  EC_LEVELS,
  EC_ORDINAL,
  MASK_FUNCTIONS,
  charCountBits,
  totalCodewords,
} from './spec.ts';
import type { EcLevel } from './spec.ts';
import { rsDecode } from './rs.ts';
import { ALPHANUMERIC_CHARSET } from './spec.ts';
import { functionModuleMap } from './encode.ts';

export type DecodeResult = {
  text: string;
  version: number;
  ecLevel: EcLevel;
  mask: number;
  /** Total codeword errors the Reed-Solomon stage had to repair. */
  errorsCorrected: number;
  /** Maximum errors the symbol could have absorbed. */
  errorBudget: number;
  /** Bit errors found in the two copies of the format information. */
  formatErrors: number;
};

export type DecodeFailure = {
  error: string;
  /** Set when the failure happened after the format info was recovered. */
  version?: number;
  ecLevel?: EcLevel;
  mask?: number;
};

export type Matrix = { size: number; modules: Uint8Array };

/* ------------------------------------------------------------------ */
/* Format information                                                   */
/* ------------------------------------------------------------------ */

function formatBitsFor(ec: EcLevel, mask: number): number {
  const data = (EC_FORMAT_BITS[ec] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function popcount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

function readFormatInfo(m: Matrix): { ec: EcLevel; mask: number; errors: number } | null {
  const at = (x: number, y: number) => m.modules[y * m.size + x];

  let copy1 = 0;
  for (let i = 0; i <= 5; i++) copy1 |= at(8, i) << i;
  copy1 |= at(8, 7) << 6;
  copy1 |= at(8, 8) << 7;
  copy1 |= at(7, 8) << 8;
  for (let i = 9; i < 15; i++) copy1 |= at(14 - i, 8) << i;

  let copy2 = 0;
  for (let i = 0; i < 8; i++) copy2 |= at(m.size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) copy2 |= at(8, m.size - 15 + i) << i;

  let best: { ec: EcLevel; mask: number; errors: number } | null = null;
  for (const ec of EC_LEVELS) {
    for (let mask = 0; mask < 8; mask++) {
      const target = formatBitsFor(ec, mask);
      const errors = Math.min(popcount(copy1 ^ target), popcount(copy2 ^ target));
      if (!best || errors < best.errors) best = { ec, mask, errors };
    }
  }
  // BCH(15,5) corrects up to 3 bit errors; beyond that the read is untrusted.
  if (!best || best.errors > 3) return null;
  return best;
}

/* ------------------------------------------------------------------ */
/* Codeword extraction                                                  */
/* ------------------------------------------------------------------ */

function readCodewords(m: Matrix, functions: Uint8Array, mask: number): number[] {
  const maskFn = MASK_FUNCTIONS[mask];
  const bits: number[] = [];
  for (let right = m.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < m.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? m.size - 1 - vert : vert;
        const idx = y * m.size + x;
        if (!functions[idx]) {
          bits.push(m.modules[idx] ^ (maskFn(y, x) ? 1 : 0));
        }
      }
    }
  }
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  return codewords;
}

/** Inverse of the block interleaving in clause 7.6. */
function deinterleave(all: number[], version: number, ec: EcLevel): number[][] {
  const o = EC_ORDINAL[ec];
  const numBlocks = EC_BLOCKS[o][version];
  const blockEccLen = EC_CODEWORDS_PER_BLOCK[o][version];
  const rawCodewords = totalCodewords(version);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  for (let j = 0; j < numBlocks; j++) blocks.push(new Array(shortBlockLen + 1).fill(0));

  let index = 0;
  for (let i = 0; i < shortBlockLen + 1; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        blocks[j][i] = all[index++];
      }
    }
  }

  // Drop the rectangular padding slot from the short blocks.
  return blocks.map((block, j) => {
    if (j < numShortBlocks) {
      const cut = shortBlockLen - blockEccLen;
      return block.slice(0, cut).concat(block.slice(cut + 1));
    }
    return block;
  });
}

/* ------------------------------------------------------------------ */
/* Bit-stream parsing                                                   */
/* ------------------------------------------------------------------ */

class BitReader {
  private bits: number[] = [];
  private pos = 0;

  constructor(codewords: number[]) {
    for (const cw of codewords) {
      for (let i = 7; i >= 0; i--) this.bits.push((cw >>> i) & 1);
    }
  }

  get remaining(): number {
    return this.bits.length - this.pos;
  }

  read(n: number): number {
    if (n > this.remaining) throw new Error('bit stream exhausted');
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | this.bits[this.pos++];
    return v;
  }
}

function utf8Decode(bytes: number[]): string | null {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i];
    let cp: number;
    let extra: number;
    if (b0 < 0x80) {
      cp = b0;
      extra = 0;
    } else if ((b0 & 0xe0) === 0xc0) {
      cp = b0 & 0x1f;
      extra = 1;
    } else if ((b0 & 0xf0) === 0xe0) {
      cp = b0 & 0x0f;
      extra = 2;
    } else if ((b0 & 0xf8) === 0xf0) {
      cp = b0 & 0x07;
      extra = 3;
    } else {
      return null;
    }
    if (i + extra >= bytes.length) return null;
    for (let k = 1; k <= extra; k++) {
      const b = bytes[i + k];
      if ((b & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (b & 0x3f);
    }
    // Reject overlong encodings and out-of-range code points.
    if (extra === 1 && cp < 0x80) return null;
    if (extra === 2 && cp < 0x800) return null;
    if (extra === 3 && cp < 0x10000) return null;
    if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return null;
    out += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return out;
}

function latin1Decode(bytes: number[]): string {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function parseSegments(reader: BitReader, version: number): string {
  let text = '';
  let eciUtf8 = false;

  for (;;) {
    if (reader.remaining < 4) break;
    const mode = reader.read(4);
    if (mode === 0) break; // terminator

    if (mode === 7) {
      // ECI designator: 1, 2 or 3 bytes depending on the leading bits.
      const first = reader.read(8);
      let assignment: number;
      if ((first & 0x80) === 0) assignment = first;
      else if ((first & 0xc0) === 0x80) assignment = ((first & 0x3f) << 8) | reader.read(8);
      else assignment = ((first & 0x1f) << 16) | reader.read(16);
      if (assignment === 26) eciUtf8 = true;
      continue;
    }

    if (mode === 1) {
      let count = reader.read(charCountBits('numeric', version));
      while (count >= 3) {
        text += reader.read(10).toString().padStart(3, '0');
        count -= 3;
      }
      if (count === 2) text += reader.read(7).toString().padStart(2, '0');
      else if (count === 1) text += reader.read(4).toString();
    } else if (mode === 2) {
      let count = reader.read(charCountBits('alphanumeric', version));
      while (count >= 2) {
        const v = reader.read(11);
        text += ALPHANUMERIC_CHARSET[Math.floor(v / 45)] + ALPHANUMERIC_CHARSET[v % 45];
        count -= 2;
      }
      if (count === 1) text += ALPHANUMERIC_CHARSET[reader.read(6)];
    } else if (mode === 4) {
      const count = reader.read(charCountBits('byte', version));
      const bytes: number[] = [];
      for (let i = 0; i < count; i++) bytes.push(reader.read(8));
      // Honour an explicit UTF-8 ECI; otherwise prefer UTF-8 when the bytes
      // form a valid sequence, which is what real scanners do in practice.
      const utf8 = utf8Decode(bytes);
      text += eciUtf8 ? (utf8 ?? latin1Decode(bytes)) : (utf8 ?? latin1Decode(bytes));
    } else {
      throw new Error(`unsupported mode indicator ${mode}`);
    }
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                   */
/* ------------------------------------------------------------------ */

export function decodeMatrix(m: Matrix): DecodeResult | DecodeFailure {
  if (m.size < 21 || m.size > 177 || (m.size - 17) % 4 !== 0) {
    return { error: `invalid matrix size ${m.size}` };
  }
  const version = (m.size - 17) / 4;

  const format = readFormatInfo(m);
  if (!format) return { error: 'format information unreadable', version };

  const functions = functionModuleMap(version);
  const all = readCodewords(m, functions, format.mask);
  const expected = totalCodewords(version);
  if (all.length < expected) {
    return {
      error: 'not enough codewords',
      version,
      ecLevel: format.ec,
      mask: format.mask,
    };
  }

  const o = EC_ORDINAL[format.ec];
  const blockEccLen = EC_CODEWORDS_PER_BLOCK[o][version];
  const blocks = deinterleave(all.slice(0, expected), version, format.ec);

  let errorsCorrected = 0;
  const dataCodewordsOut: number[] = [];
  for (const block of blocks) {
    const res = rsDecode(block, blockEccLen);
    if (!res) {
      return {
        error: 'too much damage to recover (Reed-Solomon failed)',
        version,
        ecLevel: format.ec,
        mask: format.mask,
      };
    }
    errorsCorrected += res.errorsCorrected;
    dataCodewordsOut.push(...res.codewords.slice(0, block.length - blockEccLen));
  }

  let text: string;
  try {
    text = parseSegments(new BitReader(dataCodewordsOut), version);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'bit stream parse failed',
      version,
      ecLevel: format.ec,
      mask: format.mask,
    };
  }

  return {
    text,
    version,
    ecLevel: format.ec,
    mask: format.mask,
    errorsCorrected,
    errorBudget: Math.floor(blockEccLen / 2) * EC_BLOCKS[o][version],
    formatErrors: format.errors,
  };
}

export function isDecodeFailure(r: DecodeResult | DecodeFailure): r is DecodeFailure {
  return (r as DecodeFailure).error !== undefined;
}
