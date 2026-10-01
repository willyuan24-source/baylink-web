import { lazy } from 'react';
import type { MoveMode } from '../core/store';
import { playSound } from '../audio/hooks';
import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Vec2 } from '../core/types';
import { BREAD_NODE, TASK_TEXT, fact2For, nodeIds, nodeIds2, residentDialogue, residentNodes2 } from '../data/sf/dialogue';
import {
  RESIDENTS, type ResidentDef, type ResidentKey, type TaskGoal, acceptTask, acceptTask2, deliverLetter, finishTask, finishTask2, letterState,
  lettersArrived, nextPhotoSpot, photoHits, photoSpotsDone, residentByKey, task2DoneId, task2PhotoId, task2State, taskDoneId, taskState, tasksDone,
} from '../data/sf/residents';
import { registerOverlay } from '../ui/slots';
import { bayParts } from './bayNow';
import { baybayLine } from './cityContent';
import { GGB } from '../world/sf/landmarks/golden-gate-bridge';
import { sfLandmark, worldToLandmark } from '../world/sf/landmarks/index';
import { travelActive, travelEpoch } from './fastTravel';
import { bubble, defineNode, dialogueOpen, goalsStepOpen, navigateTo, playDialogue, say, setResidentTalk } from './flow';
import { flow } from './flowStore';
import { invalidateInteractables, registerPrefixResolver, type Interactable } from './interactables';
import { REWARD_COINS, emitReward, rewardFavour } from './rewards';
import { registerFrameSystem } from './systemsRegistry';
import { importRetry } from './importRetry';

/**
 * The six city residents' favours at runtime (lane G2, plan G2-6). Loaded lazily by game/cityContent.ts (city mode
 * only); the data is data/sf/residents.ts, the words data/sf/dialogue.ts.
 *
 *   talk          flow.setResidentTalk: a chat opens the node the favour's state asks for (first meeting → hi → ask;
 *                 declined earlier this visit → ask; on → remind, or thanks when it is already done; done → thanks;
 *                 Ray with Rosa's loaf on → the delivery)
 *   accept        when `npc.<k>.yes` is shown: `task-on:<k>` in goalsDone (saved with it), a toast, and the favour's
 *                 target becomes the first waypoint (cityContent.goalTargets `first`)
 *   finish        the goal of data/sf/residents TaskGoal: a counted cable-car ride (lane F's `transit` event), the
 *                 delivery node, a postcard in hand, or getting there (reach / the bridge deck) on your own — checked
 *                 at 4 Hz outside dialogue (arrivalStep: a fast trip or the pelican to the spot does not count);
 *                 `task:<k>` replaces `task-on:<k>`, the goal fanfare, a toast, and BAYBAY says "go tell them" (a
 *                 delivery or a favour finished while talking goes straight to the thanks)
 *   `pendingGo`   remind → 带我去: the walk (flow.navigateTo) starts when the dialogue closes
 *
 * Wave 5 · W5-C7 (plan §3.5 "Resident letters"): the SECOND favour (data/sf/residents.ts task2). After the first
 * favour's thanks → fact, the resident asks it (ask2; once declined this visit, a later chat asks it straight away);
 * yes2 accepts it (`task2-on:`), remind2 → go2 walks there (`favour2:<key>`, resolved to the spot to go to now).
 * It finishes on a shutter within a spot's radius (`photo`: Rosa, Luz ×3, Hank, Marcus; each spot is marked as it is
 * photographed) or on lane A's activity (`play`: Ray's bell riff, Dana's look from the Crissy Field beach view spot),
 * pays `favour:<key>:2` (25), and leaves a mark: Luz's otter board in Balmy Alley (game/otterMark.ts), Ray's riff
 * when you pass him, the words after (fact2For: Rosa's Saturday market, Hank's tulips in spring, Marcus's weekend
 * drums). LETTER_DELAY_MS later (LETTER_RESUME_MS after a later visit starts) the resident's letter arrives on a quiet
 * frame: `letter:<key>`, a toast and BAYBAY's line; the Journal's 目标 tab opens it (ui/Letter.tsx, overlay c-letter).
 */

/** a second favour's letter arrives this long after the favour (ms of this visit)… */
export const LETTER_DELAY_MS = 150_000;
/** …or this long into a later visit (a favour finished before the page was reloaded) */
export const LETTER_RESUME_MS = 25_000;
/** at most one letter per this long (ms) */
export const LETTER_GAP_MS = 20_000;
/** Ray rings your riff when you pass within this (u), at most once per RIFF_GAP_MS */
export const RIFF_NEAR = 6;
export const RIFF_GAP_MS = 240_000;
export const LETTER_OVERLAY = 'c-letter';
const Letter = lazy(() => importRetry(() => import('../ui/Letter')));

