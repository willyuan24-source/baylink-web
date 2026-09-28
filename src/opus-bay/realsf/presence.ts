import * as THREE from 'three';
import { setLoop } from '../audio/hooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { canStand, heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { isPaid, registerRewardIds } from '../economy/ledger';
import { bayNow, bayParts } from '../game/bayNow';
import { registerFlagSource, type ExtraFlag, type FlagGlyph } from '../game/flags';
import { openEvent } from '../game/flow';
import { invalidateInteractables, registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { cityStreamerLazy } from '../world/cityLoader';
import { freezeStatic } from '../world/builder';
import { registerWarmup, meshWarmup } from '../world/warmup';
import { getWorld, type WorldSystem } from '../world/world';
import { addCrowdSpots } from '../world/sf/crowdSpots';
import { buildKitGeometry, kitCrowd, kitPrompt, makeKitMaterial } from './eventKit';
import { hearGain, LOOP_IDS, registerEventLoops } from './eventSounds';
import { EVENT_SAY, SOUVENIR_IDS, VENUE_SAY, type EventVenue, type KitKind } from './eventVenues';
import { activeEventsAt, type EventWindow } from './events';
import { bayHm } from './sun';
import type { OfferedLine } from './lines';

/**
 * Wave 5 · lane R (W5-R3) · San Francisco's events in the world during their real window (plan §3.3 item 2):
 *
 *   - a coral pennant over the venue (lane N's flag layer, `registerFlagSource`: no new draw call)
 *   - toy visitors round it (lane T's crowd spots, the 3 u clear lane kept)
 *   - a small toy kit by kind (realsf/eventKit.ts: ≤ 1.5k triangles, one draw call each, at most 2 built, nearest the
 *     player; none downtown until lane V publishes the headroom)
 *   - an original loop by kind within ≈ 150 u (realsf/eventSounds.ts)
 *   - BAYBAY's line once per event per Bay day when you come within 150 u (offered to realsf/index.ts's scheduler)
 *   - at the event (within 25 u) the first time: its souvenir stamp + 15 coins through lane E's ledger (`reward`
 *     `event:<id>`, never for sale), a `find` souvenir, and the `realsf` enter / leave events
 *   - the E prompt at the kit opens the existing EventCard (official link, /events/:id, 加入想去, 带我去)
 *
 * Everything follows the Bay clock (`?date=` in DEV / QA builds) and the loaded catalog; a 2 Hz frame system.
 */

export const EVENT_CORAL = '#e8705a';
/** kits stand within this of the player (u); the nearest KITS_MAX are built */
export const KIT_NEAR = 450;
export const KITS_MAX = 2;
/** BAYBAY's line within this of the venue (u) */
export const LINE_NEAR = 150;
/** "at the event": the souvenir, `event-enter` (u); `event-leave` beyond LEAVE */
export const AT_EVENT = 25;
export const LEAVE = 60;

const GLYPH: Record<KitKind, FlagGlyph> = { music: 'Music', festival: 'Sparkles', fair: 'ShoppingBag', parade: 'Sparkles', street: 'Sparkles', board: 'CalendarDays' };

/** The kit's spot and facing: the venue row's `kitAt`, else the venue point facing +z. */
export const kitSpot = (v: EventVenue) => v.kitAt ?? { x: v.x, z: v.z, yaw: 0 };

/** BAYBAY's line for an open event (≤ 45 zh characters): 今天金门公园有免费的蓝草音乐节，9:00–19:00，出发前查官网确认哦。 */
export function eventLine(w: EventWindow): Bilingual {
  const place = VENUE_SAY[w.venue.id] ?? w.venue.name;
  const name = EVENT_SAY[w.event.id] ?? { zh: '活动', en: 'an event' };
  const free = w.event.cost === 'free';
  const hours = `${bayHm(new Date(w.open)).replace(/^0/, '')}–${bayHm(new Date(w.close)).replace(/^0/, '')}`;
  let zh = `今天${place.zh}有${free ? '免费的' : ''}${name.zh}，${hours}，出发前查官网确认哦。`;
  if ([...zh].length > 45) zh = `今天${place.zh}有${name.zh}，${hours}，出发前查官网哦。`;
  return {
    zh,
    en: `${place.en} has ${name.en} today${free ? ' (free)' : ''}, ${hours} — check the official site before you go.`,
  };
}

/** The souvenir line (first time at the event). */
export function souvenirLine(w: EventWindow): Bilingual {
  const name = EVENT_SAY[w.event.id] ?? { zh: '活动', en: 'the event' };
  return { zh: `${name.zh}纪念章收好啦！`, en: `A souvenir stamp from ${name.en}!` };
}

interface Kit { id: string; mesh: THREE.Mesh; tris: number }

export interface Presence {
  /** lines on offer now (the scheduler in realsf/index.ts picks at most one) */
  offered(): OfferedLine[];
  /** tests / QA: what stands now */
  stats(): { open: string[]; kits: { id: string; tris: number }[]; crowds: string[]; near: string | null };
  off(): void;
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export function initPresence(): Presence {
  const offIds = registerRewardIds('event', SOUVENIR_IDS);
  const offLoops = registerEventLoops();
  const material = makeKitMaterial();
  const offWarm = registerWarmup('r-event-kit', () => meshWarmup(material, { receiveShadow: true }));

  let open: EventWindow[] = [];
  const crowds = new Map<string, () => void>();
  const kits = new Map<string, Kit>();
  const inside = new Set<string>();
  let lines: OfferedLine[] = [];
  /** souvenir lines wait until said (the scheduler's day memory then skips them) */
  const souvenirs: OfferedLine[] = [];
  /** (review) the Bay day the waiting souvenir lines belong to: a new day drops them (the scheduler's memory rolls over
   *  at midnight, and "…纪念章收好啦！" would have been said again with no stamp) */
  let souvenirDay = '';
  let near: string | null = null;

  // the kits' world system (added once the city world runs)
  const group = new THREE.Group();
  group.name = 'realsf-event-kits';
  let offSystem: (() => void) | null = null;
  const attach = () => {
    if (offSystem || !cityStreamerLazy()) return;
    const sys: WorldSystem = { name: 'realsf-event-kits', group };
    offSystem = getWorld().addSystem(sys);
  };

  const dropKit = (id: string) => {
    const k = kits.get(id);
    if (!k) return;
    group.remove(k.mesh);
    k.mesh.geometry.dispose();
    kits.delete(id);
  };

  const buildKit = (w: EventWindow): Kit | null => {
    const s = kitSpot(w.venue);
    // wait until the ground under it is in (the chunk streamed)
    if (!canStand(s.x, s.z)) return null;
    const geo = buildKitGeometry(w.venue.kit, s, heightAt);
    const mesh = freezeStatic(new THREE.Mesh(geo, material));
    mesh.name = `realsf-kit:${w.event.id}`;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    group.add(mesh);
    const tris = (geo.index?.count ?? 0) / 3;
    return { id: w.event.id, mesh, tris };
  };

  // the E prompt at each open event's kit (or venue)
  const offInteract = registerInteractables('w5-realsf-events', () => open.map((w): Interactable => {
    const s = kitPrompt(w.venue.kit, kitSpot(w.venue));
    return {
      id: `realsf-event:${w.event.id}`, source: 'event', action: 'info', verb: { zh: '看看活动', en: 'See the event' },
      name: EVENT_SAY[w.event.id] ?? w.venue.name, x: s.x, z: s.z, radius: s.r,
      act: () => openEvent(w.event.id),
    };
  }));

  // the pennants: open events near the player or the waypoint first
  const offFlags = registerFlagSource('realsf', ctx => open.map((w): ExtraFlag => {
    const d = dist(ctx.player, w.venue);
    const byTarget = ctx.target ? dist(ctx.target, w.venue) < 150 : false;
    return { key: w.event.id, x: w.venue.x, z: w.venue.z, color: EVENT_CORAL, glyph: GLYPH[w.venue.kit], h: 22, priority: byTarget || d < 600 ? 2 : 1, far: 1600 };
  }));

  const openKey = (list: EventWindow[]) => list.map(w => w.event.id).join('|');

  const tick = () => {
    attach();
    const now = bayNow();
    const today = bayParts(now).dateKey;
    if (today !== souvenirDay) { souvenirs.length = 0; souvenirDay = today; }
    const next = activeEventsAt(now);
    if (openKey(next) !== openKey(open)) {
      const was = new Set(open.map(w => w.event.id)), is = new Set(next.map(w => w.event.id));
      for (const id of was) if (!is.has(id)) { emit({ type: 'realsf', what: 'window-close', id }); crowds.get(id)?.(); crowds.delete(id); dropKit(id); inside.delete(id); }
      for (const w of next) if (!was.has(w.event.id)) {
        emit({ type: 'realsf', what: 'window-open', id: w.event.id });
        const c = kitCrowd(w.venue.kit, kitSpot(w.venue));
        if (c) crowds.set(w.event.id, addCrowdSpots(`event:${w.event.id}`, [{ x: c.center.x, z: c.center.z, r: c.r }], { face: c.face, count: c.count }));
      }
      open = next;
      invalidateInteractables();
    }
    const p = { x: runtime.player.x, z: runtime.player.z };
    // kits: the nearest KITS_MAX open events within KIT_NEAR (never downtown until the headroom is published)
    const want = open.filter(w => !w.venue.downtown && dist(p, kitSpot(w.venue)) < KIT_NEAR)
      .sort((a, b) => dist(p, kitSpot(a.venue)) - dist(p, kitSpot(b.venue))).slice(0, KITS_MAX);
    const wantIds = new Set(want.map(w => w.event.id));
    for (const id of [...kits.keys()]) if (!wantIds.has(id)) dropKit(id);
    if (offSystem) for (const w of want) if (!kits.has(w.event.id)) { const k = buildKit(w); if (k) kits.set(k.id, k); }
    // loops: the nearest open event of each loop's kind
    const nearest = new Map<string, number>();
    for (const w of open) {
      if (w.venue.kit === 'board') continue;
      const id = LOOP_IDS[w.venue.kit];
      nearest.set(id, Math.min(nearest.get(id) ?? Infinity, dist(p, kitSpot(w.venue))));
    }
    for (const id of new Set(Object.values(LOOP_IDS))) setLoop(id, hearGain(nearest.get(id) ?? Infinity), 900);
    // lines, the souvenir, enter / leave
    lines = [];
    near = null;
    for (const w of open) {
      const d = dist(p, w.venue);
      if (d < LINE_NEAR) { lines.push({ key: `event-${w.event.id}`.slice(0, 80), text: eventLine(w) }); near ??= w.event.id; }
      if (d < AT_EVENT && !inside.has(w.event.id)) {
        inside.add(w.event.id);
        emit({ type: 'realsf', what: 'event-enter', id: w.event.id });
        const source = `event:${w.event.id}`;
        const first = !isPaid(source);
        emit({ type: 'find', kind: 'souvenir', id: w.event.id, first });
        if (first) {
          emit({ type: 'reward', source, coins: 15, stamp: source });
          souvenirs.push({ key: `souvenir-${w.event.id}`.slice(0, 80), text: souvenirLine(w) });
          if (souvenirs.length > 8) souvenirs.shift();
        }
      } else if (d > LEAVE && inside.has(w.event.id)) {
        inside.delete(w.event.id);
        emit({ type: 'realsf', what: 'event-leave', id: w.event.id });
      }
    }
  };

  let acc = 1;
  const offFrame = registerFrameSystem('w5-realsf-presence', dt => {
    if ((acc += dt) < 0.5) return;
    acc = 0;
    tick();
  }, 5);

  return {
    offered: () => (souvenirs.length ? [...souvenirs, ...lines] : lines),
    stats: () => ({ open: open.map(w => w.event.id), kits: [...kits.values()].map(k => ({ id: k.id, tris: k.tris })), crowds: [...crowds.keys()], near }),
    off: () => {
      offFrame(); offFlags(); offInteract();
      for (const off of crowds.values()) off();
      crowds.clear();
      for (const id of [...kits.keys()]) dropKit(id);
      offSystem?.();
      offSystem = null;
      offLoops(); offWarm(); offIds();
      material.dispose();
    },
  };
}
