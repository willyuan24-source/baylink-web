import { onEvent, type GameEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { DEFAULT_TOUR_ID, game, tourIdOf } from '../core/store';
import type { Bilingual, DialogueNode } from '../core/types';
import { onSaveCleared, patchSave, readSave } from '../data/save';
import { GRAND_TOUR } from '../data/sf/copy';
import {
  chapterSay, cityTour, decodeTourSaves, expressRide, stopSay, tourStops, type CityTourDef, type CityTourStop, type FlatStop, type TourProgress,
} from '../data/sf/tours';
import { clearLines, lineSpeaking, offerLine, offerPaced } from './cityMoments';
import {
  announce, bubble, closePanel, defineNode, dialogueOpen, endTrip, openPanel, playDialogue, say, setCityTourApi, startFree, startTrip, type CityTourApi, type TourPill,
} from './flow';
import { flow } from './flowStore';
import { BAYBAY_ID, interactableById } from './interactables';
import { registerFrameSystem } from './systemsRegistry';
import { tourStopOption } from './tourTrips';
import { minutesLabel } from './tripText';
import type { TripState } from './tripTypes';

/**
 * Wave 4 · lane C · W4-C2 / W4-C4: the city tour engine — the Grand Tour 环游旧金山 · 一日游 (data/sf/tours.ts SF_GRAND)
 * in the running game. LAZY (it carries the tour data and the frozen lines, ≈ 23 KB gzip): game/flow.ts imports it the
 * first time a city tour starts (`startTour('sf-grand')`: the city welcome's choice 1, the call menu) and it registers
 * its API with flow (`setCityTourApi`). The first lesson (FIRST_TOUR, district and city) stays game/flow.ts' own,
 * byte-identical.
 *
 *   start      a fresh tour asks 完整版 / 快速版 first; a tour left half way resumes at its first open stop (save v2
 *              `tours[id]`: chapter, stop, completed, express)
 *   a stop     is a trip (game/tripRun.ts, source 'tour': BAYBAY leads each leg, boards the line with you, the pill and
 *              the map follow it) built by game/tourTrips.ts tourStopOption; its lines go through BAYBAY's pacer
 *              (game/cityMoments.ts): the chapter intro before the first stop of a chapter, `lead` as it starts,
 *              `arrive` (the express version's `expressArrive`) when the trip ends, the chapter outro after its last
 *   dwell      after an arrival: the stop's moment (arrive 20 s, photo 25 s, panorama 45 s: data/sf/tours TOUR_MODEL,
 *              shortened once the line is said and the player moves on) or right away for a ride that only got you
 *              somewhere; 下一站 / "继续" (tour-next) moves on at once
 *   game.tour  { active, id: 'sf-grand', stop: flat index, completed: stop ids } while it runs (tourIdOf ≠ the first
 *              lesson: flow.currentStop() is null, data/wishlist keeps the first lesson's progress apart)
 *   end        the recap (ui/Moments Recap → ui/CityTourRecap.tsx) when stops were done; the progress is kept for
 *              "继续一日游 · 第 N 章" unless the tour was finished
 * Optional stops (Fort Point, the deck walk) are not led in wave 4: the Welcome Center's lines point them out.
 * Part b: a photo moment waits for the shutter (photo mode holds the dwell, a shot ends it 3 s later with "拍得真好"); the
 * express version points at 直接到站 when your train leaves on a Metro leg > 400 u.
 */

/** The dwell after an arrival, by moment (s): the timing model's, the moment itself (lane G's card, the reveal). */
export const DWELL_S: Readonly<Record<NonNullable<CityTourStop['moment']> | 'none', number>> = { arrive: 20, photo: 25, panorama: 45, deck: 20, none: 3 };
/** the dwell ends early once BAYBAY has said her line and the player walked this far from the stop (u) */
export const DWELL_LEAVE_R = 18;
/** the dwell's shortest length (s): the arrival line gets its time */
export const DWELL_MIN_S = 4;
/** a photo moment waits for the shutter (part b): photo mode holds the dwell up to this long (s) … */
export const PHOTO_HOLD_MAX_S = 90;
/** … and a shot ends it this long after (s), once the camera is put away */
export const PHOTO_AFTER_S = 3;
/** the express version points at 直接到站 on a Metro leg longer than this (u; lane T's veil rule, plan §3.4) */
export const LONG_METRO_U = 400;
const NICE_SHOT: Bilingual = { zh: '拍得真好！这张可以当明信片了。', en: 'Great shot — that could be a postcard!' };
const SKIP_HINT: Bilingual = { zh: '这段地铁比较长，想快点可以点「直接到站」。', en: 'A long Metro leg — tap Skip to stop to get there sooner.' };

interface Run {
  def: CityTourDef;
  express: boolean;
  stops: FlatStop[];
  /** flat index of the current stop */
  i: number;
  completed: string[];
  phase: 'choose' | 'leading' | 'dwell' | 'done';
  /** clock (s) the dwell started, and its length */
  dwellAt: number;
  dwell: number;
  /** where the stop ended (the dwell's leave check) */
  at: { x: number; z: number } | null;
  /** the chapter whose intro was said last (−1: none) */
  chapter: number;
  /** the current stop's moment (the dwell reads it) and the clock (s) of a photo taken in it (0: none yet) */
  moment?: CityTourStop['moment'];
  shotAt: number;
  /** the express 直接到站 hint was given on this stop's ride */
  hinted: boolean;
}

let run: Run | null = null;
/** the last run, kept for the recap after the tour ended */
let lastRun: Pick<Run, 'def' | 'express' | 'completed'> | null = null;
export const lastCityTour = () => lastRun;
const clock = () => performance.now() / 1000;
const nameOf = (target: string): Bilingual | null => interactableById(target)?.name ?? null;

/** The stop as the version played rides it: the express version merges skipped rides and gets off at `expressTo`. */
export function playedStop(def: CityTourDef, stop: CityTourStop, express: boolean): CityTourStop {
  if (!express || stop.leg.via !== 'line') return stop;
  const r = expressRide(def, stop.id);
  if (!r) return stop;
  return { ...stop, leg: { via: 'line', line: r.line, from: r.from, to: r.to }, target: r.to === stop.leg.to ? stop.target : `transit-${r.to}` };
}

/** The save's progress of a tour (decoded against the tour), or undefined. */
export function savedProgress(id: string): TourProgress | undefined {
  return decodeTourSaves(readSave()?.tours ?? {})[id];
}

function saveProgress(r: Run) {
  const cur = r.stops[Math.min(r.i, r.stops.length - 1)];
  const chapter = cur?.chapter ?? 0;
  const stop = cur ? r.def.chapters[chapter].stops.findIndex(s => s.id === cur.stop.id) : 0;
  patchSave(s => { s.tours = { ...(s.tours ?? {}), [r.def.id]: { chapter, stop: Math.max(0, stop), completed: [...r.completed], ...(r.express ? { express: true } : {}) } }; });
}

function clearProgress(id: string) {
  patchSave(s => { if (s.tours?.[id]) { const next = { ...s.tours }; delete next[id]; s.tours = next; } });
}

function setTourState(r: Run, active: boolean) {
  game.set({ ...(active ? { mode: 'tour' as const } : {}), tour: { active, id: r.def.id, stop: r.i, completed: [...r.completed] } });
}

function begin(def: CityTourDef, express: boolean, completed: string[]) {
  const stops = tourStops(def, { express });
  const firstOpen = stops.findIndex(f => !completed.includes(f.stop.id));
  const i = firstOpen < 0 ? 0 : firstOpen;
  run = { def, express, stops, i, completed: firstOpen < 0 ? [] : completed, phase: 'leading', dwellAt: 0, dwell: 0, at: null, chapter: -1, shotAt: 0, hinted: false };
  lastRun = run;
  endTrip();
  closePanel();
  flow.set({ tourPhase: 'leading', weekStage: 'idle', goalsCard: false, awaitingPoi: null, freeLead: null, freeHint: null, mapTarget: null });
  setTourState(run, true);
  saveProgress(run);
  const resumed = run.completed.length > 0;
  if (resumed) say(`接着上次：第 ${stops[i].chapter + 1} 章`, `Picking up where you left off: chapter ${stops[i].chapter + 1}`, 'info', 3200);
  startStop(run);
}

/** Lead to the current stop: its chapter intro first, its lead line, the trip. */
function startStop(r: Run) {
  const flat = r.stops[r.i];
  if (!flat) { finish(r); return; }
  if (flat.chapter !== r.chapter) {
    r.chapter = flat.chapter;
    const intro = chapterSay(r.def.chapters[flat.chapter], 'intro');
    if (intro) offerPaced(intro);
    announce(r.def.chapters[flat.chapter].name);
  }
  const stop = playedStop(r.def, flat.stop, r.express);
  const option = tourStopOption(stop, { x: runtime.player.x, z: runtime.player.z }, nameOf);
  if (!option) { r.i++; startStop(r); return; }
  const lead = stopSay(stop, 'lead', r.express);
  if (lead) offerPaced(lead);
  r.phase = 'leading';
  r.hinted = false;
  flow.set({ tourPhase: 'leading' });
  setTourState(r, true);
  const target = stop.target.startsWith('place:') ? stop.target.slice(6) : stop.target;
  startTrip(option, { placeId: target, ...(stop.attraction ? { attraction: stop.attraction } : {}), ...(nameOf(stop.target) ? { name: nameOf(stop.target)! } : {}) }, 'tour');
}

/** The stop's trip ended: its arrive line, the dwell. */
function arrived(r: Run) {
  const flat = r.stops[r.i];
  if (!flat || r.phase !== 'leading') return;
  const stop = playedStop(r.def, flat.stop, r.express);
  const line = stopSay(stop, 'arrive', r.express && !!flat.stop.expressTo);
  if (line) offerPaced(line);
  if (stop.moment === 'photo') bubble(photoPrompt(), 3200, BAYBAY_ID, 'call');
  if (!r.completed.includes(flat.stop.id)) r.completed.push(flat.stop.id);
  r.phase = 'dwell';
  r.dwellAt = clock();
  r.dwell = DWELL_S[stop.moment ?? 'none'];
  r.moment = stop.moment;
  r.shotAt = 0;
  r.at = { x: runtime.player.x, z: runtime.player.z };
  flow.set({ tourPhase: 'arrived' });
  // the chapter's last stop: its outro
  const next = r.stops[r.i + 1];
  if (!next || next.chapter !== flat.chapter) { const outro = chapterSay(r.def.chapters[flat.chapter], 'outro'); if (outro) offerPaced(outro); }
  setTourState(r, true);
  saveProgress(r);
}

/** "Take a photo" in the words of this device: phones keep the camera under 更多 (ui/Hud.tsx PhoneBar, ≤ 600 px). */
export function photoPrompt(device = runtime.input.device, width = typeof window !== 'undefined' ? window.innerWidth : 1440): Bilingual {
  if (device === 'touch' && width <= 600) return { zh: '拍张照吧！点「更多」里的「拍照」', en: 'Take a photo! Tap More, then Photo' };
  if (device === 'touch') return { zh: '拍张照吧！点相机按钮', en: 'Take a photo! Tap the camera button' };
  return { zh: '拍张照吧！按 P 或点相机', en: 'Take a photo! Press P or click the camera' };
}

/** On to the next stop (the dwell is over, or 下一站). */
function nextStop(r: Run) {
  if (r.phase === 'done') return;
  r.i++;
  if (r.i >= r.stops.length) { finish(r); return; }
  startStop(r);
}

function finish(r: Run) {
  r.phase = 'done';
  endTrip();
  clearProgress(r.def.id);
  run = null;
  game.set({ mode: 'free', tour: { active: false, id: r.def.id, stop: r.stops.length - 1, completed: [...r.completed] } });
  flow.set({ tourPhase: 'finished', awaitingPoi: null });
  openPanel('recap');
}

/** 结束: stop where we are (progress kept for "继续一日游"); the recap when stops were done. */
function end(quiet = false) {
  const r = run;
  if (!r) return;
  r.phase = 'done';
  run = null;
  endTrip();
  clearLines();
  saveProgress(r);
  game.set({ mode: 'free', tour: { active: false, id: r.def.id, stop: r.i, completed: [...r.completed] } });
  flow.set({ tourPhase: 'finished', awaitingPoi: null });
  if (quiet) return;
  if (r.completed.length) openPanel('recap');
  else startFree({ quiet: true });
}

/** 跳过这一站: the stop is not done; lead on to the next one. */
export function skipCityTourStop() {
  const r = run;
  if (!r || r.phase === 'done') return;
  endTrip();
  clearLines();
  nextStop(r);
}

/** The intro: 完整版 / 快速版 (a fresh tour), then off we go. */
function choose(def: CityTourDef) {
  const full = minutesLabel(def.minutes), express = minutesLabel(def.expressMinutes);
  const choices: NonNullable<DialogueNode['choices']> = [
    { hotkey: '1', label: { zh: `完整版 · ${full.zh} · 每站都下车`, en: `Full tour · ${full.en} · off at every stop` }, next: `flow.tour.${def.id}.full` },
    { hotkey: '2', label: { zh: `快速版 · ${express.zh} · 只在金门大桥、双峰、州立大学下车`, en: `Express · ${express.en} · off only at the Golden Gate, Twin Peaks, SF State` }, next: `flow.tour.${def.id}.express` },
    { hotkey: '3', label: { zh: '先不去了', en: 'Not now' }, action: { type: 'end' } },
  ];
  // the two picks are nodes that start the tour when they open (flow's dialogue runner has no custom actions)
  defineNode({ id: `flow.tour.${def.id}.full`, speaker: 'baybay', mood: 'excited', text: { zh: '好嘞！完整版出发，跟我来～', en: 'Great — the full tour it is. Follow me~' }, action: { type: 'end' } });
  defineNode({ id: `flow.tour.${def.id}.express`, speaker: 'baybay', mood: 'excited', text: { zh: '好嘞！快速版出发，长的地铁段可以点「直接到站」。', en: 'Great — the express. On the long Metro legs you can tap Skip to stop.' }, action: { type: 'end' } });
  pendingPick = def;
  playDialogue(defineNode({
    id: `flow.tour.${def.id}`, speaker: 'baybay', mood: 'excited',
    text: { zh: `${def.name.zh}：坐观光巴士、N 线、M 线和叮当车，全城 ${def.chapters.length} 章，随时可以下车。`, en: `${def.name.en}: the sightseeing bus, the N, the M and a cable car — ${def.chapters.length} chapters, hop off anytime.` },
    choices,
  }), () => {
    pendingPick = null;
    // "先不去了" from the city welcome: the player still needs a mode (the welcome's own fallback was replaced)
    if (!run && game.get().mode === 'onboarding') startFree();
  });
}
let pendingPick: CityTourDef | null = null;

function start(id: string) {
  const def = cityTour(id);
  if (!def) { say('这个导览还没准备好', 'That tour is not ready yet'); return; }
  if (run && run.def.id === id) { say('一日游已经在进行中啦', 'The Grand Tour is already under way', 'info', 2400); return; }
  const saved = savedProgress(id);
  if (saved && saved.completed.length) { begin(def, !!saved.express, saved.completed); return; }
  choose(def);
}

function next() {
  const r = run;
  if (!r) return;
  if (r.phase === 'dwell') { nextStop(r); return; }
  // leading: 下一站 from the call menu means "keep going" (the trip leads on); nothing to skip
}

function callChoices(): NonNullable<DialogueNode['choices']> {
  const r = run;
  if (!r) return [];
  const flat = r.stops[r.i];
  const name = flat ? nameOf(playedStop(r.def, flat.stop, r.express).target) : null;
  const out: NonNullable<DialogueNode['choices']> = [];
  if (r.phase === 'dwell') out.push({ label: { zh: '继续下一站', en: 'On to the next stop' }, action: { type: 'tour-next' } });
  else out.push({ label: name ? { zh: `继续：带我去${name.zh}`, en: `Keep going: take me to ${name.en}` } : { zh: '继续跟你走', en: 'Keep following you' }, action: { type: 'end' } });
  out.push({ label: { zh: '跳过这一站', en: 'Skip this stop' }, next: 'flow.tour.skip' });
  out.push({ label: { zh: '先不逛了，结束一日游', en: 'End the Grand Tour for now' }, action: { type: 'tour-end' } });
  return out;
}

/** The objective pill: 一日游 · the chapter, 5 dots (one per chapter), the next stop. */
function pill(): TourPill | null {
  const r = run;
  const flat = r?.stops[Math.min(r.i, r.stops.length - 1)];
  if (!r || !flat) return null;
  const chapter = r.def.chapters[flat.chapter];
  const done = r.def.chapters.filter((_, ci) => { const mine = r.stops.filter(f => f.chapter === ci); return mine.length > 0 && mine.every(f => r.completed.includes(f.stop.id)); }).length;
  return { id: r.def.id, name: { zh: `一日游 · ${chapter.name.zh}`, en: `Grand Tour · ${chapter.name.en}` }, step: flat.chapter + 1, total: r.def.chapters.length, done, next: r.phase === 'leading' ? nameOf(playedStop(r.def, flat.stop, r.express).target) : null };
}

/**
 * Whether a stop's dwell is over (pure): its time is up, or you walked on (after DWELL_MIN_S), or — a photo moment — you
 * took the shot PHOTO_AFTER_S ago; while you frame a photo moment's shot (photo mode) it waits, up to PHOTO_HOLD_MAX_S.
 */
export function dwellOver(r: Pick<Run, 'dwellAt' | 'dwell' | 'at' | 'moment' | 'shotAt'>, now: number, o: { photoMode: boolean; player: { x: number; z: number } }): boolean {
  const elapsed = now - r.dwellAt;
  const photo = r.moment === 'photo';
  if (photo && o.photoMode && elapsed < PHOTO_HOLD_MAX_S) return false;
  const shot = photo && r.shotAt > 0 && now - r.shotAt >= PHOTO_AFTER_S;
  const left = r.at ? Math.hypot(o.player.x - r.at.x, o.player.z - r.at.z) > DWELL_LEAVE_R : false;
  return elapsed >= r.dwell || shot || (left && elapsed >= DWELL_MIN_S);
}

/** Express: your own train just left on a long Metro leg of a tour trip, and the hint was not given yet (pure). */
export function wantsSkipHint(e: GameEvent, r: Pick<Run, 'express' | 'phase' | 'hinted'> | null, trip: TripState | null): boolean {
  if (e.type !== 'transit' || e.what !== 'depart' || e.kind !== 'light-rail' || e.strength !== undefined) return false;
  if (!r?.express || r.phase !== 'leading' || r.hinted || trip?.source !== 'tour') return false;
  const leg = trip.legs[trip.leg];
  return leg?.via === 'line' && leg.length > LONG_METRO_U;
}

/** 2 Hz: the dwell's end, a tour that something else ended (the week, a restart). */
function tick(now: number) {
  const r = run;
  if (!r) return;
  const t = game.get().tour;
  if (!t.active || tourIdOf(t) !== r.def.id) { run = null; clearLines(); saveProgress(r); return; }
  if (r.phase !== 'dwell' || dialogueOpen()) return;
  if (dwellOver(r, now, { photoMode: game.get().photoMode, player: runtime.player }) && !lineSpeaking(now)) nextStop(r);
}

let booted = false;
/** Once, the first time a city tour starts (game/flow.ts); registers the API with flow. */
export function initCityTour(): void {
  if (booted) return;
  booted = true;
  const api: CityTourApi = { start, next, skip: skipCityTourStop, end, callChoices, pill };
  setCityTourApi(api);
  // the call menu's 跳过这一站
  defineNode({ id: 'flow.tour.skip', speaker: 'baybay', mood: 'point', text: { zh: '好，这站先跳过，去下一站！', en: 'OK, we skip this one — on to the next!' }, action: { type: 'end' } });
  let acc = 0;
  registerFrameSystem('c-city-tour', (dt, now) => { if ((acc += dt) >= 0.5) { acc = 0; tick(now / 1000); } });
  // Settings → reset progress (verify F5): a running tour stops without writing its progress back into the new save
  onSaveCleared(() => { if (run) clearLines(); run = null; lastRun = null; pendingPick = null; });
  onEvent(e => {
    // the welcome / intro picks, the skip node
    if (e.type === 'dialogue') {
      const pick = pendingPick;
      if (pick && e.nodeId === `flow.tour.${pick.id}.full`) { pendingPick = null; begin(pick, false, []); }
      else if (pick && e.nodeId === `flow.tour.${pick.id}.express`) { pendingPick = null; begin(pick, true, []); }
      else if (e.nodeId === 'flow.tour.skip') skipCityTourStop();
      return;
    }
    // the stop's trip ended (game/tripRun: `trip` end of a 'tour' trip)
    if (e.type === 'trip' && e.what === 'end' && run && flow.get().trip?.source === 'tour') arrived(run);
    // the photo moment's shot
    if (e.type === 'shutter' && run?.phase === 'dwell' && run.moment === 'photo' && !run.shotAt) { run.shotAt = clock(); offerLine(NICE_SHOT, 6); }
    // express: your own train leaves on a long Metro leg → 直接到站 is there (once per stop)
    if (run && wantsSkipHint(e, run, flow.get().trip)) { run.hinted = true; offerLine(SKIP_HINT, 10); }
  });
}

/** Tests / QA: the running tour (read-only view). */
export const cityTourRun = (): Readonly<Pick<Run, 'express' | 'i' | 'completed' | 'phase'>> & { stop?: string; chapter?: number } | null =>
  (run ? { express: run.express, i: run.i, completed: run.completed, phase: run.phase, stop: run.stops[run.i]?.stop.id, chapter: run.stops[run.i]?.chapter } : null);

/** The Grand Tour's id (= data/sf/copy GRAND_TOUR.id), for the flow's first-lesson checks. */
export const GRAND_ID = GRAND_TOUR.id;
export const isCityTourId = (id: string | undefined) => !!id && id !== DEFAULT_TOUR_ID && !!cityTour(id);
