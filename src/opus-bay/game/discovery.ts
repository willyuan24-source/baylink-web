import { useSyncExternalStore } from 'react';
import { emit } from '../core/events';
import { fleetSnapshot, glideUnlocked, setGlideUnlocked } from '../actors/moveApi';
import { runtime } from '../core/runtime';
import { game, toast } from '../core/store';
import { canStand } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { farZoneIndexAt } from '../data/cityZones';
import { patchSave, readSave, reconcileRides, MAX_DISCOVERED, MAX_ZONES } from '../data/save';
import { type CityPlace, type PlaceIndex, loadPlacesOnIdle, onPlaces, placeIndex } from '../data/sf/places';
import { pick } from '../i18n';
import { getLocale } from '../../i18n/locale';
import { cityStreamerLazy } from '../world/cityLoader';
import { registerFocusHook } from './brain';
import { type Interactable, setExtraResolver } from './interactables';
import { travelActive } from './fastTravel';
import { tickStreet } from './streets';
import { readQa } from './qa';
import { rideLog } from './transit';

/**
 * Discovery (lane G1, plan §6.7 / G1-4), city mode only.
 *
 * - A place is discovered when the player comes within 12 u of its anchor (4 Hz, never during fast travel): a
 *   `discover` event per place, and at most one gold stamp toast (+ the `stamp` event) every 4 s — several finds in
 *   that window are told together.
 * - A neighbourhood (DataSF, far.zoneGrid) is visited when the player stands in it: the map's paper fog lifts there.
 * - Both persist in save v2 (`discovered`, `zones`); `onDiscover` / `onZoneVisit` are the hooks for G2's lines.
 * - `?discover=all` (QA) discovers every place and visits every neighbourhood for this page (not saved).
 *
 * initG1() (called once by the Overlay boot) registers this, the HUD street-name tick and the save sampler through
 * brain's focus hook, and loads the places on idle in city mode.
 */

export const DISCOVER_R = 12;
export const DISCOVER_HZ_MS = 250;
export const STAMP_GAP_MS = 4000;

const discovered = new Set<string>();
const zones = new Set<string>();
let everything = false;
let epoch = 0;
const subs = new Set<() => void>();
const discoverHooks = new Set<(p: CityPlace) => void>();
const zoneHooks = new Set<(id: string) => void>();

function changed() { epoch++; for (const fn of subs) fn(); }
const subscribe = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
const getEpoch = () => epoch;
/** Re-render on any discovery / zone visit (the map, the place list). */
export function useDiscoveryEpoch(): number { return useSyncExternalStore(subscribe, getEpoch, getEpoch); }

export const isDiscovered = (id: string) => everything || discovered.has(id);
export const zoneVisited = (id: string) => everything || zones.has(id);
export const discoveredCount = () => discovered.size;
/** Every place found so far, oldest first (save v2 order, then this visit's finds): the Journal's 足迹 tab (G1-11). */
export const discoveredIds = (): readonly string[] => [...discovered];
/** The neighbourhoods visited so far (ids), in the order they were entered. */
export const visitedZoneIds = (): readonly string[] => [...zones];
export const visitedZoneCount = () => zones.size;
/** G2: a line when a place is found; returns the unsubscribe */
export function onDiscover(fn: (p: CityPlace) => void): () => void { discoverHooks.add(fn); return () => { discoverHooks.delete(fn); }; }
/** G2: a neighbourhood entered for the first time */
export function onZoneVisit(fn: (id: string) => void): () => void { zoneHooks.add(fn); return () => { zoneHooks.delete(fn); }; }

/** Pure: the places within DISCOVER_R of p that are not known yet (11.9 u finds, 12.1 u does not). */
export function newlyDiscovered(ix: Pick<PlaceIndex, 'near'>, p: Vec2, known: (id: string) => boolean, r = DISCOVER_R): CityPlace[] {
  return ix.near(p.x, p.z, r).filter(pl => !known(pl.id));
}

/** Pure toast throttle: one toast per gap; finds inside the gap wait and are told together. */
export class StampThrottle {
  private last = -Infinity;
  private queue: CityPlace[] = [];
  private readonly gapMs: number;
  constructor(gapMs = STAMP_GAP_MS) { this.gapMs = gapMs; }
  push(p: CityPlace) { this.queue.push(p); }
  /** the finds to announce now (empty while waiting) */
  take(now: number): CityPlace[] {
    if (!this.queue.length || now - this.last < this.gapMs) return [];
    this.last = now;
    const out = this.queue;
    this.queue = [];
    return out;
  }
}

const stamps = new StampThrottle();

function announce(found: CityPlace[]) {
  const loc = getLocale();
  const first = found[0];
  const text = found.length === 1
    ? pick({ zh: `发现新地点：${first.name.zh}`, en: `New place found: ${first.name.en}` }, loc)
    : pick({ zh: `发现 ${found.length} 个新地点：${first.name.zh} 等`, en: `${found.length} new places: ${first.name.en} and more` }, loc);
  toast(text, 'gold', 3200);
  emit({ type: 'stamp' });
}

function persist() {
  patchSave(s => {
    s.discovered = [...discovered].slice(-MAX_DISCOVERED);
    s.zones = [...zones].slice(-MAX_ZONES);
  });
}

