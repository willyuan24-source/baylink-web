/**
 * Wave 5 (FROZEN format at day 0, plan sf-w5-plan.md §4.2 W5-0d) · save v2 `play`: coins, finds, wearables, bests.
 *
 * Lane E's ledger (economy/ledger.ts) is the only writer (through data/save.ts patchSave); every other lane reads its
 * own state through E's API or emits `reward` / `find` events. The format below never changes shape in wave 5: new
 * things go into a new bit kind's registry index (append-only registries: an index never moves) or into `e`.
 *
 *   decodePlay(raw)     untrusted input → a clean PlaySaveV1, or undefined (not an object / wrong version). Never throws.
 *   bitGet(b64, i)      bit i of a bitset (false when out of range / junk)
 *   bitSet(b64, i)      the bitset with bit i set (the input, normalised, when i is out of range)
 *
 * Bitsets: bit i lives in byte i >> 3, bit i & 7 (least significant first), bytes in standard base64 without padding,
 * trailing zero bytes trimmed (the empty set is ''). ≤ 256 characters = 192 bytes = 1,536 bits per kind (MAX_PLAY_BITS).
 *
 * DEPENDENCY-FREE (no game modules): data/save.ts imports it and the title chunk imports save.ts.
 */

export const PLAY_BIT_KINDS = ['coin', 'cache', 'ring', 'egg', 'view', 'sound', 'pebble', 'stamp', 'own', 'souvenir', 'page'] as const;
export type PlayBitKind = (typeof PLAY_BIT_KINDS)[number];
export const WEAR_SLOTS = ['baybay-scarf', 'baybay-hat', 'player-hat', 'player-pack', 'bike', 'car', 'pelican', 'frame'] as const;
export type WearSlot = (typeof WEAR_SLOTS)[number];

export interface PlaySaveV1 {
  v: 1;
  /** coins, an integer 0..999999 */
  c: number;
  /** base64 bitsets over each kind's append-only registry, ≤ 256 chars each */
  g: Partial<Record<PlayBitKind, string>>;
  /** today's trail-coin bitset + its Bay date (bayParts().dateKey); a new Bay day starts a fresh set */
  t?: { d: string; b: string };
  /** worn item index per slot (an index into lane E's append-only item list), 0..255 */
  w?: Partial<Record<WearSlot, number>>;
  /** activity bests (lane A), ≤ 32 finite numbers keyed `[a-z0-9:-]{1,40}` */
  b?: Record<string, number>;
  /** 今日三件小事: the Bay date + the done mask (bits 0..7) */
  d?: { d: string; m: number };
  /** one-off reward sources not covered by a bitset (`<prefix>:<id>`, ≤ 40 chars), ≤ 128, oldest first */
  e?: string[];
}

export const PLAY_VERSION = 1;
export const MAX_COINS = 999_999;
export const MAX_BITSET_CHARS = 256;
export const MAX_PLAY_BITS = (MAX_BITSET_CHARS / 4) * 3 * 8; // 1,536
export const MAX_BESTS = 32;
export const MAX_ONE_OFFS = 128;
export const MAX_ONE_OFF_CHARS = 40;
export const MAX_WEAR_INDEX = 255;
/** a Bay date key (bayParts().dateKey) */
export const PLAY_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const BEST_KEY = /^[a-z0-9:-]{1,40}$/;
/** a one-off reward source kept in `e` (the core/events REWARD_SOURCE shape, at most 40 characters) */
export const ONE_OFF_RE = /^[a-z]+:[a-z0-9:@-]{1,38}$/;
const B64_RE = /^[A-Za-z0-9+/]*$/;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INDEX: Record<string, number> = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));

