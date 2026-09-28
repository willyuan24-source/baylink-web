import { bitGet, MAX_PLAY_BITS, normalBits } from '../data/playSave';

/**
 * Wave 5 · lane E · bit helpers the frozen data/playSave.ts does not have: clearing a bit (a used 飞行券, a finished
 * compass) and listing the set bits. Same format (bit i in byte i >> 3, least significant first, base64 without padding,
 * trailing zero bytes trimmed), so a cleared set is the same string bitSet would have built.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesOf(b64: string | undefined): number[] {
  const s = normalBits(b64 ?? '') ?? '';
  const out: number[] = [];
  let acc = 0, bits = 0;
  for (const ch of s) {
    acc = ((acc << 6) | ALPHABET.indexOf(ch)) & 0xffff;
    bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  return out;
}

function b64Of(bytes: number[]): string {
  let n = bytes.length;
  while (n > 0 && bytes[n - 1] === 0) n--;
  let out = '';
  for (let i = 0; i < n; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < n ? bytes[i + 1] : 0, b2 = i + 2 < n ? bytes[i + 2] : 0;
    const v = (b0 << 16) | (b1 << 8) | b2;
    out += ALPHABET[(v >> 18) & 63] + ALPHABET[(v >> 12) & 63];
    if (i + 1 < n) out += ALPHABET[(v >> 6) & 63];
    if (i + 2 < n) out += ALPHABET[v & 63];
  }
  return out;
}

/** The bitset without bit i (unchanged, normalised, when i is out of range or not set). */
export function bitClear(b64: string | undefined, i: number): string {
  const bytes = bytesOf(b64);
  if (Number.isInteger(i) && i >= 0 && i < MAX_PLAY_BITS && bitGet(b64, i)) bytes[i >> 3] &= ~(1 << (i & 7)) & 0xff;
  return b64Of(bytes);
}

/** The indices of the set bits, ascending. */
export function bitList(b64: string | undefined): number[] {
  const out: number[] = [];
  bytesOf(b64).forEach((byte, k) => { for (let j = 0; j < 8; j++) if (byte & (1 << j)) out.push(k * 8 + j); });
  return out;
}
