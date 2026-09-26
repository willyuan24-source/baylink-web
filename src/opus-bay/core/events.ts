import type { InteractionKind, SurfaceKind } from './types';

/** Typed fire-and-forget event bus: gameplay → audio / fx / analytics. */
export type GameEvent =
  | { type: 'start' }
  | { type: 'footstep'; surface: SurfaceKind; run: boolean }
  | { type: 'jump' }
  | { type: 'land'; impact: number }
  | { type: 'bump'; kind: string; strength: number }
  | { type: 'interact'; id: string; kind: InteractionKind }
  | { type: 'dialogue'; speaker: string; nodeId: string }
  | { type: 'choice' }
  | { type: 'ui'; action: 'open' | 'close' | 'hover' | 'select' | 'error' }
  | { type: 'stamp' }
  | { type: 'postcard'; id: string }
  | { type: 'goal'; id: string }
  | { type: 'wish'; added: boolean }
  | { type: 'bell' }
  | { type: 'streetcar-bell' }
  | { type: 'foghorn' }
  | { type: 'sea-lion'; intensity: number }
  | { type: 'gull' }
  | { type: 'shutter' }
  | { type: 'arrive'; poiId: string }
  | { type: 'area'; name: string }
  | { type: 'guide-call' }
  | { type: 'emote'; who: 'player' | 'baybay'; emote: string }
  // --- movement & vehicles (actors/moveSystem.ts). `vehicle` is the kind, `id` the parked-vehicle id (data/vehicles.ts).
  /** the newcomer got in (after the 0.45 s board); `baybay` = she hopped in too ('hop') or popped in from afar ('pop') */
  | { type: 'vehicle:enter'; vehicle: 'bike' | 'car'; id: string; baybay: 'hop' | 'pop' }
  /** the newcomer got out (after auto-brake + 0.4 s alight) */
  | { type: 'vehicle:exit'; vehicle: 'bike' | 'car'; id: string }
  /** F pressed but no door slot is clear (toast "这里下不了车") */
  | { type: 'vehicle:blocked'; vehicle: 'bike' | 'car'; reason: 'no-slot' | 'moving' }
  /** hit a wall / edge; strength = |normal speed| / vmax (0..1); hard = |v_n| > 5 (the car squashes; BAYBAY "哎呀") */
  | { type: 'vehicle:bump'; vehicle: 'bike' | 'car'; strength: number; hard: boolean; kind: 'wall' | 'edge' | 'stairs' | 'water' }
  /** the bike met a flight of stairs (hint "楼梯要走上去 · F 下车"), or the car an off-limits surface */
  | { type: 'vehicle:refuse'; vehicle: 'bike' | 'car'; surface: 'stairs' | 'water' | 'wood' | 'dirt' | 'other' }
  /** Space hop, or an SF hill-crest hop (crest: true); land fires as vehicle:land */
  | { type: 'vehicle:hop'; vehicle: 'bike' | 'car'; crest: boolean }
  | { type: 'vehicle:land'; vehicle: 'bike' | 'car'; impact: number }
  /** H: bike bell / toy horn */
  | { type: 'vehicle:horn'; vehicle: 'bike' | 'car' }
  /** hold F: your vehicle rolls up to you */
  | { type: 'vehicle:call'; vehicle: 'bike' | 'car'; id: string }
  /** first time on a grade > 0.4 in this session (on foot or riding) — BAYBAY line hook */
  | { type: 'hill'; grade: number; mode: 'foot' | 'bike' | 'car' }
  /** reached a crest after ≥ 10 s running uphill: the newcomer pants for 2 s (no stamina) */
  | { type: 'pant' }
  /** sat down on a bench / step (seat id), or stood up again */
  | { type: 'sit'; seat: string }
  | { type: 'stand'; seat: string }
  /** pelican: glide unlocked (Coit viewpoint or ?debug=1), take-off swoop started, landed (hop + squash) */
  | { type: 'glide:unlock' }
  | { type: 'glide:start' }
  | { type: 'glide:land'; x: number; z: number }
  /** G pressed with no safe landing within 40 u (never water) — keep flying */
  | { type: 'glide:no-landing' }
  /** transit: E switched rail ↔ seat */
  | { type: 'transit:spot'; line: string; spot: 'rail' | 'seat' | 'deck' };

type Handler = (event: GameEvent) => void;
const handlers = new Set<Handler>();

export function emit(event: GameEvent) {
  handlers.forEach(handler => {
    try { handler(event); } catch (error) { if (import.meta.env.DEV) console.error('[opus-bay event]', error); }
  });
}

export function onEvent(handler: Handler) {
  handlers.add(handler);
  return () => { handlers.delete(handler); };
}