/** Ways of getting somewhere that count as going yourself (not the pelican, fast travel or a transit car). */
const OWN_WAY: ReadonlySet<MoveMode> = new Set<MoveMode>(['foot', 'sit', 'bike', 'car', 'photo']);

export interface TaskSample { x: number; y: number; z: number; mode: MoveMode; travelling: boolean; postcards: readonly string[] }

/** Is a favour's goal met by this sample? (The ride and delivery goals come from events: always false here.) */
export function goalMet(goal: TaskGoal, s: TaskSample, bridgeLocal?: (p: Vec2) => Vec2 | null): boolean {
  switch (goal.kind) {
    case 'postcard': return s.postcards.includes(goal.card);
    case 'reach':
      if (s.travelling || !OWN_WAY.has(s.mode)) return false;
      return Math.hypot(s.x - goal.x, s.z - goal.z) <= goal.r && (goal.minY === undefined || s.y >= goal.minY);
    case 'deck': {
      if (s.travelling || !OWN_WAY.has(s.mode) || s.y < GGB.DECK - 3.2) return false;
      const local = bridgeLocal?.(s) ?? null;
      return !!local && Math.abs(local.x + GGB.TOWER) <= goal.r && Math.abs(local.z) <= 9;
    }
    default: return false;
  }
}

/** Arming state of one 'reach' / 'deck' favour (arrivalStep). */
export interface Arrival { armed: boolean; epoch: number | null }

/**
 * One 4 Hz sample of a 'reach' / 'deck' favour: true when you came into its spot on your own. A sample outside the spot
 * on foot, bike or car arms it; a fast trip, a `?at=` teleport or a resume (G1's travelEpoch changes) and the pelican
 * disarm it. So landing there by 飞过去 or on the pelican and standing still does not count (step out and back in) —
 * the rule the explorer goals keep (game/cityGoals.ts), armed right outside the spot instead of 150 u away.
 * (goalMet alone only refuses the moment of travel: the first sample after the landing used to finish the favour.)
 */
export function arrivalStep(a: Arrival, goal: TaskGoal, s: TaskSample, epoch: number, bridgeLocal?: (p: Vec2) => Vec2 | null): boolean {
  if (a.epoch !== null && epoch !== a.epoch) a.armed = false;
  a.epoch = epoch;
  if (s.travelling || s.mode === 'glide' || s.mode === 'travel') { a.armed = false; return false; }
  // a transit car (the cable car, the ferry) neither arms nor disarms: hopping off inside counts if you walked out to it
  if (!OWN_WAY.has(s.mode)) return false;
  if (!goalMet(goal, s, bridgeLocal)) { a.armed = true; return false; }
  return a.armed;
}

/**
 * The dialogue a chat with `r` opens, given the favours' state. `asked2`: the second favour was asked this visit (a
 * later chat asks it again straight away instead of replaying the first favour's thanks).
 */
export function entryNode(r: ResidentDef, goalsDone: readonly string[], met: boolean, asked2 = false): string {
  const ids = nodeIds(r.key), ids2 = nodeIds2(r.key);
  if (r.key === 'gripman' && taskState(goalsDone, 'baker') === 'on') return BREAD_NODE;
  const state = taskState(goalsDone, r.key);
  if (state === 'done') {
    const s2 = task2State(goalsDone, r.key);
    if (s2 === 'done') return ids2.thanks;
    if (s2 === 'on') return ids2.remind;
    // (the first favour's thanks → fact, then the second is asked: afterChat)
    return asked2 ? ids2.ask : ids.thanks;
  }
  if (state === 'on') return ids.remind;
  return met ? ids.ask : ids.hi;
}

/** Where a second favour leads now (pure): a photo favour's nearest spot not photographed yet, else its target. */
export function favour2Spot(r: ResidentDef, goalsDone: readonly string[], from: Vec2): { x: number; z: number; name: ResidentDef['task2']['target']['name'] } {
  const s = nextPhotoSpot(goalsDone, r, from);
  return s ? { x: s.x, z: s.z, name: s.name } : { x: r.task2.target.x, z: r.task2.target.z, name: r.task2.target.name };
}

