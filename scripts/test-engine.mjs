/**
 * Engine conformance suite.
 *
 *   node --experimental-strip-types scripts/test-engine.mjs
 *
 * Three independent kinds of check:
 *   1. Table conformance against published ISO/IEC 18004 capacity figures.
 *   2. Differential equality against the `qrcode` npm reference encoder.
 *   3. Round-trip through this project's own decoder, including damage tests.
 */
import { encodeText } from '../src/qr/encode.ts';
import { decodeMatrix, isDecodeFailure } from '../src/qr/decode.ts';
import {
  dataCodewords,
  totalCodewords,
  alignmentPatternPositions,
  sizeForVersion,
  EC_BLOCKS,
  EC_CODEWORDS_PER_BLOCK,
} from '../src/qr/spec.ts';
import QRCode from 'qrcode';
import Mode from 'qrcode/lib/core/mode.js';

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) pass++;
  else {
    fail++;
    failures.push(name + (detail ? ' — ' + detail : ''));
  }
}
function section(name) {
  console.log('\n' + name);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- */
section('1. Specification tables');

// ISO/IEC 18004 Table 7: total codewords, all 40 versions.
const TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
  2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706];
{
  let bad = [];
  for (let v = 1; v <= 40; v++) {
    if (totalCodewords(v) !== TOTAL[v - 1]) bad.push(`v${v}: ${totalCodewords(v)} != ${TOTAL[v - 1]}`);
  }
  check('total codewords, all 40 versions', bad.length === 0, bad.slice(0, 4).join(', '));
}

// ISO/IEC 18004 Table 7: data codewords per version and level.
const DATA = {
  '1': { L: 19, M: 16, Q: 13, H: 9 },
  '2': { L: 34, M: 28, Q: 22, H: 16 },
  '10': { L: 274, M: 216, Q: 154, H: 122 },
  '25': { L: 1276, M: 1000, Q: 718, H: 538 },
  '39': { L: 2812, M: 2216, Q: 1582, H: 1222 },
  '40': { L: 2956, M: 2334, Q: 1666, H: 1276 },
};
for (const [v, levels] of Object.entries(DATA)) {
  for (const [ec, expected] of Object.entries(levels)) {
    check(`data codewords v${v}-${ec}`, dataCodewords(+v, ec) === expected,
      `got ${dataCodewords(+v, ec)}, expected ${expected}`);
  }
}

// Exhaustive cross-validation of the block tables: for every one of the 160
// (version, level) pairs, a payload of exactly the byte-mode capacity must
// land on that version in BOTH this encoder and the reference encoder, and
// one byte more must spill to the next version.
{
  let capacityBad = [];
  let spillBad = [];
  for (let v = 1; v <= 40; v++) {
    for (const ec of ['L', 'M', 'Q', 'H']) {
      const cap = Math.floor((dataCodewords(v, ec) * 8 - 4 - (v <= 9 ? 8 : 16)) / 8);
      const text = 'q'.repeat(cap);
      const mine = encodeText(text, { ecLevel: ec, boostEc: false });
      const ref = QRCode.create(text, { errorCorrectionLevel: ec });
      if (mine.version !== v || ref.version !== v) {
        capacityBad.push(`v${v}-${ec} cap=${cap} mine=${mine.version} ref=${ref.version}`);
        continue;
      }
      if (v < 40) {
        const over = encodeText('q'.repeat(cap + 1), { ecLevel: ec, boostEc: false });
        if (over.version !== v + 1) spillBad.push(`v${v}-${ec} -> ${over.version}`);
      }
    }
  }
  check('all 160 (version, level) byte capacities agree with the reference',
    capacityBad.length === 0, capacityBad.slice(0, 4).join(', '));
  check('one byte past capacity always spills to the next version',
    spillBad.length === 0, spillBad.slice(0, 4).join(', '));
}

// Alignment pattern coordinates, spot-checked against Annex E.
check('alignment v1', JSON.stringify(alignmentPatternPositions(1)) === '[]');
check('alignment v7', JSON.stringify(alignmentPatternPositions(7)) === '[6,22,38]',
  JSON.stringify(alignmentPatternPositions(7)));
check('alignment v32', JSON.stringify(alignmentPatternPositions(32)) === '[6,34,60,86,112,138]',
  JSON.stringify(alignmentPatternPositions(32)));
check('alignment v40', JSON.stringify(alignmentPatternPositions(40)) === '[6,30,58,86,114,142,170]',
  JSON.stringify(alignmentPatternPositions(40)));
check('size v40', sizeForVersion(40) === 177);

