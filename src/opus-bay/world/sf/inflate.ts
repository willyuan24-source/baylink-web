/**
 * W9-E-review (E-RC-1) · gzip inflate for engines without DecompressionStream.
 *
 * The city's .obc files (chunks, far board, satellite boards, walking graph) are raw gzip and format.ts gunzip() used
 * DecompressionStream only — which Safari / iOS Safari have from 16.4 and Firefox from 113 (MDN browser-compat-data
 * api/DecompressionStream.json, read 2026-10-02: https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/DecompressionStream.json).
 * Since W9-E the site parses on Safari / iOS 15 (build.target), and the /play switch sends every card, sidebar and /play
 * visitor into the game: on iOS 15 – 16.3 the title and Start worked, then every city decode threw a ReferenceError.
 *
 * A small RFC 1951 inflate (puff-style canonical Huffman decode) behind RFC 1952's gzip header. It is loaded only when
 * DecompressionStream is missing (a lazy chunk on the main thread; inlined into the iife city worker), so nothing
 * changes for engines that have the stream. No dependency (package.json is frozen).
 */

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

interface Huff { counts: Uint16Array; symbols: Uint16Array }

function huff(lengths: ArrayLike<number>, n: number): Huff {
  const counts = new Uint16Array(16), offs = new Uint16Array(16), symbols = new Uint16Array(n);
  for (let i = 0; i < n; i++) counts[lengths[i]]++;
  counts[0] = 0;
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
  for (let i = 0; i < n; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
  return { counts, symbols };
}

let FIXED: [Huff, Huff] | null = null;
function fixed(): [Huff, Huff] {
  if (!FIXED) {
    const l = new Uint8Array(288);
    l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
    FIXED = [huff(l, 288), huff(new Uint8Array(30).fill(5), 30)];
  }
  return FIXED;
}

class Inflater {
  pos: number;
  private buf = 0;
  private cnt = 0;
  out: Uint8Array;
  len = 0;
  private readonly src: Uint8Array;
  constructor(src: Uint8Array, start: number, sizeHint: number) {
    this.src = src;
    this.pos = start;
    this.out = new Uint8Array(Math.max(1024, sizeHint));
  }

  private bits(n: number): number {
    let v = this.buf;
    while (this.cnt < n) {
      if (this.pos >= this.src.length) throw new Error('inflate: unexpected end of data');
      v |= this.src[this.pos++] << this.cnt;
      this.cnt += 8;
    }
    this.buf = v >>> n;
    this.cnt -= n;
    return v & ((1 << n) - 1);
  }

  private room(n: number): void {
    if (this.len + n <= this.out.length) return;
    let size = this.out.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.out.subarray(0, this.len));
    this.out = next;
  }

  private sym(h: Huff): number {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= this.bits(1);
      const count = h.counts[len];
      if (code - count < first) return h.symbols[index + (code - first)];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error('inflate: bad Huffman code');
  }

  private stored(): void {
    this.buf = 0;
    this.cnt = 0;
    const s = this.src, p = this.pos;
    if (p + 4 > s.length) throw new Error('inflate: unexpected end of data');
    const n = s[p] | (s[p + 1] << 8), nn = s[p + 2] | (s[p + 3] << 8);
    if (n !== (~nn & 0xffff)) throw new Error('inflate: stored block length mismatch');
    if (p + 4 + n > s.length) throw new Error('inflate: unexpected end of data');
    this.room(n);
    this.out.set(s.subarray(p + 4, p + 4 + n), this.len);
    this.len += n;
    this.pos = p + 4 + n;
  }

  private codes(lit: Huff, dist: Huff): void {
    for (;;) {
      let s = this.sym(lit);
      if (s < 256) {
        this.room(1);
        this.out[this.len++] = s;
        continue;
      }
      if (s === 256) return;
      s -= 257;
      if (s >= 29) throw new Error('inflate: bad length symbol');
      const n = LBASE[s] + this.bits(LEXT[s]);
      const ds = this.sym(dist);
      if (ds >= 30) throw new Error('inflate: bad distance symbol');
      const d = DBASE[ds] + this.bits(DEXT[ds]);
      if (d > this.len) throw new Error('inflate: distance too far back');
      this.room(n);
      const o = this.out;
      for (let i = 0, from = this.len - d; i < n; i++) o[this.len++] = o[from + i];
    }
  }

  private dynamic(): void {
    const nlen = this.bits(5) + 257, ndist = this.bits(5) + 1, ncode = this.bits(4) + 4;
    if (nlen > 286 || ndist > 30) throw new Error('inflate: bad code counts');
    const cl = new Uint8Array(19);
    for (let i = 0; i < ncode; i++) cl[CLORDER[i]] = this.bits(3);
    const clh = huff(cl, 19);
    const lengths = new Uint8Array(nlen + ndist);
    for (let i = 0; i < nlen + ndist;) {
      const s = this.sym(clh);
      if (s < 16) { lengths[i++] = s; continue; }
      let v = 0, rep: number;
      if (s === 16) {
        if (i === 0) throw new Error('inflate: repeat with no first length');
        v = lengths[i - 1];
        rep = 3 + this.bits(2);
      } else if (s === 17) rep = 3 + this.bits(3);
      else rep = 11 + this.bits(7);
      if (i + rep > nlen + ndist) throw new Error('inflate: too many lengths');
      while (rep--) lengths[i++] = v;
    }
    if (lengths[256] === 0) throw new Error('inflate: no end-of-block code');
    this.codes(huff(lengths.subarray(0, nlen), nlen), huff(lengths.subarray(nlen), ndist));
  }

  /** Inflate one raw DEFLATE stream from `pos`; leaves `pos` on the byte after it. */
  run(): void {
    let last = 0;
    while (!last) {
      last = this.bits(1);
      const type = this.bits(2);
      if (type === 0) this.stored();
      else if (type === 1) { const [l, d] = fixed(); this.codes(l, d); }
      else if (type === 2) this.dynamic();
      else throw new Error('inflate: bad block type');
    }
    this.buf = 0;
    this.cnt = 0;
  }
}

