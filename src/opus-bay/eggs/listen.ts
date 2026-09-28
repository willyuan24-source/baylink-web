import { playSound } from '../audio/hooks';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import { bayParts } from '../game/bayNow';
import { busy } from '../game/flow';
import { activeEventsAt } from '../realsf/events';
import { closeOverlay, openOverlay } from '../ui/slots';
import { spawnFx } from '../world/fx';
import { CITY_SOUNDS, LISTEN_S, SOUND_COINS, SOUND_IDS, soundById, soundRewardSource, type CitySoundDef } from './citySounds';
import { bayHour, seaLionMonth } from './gates';
import { type EggHost, hostClock, invalidate, momentFree, queueCard, say, sayMore, sound } from './hosts';
import { karlIn } from './mission';
import { paidSet } from './paid';
import type { EggSound } from './sounds';

/**
 * Wave 5 · lane D (W5-D6) · 城市之声: listening. A 听一听 prompt stands where each sound happens (only while it can be
 * heard: the ferries by day, the parrots by day, the banjos while lane R's bluegrass festival is on, the taiko on the April
 * festival weekends, Karl's wind while he is in); acting on it plays the sound and starts LISTEN_S seconds of standing
 * still (the `egg-listen` ring; walking away, a dialogue or a ride cancels it quietly). Heard to the end: the find
 * (`find { kind: 'sound' }`, `reward sound:<id>` = 5 金币 once, the chime, BAYBAY's line, the card — after an egg's card
 * when one is up). Four sounds are collected by the moment that plays them (`heard(id)`): the foghorn duet heard on the
 * deck, the Tiled Steps climbed in one go, and the two egg prompts that already listen (the laughing lady, the Wave Organ).
 */

/** Walking further than this from where you started listening cancels it (u). */
export const LISTEN_MOVE = 1.2;

// --- when each sound can be heard (Bay time and the world's state) --------------------------------------------------

/** Japantown's cherry blossom weekends: April, Saturday or Sunday, the 8th–21st (2026: the 11th–12th and 18th–19th), 10:00–18:00. */
export function taikoDay(p = bayParts()): boolean {
  return p.month === 4 && (p.weekday === 0 || p.weekday === 6) && p.day >= 8 && p.day <= 21 && p.hour >= 10 && p.hour < 18;
}

/** Lane R's festival at Hellman Hollow is open now (the catalog's window). */
export function banjosOn(): boolean {
  try { return activeEventsAt().some(w => w.venue.id === 'hellman-hollow'); } catch { return false; }
}

/** Can `id` be heard now (the prompt shows only then; the moment sounds are always "on": their moment decides). */
export function soundLive(id: string, p = bayParts()): boolean {
  switch (id) {
    case 'ferry-horn': { const h = bayHour(p); return h >= 6 && h < 22; }
    case 'parrots': { const h = bayHour(p); return h >= 7 && h < 19; }
    case 'festival-banjos': return banjosOn();
    case 'taiko': return taikoDay(p);
    case 'karl-wind': return karlIn();
    default: return true;
  }
}

/** What plays: recipe ids with their start (s) — also what lane E's notebook can replay (playSound, no host code). */
export const SOUND_PLAYBACK: Readonly<Record<string, readonly (readonly [EggSound, number])[]>> = {
  'ggb-foghorns': [['egg:horn-south', 0], ['egg:horn-mid', 2.6], ['egg:horn-mid', 4.6]],
  'cable-car-bell': [['egg:cable-bell', 0]],
  'ferry-horn': [['egg:ferry-horn', 0]],
  'sea-lions': [['egg:sealions', 0]],
  parrots: [['egg:parrots', 0]],
  'wave-organ': [['egg:organ', 0]],
  'laughing-lady': [['egg:cackle', 0]],
  'sea-cave': [['egg:cave', 0]],
  'tiled-steps': [['egg:bubbles', 0], ['egg:birds', 1.6], ['egg:stars', 3.2]],
  'festival-banjos': [['egg:banjo', 0]],
  taiko: [['egg:taiko', 0]],
  'karl-wind': [['egg:wind', 0]],
};

const playTimers: ReturnType<typeof setTimeout>[] = [];
function playDef(def: CitySoundDef): void {
  // (the sea lions follow the month: fewer at home in June–July)
  const gain = def.id === 'sea-lions' ? ({ away: 0.35, returning: 0.65, home: 1 } as const)[seaLionMonth()] : 1;
  for (const [id, at] of SOUND_PLAYBACK[def.id] ?? []) {
    const go = () => sound(id, def.at, { near: 10, far: 90, gain });
    if (at <= 0) go(); else playTimers.push(setTimeout(go, at * 1000));
  }
}