// Maximum character capacities quoted by the standard for version 40-L.
{
  const numeric = '1'.repeat(7089);
  const alnum = 'A'.repeat(4296);
  const bytes = 'a'.repeat(2953);
  let ok = true;
  try {
    check('v40-L holds 7089 digits', encodeText(numeric, { ecLevel: 'L', boostEc: false }).version === 40);
    check('v40-L holds 4296 alphanumerics', encodeText(alnum, { ecLevel: 'L', boostEc: false }).version === 40);
    check('v40-L holds 2953 bytes', encodeText(bytes, { ecLevel: 'L', boostEc: false }).version === 40);
  } catch (e) { ok = false; }
  check('max capacity encodes without error', ok);
  let overflowed = false;
  try { encodeText('1'.repeat(7090), { ecLevel: 'L', boostEc: false }); }
  catch { overflowed = true; }
  check('7090 digits correctly rejected', overflowed);
}

/* ---------------------------------------------------------------- */
section('2. Differential vs. the `qrcode` reference encoder');

function referenceMatrix(text, ecLevel, maskPattern) {
  const opts = { errorCorrectionLevel: ecLevel };
  if (maskPattern !== undefined) opts.maskPattern = maskPattern;
  const qr = QRCode.create(text, opts);
  return { size: qr.modules.size, data: qr.modules.data, version: qr.version, mask: qr.maskPattern };
}

function randomAscii(rand, len, alphabet) {
  let s = '';
  for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return s;
}

/** Total payload bits the reference encoder's segmentation would use. */
function referenceBitLength(text, ecLevel, version) {
  const qr = QRCode.create(text, { errorCorrectionLevel: ecLevel });
  let bits = 0;
  for (const seg of qr.segments) {
    bits += 4 + Mode.getCharCountIndicator(seg.mode, version) + seg.getBitsLength();
  }
  return bits;
}

{
  const rand = mulberry32(20260806);
  let exactMatches = 0;
  let segmentationTie = 0;
  const alphabets = [
    '0123456789',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 $%*+-./:',
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.~!*();:@&=+$,/?#[]',
  ];
  let compared = 0;
  let matrixMismatch = 0;
  let versionWorse = 0;
  let versionBetter = 0;
  const examples = [];

  for (const ecLevel of ['L', 'M', 'Q', 'H']) {
    for (const alphabet of alphabets) {
      for (let trial = 0; trial < 250; trial++) {
        // Long payloads too, so the high versions and their alignment grids
        // and multi-block interleaving are exercised.
        const len = 1 + Math.floor(rand() * (trial % 5 === 0 ? 2000 : 300));
        const text = randomAscii(rand, len, alphabet);

        // Version selection with automatic mask.
        let refAuto;
        try { refAuto = referenceMatrix(text, ecLevel); } catch { continue; }
        const mineAuto = encodeText(text, { ecLevel, boostEc: false });
        compared++;
        if (mineAuto.version > refAuto.version) versionWorse++;
        else if (mineAuto.version < refAuto.version) versionBetter++;
        if (mineAuto.version !== refAuto.version) continue;

        // Module-for-module equality with the mask pinned on both sides.
        // Mask choice is an aesthetic tie-break the two projects score
        // slightly differently at the symbol border; everything else about
        // the symbol must be byte-identical, unless the two segmenters found
        // equal-cost but structurally different mode splits.
        const mask = Math.floor(rand() * 8);
        const ref = referenceMatrix(text, ecLevel, mask);
        const mine = encodeText(text, { ecLevel, boostEc: false, mask });
        let same = mine.size === ref.size && mine.mask === ref.mask;
        if (same) {
          for (let i = 0; i < mine.modules.length; i++) {
            if (mine.modules[i] !== ref.data[i]) { same = false; break; }
          }
        }
        if (!same) {
          // A different bit layout is only acceptable when our segmentation
          // is no worse than the reference's. Anything else is a real bug.
          if (mine.dataBitsUsed <= referenceBitLength(text, ecLevel, mine.version)) {
            segmentationTie++;
          } else {
            matrixMismatch++;
            if (examples.length < 3) examples.push(`${ecLevel} len=${len} v${mine.version} mask ${mask}`);
          }
        } else {
          exactMatches++;
        }
      }
    }
  }
  console.log(`   compared ${compared} symbols (${exactMatches} byte-identical, ${segmentationTie} equal-cost segmentation ties)`);
  check(`never picks a larger version than the reference (${compared} symbols)`,
    versionWorse === 0, `${versionWorse} larger`);
  check('never picks a smaller version than the reference (would mean a capacity bug)',
    versionBetter === 0, `${versionBetter} smaller`);
  check(`no unexplained matrix differences across ${compared} symbols`, matrixMismatch === 0,
    `${matrixMismatch} differed: ${examples.join('; ')}`);
  check('at least 99% of symbols are byte-identical to the reference',
    exactMatches / compared >= 0.99,
    `${((exactMatches / compared) * 100).toFixed(2)}%`);
}

