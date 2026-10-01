import { getLocale } from '../../i18n/locale';
import { emit, onEvent, type GameEvent } from '../core/events';
import { runtime, type Emote } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual, Mood } from '../core/types';
import { onSaveCleared, patchSave, readSave } from '../data/save';
import { ATTRACTIONS } from '../data/sf/attractions';
import { CAMPUS_IDS, LOOP_LINE, campusArrived, loopStopReached, metroRideCounts } from '../data/sf/goalMarks';
import { CITY_GOAL, SIGHTSEEING_STOPS, loopStopsReached } from '../data/sf/goals';
import { CITY_POSTCARDS } from '../data/sf/postcards';
import { placeIndex } from '../data/sf/places';
import { sayLine, tunnelNarration } from '../data/sf/tourLines';
import { TOUR_GEO, rideArc, transitSay } from '../data/sf/tours';
import { TOUR_VOICE_CLIPS } from '../data/sf/voiceTour';
import { W5_PACED_CLIPS } from '../data/sf/voiceW5';
import { ARRIVAL_CARD_MS } from '../ui/guideText';
import { ArrivalWatcher, arrivalAnchors, arrivalBeats, arrivalPaced, decodeArrivalSeen, type ArrivalHit } from './arrival';
import { registerGoalTargets, type GoalTarget } from './cityContent';
import { baybayHeld } from './baybayHold';
import { cinemaActive } from './cinema';
import { isDiscovered, markDiscovered } from './discovery';
import { travelActive } from './fastTravel';
import { bubble, dialogueOpen, goalsStepOpen, markGoalsDone, noteArrivalMoment } from './flow';
import { flow } from './flowStore';
import { BAYBAY_ID, interactables } from './interactables';
import { LINE_TTL, LinePacer, NARRATION_REPEAT, clipSecondsFrom, voiceLang, type PacedLine, type SaidLine } from './linePacer';
import { registerFrameSystem } from './systemsRegistry';
import { STREET_FACTOR, arriveYourselfGoalRule, autoTravelSeconds, cableCarGoalRule, lineRideGoalRule, type TripGoalRule } from './tripPlan';
import { timeLabel } from './tripText';
import { registerTripGoals } from './tripProviders';
import { bayNow } from './bayNow';
import { initPelicanFirst, stepPelican, unlockPelican, unlocksAt } from './pelicanFirst';
import { rewardArrival } from './rewards';
import { frameRumour, pickRumour, rumourDue, rumourSourceCount } from './rumours';
import { importRetry } from './importRetry';

// wave 5 (W5-C2): flow reaches the pelican moment through game/cityContent.ts unlockPelican
export { unlockPelican };

/**
 * Wave 4 · lane C · BAYBAY in the running city (lazy: game/cityContent.ts imports it in city mode only).
 *
 *   arrival moments (W4-C6)   game/arrival.ts ArrivalWatcher over lane P's ATTRACTIONS at 4 Hz → the `arrival` event,
 *                             `flow.arrival` (the beats lane G's toast / ArrivalCard / reveal show; cleared after the
 *                             card's 6 s), BAYBAY's line through the pacer, the place discovered (fast travel), save v2
 *                             `arrivals`, the campuses goal
 *   BAYBAY's paced lines      one game/linePacer.ts LinePacer (a line waits for the clip still playing; repeats and
 *                             stale lines are dropped): the sightseeing-bus and Metro narration on lane T's `transit`
 *                             events, the subway overlay's tunnel line (`sayTunnel`, lane T), the Grand Tour's lines
 *                             (`offerLine`, game/cityTour.ts); voice = lane V's TOUR_VOICE_CLIPS (text only without one)
 *   ride goals (W4-C8)        sightseeing: a `loop:<stop>` mark for every loop stop a real ride reaches (8 → the goal);
 *                             metro: a ride of ≥ 150 u that gets off at La Playa (N) or Winston / Holloway (M)
 *   trip goal rules           lane G's planner marks the option that completes an open goal ("顺便完成叮当车目标")
 */

// ---------------------------------------------------------------------------------------------------------------
// The pacer
// ---------------------------------------------------------------------------------------------------------------

