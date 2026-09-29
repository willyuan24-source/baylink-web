import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { DEFAULT_TOUR_ID, game, toast, tourIdOf, type PanelKind, type Toast } from '../core/store';
import type { Bilingual, DialogueAction, DialogueChoice, DialogueNode, PoiDef, TourStop, Vec2, WishItem } from '../core/types';
import { canStand, heightAt, isWater, nearestWalkable } from '../core/terrain';
import { spawnFx } from '../world/fx';
import { getCatalog, isExpired, loadCatalog, recommendEvents, todayInBay, weekday } from '../data/catalog';
import { DISTRICT } from '../data/district';
import { POIS } from '../data/pois';
import { POSTCARDS, activePostcardCount, activePostcardTotal, allPostcardsFound } from '../data/postcards';
import { FREE_GOALS, NODES, START_NODE, STOP_PROMPTS } from '../data/script';
import { FIRST_TOUR } from '../data/tours';
import { readSave } from '../data/save';
import { GRAND_TOUR } from '../data/sf/copy';
import { CITY_GOAL, GOALS_STEP_ID, GOALS_STEP_SEEN } from '../data/sf/goals';
import { zoneName, SF_NAME } from '../data/cityZones';
import { districtTourProgress, markProgress, progressExtras, wishlist } from '../data/wishlist';
import { cinemaActive, faceCameraToward, holdFraming, playShots, releaseFraming, skipCinema, type Framing, type Shot } from './cinema';
import { CHAR_SCALE } from '../actors/dims';
import { bark, hook, hookText, nodeText, npcLine, subjectFact } from './content';
import { flow, initialFlowState, type Bubble } from './flowStore';
import { deriveLock, setLockRefresher } from './playerLock';
import { BAYBAY_ID, NPC_POSTS, interactableById, interactables, poiById, postcardById, registerPrefixResolver, subjectPosition, type Interactable, type InteractableSource } from './interactables';
import { endRide } from './ride';
import { baybayLine, carriedTimeLabel, goalTargets, initCityContent, settleArrivals, speakRecorded, unlockPelican } from './cityContent';
import { RESIDENTS, asideMark, residentByKey, taskState } from '../data/sf/residents';
import { boardFrom, initTransit, openRideNode } from './transit';
import { bayTimeOfDay } from './qa';
import { bayNow } from './bayNow';
import { PELICAN_TARGET } from './cityGoals';
import { gameTimeLabel } from './travel';
import type { TripOption, TripSource } from './tripTypes';
import { bindJournalOpener, openOverlay, openOverlays, overlays, runAskItem, visibleAskItems } from '../ui/slots';
import { rewardGoal, rewardPostcard } from './rewards';
import { resetWelcome, runWelcome, type WelcomeInfo, type WelcomeKind } from './welcome';

/**
 * Game flow controller: modes, dialogue runner, tour/week/free logic, interactions and goals.
 * Framework-free; DOM UI and Canvas systems call into it. Per-frame work lives in Systems.tsx.
 *
 * Wave 5 · lane C · W5-C1 — the PUBLIC content API for the other lanes (import from the lazy chunks; this module is in
 * the main graph, so it adds nothing to them):
 *
 *   bubble(text, ms = 3200, who = BAYBAY_ID, tone = 'bark')
 *       BAYBAY's (or a resident's, `who` = their id) speech bubble, right now. Dropped while a postcard reward is up and
 *       while the goals step is open; a later bubble replaces it. For a line that must not talk over BAYBAY's tour /
 *       transit / arrival lines, use cityContent `baybayLine(text, { ttl })` (her pacer: it waits its turn, and is
 *       dropped after `ttl` s rather than said late). zh ≤ 45 characters.
 *   markGoalsDone(ids, { quiet }?)
 *       Tick goalsDone ids (a FREE_GOALS goal, or a mark like `hood:<id>` / `loop:<stop>`); an id already done is
 *       ignored. A FREE_GOALS id also gets the `goal` event, the gold 目标完成 toast (not with `quiet`) and, in city
 *       mode, lane E's `reward goal:<id>` (game/rewards.ts).
 *   completeGoal(key)            a GoalKey ('cable-car', 'ferry', …) and the goals whose ids contain its words
 *   game/welcome.ts              onWelcome(fn): 'new' after the welcome choice, 'returning' when a saved player resumes
 *   game/rumours.ts              registerRumourSource(fn): 听说… hints BAYBAY drops (≤ 1 per 5 min, lane C's timing)
 *   game/photoFrames.ts          registerFrameDecorator(id, draw): paint on the photo card (lane E's frames)
 */

export const say = (zh: string, en: string, tone: Toast['tone'] = 'info', ms?: number) => toast({ zh, en }, tone, ms);

/** The screen-reader line (ui/Floating LiveRegion resolves it in the current language: it follows a language switch). */
export function announce(text: Bilingual | string) { flow.set({ announce: text }); }

// ---------------------------------------------------------------------------
// Speech bubbles
// ---------------------------------------------------------------------------

let bubbleKey = 0;
let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
export function bubble(text: Bilingual, ms = 3200, who = BAYBAY_ID, tone: Bubble['tone'] = 'bark') {
  // nothing talks over a postcard reward, nor over the goals step (W5-C3: bubbles paused while it is open)
  if (flow.get().postcardReward || flow.get().postcardFly || goalsStepOpen()) return;
  const key = ++bubbleKey;
  flow.set({ bubble: { who, text, key, tone } });
  if (bubbleTimer) clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => { if (flow.get().bubble?.key === key) flow.set({ bubble: null }); }, ms);
}

// ---------------------------------------------------------------------------
// Player helpers
// ---------------------------------------------------------------------------

/**
 * Movement is frozen while a dialogue, fishing, a ride or a non-playing phase is on, or anything holds game/playerLock
 * (a 飞过去 trip, a camera sequence, the lanes' activities / shop / camera beats). W5-F1: the lock is derived there
 * (playerLock deriveLock, also every frame from Systems.tsx); this derives it at once after a change here.
 */
export function refreshLock() {
  deriveLock();
}
setLockRefresher(refreshLock);

