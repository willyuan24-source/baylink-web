import type { Bilingual, InteractionKind, PoiDef, PostcardDef, Vec2 } from '../core/types';
import { runtime } from '../core/runtime';
import { joggerState, rideables } from '../actors/view';
import { DISTRICT } from '../data/district';
import { seatSpots, vehicleSpots } from '../data/vehicles';
import { POIS } from '../data/pois';
import { POSTCARDS } from '../data/postcards';

/**
 * Everything the player can walk up to and use. Built from content (POIS, POSTCARDS), district anchors
 * (NPC posts, streetcar stops, weekly board fallback) and BAYBAY (moving). Content may change shape at any
 * time — this module only relies on the shared types.
 */

/** 'transit' = lane F's city stations (action 'streetcar'); 'place' = lane G1's places resolved by setExtraResolver */
export type InteractableSource = 'poi' | 'postcard' | 'npc' | 'baybay' | 'streetcar' | 'board' | 'vehicle' | 'seat' | 'transit' | 'place';

export interface Interactable {
  id: string;
  source: InteractableSource;
  action: InteractionKind;
  verb: Bilingual;
  name: Bilingual;
  x: number;
  z: number;
  radius: number;
  poi?: PoiDef;
  postcard?: PostcardDef;
  /** npc key (vendor, fisher, family, streetcar) */
  npc?: string;
  /** streetcar stop id / postcard id */
  refId?: string;
  nodeId?: string;
}

export const BAYBAY_ID = 'baybay';
/** The jogger (actors/npcs.ts) moves; the interactable follows `joggerState` and is offered only while paused. */
export const JOGGER_ID = 'npc-jogger';
/**
 * Moving interactables carry live positions, and this says whether one is on offer right now: the jogger only while
 * paused; a bike / the toy car while parked and free; a bench only for a player who is (nearly) stopped, so walking the
 * promenade past 37 benches does not flash "坐一会儿". Nothing is offered while riding a vehicle / gliding / on transit —
 * you get off first (bench-sitters can still talk to BAYBAY).
 */
export function syncMoving(it: Interactable): boolean {
  const mode = runtime.move.mode;
  if (mode !== 'foot' && !(mode === 'sit' && it.source === 'baybay')) return false;
  if (it.source === 'baybay') { it.x = runtime.guide.x; it.z = runtime.guide.z; return true; }
  if (it.id === JOGGER_ID) { it.x = joggerState.x; it.z = joggerState.z; return joggerState.paused; }
  if (it.source === 'vehicle') {
    const r = rideables.find(v => `ride:${v.id}` === it.id);
    if (!r) return false;
    it.x = r.x; it.z = r.z;
    return r.free;
  }
  if (it.source === 'seat') return runtime.player.speed < 2.2 && !runtime.player.pathTarget;
  return true;
}

export const NPC_POSTS: { key: string; anchor: string; name: Bilingual; line: Bilingual }[] = [
  {
    key: 'vendor', anchor: 'npc-vendor', name: { zh: '市集摊主', en: 'Market vendor' },
    line: { zh: '早呀！周六上午是市集最热闹的时候。想试吃的话，先跟摊主打个招呼就好。', en: 'Morning! Saturday mornings are the busiest market time. If you want a sample, just ask the stallholder first.' },
  },
  {
    key: 'fisher', anchor: 'npc-fisher', name: { zh: '码头钓客', en: 'Pier angler' },
    line: { zh: '在加州，从公共码头钓鱼不需要钓鱼执照——不过鱼的尺寸和数量限制还是要守。', en: 'In California you don’t need a fishing license on a public pier — size and bag limits still apply, though.' },
  },
  {
    key: 'family', anchor: 'npc-family', name: { zh: '来玩的一家人', en: 'Visiting family' },
    line: { zh: '我们要去 PIER 39 看海狮！听说它们都挤在码头西边的浮台上。', en: 'We’re off to see the sea lions at Pier 39! Apparently they pile onto the floating docks on the west side.' },
  },
  {
    key: 'streetcar', anchor: 'npc-streetcar', name: { zh: '电车司机', en: 'Streetcar operator' },
    line: { zh: 'F 线跑的是从世界各地收来的老电车，每一辆涂装都不一样。上车前记得准备好车费。', en: 'The F line runs vintage streetcars collected from cities around the world — every one has its own paint job. Have your fare ready.' },
  },
];

const NPC_RADIUS = 2.8;
const POSTCARD_RADIUS = 2.4;
const BAYBAY_RADIUS = 2.4;
const STREETCAR_RADIUS = 3.2;

const near = (a: Vec2, b: Vec2, r: number) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r;