// the clip lengths of the current voice language (read per line: a language switch mid-tour times the next line right);
// review (lane V's request 4, W5-V7): lane C's 11 frozen wave-5 lines were recorded (data/sf/voiceW5.ts W5_PACED_CLIPS,
// the approved clips only) but this table did not have them, so the pelican moment, the welcome back, the goals step and
// the deck lines stayed text only — they speak now (the pacer times them by their clips, speakRecorded plays them)
const clipSeconds = clipSecondsFrom({ ...TOUR_VOICE_CLIPS, ...W5_PACED_CLIPS }, () => voiceLang(getLocale()));
const pacer = new LinePacer(clipSeconds);
let lastSaid: SaidLine | null = null;
const clock = () => performance.now() / 1000;

const EMOTES: Partial<Record<Mood, Emote>> = { point: 'point', excited: 'hop', wave: 'wave', proud: 'clap', thinking: 'think' };

/** Queue one of BAYBAY's lines (a tourLines id or a plain bubble); false when it is a repeat or unknown. */
export function offerLine(say: string | Bilingual, ttl?: number, now = clock()): boolean {
  const line = sayLine(say, ttl);
  return line ? pacer.offer(line, now) : false;
}
/** Queue a frozen line by id (its voice once recorded), or `text` when the id is unknown (wave 5, W5-C6). */
export function offerLineOr(id: string, text: Bilingual, ttl?: number, now = clock()): boolean {
  const line = sayLine(id, ttl) ?? sayLine(text, ttl);
  return line ? pacer.offer(line, now) : false;
}
/** The clip of a frozen line in the current voice language exists (lane V's table). */
export const lineRecorded = (id: string): boolean => (clipSeconds(id) ?? 0) > 0;
/**
 * A frozen line shown as text somewhere else (a dialogue node, a flow bubble): play its recorded clip with it, when there
 * is one (wave 5, W5-C6). No clip: nothing (the bubble's own chirp stands).
 */
export function speakRecorded(id: string): boolean {
  if (!lineRecorded(id)) return false;
  emit({ type: 'voice-line', id });
  return true;
}
/** Queue a ready paced line (the arrival beats). */
export const offerPaced = (line: PacedLine, now = clock()) => pacer.offer(line, now);
/** The tour was cancelled / ended: drop what waits. */
export const clearLines = () => pacer.clear();
/** BAYBAY is saying a paced line right now (the tour lets her finish it before leading on; waiting lines keep their ttl). */
export const lineSpeaking = (now = clock()) => pacer.isBusy(now);
/** Lines queued or being said (tests). */
export const linesBusy = (now = clock()) => pacer.isBusy(now) || pacer.pending() > 0;

/** Lane T's subway overlay, when a ride goes under ground on the arc span [fromAt, toAt]. */
export function sayTunnel(line: string, fromAt: number, toAt: number) {
  const l = tunnelNarration(line, fromAt, toAt);
  const say = l ? sayLine(l.id, LINE_TTL.portal) : null;
  if (say) pacer.offer({ ...say, repeatGap: NARRATION_REPEAT }, clock());
}

/**
 * Held (review 2, D5): by G2's own silent gate (game/baybayLines.ts: dialogue, cinematics, fast travel, photo mode,
 * fishing, pause, the postcard reward, an open panel: flow.bubble() would drop the text and the voice would play alone)
 * and by a bubble on screen that is not the pacer's own (another city line, a trip call). W8-K1: and by
 * game/baybayHold.ts baybayHeld() (a play panel, an egg card, the Halloween postcard, hide & seek, the kite…).
 */
function stepPacer(now: number) {
  const s = game.get(), f = flow.get();
  const silent = s.phase !== 'playing' || s.paused || dialogueOpen() || cinemaActive() || !!f.cinematic || travelActive() || s.move.mode === 'travel' || s.photoMode
    || !!f.postcardReward || !!f.postcardFly || !!f.fishing || s.panel.kind !== null || goalsStepOpen()
    // W8-K1: a play panel, an egg card, the Halloween postcard… (game/baybayHold.ts): the line waits its ttl out
    || baybayHeld();
  const other = !!f.bubble && f.bubble.text.zh !== lastSaid?.text.zh;
  const said = pacer.step(now, silent || other);
  if (!said) return;
  lastSaid = said;
  // (W8-K1) the voice only with its bubble on screen
  if (!bubble(said.text, said.bubbleMs, BAYBAY_ID, 'bark')) return;
  if (said.voiced && said.voice) emit({ type: 'voice-line', id: said.voice });
  const emote = said.mood ? EMOTES[said.mood] : undefined;
  if (emote) { runtime.guide.emote = emote; emit({ type: 'emote', who: 'baybay', emote }); }
}

