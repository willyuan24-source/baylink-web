import { emit } from '../core/events';
import { runtime, type Emote } from '../core/runtime';
import { game } from '../core/store';
import { canStand, pointInPolygon, zoneAt } from '../core/terrain';
import type { Vec2 } from '../core/types';
import { DISTRICT } from '../data/district';
import { POIS } from '../data/pois';
import { STOP_PROMPTS } from '../data/script';
import {
  boardPosition, bubble, currentStop, freeLeadArrived, introPending, lastLeadCall, nextFreeGoal, maybeStartIntro, openCallMenu, performInteraction, stageMark, talkMark, tourArrived, weekArrived, welcomeMark,
} from './flow';
import { bark } from './content';
import { flow } from './flowStore';
import { BAYBAY_ID, interactableById, interactables, postcardIdOf, syncMoving } from './interactables';

/**
 * 10 Hz decision systems: focus detection, pending-interact trigger, area label, and the guide brain.
 * They only write runtime.guide intent (state/target/run/emote); actors/ execute movement.
 */

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const P = () => ({ x: runtime.player.x, z: runtime.player.z });
const G = () => ({ x: runtime.guide.x, z: runtime.guide.z });

// ---------------------------------------------------------------------------
// Focus + area + pending interact
// ---------------------------------------------------------------------------

let lastPos = { x: NaN, z: NaN };
let lastArea: string | null | undefined;
/** City-mode area names by zone id (the DataSF neighbourhoods are not in DISTRICT.zones); the HUD label reads it. */
export const AREA_NAMES = new Map<string, { zh: string; en: string }>();

export function updateFocus() {
  const s = game.get();
  const p = P();
  // low-frequency player position for UI (map)
  if (!(Math.abs(p.x - lastPos.x) < 0.35 && Math.abs(p.z - lastPos.z) < 0.35)) { lastPos = p; game.set({ playerPos: p }); }

  // area label (city mode: hero zones first, then the DataSF neighbourhood, via core/terrain zoneAt)
  let area: string | null = null;
  let named: { id: string; name: { zh: string; en: string } } | null = null;
  if (s.worldMode === 'city') { named = zoneAt(p.x, p.z); area = named?.id ?? null; }
  else for (const zone of DISTRICT.zones ?? []) if (zone.polygon?.length > 2 && pointInPolygon(p, zone.polygon)) { area = zone.id; break; }
  if (area !== lastArea) {
    lastArea = area;
    if (named) AREA_NAMES.set(named.id, named.name);
    game.set({ area });
    const zone = DISTRICT.zones.find(item => item.id === area) ?? named;
    if (zone) emit({ type: 'area', name: zone.name.en });
  }

  const mapTarget = flow.get().mapTarget;
  if (mapTarget) { const it = interactableById(mapTarget); if (!it || dist(p, it) < it.radius + 2) flow.set({ mapTarget: null }); }

  const f = flow.get();
  const blocked = s.phase !== 'playing' || s.photoMode || s.riding !== null || !!s.dialogue.nodeId || !!f.fishing || !!f.cinematic || !!f.postcardReward || !!f.postcardFly;
  if (blocked) { if (s.focus !== null) game.set({ focus: null }); return; }

  // pending click-to-interact
  const pending = runtime.player.pendingInteract;
  if (pending) {
    const it = interactableById(pending);
    if (!it || (it.source === 'postcard' && s.postcards.includes(postcardIdOf(it)))) runtime.player.pendingInteract = null;
    else {
      const d = dist(p, it);
      const pathDone = runtime.player.pathTarget === null;
      if (d <= it.radius + 0.35 || (pathDone && d <= it.radius + 3)) { performInteraction(pending); return; }
      if (pathDone && d > it.radius + 3) runtime.player.pendingInteract = null;
    }
  }

  const cur = currentStop();
  const tourTarget = s.tour.active ? cur?.poi.id : undefined;
  // F7: a stop whose moment is done (its lines / card are playing) is not offered again until the tour moves on
  const tourPhase = flow.get().tourPhase;
  const finished = s.tour.active && cur && (tourPhase === 'done-node' || tourPhase === 'card') ? cur.poi.id : undefined;
  let best: string | null = null, bestScore = Infinity;
  for (const it of interactables()) {
    if (it.source === 'postcard' && s.postcards.includes(postcardIdOf(it))) continue;
    if (finished && it.id === finished) continue;
    // …and a stop the tour already finished stays quiet while the tour leads on (no stale "E 抬头看钟楼")
    if (s.tour.active && it.id !== tourTarget && s.tour.completed.includes(it.id)) continue;
    // BAYBAY / the jogger move: live position; the jogger only while paused at a loop end (or already talking)
    if (!syncMoving(it)) continue;
    const d = Math.hypot(p.x - it.x, p.z - it.z);
    if (d > it.radius) continue;
    let score = d / it.radius;
    if (it.source === 'postcard') score -= 0.25;
    if (it.id === tourTarget) score -= 0.35;
    if (it.source === 'baybay') score += 0.2;
    if (score < bestScore) { bestScore = score; best = it.id; }
  }
  if (best !== s.focus) game.set({ focus: best });
}

