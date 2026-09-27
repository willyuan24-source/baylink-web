import { cityEpoch, cityTerrain, heightAt } from '../core/terrain';
import { game } from '../core/store';
import { DISTRICT } from '../data/district';
import { CITY_BACKDROP } from '../world/backdrop';
import { cityModule, cityStreamerLazy } from '../world/cityLoader';
import { TallHash, type TallStructure } from './glide';

/**
 * The pelican glide's tall structures (lane E2, wave 3, E2-7): what the glide climbs over or steers round beyond the
 * blockers' roofs (core/terrain Blocker.top).
 *
 * - The hero's towers (Coit, Transamerica, Salesforce, the Ferry Building clock tower) with their modelled heights.
 * - City mode: D2's landmark tall parts (world/sf/landmarks/context landmarkTallStructures, read through the lazy city
 *   chunk: GGB legs and cables, Sutro, domes, spires, sails), each on its real base — the terrain provider's
 *   (pinned by the renderer, else resolved), else the far city's landmark proxy, else the ground there — and the Bay
 *   Bridge's west crossing as drawn by world/backdrop.ts (4 towers, the SF and centre anchorages, the deck and its main
 *   cables as a chain of circles).
 * - Anything a lane adds with setTallStructures.
 *
 * LIVE (the stale-capture fix): `LiveTall.get()` rebuilds when the world mode, the city chunk, the extra list or (at
 * most once a second) the streamed city changes — the old list was captured on the first glide, before the city
 * module or the landmark bases were in. Lookups go through glide.ts's 64 u bucket hash (TallHash).
 */

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** Modelled tower heights over their base (world/landmarks.ts): the hero district's tall landmarks. */
const TOWER_TOPS: Record<string, number> = { 'coit-tower': 16, transamerica: 41, 'salesforce-tower': 56.5, 'ferry-building': 30 };

/** The hero's towers (the list moveSystem kept since the glide landed; unchanged). */
export function heroTall(): TallStructure[] {
  return DISTRICT.landmarks.filter(l => TOWER_TOPS[l.kind] !== undefined).map(l => ({
    x: l.position.x, z: l.position.z, r: l.kind === 'ferry-building' ? 3 : 4, top: (l.baseY ?? heightAt(l.position.x, l.position.z)) + TOWER_TOPS[l.kind] + 2,
  }));
}

/**
 * The Bay Bridge's west crossing in city mode, as world/backdrop.ts bayBridge(…, city) draws it (lane C2's model: deck
 * y 10, tower tops 30, half width 3.4; the SF anchorage at the hero's bridge position, towers at the real piers W2, W3,
 * W5, W6, the centre anchorage, the Yerba Buena tunnel end): the four towers (r 5) and circles every 6 u along the
 * deck whose tops follow the main cables (never lower than the deck).
 */
export function bayBridgeTall(): TallStructure[] {
  const def = DISTRICT.backdrop.find(d => d.kind === 'bay-bridge');
  if (!def) return [];
  const a = def.position, ybi = CITY_BACKDROP['ybi-tunnel'], P = CITY_BACKDROP['bay-bridge-piers'];
  const full = Math.hypot(ybi.x - a.x, ybi.z - a.z), dx = (ybi.x - a.x) / full, dz = (ybi.z - a.z) / full;
  const along = (q: { x: number; z: number }) => (q.x - a.x) * dx + (q.z - a.z) * dz;
  const DECK = 10, TOP = 30;
  const sW1 = along(P.w2), sW2 = along(P.w3), sCA = along(P.ca), sW5 = along(P.w5), sW6 = along(P.w6);
  const cableY = (s: number) => {
    if (s <= sW1) { const t = s / sW1; return DECK + 0.8 + (TOP - DECK - 0.8) * t * t * 0.4 + (TOP - DECK - 0.8) * 0.6 * t; }
    if (s <= sW2) { const t = (s - sW1) / (sW2 - sW1); return TOP - (TOP - DECK - 2.5) * 4 * t * (1 - t); }
    if (s <= sCA) { const t = (s - sW2) / (sCA - sW2); return TOP + (16.8 - TOP) * t - 5 * t * (1 - t); }
    if (s <= sW5) { const t = (sW5 - s) / (sW5 - sCA); return TOP + (16.8 - TOP) * t - 5 * t * (1 - t); }
    if (s <= sW6) { const t = (s - sW5) / (sW6 - sW5); return TOP - (TOP - DECK - 2.5) * 4 * t * (1 - t); }
    const t = Math.max(0, full - s) / (full - sW6);
    return DECK + 0.8 + (TOP - DECK - 0.8) * t * t * 0.4 + (TOP - DECK - 0.8) * 0.6 * t;
  };
  const at = (s: number, r: number, top: number): TallStructure => ({ x: a.x + dx * s, z: a.z + dz * s, r, top });
  const out: TallStructure[] = [];
  for (const s of [sW1, sW2, sW5, sW6]) out.push(at(s, 5, TOP + 1.5));
  out.push(at(2.4, 7, DECK + 3.3), at(sCA, 6, 17.5));
  for (let s = 0; s <= full; s += 6) out.push(at(s, 4, Math.max(DECK + 0.6, cableY(s) + 0.6)));
  return out;
}

/** A 'terrain'-based landmark's base: the provider's (pinned / resolved), the far city's proxy, else the ground. */
export function landmarkBaseY(l: { id: string; x: number; z: number; base: 'terrain' | number }): number {
  if (typeof l.base === 'number') return l.base;
  const prov = cityTerrain() as { landmarkBase?: (id: string) => number | null } | null;
  const b = prov?.landmarkBase?.(l.id);
  if (typeof b === 'number' && Number.isFinite(b)) return b;
  const far = cityStreamerLazy()?.far?.landmarks.find(p => p.id === l.id);
  return far ? far.baseY : heightAt(l.x, l.z);
}

/** Everything the glide steers round right now (see the header). */
export function tallNow(extra: readonly TallStructure[] = []): TallStructure[] {
  const out = heroTall();
  if (game.get().worldMode === 'city') {
    const m = cityModule();
    if (m) out.push(...m.landmarkTallStructures(landmarkBaseY));
    out.push(...bayBridgeTall());
  }
  out.push(...extra);
  return out;
}

/** The live list: rebuilt on a change of world mode, city chunk or extras, and (≤ 1 / s) as the city streams. */
export class LiveTall {
  private hash: TallHash | null = null;
  private stamp = '';
  private epoch = -1;
  private builtAt = -1e9;
  private extra: TallStructure[] = [];
  private extraV = 0;
  /** rebuilds so far (tests / QA) */
  builds = 0;
  setExtra(list: readonly TallStructure[]) { this.extra = [...list]; this.extraV++; }
  get(now = performance.now()): TallHash {
    const city = game.get().worldMode === 'city';
    const stamp = `${city ? 'c' : 'd'}:${city && cityModule() ? 1 : 0}:${this.extraV}`;
    const e = cityEpoch();
    const stale = !this.hash || stamp !== this.stamp || (city && e !== this.epoch && now - this.builtAt > 1000);
    if (stale) {
      this.hash = new TallHash(tallNow(this.extra));
      this.stamp = stamp; this.epoch = e; this.builtAt = now;
      this.builds++;
    }
    return this.hash!;
  }
}