// ---------------------------------------------------------------------------------------------------------------
// Transit narration and the ride goals
// ---------------------------------------------------------------------------------------------------------------

type TransitEvent = Extract<GameEvent, { type: 'transit' }>;
/** the Metro ride in progress (lane T's rider `board` → `arrive`s) */
let metroRide: { line: string; board: string; stops: number } | null = null;

/** The ride's arc between two Metro stations, when the tour's geometry knows both (else null). */
export function metroArc(line: string, board: string, alight: string): number | null {
  const g = TOUR_GEO[line];
  return g?.stations[board] && g.stations[alight] ? rideArc(line, board, alight)?.arc ?? null : null;
}

/** A rider's `transit` event (lane T: the ridden vehicle's arrive / approach carry the `station`). */
export function onTransit(e: TransitEvent, now = clock()) {
  if (e.kind !== 'bus' && e.kind !== 'light-rail') return;
  // narration: the loop's approach / arrive, the Metro's board / approach / arrive (once per outing: NARRATION_REPEAT)
  const say = transitSay(e);
  if (say) pacer.offer(say, now);
  if (e.real === false || travelActive()) return;
  const done = game.get().goalsDone;
  if (e.kind === 'bus' && e.line === LOOP_LINE && e.what === 'arrive' && e.station) {
    const ids = loopStopReached(done, e.station);
    if (ids.length) markGoalsDone(ids);
  }
  if (e.kind === 'light-rail') {
    if (e.what === 'board' && e.station) metroRide = { line: e.line, board: e.station, stops: 0 };
    else if (e.what === 'arrive' && e.station && metroRide && metroRide.line === e.line) {
      metroRide.stops++;
      if (!done.includes(CITY_GOAL.metro) && metroRideCounts(e.line, metroRide.board, e.station, metroArc(e.line, metroRide.board, e.station), metroRide.stops)) markGoalsDone([CITY_GOAL.metro]);
    }
  }
}

/** The loop stops between two stops (after `from`, up to `to` included), for a ride lane T finishes with 直接到站. */
export function loopStopsBetween(from: string, to: string): string[] {
  const g = TOUR_GEO[LOOP_LINE];
  const a = g?.stations[from], b = g?.stations[to];
  if (!g || !a || !b) return [];
  const arc = ((b.at - a.at) % g.length + g.length) % g.length;
  return Object.entries(g.stations).filter(([, s]) => { const d = ((s.at - a.at) % g.length + g.length) % g.length; return d > 0 && d <= arc; }).map(([id]) => id);
}
/**
 * Lane T's `countRide` for a sightseeing-bus ride it finished with 直接到站 (the stops passed under the veil raise
 * no `arrive`): every loop stop of the ride counts (plan §3.6: 直接到站 counts, fast travel does not).
 */
export function noteLoopRide(from: string, to: string) {
  let done = game.get().goalsDone;
  const fresh: string[] = [];
  for (const id of loopStopsBetween(from, to)) { const ids = loopStopReached(done, id); fresh.push(...ids); done = [...done, ...ids]; }
  if (fresh.length) markGoalsDone(fresh);
}

// ---------------------------------------------------------------------------------------------------------------
// Arrival moments
// ---------------------------------------------------------------------------------------------------------------

const POSTCARD_NEAR = 60;
let watcher: ArrivalWatcher | null = null;
let hoppedOffAt: number | undefined;
let arrivalClear: ReturnType<typeof setTimeout> | null = null;

/** The attraction ids arrived at so far (lane P's map "arrived" tick): the save's, then this visit's. */
export const arrivalSeen = (attraction: string): boolean => watcher?.hasSeen(attraction) ?? (readSave()?.arrivals ?? []).includes(attraction);

