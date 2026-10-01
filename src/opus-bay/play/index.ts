import { Heart, Smile } from 'lucide-react';
import { createElement, lazy, Suspense } from 'react';
import { charApi } from '../actors/charApi';
import { glideUnlocked, subscribeGlide } from '../actors/moveApi';
import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { game } from '../core/store';
import { surfaceAt } from '../core/terrain';
import { onSaveCleared } from '../data/save';
import { baybayHeld } from '../game/baybayHold';
import { bubble, runAction } from '../game/flow';
import { registerRewardIds } from '../economy/ledger';
import { flow } from '../game/flowStore';
import { BAYBAY_ID, interactables, postcardIdOf, registerInteractables, syncMoving, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay, openOverlays, registerAskItem, registerOverlay, type OverlayProps } from '../ui/slots';
import { registerHideSeek } from './hideSeekEntry';
import { registerKites } from './kiteEntry';
import { currentActivity, ensureResultOverlay, forgetSession, unregisterResultOverlay } from './kit';
import { registerPlaySounds } from './sounds';
import { VIEW_RADIUS, VIEW_SPOT_IDS, VIEW_SPOTS, type ViewSpot } from './viewSpots';

/**
 * Wave 5 · lane A — PlayKit and the activities. game/w5Features.ts loads this module lazily in city mode only and calls
 * `init()` once (after the economy). Everything else of the folder loads behind it:
 *
 *   kit.ts         the core: activities, the rhythm judge, medals, bests, the result card (ResultCard.tsx, lazy)
 *   viewSpots.ts   the 16 看风景 spots (lane E's notebook imports the ids)
 *   emotes.ts + EmoteWheel.tsx   the wheel: tap yourself (lane F's self-tap), T on a keyboard, 问 BAYBAY → 做个动作
 *   pet.ts         摸摸 BAYBAY (double-tap her, 问 BAYBAY → 摸摸, E twice), her shoreline float
 *   sit.ts         坐下 anywhere (grass, steps, rims) and the view spots' slow look
 *   firstFlight.ts + rings.ts + FlightChip.tsx   the first flight: lane C's pelican moment calls
 *                  `import('../play/firstFlight').then(m => m.startFirstFlight())`
 *   zones.ts       part b, loaded at init: the chip, the 滑下去 / 比赛？ prompts, the cable car's bell pad, the step
 *                  counter; slides.ts (the Seward slides), stairs.ts (the stair races) and bell.ts + BellPad.tsx (the
 *                  bell riff, the lean-out photo) load behind it
 *
 * Nothing here changes the district (never loaded there).
 */

const WHEEL_OVERLAY = 'play-emotes';
const EmoteWheel = lazy(() => import('./EmoteWheel'));
const WheelSlot = ({ close }: OverlayProps) => createElement(Suspense, { fallback: null }, createElement(EmoteWheel, { close }));

/** 坐下 is offered after standing still this long (s) on these surfaces, when nothing else is in reach. */
export const SIT_STILL = 1;
export const SIT_SURFACES: ReadonlySet<string> = new Set(['grass', 'sand', 'dirt', 'stairs', 'plaza', 'pavement', 'wood']);
/** The 坐下 prompt's second word: where you would sit. */
const SIT_PLACE: Record<string, Bilingual> = {
  grass: { zh: '草地上', en: 'On the grass' }, sand: { zh: '沙滩上', en: 'On the sand' }, dirt: { zh: '坡上', en: 'On the slope' },
  stairs: { zh: '台阶上', en: 'On the steps' }, plaza: { zh: '广场边', en: 'Right here' }, pavement: { zh: '路边', en: 'Right here' }, wood: { zh: '木栈道上', en: 'On the boardwalk' },
};
const FAR = 1e7;
/** E, E within this many ms at BAYBAY's side: 摸摸 instead of her menu. */
export const DOUBLE_E_MS = 450;
const COACH_KEY = 'opus-bay:play:emote-coach:v1';
/** Seconds of settled, quiet free roam before the one emote coach line. */
export const COACH_AFTER = 50;

const wheelOpen = () => openOverlays().some(o => o.id === WHEEL_OVERLAY);

/** Open the emote wheel (when an emote can run: playing on foot, nothing modal). */
export function openWheel(): boolean {
  const s = game.get();
  if (s.phase !== 'playing' || s.dialogue.nodeId || s.photoMode || runtime.move.mode !== 'foot' || flow.get().cinematic) return false;
  openOverlay(WHEEL_OVERLAY);
  return true;
}
export function toggleWheel() { if (wheelOpen()) closeOverlay(WHEEL_OVERLAY); else openWheel(); }

export const petNow = () => import('./pet').then(m => m.pet());
const sitNow = () => { void import('./sit').then(m => { if (!m.sitHere()) emit({ type: 'ui', action: 'error' }); }); };
const sitSpot = (s: ViewSpot) => { void import('./sit').then(m => { m.sitAtSpot(s); }); };
type StartFlight = (opts?: { course?: 'coit' | 'local' }) => Promise<boolean>;
const startFlight: StartFlight = opts => import('./firstFlight').then(m => m.startFirstFlight(opts));
/**
 * The first-flight entry lane C's pelican moment calls (game/pelicanFirst.ts: 试试起飞 → `startFirstFlight()`); set
 * while this feature runs (init → teardown), so a play chunk that failed to start leaves lane C its plain take-off.
 * Resolves false when the flight cannot start (not unlocked, a dialogue open, riding).
 */
