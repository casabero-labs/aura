/**
 * Browser-safe deterministic hashing.
 * Abstracts sha256 away so Contracts v2 compiles in Vite/browser.
 * Falls back to a pure-JS implementation when node:crypto is unavailable.
 */

type HashFn = (input: string) => string;

let _sha256: HashFn | null = null;

function getSha256(): HashFn {
  if (_sha256) return _sha256;

  try {
    const { createHash } = require('node:crypto') as typeof import('node:crypto');
    _sha256 = (input: string) => createHash('sha256').update(input).digest('hex');
    return _sha256;
  } catch {
    // node:crypto not available — pure JS fallback
    _sha256 = jsSha256hex;
    return _sha256;
  }
}

/**
 * Deterministic SHA-256 hex digest.
 * Works in Node (node:crypto) and browser (pure JS fallback).
 */
export function sha256hex(input: string): string {
  return getSha256()(input);
}

/**
 * Truncated SHA-256 hex (first `len` chars). Default 8.
 */
export function sha256short(input: string, len = 8): string {
  return sha256hex(input).slice(0, len);
}

/**
 * Pure JS SHA-256 (FIPS 180-4). Fallback when node:crypto unavailable.
 * Deterministic and browser-safe.
 */
function jsSha256hex(input: string): string {
  const msg = utf8Encode(input);
  const ml = msg.length * 8;

  // Padding
  msg.push(0x80);
  while ((msg.length % 64) !== 56) msg.push(0x00);
  // Append length as 64-bit big-endian
  for (let i = 0; i < 8; i++) {
    msg.push((ml >>> (56 - i * 8)) & 0xff);
  }

  // Initial hash values
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  // Round constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  // Process each 512-bit chunk
  for (let i = 0; i < msg.length; i += 64) {
    const W = new Uint32Array(64);
    for (let t = 0; t < 16; t++) {
      W[t] = (msg[i + t * 4] << 24) | (msg[i + t * 4 + 1] << 16) | (msg[i + t * 4 + 2] << 8) | msg[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }

  return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

function utf8Encode(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let cp = str.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < str.length) {
      const lo = str.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      }
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >>> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >>> 12), 0x80 | ((cp >>> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      bytes.push(0xf0 | (cp >>> 18), 0x80 | ((cp >>> 12) & 0x3f), 0x80 | ((cp >>> 6) & 0x3f), 0x80 | (cp & 0x3f));
    }
  }
  return bytes;
}

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}