// Single-mode payloads leave no room for segmentation ambiguity, so these
// must be byte-identical to the reference in every case.
{
  const rand = mulberry32(6060);
  let n = 0;
  let bad = 0;
  const examples = [];
  for (const alphabet of ['0123456789', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz']) {
    for (const ecLevel of ['L', 'M', 'Q', 'H']) {
      for (let trial = 0; trial < 120; trial++) {
        const len = 1 + Math.floor(rand() * 1200);
        const text = randomAscii(rand, len, alphabet);
        const mask = Math.floor(rand() * 8);
        let ref;
        try { ref = referenceMatrix(text, ecLevel, mask); } catch { continue; }
        const mine = encodeText(text, { ecLevel, boostEc: false, mask });
        n++;
        let same = mine.size === ref.size;
        if (same) {
          for (let i = 0; i < mine.modules.length; i++) {
            if (mine.modules[i] !== ref.data[i]) { same = false; break; }
          }
        }
        if (!same) {
          bad++;
          if (examples.length < 3) examples.push(`${ecLevel} len=${len} v${mine.version}/${ref.version} mask ${mask}`);
        }
      }
    }
  }
  check(`${n} single-mode symbols byte-identical to the reference`, bad === 0,
    `${bad} differed: ${examples.join('; ')}`);
}

// The chosen mask must genuinely minimise the ISO penalty score.
{
  const rand = mulberry32(8888);
  let bad = 0;
  for (let i = 0; i < 150; i++) {
    const text = randomAscii(rand, 1 + Math.floor(rand() * 300), 'abcdefghijklmnop0123456789 ');
    const ec = ['L', 'M', 'Q', 'H'][Math.floor(rand() * 4)];
    const chosen = encodeText(text, { ecLevel: ec, boostEc: false });
    for (let m = 0; m < 8; m++) {
      const alt = encodeText(text, { ecLevel: ec, boostEc: false, mask: m });
      if (alt.penalty < chosen.penalty) { bad++; break; }
    }
  }
  check('automatic mask always achieves the minimum penalty', bad === 0, `${bad} suboptimal`);
}

/* ---------------------------------------------------------------- */
section('3. Round trip through this project\'s decoder');

{
  const rand = mulberry32(777);
  const corpus = [
    'https://github.com/keyfive5/QR-Code-Generator',
    'HELLO WORLD',
    '8675309',
    'WIFI:T:WPA;S:Cafe Guest;P:latte;;',
    'مرحبا بالعالم',
    'こんにちは世界',
    '👋🏽 emoji payload ✅',
    'Ünïcödé àccénts ß æ ø',
    'a',
    '',
    'x'.repeat(1000),
    'BEGIN:VCARD\nVERSION:3.0\nN:Zafar;Hasan\nEND:VCARD',
  ];
  for (let i = 0; i < 120; i++) {
    corpus.push(randomAscii(rand, 1 + Math.floor(rand() * 900),
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 :/?#[]@!$&()*+,;=-._~'));
  }

  let roundTrips = 0;
  let bad = 0;
  const badExamples = [];
  for (const text of corpus) {
    for (const ecLevel of ['L', 'M', 'Q', 'H']) {
      const qr = encodeText(text, { ecLevel });
      const res = decodeMatrix({ size: qr.size, modules: qr.modules });
      roundTrips++;
      if (isDecodeFailure(res) || res.text !== text) {
        bad++;
        if (badExamples.length < 3) {
          badExamples.push(isDecodeFailure(res) ? res.error : `"${res.text.slice(0, 20)}" != "${text.slice(0, 20)}"`);
        }
      } else if (res.errorsCorrected !== 0) {
        bad++;
        if (badExamples.length < 3) badExamples.push('phantom errors on a clean matrix');
      }
    }
  }
  check(`${roundTrips} clean round trips`, bad === 0, `${bad} failed: ${badExamples.join('; ')}`);
}

// Cross-check: the reference encoder's matrices must decode with our decoder.
{
  const rand = mulberry32(31337);
  let n = 0;
  let bad = 0;
  for (let i = 0; i < 200; i++) {
    const text = randomAscii(rand, 1 + Math.floor(rand() * 400),
      'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ /:.-_');
    const ec = ['L', 'M', 'Q', 'H'][Math.floor(rand() * 4)];
    const ref = referenceMatrix(text, ec);
    const res = decodeMatrix({ size: ref.size, modules: Uint8Array.from(ref.data) });
    n++;
    if (isDecodeFailure(res) || res.text !== text) bad++;
  }
  check(`decoder reads ${n} reference-encoded symbols`, bad === 0, `${bad} failed`);
}

/* ---------------------------------------------------------------- */
section('4. Damage tolerance');

/**
 * Maps every payload module of a symbol to the interleaved codeword it
 * carries, and every codeword to its Reed-Solomon block. This lets the test
 * damage exactly up to each block's stated budget rather than hoping random
 * flips land favourably.
 */
function moduleToCodewordMap(qr) {
  const positionsByCodeword = [];
  let bit = 0;
  for (let right = qr.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < qr.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? qr.size - 1 - vert : vert;
        const idx = y * qr.size + x;
        if (!qr.functions[idx]) {
          const cw = bit >> 3;
          if (!positionsByCodeword[cw]) positionsByCodeword[cw] = [];
          positionsByCodeword[cw].push(idx);
          bit++;
        }
      }
    }
  }
  const o = { L: 0, M: 1, Q: 2, H: 3 }[qr.ecLevel];
  const numBlocks = EC_BLOCKS[o][qr.version];
  const blockEccLen = EC_CODEWORDS_PER_BLOCK[o][qr.version];
  const raw = totalCodewords(qr.version);
  const numShortBlocks = numBlocks - (raw % numBlocks);
  const shortBlockLen = Math.floor(raw / numBlocks);

  const codewordsOfBlock = Array.from({ length: numBlocks }, () => []);
  let index = 0;
  for (let i = 0; i < shortBlockLen + 1; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
        codewordsOfBlock[j].push(index++);
      }
    }
  }
  return { positionsByCodeword, codewordsOfBlock, perBlockBudget: Math.floor(blockEccLen / 2) };
}

