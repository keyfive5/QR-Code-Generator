// Standalone sanity check for the Reed-Solomon layer.
// Run: node --experimental-strip-types scripts/test-rs.mjs
import { rsEncode, rsDecode, gfMul, gfDiv, gfInv } from '../src/qr/rs.ts';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + name); }
}

// Field axioms
check('gfMul identity', gfMul(0x53, 1) === 0x53);
check('gfMul/gfDiv inverse', gfDiv(gfMul(0x53, 0xca), 0xca) === 0x53);
check('gfInv', gfMul(0x53, gfInv(0x53)) === 1);

// Known vector: the ISO/IEC 18004 Annex I worked example.
// Data codewords for "01234567" at version 1-M produce these 10 EC codewords.
const isoData = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11,
  0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
const isoEc = rsEncode(isoData, 10);
check('ISO Annex I EC codewords',
  JSON.stringify(isoEc) === JSON.stringify([0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55]));
if (JSON.stringify(isoEc) !== JSON.stringify([0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55])) {
  console.log('    got: ' + isoEc.map((b) => b.toString(16)).join(' '));
}

// Round trip with no errors
{
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ec = rsEncode(data, 8);
  const r = rsDecode(data.concat(ec), 8);
  check('clean decode', r !== null && r.errorsCorrected === 0);
}

// Exhaustive-ish corruption test: up to t errors must always be corrected,
// and the corrected word must equal the original.
{
  let ok = true;
  let tested = 0;
  const rand = mulberry32(12345);
  for (let ecLen = 4; ecLen <= 30; ecLen += 2) {
    const t = Math.floor(ecLen / 2);
    for (let trial = 0; trial < 60; trial++) {
      const dataLen = 20 + (trial % 30);
      const data = Array.from({ length: dataLen }, () => Math.floor(rand() * 256));
      const full = data.concat(rsEncode(data, ecLen));
      const numErrors = 1 + Math.floor(rand() * t);
      const corrupted = full.slice();
      const used = new Set();
      for (let e = 0; e < numErrors; e++) {
        let p;
        do { p = Math.floor(rand() * full.length); } while (used.has(p));
        used.add(p);
        let v;
        do { v = Math.floor(rand() * 256); } while (v === corrupted[p]);
        corrupted[p] = v;
      }
      const res = rsDecode(corrupted, ecLen);
      tested++;
      if (!res || res.errorsCorrected !== numErrors ||
          JSON.stringify(res.codewords) !== JSON.stringify(full)) {
        ok = false;
        console.log(`    ecLen=${ecLen} errors=${numErrors} -> ${res ? 'wrong result' : 'null'}`);
        break;
      }
    }
    if (!ok) break;
  }
  check(`corrects up to t errors (${tested} random trials)`, ok);
}

// Beyond capacity: must return null rather than silently miscorrect.
{
  let clean = true;
  const rand = mulberry32(999);
  for (let trial = 0; trial < 200; trial++) {
    const ecLen = 10;
    const data = Array.from({ length: 30 }, () => Math.floor(rand() * 256));
    const full = data.concat(rsEncode(data, ecLen));
    const corrupted = full.slice();
    const used = new Set();
    for (let e = 0; e < 9; e++) { // 9 > t=5
      let p;
      do { p = Math.floor(rand() * full.length); } while (used.has(p));
      used.add(p);
      corrupted[p] = (corrupted[p] + 1 + Math.floor(rand() * 255)) % 256;
    }
    const res = rsDecode(corrupted, ecLen);
    if (res && JSON.stringify(res.codewords) !== JSON.stringify(full)) {
      // A miscorrection that claims success is the dangerous case.
      clean = false;
      break;
    }
  }
  check('no silent miscorrection beyond capacity', clean);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log(`\nReed-Solomon: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