export let startFirstFlight: StartFlight | undefined;

/** The 坐下 prompt: one interactable that follows the player while offered (else parked far away). */
export const sitHereIt: Interactable = {
  id: 'play:sit', source: 'activity', action: 'info', verb: { zh: '坐下', en: 'Sit down' }, name: { zh: '坐一会儿', en: 'Have a sit' },
  x: FAR, z: FAR, radius: 1.3, act: sitNow,
};
/** The view spots' prompts (坐下看风景). */
export const viewIts: Interactable[] = VIEW_SPOTS.filter(s => !s.retired).map(s => ({
  id: `view:${s.id}`, source: 'find', action: 'viewpoint', verb: { zh: '坐下看风景', en: 'Sit and take in the view' }, name: s.name,
  x: s.x, z: s.z, radius: VIEW_RADIUS, act: () => sitSpot(s),
}));

let sitModule: typeof import('./sit') | null = null;
/** Seated right now (坐下 / 坐下看风景): the zones offer nothing over a seat (zones3's 滑草). */
export const seatedNow = (): boolean => !!sitModule?.seated();

/**
 * Whether 坐下 may be offered at the player right now: lane F's body can sit (charApi), on foot and still for SIT_STILL,
 * on a sittable surface, not seated already, and no other prompt (a card, a postcard, a bench, a view spot…) in reach.
 */
export function sitOffer(still: number): boolean {
  const s = game.get(), p = runtime.player;
  if (!charApi() || still < SIT_STILL || s.phase !== 'playing' || s.dialogue.nodeId || s.photoMode || s.riding !== null || currentActivity()) return false;
  if (runtime.move.mode !== 'foot' || !p.grounded || p.locked || sitModule?.seated()) return false;
  // BAYBAY has something to say (跟我来, she is coming because you called): her prompt stays
  const f = flow.get();
  if (f.callPending || (f.bubble?.who === BAYBAY_ID && f.bubble.tone === 'call')) return false;
  const surface = surfaceAt(p.x, p.z);
  if (!surface || !SIT_SURFACES.has(surface)) return false;
  sitHereIt.name = SIT_PLACE[surface] ?? sitHereIt.name;
  for (const it of interactables()) {
    if (it === sitHereIt || it.source === 'baybay') continue;
    if (it.source === 'postcard' && s.postcards.includes(postcardIdOf(it))) continue;
    if (!syncMoving(it)) continue;
    if (Math.hypot(p.x - it.x, p.z - it.z) < it.radius + 0.5) return false;
  }
  return true;
}