/** Apply an arrival hit to the game (exported for tests: `hit` from the watcher). */
export function applyArrival(hit: ArrivalHit, now = performance.now()) {
  emit(hit.event);
  const s = game.get();
  const a = hit.anchor;
  const postcardNear = CITY_POSTCARDS.some(c => !s.postcards.includes(c.id) && Math.hypot(c.position.x - a.x, c.position.z - a.z) <= POSTCARD_NEAR);
  const beats = arrivalBeats(hit, { reducedMotion: s.settings.reducedMotion, qualityLow: s.settings.quality === 'low', postcardNear });
  // the moment on screen (lane G's toast / card / reveal / panorama tags read flow.arrival)
  if (beats.toast || beats.peek || beats.reveal || beats.panorama) {
    flow.set({ arrival: { ...beats, attraction: a.attraction, place: a.place } });
    noteArrivalMoment(now);
    if (arrivalClear) clearTimeout(arrivalClear);
    const mine = flow.get().arrival;
    arrivalClear = setTimeout(() => { if (flow.get().arrival === mine) flow.set({ arrival: null }); }, ARRIVAL_CARD_MS + 500);
  }
  for (const line of arrivalPaced(beats, a.attraction)) offerPaced(line);
  if (beats.stampSound) emit({ type: 'stamp' });
  // wave 5 (W5-C4): the first arrival at an attraction is paid once by lane E's ledger (T1 10 · T2 5 · T3 3)
  if (hit.first) rewardArrival(a.attraction, a.rank);
  // wave 5 (W5-C2): Coit Tower or any panorama viewpoint meets the pelican (the moment waits for this one to end)
  if (unlocksAt(hit)) unlockPelican('viewpoint', now);
  // discovered (fast travel unlocked), when the arrival anchor lies beyond the 12 u discovery ring of its place
  const place = placeIndex()?.get(a.place);
  if (place && !isDiscovered(place.id)) markDiscovered(place);
  const campus = campusArrived(s.goalsDone, a.attraction);
  if (campus.length) markGoalsDone(campus);
  if (hit.first || hit.panorama) patchSave(sv => { sv.arrivals = watcher?.seen() ?? sv.arrivals; });
}

/** Lane N's request: the time of a trip BAYBAY carries you on (auto-travel) over a straight distance d (u). */
export const carriedTime = (d: number) => timeLabel(autoTravelSeconds(d * STREET_FACTOR));

/** Wave 5 (W5-C3): a resumed player reappears where they were: no arrival moment for standing there (game/arrival.ts settle). */
export const settleArrivals = (x = runtime.player.x, z = runtime.player.z): number => watcher?.settle(x, z) ?? 0;

function stepArrivals(now: number) {
  if (!watcher) return;
  const s = game.get(), f = flow.get();
  if (s.phase !== 'playing') return;
  const mode = s.move.mode;
  const hit = watcher.step({
    x: runtime.player.x, z: runtime.player.z, now,
    onFoot: mode === 'foot' || mode === 'photo' || mode === 'sit',
    hoppedOffAt,
    busy: dialogueOpen() || !!s.panel.kind || cinemaActive() || !!f.cinematic || !!f.postcardReward || !!f.postcardFly,
    travelling: travelActive(),
  });
  if (hit) applyArrival(hit, now);
}

// ---------------------------------------------------------------------------------------------------------------
// Goal targets and the planner's goal rules
// ---------------------------------------------------------------------------------------------------------------

