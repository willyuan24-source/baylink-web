import type { MoveMode } from '../core/store';
import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Vec2 } from '../core/types';
import { BREAD_NODE, TASK_TEXT, nodeIds, residentDialogue } from '../data/sf/dialogue';
import {
  RESIDENTS, type ResidentDef, type ResidentKey, type TaskGoal, acceptTask, finishTask, residentByKey, taskDoneId, taskState, tasksDone,
} from '../data/sf/residents';
import { GGB } from '../world/sf/landmarks/golden-gate-bridge';
import { sfLandmark, worldToLandmark } from '../world/sf/landmarks/index';
import { travelActive, travelEpoch } from './fastTravel';
import { bubble, defineNode, dialogueOpen, navigateTo, playDialogue, say, setResidentTalk } from './flow';
import { flow } from './flowStore';
import { invalidateInteractables } from './interactables';
import { registerFrameSystem } from './systemsRegistry';

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
 */

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

/** The dialogue a chat with `r` opens, given the favours' state. */
export function entryNode(r: ResidentDef, goalsDone: readonly string[], met: boolean): string {
  const ids = nodeIds(r.key);
  if (r.key === 'gripman' && taskState(goalsDone, 'baker') === 'on') return BREAD_NODE;
  const state = taskState(goalsDone, r.key);
  if (state === 'done') return ids.thanks;
  if (state === 'on') return ids.remind;
  return met ? ids.ask : ids.hi;
}

export function initResidentTasks(): () => void {
  for (const node of residentDialogue()) defineNode(node);
  const met = new Set<ResidentKey>();
  let pendingGo: string | null = null;
  /** favours finished while a chat was open: their thanks follows when it closes */
  let thankAfter: ResidentKey | null = null;
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
    say(TASK_TEXT.done(r.task.title).zh, TASK_TEXT.done(r.task.title).en, 'gold', 3400);
    if (tell) bubble(TASK_TEXT.tellThem(r.short), 3400);
    if (tasksDone(game.get().goalsDone) === RESIDENTS.length) setTimeout(() => say(TASK_TEXT.allDone.zh, TASK_TEXT.allDone.en, 'gold', 4200), 3600);
  }

  const afterChat = () => {
    const go = pendingGo, thank = thankAfter;
    pendingGo = null; thankAfter = null;
    if (thank) { playDialogue(nodeIds(thank).thanks); return; }
    if (go) navigateTo(go);
  };

  setResidentTalk(key => {
    const r = residentByKey(key);
    if (!r) return false;
    const s = game.get();
    // the favour may be done already (the card in hand): finish it and go straight to the thanks
    if (r.task.goal.kind === 'postcard' && taskState(s.goalsDone, r.key) === 'on' && goalMet(r.task.goal, sample(), bridgeLocal)) finish(r.key, false);
    const node = entryNode(r, game.get().goalsDone, met.has(r.key));
    // met = introduced themselves (a loaf handed over is not an introduction)
    if (node === nodeIds(r.key).hi) met.add(r.key);
    playDialogue(node, afterChat);
    return true;
  });

  const offEvents = onEvent(ev => {
    if (ev.type === 'dialogue') {
      if (ev.nodeId === BREAD_NODE) { finish('baker', false); return; }
      const m = /^npc\.([a-z-]+)\.(yes|go)$/.exec(ev.nodeId);
      const r = m ? residentByKey(m[1]) : undefined;
      if (!r) return;
      if (m![2] === 'yes') accept(r.key);
      else pendingGo = r.task.target.id;
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
    if (!done.length && lastDone.length) { met.clear(); pendingGo = null; thankAfter = null; }
    lastDone = done;
  });

  return () => { offEvents(); offFrame(); offReset(); setResidentTalk(null); };
}