export function teleportPlayer(p: Vec2, heading?: number) {
  runtime.player.x = p.x;
  runtime.player.z = p.z;
  runtime.player.y = heightAt(p.x, p.z);
  if (heading !== undefined) runtime.player.heading = heading;
  runtime.player.pathTarget = null;
  runtime.player.pendingInteract = null;
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
export const playerPos = (): Vec2 => ({ x: runtime.player.x, z: runtime.player.z });

/** Walk (auto-path) to a point; optionally interact on arrival. */
export function walkTo(p: Vec2, interactId: string | null = null) {
  runtime.player.pathTarget = { x: p.x, z: p.z };
  runtime.player.pendingInteract = interactId;
}

// ---------------------------------------------------------------------------
// Dialogue runner
// ---------------------------------------------------------------------------

const dynamicNodes = new Map<string, DialogueNode>();
let lastDialogueEmote = 'none';
let afterDialogue: (() => void) | null = null;

export const nodeById = (id: string | null | undefined): DialogueNode | undefined => (id ? dynamicNodes.get(id) ?? NODES[id] : undefined);
export const dialogueOpen = () => !!game.get().dialogue.nodeId;

function openNode(nodeId: string) {
  if (nodeId.startsWith('flow.goto.')) { closeQuiet(); startFreeLead(nodeId.slice('flow.goto.'.length)); return; }
  if (nodeId.startsWith('flow.ride.')) {
    // transit nodes belong to game/transit.ts (lane F): today `flow.ride.<fromStop>><toStop>`
    closeQuiet();
    openRideNode(nodeId.slice('flow.ride.'.length));
    return;
  }
  const node = nodeById(nodeId);
  if (!node) { closeDialogue(); return; }
  game.set({ dialogue: { nodeId } });
  refreshLock();
  emit({ type: 'dialogue', speaker: node.speaker, nodeId });
  if (node.speaker === 'baybay' && node.mood) {
    const emote = node.mood === 'wave' ? 'wave' : node.mood === 'point' ? 'point' : node.mood === 'excited' ? 'hop' : node.mood === 'thinking' ? 'think' : node.mood === 'proud' ? 'clap' : 'none';
    runtime.guide.emote = emote;
    // one emote sound per change, not per bubble
    if (emote !== lastDialogueEmote && emote !== 'none') emit({ type: 'emote', who: 'baybay', emote });
    lastDialogueEmote = emote;
  }
  announce(node.text);
}

/** Open a dialogue; `then` runs when it closes without handing control to another flow. */
export function playDialogue(nodeId: string | undefined, then?: () => void, framing?: Framing | null) {
  if (!nodeId || !nodeById(nodeId)) { then?.(); return; }
  flow.set({ bubble: null });
  afterDialogue = then ?? null;
  if (framing) holdDialogueFraming(framing);
  openNode(nodeId);
}

// --- C1 framing held for the length of a dialogue (welcome, tour stops): released when the dialogue closes.
// bottomCover is left open on purpose: the card grows when its choices appear after the typewriter, so the camera
// keeps re-measuring it (measureBottomCover, C1 defaults 0.30 / 0.42) instead of freezing a first-frame value.
let dialogueFramingToken = 0;
function holdDialogueFraming(framing: Framing) {
  dialogueFramingToken = holdFraming(framing);
}
function releaseDialogueFraming() {
  if (!dialogueFramingToken) return;
  releaseFraming(dialogueFramingToken);
  dialogueFramingToken = 0;
}

/**
 * The open dialogue box registers how a generic "confirm" (gamepad A / action button) should act on it:
 * finish the typewriter, pick the focused choice, or advance. Without a box, confirm just advances.
 */
let dialogueConfirm: (() => void) | null = null;
export function setDialogueConfirm(fn: (() => void) | null) { dialogueConfirm = fn; }

/** Register a generated node (call menu, NPC lines, …). */
export function defineNode(node: DialogueNode) { dynamicNodes.set(node.id, node); return node.id; }

export function advanceDialogue() {
  const node = nodeById(game.get().dialogue.nodeId);
  if (!node) return;
  if (node.choices?.length) return;
  finishNode(node.action, node.next);
}

export function chooseDialogue(index: number) {
  const node = nodeById(game.get().dialogue.nodeId);
  const choice = node?.choices?.[index];
  if (!choice) return;
  emit({ type: 'choice' });
  finishNode(choice.action, choice.next);
}

function finishNode(action: DialogueAction | undefined, next: string | undefined) {
  const before = game.get().dialogue.nodeId;
  const pendingBefore = afterDialogue;
  if (action) runAction(action);
  const now = game.get().dialogue.nodeId;
  if (now !== before || afterDialogue !== pendingBefore) return; // the action took over
  if (!now) return;
  if (next && (nodeById(next) || next.startsWith('flow.ride.') || next.startsWith('flow.goto.'))) openNode(next);
  else closeDialogue();
}

export function closeDialogue() {
  if (!game.get().dialogue.nodeId) return;
  releaseDialogueFraming();
  game.set({ dialogue: { nodeId: null } });
  refreshLock();
  lastDialogueEmote = 'none';
  if (runtime.guide.emote !== 'none') runtime.guide.emote = 'none';
  const then = afterDialogue;
  afterDialogue = null;
  then?.();
}

export function runAction(action: DialogueAction) {
  // wave 5 (W5-C1 / W5-C3): the welcome's choice tells game/welcome.ts' listeners (city mode)
  const welcoming = game.get().mode === 'onboarding';
  switch (action.type) {
    case 'start-tour': closeQuiet(); startTour(action.tourId); offerRealTime(); if (welcoming) welcomed('tour'); break;
    case 'start-week': closeQuiet(); startWeek(); offerRealTime(); if (welcoming) welcomed('week'); break;
    case 'free-roam': closeQuiet(); startFree(); facePlaza(); offerRealTime(); if (welcoming) welcomed('free'); break;
    case 'skip-intro': closeQuiet(); startFree({ local: true }); facePlaza(); offerRealTime(); if (welcoming) welcomed('local'); break;
    case 'set-week-pref': setWeekPref(action.key, action.value); break;
    case 'show-week-results': closeQuiet(); void showWeekResults(); break;
    case 'open-map': closeQuiet(); openPanel('map'); break;
    case 'open-journal': closeQuiet(); openPanel('journal'); break;
    case 'open-poi': closeQuiet(); openPanel('poi', action.poiId); break;
    case 'tour-next': closeQuiet(); tourNext(); break;
    case 'tour-end': closeQuiet(); endTour(); break;
    // wave 5: a lane's 问 BAYBAY item (ui/slots.ts registerAskItem)
    case 'ask': closeQuiet(); runAskItem(action.id); break;
    case 'end': closeDialogue(); break;
  }
}

/** Close the current dialogue without running its continuation (an action is taking over). */
function closeQuiet() {
  afterDialogue = null;
  releaseDialogueFraming();
  if (game.get().dialogue.nodeId) { game.set({ dialogue: { nodeId: null } }); refreshLock(); }
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

export function openPanel(kind: Exclude<PanelKind, null>, id?: string) {
  const panel = game.get().panel;
  if (panel.kind === kind && panel.id === id) return;
  const leavingTourCard = panel.kind === 'poi' && kind !== 'poi' && flow.get().tourPhase === 'card';
  game.set({ panel: { kind, id }, paused: kind === 'settings', photoMode: false });
  if (leavingTourCard) continueTour();
  emit({ type: 'ui', action: 'open' });
  if (kind === 'week' || kind === 'event' || kind === 'poi' || kind === 'map' || kind === 'recap') void loadCatalog();
}

export function closePanel() {
  const panel = game.get().panel;
  if (!panel.kind) return;
  game.set({ panel: { kind: null }, paused: false });
  flow.set({ eventId: null });
  emit({ type: 'ui', action: 'close' });
  if (panel.kind === 'poi' && flow.get().tourPhase === 'card') continueTour();
  // (the first lesson's "finished" flag: a city tour's recap is not the first lesson's)
  if (panel.kind === 'recap' && tourIdOf(game.get().tour) === DEFAULT_TOUR_ID) markProgress({ finished: true });
}

// wave 5 (ui/slots.ts openJournal): the Journal opens on a tab through the panel id
bindJournalOpener(tab => openPanel('journal', tab));

export function togglePanel(kind: Exclude<PanelKind, null>) {
  if (game.get().panel.kind === kind) closePanel(); else openPanel(kind);
}

export function openEvent(eventId: string) {
  flow.set({ eventId });
  openPanel('event', eventId);
}

// ---------------------------------------------------------------------------
// Start / arrival / modes
// ---------------------------------------------------------------------------

let introPendingSince = 0;
export const introPending = () => introPendingSince > 0;

const v3 = (p: Vec2, y: number, dx = 0, dz = 0): [number, number, number] => [p.x + dx, y, p.z + dz];

const FERRY_GATE = () => DISTRICT.anchors?.['ferry-gate'] ?? DISTRICT.spawn;

/** Ferry Building clock face as a world point (the welcome and stop-1 two-shots frame it behind BAYBAY). */
export function clockFacePoint(): [number, number, number] | null {
  const face = clockFace('ferry-building');
  return face ? [face.x, face.y, face.z] : null;
}

/**
 * Where BAYBAY waits for the welcome: 3.5u from the ferry gate toward the clock tower, so the tower rises behind
 * her in the two-shot. After a "replay the welcome" far from the gate: a step in front of the player.
 */
export function welcomeMark(): Vec2 {
  const p = runtime.player, gate = FERRY_GATE();
  const face = clockFace('ferry-building');
  if (face && dist(playerPos(), gate) < 8) return welcomeMarkFrom(p, face);
  return { x: p.x + Math.sin(p.heading) * 2.6, z: p.z + Math.cos(p.heading) * 2.6 };
}

/**
 * 3.2u from the player toward the tower, turned ~40° off the player→tower line (so the camera, on the tower→BAYBAY
 * line, sees her beside the player rather than behind them), on the side away from the water when both stand.
 */
function welcomeMarkFrom(from: Vec2, face: { x: number; z: number }): Vec2 {
  const d = Math.hypot(face.x - from.x, face.z - from.z) || 1;
  const ux = (face.x - from.x) / d, uz = (face.z - from.z) / d;
  const at = (a: number) => ({ x: from.x + (ux * Math.cos(a) - uz * Math.sin(a)) * 3.2, z: from.z + (ux * Math.sin(a) + uz * Math.cos(a)) * 3.2 });
  const dock = DISTRICT.ferryDock;
  const options = [at(0.7), at(-0.7)]
    .filter(p => canStand(p.x, p.z, 0.45))
    .sort((a, b) => Math.hypot(b.x - dock.x, b.z - dock.z) - Math.hypot(a.x - dock.x, a.z - dock.z));
  return options[0] ?? { x: from.x + ux * 3.2, z: from.z + uz * 3.2 };
}

/** The welcome two-shot: BAYBAY + you, the clock tower rising behind her (when it is nearby). */
function welcomeFraming(): Framing {
  const face = clockFacePoint();
  const near = !!face && Math.hypot(face[0] - runtime.player.x, face[2] - runtime.player.z) < 45;
  return { kind: 'two-shot', subject: near ? face : null };
}

/** Title → arrival cinematic (the ferry, then a crane down the clock tower into the welcome two-shot) → welcome. */
export function startGame() {
  if (game.get().phase !== 'title') return;
  // The Enter/Space that pressed Start may also reach actors' input as an interact edge next frame;
  // swallow it so it does not immediately skip the arrival cinematic.
  noteInteractHandled();
  // wave 5 (W5-C3): who is being welcomed, read before this visit writes anything (the welcome marks `visited`)
  startKind = hasProgress() ? 'returning' : 'new';
  emit({ type: 'start' });
  game.set({ phase: 'arrival' });
  const spawn = FERRY_GATE();
  teleportPlayer(spawn, DISTRICT.spawn.heading);
  emit({ type: 'foghorn' });
  setTimeout(() => emit({ type: 'gull' }), 900);
  playShots('arrival', arrivalShots(), () => beginPlaying());
}

/**
 * 1) from the Bay: the ferry at the terminal and the whole clock tower (cupola included) in frame;
 * 2) glide up to the clock face; 3) crane down the tower into the welcome two-shot (BAYBAY in front of the tower).
 */
export function arrivalShots(): Shot[] {
  const spawn = FERRY_GATE();
  const dock = DISTRICT.ferryDock;
  const face = clockFace('ferry-building');
  const caption = { zh: '旧金山 · 渡轮大厦码头', en: 'San Francisco · Ferry Building terminal' };
  if (!face) {
    const toBay = { x: dock.x - spawn.x, z: dock.z - spawn.z };
    const len = Math.hypot(toBay.x, toBay.z) || 1;
    const nx = toBay.x / len, nz = toBay.z / len;
    return [
      { position: v3(dock, 16, nx * 55 + nz * 22, nz * 55 - nx * 22), target: v3(dock, 8, -nx * 6, -nz * 6), duration: 0.05, hold: 1.2, caption },
      { position: v3(dock, 11, nx * 20 - nz * 10, nz * 20 + nx * 10), target: v3(spawn, 1.5), duration: 2.4, hold: 0.25 },
    ];
  }
  // wide: stand off in the Bay so the tower (top ≈ 30u) and the ferry both fit, looking between them
  const mid = { x: (dock.x + face.x) / 2, z: (dock.z + face.z) / 2 };
  const out = { x: mid.x - face.x, z: mid.z - face.z };
  const ol = Math.hypot(out.x, out.z) || 1;
  const bay = { x: out.x / ol, z: out.z / ol }; // from the tower out toward the dock / the Bay
  const wide: Shot = {
    position: [mid.x + bay.x * 52 + bay.z * 18, 15, mid.z + bay.z * 52 - bay.x * 18],
    target: [mid.x, 11, mid.z],
    duration: 0.05, hold: 1.25, caption,
  };
  // the welcome two-shot pose (approximates the camera's C1 two-shot: on the tower → BAYBAY line, past the pair)
  const mark = welcomeMarkFrom(spawn, face);
  const pair = { x: (spawn.x + mark.x) / 2, z: (spawn.z + mark.z) / 2 };
  const toMark = { x: mark.x - face.x, z: mark.z - face.z };
  const tl = Math.hypot(toMark.x, toMark.z) || 1;
  const dx = toMark.x / tl, dz = toMark.z / tl;
  const along = (pair.x - mark.x) * dx + (pair.z - mark.z) * dz + 10;
  const cam: [number, number, number] = [mark.x + dx * along, 2.4 * CHAR_SCALE, mark.z + dz * along];
  const look: [number, number, number] = [mark.x - dx * 6, 7, mark.z - dz * 6];
  // crane start: level with the clock face, in front of it on the plaza side of the pair
  const craneTop: [number, number, number] = [mark.x + dx * 4, face.y + 2, mark.z + dz * 4];
  return [
    wide,
    { position: craneTop, target: [face.x, face.y, face.z], duration: 1.5, hold: 0.25, caption: { zh: '渡轮大厦钟楼 · 1898 年启用', en: 'Ferry Building clock tower · since 1898' } },
    { position: cam, target: look, duration: 1.8, hold: 0.15, caption: null },
  ];
}

export function skipArrival() { skipCinema(); }

/** Enter the playable state. `start` comes from ?start= (skips the intro dialogue). */
export function beginPlaying(start?: 'tour' | 'week' | 'free' | 'local') {
  game.set({ phase: 'playing' });
  refreshLock();
  void loadCatalog();
  if (!start) {
    introPendingSince = performance.now();
    // keep the arrival's closing composition: the welcome two-shot is held until the choice is made
    holdDialogueFraming(welcomeFraming());
    return;
  }
  introPendingSince = 0;
  if (start === 'tour') startTour();
  else if (start === 'week') startWeek();
  // (lane N's resume — game/resume.ts, the title's 继续 — starts here: a city player with progress is welcomed back)
  else if (start === 'local') { startFree({ local: true, back: game.get().worldMode === 'city' && hasProgress() }); facePlaza(); }
  else { startFree(); facePlaza(); }
}

// ---------------------------------------------------------------------------
// Wave 5 · lane C · W5-C1 / W5-C3: the welcome (new / returning) and the goals step
// ---------------------------------------------------------------------------

/** 'new' or 'returning', read at the title's Start (before this visit writes progress). */
let startKind: WelcomeKind = 'new';

/** The player has played before: progress v1 (the welcome seen, cards, goals, a tour) or a save v2 in the city. */
export function hasProgress(): boolean {
  const s = game.get(), sv = readSave();
  return progressExtras().visited === true || s.postcards.length > 0 || s.goalsDone.length > 0 || s.tour.completed.length > 0
    || sv?.lastSafe?.world === 'city' || (sv?.arrivals?.length ?? 0) > 0 || !!sv?.unlocked?.glide || !!sv?.play;
}

/** The welcome's choice (city): tell game/welcome.ts' listeners; a returning player hears a listener's line (lane R). */
function welcomed(choice: NonNullable<WelcomeInfo['choice']>) {
  if (game.get().worldMode !== 'city') return;
  const line = runWelcome({ kind: startKind, choice, zone: game.get().area, at: performance.now() });
  if (line && startKind === 'returning') baybayLine(line, { ttl: 60 });
}

/**
 * 欢迎回来 (plan MF6): a returning city player resumed where they were (lane N's resume). BAYBAY names the area they got
 * to (save v2 lastSafe.zone, else where they stand) and then one line from a welcome listener (lane R's SF Today), or,
 * with the pelican still to meet, goal #1. Never "第一次来吗？".
 */
export function welcomeBack(): void {
  // standing where they left off is not arriving there (no reveal or 抵达 toast over the welcome)
  settleArrivals();
  const zone = readSave()?.lastSafe?.zone ?? game.get().area ?? null;
  const name = zoneName(zone);
  const known = name !== SF_NAME && !!zone;
  bubble(known ? { zh: `欢迎回来！上次我们走到${name.zh}了。`, en: `Welcome back! Last time we got as far as ${name.en}.` } : WELCOME_BACK, 4400, BAYBAY_ID, 'call');
  if (!known) speakRecorded(W5_LINE_IDS.welcomeBack);
  const extra = runWelcome({ kind: 'returning', zone, at: performance.now() });
  const next = extra ?? (goalDone(CITY_GOAL.pelican) ? null : PELICAN_NUDGE);
  if (next) baybayLine(next, { ttl: 60, ...(next === PELICAN_NUDGE ? { id: W5_LINE_IDS.nudge } : {}) });
}

/**
 * W5-C6: the ids of lane C's frozen wave-5 lines said from this module (data/sf/linesW5.ts, which stays out of the main
 * graph: the texts here are the frozen texts, tested equal); their recorded clips play with the bubbles once lane V has
 * them (cityContent.speakRecorded / baybayLine `id`).
 */
export const W5_LINE_IDS = { nudge: 'w5c-pelican-nudge', freeAgain: 'w5c-free-again', welcomeBack: 'w5c-welcome-back' } as const;
/** 欢迎回来 when the area has no name. */
export const WELCOME_BACK: Bilingual = { zh: '欢迎回来！我们接着逛吧。', en: "Welcome back! Let's keep exploring." };

/** BAYBAY's goal #1 line or her "you lead" line as a bubble (with its clip once recorded). */
export function sayFreeLine(pelicanOpen: boolean, ms: number) {
  bubble(pelicanOpen ? PELICAN_NUDGE : FREE_AGAIN, ms, BAYBAY_ID, 'call');
  speakRecorded(pelicanOpen ? W5_LINE_IDS.nudge : W5_LINE_IDS.freeAgain);
}

/** BAYBAY's first free-roam suggestion while goal #1 is open (plan MF3). */
export const PELICAN_NUDGE: Bilingual = { zh: '先去科伊特塔找鹈鹕朋友吧！之后想去哪都能飞～', en: "Let's meet the pelican at Coit Tower first — then we can fly anywhere!" };

/** The goals step is on screen (bubbles wait: plan MF6 "with bubbles paused"). */
export const goalsStepOpen = () => openOverlays().some(o => o.id === GOALS_STEP_ID);

/**
 * The goals step, once per player (city): opens the overlay game/goalsStep.ts registered and marks it seen. False when
 * it was seen already or is not registered (its chunk has not loaded: the old goals card shows instead).
 */
export function openGoalsStep(): boolean {
  if (game.get().worldMode !== 'city' || goalDone(GOALS_STEP_SEEN) || !overlays.get(GOALS_STEP_ID)) return false;
  markGoalsDone([GOALS_STEP_SEEN]);
  openOverlay(GOALS_STEP_ID);
  return true;
}

/** After the welcome (free / local): turn toward the Ferry plaza with the clock tower in view, not the gangway. */
export function facePlaza() {
  const face = clockFace('ferry-building');
  const p = runtime.player;
  if (!face || dist(playerPos(), FERRY_GATE()) > 8) return;
  p.heading = Math.atan2(face.x - p.x, face.z - p.z);
  faceCameraToward(face.x, face.z);
}

/** Called by the guide brain once BAYBAY has walked up to the welcome mark (or after a timeout). */
export function maybeStartIntro(guideDistance: number, atMark = true) {
  if (!introPendingSince) return;
  const waited = performance.now() - introPendingSince;
  if ((guideDistance < 4.6 && atMark && waited > 250) || waited > 3200) {
    introPendingSince = 0;
    markProgress({ visited: true });
    // the welcome two-shot (held since the arrival) stays for the whole welcome and is released on the choice
    playDialogue(START_NODE, () => { if (game.get().mode === 'onboarding') startFree({ quiet: true }); }, welcomeFraming());
  }
}

export function startFree(opts: { local?: boolean; quiet?: boolean; back?: boolean } = {}) {
  introPendingSince = 0;
  game.set(s => ({ mode: 'free', tour: { ...s.tour, active: false } }));
  const city = game.get().worldMode === 'city';
  const talk = !opts.local && !opts.quiet;
  // wave 5 (W5-C3, plan MF6): the city shows its goals ONCE, as a step (game/goalsStep.ts); after it, free roam starts
  // without a card (the pill opens the journal). If the step's chunk is not there, the old card stands in.
  const step = city && talk && openGoalsStep();
  const card = talk && (!city || (!step && !goalDone(GOALS_STEP_SEEN)));
  // "I'm a local": no goals card and no ambient chatter for a minute (F9)
  flow.set({ tourPhase: 'idle', weekStage: 'idle', awaitingPoi: null, goalsCard: card, quietUntil: opts.local ? performance.now() + 60000 : 0 });
  if (opts.back) welcomeBack();
  else if (opts.local) bubble(hookText('localIntro') ?? { zh: '欢迎回来！M 看地图，Q 随时叫我。', en: 'Welcome back! M opens the map, Q calls me anytime.' }, 4200);
  else if (step) return; // (the step carries BAYBAY's intro; her pelican line follows when it closes)
  else if (!opts.quiet && city && !card) sayFreeLine(!goalDone(CITY_GOAL.pelican), 4600);
  else if (!opts.quiet) bubble(hookText('freeIntro') ?? { zh: '我就跟在你后面～想问什么按 Q 叫我！', en: "I'll tag along — press Q whenever you need me!" }, 4200);
}
/** City free roam once the goals were shown (W5-C3): no "here are some goals" again. */
export const FREE_AGAIN: Bilingual = { zh: '好嘞，你带路，我跟着！想去哪儿就叫我～', en: "Okay — you lead, I'll follow! Call me when you want to go somewhere." };

// ---------------------------------------------------------------------------
// F11 · first visit at golden hour, the real Bay time one tap away
// ---------------------------------------------------------------------------

let timeOffered = false;
/** After the welcome choice on a first visit: offer the real Bay time (e.g. tonight's view) — this visit only. */
export function offerRealTime(now = bayNow()) {
  const f = flow.get();
  if (timeOffered || !f.goldenFirstVisit) return;
  timeOffered = true;
  const real = bayTimeOfDay(now);
  if (real === 'golden') { flow.set({ goldenFirstVisit: false }); return; } // it really is golden hour
  // (wave 5, W5-C3: after the goals step, never over it; its 10 s start when it shows)
  const show = () => {
    if (goalsStepOpen()) { setTimeout(show, 500); return; }
    if (flow.get().goldenFirstVisit) flow.set({ timeOffer: real });
    setTimeout(() => { if (flow.get().timeOffer === real) flow.set({ timeOffer: null }); }, 10000);
  };
  setTimeout(show, 1800);
}

/** [看夜景]: follow the real Bay clock for the rest of this visit (nothing is saved). */
export function acceptRealTime() {
  flow.set({ goldenFirstVisit: false, timeOffer: null });
  emit({ type: 'ui', action: 'select' });
}

// ---------------------------------------------------------------------------
// Tour
// ---------------------------------------------------------------------------

export const tourStops = (): TourStop[] => FIRST_TOUR.stops.filter(stop => !!poiById(stop.poiId));
/** The first lesson's current stop (null while a city tour owns `game.tour`: its stops are game/cityTour.ts'). */
export function currentStop(): { stop: TourStop; poi: PoiDef; index: number } | null {
  const { tour } = game.get();
  if (tourIdOf(tour) !== DEFAULT_TOUR_ID) return null;
  const stops = tourStops();
  const stop = stops[tour.stop];
  const poi = stop ? poiById(stop.poiId) : undefined;
  return stop && poi ? { stop, poi, index: tour.stop } : null;
}

/**
 * Wave 4 · lane C: tours other than the first lesson (the Grand Tour `sf-grand`) run in game/cityTour.ts, a lazy
 * module that registers itself here once loaded (city mode only); `game.tour.id` says which tour owns `game.tour`.
 */
export interface CityTourApi {
  start(id: string): void;
  /** 'tour-next' / the peek card's 下一站: on from the current sub-phase */
  next(): void;
  /** 跳过这一站 */
  skip(): void;
  /** 结束 (the recap when stops were done; `quiet`: no recap, no line — a restart) */
  end(quiet?: boolean): void;
  /** the call menu's tour rows while the tour runs */
  callChoices(): NonNullable<DialogueNode['choices']>;
  /** the objective pill's words (tourPill) */
  pill(): TourPill | null;
}

/**
 * What the objective pill shows for the running tour (lane G's Hud / TripPill): the tour's name, the progress dots
 * (the first lesson: its 7 stops; the Grand Tour: its 5 chapters), the next stop's name. Null without a tour.
 */
export interface TourPill { id: string; name: Bilingual; step: number; total: number; done: number; next: Bilingual | null }
export function tourPill(): TourPill | null {
  const s = game.get();
  if (!s.tour.active) return null;
  if (cityTourActive()) return cityTourApi?.pill() ?? null;
  const cur = currentStop(), total = tourStops().length;
  return { id: DEFAULT_TOUR_ID, name: FIRST_TOUR.name, step: Math.min(s.tour.stop + 1, total), total, done: s.tour.completed.length, next: cur?.poi.name ?? null };
}
let cityTourApi: CityTourApi | null = null;
export function setCityTourApi(api: CityTourApi | null) { cityTourApi = api; }
export const cityTourActive = () => { const t = game.get().tour; return t.active && tourIdOf(t) !== DEFAULT_TOUR_ID; };
function startCityTour(id: string) {
  if (cityTourApi) { cityTourApi.start(id); return; }
  void import('./cityTour').then(m => { m.initCityTour(); cityTourApi?.start(id); }, (e: unknown) => {
    if (import.meta.env?.DEV) console.error('[opus-bay city tour]', e);
    say('一日游还没准备好，稍后再试', 'The Grand Tour is not ready yet — try again in a moment');
  });
}

export function startTour(tourId?: string) {
  introPendingSince = 0;
  // the Grand Tour is a city tour (district mode keeps the first lesson whatever it is asked for)
  if (tourId && tourId !== DEFAULT_TOUR_ID && game.get().worldMode === 'city') { startCityTour(tourId); return; }
  endTrip();
  const stops = tourStops();
  if (!stops.length) { say('导览还在准备中，先自己逛逛吧！', 'The tour is still being prepared — explore on your own for now!'); startFree(); return; }
  // after a city tour `game.tour` holds that tour's stops: the first lesson resumes from its own saved progress
  const saved = tourIdOf(game.get().tour) === DEFAULT_TOUR_ID ? game.get().tour : { ...game.get().tour, ...districtTourProgress() };
  let completed = saved.completed.filter(id => stops.some(stop => stop.poiId === id));
  if (completed.length >= stops.length) completed = [];
  const firstOpen = stops.findIndex(stop => !completed.includes(stop.poiId));
  const stop = Math.max(0, firstOpen);
  const resume = completed.length > 0;
  game.set({ mode: 'tour', tour: { active: true, stop, completed }, panel: { kind: null }, paused: false });
  flow.set({ tourPhase: 'intro', weekStage: 'idle', goalsCard: false, awaitingPoi: null });
  if (resume) {
    flow.set({ tourPhase: 'leading' });
    const next = poiById(stops[stop].poiId);
    say(`接着上次：第 ${stop + 1} 站 ${next?.name.zh ?? ''}`, `Picking up where you left off: stop ${stop + 1}, ${next?.name.en ?? ''}`, 'info', 3200);
    bubble(hookText('tourResume') ?? { zh: '这边走，跟我来！', en: 'This way — follow me!' });
    return;
  }
  playDialogue(FIRST_TOUR.introNode, () => {
    if (flow.get().tourPhase === 'intro') { flow.set({ tourPhase: 'leading' }); leadBubble(); }
  });
}

let leadCallAt = -Infinity;
/** When BAYBAY last said "跟我来" (the brain keeps its "take your time" lines away from it). */
export const lastLeadCall = () => leadCallAt;

function leadBubble() {
  const cur = currentStop();
  if (!cur) return;
  leadCallAt = performance.now();
  bubble({ zh: `下一站：${cur.poi.name.zh}，跟我来！`, en: `Next stop: ${cur.poi.name.en}. Follow me!` }, 3400, BAYBAY_ID, 'call');
  announce({ zh: `下一站：${cur.poi.name.zh}`, en: `Next stop: ${cur.poi.name.en}` });
}

/**
 * What rises behind BAYBAY in a tour stop's two-shot (C1 subject): the clock tower, the stalls, open water past the
 * Pier 7 end, the Exploratorium facade, Coit Tower, the K-Dock sea lions.
 */
export function stopSubject(poi: PoiDef): [number, number, number] | null {
  const lm = poi.landmarkId ? DISTRICT.landmarks.find(item => item.id === poi.landmarkId) : undefined;
  const base = lm ? lm.baseY ?? heightAt(lm.position.x, lm.position.z) : 0;
  switch (poi.id) {
    case 'ferry-building': return clockFacePoint();
    case 'farmers-market': return lm ? [lm.position.x, base + 2.2, lm.position.z] : null;
    case 'pier7': return lm ? [lm.position.x + Math.sin(lm.rotationY) * 12, 1.5, lm.position.z + Math.cos(lm.rotationY) * 12] : null;
    case 'exploratorium': return lm ? [lm.position.x, base + 5, lm.position.z] : null;
    case 'filbert-steps': { const coit = DISTRICT.landmarks.find(item => item.kind === 'coit-tower'); return coit ? [coit.position.x, (coit.baseY ?? 20) + 12, coit.position.z] : null; }
    case 'coit-tower': return lm ? [lm.position.x, base + 12, lm.position.z] : null;
    case 'sea-lions': return lm ? [lm.position.x, 0.8, lm.position.z] : null;
    default: return lm ? [lm.position.x, base + 4, lm.position.z] : null;
  }
}
const stopFraming = (poi: PoiDef): Framing => ({ kind: 'two-shot', subject: stopSubject(poi) });

/**
 * F15 · where BAYBAY stands at a tour stop: 2.2u past the stop's focal point — toward its subject when it has one
 * (so the tower / sea lions rise behind her), else away from the player — facing the player.
 */
export function stageMark(poi: PoiDef, from: Vec2 = playerPos()): Vec2 {
  const f = poi.position;
  const subject = stopSubject(poi);
  let dx = subject ? subject[0] - f.x : f.x - from.x, dz = subject ? subject[2] - f.z : f.z - from.z;
  let len = Math.hypot(dx, dz);
  if (len < 0.5) { dx = f.x - from.x; dz = f.z - from.z; len = Math.hypot(dx, dz) || 1; }
  const want = { x: f.x + (dx / len) * 2.2, z: f.z + (dz / len) * 2.2 };
  if (canStand(want.x, want.z, 0.45)) return want;
  // blocked (a railing, the tower): try a little closer to the focal point, then the nearest walkable spot
  const near = { x: f.x + (dx / len) * 1.2, z: f.z + (dz / len) * 1.2 };
  if (canStand(near.x, near.z, 0.45)) return near;
  return nearestWalkable(want, 4) ?? { x: f.x, z: f.z };
}

/**
 * BAYBAY's spot beside the city resident you are chatting with, solved once per chat (resident and player spot). The
 * brain asks every 100 ms while a dialogue is open; a gap longer than ASIDE_CHAT_GAP means a new chat, solved again
 * from where she stands now (a mark kept from an earlier chat could be on the other side: she would cross in front).
 */
let aside: { key: string; x: number; z: number; mark: Vec2 | null; seen: number } | null = null;
const ASIDE_CHAT_GAP = 400;

/**
 * Wave 5 (CP-14): a lazy city module's own mark for the dialogue it opened — the pelican moment keeps BAYBAY beside
 * you so its two-shot frames you both (game/pelicanFirst.ts). Asked first; null = the usual rules below.
 */
let markSource: ((nodeId: string) => Vec2 | null) | null = null;
export function setTalkMarkSource(fn: ((nodeId: string) => Vec2 | null) | null) { markSource = fn; }

/** Where BAYBAY should hold still while the current dialogue plays (welcome mark, stage mark, beside a resident), or null. */
export function talkMark(): Vec2 | null {
  const s = game.get(), f = flow.get();
  if (s.dialogue.nodeId === START_NODE && game.get().mode === 'onboarding') return welcomeMark();
  const own = s.dialogue.nodeId && markSource ? markSource(s.dialogue.nodeId) : null;
  if (own) return own;
  if (s.tour.active && (f.tourPhase === 'arrived' || f.tourPhase === 'done-node')) { const cur = currentStop(); return cur ? stageMark(cur.poi) : null; }
  // a chat with one of the six city residents (nodes npc.<key>.…): she steps beside them, out of the two-shot's line
  const r = residentByKey(/^npc\.([a-z-]+)\./.exec(s.dialogue.nodeId ?? '')?.[1] ?? '');
  const p = playerPos();
  if (r && dist(p, r.at) < 7) {
    const now = performance.now();
    if (!aside || aside.key !== r.key || now - aside.seen > ASIDE_CHAT_GAP || Math.hypot(aside.x - p.x, aside.z - p.z) > 0.5) {
      aside = { key: r.key, x: p.x, z: p.z, mark: asideMark(p, r, { x: runtime.guide.x, z: runtime.guide.z }, (x, z) => canStand(x, z, 0.45)), seen: now };
    }
    aside.seen = now;
    return aside.mark;
  }
  return null;
}

/** Guide brain → both reached the stop. */
export function tourArrived() {
  const cur = currentStop();
  if (!cur || flow.get().tourPhase !== 'leading') return;
  flow.set({ tourPhase: 'arrived' });
  emit({ type: 'arrive', poiId: cur.poi.id });
  playDialogue(cur.stop.arriveNode, () => {
    if (flow.get().tourPhase !== 'arrived') return;
    flow.set({ tourPhase: 'await', awaitingPoi: cur.poi.id });
    const verb = cur.poi.interaction.verb;
    bubble(STOP_PROMPTS[cur.poi.id] ?? { zh: `到金圈里「${verb.zh}」～`, en: `Step into the gold ring: ${verb.en.toLowerCase()}!` }, 3600, BAYBAY_ID, 'call');
  }, stopFraming(cur.poi));
}

function tourStopDone(poi: PoiDef) {
  const cur = currentStop();
  if (!cur || cur.poi.id !== poi.id) return;
  flow.set({ tourPhase: 'done-node', awaitingPoi: null });
  // the market stop outside market hours: lines that don't claim a market sample
  const doneNode = poi.interaction.kind === 'taste' && !marketOpenNow() ? hook('marketClosedTour') ?? cur.stop.doneNode : cur.stop.doneNode;
  playDialogue(doneNode, () => completeStop(poi), stopFraming(poi));
}

function completeStop(poi: PoiDef) {
  const { tour } = game.get();
  const completed = tour.completed.includes(poi.id) ? tour.completed : [...tour.completed, poi.id];
  game.set({ tour: { ...tour, completed } });
  emit({ type: 'stamp' });
  // every finished stop goes into the journal's 想去 list (what the outro and the recap promise)
  if (!wishlist.has('poi', poi.id) && wishlist.add({ kind: 'poi', id: poi.id, title: poi.name.zh })) say('已记进旅行本', 'Saved to your journal', 'success', 2200);
  if (poi.realInfo) {
    flow.set({ tourPhase: 'card' });
    openPanel('poi', poi.id);
  } else continueTour();
}

/** After the stop's card closes (or "继续下一站"): advance to the next stop or finish. */
export function continueTour() {
  const { tour } = game.get();
  const stops = tourStops();
  const next = tour.stop + 1;
  if (next >= stops.length) { finishTour(); return; }
  game.set({ tour: { ...tour, stop: next } });
  flow.set({ tourPhase: 'leading' });
  leadBubble();
}

/** 'tour-next': continue from the current sub-phase (intro → go, leading/await → skip stop). */
export function tourNext() {
  const phase = flow.get().tourPhase;
  if (!game.get().tour.active) { startTour(); return; }
  if (cityTourActive()) { cityTourApi?.next(); return; }
  if (phase === 'intro') { flow.set({ tourPhase: 'leading' }); leadBubble(); return; }
  if (phase === 'arrived') { const cur = currentStop(); flow.set({ tourPhase: 'await', awaitingPoi: cur?.poi.id ?? null }); return; }
  if (phase === 'card') { closePanel(); return; }
  if (phase === 'outro' || phase === 'finished') { finishTour(); return; }
  flow.set({ awaitingPoi: null });
  continueTour();
}

function finishTour() {
  flow.set({ tourPhase: 'outro', awaitingPoi: null });
  playDialogue(FIRST_TOUR.outroNode, () => endTour());
}

export function endTour() {
  if (cityTourActive()) { cityTourApi?.end(); return; }
  const { tour } = game.get();
  game.set({ mode: 'free', tour: { ...tour, active: false } });
  flow.set({ tourPhase: 'finished', awaitingPoi: null });
  if (tour.completed.length) openPanel('recap');
  else startFree({ quiet: true });
}

// ---------------------------------------------------------------------------
// This week
// ---------------------------------------------------------------------------

export function startWeek() {
  introPendingSince = 0;
  endTrip();
  game.set(s => ({ mode: 'week', tour: { ...s.tour, active: false }, week: { companions: null, vibe: null, region: null, results: [], step: 0 } }));
  flow.set({ weekStage: 'asking', weekResult: null, tourPhase: 'idle', goalsCard: false, awaitingPoi: null });
  openPanel('week');
  void loadCatalog();
}

const WEEK_ORDER = ['companions', 'vibe', 'region'] as const;

export function setWeekPref(key: 'companions' | 'vibe' | 'region', value: string) {
  const week = game.get().week;
  const step = Math.max(week.step, WEEK_ORDER.indexOf(key) + 1);
  game.set({ week: { ...week, [key]: value, step } });
  emit({ type: 'ui', action: 'select' });
  if (step >= WEEK_ORDER.length) void showWeekResults();
}

export function weekBack() {
  const week = game.get().week;
  const step = Math.max(0, Math.min(week.step, 3) - 1);
  const key = WEEK_ORDER[step];
  game.set({ week: { ...week, [key]: null, step, results: [] } });
  flow.set({ weekResult: null, weekStage: 'asking' });
}

export function boardPosition(): Vec2 | null {
  const poi = POIS.find(item => item.interaction?.kind === 'board');
  return poi?.position ?? DISTRICT.anchors?.['weekly-board'] ?? null;
}

export async function showWeekResults() {
  const catalog = await loadCatalog();
  if (!catalog) {
    flow.set({ weekStage: 'board', weekResult: null });
    game.set({ week: { ...game.get().week, step: 3, results: [] } });
    openPanel('week');
    const text = hookText('weekResult', 'error');
    if (text) bubble(text, 4200);
    return;
  }
  const week = game.get().week;
  // (review, lane R's request: the Bay clock, so `?date=` moves the week board like everything else — DEV / QA builds)
  const result = recommendEvents(catalog, { companions: week.companions, vibe: week.vibe, region: week.region }, todayInBay(), { now: bayNow() });
  game.set({ week: { ...game.get().week, results: result.events.map(item => item.event.id), step: 3 } });
  flow.set({ weekResult: result });
  const board = boardPosition();
  const inWeekMode = game.get().mode === 'week';
  // (review, plan §3.3 item 1 "shows the flyers right after the three questions", lane R's request: in the city the
  // district's board may be kilometres away — the flyers open at once there)
  if (!inWeekMode || !board || dist(playerPos(), board) < 9 || game.get().worldMode === 'city') {
    flow.set({ weekStage: 'board' });
    openPanel('week');
    weekResultBubble();
    return;
  }
  flow.set({ weekStage: 'walking' });
  leadCallAt = performance.now();
  closePanel();
  bubble(hookText('weekSearching') ?? { zh: `挑好 ${result.events.length} 个活动啦！传单贴在公告板上，跟我来～`, en: `Picked ${result.events.length} events! The flyers are on the board — follow me!` }, 4200, BAYBAY_ID, 'call');
  announce({ zh: '跟 BAYBAY 去公告板', en: 'Follow BAYBAY to the board' });
}

/** Guide brain → both at the board. */
export function weekArrived() {
  if (flow.get().weekStage !== 'walking') return;
  flow.set({ weekStage: 'board' });
  emit({ type: 'arrive', poiId: 'weekly-board' });
  runtime.guide.emote = 'point';
  lookAtBoardThen(() => { openPanel('week'); weekResultBubble(); });
}

/** F17: actually look at the board (≈1.2 s) before its sheet slides in. */
let boardLook: (() => void) | null = null;
function lookAtBoardThen(open: () => void) {
  const board = DISTRICT.landmarks.find(item => item.kind === 'weekly-board')?.position ?? boardPosition();
  if (!board || game.get().settings.reducedMotion) { open(); return; }
  faceCameraToward(board.x, board.z);
  boardLook = () => { boardLook = null; if (flow.get().weekStage === 'board' && !game.get().dialogue.nodeId) open(); };
  momentTimers.push(setTimeout(() => boardLook?.(), 1200));
}
/** Finish the board look right away (tests; a tap on the board). */
export function finishBoardLook() { boardLook?.(); }

function weekResultBubble() {
  const result = flow.get().weekResult;
  const kind = !getCatalog() ? 'error' : !result?.events.length || result.strictCount === 0 ? 'none' : result.relaxed.length ? 'few' : 'found';
  const text = hookText('weekResult', kind);
  if (text) setTimeout(() => bubble(text, 4200), 400);
}

export function openBoard(nodeId?: string) {
  if (flow.get().weekResult) { flow.set({ weekStage: 'board' }); openPanel('week'); return; }
  if (game.get().mode === 'tour') { openPanel('week'); return; }
  const node = nodeId ?? hook('board');
  if (node) { playDialogue(node); return; }
  startWeek();
}

// ---------------------------------------------------------------------------
// Goals & collectibles
// ---------------------------------------------------------------------------

/**
 * Goal keys completeGoal() understands; a key also completes every FREE_GOALS id containing one of its words.
 * Day-0 (wave 2): 'cable-car' and 'ferry' for lane F's rides (completeGoal('cable-car') after a counted ride).
 */
export type GoalKey = 'postcards' | 'streetcar' | 'viewpoint' | 'photo' | 'taste' | 'cable-car' | 'ferry';
const GOAL_WORDS: Record<GoalKey, string[]> = {
  postcards: ['postcard', 'card'],
  streetcar: ['streetcar', 'ride', 'tram', 'f-line', 'fline'],
  viewpoint: ['coit', 'viewpoint', 'view', 'summit', 'hill'],
  photo: ['photo', 'sea-lion', 'sealion', 'camera'],
  taste: ['taste', 'market', 'food', 'sample'],
  'cable-car': ['cable-car', 'cablecar'],
  ferry: ['ferry'],
};
export const goalIdsFor = (key: GoalKey) => FREE_GOALS.filter(goal => GOAL_WORDS[key].some(word => goal.id.toLowerCase().includes(word))).map(goal => goal.id);
export const goalKeyOf = (goalId: string): GoalKey | null => (Object.keys(GOAL_WORDS) as GoalKey[]).find(key => GOAL_WORDS[key].some(word => goalId.toLowerCase().includes(word))) ?? null;

export function completeGoal(key: GoalKey) {
  const done = game.get().goalsDone;
  const ids = [...new Set([key, ...goalIdsFor(key)])].filter(id => !done.includes(id));
  if (!ids.length) return;
  game.set({ goalsDone: [...done, ...ids] });
  emit({ type: 'goal', id: key });
  const goal = FREE_GOALS.find(item => goalIdsFor(key).includes(item.id));
  if (goal) say(`目标完成：${goal.label.zh}`, `Goal complete: ${goal.label.en}`, 'gold', 3200);
  // wave 5 (W5-C4): lane E's ledger pays each explorer goal once (city mode only; game/rewards.ts)
  for (const id of ids) if (FREE_GOALS.some(item => item.id === id)) rewardGoal(id);
}

/**
 * Mark goalsDone ids that are not GoalKeys (lane G2's city detectors, game/cityGoals.ts: `twin-peaks`, `golden-gate`,
 * `painted-ladies`, `neighbourhoods`, and the `hood:<id>` visit marks). A FREE_GOALS id gets the goal event and toast
 * (`quiet`: no toast — the caller shows its own moment, e.g. the pelican unlock) and, in city mode, lane E's reward.
 */
export function markGoalsDone(ids: readonly string[], opts: { quiet?: boolean } = {}) {
  const done = game.get().goalsDone;
  const fresh = [...new Set(ids)].filter(id => !done.includes(id));
  if (!fresh.length) return;
  game.set({ goalsDone: [...done, ...fresh] });
  for (const id of fresh) {
    const goal = FREE_GOALS.find(item => item.id === id);
    if (!goal) continue;
    emit({ type: 'goal', id });
    if (!opts.quiet) say(`目标完成：${goal.label.zh}`, `Goal complete: ${goal.label.en}`, 'gold', 3200);
    rewardGoal(id);
  }
}

export function collectPostcard(id: string) {
  const card = postcardById(id);
  const s = game.get();
  if (!card || s.postcards.includes(id)) return;
  const postcards = [...s.postcards, id];
  game.set({ postcards });
  emit({ type: 'postcard', id });
  emit({ type: 'stamp' });
  // wave 5 (W5-C4): lane E's ledger pays a postcard once (city mode only)
  rewardPostcard(id);
  emit({ type: 'emote', who: 'player', emote: 'pickup' });
  // the card flies to you first (Systems.tsx animates it), then the reward card opens
  flow.set({ postcardFly: { id, at: performance.now() }, bubble: null });
  const reduced = game.get().settings.reducedMotion;
  momentTimers.push(setTimeout(revealPostcard, reduced ? 120 : 600));
  freshPostcard = true;
  // (counts go through data/postcards: only the active world mode's cards count, G2-3)
  const count = activePostcardCount(postcards), total = activePostcardTotal();
  announce({ zh: `收集到明信片：${card.title.zh}（${count}/${total}）`, en: `Postcard collected: ${card.title.en} (${count}/${total})` });
  if (allPostcardsFound(postcards)) completeGoal('postcards');
}

let freshPostcard = false;

/** End the pickup beat and open the reward card (timer, or E / tap to skip the beat). */
export function revealPostcard() {
  const fly = flow.get().postcardFly;
  if (fly) flow.set({ postcardFly: null, postcardReward: fly.id, rewardFresh: true });
}
export function closePostcardReward() {
  if (!flow.get().postcardReward) return;
  flow.set({ postcardReward: null, rewardFresh: false });
  emit({ type: 'ui', action: 'close' });
  if (!freshPostcard) return;
  freshPostcard = false;
  const collected = game.get().postcards;
  const count = activePostcardCount(collected);
  if (allPostcardsFound(collected)) { const all = hook('postcardAll'); if (all) { setTimeout(() => playDialogue(all), 350); return; } }
  const text = hookText(count === 1 ? 'postcardFirst' : 'postcardFound');
  if (text) bubble(text, 3600);
}

/** True when a saved item can really become a BAYLINK plan stop (exists in the catalog and has not ended). */
export function wishPlannable(item: Pick<WishItem, 'kind' | 'id'>, catalog = getCatalog()): boolean {
  if (!catalog) return false;
  if (item.kind === 'event') { const event = catalog.events.find(e => e.id === item.id); return !!event && !isExpired(event, todayInBay()); }
  if (item.kind === 'place') return catalog.places.some(place => place.id === item.id);
  if (item.kind === 'poi') { const id = poiById(item.id)?.plannerPlaceId; return !!id && catalog.places.some(place => place.id === id); }
  return false;
}

/** Wishlist toggle; the toast only promises a BAYLINK plan when the item can really go into one. */
export function toggleWish(item: Omit<WishItem, 'addedAt'>) {
  const added = wishlist.toggle(item);
  if (added) {
    if (wishPlannable(item)) say('已加入想去 · 旅行本里可以一键带去 BAYLINK 安排', 'Saved · your journal can send it to a BAYLINK plan', 'success', 3200);
    else say('已加入想去，旅行本里可以生成步行路线', 'Saved · your journal can turn saves into a walking route', 'success', 3200);
  }
  return added;
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

/** True while a micro-interaction's feedback is still playing (prevents double triggers). */
let feedbackPending = false;

export const busy = () => {
  const s = game.get(), f = flow.get();
  return feedbackPending || s.phase !== 'playing' || !!s.dialogue.nodeId || !!f.fishing || cinemaActive() || s.riding !== null || s.photoMode || !!f.postcardReward || !!f.postcardFly
    // wave 5 (W5-C3): E behind the goals step never boards the ferry at the gate
    || goalsStepOpen();
};

let lastInteractAt = 0;
/** Debounced entry point for E / Enter / gamepad A / action button. Returns true if something happened. */
export function requestInteract(source: 'key' | 'runtime' | 'button' = 'button'): boolean {
  const now = performance.now();
  if (now - lastInteractAt < 280) return false;
  lastInteractAt = now;
  const s = game.get(), f = flow.get();
  if (s.dialogue.nodeId) { (dialogueConfirm ?? advanceDialogue)(); return true; }
  if (f.fishing) { reel(); return true; }
  if (f.postcardReward) { closePostcardReward(); return true; }
  if (f.postcardFly) { revealPostcard(); return true; }
  if (cinemaActive()) { if (f.cinematic === 'arrival') skipCinema(); return true; }
  if (source !== 'button' && !s.focus) return false;
  if (s.focus) { performInteraction(s.focus); return true; }
  return false;
}
/** Mark that a key already handled this press (so a mirrored runtime flag is ignored). */
export const noteInteractHandled = () => { lastInteractAt = performance.now(); };

const isTourTarget = (id: string) => {
  const cur = currentStop();
  return !!cur && game.get().tour.active && cur.poi.id === id && ['leading', 'arrived', 'await'].includes(flow.get().tourPhase);
};

/** Wave 5 (frozen with interactables.ts): the sources whose `act()` replaces the built-in action switch. */
export const ACT_SOURCES: ReadonlySet<InteractableSource> = new Set<InteractableSource>(['activity', 'find', 'shop', 'event']);

export function performInteraction(id: string) {
  const it = interactableById(id);
  if (!it || busy()) return;
  runtime.player.pendingInteract = null;
  runtime.player.pathTarget = null;
  if (it.source !== 'baybay') emit({ type: 'interact', id, kind: it.action });
  // wave 5 (day 0): the new lanes' interactables (an activity start, a find, the shop stall, an event kit) run their own act
  if (it.act && ACT_SOURCES.has(it.source)) {
    try { it.act(); } catch (error) { if (import.meta.env?.DEV) console.error('[opus-bay interact]', it.id, error); }
    return;
  }

  if (it.poi && isTourTarget(it.id) && flow.get().tourPhase === 'leading') { tourArrived(); return; }
  const done = () => afterFeedback(it);

  switch (it.action) {
    case 'talk':
      if (it.source === 'baybay') { openCallMenu(); return; }
      if (it.source === 'npc') { talkToNpc(it); return; }
      playDialogue(it.nodeId, done);
      return;
    case 'info': done(); return;
    case 'bell': {
      runtime.guide.emote = 'hop';
      bubble({ zh: '当——当——当！', en: 'Dong — dong — dong!' }, 2600);
      // "look up at the clock": the camera starts moving on the first dong; three dongs ring out during the shot,
      // each with a small shake and rings off the clock face
      const face = clockFace(it.poi?.landmarkId ?? 'ferry-building');
      const reduced = game.get().settings.reducedMotion;
      const dong = () => {
        emit({ type: 'bell' });
        if (!game.get().settings.reducedMotion) runtime.camera.shake = Math.max(runtime.camera.shake, 0.15);
        if (face) spawnFx('rings', face.x, face.y, face.z, { scale: 2.2 });
      };
      dong();
      momentTimers.push(setTimeout(dong, 900), setTimeout(dong, 1800));
      if (face) {
        const p = runtime.player;
        const dx = p.x - face.x, dz = p.z - face.z, d = Math.hypot(dx, dz) || 1;
        const eye: [number, number, number] = [p.x + (dx / d) * 5, heightAt(p.x, p.z) + 1.4, p.z + (dz / d) * 5];
        playShots('viewpoint', [{ position: eye, target: [face.x, face.y, face.z], duration: reduced ? 0.3 : 0.6, hold: 2.05, caption: it.name }], () => {
          refreshLock();
          done();
        });
      } else later(2300, done);
      return;
    }
    case 'taste': {
      runtime.guide.emote = 'clap';
      emit({ type: 'emote', who: 'player', emote: 'taste' });
      emit({ type: 'emote', who: 'baybay', emote: 'clap' });
      // honest: outside market hours there is no market sample — the shops inside the building are open daily
      if (marketOpenNow()) say('尝了一口市集试吃——好香！（试吃前先问摊主哦）', 'You tried a market sample — delicious! (Always ask the vendor first.)', 'success', 3000);
      else say('在楼里的店尝了一口——好香！', 'You had a bite from a shop inside — delicious!', 'success', 3000);
      bubble({ zh: '嗯～好吃！', en: 'Mmm, tasty!' }, 1800);
      const p = runtime.player;
      spawnFx('hearts', p.x, p.y + 1.9, p.z);
      // a short push-in on the bite
      const cam = runtime.camera;
      const token = holdFraming({ kind: 'view', yaw: cam.yaw, pitch: cam.pitch, dist: Math.max(7, cam.distance * 0.8) });
      momentTimers.push(setTimeout(() => releaseFraming(token), 1200));
      completeGoal('taste');
      later(1500, done);
      return;
    }
    case 'fish': startFishing(it, done); return;
    case 'telescope': lookThroughTelescope(it, done); return;
    case 'viewpoint': viewpointSweep(it, done); return;
    case 'photo': enterPhotoMode(it.id); return;
    case 'board': if (isTourTarget(it.id)) { openBoard(); later(300, done); } else openBoard(it.nodeId); return;
    case 'streetcar': boardFrom(it); return;
    case 'postcard': collectPostcard(it.refId ?? it.id); return;
  }
}

/** Front clock face of the Ferry Building tower (world/landmarks.ts: tower at local z 2.9, face at y ≈ 22). */
function clockFace(landmarkId: string): { x: number; y: number; z: number } | null {
  const lm = DISTRICT.landmarks.find(item => item.id === landmarkId && item.kind === 'ferry-building');
  if (!lm) return null;
  const k = 5.2 * (lm.scale || 1);
  return { x: lm.position.x + Math.sin(lm.rotationY) * k, y: 21.95 * (lm.scale || 1), z: lm.position.z + Math.cos(lm.rotationY) * k };
}

const REACTION_KINDS = new Set(['bell', 'taste', 'telescope', 'viewpoint', 'info']);
function afterFeedback(it: Interactable) {
  if (!it.poi) return;
  if (isTourTarget(it.id)) { tourStopDone(it.poi); return; }
  const poi = it.poi;
  const card = () => { if (poi.realInfo && game.get().panel.kind === null) openPanel('poi', poi.id); };
  let reaction = REACTION_KINDS.has(it.action) ? it.nodeId : undefined;
  if (it.action === 'taste' && /market/.test(poi.id) && !marketOpenNow()) reaction = hook('marketClosed') ?? reaction;
  if (reaction && !game.get().dialogue.nodeId) playDialogue(reaction, card);
  else card();
}

/** Ferry Plaza Farmers Market days (Tue, Thu, Sat) in Bay Area time. */
export const marketDay = (day = todayInBay()) => [2, 4, 6].includes(weekday(day));

/**
 * The farmers market is set up right now (Tue & Thu 10–14, Sat 8–14, Bay time — Foodwise). Review (lane V's request 4):
 * on the frozen Bay clock like the stalls (world/clock.ts isMarketOpen), so `?date=` moves both (DEV / QA builds).
 */
export function marketOpenNow(now = bayNow()): boolean {
  const day = todayInBay(now);
  if (!marketDay(day)) return false;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 12) + Number(parts.find(p => p.type === 'minute')?.value ?? 0) / 60;
  return hour >= (weekday(day) === 6 ? 8 : 10) && hour < 14;
}

/** Timers of in-flight moments (bell dongs, the taste push-in). */
const momentTimers: ReturnType<typeof setTimeout>[] = [];

const later = (ms: number, fn: () => void) => {
  feedbackPending = true;
  setTimeout(() => { feedbackPending = false; fn(); }, game.get().settings.reducedMotion ? Math.min(ms, 500) : ms);
};

/**
 * Lane G2's city residents (game/residentTasks.ts, its own chunk): claims a resident's chat (their favour's state picks
 * the dialogue) before the NPC_LINES / NPC_POSTS lines. Returns false for keys it does not know.
 */
let residentTalk: ((key: string) => boolean) | null = null;
export function setResidentTalk(fn: ((key: string) => boolean) | null) { residentTalk = fn; }

function talkToNpc(it: Interactable) {
  if (it.npc && residentTalk?.(it.npc)) return;
  // one of the six before their chunk is in (a tap in the first moments of a city visit): wait for it rather than
  // fall through to NPC_LINES, where 'gripman' is the transit crew's generic line (G2 review)
  if (it.npc && !residentTalk && residentByKey(it.npc)) return;
  const post = NPC_POSTS.find(item => item.key === it.npc);
  const existing = npcLine(it.npc).nodeId ?? (NODES[it.id] ? it.id : undefined);
  if (existing) { playDialogue(existing); return; }
  if (!post) return;
  const nodeId = defineNode({ id: `flow.npc.${post.key}`, speaker: 'npc', npcName: post.name, text: post.line });
  playDialogue(nodeId);
}

// --- call BAYBAY -------------------------------------------------------------

let callTimer: ReturnType<typeof setTimeout> | null = null;
let lastCallAt = -Infinity;
export function callBaybay() {
  const s = game.get();
  if (s.phase !== 'playing' || s.dialogue.nodeId || cinemaActive() || flow.get().fishing) return;
  if (introPending() || goalsStepOpen()) return;
  // Q is seen both by the DOM shortcut and by actors' input (runtime.input.call): treat them as one press.
  const now = performance.now();
  if (now - lastCallAt < 400) return;
  lastCallAt = now;
  emit({ type: 'guide-call' });
  const d = Math.hypot(runtime.guide.x - runtime.player.x, runtime.guide.z - runtime.player.z);
  if (d < 3.6) { openCallMenu(); return; }
  flow.set({ callPending: true });
  bubble(bark('called') ?? { zh: '来啦来啦！', en: 'Coming!' }, 1600, BAYBAY_ID, 'call');
  if (callTimer) clearTimeout(callTimer);
  callTimer = setTimeout(() => { if (flow.get().callPending) openCallMenu(); }, 6000);
}

export function openCallMenu() {
  flow.set({ callPending: false });
  if (callTimer) { clearTimeout(callTimer); callTimer = null; }
  const s = game.get();
  const choices: DialogueNode['choices'] = [];
  const cur = currentStop();
  const city = s.worldMode === 'city';
  // wave 5 (ui/slots.ts registerAskItem): order < 0 above BAYBAY's own choices, order ≥ 0 after them (before the map)
  const asks = visibleAskItems();
  const askChoice = (a: (typeof asks)[number]): DialogueChoice => ({ label: a.label, action: { type: 'ask', id: a.id } });
  choices.push(...asks.filter(a => a.order < 0).map(askChoice));
  if (cityTourActive()) choices.push(...(cityTourApi?.callChoices() ?? []));
  else if (s.tour.active && cur) {
    choices.push({ label: { zh: `继续：带我去${cur.poi.name.zh}`, en: `Keep going: take me to ${cur.poi.name.en}` }, action: { type: 'end' } });
    choices.push({ label: { zh: '跳过这一站', en: 'Skip this stop' }, action: { type: 'tour-next' } });
    choices.push({ label: { zh: '先不跟团了，结束导览', en: 'End the tour for now' }, action: { type: 'tour-end' } });
  } else {
    // F8: free roam always has a "next" — the nearest unfinished goal, and what is around you
    const next = s.mode === 'free' ? nextFreeGoal() : null;
    // (lane N's request: in the city BAYBAY carries you there — the label times that, not a straight walk)
    const nt = next ? (city ? carriedTimeLabel(dist(playerPos(), next)) : null) ?? gameTimeLabel(dist(playerPos(), next)) : null;
    if (next && nt) choices.push({ label: { zh: `带我去下一个目标：${next.name.zh} · ${nt.zh}`, en: `Take me to the next goal: ${next.name.en} · ${nt.en}` }, next: `flow.goto.${next.id}` });
    const nearby = nearbyNode();
    if (nearby) choices.push({ label: { zh: '附近有什么？', en: "What's around here?" }, next: nearby });
    // W4-C7 · city: the Grand Tour (or where it was left); the nearest bus stop / Metro station is in 附近有什么
    if (city) choices.push({ label: grandTourCallLabel(), action: { type: 'start-tour', tourId: GRAND_TOUR.id } });
    const done = tourIdOf(s.tour) === DEFAULT_TOUR_ID ? s.tour.completed.length : districtTourProgress().completed.length, total = tourStops().length;
    const bay101: Bilingual = city ? { zh: '海边 7 站（湾区第一课）', en: '7 waterfront stops (Bay 101)' } : { zh: '带我逛「湾区第一课」', en: 'Give me the Bay 101 tour' };
    choices.push({ label: done && done < total ? { zh: `继续湾区第一课（${done}/${total}）`, en: `Resume Bay 101 (${done}/${total})` } : bay101, action: { type: 'start-tour' } });
    choices.push({ label: { zh: '这周有什么好玩的？', en: "What's on this week?" }, action: { type: 'start-week' } });
  }
  choices.push(...asks.filter(a => a.order >= 0).map(askChoice));
  choices.push({ label: { zh: '打开地图', en: 'Open the map' }, action: { type: 'open-map' } });
  choices.push({ label: { zh: '没事，继续逛', en: "Nothing — I'll keep exploring" }, action: { type: 'end' } });
  choices.forEach((choice, i) => { choice.hotkey = String(i + 1); });
  const text: Bilingual = s.tour.active
    ? { zh: '怎么啦？要继续跟我走，还是换个玩法？', en: 'What’s up? Keep following me, or switch things up?' }
    : { zh: '我在！想做点什么？', en: "I'm here! What would you like to do?" };
  playDialogue(defineNode({ id: 'flow.call', speaker: 'baybay', mood: 'happy', text, choices }));
}

// --- fishing -----------------------------------------------------------------

let fishTimers: ReturnType<typeof setTimeout>[] = [];
let fishDone: (() => void) | null = null;
const clearFishTimers = () => { fishTimers.forEach(clearTimeout); fishTimers = []; };

/** Bite window (s): long enough to react to the splash. */
export const BITE_WINDOW = 1.6;
let fishFraming = 0;
let fishWater: { x: number; z: number } | null = null;
/** The first catch of the visit is guaranteed: one miss gets a friendly automatic second cast. */
let caughtThisVisit = false;
let autoRetried = false;

/** A point on the water ~5u out from the fishing spot: off the pier end first, else to either side. */
export function fishingWaterPoint(it: Interactable): { x: number; z: number } {
  const lm = it.poi?.landmarkId ? DISTRICT.landmarks.find(item => item.id === it.poi?.landmarkId) : undefined;
  const base = lm?.rotationY ?? Math.atan2(it.x - runtime.player.x, it.z - runtime.player.z);
  for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const a = base + turn;
    const p = { x: it.x + Math.sin(a) * 5, z: it.z + Math.cos(a) * 5 };
    if (isWater(p.x, p.z)) return p;
  }
  return { x: it.x + Math.sin(base) * 5, z: it.z + Math.cos(base) * 5 };
}

function startFishing(it: Interactable, done: () => void) {
  clearFishTimers();
  fishDone = done;
  flow.set({ fishing: { poiId: it.id, stage: 'cast', catchIndex: 0 } });
  refreshLock();
  // F13: face the water and look over the shoulder at the line (the camera holds this until the rod is packed)
  const water = fishingWaterPoint(it);
  fishWater = water;
  const p = runtime.player;
  p.heading = Math.atan2(water.x - p.x, water.z - p.z);
  releaseFraming(fishFraming);
  fishFraming = holdFraming({ kind: 'over-shoulder', toward: water });
  emit({ type: 'emote', who: 'player', emote: 'cast' });
  fishTimers.push(setTimeout(() => {
    setFishStage('wait');
    fishTimers.push(setTimeout(() => {
      setFishStage('bite');
      // the bite happens in the world: a splash where the line is, a splash sound, "!" over your head
      spawnFx('splash', water.x, heightAt(water.x, water.z) + 0.1, water.z);
      emit({ type: 'emote', who: 'player', emote: 'bite' });
      fishTimers.push(setTimeout(() => { if (flow.get().fishing?.stage === 'bite') missFish(it); }, BITE_WINDOW * 1000));
    }, 1000 + Math.random() * 1100));
  }, 650));
}

/** A miss: the very first one of the visit gets an automatic, friendly second cast. */
function missFish(it: Interactable) {
  if (!caughtThisVisit && !autoRetried) {
    autoRetried = true;
    bubble({ zh: '差一点！再来一竿，这次一定行～', en: 'So close! One more cast — you’ve got this~' }, 2600, BAYBAY_ID, 'call');
    const done = fishDone ?? (() => {});
    fishTimers.push(setTimeout(() => { if (flow.get().fishing) startFishing(it, done); }, 900));
    setFishStage('missed');
    return;
  }
  setFishStage('missed');
}

/** Where the line is (the bite splash / camera look-at); null when not fishing. */
export const fishingWater = () => (flow.get().fishing ? fishWater : null);

function setFishStage(stage: 'cast' | 'wait' | 'bite' | 'caught' | 'missed') {
  const fishing = flow.get().fishing;
  if (fishing) flow.set({ fishing: { ...fishing, stage } });
}

export const FISH_CATCHES: { name: Bilingual; fact: Bilingual }[] = [
  { name: { zh: '银汉鱼 Jacksmelt', en: 'Jacksmelt' }, fact: { zh: '码头上最常见的银色小鱼之一，常成群在水面附近游。', en: 'One of the most common silvery fish off Bay piers, often schooling near the surface.' } },
  { name: { zh: '条纹鲈 Striped bass', en: 'Striped bass' }, fact: { zh: '湾区热门钓鱼目标，有尺寸和数量限制——出钓前查加州鱼猎局规定。', en: 'A favourite Bay catch with size and bag limits — check California Fish & Wildlife rules first.' } },
  { name: { zh: '豹纹鲨 Leopard shark', en: 'Leopard shark' }, fact: { zh: '湾区浅水常见的小型鲨鱼，身上有豹纹斑点，对人无害。', en: 'A small, spotted shark common in the Bay’s shallows — harmless to people.' } },
  { name: { zh: '海鲈 Surfperch', en: 'Surfperch' }, fact: { zh: '码头桩柱附近常见的小鱼，是码头钓鱼新手最容易遇到的鱼。', en: 'Small fish that hang around pier pilings — a classic first catch for beginners.' } },
];

export function reel() {
  const fishing = flow.get().fishing;
  if (!fishing) return;
  if (fishing.stage === 'bite') {
    clearFishTimers();
    caughtThisVisit = true;
    flow.set({ fishing: { ...fishing, stage: 'caught', catchIndex: Math.floor(Math.random() * FISH_CATCHES.length) } });
    emit({ type: 'stamp' });
    emit({ type: 'emote', who: 'player', emote: 'pickup' });
    const p = runtime.player;
    spawnFx('sparkle', p.x, p.y + 1.4, p.z);
    runtime.guide.emote = 'clap';
    return;
  }
  if (fishing.stage === 'caught' || fishing.stage === 'missed') { closeFishing(); return; }
  if (fishing.stage === 'wait') bubble({ zh: '还没咬钩，再等等～', en: 'Not yet — wait for the bite!' }, 1400);
}

export function retryFishing() {
  const fishing = flow.get().fishing;
  const it = fishing ? interactableById(fishing.poiId) : undefined;
  if (!it) { closeFishing(); return; }
  const done = fishDone ?? (() => {});
  startFishing(it, done);
}

export function closeFishing() {
  clearFishTimers();
  releaseFraming(fishFraming);
  fishFraming = 0;
  const fishing = flow.get().fishing;
  if (!fishing) return;
  const caught = fishing.stage === 'caught';
  flow.set({ fishing: null });
  refreshLock();
  const done = fishDone;
  fishDone = null;
  if (caught || isTourTarget(fishing.poiId)) done?.();
}

// --- telescope / viewpoint --------------------------------------------------------

function lookThroughTelescope(it: Interactable, done: () => void) {
  const subjects = it.poi?.interaction.targets?.length ? it.poi.interaction.targets : ['alcatraz', 'bay-bridge'];
  const shots: Shot[] = [];
  const eye = { x: it.x, y: heightAt(it.x, it.z) + 3, z: it.z };
  for (const subject of subjects.slice(0, 3)) {
    const p = subjectPosition(subject);
    if (!p) continue;
    // move most of the way there (a telescope "zoom"), but stay far enough back to frame big subjects whole
    const far = Math.hypot(p.x - eye.x, p.z - eye.z) || 1;
    const keep = Math.max(far * 0.38, subject === 'bay-bridge' ? 62 : 36);
    const k = 1 - keep / far;
    const cam: [number, number, number] = [eye.x + (p.x - eye.x) * k, eye.y + 4 + Math.max(0, (p.y - eye.y) * k * 0.4), eye.z + (p.z - eye.z) * k];
    const fact = subjectFact(subject);
    shots.push({ position: cam, target: [p.x, p.y, p.z], duration: 1.1, hold: fact ? 2.8 : 1.9, caption: fact?.name ?? subjectCaption(subject), sub: fact?.fact ?? null });
  }
  if (!shots.length) shots.push({ position: [eye.x, eye.y + 6, eye.z - 30], target: [eye.x, 2, eye.z - 120], duration: 1.1, hold: 2, caption: { zh: '海湾', en: 'The Bay' } });
  playShots('telescope', shots, () => { refreshLock(); done(); });
}

const SUBJECT_NAMES: Record<string, Bilingual> = {
  alcatraz: { zh: '恶魔岛 Alcatraz', en: 'Alcatraz' },
  'bay-bridge': { zh: '海湾大桥 Bay Bridge', en: 'Bay Bridge' },
  'yerba-buena': { zh: '芳草地岛 Yerba Buena', en: 'Yerba Buena Island' },
  'angel-island': { zh: '天使岛 Angel Island', en: 'Angel Island' },
  'coit-tower': { zh: '科伊特塔 Coit Tower', en: 'Coit Tower' },
  'ferry-building': { zh: '渡轮大厦', en: 'Ferry Building' },
  'sea-lion-docks': { zh: 'PIER 39 海狮', en: 'Pier 39 sea lions' },
  transamerica: { zh: '泛美金字塔', en: 'Transamerica Pyramid' },
  'salesforce-tower': { zh: 'Salesforce 大厦', en: 'Salesforce Tower' },
  'marin-hills': { zh: '马林岬角', en: 'Marin Headlands' },
  'east-bay-hills': { zh: '东湾山丘', en: 'East Bay hills' },
};
function subjectCaption(subject: string): Bilingual {
  const key = Object.keys(SUBJECT_NAMES).find(name => subject === name || subject.includes(name));
  if (key) return SUBJECT_NAMES[key];
  const poi = poiById(subject);
  return poi?.name ?? { zh: subject, en: subject };
}

function viewpointSweep(it: Interactable, done: () => void) {
  const view = DISTRICT.anchors?.['coit-view'] ?? { x: it.x, z: it.z };
  const y = heightAt(view.x, view.z);
  const bay = { x: view.x, z: view.z - 90 };
  // aim at the real backdrop models (Alcatraz, the Bay Bridge span) rather than at open water
  const alc = subjectPosition('alcatraz') ?? { x: bay.x - 160, y: 6, z: bay.z };
  const bridge = subjectPosition('bay-bridge') ?? { x: bay.x + 260, y: 14, z: bay.z + 40 };
  const toward = (p: { x: number; z: number }, k: number, lift: number): [number, number, number] => [view.x + (p.x - view.x) * k, y + lift, view.z + (p.z - view.z) * k];
  const shots: Shot[] = [
    { position: [view.x + 18, y + 16, view.z + 10], target: [view.x, y + 4, view.z], duration: 1.2, hold: 0.3, caption: { zh: 'Telegraph Hill 山顶', en: 'Atop Telegraph Hill' } },
    { position: toward(alc, 0.2, 16), target: [alc.x, alc.y, alc.z], duration: 2.4, hold: 0.8, caption: { zh: '西北：恶魔岛与金门方向', en: 'Northwest: Alcatraz and the Golden Gate' } },
    { position: toward(bridge, 0.16, 18), target: [bridge.x, bridge.y, bridge.z], duration: 2.4, hold: 0.8, caption: { zh: '东边：海湾大桥与东湾', en: 'East: the Bay Bridge and the East Bay' } },
    { position: [view.x, y + 70, view.z + 40], target: [view.x, 0, view.z - 50], duration: 2.2, hold: 0.8, caption: { zh: '整片海滨尽收眼底', en: 'The whole waterfront below you' } },
  ];
  playShots('viewpoint', shots, () => {
    refreshLock();
    const first = !game.get().viewpointUnlocked;
    game.set({ viewpointUnlocked: true });
    // wave 5 (W5-C2): in the city the sweep meets the pelican too (lane C's moment; before the move system's own toast)
    unlockPelican('sweep');
    completeGoal('viewpoint');
    emit({ type: 'stamp' });
    if (first) {
      say('地图已解锁：整片海滨都标出来了！', 'Map unlocked: the whole waterfront is revealed!', 'gold', 3600);
      setTimeout(() => say('明信片的大致位置也标在地图上了（M）', 'Rough postcard spots are now on the map (M)', 'info', 3600), 900);
    }
    done();
  });
}

// --- streetcar / transit: moved to game/transit.ts (lane F); re-exported for old imports -------------

export { boardStreetcar, cancelRide, finishRide, hopOffRide, rideTo } from './transit';

// --- photo mode ----------------------------------------------------------------------

let photoSubject: string | null = null;
let photoBubbled = false;
export function enterPhotoMode(subject: string | null = null) {
  photoSubject = subject;
  // a photo spot (the sea lions): swing the camera round so the subject is in frame behind the player
  const it = subject ? interactableById(subject) : undefined;
  const aim = it ? (it.poi?.interaction.targets?.length ? subjectPosition(it.poi.interaction.targets[0]) : null) ?? { x: it.x, z: it.z } : null;
  if (aim) faceCameraToward(aim.x, aim.z);
  photoBubbled = false;
  game.set({ photoMode: true, panel: { kind: null } });
  emit({ type: 'ui', action: 'open' });
}
export function exitPhotoMode() {
  photoSubject = null;
  game.set({ photoMode: false });
  emit({ type: 'ui', action: 'close' });
}
export const currentPhotoSubject = () => photoSubject;

/** After a shutter: counts the sea-lion photo goal when framed near the sea lions. */
export function notePhotoTaken() {
  const spot = DISTRICT.anchors?.['sea-lion-viewpoint'];
  const photoPoi = POIS.find(poi => poi.interaction?.kind === 'photo');
  const p = playerPos();
  const nearSeaLions = (spot && dist(p, spot) < 28) || (photoPoi && dist(p, photoPoi.position) < 28) || (photoSubject && /sea-?lion/.test(photoSubject));
  if (nearSeaLions) completeGoal('photo');
  const it = photoSubject ? interactableById(photoSubject) : undefined;
  if (it?.poi && isTourTarget(it.id)) { exitPhotoMode(); tourStopDone(it.poi); return; }
  if (it?.nodeId && !photoBubbled) { photoBubbled = true; const text = nodeText(it.nodeId); if (text) bubble(text, 3800); }
}

// ---------------------------------------------------------------------------
// Objective (for the beacon, waypoint and objective pill)
// ---------------------------------------------------------------------------

export function objectiveTarget(): (Vec2 & { id: string; name: Bilingual; soft?: boolean }) | null {
  const s = game.get(), f = flow.get();
  if (s.phase !== 'playing') return null;
  if (s.mode === 'free' && f.freeLead) {
    const it = interactableById(f.freeLead);
    if (it) return { x: it.x, z: it.z, id: it.id, name: it.name };
  }
  // wave 4: a running trip's current leg (plan §4.2: freeLead > trip > tour > week > mapTarget > freeHint)
  const leg = f.trip ? tripRunner?.objective() : null;
  if (leg) return leg;
  if (s.tour.active && (f.tourPhase === 'leading' || f.tourPhase === 'await' || f.tourPhase === 'arrived')) {
    const cur = currentStop();
    if (cur) return { x: cur.poi.position.x, z: cur.poi.position.z, id: cur.poi.id, name: cur.poi.name };
  }
  if (s.mode === 'week' && f.weekStage === 'walking') {
    const board = boardPosition();
    if (board) return { ...board, id: 'weekly-board', name: { zh: '这周去哪 · 公告板', en: 'This-week board' } };
  }
  if (f.mapTarget) {
    const it = interactableById(f.mapTarget);
    if (it) return { x: it.x, z: it.z, id: it.id, name: it.name };
  }
  // F8: a soft hint toward the nearest unfinished goal (no beacon, dismissable). City (verify m4): not while you ride
  // (the brain does not refresh it then, and the chip sat on the rider's face) nor once you stand at it.
  if (s.mode === 'free' && f.freeHint) {
    if (s.worldMode === 'city' && (s.move.mode === 'transit' || dist(playerPos(), f.freeHint) < HINT_AT_R)) return null;
    return { ...f.freeHint, soft: true };
  }
  return null;
}
const HINT_AT_R = 5;

// ---------------------------------------------------------------------------
// F8 · free roam: the nearest unfinished goal, a guided walk there, "what's around here"
// ---------------------------------------------------------------------------

const goalDone = (id: string) => game.get().goalsDone.includes(id);

/** The nearest unfinished free-roam goal (or a postcard's neighbourhood), as a place to walk to. */
export function nextFreeGoal(from: Vec2 = playerPos()): (Vec2 & { id: string; name: Bilingual }) | null {
  const s = game.get();
  const out: (Vec2 & { id: string; name: Bilingual })[] = [];
  const add = (id: string, name?: Bilingual) => { const it = interactableById(id); if (it && dist(from, it) > it.radius + 1) out.push({ id: it.id, x: it.x, z: it.z, name: name ?? it.name }); };
  // only goals of the active world (city mode has no market / sea-lion / F-line goals: CS-9)
  const open = (id: string) => !goalDone(id) && FREE_GOALS.some(goal => goal.id === id);
  if (open('taste')) add('farmers-market');
  if (open('viewpoint')) add('coit-tower');
  if (open('sea-lions')) add('sea-lions');
  if (open('streetcar')) {
    const stops = interactables().filter(it => it.action === 'streetcar').sort((a, b) => dist(from, a) - dist(from, b));
    if (stops[0]) add(stops[0].id);
  }
  if (!goalDone('postcards')) {
    // not the card itself (that would spoil the hunt): the real place it hides next to
    const cards = POSTCARDS.filter(card => !s.postcards.includes(card.id)).sort((a, b) => dist(from, a.position) - dist(from, b.position));
    const card = cards[0];
    const near = card ? clueNear(card.position) : undefined;
    // city (verify D14): the clue walks you to a spot ≈ CLUE_OFFSET u short of the card, not to that place 44–63 u away
    if (card && s.worldMode === 'city') add(`${CLUE_PREFIX}${card.id}`);
    else if (near) add(near.id, clueName(near));
  }
  // city goals (lane G2, game/cityContent.ts goalTargets): a waypoint per unfinished goal; ids resolve through
  // interactableById (an interactable, or a G1 `place:<id>` via setExtraResolver) so "take me there" can lead.
  // A favour you said yes to (`first`) comes before everything else.
  // Wave 5 (W5-C2, plan MF3): then the pelican goal, before any nearer goal — once it is done, BAYBAY can fly you anywhere.
  const firsts: typeof out = [], pelican: typeof out = [];
  for (const t of goalTargets()) if (!goalDone(t.goal) && dist(from, t) > (t.radius ?? 3) + 1) (t.first ? firsts : t.goal === CITY_GOAL.pelican ? pelican : out).push({ id: t.id, x: t.x, z: t.z, name: t.name });
  const pickFrom = firsts.length ? firsts : pelican.length ? pelican : out;
  pickFrom.sort((a, b) => dist(from, a) - dist(from, b));
  return pickFrom[0] ?? null;
}

/** The real place a postcard hides next to (its clue's name): the nearest POI that is not the week board. */
const clueNear = (p: Vec2): PoiDef | undefined => POIS.filter(poi => poi.interaction.kind !== 'board').sort((a, b) => dist(p, a.position) - dist(p, b.position))[0];
const clueName = (near: PoiDef | undefined): Bilingual => (near ? { zh: `明信片线索 · ${near.name.zh}附近`, en: `Postcard clue · near ${near.name.en}` } : { zh: '明信片线索', en: 'Postcard clue' });

/** City postcard clues (verify D14): `clue:<postcardId>` resolves to a walkable spot this far short of the card. */
export const CLUE_PREFIX = 'clue:';
export const CLUE_OFFSET = 8;
const CLUE_RADIUS = 3;
/**
 * Where a clue leads (pure): CLUE_OFFSET u from the card toward the place it is named after (so the walk ends with the
 * card's glint in sight, not on it), the place itself when that is closer; `snap` moves it onto walkable ground.
 */
export function clueSpot(card: Vec2, toward: Vec2 | undefined, snap: (p: Vec2) => Vec2 | null = p => nearestWalkable(p, 6)): { x: number; z: number; snapped: boolean } {
  const d = toward ? dist(card, toward) : 0;
  if (!toward || d <= CLUE_OFFSET) { const at = toward ?? card; return { x: at.x, z: at.z, snapped: !!toward }; }
  const k = CLUE_OFFSET / d;
  const raw = { x: card.x + (toward.x - card.x) * k, z: card.z + (toward.z - card.z) * k };
  const s = snap(raw);
  return s ? { x: s.x, z: s.z, snapped: true } : { ...raw, snapped: false };
}
const clueCache = new Map<string, Interactable>();
function clueInteractable(id: string): Interactable | undefined {
  const hit = clueCache.get(id);
  if (hit) return hit;
  const card = POSTCARDS.find(c => c.id === id.slice(CLUE_PREFIX.length));
  if (!card) return undefined;
  const near = clueNear(card.position);
  const spot = clueSpot(card.position, near?.position);
  const it: Interactable = { id, source: 'place', action: 'info', verb: { zh: '找找明信片', en: 'Look for the postcard' }, name: clueName(near), x: spot.x, z: spot.z, radius: CLUE_RADIUS, refId: card.id };
  // keep it once the ground there answered (streamed); until then the raw spot, asked again next time
  if (spot.snapped) clueCache.set(id, it);
  return it;
}
registerPrefixResolver(CLUE_PREFIX, clueInteractable);

/** BAYBAY leads you to an interactable (free roam, from the call menu). */
export function startFreeLead(id: string) {
  const it = interactableById(id);
  if (!it) return;
  flow.set({ freeLead: id, freeHint: null });
  leadCallAt = performance.now();
  bubble({ zh: `跟我来！去${it.name.zh}`, en: `Follow me — to ${it.name.en}!` }, 3000, BAYBAY_ID, 'call');
  announce({ zh: `跟 BAYBAY 去${it.name.zh}`, en: `Follow BAYBAY to ${it.name.en}` });
  // wave 4 · city: the free lead is a one-leg walking trip (the trip pill, the map route and the LeadChip follow it)
  tripRunner?.freeLead(it);
}

/** Guide brain → both reached the free-roam destination. */
export function freeLeadArrived() {
  const id = flow.get().freeLead;
  const it = interactableById(id);
  flow.set({ freeLead: null });
  if (flow.get().trip?.source === 'free-lead') tripRunner?.arrived();
  if (!it) return;
  emit({ type: 'arrive', poiId: it.id });
  // (review: the goals step's lead to the pelican ends at the summit with the pelican met on the steps just below — its
  // moment speaks next (game/pelicanFirst.ts), not 到啦！试试「眺望海湾」 over it)
  if (it.id === PELICAN_TARGET && goalDone(CITY_GOAL.pelican)) return;
  bubble({ zh: `到啦！试试「${it.verb.zh}」～`, en: `Here we are! Try: ${it.verb.en.toLowerCase()}` }, 3600, BAYBAY_ID, 'call');
}

// ---------------------------------------------------------------------------
// Wave 4 · trips (lane C, W4-C1): `flow.trip` (game/trips.ts reducer). The runner — leading each leg, boarding,
// driving, flying, the leg / end events — is game/tripRun.ts in the city chunk; these are the entry points every
// lane calls (lane P's 跟 BAYBAY 去 / TripOptions / StationActions, lane G's trip card). District mode has no runner.
// ---------------------------------------------------------------------------

/** Where a trip goes: the place-index id (or interactable id), its attraction and name, the arrival point. */
export interface TripDest { placeId: string; attraction?: string; name?: Bilingual; x?: number; z?: number }
export interface TripRunner {
  start(option: TripOption, dest: TripDest, source?: TripSource): void;
  /** 跳过这一站: the current leg is done, lead on to the next */
  skip(): void;
  /** 换个方式: the same destination with another option */
  replan(option: TripOption): void;
  /** 结束 (and any mode that takes over: a district tour, the week, 带我去) */
  end(): void;
  /** the current leg ended (the brain's lead arrived; a free lead) */
  arrived(): void;
  /** a free lead as a one-leg walking trip */
  freeLead(it: Pick<Interactable, 'id' | 'x' | 'z' | 'name'>): void;
  /** the waypoint point for the current leg (objectiveTarget) */
  objective(): (Vec2 & { id: string; name: Bilingual }) | null;
  /** the guide brain on foot: true = the trip leads BAYBAY this tick */
  guide(now: number): boolean;
}
let tripRunner: TripRunner | null = null;
export function setTripRunner(r: TripRunner | null) { tripRunner = r; }
export const tripRunnerReady = () => !!tripRunner;

/** 跟 BAYBAY 去 / a TripOptions row / a station's 坐 N 线: start a trip (city mode; replaces a running one). */
export function startTrip(option: TripOption, dest: TripDest, source: TripSource = 'map') {
  if (tripRunner) { tripRunner.start(option, dest, source); return; }
  if (game.get().worldMode !== 'city') return;
  void import('./tripRun').then(m => { m.initTripRun(); tripRunner?.start(option, dest, source); }, (e: unknown) => { if (import.meta.env?.DEV) console.error('[opus-bay trips]', e); });
}
/** The guide brain (on foot, free to lead): the running trip leads BAYBAY this tick (true), or nothing does. */
export function tripGuide(now: number): boolean { return !!flow.get().trip && !!tripRunner?.guide(now); }
/** 跳过这一站 on the trip card (a tour skips its stop). */
export function skipTripLeg() { tripRunner?.skip(); }
/** 换个方式: same destination, another option. */
export function replanTrip(option: TripOption) { tripRunner?.replan(option); }
/** 结束 on the trip card; also what a new mode does to a running trip. */
export function endTrip() { if (flow.get().trip) tripRunner?.end(); }

/** When the last arrival moment started (performance.now ms; 0 = none): the soft hint waits 60 s after it. */
let arrivalMomentAt = 0;
export const lastArrivalAt = () => arrivalMomentAt;
/** Lane C's arrival watcher (game/cityArrivals.ts): an arrival moment is on screen (flow.arrival). */
export function noteArrivalMoment(now = performance.now()) { arrivalMomentAt = now; }
/** The arrival card's close / 下一站 (lane G): the moment is over. */
export function dismissArrival() { if (flow.get().arrival) flow.set({ arrival: null }); }

/** The nearest sightseeing-bus stop or Metro station interactable (lane T registers them in city mode), or undefined. */
function nearestLineStation(p: Vec2, max = 400): Interactable | undefined {
  let best: Interactable | undefined, bd = max;
  for (const it of interactables()) {
    if (it.source !== 'transit' || !/^transit-(loop|muni)-/.test(it.id)) continue;
    const d = dist(p, it);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}

/** The call menu's Grand Tour row: start it, or pick it up at the chapter it was left (save v2 `tours`). */
function grandTourCallLabel(): Bilingual {
  const p = readSave()?.tours?.[GRAND_TOUR.id];
  return p && p.completed.length ? GRAND_TOUR.resume(p.chapter + 1) : GRAND_TOUR.call;
}

/** A city resident this close (u, about a minute's walk) whose favour you have not taken yet is named in "附近有什么？". */
export const NEIGHBOUR_NEAR = 300;

/** The nearest city resident within NEIGHBOUR_NEAR whose favour is still new (city mode only), or undefined. */
export function neighbourNearby(p: Vec2 = playerPos()) {
  const s = game.get();
  if (s.worldMode !== 'city') return undefined;
  return RESIDENTS.filter(r => taskState(s.goalsDone, r.key) === 'new' && dist(p, r.at) > 3 && dist(p, r.at) < NEIGHBOUR_NEAR)
    .sort((a, b) => dist(p, a.at) - dist(p, b.at))[0];
}

/**
 * "附近有什么？": BAYBAY names the two nearest places (with honest game times) and offers to take you; in the city she
 * also mentions a neighbour close by who could use a hand (G2-6: the favours from the call menu), with "去找 TA".
 */
function nearbyNode(): string | null {
  const p = playerPos();
  const near = POIS.filter(poi => poi.interaction.kind !== 'postcard' && dist(p, poi.position) > (poi.radius || 3) + 1)
    .sort((a, b) => dist(p, a.position) - dist(p, b.position)).slice(0, 2);
  if (near.length < 2) return null;
  const [a, b] = near;
  const ta = gameTimeLabel(dist(p, a.position)), tb = gameTimeLabel(dist(p, b.position));
  const who = neighbourNearby(p);
  const tw = who ? gameTimeLabel(dist(p, who.at)) : null;
  const choices: DialogueNode['choices'] = [
    { label: { zh: `去${a.name.zh}`, en: `${a.name.en}` }, next: `flow.goto.${a.id}` },
    { label: { zh: `去${b.name.zh}`, en: `${b.name.en}` }, next: `flow.goto.${b.id}` },
  ];
  if (who && tw) choices.push({ label: { zh: `去找${who.name.zh}（${tw.zh}）`, en: `Find ${who.name.en} (${tw.en})` }, next: `flow.goto.${who.id}` });
  // W4-C7 · city: the nearest sightseeing-bus stop or Metro station (lane T's `transit-loop-*` / `transit-muni-*`)
  const station = game.get().worldMode === 'city' ? nearestLineStation(p) : undefined;
  if (station) { const ts = gameTimeLabel(dist(p, station)); choices.push({ label: { zh: `去车站：${station.name.zh}（${ts.zh}）`, en: `To the stop: ${station.name.en} (${ts.en})` }, next: `flow.goto.${station.id}` }); }
  choices.push({ label: { zh: '先不用', en: 'Not now' }, action: { type: 'end' } });
  choices.forEach((choice, i) => { choice.hotkey = String(i + 1); });
  return defineNode({
    id: 'flow.nearby', speaker: 'baybay', mood: 'point',
    text: who
      ? { zh: `最近的是${a.name.zh}（${ta.zh}）和${b.name.zh}（${tb.zh}）。${who.short.zh} 就在附近，好像想找人帮个忙！`, en: `Closest are ${a.name.en} (${ta.en}) and ${b.name.en} (${tb.en}). And ${who.short.en} is close by — looks like they could use a hand!` }
      : { zh: `最近的是${a.name.zh}（${ta.zh}）和${b.name.zh}（${tb.zh}）。想去哪个？`, en: `Closest are ${a.name.en} (${ta.en}) and ${b.name.en} (${tb.en}). Which one?` },
    choices,
  });
}

/** The soft waypoint was tapped away: leave the player alone for a while. */
export function dismissFreeHint() { flow.set({ freeHint: null, freeHintOffUntil: performance.now() + 90000 }); }

/** Map → "带我去": auto-walk there and show the waypoint until arrival. */
export function navigateTo(id: string) {
  const it = interactableById(id);
  if (!it) return;
  endTrip();
  flow.set({ mapTarget: id });
  closePanel();
  walkTo(it, null);
  say(`出发：${it.name.zh}`, `Heading to ${it.name.en}`, 'info', 2200);
}

// ---------------------------------------------------------------------------
// Reset (settings → restart onboarding)
// ---------------------------------------------------------------------------

export function restartOnboarding() {
  endTrip();
  if (cityTourActive()) cityTourApi?.end(true);
  closeQuiet();
  closePanel();
  endRide();
  game.set(s => ({ phase: 'playing', mode: 'onboarding', tour: { ...s.tour, active: false }, riding: null, photoMode: false }));
  const keep = { debug: flow.get().debug };
  flow.set({ ...initialFlowState(), ...keep });
  // wave 5 (W5-C3): a restart (Settings → reset progress, its only caller) welcomes a new player again
  resetWelcome();
  startKind = 'new';
  introPendingSince = performance.now() - 2000;
  refreshLock();
}

// ---------------------------------------------------------------------------
// Event listeners (edge of the model, ...) — registered once by the Overlay
// ---------------------------------------------------------------------------

let lastEdgeLine = 0;
export function initFlowListeners(): () => void {
  const off = onEvent(event => {
    if (event.type === 'bump' && /edge/.test(event.kind)) {
      const now = performance.now();
      if (now - lastEdgeLine < 9000) return;
      lastEdgeLine = now;
      bubble(bark('edge') ?? hookText('edge') ?? { zh: '前面是模型边缘啦！', en: "That's the edge of the model!" }, 2800);
    }
  });
  // day-0 lane entry points: G2's city content (residents, lines, goals) and F's transit (stations, listeners)
  const offContent = initCityContent();
  const offTransit = initTransit();
  return () => { off(); offContent(); offTransit(); };
}
