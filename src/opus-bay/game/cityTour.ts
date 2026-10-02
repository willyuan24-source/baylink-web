import { emit, onEvent, type GameEvent } from '../core/events';
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
import { BAYBAY_ID, interactableById, postcardById } from './interactables';
import { autoEndReason, autoOn, subscribeAuto } from './autoTravel';
import { unlockPelican } from './pelicanFirst';
import { registerFrameSystem } from './systemsRegistry';
import { tourStopOption } from './tourTrips';
import { resumeAutoTravel, showCard } from './tripRun';
import { minutesLabel } from './tripText';
import { ATTENTION_PRIORITY } from './attention';
import { coinsTotal } from '../economy/ledger';
import { rewardPostcard } from './rewards';
import { wishlist } from '../data/wishlist';
import { ATTRACTION_INDEX } from '../data/sf/attractions';
import { registerAskItem } from '../ui/slots';
import { Heart } from 'lucide-react';
import { isArrived } from './trips';
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
 * Wave 5 (W5-C5, plan MF4 "one tap … BAYBAY leading" on every device): BAYBAY carries the player along every stop's
 * on-foot legs like any trip (lane N's auto-travel, game/tripRun resumeAutoTravel) — to the stop, the station, on from
 * the ride — and lane T's riders board the tour's bus / train without the driver's question (W5-T3). A takeover (the
 * stick, WASD, a tap on the ground) lasts for the rest of the tour; the call menu's 继续：带我去… (or the chip's 自动跟上)
 * hands the walking back to her.
 * Part b: a photo moment waits for the shutter (photo mode holds the dwell, a shot ends it 3 s later with "拍得真好"); the
 * express version points at 直接到站 when your train leaves on a Metro leg > 400 u.
 * Int-review: the player's own trip never strands the tour — 换个方式 to the same stop stays the tour's trip
 * (game/tripRun.ts start), another trip / 结束 / a fast travel pauses it (a toast; the call menu's 继续一日游 leads on),
 * reaching the stop anyway counts, and the tour never ends or takes over the player's own trip by itself (`watchTrip`).
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
  /** where the current stop's trip ends (got there without it still counts: int-review) */
  target: { x: number; z: number } | null;
  /** clock (s) the leading stop's trip went missing (0: it runs) */
  lostAt: number;
  /** the player's own trip took over (int-review): the tour waits until the call menu's 继续一日游 */
  paused: boolean;
  /** W5-C5: BAYBAY carries the player on the stops' on-foot legs (off after a takeover, on again with 继续：带我去 / 自动跟上) */
  carry: boolean;
  /** (W9-N3) the coin balance when the current chapter began (the chapter card's +N) */
  chapterCoins?: number;
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

/**
 * The stop a resume starts at (pure): the first stop at or after `i` that is not completed (a stop just reached is
 * completed, so the chapter after a chapter's last stop is the next one), else `i`. (W9-N3, review R§6 growth row: the
 * save kept the finished chapter, and "继续一日游 · 第 n 章" said one less at every chapter boundary.)
 */
export function resumeIndex(stops: readonly FlatStop[], i: number, completed: readonly string[]): number {
  for (let k = Math.max(0, i); k < stops.length; k++) if (!completed.includes(stops[k].stop.id)) return k;
  return Math.min(Math.max(0, i), stops.length - 1);
}

function saveProgress(r: Run) {
  const cur = r.stops[resumeIndex(r.stops, r.i, r.completed)];
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
  run = { def, express, stops, i, completed: firstOpen < 0 ? [] : completed, phase: 'leading', dwellAt: 0, dwell: 0, at: null, chapter: -1, shotAt: 0, hinted: false, target: null, lostAt: 0, paused: false, carry: true };
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
    try { r.chapterCoins = coinsTotal(); } catch { r.chapterCoins = undefined; }
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
  const end = option.legs[option.legs.length - 1].to;
  r.target = { x: end.x, z: end.z };
  r.lostAt = 0;
  r.paused = false;
  flow.set({ tourPhase: 'leading' });
  setTourState(r, true);
  const target = stop.target.startsWith('place:') ? stop.target.slice(6) : stop.target;
  startTrip(option, { placeId: target, ...(stop.attraction ? { attraction: stop.attraction } : {}), ...(nameOf(stop.target) ? { name: nameOf(stop.target)! } : {}) }, 'tour');
  // W5-C5: BAYBAY carries the player (unless they took over earlier in this tour)
  if (r.carry && flow.get().trip?.source === 'tour') resumeAutoTravel();
}

/** The stop's trip ended: its arrive line, the dwell. */
function arrived(r: Run) {
  const flat = r.stops[r.i];
  if (!flat || r.phase !== 'leading') return;
  const stop = playedStop(r.def, flat.stop, r.express);
  // wave 5 (W5-C2, plan MF3 / D26): the first stop reached meets the pelican — its toast and line first (the stop's
  // own line often says where to go next: 观光巴士就在…), no route change
  unlockPelican('tour');
  const line = stopSay(stop, 'arrive', r.express && !!flat.stop.expressTo);
  if (line) offerPaced(line);
  if (stop.moment === 'photo') bubble(photoPrompt(), 3200, BAYBAY_ID, 'call');
  if (!r.completed.includes(flat.stop.id)) r.completed.push(flat.stop.id);
  r.phase = 'dwell';
  r.paused = false;
  r.lostAt = 0;
  r.dwellAt = clock();
  r.dwell = DWELL_S[stop.moment ?? 'none'];
  r.moment = stop.moment;
  r.shotAt = 0;
  r.at = { x: runtime.player.x, z: runtime.player.z };
  flow.set({ tourPhase: 'arrived' });
  // the chapter's last stop: its outro, and (W9-N3) the chapter card once BAYBAY has said it
  const next = r.stops[r.i + 1];
  if (!next || next.chapter !== flat.chapter) {
    const outro = chapterSay(r.def.chapters[flat.chapter], 'outro'); if (outro) offerPaced(outro);
    if (next) chapterCard(r, flat.chapter, next.chapter);
  }
  setTourState(r, true);
  saveProgress(r);
}

/**
 * (W9-N3, plan §3 N (3)) A chapter's settlement card: the chapter's stop postcards (the ones the tour walked past are
 * claimed now, quietly — review R§6: the recap said 0/24), the coins it brought, 下一章 with its minutes, the chapter's
 * places into 想去, or a rest here (the tour waits for 继续一日游). Through F's arbiter (a card, after the outro line).
 */
function chapterCard(r: Run, ci: number, nextCi: number) {
  const chapter = r.def.chapters[ci], upcoming = r.def.chapters[nextCi];
  const claimed = claimChapterPostcards(chapter, r.completed);
  const cards = chapter.stops.filter(s => s.postcard && !(r.express && s.express === 'skip'));
  const have = cards.filter(s => game.get().postcards.includes(s.postcard!)).length;
  let coins: number;
  try { coins = r.chapterCoins !== undefined ? Math.max(0, coinsTotal() - r.chapterCoins) : 0; } catch { coins = 0; }
  const m = minutesLabel(chapterMinutesScaled(r.def, upcoming, r.express));
  const parts = [`第 ${ci + 1} 章 · ${chapter.name.zh} 完成！`, cards.length ? `明信片 ${have}/${cards.length}${claimed ? `（新 +${claimed}）` : ''}` : '', coins ? `金币 +${coins}` : ''].filter(Boolean);
  const partsEn = [`Chapter ${ci + 1} · ${chapter.name.en} done!`, cards.length ? `postcards ${have}/${cards.length}${claimed ? ` (+${claimed} new)` : ''}` : '', coins ? `+${coins} coins` : ''].filter(Boolean);
  pendingWish = chapter.stops.flatMap(s => (s.attraction ? [s.attraction] : []));
  const id = defineNode({
    id: 'flow.tour.chapter', speaker: 'narrator', text: { zh: parts.join(' · '), en: partsEn.join(' · ') },
    choices: [
      { hotkey: '1', label: { zh: `下一章：${upcoming.name.zh}（${m.zh}）`, en: `Next: ${upcoming.name.en} (${m.en})` }, action: { type: 'tour-next' } },
      { hotkey: '2', label: { zh: '这一章的地方加到想去', en: 'Save this chapter’s places' }, action: { type: 'ask', id: ASK_CHAPTER_WISH } },
      { hotkey: '3', label: { zh: '先在这儿逛逛', en: 'Stay here a while' }, action: { type: 'ask', id: ASK_CHAPTER_REST } },
    ],
  });
  showCard(id, ATTENTION_PRIORITY.card, () => {
    // after BAYBAY's outro has been said (the pacer), never over another dialogue
    const tryOpen = (n: number) => {
      if (run !== r || r.phase !== 'dwell') return;
      if ((lineSpeaking(clock()) || dialogueOpen()) && n < 40) { setTimeout(() => tryOpen(n + 1), 250); return; }
      if (!dialogueOpen()) { r.dwellAt = clock(); playDialogue(id); }
    };
    tryOpen(0);
  }, 30000);
}

/** The next chapter's minutes at the measured quote's scale (the stops keep the timing model's minutes). */
function chapterMinutesScaled(def: CityTourDef, c: CityTourDef['chapters'][number], express: boolean): number {
  const model = c.stops.filter(s => !s.optional).reduce((sum, s) => sum + (express ? s.expressMinutes : s.minutes), 0);
  const k = express ? def.expressMinutes / (def.modelExpressMinutes || def.expressMinutes) : def.minutes / (def.modelMinutes || def.minutes);
  return Math.max(1, Math.round(model * k));
}

/**
 * The chapter's stop postcards not found yet, of the stops this run reached (a skipped or optional stop not walked to
 * gives none): collected now, without the reward card (one coin reward each, once).
 */
function claimChapterPostcards(c: CityTourDef['chapters'][number], reached: readonly string[]): number {
  const have = game.get().postcards;
  const ids = c.stops.flatMap(s => (s.postcard && reached.includes(s.id) && !have.includes(s.postcard) && postcardById(s.postcard) ? [s.postcard] : []));
  if (!ids.length) return 0;
  game.set({ postcards: [...have, ...ids] });
  for (const id of ids) { emit({ type: 'postcard', id }); rewardPostcard(id); }
  return ids.length;
}

let pendingWish: string[] = [];
const ASK_CHAPTER_WISH = 'n-tour-chapter-wish';
const ASK_CHAPTER_REST = 'n-tour-chapter-rest';
/** 这一章的地方加到想去: the chapter's attractions into the journal's 想去 (one toast). */
function chapterWish() {
  let added = 0;
  for (const a of pendingWish) {
    const at = ATTRACTION_INDEX.get(a);
    if (!at) continue;
    const id = at.placeId ?? at.id;
    if (!wishlist.has('place', id) && wishlist.add({ kind: 'place', id, title: at.name.zh })) added++;
  }
  say(added ? `已加入想去 · ${added} 个地方` : '这些地方已经在想去里了', added ? `Saved · ${added} places` : 'Already saved', 'success', 2600);
  // the card closed with the ask: the tour goes on to the next stop as 下一章 would
  next();
}
/** 先在这儿逛逛: the tour waits here (the call menu's 继续一日游 leads on). */
function chapterRest() { const r = run; if (r && r.phase === 'dwell') pause(r); }

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

/** End the stop's trip (never the player's own trip from the map: int-review). */
const endTourTrip = () => { if (flow.get().trip?.source === 'tour') endTrip(); };

function finish(r: Run) {
  r.phase = 'done';
  endTourTrip();
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
  endTourTrip();
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
  // (ending the stop's trip stops its auto-walk: that is not the player taking over)
  const carry = r.carry;
  endTrip();
  r.carry = carry;
  clearLines();
  nextStop(r);
}

/**
 * The intro: 完整版 / 快速版. (W9-N3) No longer asked — `start` begins the full tour; kept for a QA / test hook only
 * (`chooseCityTourVersion`), the express version stays playable from a saved express run.
 */
export function chooseCityTourVersion(id: string) { const def = cityTour(id); if (def) choose(def); }
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
  // (W9-N3, review R§6: the two versions differed by 7 minutes and the question came on top of the morning toast) the
  // full tour at once — any stop can be skipped and the tour ended at any time; a saved express run still resumes as one
  begin(def, false, []);
}