/** base64 (no padding) → bytes; null when the text is not base64 of whole bytes or too long. */
function toBytes(b64: string | undefined): number[] | null {
  if (b64 === undefined || b64 === '') return [];
  if (typeof b64 !== 'string' || b64.length > MAX_BITSET_CHARS) return null;
  const s = b64.replace(/=+$/, '');
  if (!B64_RE.test(s) || s.length % 4 === 1) return null;
  const out: number[] = [];
  let acc = 0, bits = 0;
  for (const ch of s) {
    acc = ((acc << 6) | INDEX[ch]) & 0xffff;
    bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  return out;
}

/** bytes → base64 without padding, trailing zero bytes trimmed. */
function fromBytes(bytes: number[]): string {
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

/** A valid bitset in its normal form ('' for none), or undefined for junk. */
export function normalBits(b64: unknown): string | undefined {
  if (typeof b64 !== 'string') return undefined;
  const bytes = toBytes(b64);
  return bytes ? fromBytes(bytes) : undefined;
}

const bitOk = (i: number) => Number.isInteger(i) && i >= 0 && i < MAX_PLAY_BITS;

export function bitGet(b64: string | undefined, i: number): boolean {
  if (!bitOk(i)) return false;
  const bytes = toBytes(b64);
  if (!bytes) return false;
  const byte = bytes[i >> 3];
  return byte !== undefined && (byte & (1 << (i & 7))) !== 0;
}

export function bitSet(b64: string | undefined, i: number): string {
  const bytes = toBytes(b64) ?? [];
  if (bitOk(i)) {
    while (bytes.length <= i >> 3) bytes.push(0);
    bytes[i >> 3] |= 1 << (i & 7);
  }
  return fromBytes(bytes);
}

/** How many bits are set (the notebook's page counts, tests). */
export function bitCount(b64: string | undefined): number {
  let n = 0;
  for (let byte of toBytes(b64) ?? []) for (; byte; byte &= byte - 1) n++;
  return n;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const own = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** save v2 `play` as untrusted input → a clean PlaySaveV1 (bad rows dropped, numbers clamped), or undefined. */
export function decodePlay(raw: unknown): PlaySaveV1 | undefined {
  if (!isObj(raw) || raw.v !== PLAY_VERSION) return undefined;
  const out: PlaySaveV1 = { v: 1, c: fin(raw.c) ? Math.max(0, Math.min(MAX_COINS, Math.floor(raw.c))) + 0 : 0, g: {} };
  if (isObj(raw.g)) {
    for (const kind of PLAY_BIT_KINDS) {
      if (!own(raw.g, kind)) continue;
      const bits = normalBits(raw.g[kind]);
      if (bits) out.g[kind] = bits;
    }
  }
  if (isObj(raw.t) && typeof raw.t.d === 'string' && PLAY_DATE_RE.test(raw.t.d)) {
    const bits = normalBits(raw.t.b);
    if (bits !== undefined) out.t = { d: raw.t.d, b: bits };
  }
  if (isObj(raw.w)) {
    const w: NonNullable<PlaySaveV1['w']> = {};
    for (const slot of WEAR_SLOTS) {
      const v = own(raw.w, slot) ? raw.w[slot] : undefined;
      if (fin(v) && Number.isInteger(v) && v >= 0 && v <= MAX_WEAR_INDEX) w[slot] = v + 0; // (+ 0: never -0)
    }
    if (Object.keys(w).length) out.w = w;
  }
  if (isObj(raw.b)) {
    const b: Record<string, number> = {};
    let n = 0;
    for (const [k, v] of Object.entries(raw.b)) {
      if (n >= MAX_BESTS) break;
      if (!BEST_KEY.test(k) || !fin(v)) continue;
      b[k] = Math.max(-1e9, Math.min(1e9, v)) + 0;
      n++;
    }
    if (n) out.b = b;
  }
  if (isObj(raw.d) && typeof raw.d.d === 'string' && PLAY_DATE_RE.test(raw.d.d) && fin(raw.d.m) && Number.isInteger(raw.d.m) && raw.d.m >= 0 && raw.d.m <= 255) {
    out.d = { d: raw.d.d, m: raw.d.m + 0 };
  }
  if (Array.isArray(raw.e)) {
    const e = [...new Set(raw.e.filter((s): s is string => typeof s === 'string' && s.length <= MAX_ONE_OFF_CHARS && ONE_OFF_RE.test(s)))].slice(0, MAX_ONE_OFFS);
    if (e.length) out.e = e;
  }
  return out;
}

/** An empty play block (lane E starts from it). */
export const emptyPlay = (): PlaySaveV1 => ({ v: 1, c: 0, g: {} });
