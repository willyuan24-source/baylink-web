import * as THREE from 'three';
import { canStand, heightAt, isWater, surfaceAt } from '../core/terrain';
import { KIT_FOOTPRINT } from '../realsf/eventKit';
import { activeEventsAt, type EventWindow } from '../realsf/events';
import { EVENT_VENUES, type KitKind } from '../realsf/eventVenues';
import { BOX, M, Batch, type Info } from '../world/builder';
import { TOY } from '../world/materials';
import { addPumpkin } from './worldDress';
import type { HaloSpot } from './worldHalos';

/**
 * Wave 7 · lane H (W7-H7) · pumpkins at the season's pumpkin events, beside lane S's event kits (realsf/eventVenues.ts
 * kitAt): the **Sunnydale Pumpkin Fest** at The Hub (catalog `sf-sunnydale-pumpkin-fest-2026`: 10/17 · 12:00–15:00) and
 * **Thrill-O-Ween** at Thrive City (catalog `sf-thrive-thrill-o-ween-2026`: 10/24 · 12:00–17:00). The dates and hours
 * are the catalog's (DESIGN §8: events come only from /planner-catalog.json — realsf/events.ts activeEventsAt), so the
 * patch stands exactly while the event's kit does; nothing is hard-coded here but which events get pumpkins.
 *
 * A pumpkin patch either side of the kit (hay bales with pumpkins on them, pumpkins on the ground, a few carved) on the
 * kit's own frame (+z its front), each spot kept only where the ground is standable and not the roadway. One small mesh
 * on the static TOY program (a plain Mesh with receiveShadow, like the stoops): 1 call while an event is on and the
 * player is within VENUE_NEAR; the carved faces' halos go to the Halloween pool at night.
 */

/** the catalog events that get a pumpkin patch */
export const PUMPKIN_EVENTS: readonly string[] = ['sf-sunnydale-pumpkin-fest-2026', 'sf-thrive-thrill-o-ween-2026'];
/** built within this of the kit (u) */
export const VENUE_NEAR = 140;
/**
 * (W7-H7 part c) The kits that can hold a pumpkin event (lane S's venue rows listing one): the catalog is only scanned
 * (activeEventsAt, ≈ 300 events) when the player is within VENUE_NEAR of one of them — elsewhere the step costs a few
 * distance checks.
 */
export const PUMPKIN_KITS: readonly { x: number; z: number }[] = EVENT_VENUES
  .filter(v => v.events.some(e => PUMPKIN_EVENTS.includes(e)))
  .map(v => v.kitAt ?? { x: v.x, z: v.z });
/** BAYBAY's line within this of the kit (u) */
export const VENUE_LINE_NEAR = 30;

const HAY = '#d8b35a', HAY_DARK = '#b8913f';
const ORANGE = ['#e8792b', '#d9651f', '#f0913a', '#e36f24'];
const PATCH_GLOW: Info = [0, 0, 0, 0.95];

/**
 * The patch in the kit's local frame, per side (mirrored): [lx, lz, kind] — lx past the kit's own footprint side
 * (realsf/eventKit.ts KIT_FOOTPRINT + PATCH_GAP); kind 0 a hay bale with two pumpkins on it, 1 a big pumpkin on the
 * ground, 2 a small one, 3 a carved one.
 */
const PATCH: readonly (readonly [number, number, number])[] = [
  [0.3, 0.4, 0], [1.6, 1.6, 1], [0.1, 2.1, 3], [1.9, -0.2, 2], [0.9, 3.2, 2], [2.7, 1.0, 3], [0.6, -1.2, 1],
];
export const PATCH_GAP = 0.8;

/** World spots of the patch around a kit (local → world as realsf/eventKit.ts: x' = x + lx·cos + lz·sin, z' = z − lx·sin + lz·cos). */
export function patchSpots(at: { x: number; z: number; yaw: number }, kind: KitKind = 'festival'): { x: number; z: number; kind: number; k: number; lx: number }[] {
  const cos = Math.cos(at.yaw), sin = Math.sin(at.yaw);
  const fp = KIT_FOOTPRINT[kind], base = Math.max(Math.abs(fp[0]), Math.abs(fp[1])) + PATCH_GAP;
  const out: { x: number; z: number; kind: number; k: number; lx: number }[] = [];
  let k = 0;
  for (const side of [-1, 1]) for (const [dx, lz, kind] of PATCH) {
    const lx = (base + dx) * side;
    out.push({ x: at.x + lx * cos + lz * sin, z: at.z - lx * sin + lz * cos, kind, k: k++, lx });
  }
  return out;
}