{
  // Damage every block right up to its stated correction budget and require
  // byte-perfect recovery of the payload.
  const rand = mulberry32(4242);
  let tested = 0;
  let bad = 0;
  const badExamples = [];
  for (const ecLevel of ['L', 'M', 'Q', 'H']) {
    for (let trial = 0; trial < 25; trial++) {
      const text = randomAscii(rand, 20 + Math.floor(rand() * 600), 'abcdefghijklmnopqrstuvwxyz0123456789');
      const qr = encodeText(text, { ecLevel, boostEc: false });
      const map = moduleToCodewordMap(qr);
      const damaged = qr.modules.slice();
      let damagedCodewords = 0;
      for (const codewords of map.codewordsOfBlock) {
        // Pick distinct codewords in this block, one corrupted bit each.
        const pick = codewords.slice();
        for (let k = 0; k < map.perBlockBudget && pick.length; k++) {
          const cw = pick.splice(Math.floor(rand() * pick.length), 1)[0];
          const positions = map.positionsByCodeword[cw];
          if (!positions) continue;
          damaged[positions[Math.floor(rand() * positions.length)]] ^= 1;
          damagedCodewords++;
        }
      }
      const res = decodeMatrix({ size: qr.size, modules: damaged });
      tested++;
      if (isDecodeFailure(res) || res.text !== text) {
        bad++;
        if (badExamples.length < 3) {
          badExamples.push(`v${qr.version}-${ecLevel} ${damagedCodewords} codewords: ` +
            (isDecodeFailure(res) ? res.error : 'wrong text'));
        }
      }
    }
  }
  check(`recovers ${tested} symbols damaged to 100% of the stated budget`, bad === 0,
    `${bad} failed: ${badExamples.join('; ')}`);
}

/* ---------------------------------------------------------------- */
section('5. Error-correction boosting');

{
  // Boosting must never change the version and never lower the level.
  const rand = mulberry32(5150);
  let bad = 0;
  const order = { L: 0, M: 1, Q: 2, H: 3 };
  for (let i = 0; i < 300; i++) {
    const text = randomAscii(rand, 1 + Math.floor(rand() * 200), 'abcdefghij0123456789');
    for (const ecLevel of ['L', 'M', 'Q']) {
      const plain = encodeText(text, { ecLevel, boostEc: false });
      const boosted = encodeText(text, { ecLevel, boostEc: true });
      if (boosted.version !== plain.version) bad++;
      else if (order[boosted.ecLevel] < order[ecLevel]) bad++;
      else {
        const res = decodeMatrix({ size: boosted.size, modules: boosted.modules });
        if (isDecodeFailure(res) || res.text !== text) bad++;
      }
    }
  }
  check('boosting keeps version, raises level, stays decodable', bad === 0, `${bad} failed`);
}

/* ---------------------------------------------------------------- */
console.log('\n' + '='.repeat(60));
console.log(`Engine: ${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) console.log('  - ' + f);
}
process.exit(fail ? 1 : 0);