/** Soft waypoints for the wave-4 goals: the nearest loop stops, Metro stations (lane T's) and unvisited campuses. */
export function rideGoalTargets(goalsDone: readonly string[] = game.get().goalsDone): GoalTarget[] {
  const out: GoalTarget[] = [];
  const stations = interactables().filter(it => it.source === 'transit');
  if (!goalsDone.includes(CITY_GOAL.sightseeing)) {
    for (const it of stations) if (it.id.startsWith('transit-loop-')) out.push({ id: it.id, goal: CITY_GOAL.sightseeing, x: it.x, z: it.z, name: { zh: `观光巴士 · ${it.name.zh}`, en: `Sightseeing bus · ${it.name.en}` }, radius: it.radius });
  }
  if (!goalsDone.includes(CITY_GOAL.metro)) {
    for (const it of stations) if (it.id.startsWith('transit-muni-')) out.push({ id: it.id, goal: CITY_GOAL.metro, x: it.x, z: it.z, name: { zh: `坐地铁 · ${it.name.zh}`, en: `Metro · ${it.name.en}` }, radius: it.radius });
  }
  if (!goalsDone.includes(CITY_GOAL.campuses)) {
    for (const id of CAMPUS_IDS) {
      if (goalsDone.includes(`campus:${id}`)) continue;
      const a = ATTRACTIONS.find(x => x.id === id);
      if (a) { const p = a.arrival ?? a; out.push({ id: `place:${a.placeId ?? a.id}`, goal: CITY_GOAL.campuses, x: p.x, z: p.z, name: { zh: `大学巡礼 · ${a.short?.zh ?? a.name.zh}`, en: `Campus tour · ${a.short?.en ?? a.name.en}` }, radius: 12 }); }
    }
  }
  return out;
}

const TWIN_PEAKS_PLACE = ATTRACTIONS.find(a => a.id === 'twin-peaks')?.placeId ?? 'twin-peaks';

/** The open goals as lane G's planner rules (TripOptions marks the row that completes one; 推荐 may prefer it). */
export function openGoalRules(goalsDone: readonly string[] = game.get().goalsDone): TripGoalRule[] {
  const open = (id: string) => !goalsDone.includes(id);
  const rules: TripGoalRule[] = [];
  if (open(CITY_GOAL.cableCar)) rules.push(cableCarGoalRule(CITY_GOAL.cableCar));
  if (open(CITY_GOAL.twinPeaks)) rules.push(arriveYourselfGoalRule(CITY_GOAL.twinPeaks, [TWIN_PEAKS_PLACE, 'twin-peaks'], { zh: '顺便完成爬双峰目标', en: 'Also completes the Twin Peaks climb' }));
  if (open(CITY_GOAL.metro)) rules.push(lineRideGoalRule(CITY_GOAL.metro, ['n-judah', 'm-ocean-view'], { zh: '顺便完成坐地铁目标', en: 'Also completes the Metro goal' }, { minLength: 150, alightAt: ['muni-judah-la-playa', 'muni-19th-winston', 'muni-19th-holloway'] }));
  if (open(CITY_GOAL.sightseeing)) {
    const left = Math.max(1, SIGHTSEEING_STOPS - loopStopsReached(goalsDone));
    rules.push(lineRideGoalRule(CITY_GOAL.sightseeing, [LOOP_LINE], { zh: '顺便完成观光巴士目标', en: 'Also completes the sightseeing-bus goal' }, { minLength: 0, minStops: left }));
  }
  return rules;
}

// ---------------------------------------------------------------------------------------------------------------
// Wave 5 (W5-C1): 听说… — BAYBAY tells a rumour from the registered sources (game/rumours.ts; lane D's eggs first)
// ---------------------------------------------------------------------------------------------------------------

/** A source with nothing to say now is asked again after this long (ms), not every second. */
export const RUMOUR_ASK_MS = 20_000;
/** BAYBAY tells it only when she is this close (u): a hint is whispered, not shouted across a plaza. */
export const RUMOUR_NEAR = 10;
/** the teller's state: when play began, the last rumour told, the last time the sources were asked, told ids */
export const rumours = { start: 0, last: null as number | null, askAt: 0, n: 0, told: new Set<string>() };

/** Free roam, on foot, BAYBAY beside you and quiet: may a rumour be told now? (pure over the running state) */
function rumourMoment(now: number): boolean {
  const s = game.get(), f = flow.get(), p = runtime.player, g = runtime.guide;
  return s.phase === 'playing' && s.mode === 'free' && !s.tour.active && !f.trip && !f.freeLead && s.move.mode === 'foot' && !s.paused && !s.photoMode
    && !dialogueOpen() && s.panel.kind === null && !cinemaActive() && !f.cinematic && !f.bubble && !f.arrival && !f.postcardReward && !f.postcardFly
    && !goalsStepOpen() && !baybayHeld() && !linesBusy(now / 1000) && performance.now() >= f.quietUntil && Math.hypot(g.x - p.x, g.z - p.z) <= RUMOUR_NEAR;
}