export function init(): () => void {
  const offs: (() => void)[] = [];
  startFirstFlight = startFlight;
  offs.push(() => { startFirstFlight = undefined; });
  offs.push(registerPlaySounds());
  ensureResultOverlay();
  offs.push(unregisterResultOverlay);
  offs.push(registerOverlay({ id: WHEEL_OVERLAY, Component: WheelSlot }));
  offs.push(registerAskItem({ id: 'play-emotes', order: -20, label: { zh: '做个动作', en: 'Do an emote' }, icon: Smile, onSelect: () => { openWheel(); } }));
  offs.push(registerAskItem({ id: 'play-pet', order: -10, label: { zh: '摸摸 BAYBAY', en: 'Pet BAYBAY' }, icon: Heart, onSelect: () => { void petNow(); } }));
  // W6-W4 (lane W): 问 BAYBAY → 捉迷藏 (play/hideSeek.ts)
  offs.push(registerHideSeek());
  // W7-W2: 问 BAYBAY → 放风筝 on Marina Green / Crissy Field (play/kite.ts) and Marina Green's kites by day (play/kites.ts)
  offs.push(registerKites());
  offs.push(registerInteractables('a-play', () => [sitHereIt, ...viewIts]));
  // the ledger keeps view:<id> in play.g.view, bit i = VIEW_SPOT_IDS[i] (append-only)
  offs.push(registerRewardIds('view', VIEW_SPOT_IDS));

  // lane F's taps: your own character opens the wheel, a double tap on BAYBAY pets her
  offs.push(onEvent(e => {
    if (e.type !== 'self-tap') return;
    if (e.who === 'player' && !e.double) toggleWheel();
    else if (e.who === 'baybay' && e.double) void petNow();
  }));

  // keyboard: T toggles the wheel; E, E at BAYBAY's side pets her (her menu opens on the first E)
  let lastE = -Infinity, eAtBaybay = false;
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if (e.code === 'KeyT') {
      // T is the wheel's alone: stopped here so the wheel this press opens never sees it (its listener joins mid-dispatch)
      if (wheelOpen()) closeOverlay(WHEEL_OVERLAY); else if (!openWheel()) return;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.code !== 'KeyE') return;
    const now = performance.now(), s = game.get();
    if (s.dialogue.nodeId === 'flow.call' && eAtBaybay && now - lastE < DOUBLE_E_MS) {
      e.preventDefault();
      e.stopPropagation();
      runAction({ type: 'ask', id: 'play-pet' });
      lastE = -Infinity;
      return;
    }
    lastE = now;
    eAtBaybay = !s.dialogue.nodeId && s.focus === BAYBAY_ID;
  };
  // (capture: this sees the first E before the HUD's handler opens her menu, and the second before the dialogue's)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('keydown', onKey, true);
    offs.push(() => window.removeEventListener('keydown', onKey, true));
  }

  // 坐下: park the prompt at the player while it is on offer (4 Hz); hide a view spot's prompt while seated at it
  let still = 0, acc = 0, disposed = false;

  // (W6-K1, lane A's review) the rings chunk (the rings layer, its material's warm-up) loads once the pelican is
  // unlocked — during lane C's moment, before the first flight — not on the flight's first frame (a save that has the
  // pelican already: at once)
  let ringsAsked = false;
  const prefetchRings = () => {
    if (ringsAsked || disposed || !glideUnlocked()) return;
    ringsAsked = true;
    void import('./rings').catch(() => { ringsAsked = false; });
  };
  prefetchRings();
  offs.push(subscribeGlide(prefetchRings));
  void import('./sit').then(m => { if (!disposed) sitModule = m; });
  offs.push(registerFrameSystem('a-play-offer', dt => {
    const p = runtime.player;
    still = !p.moving && p.speed < 0.3 && !p.pathTarget ? still + dt : 0;
    if ((acc += dt) < 0.25) return;
    acc = 0;
    const on = sitOffer(still);
    sitHereIt.x = on ? p.x : FAR;
    sitHereIt.z = on ? p.z : FAR;
    const seat = sitModule?.seated();
    for (const it of viewIts) it.radius = seat?.spot && it.id === `view:${seat.spot.id}` ? 0 : VIEW_RADIUS;
  }));

  // BAYBAY's shoreline float (idle) — the pet chunk
  let offFloat: (() => void) | null = null;
  void import('./pet').then(m => { if (!disposed) offFloat = m.startFloatWatch(); });
  // part b: the zones (the slides, the stair courses, the cable car's bell pad, the step counter) — their own chunk
  let offZones: (() => void) | null = null;
  void import('./zones').then(m => { if (!disposed) offZones = m.initZones(); });
  offs.push(() => { disposed = true; offFloat?.(); offZones?.(); sitModule?.resetSit(); });
  // Settings → reset progress: the session's bests, medals and view finds go with the save (zones.ts forgets the steps,
  // crests.ts its set)
  offs.push(onSaveCleared(() => { forgetSession(); sitModule?.forgetFinds(); }));
  // leaving the city (the page, the route) with an activity running: it ends at no cost and lets go of the feet — an
  // activity hold is one the lock watchdog never drops (game/lockWatchdog SELF_EXPLAINED), so a run left behind would
  // hold the player still on the next visit (review 2026-09-28)
  offs.push(() => { currentActivity()?.cancel(); });

  // one coach line for the emotes, once per device, when the player has settled in and stands still
  const seen = () => { try { return localStorage.getItem(COACH_KEY) === '1'; } catch { return true; } };
  if (!seen()) {
    let coach = 0;
    const offCoach = registerFrameSystem('a-play-coach', dt => {
      const s = game.get(), f = flow.get(), p = runtime.player;
      // (W8-K4, lane K surgical) not under a play panel / card: the W8-K1 live proof heard this voiced under the claw panel
      const quiet = s.phase === 'playing' && s.mode === 'free' && !s.dialogue.nodeId && !s.panel.kind && !f.bubble && !f.cinematic && !p.moving && runtime.move.mode === 'foot' && !baybayHeld();
      coach = quiet ? coach + dt : Math.max(0, coach - dt);
      if (coach < COACH_AFTER || !charApi()) return;
      offCoach();
      try { localStorage.setItem(COACH_KEY, '1'); } catch { /* storage blocked: once per visit */ }
      bubble(runtime.input.device === 'touch'
        ? { zh: '点一下你自己，可以挥手、跳舞、和我自拍！', en: 'Tap yourself to wave, dance or take a selfie with me!' }
        : { zh: '按 T 可以挥手、跳舞、和我自拍！', en: 'Press T to wave, dance or take a selfie with me!' }, 5200);
    });
    offs.push(offCoach);
  }

  // DEV / QA: __opusBay.play
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    w.__opusBay = { ...(w.__opusBay ?? {}), play: { openWheel, toggleWheel, petNow, startFirstFlight, sit: () => import('./sit'), flight: () => import('./firstFlight'), kit: () => import('./kit'), emotes: () => import('./emotes'), zones: () => import('./zones'), slides: () => import('./slides'), stairs: () => import('./stairs'), bell: () => import('./bell'), marshmallow: () => import('./marshmallow'), viewSpots: VIEW_SPOTS, sitHereIt, viewIts } };
  }
  return () => { for (const off of offs.splice(0).reverse()) { try { off(); } catch { /* gone */ } } };
}