/** A spot the patch may use: standable, not the roadway, not water (the published city's terrain). */
export const patchSpotOk = (x: number, z: number): boolean => canStand(x, z, 0.5) && surfaceAt(x, z) !== 'road' && !isWater(x, z);

/** The patch's geometry at a kit (only the spots that pass `ok`), its halos into `halos`. */
export function buildPatch(at: { x: number; z: number; yaw: number }, halos: HaloSpot[], ok = patchSpotOk, ground = heightAt, kind: KitKind = 'festival'): { geo: THREE.BufferGeometry | null; placed: number } {
  const b = new Batch();
  let placed = 0;
  for (const s of patchSpots(at, kind)) {
    if (!ok(s.x, s.z)) continue;
    const y = ground(s.x, s.z);
    if (!Number.isFinite(y)) continue;
    placed++;
    const f = at.yaw + (s.k % 5) * 0.7, col = ORANGE[s.k % ORANGE.length];
    if (s.kind === 0) {
      b.add(BOX(), M(s.x, y, s.z, at.yaw + 0.2 * (s.k % 3), 0.9, 0.45, 0.55), s.k % 2 ? HAY : HAY_DARK);
      addPumpkin(b, [s.x - 0.18, y + 0.45, s.z], 0.2, f, col, false);
      addPumpkin(b, [s.x + 0.22, y + 0.45, s.z + 0.05], 0.16, f + 1, ORANGE[(s.k + 1) % 4], false);
    } else if (s.kind === 1) addPumpkin(b, [s.x, y, s.z], 0.36, f, col, false);
    else if (s.kind === 2) addPumpkin(b, [s.x, y, s.z], 0.22, f, col, false);
    else addPumpkin(b, [s.x, y, s.z], 0.3, at.yaw, col, true, PATCH_GLOW, halos);
  }
  return { geo: placed ? b.build() : null, placed };
}

export interface VenuePatches {
  group: THREE.Group;
  /** ≈ 2 Hz: the pumpkin events on now (`on`: the season wants them) near (px, pz) */
  step(px: number, pz: number, on: boolean, now?: Date): void;
  halos(): readonly HaloSpot[];
  /** the event whose patch is within `max` (u) of (x, z), or null (BAYBAY's line) */
  near(x: number, z: number, max: number): string | null;
  stats(): { event: string | null; placed: number };
  dispose(): void;
}

export function createVenuePatches(active: (now?: Date) => EventWindow[] = activeEventsAt, ok = patchSpotOk, ground = heightAt): VenuePatches {
  const group = new THREE.Group();
  group.name = 'halloween-venue-pumpkins';
  let mesh: THREE.Mesh | null = null;
  let shown: { id: string; x: number; z: number } | null = null;
  let halos: HaloSpot[] = [];
  let placed = 0;
  let retryAt = 0;
  const drop = () => { if (mesh) { group.remove(mesh); mesh.geometry.dispose(); mesh = null; } shown = null; halos = []; placed = 0; };
  return {
    group,
    step: (px, pz, on, now) => {
      let want: EventWindow | null = null;
      const nearKit = on && PUMPKIN_KITS.some(k => Math.hypot(k.x - px, k.z - pz) < VENUE_NEAR);
      if (nearKit) for (const w of active(now)) {
        if (!PUMPKIN_EVENTS.includes(w.event.id)) continue;
        const at = w.venue.kitAt ?? { x: w.venue.x, z: w.venue.z, yaw: 0 };
        if (Math.hypot(at.x - px, at.z - pz) < VENUE_NEAR) { want = w; break; }
      }
      if (!want) { drop(); return; }
      if (shown?.id === want.event.id && (mesh || performance.now() < retryAt)) return;
      drop();
      const at = want.venue.kitAt ?? { x: want.venue.x, z: want.venue.z, yaw: 0 };
      const hl: HaloSpot[] = [];
      const r = buildPatch(at, hl, ok, ground, want.venue.kit);
      shown = { id: want.event.id, x: at.x, z: at.z };
      // the ground there may still be streaming in: try again in a few seconds when nothing could be placed
      if (!r.geo) { retryAt = performance.now() + 3000; return; }
      mesh = new THREE.Mesh(r.geo, TOY);
      mesh.name = 'halloween-venue-pumpkins';
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorldAutoUpdate = false;
      mesh.receiveShadow = true;
      group.add(mesh);
      halos = hl;
      placed = r.placed;
    },
    halos: () => halos,
    near: (x, z, max) => (shown && mesh && Math.hypot(shown.x - x, shown.z - z) <= max ? shown.id : null),
    stats: () => ({ event: mesh ? shown?.id ?? null : null, placed }),
    dispose: drop,
  };
}
