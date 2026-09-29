/**
 * Wave 5 · lane E · the ledger (W5-E1): the only writer of save v2 `play` (data/playSave.ts, frozen format).
 *
 *   initLedger()              listens to `reward` events (any lane) and pays each source ONCE per save; returns the off
 *   pay(source, coins)        the same, called directly (tests, lane E's own pickups): the coins paid, 0 when refused
 *   isPaid(source)            already paid (or can no longer be paid: a past Bay day's trail / daily source)
 *   coinsTotal()              the balance
 *   spend(item, price)        a 小铺 purchase: false (nothing changes) when the balance is short
 *   recordBest(key, value)    lane A's activity bests into `play.b` (A decides what "better" is; ≤ 32 keys)
 *   registerRewardIds(p, ids) a lane's APPEND-ONLY id list for a prefix whose bits live in its own kind (below)
 *   subscribeLedger(fn)       the pill badge, the notebook, the coins in the world: called after every change
 *
 * Where "paid" is kept (so that nothing is ever paid twice, and the save stays small):
 *   trail:<trail>:<n>  → `play.t` (today's bitset; a new Bay day starts a fresh one: trails refill daily)
 *   daily:<date>:<n>   → `play.d` (n = 1–7 → bits 0–6, `all` → bit 7); a date before the saved one is never paid
 *   egg · view · sound · pebble · cache · ring · page → `play.g[<same kind>]`, event → `play.g.souvenir`, indexed by
 *                        the owner's registered id list (D: egg / sound / pebble, A: view, R: event, E: cache / ring / page)
 *   anything in economy/sources.ts FIXED_SOURCES (arrivals, postcards, goals, favours, the pelican) → `play.g.coin`
 *   the rest (medal:…, an unregistered id) → `play.e` (≤ 128 sources of ≤ 40 characters); when `e` is full or the
 *                        source is too long it is NOT paid (a DEV warning names it): never twice, never lost silently
 *
 * `coins` in a reward is what the emitter asks for; the ledger pays min(asked, REWARD_CAPS[prefix]), a whole number
 * ≥ 0. A 0-coin reward still marks its source. After paying it emits `{ type: 'coins', total, delta, source }`.
 * Settings → reset progress clears the save (data/save.ts clearSave): the ledger keeps no copy, so it starts over.
 *
 * Small on purpose (the first wave-5 chunk to load; lanes A / D / R import it from their own lazy chunks). Never import
 * it from a module GameRoot loads statically.
 */
import { emit, onEvent, rewardPrefix, type RewardPrefix } from '../core/events';
import { bitGet, bitSet, emptyPlay, MAX_BESTS, MAX_COINS, MAX_ONE_OFF_CHARS, MAX_ONE_OFFS, ONE_OFF_RE, PLAY_DATE_RE, type PlayBitKind, type PlaySaveV1 } from '../data/playSave';
import { onSaveCleared, patchSave, readSave } from '../data/save';
import { bayParts } from '../game/bayNow';
import { FIXED_SOURCES } from './sources';

/** The most one source of each prefix pays (plan §3.4: T1 arrival 10 · postcard 10 · egg 10 · favour 25 · …). */
export const REWARD_CAPS: Readonly<Record<RewardPrefix, number>> = {
  // ring: the air-ring coins ask 1 each; lane A's first-flight rings (ring:first-flight:<n>) ask 3 per big ring
  arrive: 10, postcard: 10, favour: 25, goal: 20, egg: 10, view: 5, sound: 5, pebble: 3, cache: 12, trail: 1, ring: 3,
  event: 15, daily: 20, page: 30, medal: 15, pelican: 20,
  // wave 6 day 0: a found jack-o'-lantern, a door's treat, the hunt's end (ids: halloween/rewards.ts)
  halloween: 25,
};

/** Prefixes whose paid bits live in their own kind, indexed by the owning lane's registered (append-only) id list. */
export const PREFIX_KIND: Readonly<Partial<Record<RewardPrefix, PlayBitKind>>> = {
  egg: 'egg', view: 'view', sound: 'sound', pebble: 'pebble', cache: 'cache', ring: 'ring', page: 'page', event: 'souvenir',
  halloween: 'halloween',
};

const fixedIndex = new Map(FIXED_SOURCES.map((s, i) => [s, i]));
const registries = new Map<RewardPrefix, Map<string, number>>();
const listeners = new Set<() => void>();
let version = 0;