// ---------------------------------------------------------------------------
// Guide brain
// ---------------------------------------------------------------------------

let lastTarget: Vec2 | null = null;
let waiting = false;
let lastWave = 0;
// F2: bark escalation while BAYBAY leads and the player stands still
let lastWaitLine = '';
let ledIdleSince = 0;
let lastNudgeAt = -Infinity;
let lastHint = 0;
let playerAtStopSince = 0;
let lastIdleEmote = 0;
let stillSince = 0;
let lastBarkAt = 0;
let playingSince = 0;
let timeBarked = false;
let welcomeWaved = false;
const barkedAt = new Map<string, number>();

function setTarget(t: Vec2 | null, minMove = 0.8) {
  const g = runtime.guide;
  if (!t) { g.target = null; lastTarget = null; return; }
  if (lastTarget && dist(lastTarget, t) < minMove && g.target) return;
  lastTarget = { x: t.x, z: t.z };
  g.target = lastTarget;
}

function emote(e: Emote) {
  runtime.guide.emote = e;
  if (e !== 'none') emit({ type: 'emote', who: 'baybay', emote: e });
}

let slotSide = 1;
/** Beside the player as the camera sees it: keep the current side unless it is blocked; else the freer side. */
function sideSlot(): Vec2 {
  const p = runtime.player, g = runtime.guide, yaw = runtime.camera.yaw;
  const rx = Math.cos(yaw), rz = -Math.sin(yaw); // camera right
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw); // away from the camera
  const lateral = (g.x - p.x) * rx + (g.z - p.z) * rz;
  if (Math.abs(lateral) > 1) slotSide = lateral > 0 ? 1 : -1;
  const slot = (side: number) => ({ x: p.x + rx * 2 * side + fx * 0.6, z: p.z + rz * 2 * side + fz * 0.6 });
  const here = slot(slotSide);
  if (canStand(here.x, here.z, 0.45)) return here;
  const other = slot(-slotSide);
  if (canStand(other.x, other.z, 0.45)) { slotSide = -slotSide; return other; }
  return { x: p.x + fx * 1.5, z: p.z + fz * 1.5 };
}

/** A point `gap` units from `dest` towards `from` (so BAYBAY stands beside things, not inside them). */
function beside(dest: Vec2, from: Vec2, gap: number): Vec2 {
  const d = dist(dest, from);
  if (d < 0.01) return { x: dest.x + gap, z: dest.z };
  return { x: dest.x + ((from.x - dest.x) / d) * gap, z: dest.z + ((from.z - dest.z) / d) * gap };
}

/**
 * Standing still while BAYBAY leads: at most one wait bark per 10 s (never the same line twice, never within 3 s of
 * "跟我来"; in practice one per 12 s), a how-to-move nudge after 8 s, and after 20 s a one-tap "让 BAYBAY 带我过去" chip.
 */
function ledIdle(now: number) {
  const pl = runtime.player;
  const idle = !pl.moving && !pl.pathTarget && !pl.locked;
  if (!idle) { ledIdleSince = 0; if (flow.get().leadChip) flow.set({ leadChip: false }); return 0; }
  if (!ledIdleSince) ledIdleSince = now;
  const idleFor = now - ledIdleSince;
  if (idleFor > 8000 && now - lastNudgeAt > 30000 && !flow.get().bubble) {
    lastNudgeAt = now;
    const line = bark(runtime.input.device === 'touch' ? 'nudgeTouch' : 'nudge');
    if (line) { bubble(line, 4200, BAYBAY_ID, 'call'); emote('point'); }
  }
  if (idleFor > 20000 && !flow.get().leadChip) flow.set({ leadChip: true });
  return idleFor;
}