export function buildInteractables(): Interactable[] {
  const list: Interactable[] = [];
  for (const poi of POIS) {
    if (!poi?.position || !poi.interaction) continue;
    list.push({
      id: poi.id, source: 'poi', action: poi.interaction.kind, verb: poi.interaction.verb, name: poi.name,
      x: poi.position.x, z: poi.position.z, radius: Math.max(1.5, poi.radius || 3), poi, refId: poi.interaction.refId, nodeId: poi.interaction.nodeId,
    });
  }
  for (const card of POSTCARDS) {
    if (!card?.position) continue;
    list.push({ id: `postcard:${card.id}`, source: 'postcard', action: 'postcard', verb: { zh: '捡起明信片', en: 'Pick up the postcard' }, name: card.title, x: card.position.x, z: card.position.z, radius: POSTCARD_RADIUS, postcard: card, refId: card.id });
  }
  const anchors = DISTRICT.anchors ?? {};
  // Weekly board fallback if content has no board POI.
  const board = anchors['weekly-board'];
  if (board && !list.some(item => item.action === 'board')) {
    list.push({ id: 'weekly-board', source: 'board', action: 'board', verb: { zh: '看看这周活动', en: 'See what’s on this week' }, name: { zh: '这周去哪 · 公告板', en: 'This-week board' }, x: board.x, z: board.z, radius: 3.2 });
  }
  for (const stop of DISTRICT.streetcar?.stops ?? []) {
    const at = anchors[`streetcar-${stop.id}`];
    if (!at) continue;
    if (list.some(item => item.action === 'streetcar' && (item.refId === stop.id || near(item, at, 4)))) continue;
    list.push({ id: `streetcar-${stop.id}`, source: 'streetcar', action: 'streetcar', verb: { zh: '上电车', en: 'Board the streetcar' }, name: stop.name, x: at.x, z: at.z, radius: STREETCAR_RADIUS, refId: stop.id });
  }
  for (const post of NPC_POSTS) {
    const at = anchors[post.anchor];
    if (!at) continue;
    if (list.some(item => item.source === 'poi' && item.action === 'talk' && near(item, at, 2.5))) continue;
    list.push({ id: post.anchor, source: 'npc', action: 'talk', verb: { zh: `和${post.name.zh}聊聊`, en: `Talk to the ${post.name.en.toLowerCase()}` }, name: post.name, x: at.x, z: at.z, radius: NPC_RADIUS, npc: post.key });
  }
  // the jogger runs a loop; they are only talkable while paused at a loop end (see `jogger` below)
  if (anchors['npc-jogger-a']) {
    list.push({ id: JOGGER_ID, source: 'npc', action: 'talk', verb: { zh: '和跑步的 Sam 聊聊', en: 'Talk to Sam, the jogger' }, name: { zh: '跑步的 Sam', en: 'Sam, out for a run' }, x: joggerState.x, z: joggerState.z, radius: 2.4, npc: 'jogger' });
  }
  list.push({ id: BAYBAY_ID, source: 'baybay', action: 'talk', verb: { zh: '和 BAYBAY 聊聊', en: 'Talk to BAYBAY' }, name: { zh: 'BAYBAY', en: 'BAYBAY' }, x: runtime.guide.x, z: runtime.guide.z, radius: BAYBAY_RADIUS });
  // rideable toys and places to sit (actors/moveSystem.ts acts on the 'interact' event; 'info' has no flow side effect)
  for (const v of vehicleSpots()) {
    const car = v.kind === 'car';
    list.push({
      id: `ride:${v.id}`, source: 'vehicle', action: 'info', name: v.name, x: v.x, z: v.z, radius: car ? 2.6 : 2.2,
      verb: car ? { zh: '坐进玩具小车', en: 'Hop in the toy car' } : { zh: '骑上单车', en: 'Ride the bike' },
    });
  }
  for (const seat of seatSpots()) {
    list.push({ id: seat.id, source: 'seat', action: 'info', name: { zh: seat.kind === 'step' ? '台阶' : '长椅', en: seat.kind === 'step' ? 'Steps' : 'Bench' }, verb: { zh: '坐一会儿', en: 'Sit for a while' }, x: seat.x + Math.sin(seat.heading) * 0.9, z: seat.z + Math.cos(seat.heading) * 0.9, radius: 1.5 });
  }
  // lanes' own sources (F stations, G2 residents, …), in registration order, after everything above
  for (const fn of sources.values()) for (const it of fn()) if (!list.some(item => item.id === it.id)) list.push(it);
  return list;
}

// ---------------------------------------------------------------------------
// Day-0 registries (wave 2): other lanes add interactables, id resolvers and subject resolvers from their own files
// ---------------------------------------------------------------------------

