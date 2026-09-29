import * as THREE from 'three';
import type { AudioEngine } from '../audio/engine';
import { playSound, registerSound, type SoundOpts } from '../audio/hooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { toast } from '../core/store';
import type { Bilingual } from '../core/types';
import { onSaveCleared } from '../data/save';
import { paidSet } from '../eggs/paid';
import { bubble } from '../game/flow';
import { BAYBAY_ID } from '../game/interactables';
import { Batch, type Info } from '../world/builder';
import { spawnFx } from '../world/fx';
import { TOY_DYN } from '../world/materials';
import { HUNT_PLACES } from './huntPlaces';
import { HUNT_XZ } from './huntSpots';
import { halloweenSource } from './rewards';
import { addPumpkin } from './worldDress';
import type { HaloSpot } from './worldHalos';
import { lineText, type WorldLineKey } from './worldLines';

/**
 * Wave 6 · lane H (W6-H2) · THE PUMPKIN HUNT: 40 glowing jack-o'-lanterns hidden by fun places across the city
 * (halloween/huntPlaces.ts + huntSpots.ts: on the walking network, tests/opus-bay-w6-h.test.ts re-checks each on the
 * published city). Walk (or ride the bike / the toy car) within HUNT_PICK of one: a find chime, a sparkle, a gold toast
 * "南瓜灯 n / 40 · <place>", `{ type: 'halloween', what: 'pumpkin', id: 'pumpkin:<n>' }`, the reward
 * `halloween:pumpkin:<n>` (HUNT_COINS, paid once by lane E's ledger), and at 10 / 20 / 40 the milestones `hunt:10`,
 * `hunt:20`, `hunt:all`. BAYBAY says a line (halloween/worldLines.ts). The season: 1 October – 2 November (every phase
 * but 'off').
 *
 * API for the notebook / HUD (lane G): pumpkinsFound(), pumpkinTotal(), pumpkinFound(n), huntList(), onHuntChange().
 *
 * Drawn: ONE merged mesh of the unfound jack-o'-lanterns within HUNT_NEAR (the shared TOY_DYN material; the carved
 * faces glow a little by day and brightly at night), rebuilt only when that set changes; their halos go to the
 * Halloween halo pool.
 */

export const PUMPKIN_TOTAL = HUNT_XZ.length;
export const HUNT_PICK = 1.9;
export const HUNT_NEAR = 240;
/** a glint on the lantern within this (u) */
export const HUNT_GLINT = 14;
/** BAYBAY notices one within this (u) — the scheduler's once-a-day hint */
export const HUNT_SNIFF = 30;
export const HUNT_COINS = 5;
export const MILESTONES: readonly { at: number; id: 'hunt:10' | 'hunt:20' | 'hunt:all'; coins: number; line: WorldLineKey }[] = [
  { at: 10, id: 'hunt:10', coins: 15, line: 'hunt10' },
  { at: 20, id: 'hunt:20', coins: 20, line: 'hunt20' },
  { at: HUNT_XZ.length, id: 'hunt:all', coins: 25, line: 'huntAll' },
];
/** the hunt's lanterns glow a little by day too ((1, 2] = always, in the toy shader) */
const HUNT_GLOW: Info = [0, 0, 0, 1.45];
const HUNT_ORANGE = '#f07f22';

export interface HuntSpot { n: number; x: number; z: number; y: number; f: number; near: Bilingual }
export const HUNT_SPOTS: readonly HuntSpot[] = HUNT_XZ.map(s => {
  const p = HUNT_PLACES.find(q => q.n === s.n);
  return { ...s, near: p?.near ?? { zh: '', en: '' } };
});

const idOf = (n: number) => `pumpkin:${n}`;
const sessionFound = new Set<number>();
const paid = paidSet(id => halloweenSource(id), () => HUNT_XZ.map(s => idOf(s.n)));
const listeners = new Set<() => void>();
const notify = () => { for (const fn of [...listeners]) { try { fn(); } catch { /* a listener's own problem */ } } };