function waitBark(now: number) {
  if (now - lastWave < 12000 || now - lastNudgeAt < 16000 || now - lastLeadCall() < 5000) return;
  lastWave = now;
  emote('wave');
  let line = bark('wait');
  for (let i = 0; i < 4 && line && line.zh === lastWaitLine; i++) line = bark('wait');
  if (!line || line.zh === lastWaitLine) return;
  lastWaitLine = line.zh;
  bubble(line, 2600, BAYBAY_ID, 'call');
}

function lead(now: number, dest: Vec2, radius: number, onArrive: () => void) {
  const g = runtime.guide, p = P(), gp = dist(G(), p);
  const guideToDest = dist(G(), dest), playerToDest = dist(p, dest);
  ledIdle(now);
  if (!waiting && gp > 12 && guideToDest < playerToDest) waiting = true;
  if (waiting && (gp < 7 || guideToDest > playerToDest + 2)) waiting = false;
  if (waiting) {
    g.state = 'wait';
    setTarget(null);
    g.run = false;
    waitBark(now);
    return;
  }
  g.state = 'lead';
  setTarget(beside(dest, p, Math.min(2, radius * 0.5)));
  // match the player's pace; hurry only when the player is right behind
  g.run = runtime.player.running || (gp < 5 && guideToDest > 25);
  const playerThere = playerToDest < radius + 1.2;
  if (playerThere && !playerAtStopSince) playerAtStopSince = now;
  if (!playerThere) playerAtStopSince = 0;
  if (playerThere && (guideToDest < 6 || runtime.guide.arrived || now - playerAtStopSince > 3500)) { playerAtStopSince = 0; onArrive(); }
}

let freeSince = 0;
let hintAt = 0;
/**
 * F8: after ~8 s of free roam with nothing else on screen, a soft waypoint points at the nearest unfinished goal
 * (re-picked every couple of seconds as you move; dismissable; gone while a card / dialogue / goals list is up).
 */
function freeHint(now: number) {
  const s = game.get(), f = flow.get();
  if (s.mode !== 'free' || s.tour.active) { freeSince = 0; if (f.freeHint) flow.set({ freeHint: null }); return; }
  if (!freeSince) freeSince = now;
  if (now - hintAt < 2000) return;
  hintAt = now;
  const allowed = now - freeSince > 8000 && performance.now() > f.freeHintOffUntil && !f.mapTarget && performance.now() > f.quietUntil;
  const next = allowed ? nextFreeGoal() : null;
  const cur = f.freeHint;
  if (!next) { if (cur) flow.set({ freeHint: null }); return; }
  if (!cur || cur.id !== next.id || cur.name.zh !== next.name.zh) flow.set({ freeHint: { id: next.id, x: next.x, z: next.z, name: next.name } });
}

function follow(now: number) {
  const g = runtime.guide, p = runtime.player;
  const gp = dist(G(), P());
  g.state = 'follow';
  // F15: a camera-space side slot (±2u beside the player, 0.6u beyond) instead of trailing behind the heading —
  // she stays in frame, beside you, not under the HUD at the bottom of the screen
  if (p.moving || gp > 5.5) { setTarget(sideSlot(), 1.2); stillSince = 0; }
  else {
    if (!stillSince) stillSince = now;
    if (gp < 5.5 && g.arrived) setTarget(null);
  }
  g.run = gp > 6 || p.running;
  const quiet = performance.now() < flow.get().quietUntil;
  // once per visit, a line about the light right now (morning fog, golden hour, night lights)
  if (!quiet && !timeBarked && playingSince && now - playingSince > 20000 && !flow.get().bubble && gp < 10) {
    const line = bark(game.get().timeOfDay);
    timeBarked = true;
    if (line) { bubble(line, 4200); emote('wave'); return; }
  }
  // idle personality when the player stands still for a while
  if (!quiet && stillSince && now - stillSince > 6000 && now - lastIdleEmote > 9000 && gp < 8) {
    lastIdleEmote = now;
    const pool: Emote[] = ['wave', 'hop', 'think', 'shrug'];
    emote(pool[Math.floor(Math.random() * pool.length)]);
    const line = Math.random() < 0.5 ? bark('idle') : undefined;
    if (line && !flow.get().bubble) bubble(line, 3600);
  }
  if (!quiet) barks(now);
}

function barks(now: number) {
  if (now - lastBarkAt < 12000) return;
  const p = P();
  for (const poi of POIS) {
    if (!poi.bark) continue;
    if (dist(p, poi.position) > (poi.radius || 3) + 5) continue;
    if (now - (barkedAt.get(poi.id) ?? -Infinity) < 120000) continue;
    barkedAt.set(poi.id, now);
    lastBarkAt = now;
    bubble(poi.bark, 3800);
    emote('point');
    return;
  }
}