/** Skip an RFC 1952 member header at `p`; return where its DEFLATE data starts. */
function header(b: Uint8Array, p: number): number {
  if (p + 10 > b.length || b[p] !== 0x1f || b[p + 1] !== 0x8b || b[p + 2] !== 8) throw new Error('gunzip: not a gzip member');
  const flg = b[p + 3];
  p += 10;
  if (flg & 4) p += 2 + (b[p] | (b[p + 1] << 8)); // FEXTRA
  if (flg & 8) { while (p < b.length && b[p] !== 0) p++; p++; } // FNAME
  if (flg & 16) { while (p < b.length && b[p] !== 0) p++; p++; } // FCOMMENT
  if (flg & 2) p += 2; // FHCRC
  if (p > b.length) throw new Error('gunzip: truncated header');
  return p;
}

/** Inflate gzip bytes (every concatenated member, like DecompressionStream('gzip')). */
export function gunzipSync(bytes: Uint8Array): Uint8Array {
  const n = bytes.length;
  // ISIZE (the last member's size mod 2^32) sizes the first buffer; it grows when the data is bigger
  const hint = n >= 4 ? (bytes[n - 4] | (bytes[n - 3] << 8) | (bytes[n - 2] << 16) | (bytes[n - 1] << 24)) >>> 0 : 0;
  const inf = new Inflater(bytes, header(bytes, 0), Math.min(hint, 1 << 28));
  for (;;) {
    inf.run();
    inf.pos += 8; // CRC32 + ISIZE
    if (inf.pos > n) throw new Error('gunzip: truncated trailer');
    if (inf.pos + 2 > n || bytes[inf.pos] !== 0x1f || bytes[inf.pos + 1] !== 0x8b) break;
    inf.pos = header(bytes, inf.pos);
  }
  return inf.len === inf.out.length ? inf.out : inf.out.slice(0, inf.len);
}