export function markDiscovered(p: CityPlace, save = true) {
  if (discovered.has(p.id)) return;
  discovered.add(p.id);
  emit({ type: 'discover', id: p.id, kind: p.landmark ? 'landmark' : 'place' });
  for (const fn of discoverHooks) fn(p);
  stamps.push(p);
  if (save) persist();
  changed();
}

export function visitZone(id: string) {
  if (zones.has(id)) return;
  zones.add(id);
  emit({ type: 'discover', id, kind: 'zone' });
  for (const fn of zoneHooks) fn(id);
  persist();
  changed();
}

let lastTick = 0;
/** Focus-hook tick (10 Hz; 4 Hz inside). */
export function updateDiscovery(p: Vec2, now: number) {
  if (now - lastTick < DISCOVER_HZ_MS) return;
  lastTick = now;
  const s = game.get();
  if (s.worldMode !== 'city' || s.phase !== 'playing' || travelActive()) return;
  const far = cityStreamerLazy()?.far;
  if (far) {
    const zi = farZoneIndexAt(far, p.x, p.z);
    if (zi >= 0 && far.zones[zi]) visitZone(far.zones[zi].id);
  }
  const ix = placeIndex();
  if (ix) for (const pl of newlyDiscovered(ix, p, isDiscovered)) markDiscovered(pl);
  const told = stamps.take(now);
  if (told.length) announce(told);
}

// ---------------------------------------------------------------------------
// Save sampler: the last safe spot (on foot, standing still or walking, standable) every 3 s
// ---------------------------------------------------------------------------

const SAMPLE_MS = 3000;
let lastSample = 0;
let glideRestored = false;
function sampleLastSafe(now: number) {
  if (now - lastSample < SAMPLE_MS) return;
  lastSample = now;
  const s = game.get();
  // city mode only: the district title and flow stay exactly as they were
  if (s.worldMode !== 'city' || s.phase !== 'playing' || travelActive()) return;
  // save v2 `unlocked.glide` once more when play begins: the boot-time call can land on an ActorSystem that React
  // rebuilds (dev StrictMode, a remount), which starts locked again
  if (!glideRestored) { glideRestored = true; if (readSave()?.unlocked?.glide && !glideUnlocked()) setGlideUnlocked(true); }
  // lane F's counted rides this visit (noteRide already writes each one; this only catches a missed one)
  reconcileRides(rideLog());
  // the pelican glide unlock (E2's moveApi), restored on the next city start (?debug=1 unlocks it for the page only)
  if (glideUnlocked() && !readQa().debug && !readSave()?.unlocked?.glide) patchSave(sv => { sv.unlocked = { ...sv.unlocked, glide: true }; });
  const fleet = fleetSnapshot();
  const prevFleet = readSave()?.vehicles;
  if (JSON.stringify(fleet) !== JSON.stringify(prevFleet ?? {})) patchSave(sv => { if (fleet.bike || fleet.car) sv.vehicles = fleet; else delete sv.vehicles; });
  const pl = runtime.player;
  if (s.move.mode !== 'foot' || s.riding || pl.locked || !Number.isFinite(pl.x) || !Number.isFinite(pl.z) || !canStand(pl.x, pl.z)) return;
  const prev = readSave()?.lastSafe;
  if (prev && prev.world === s.worldMode && Math.hypot(prev.x - pl.x, prev.z - pl.z) < 1) return;
  patchSave(sv => { sv.lastSafe = { world: s.worldMode, x: pl.x, z: pl.z, heading: pl.heading, ...(s.area && /^[a-z0-9:-]{1,80}$/.test(s.area) ? { zone: s.area } : {}) }; });
}

let booted = false;
/** Once per page (Overlay boot): discovery, street names, the save sampler; restores discoveries from save v2. */
export function initG1(): () => void {
  if (booted) return () => {};
  booted = true;
  const saved = readSave();
  for (const id of saved?.discovered ?? []) discovered.add(id);
  for (const id of saved?.zones ?? []) zones.add(id);
  // save v2 `unlocked.glide` → E2's moveApi (safe before the ActorSystem binds; quiet: no "unlocked" line)
  if (game.get().worldMode === 'city' && saved?.unlocked?.glide && !glideUnlocked()) setGlideUnlocked(true);
  everything = typeof location !== 'undefined' && /[?&]discover=all(?:&|$)/.test(location.search);
  const offHook = registerFocusHook('g1', {
    tick(p, now) {
      if (game.get().worldMode === 'city') {
        loadPlacesOnIdle();
        updateDiscovery(p, now);
        tickStreet(p, now);
      }
      sampleLastSafe(now);
    },
  });
  // `place:<id>` → an interactable for navigateTo / the waypoint / mapTarget (not in interactables(): no E prompt)
  setExtraResolver(id => (id.startsWith('place:') ? placeInteractable(id.slice(6)) : undefined));
  // a place already underfoot when the index arrives (resume, ?at=) is found on the next tick; repaint the map now
  const offPlaces = onPlaces(() => changed());
  return () => { offHook(); offPlaces(); setExtraResolver(null); booted = false; };
}

/** The interactable a place resolves to (radius 12 = the discovery radius). */
export function placeInteractable(id: string): Interactable | undefined {
  const p = placeIndex()?.get(id);
  if (!p) return undefined;
  return { id: `place:${p.id}`, source: 'place', action: 'info', verb: { zh: '看看', en: 'Look' }, name: p.name, x: p.arrival.x, z: p.arrival.z, radius: DISCOVER_R };
}