/** The tour waits for the player (int-review): paused, or leading without the stop's trip. */
const waiting = (r: Run): boolean => r.paused || (r.phase === 'leading' && flow.get().trip?.source !== 'tour');

function next() {
  const r = run;
  if (!r) return;
  // 继续一日游 after the player's own trip: lead to the stop again (or on from the stop it waited at)
  if (waiting(r)) {
    r.paused = false; r.lostAt = 0; r.carry = true;
    if (r.phase === 'dwell') nextStop(r); else startStop(r);
    return;
  }
  if (r.phase === 'dwell') { nextStop(r); return; }
  // leading: 继续：带我去… from the call menu — BAYBAY carries the player again (W5-C5)
  r.carry = true;
  resumeAutoTravel();
}

function callChoices(): NonNullable<DialogueNode['choices']> {
  const r = run;
  if (!r) return [];
  const flat = r.stops[r.i];
  const name = flat ? nameOf(playedStop(r.def, flat.stop, r.express).target) : null;
  const out: NonNullable<DialogueNode['choices']> = [];
  if (waiting(r)) {
    out.push({
      label: r.phase === 'dwell' || !name ? { zh: '继续一日游 · 去下一站', en: 'Resume the Grand Tour · next stop' } : { zh: `继续一日游：带我去${name.zh}`, en: `Resume the Grand Tour: take me to ${name.en}` },
      action: { type: 'tour-next' },
    });
  } else if (r.phase === 'dwell') out.push({ label: { zh: '继续下一站', en: 'On to the next stop' }, action: { type: 'tour-next' } });
  else out.push({ label: name ? { zh: `继续：带我去${name.zh}`, en: `Keep going: take me to ${name.en}` } : { zh: '继续跟你走', en: 'Keep following you' }, action: { type: 'tour-next' } });
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

/**
 * The player's own trip over the tour (int-review), 2 Hz: the stop's trip was ended (the trip card's 结束, 带我去, a fast
 * travel) or replaced (the map's 跟 BAYBAY 去 somewhere else), or a trip of theirs starts while the tour waits at a stop.
 * The tour then waits (no lead, no next stop taking their trip over) with one toast; getting to the stop anyway still
 * counts; the call menu's 继续一日游 leads on. True while the tour waits.
 */
function watchTrip(r: Run, now: number): boolean {
  const trip = flow.get().trip;
  const theirs = !!trip && !isArrived(trip) && trip.source !== 'tour';
  if (r.phase === 'leading') {
    if (trip?.source === 'tour') { r.lostAt = 0; r.paused = false; return false; }
    if (!r.lostAt) r.lostAt = now;
    // got to the stop without the tour's trip (walked, flew or took the map's route there): arrived
    if (!theirs && r.target && game.get().move.mode !== 'travel' && Math.hypot(runtime.player.x - r.target.x, runtime.player.z - r.target.z) <= STOP_REACHED_R) { arrived(r); return true; }
    if (!r.paused && now - r.lostAt >= LOST_GRACE_S) pause(r);
    return true;
  }
  if (r.phase === 'dwell' && theirs && !r.paused) pause(r);
  return r.paused;
}
function pause(r: Run) {
  r.paused = true;
  say(PAUSED.zh, PAUSED.en, 'info', 4200);
}
/** a stop counts as reached without its trip this close to the trip's end (u): the attraction's arrival ring */
export const STOP_REACHED_R = 12;
/** the stop's trip missing this long (s) pauses the tour (a new tour trip starts within a frame) */
export const LOST_GRACE_S = 1.5;
const PAUSED: Bilingual = { zh: '一日游先暂停～想接着逛就叫 BAYBAY', en: 'Grand Tour paused — call BAYBAY to go on' };

/** 2 Hz: the dwell's end, the player's own trip, a tour that something else ended (the week, a restart). */
function tick(now: number) {
  const r = run;
  if (!r) return;
  const t = game.get().tour;
  if (!t.active || tourIdOf(t) !== r.def.id) { run = null; clearLines(); saveProgress(r); return; }
  if (r.phase === 'done' || watchTrip(r, now)) return;
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
  // (W9-N3) the chapter card's answers (ask actions; never listed in the 问 BAYBAY menu)
  registerAskItem({ id: ASK_CHAPTER_WISH, order: 999, label: { zh: '加到想去', en: 'Save' }, icon: Heart, visible: () => false, onSelect: chapterWish });
  registerAskItem({ id: ASK_CHAPTER_REST, order: 999, label: { zh: '先逛逛', en: 'Stay' }, icon: Heart, visible: () => false, onSelect: chapterRest });
  // the call menu's 跳过这一站
  defineNode({ id: 'flow.tour.skip', speaker: 'baybay', mood: 'point', text: { zh: '好，这站先跳过，去下一站！', en: 'OK, we skip this one — on to the next!' }, action: { type: 'end' } });
  let acc = 0;
  registerFrameSystem('c-city-tour', (dt, now) => {
    // W6-K2-review: Settings (the game's pause) holds a stop's dwell as it holds the ride — its clock waits while the
    // sheet is open, so the panorama / photo moment is still there when it closes (before, 45 s in Settings at the
    // Golden Gate came back to the next stop's trip already started)
    if (run?.phase === 'dwell' && game.get().paused) { run.dwellAt += dt; if (run.shotAt) run.shotAt += dt; }
    if ((acc += dt) >= 0.5) { acc = 0; tick(now / 1000); }
  });
  // W5-C5: a takeover on a stop's leg (auto-travel off while the stop's trip still runs) lasts for the tour; 自动跟上 on
  // the chip turns carrying back on (a trip's own end switches it off with the trip already arrived: no change)
  subscribeAuto(() => {
    const r = run, trip = flow.get().trip;
    // (W9-N1, review R§5 #7) only the player steering turns it off: a stuck leg the runner rescued (or the player got
    // out of by hand) leaves BAYBAY carrying the next legs
    if (r && r.phase === 'leading' && trip?.source === 'tour' && !isArrived(trip)) r.carry = autoOn() || autoEndReason() !== 'takeover';
  });
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
export const cityTourRun = (): Readonly<Pick<Run, 'express' | 'i' | 'completed' | 'phase' | 'paused' | 'carry'>> & { stop?: string; chapter?: number } | null =>
  (run ? { express: run.express, i: run.i, completed: run.completed, phase: run.phase, paused: run.paused, carry: run.carry, stop: run.stops[run.i]?.stop.id, chapter: run.stops[run.i]?.chapter } : null);

/** The Grand Tour's id (= data/sf/copy GRAND_TOUR.id), for the flow's first-lesson checks. */
export const GRAND_ID = GRAND_TOUR.id;
export const isCityTourId = (id: string | undefined) => !!id && id !== DEFAULT_TOUR_ID && !!cityTour(id);