const sources = new Map<string, () => Interactable[]>();
const sourceListeners = new Set<() => void>();
let sourcesEpoch = 0;
const bumpSources = () => { sourcesEpoch++; sourceListeners.forEach(fn => fn()); };

/**
 * Add a source of interactables (F: city transit stations, G2: residents). `fn` runs on every rebuild; the list is
 * rebuilt when a source is (un)registered or invalidateInteractables() is called (game/Systems.tsx watches the epoch).
 * Ids must be unique (a duplicate of an existing id is skipped). Returns the unregister function.
 */
export function registerInteractables(key: string, fn: () => Interactable[]): () => void {
  sources.set(key, fn);
  bumpSources();
  return () => { if (sources.get(key) === fn) { sources.delete(key); bumpSources(); } };
}
/** A registered source's content changed (data loaded, a resident moved home): rebuild the list. */
export function invalidateInteractables() { bumpSources(); }
/** For useSyncExternalStore (game/Systems.tsx). */
export function subscribeInteractables(fn: () => void): () => void { sourceListeners.add(fn); return () => { sourceListeners.delete(fn); }; }
export const interactablesEpoch = () => sourcesEpoch;

type ExtraResolver = (id: string) => Interactable | undefined;
let extraResolver: ExtraResolver | null = null;
/**
 * G1: resolve ids that are not in the list (e.g. `place:<id>` → {source: 'place', action: 'info', radius 12, …}), so
 * flow.objectiveTarget / navigateTo / the waypoint and brain's mapTarget clear work for city places. Resolved items
 * are NOT added to interactables() (no E prompt). null clears it.
 */
export function setExtraResolver(fn: ExtraResolver | null) { extraResolver = fn; }

type SubjectResolver = (subject: string) => { x: number; y: number; z: number } | null;
const subjectResolvers: SubjectResolver[] = [];
/** G2: telescope / photo subjects beyond the district ones (e.g. 'sutro-tower' from Twin Peaks). Returns the unregister. */
export function registerSubjectResolver(fn: SubjectResolver): () => void {
  subjectResolvers.push(fn);
  return () => { const i = subjectResolvers.indexOf(fn); if (i >= 0) subjectResolvers.splice(i, 1); };
}

let current: Interactable[] = [];
let byId = new Map<string, Interactable>();

/** Postcard interactables are namespaced (`postcard:<id>`) because content may reuse POI ids. */
export const postcardIdOf = (it: Interactable) => it.refId ?? it.id;

/** Rebuilt on mount (and on content HMR). */
export function setInteractables(list: Interactable[]) {
  current = list;
  byId = new Map(list.map(item => [item.id, item]));
}
export const interactables = () => current;
export function interactableById(id: string | null | undefined): Interactable | undefined {
  if (!id) return undefined;
  const item = byId.get(id);
  if (item) syncMoving(item);
  return item ?? extraResolver?.(id);
}
export const poiById = (id: string | null | undefined) => (id ? POIS.find(poi => poi.id === id) : undefined);
export const postcardById = (id: string | null | undefined) => (id ? POSTCARDS.find(card => card.id === id) : undefined);

/** Resolve a subject id (landmark id/kind, backdrop kind, anchor, POI id) to a world position. */
export function subjectPosition(subject: string): { x: number; y: number; z: number } | null {
  const landmark = DISTRICT.landmarks.find(item => item.id === subject || item.kind === subject);
  if (landmark) return { x: landmark.position.x, y: (landmark.baseY ?? 0) + 8 * (landmark.scale || 1), z: landmark.position.z };
  if (subject === 'bay-bridge') {
    // the backdrop position is the SF anchorage at the slab edge; frame a point on the main span instead
    const a = DISTRICT.backdrop.find(item => item.kind === 'bay-bridge'), b = DISTRICT.backdrop.find(item => item.kind === 'yerba-buena');
    if (a && b) return { x: a.position.x + (b.position.x - a.position.x) * 0.24, y: 18, z: a.position.z + (b.position.z - a.position.z) * 0.24 };
  }
  const backdrop = DISTRICT.backdrop.find(item => item.kind === subject || subject.includes(item.kind));
  if (backdrop) return { x: backdrop.position.x, y: 10 * (backdrop.scale || 1), z: backdrop.position.z };
  const anchor = DISTRICT.anchors?.[subject];
  if (anchor) return { x: anchor.x, y: 2, z: anchor.z };
  const poi = poiById(subject);
  if (poi) return { x: poi.position.x, y: 3, z: poi.position.z };
  for (const fn of subjectResolvers) { const p = fn(subject); if (p) return p; }
  return null;
}