/** Does this event finish a `play` second favour? (pure) */
export function playGoalMet(goal: TaskGoal, e: { type: string; activity?: string; what?: string; kind?: string; id?: string }): boolean {
  if (goal.kind !== 'play') return false;
  if (goal.spot) return e.type === 'find' && e.kind === goal.activity && e.id === goal.spot;
  return e.type === 'play' && e.activity === goal.activity && e.what === 'end';
}

export function initResidentTasks(): () => void {
  for (const node of residentDialogue()) defineNode(node);
  const met = new Set<ResidentKey>();
  /** second favours asked this visit (a later chat asks again at once) */
  const asked2 = new Set<ResidentKey>();
  let pendingGo: string | null = null;
  /** favours finished while a chat was open: their thanks follows when it closes */
  let thankAfter: ResidentKey | null = null;
  /** the last resident node shown (afterChat: the first favour's fact → the second favour's ask) */
  let lastNode: string | null = null;
  /** W5-C7: when each due letter arrives (performance.now ms) */
  const letterAt = new Map<ResidentKey, number>();
  let lastLetter = -Infinity, lastRiff = -Infinity, rayNear = false;
  let offOtter: (() => void) | null = null, otterLoading = false;
  const offLetter = registerOverlay({ id: LETTER_OVERLAY, Component: Letter });
  const offTarget = registerPrefixResolver('favour2:', id => {
    const r = residentByKey(id.slice('favour2:'.length));
    if (!r) return undefined;
    const p = runtime.player, at = favour2Spot(r, game.get().goalsDone, { x: p.x, z: p.z });
    const it: Interactable = { id, source: 'place', action: 'info', verb: { zh: '到了', en: 'Here' }, name: at.name, x: at.x, z: at.z, radius: r.task2.target.r };
    return it;
  });
  /** Luz's otter board: its module loads once her second favour is done (city only) */
  const syncOtter = () => {
    const want = task2State(game.get().goalsDone, 'muralist') === 'done';
    // (Settings → reset progress: the board goes with the favour)
    if (!want) { if (offOtter) { offOtter(); offOtter = null; otterLoading = false; } return; }
    if (offOtter || otterLoading) return;
    otterLoading = true;
    void importRetry(() => import('./otterMark')).then(m => { if (task2State(game.get().goalsDone, 'muralist') === 'done') offOtter = m.initOtterMark(); else otterLoading = false; }, () => { otterLoading = false; });
  };
  syncOtter();
  const bridge = sfLandmark('golden-gate-bridge');
  const bridgeLocal = (p: Vec2) => (bridge ? worldToLandmark(bridge, p) : null);
  const sample = (): TaskSample => {
    const p = runtime.player, s = game.get();
    return { x: p.x, y: p.y, z: p.z, mode: runtime.move.mode, travelling: travelActive() || s.move.mode === 'travel', postcards: s.postcards };
  };

  const accept = (key: ResidentKey) => {
    const r = residentByKey(key);
    const before = game.get().goalsDone;
    if (!r || taskState(before, key) !== 'new') return;
    game.set({ goalsDone: acceptTask(before, key) });
    invalidateInteractables();
    say(TASK_TEXT.accepted(r.task.title).zh, TASK_TEXT.accepted(r.task.title).en, 'info', 3200);
    // already done (the postcard was in your journal): thank you right after this chat (a place must be walked to)
    if (r.task.goal.kind === 'postcard' && goalMet(r.task.goal, sample(), bridgeLocal)) { finish(key, false); thankAfter = key; }
  };

  function finish(key: ResidentKey, tell: boolean) {
    const r = residentByKey(key);
    const before = game.get().goalsDone;
    if (!r || taskState(before, key) === 'done') return;
    game.set({ goalsDone: finishTask(before, key) });
    invalidateInteractables();
    emit({ type: 'goal', id: taskDoneId(key) });
    // wave 5 (W5-C4): lane E's ledger pays a neighbour's favour once
    rewardFavour(key);
    say(TASK_TEXT.done(r.task.title).zh, TASK_TEXT.done(r.task.title).en, 'gold', 3400);
    if (tell) bubble(TASK_TEXT.tellThem(r.short), 3400);
    if (tasksDone(game.get().goalsDone) === RESIDENTS.length) setTimeout(() => say(TASK_TEXT.allDone.zh, TASK_TEXT.allDone.en, 'gold', 4200), 3600);
  }

  const afterChat = () => {
    const go = pendingGo, thank = thankAfter, last = lastNode;
    pendingGo = null; thankAfter = null; lastNode = null;
    if (thank) { playDialogue(nodeIds(thank).thanks, afterChat); return; }
    if (go) { navigateTo(go); return; }
    // W5-C7: the first favour's thanks → fact ended: the resident asks the second one
    const m = last ? /^npc\.([a-z-]+)\.fact$/.exec(last) : null;
    const r = m ? residentByKey(m[1]) : undefined;
    if (r && task2State(game.get().goalsDone, r.key) === 'new') { asked2.add(r.key); playDialogue(nodeIds2(r.key).ask, afterChat); }
  };

  const accept2 = (key: ResidentKey) => {
    const r = residentByKey(key);
    const before = game.get().goalsDone;
    if (!r || task2State(before, key) !== 'new') return;
    game.set({ goalsDone: acceptTask2(before, key) });
    invalidateInteractables();
    say(TASK_TEXT.accepted(r.task2.title).zh, TASK_TEXT.accepted(r.task2.title).en, 'info', 3200);
  };

  function finish2(key: ResidentKey, tell: boolean) {
    const r = residentByKey(key);
    const before = game.get().goalsDone;
    if (!r || task2State(before, key) !== 'on') return;
    game.set({ goalsDone: finishTask2(before, key) });
    invalidateInteractables();
    emit({ type: 'goal', id: task2DoneId(key) });
    emitReward(`favour:${key}:2`, REWARD_COINS.favour);
    say(TASK_TEXT.done(r.task2.title).zh, TASK_TEXT.done(r.task2.title).en, 'gold', 3400);
    if (tell) bubble(TASK_TEXT.tellThem(r.short), 3400);
    letterAt.set(key, performance.now() + LETTER_DELAY_MS);
    syncOtter();
  }

  /** A shutter: the photo favours whose spots it was taken within. */
  const onShutter = () => {
    const p = runtime.player;
    for (const r of RESIDENTS) {
      if (r.task2.goal.kind !== 'photo') continue;
      const done = game.get().goalsDone;
      const hits = photoHits(done, r, p.x, p.z);
      if (!hits.length) continue;
      game.set({ goalsDone: [...done, ...hits.map(s => task2PhotoId(r.key, s.id))] });
      const got = photoSpotsDone(game.get().goalsDone, r).length, need = r.task2.goal.need;
      if (got >= need) finish2(r.key, true);
      else { const t = TASK_TEXT.photoSpot(got, need, hits[hits.length - 1].name); say(t.zh, t.en, 'info', 2600); invalidateInteractables(); }
    }
  };

  /** W5-C7: a due letter arrives on a quiet frame (one per LETTER_GAP_MS). */
  const stepLetters = (now: number) => {
    const done = game.get().goalsDone;
    for (const r of RESIDENTS) {
      if (letterState(done, r.key) !== 'due') continue;
      if (!letterAt.has(r.key)) letterAt.set(r.key, now + LETTER_RESUME_MS);
      if (now < letterAt.get(r.key)! || now - lastLetter < LETTER_GAP_MS) continue;
      const s = game.get(), f = flow.get();
      if (s.photoMode || s.move.mode === 'travel' || f.cinematic || f.arrival || goalsStepOpen()) return;
      lastLetter = now;
      game.set({ goalsDone: deliverLetter(done, r.key) });
      const t = TASK_TEXT.letter(r.short);
      say(t.zh, t.en, 'gold', 3800);
      baybayLine(lettersArrived(game.get().goalsDone) === RESIDENTS.length ? TASK_TEXT.allLetters : TASK_TEXT.letterLine, { ttl: 40 });
      return;
    }
  };

  /** W5-C7: Ray rings your riff when you walk past him (after his second favour). */
  const stepRiff = (now: number) => {
    const ray = RESIDENTS[0];
    if (task2State(game.get().goalsDone, ray.key) !== 'done') return;
    const p = runtime.player, near = Math.hypot(p.x - ray.at.x, p.z - ray.at.z) <= RIFF_NEAR && runtime.move.mode === 'foot';
    if (near && !rayNear && now - lastRiff >= RIFF_GAP_MS && !flow.get().bubble) {
      lastRiff = now;
      bubble(TASK_TEXT.rayRiff, 3000, ray.id);
      playSound('play-riff-1', { gain: 0.8 });
    }
    rayNear = near;
  };

  setResidentTalk(key => {
    const r = residentByKey(key);
    if (!r) return false;
    const s = game.get();
    // the favour may be done already (the card in hand): finish it and go straight to the thanks
    if (r.task.goal.kind === 'postcard' && taskState(s.goalsDone, r.key) === 'on' && goalMet(r.task.goal, sample(), bridgeLocal)) finish(r.key, false);
    // W5-C7: fact2 in the words of the real day (Rosa's Saturday, Hank's spring, Marcus's weekend)
    if (task2State(game.get().goalsDone, r.key) === 'done') for (const n of residentNodes2(r, fact2For(r.key, bayParts()))) if (n.id === nodeIds2(r.key).fact) defineNode(n);
    const node = entryNode(r, game.get().goalsDone, met.has(r.key), asked2.has(r.key));
    // met = introduced themselves (a loaf handed over is not an introduction)
    if (node === nodeIds(r.key).hi) met.add(r.key);
    playDialogue(node, afterChat);
    return true;
  });

  const offEvents = onEvent(ev => {
    if (ev.type === 'dialogue') {
      if (/^npc\./.test(ev.nodeId)) lastNode = ev.nodeId;
      if (ev.nodeId === BREAD_NODE) { finish('baker', false); return; }
      const m = /^npc\.([a-z-]+)\.(yes|go|ask)(2?)$/.exec(ev.nodeId);
      const r = m ? residentByKey(m[1]) : undefined;
      if (!r) return;
      const two = m![3] === '2';
      if (m![2] === 'ask') { if (two) asked2.add(r.key); return; }
      if (m![2] === 'yes') { if (two) accept2(r.key); else accept(r.key); } else pendingGo = two ? r.task2.target.id : r.task.target.id;
      return;
    }
    // W5-C7: the second favours — a shutter (photo), lane A's activities (play), the view look (find view)
    if (ev.type === 'shutter') { onShutter(); return; }
    if (ev.type === 'play' || ev.type === 'find') {
      for (const r of RESIDENTS) if (task2State(game.get().goalsDone, r.key) === 'on' && playGoalMet(r.task2.goal, ev)) finish2(r.key, true);
      return;
    }
    // Ray's favour: a counted ride (lane F: never in travel mode, the odometer rule met)
    if (ev.type === 'transit' && ev.kind === 'cable-car' && ev.what === 'ride' && ev.real && taskState(game.get().goalsDone, 'gripman') === 'on') finish('gripman', true);
  });

  let acc = 0;
  /** 'reach' / 'deck' favours: armed by a sample outside the spot on your own (arrivalStep) */
  const arrivals = new Map<ResidentKey, Arrival>();
  const offFrame = registerFrameSystem('g2-resident-tasks', dt => {
    if ((acc += dt) < 0.25) return;
    acc = 0;
    const s = game.get(), f = flow.get();
    // not during a chat, a card or a postcard reward (BAYBAY's "go tell them" would be lost under it)
    if (s.phase !== 'playing' || dialogueOpen() || s.panel.kind !== null || f.postcardReward || f.postcardFly) return;
    const now = performance.now();
    stepLetters(now);
    stepRiff(now);
    let smp: TaskSample | null = null;
    for (const r of RESIDENTS) {
      const goal = r.task.goal;
      if (goal.kind === 'ride' || goal.kind === 'deliver' || taskState(s.goalsDone, r.key) !== 'on') continue;
      smp ??= sample();
      if (goal.kind === 'postcard') { if (goalMet(goal, smp, bridgeLocal)) finish(r.key, true); continue; }
      let a = arrivals.get(r.key);
      if (!a) arrivals.set(r.key, (a = { armed: false, epoch: null }));
      if (arrivalStep(a, goal, smp, travelEpoch(), bridgeLocal)) finish(r.key, true);
    }
  }, 6);

  // Settings → reset progress empties goalsDone: the neighbours introduce themselves again (G2 review)
  let lastDone = game.get().goalsDone;
  const offReset = game.subscribe(() => {
    const done = game.get().goalsDone;
    if (done === lastDone) return;
    if (!done.length && lastDone.length) { met.clear(); asked2.clear(); letterAt.clear(); pendingGo = null; thankAfter = null; }
    lastDone = done;
    // (a save restored after this chunk started, or a QA state: Luz's otter follows goalsDone)
    syncOtter();
  });

  return () => { offEvents(); offFrame(); offReset(); offLetter(); offTarget(); offOtter?.(); setResidentTalk(null); };
}