const dev = () => !!import.meta.env?.DEV;
const notify = () => { version++; for (const fn of [...listeners]) { try { fn(); } catch (e) { if (dev()) console.error('[opus-bay ledger] listener', e); } } };

/** The play block now (read-only: the ledger writes a new object each time). */
export const playState = (): Readonly<PlaySaveV1> => readSave()?.play ?? emptyPlay();
const write = (next: PlaySaveV1) => patchSave(s => { s.play = next; });
/** Today's Bay date (trail refills, the daily three). */
export const todayKey = (): string => bayParts().dateKey;

export const coinsTotal = (): number => playState().c;
/** Changes every time the ledger does (useSyncExternalStore's snapshot for the badge). */
export const ledgerVersion = (): number => version;
export function subscribeLedger(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

/**
 * A lane's id list for `prefix` (egg / view / sound / pebble / event / cache / ring / page / trail): `ids[i]` is the part
 * after `<prefix>:` and owns bit i. APPEND-ONLY across releases (a moved id would read another id's bit). Registering
 * again replaces the list (last wins). Sources of that prefix paid earlier through `play.e` move into the bitset.
 */
export function registerRewardIds(prefix: RewardPrefix, ids: readonly string[]): () => void {
  const map = new Map<string, number>();
  ids.forEach((id, i) => { if (!map.has(id)) map.set(id, i); });
  registries.set(prefix, map);
  const kind = PREFIX_KIND[prefix];
  const p = playState();
  if (kind && p.e?.some(s => s.startsWith(`${prefix}:`))) {
    let bits = p.g[kind];
    const keep = p.e.filter(s => {
      const i = s.startsWith(`${prefix}:`) ? map.get(s.slice(prefix.length + 1)) : undefined;
      if (i === undefined) return true;
      bits = bitSet(bits, i);
      return false;
    });
    if (keep.length !== p.e.length) {
      const next: PlaySaveV1 = { ...p, g: { ...p.g, [kind]: bits } };
      if (keep.length) next.e = keep; else delete next.e;
      write(next);
      notify();
    }
  }
  return () => { if (registries.get(prefix) === map) registries.delete(prefix); };
}

type Slot =
  | { at: 'bit'; kind: PlayBitKind; i: number }
  | { at: 'trail'; i: number }
  | { at: 'daily'; date: string; bit: number }
  | { at: 'e' }
  | { at: 'none' };

/** Where a well-formed source's "paid" mark lives (or 'none': it cannot be kept, so it is not paid). */
function slotOf(source: string, prefix: RewardPrefix): Slot {
  const id = source.slice(prefix.length + 1);
  if (prefix === 'daily') {
    const m = /^(\d{4}-\d{2}-\d{2}):([1-7]|all)$/.exec(id);
    if (!m || !PLAY_DATE_RE.test(m[1])) return { at: 'none' };
    return { at: 'daily', date: m[1], bit: m[2] === 'all' ? 7 : Number(m[2]) - 1 };
  }
  const reg = registries.get(prefix)?.get(id);
  if (prefix === 'trail') return reg === undefined ? { at: 'none' } : { at: 'trail', i: reg };
  const kind = PREFIX_KIND[prefix];
  if (kind && reg !== undefined) return { at: 'bit', kind, i: reg };
  const fixed = fixedIndex.get(source);
  if (fixed !== undefined) return { at: 'bit', kind: 'coin', i: fixed };
  return source.length <= MAX_ONE_OFF_CHARS && ONE_OFF_RE.test(source) ? { at: 'e' } : { at: 'none' };
}

function paidIn(p: Readonly<PlaySaveV1>, source: string, slot: Slot): boolean {
  if (p.e?.includes(source)) return true;
  switch (slot.at) {
    case 'bit': return bitGet(p.g[slot.kind], slot.i);
    case 'trail': return p.t?.d === todayKey() && bitGet(p.t.b, slot.i);
    case 'daily': return !!p.d && (slot.date < p.d.d || (slot.date === p.d.d && (p.d.m & (1 << slot.bit)) !== 0));
    default: return false;
  }
}

/** Already paid, or never payable again (a past day's daily source). False for a malformed source. */
export function isPaid(source: string): boolean {
  const prefix = rewardPrefix(source);
  return !!prefix && paidIn(playState(), source, slotOf(source, prefix));
}

/** Pay `source` once: the coins paid (0 when malformed, already paid or not storable). Emits `coins` when > 0. */
export function pay(source: string, coins: number): number {
  const prefix = rewardPrefix(source);
  if (!prefix) { if (dev()) console.warn('[opus-bay ledger] not a reward source:', source); return 0; }
  const p = playState();
  const slot = slotOf(source, prefix);
  if (slot.at === 'none') { if (dev()) console.warn('[opus-bay ledger] no place to keep', source, '(unregistered trail id, bad daily, or > 40 chars)'); return 0; }
  if (paidIn(p, source, slot)) return 0;
  const next: PlaySaveV1 = { ...p, g: { ...p.g } };
  switch (slot.at) {
    case 'bit': next.g[slot.kind] = bitSet(p.g[slot.kind], slot.i); break;
    case 'trail': next.t = { d: todayKey(), b: bitSet(p.t?.d === todayKey() ? p.t.b : '', slot.i) }; break;
    case 'daily': next.d = { d: slot.date, m: (p.d?.d === slot.date ? p.d.m : 0) | (1 << slot.bit) }; break;
    case 'e':
      if ((p.e?.length ?? 0) >= MAX_ONE_OFFS) { if (dev()) console.warn('[opus-bay ledger] play.e is full: not paid', source); return 0; }
      next.e = [...(p.e ?? []), source];
      break;
  }
  const asked = Number.isFinite(coins) ? Math.floor(coins) : 0;
  const delta = Math.max(0, Math.min(REWARD_CAPS[prefix], asked, MAX_COINS - p.c));
  next.c = p.c + delta;
  write(next);
  notify();
  if (delta > 0) emit({ type: 'coins', total: next.c, delta, source });
  return delta;
}

const BEST_KEY = /^[a-z0-9:-]{1,40}$/;
/**
 * Lane A's PlayKit (play/kit.ts writeBest, through economy/index.ts): store an activity best in `play.b`. The caller has
 * already decided it beats the old one. False (nothing written) for a bad key, a value that is not finite, or a 33rd key.
 */
export function recordBest(key: string, value: number): boolean {
  if (!BEST_KEY.test(key) || !Number.isFinite(value)) return false;
  const p = playState();
  const b = { ...(p.b ?? {}) };
  if (!(key in b) && Object.keys(b).length >= MAX_BESTS) { if (dev()) console.warn('[opus-bay ledger] play.b is full:', key); return false; }
  b[key] = Math.max(-1e9, Math.min(1e9, value));
  write({ ...p, b });
  notify();
  return true;
}

/** A purchase: takes `price` coins (a whole number > 0) when the balance covers it; emits `coins` with source `shop:<item>`. */
export function spend(item: string, price: number): boolean {
  const p = playState();
  if (!Number.isInteger(price) || price <= 0 || price > p.c) return false;
  const next: PlaySaveV1 = { ...p, c: p.c - price };
  write(next);
  notify();
  emit({ type: 'coins', total: next.c, delta: -price, source: `shop:${item}` });
  return true;
}

/**
 * Lane E's own writes beyond pay / spend (the 小铺's items and wear, the notebook's stamps; economy/wallet.ts, stamps.ts):
 * `fn` gets the play block and returns the next one, or null for no change. The balance is clamped to 0 … 999,999; when
 * it changes and `coinsSource` is given a `coins` event follows (a purchase: `shop:<item>`, delta < 0). LANE-E-INTERNAL:
 * other lanes emit `reward` or call pay / spend / recordBest. Returns whether anything was written.
 */
export function commitPlay(fn: (p: Readonly<PlaySaveV1>) => PlaySaveV1 | null, coinsSource?: string): boolean {
  const p = playState();
  const next = fn(p);
  if (!next || next === p) return false;
  next.c = Math.max(0, Math.min(MAX_COINS, Math.floor(Number.isFinite(next.c) ? next.c : p.c)));
  write(next);
  notify();
  if (coinsSource && next.c !== p.c) emit({ type: 'coins', total: next.c, delta: next.c - p.c, source: coinsSource });
  return true;
}

/** Start listening: `reward` events are paid; a reset (Settings) tells the subscribers. Returns the off. */
export function initLedger(): () => void {
  const offEvent = onEvent(e => { if (e.type === 'reward') pay(e.source, e.coins); });
  const offCleared = onSaveCleared(notify);
  return () => { offEvent(); offCleared(); };
}

/** tests: forget the registered id lists */
export function __resetLedgerForTests(): void { registries.clear(); listeners.clear(); version = 0; }