let seenEmote: string = 'none';
let emoteSince = 0;

/** Emotes are one-shots: clear them after a moment so actors never loop one forever. */
function expireEmote(now: number, talking: boolean) {
  const g = runtime.guide;
  if (g.emote !== seenEmote) { seenEmote = g.emote; emoteSince = now; }
  if (g.emote !== 'none' && !talking && now - emoteSince > 2200) { g.emote = 'none'; seenEmote = 'none'; }
}

export function updateGuide(now: number) {
  const g = runtime.guide;
  const s = game.get(), f = flow.get();
  expireEmote(now, !!s.dialogue.nodeId);
  const gp = dist(G(), P());
  // arrival cinematic: BAYBAY already walks to her welcome mark so she is there, waving, when it ends
  if (s.phase === 'arrival') { g.state = 'idle'; setTarget(welcomeMark(), 0.5); g.run = false; playingSince = 0; welcomeWaved = false; return; }
  if (s.phase !== 'playing') { g.state = 'idle'; setTarget(null); g.run = false; playingSince = 0; return; }
  if (!playingSince) playingSince = now;
  if (s.dialogue.nodeId || f.fishing) {
    // hold her mark in the welcome / at a tour stop (the two-shot is built around it); otherwise stand and talk
    g.state = 'talk';
    setTarget(s.dialogue.nodeId ? talkMark() : null, 0.5);
    g.run = false;
    return;
  }
  // riding anything: the movement system carries her (basket, front seat, pelican), so no lead targets
  const carried = s.move.mode === 'bike' || s.move.mode === 'car' || s.move.mode === 'glide' || s.move.mode === 'travel';
  if (s.riding || carried) { g.state = 'idle'; setTarget(null); return; }
  if (f.callPending) {
    g.state = 'follow';
    setTarget(beside(P(), G(), 1.8), 0.6);
    g.run = true;
    if (gp < 2.9) openCallMenu();
    return;
  }
  if (introPending()) {
    // welcome: BAYBAY stands on her mark (toward the clock tower), waves once, then the welcome opens
    g.state = 'idle';
    const mark = welcomeMark();
    setTarget(mark, 0.5);
    g.run = dist(G(), mark) > 8;
    const atMark = dist(G(), mark) < 1.2 || g.arrived;
    if (atMark && !welcomeWaved) { welcomeWaved = true; emote('wave'); }
    maybeStartIntro(gp, atMark);
    return;
  }
  if (s.tour.active) {
    const cur = currentStop();
    if (cur) {
      if (f.tourPhase === 'leading') { lead(now, cur.poi.position, cur.poi.radius || 3, tourArrived); return; }
      if (f.tourPhase === 'arrived' || f.tourPhase === 'await' || f.tourPhase === 'done-node' || f.tourPhase === 'card') {
        g.state = gp < 6 ? 'talk' : 'idle';
        g.run = false;
        setTarget(stageMark(cur.poi), 1.5);
        if (f.tourPhase === 'await' && now - lastHint > 14000 && dist(P(), cur.poi.position) < 14) {
          lastHint = now;
          emote('point');
          bubble(STOP_PROMPTS[cur.poi.id] ?? { zh: `到金圈里「${cur.poi.interaction.verb.zh}」～`, en: `Here — ${cur.poi.interaction.verb.en.toLowerCase()}!` }, 3000, BAYBAY_ID, 'call');
        }
        return;
      }
    }
  }
  if (s.mode === 'week' && f.weekStage === 'walking') {
    const board = boardPosition();
    if (board) { lead(now, board, 3.5, weekArrived); return; }
  }
  if (s.mode === 'free' && f.freeLead) {
    const it = interactableById(f.freeLead);
    if (it) { lead(now, it, Math.min(it.radius, 3.5), freeLeadArrived); return; }
    flow.set({ freeLead: null });
  }
  freeHint(now);
  follow(now);
}

/** Test/QA helper. */
export function resetBrain() {
  lastTarget = null; waiting = false; lastWave = 0; lastHint = 0; playerAtStopSince = 0; lastIdleEmote = 0; stillSince = 0; lastBarkAt = 0; lastArea = undefined;
  lastWaitLine = ''; ledIdleSince = 0; lastNudgeAt = -Infinity; freeSince = 0; hintAt = 0;
  playingSince = 0; timeBarked = false; seenEmote = 'none'; emoteSince = 0; lastPos = { x: NaN, z: NaN }; welcomeWaved = false;
  barkedAt.clear();
}