// --- found ---------------------------------------------------------------------------------------------------------

const sessionHeard = new Set<string>();
const paidSounds = paidSet(soundRewardSource, () => SOUND_IDS);
/** Heard before: the ledger's bit (play.g.sound) or this session. */
export function soundFound(id: string): boolean {
  return sessionHeard.has(id) || paidSounds().has(id);
}

/** The collection: the find, the first time the reward, the chime, BAYBAY's line (after any she is saying) and the card. */
function collect(def: CitySoundDef): boolean {
  const first = !soundFound(def.id);
  emit({ type: 'find', kind: 'sound', id: def.id, first });
  if (!first) return false;
  sessionHeard.add(def.id);
  emit({ type: 'reward', source: soundRewardSource(def.id), coins: SOUND_COINS });
  playSound('egg:find', { pitch: 1.12, gain: 0.8 });
  const p = runtime.player;
  spawnFx('notes', p.x, p.y + 1.9, p.z, { count: 8, color: '#3f9e91' });
  sayMore(def.line);
  queueCard({ id: def.id, kind: 'sound', coins: SOUND_COINS }, 1400);
  return true;
}

// --- listening -----------------------------------------------------------------------------------------------------

let listening: { id: string; x: number; z: number; until: number } | null = null;
let missSaid = false;
export const listeningTo = () => listening?.id ?? null;

export const MISS_LINE = { zh: '没听清……站着别动，再听一次？', en: 'Didn’t catch it… stand still and listen again?' } as const;

/** Start listening to `id` (the prompt's act; the lady's and the organ's prompts with `play: false`). */
export function startListen(id: string, opts: { play?: boolean } = {}): boolean {
  const def = soundById(id);
  if (!def || listening || !momentFree()) return false;
  const p = runtime.player;
  listening = { id, x: p.x, z: p.z, until: hostClock() + LISTEN_S };
  if (opts.play !== false) playDef(def);
  openOverlay('egg-listen', { name: def.name, seconds: LISTEN_S });
  invalidate();
  return true;
}

function stopListen(): void {
  listening = null;
  closeOverlay('egg-listen');
  invalidate();
}

/** (review) Settings → reset progress: the sounds heard this session are unheard again (the ledger starts over). */
export function forgetHeard(): void {
  sessionHeard.clear();
  paidSounds.forget();
  missSaid = false;
  if (listening) stopListen();
}

/** The moment played the sound and the player heard it (the duet on the deck, the steps climbed): collect it now. */
export function heard(id: string): boolean {
  const def = soundById(id);
  return def ? collect(def) : false;
}

/** One step of the listening (the `listen` host, ≈ 10 Hz). */
function stepListen(t: number): void {
  if (!listening) return;
  const p = runtime.player;
  const mode = runtime.move.mode;
  if (Math.hypot(p.x - listening.x, p.z - listening.z) > LISTEN_MOVE || busy() || (mode !== 'foot' && mode !== 'sit')) {
    stopListen();
    if (!missSaid) { missSaid = true; say(MISS_LINE); }
    return;
  }
  if (t < listening.until) return;
  const def = soundById(listening.id)!;
  stopListen();
  collect(def);
}

/** The hosts: one that steps the listening, one per sound with a 听一听 prompt (the moment sounds have none). */
export function soundHosts(): EggHost[] {
  const hosts: EggHost[] = [{
    id: 'listen', range: Infinity, isFound: () => false,
    update: ctx => stepListen(ctx.t),
    dispose: () => { if (listening) stopListen(); for (const t of playTimers.splice(0)) clearTimeout(t); },
  }];
  for (const def of CITY_SOUNDS) {
    if (def.by !== 'listen') continue;
    let live = soundLive(def.id);
    const spots = [def.at] as const;
    hosts.push({
      id: `sound:${def.id}`,
      range: def.radius + 30,
      spots: () => spots,
      isFound: () => soundFound(def.id),
      enter: () => { live = soundLive(def.id); invalidate(); },
      update: () => { const now = soundLive(def.id); if (now !== live) { live = now; invalidate(); } },
      interactables: () => (live && !listening ? [{
        id: `sound:${def.id}`, source: 'find', action: def.id === 'cable-car-bell' ? 'bell' : 'info',
        verb: { zh: '听一听', en: 'Listen' }, name: def.name, x: def.at.x, z: def.at.z, radius: def.radius,
        act: () => { startListen(def.id); },
      }] : []),
      qa: () => { playDef(def); collect(def); },
    });
  }
  return hosts;
}

/** Tests: forget the session. */
export function __resetListenForTests(): void {
  listening = null; missSaid = false; sessionHeard.clear(); paidSounds.forget();
  for (const t of playTimers.splice(0)) clearTimeout(t);
}