/** 1 Hz: tell at most one rumour per RUMOUR_GAP_MS (never in the first RUMOUR_FIRST_MS of play). */
export function stepRumours(now: number): boolean {
  const s = game.get();
  if (!rumours.start) { if (s.phase === 'playing' && s.mode !== 'onboarding') rumours.start = now; return false; }
  if (!rumourSourceCount() || !rumourDue({ startedAt: rumours.start, lastAt: rumours.last, now }) || now - rumours.askAt < RUMOUR_ASK_MS || !rumourMoment(now)) return false;
  rumours.askAt = now;
  const r = pickRumour({ x: runtime.player.x, z: runtime.player.z, zone: s.area, now: bayNow(), told: rumours.told });
  if (!r) return false;
  if (!offerLine(frameRumour(r, rumours.n), 20)) return false;
  rumours.told.add(r.id);
  rumours.n++;
  rumours.last = now;
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------------------------

let booted = false;
/** City mode, once per page (game/cityContent.ts); returns the disposer. */
export function initCityMoments(): () => void {
  if (booted) return () => {};
  booted = true;
  watcher = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS), decodeArrivalSeen(readSave()?.arrivals));
  const offPelican = initPelicanFirst((line, ttl) => offerLine(line, ttl), speakRecorded);
  let accA = 0, accP = 0, accR = 0, riding = false;
  const offFrame = registerFrameSystem('c-moments', (dt, now) => {
    // hopping off transit counts as arriving on foot for a moment (the ride's end is a hop-off)
    const onRide = !!flow.get().ride;
    if (riding && !onRide) hoppedOffAt = now;
    riding = onRide;
    if ((accP += dt) >= 0.2) { accP = 0; stepPacer(now / 1000); }
    if ((accA += dt) >= 0.25) { accA = 0; stepArrivals(now); stepPelican(now, (line, ttl) => offerLine(line, ttl)); }
    if ((accR += dt) >= 1) { accR = 0; stepRumours(now); }
  });
  const offEvents = onEvent(e => {
    if (e.type === 'transit') onTransit(e);
    else if (e.type === 'vehicle:exit') hoppedOffAt = performance.now();
    // lane N's request (W5-N5): a flight's landing is a hop-off for the grace window — its own descent beat, never the
    // 2.4 s on-foot reveal on top (plan MF4)
    else if (e.type === 'travel' && e.what === 'land') hoppedOffAt = performance.now();
  });
  const offTargets = registerGoalTargets('c-rides', () => rideGoalTargets());
  const offRules = registerTripGoals('c-goals', () => openGoalRules());
  // Settings → reset progress (verify F5): the stamps start over, so the next arrival is a first one again
  const offCleared = onSaveCleared(() => {
    watcher = new ArrivalWatcher(arrivalAnchors(ATTRACTIONS));
    metroRide = null; lastSaid = null; hoppedOffAt = undefined; pacer.clear();
  });
  rumours.start = 0; rumours.last = null; rumours.askAt = 0;
  // DEV / QA: lane C's city modules as `__opusBay.c` (the tour, the trips, the moments)
  let offDev = () => {};
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const w = window as unknown as { __opusBay?: Record<string, unknown> };
    const api = {
      moments: { offerLine, onTransit, applyArrival, arrivalSeen, sayTunnel, noteLoopRide, openGoalRules, rideGoalTargets, watcher: () => watcher },
      trips: () => importRetry(() => import('./tripRun')), tour: () => importRetry(() => import('./cityTour')),
      // wave 5 (W5-C1 / C2): the pelican moment and the rumour teller, for QA scripts
      pelican: { unlock: unlockPelican }, rumours: { state: rumours, step: stepRumours },
    };
    const put = () => { if (w.__opusBay && w.__opusBay.c !== api) w.__opusBay.c = api; else if (!w.__opusBay) w.__opusBay = { c: api }; };
    put();
    const id = window.setInterval(put, 500);
    offDev = () => window.clearInterval(id);
  }
  return () => {
    offFrame(); offEvents(); offTargets(); offRules(); offDev(); offCleared(); offPelican();
    if (arrivalClear) clearTimeout(arrivalClear);
    watcher = null; metroRide = null; pacer.clear(); booted = false;
  };
}