export const pumpkinTotal = (): number => PUMPKIN_TOTAL;
export function pumpkinFound(n: number): boolean { return sessionFound.has(n) || paid().has(idOf(n)); }
export function pumpkinsFound(): number { let k = 0; for (const s of HUNT_XZ) if (pumpkinFound(s.n)) k++; return k; }
/** The hunt for the notebook: every lantern, its place and whether it is found. */
export const huntList = (): { n: number; near: Bilingual; found: boolean }[] => HUNT_SPOTS.map(s => ({ n: s.n, near: s.near, found: pumpkinFound(s.n) }));
/** Called after every find (and a reset); returns the undo. */
export function onHuntChange(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

// --- the find chime: a little "ooOOoo" and a rising minor sparkle (spooky, but friendly) ----------------------------
const midi = (m: number) => 440 * 2 ** ((m - 69) / 12);
function pumpkinChime(e: AudioEngine, o?: SoundOpts) {
  const g = Math.max(0, Math.min(1.5, o?.gain ?? 1));
  const v = e.voice({ bus: 'sfx', dur: 1.9, gain: 0.3 * g, pan: Math.max(-1, Math.min(1, o?.pan ?? 0)), priority: 4, reverb: 0.5, name: 'halloween:pumpkin' });
  if (!v) return;
  e.tone(v, { type: 'sine', freq: 220, freqTo: 330, glide: 0.35, decay: 0.55, peak: 0.35, attack: 0.03, vibrato: { rate: 6, depth: 0.03 } });
  [69, 72, 76, 81, 84].forEach((m, i) => {
    e.tone(v, { type: 'triangle', freq: midi(m), decay: 0.6, peak: 0.2, offset: 0.18 + i * 0.08, attack: 0.004 });
    e.tone(v, { type: 'sine', freq: midi(m + 12), decay: 0.35, peak: 0.06, offset: 0.18 + i * 0.08, attack: 0.004 });
  });
}

// --- the find -------------------------------------------------------------------------------------------------------

let lastLineAt = -Infinity;
const nowS = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

function say(k: WorldLineKey): void {
  bubble(lineText(k), 4200, BAYBAY_ID, 'bark');
  lastLineAt = nowS();
}

function collect(s: HuntSpot): void {
  if (pumpkinFound(s.n)) return;
  const before = pumpkinsFound();
  sessionFound.add(s.n);
  const count = before + 1;
  emit({ type: 'halloween', what: 'pumpkin', id: idOf(s.n) });
  emit({ type: 'reward', source: halloweenSource(idOf(s.n)), coins: HUNT_COINS });
  playSound('halloween:pumpkin');
  spawnFx('sparkle', s.x, s.y + 0.8, s.z, { count: 14, color: '#ffb347' });
  toast({ zh: `南瓜灯 ${count} / ${PUMPKIN_TOTAL} · ${s.near.zh}`, en: `Jack-o’-lantern ${count} / ${PUMPKIN_TOTAL} · ${s.near.en}` }, 'gold', 3200);
  const ms = MILESTONES.find(m => m.at === count);
  if (ms) {
    emit({ type: 'reward', source: halloweenSource(ms.id), coins: ms.coins });
    say(ms.line);
  } else if (count === 1) say('huntFirst');
  else if (nowS() - lastLineAt > 8) say('huntFound');
  notify();
}

/** QA / tests: find lantern `n` now (as walking to it would). */
export function pickPumpkin(n: number): boolean {
  const s = HUNT_SPOTS.find(q => q.n === n);
  if (!s || pumpkinFound(n)) return false;
  collect(s);
  return true;
}

/** The mode lets the player pick a lantern up (on foot, sitting, the bike, the toy car). */
const canPick = () => { const m = runtime.move.mode; return (m === 'foot' || m === 'sit' || m === 'bike' || m === 'car') && !runtime.glide.active; };

export interface Hunt {
  group: THREE.Group;
  /** per frame (the hunt steps itself at ≈ 8 Hz) */
  step(dt: number, px: number, py: number, pz: number, on: boolean): void;
  halos(): readonly HaloSpot[];
  /** the nearest unfound lantern within `max` (u), or null (BAYBAY's hint) */
  nearUnfound(x: number, z: number, max: number): HuntSpot | null;
  stats(): { drawn: number; tris: number; found: number };
  dispose(): void;
}

export function createHunt(): Hunt {
  const group = new THREE.Group();
  group.name = 'halloween-hunt';
  let mesh: THREE.Mesh | null = null;
  let drawnKey = '';
  let drawn: HuntSpot[] = [];
  let halos: HaloSpot[] = [];
  let acc = 0, glintAt = 0, clock = 0;
  const offSound = registerSound('halloween:pumpkin', pumpkinChime);
  const offCleared = onSaveCleared(() => { sessionFound.clear(); paid.forget(); drawnKey = ''; notify(); });
  const offChange = onHuntChange(() => { drawnKey = ''; });

  const drop = () => { if (!mesh) return; group.remove(mesh); mesh.geometry.dispose(); mesh = null; drawn = []; halos = []; };
  const rebuild = (list: HuntSpot[]) => {
    drop();
    if (!list.length) return;
    const b = new Batch();
    const hl: HaloSpot[] = [];
    // each grins toward the walker's way in (huntSpots.ts f)
    for (const s of list) addPumpkin(b, [s.x, s.y, s.z], 0.46, s.f, HUNT_ORANGE, true, HUNT_GLOW, hl, true);
    mesh = new THREE.Mesh(b.build(), TOY_DYN);
    mesh.name = 'halloween-hunt-lanterns';
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    group.add(mesh);
    drawn = list;
    halos = hl.map(h => ({ ...h, size: h.size * 1.6 }));
  };

  return {
    group,
    step: (dt, px, py, pz, on) => {
      clock += dt;
      if ((acc += dt) < 0.12) return;
      acc = 0;
      if (!on) { if (mesh) { drop(); drawnKey = ''; } return; }
      const list = HUNT_SPOTS.filter(s => !pumpkinFound(s.n) && Math.hypot(s.x - px, s.z - pz) <= HUNT_NEAR);
      const key = list.map(s => s.n).join(',');
      if (key !== drawnKey) { drawnKey = key; rebuild(list); }
      let best: HuntSpot | null = null, bd = Infinity;
      for (const s of list) { const d = Math.hypot(s.x - px, s.z - pz); if (d < bd) { bd = d; best = s; } }
      if (!best) return;
      if (bd <= HUNT_PICK && Math.abs(best.y - py) < 3 && canPick()) { collect(best); return; }
      if (bd <= HUNT_GLINT && clock >= glintAt) { glintAt = clock + 2.2; spawnFx('sparkle', best.x, best.y + 0.9, best.z, { count: 5, color: '#ffd27a' }); }
    },
    halos: () => halos,
    nearUnfound: (x, z, max) => {
      let best: HuntSpot | null = null, bd = max;
      for (const s of drawn) { const d = Math.hypot(s.x - x, s.z - z); if (d <= bd && !pumpkinFound(s.n)) { bd = d; best = s; } }
      return best;
    },
    stats: () => ({ drawn: drawn.length, tris: mesh ? (mesh.geometry.index?.count ?? 0) / 3 : 0, found: pumpkinsFound() }),
    dispose: () => { drop(); offSound(); offCleared(); offChange(); },
  };
}

/** Tests: forget the session. */
export function __resetHuntForTests(): void { sessionFound.clear(); paid.forget(); lastLineAt = -Infinity; }
