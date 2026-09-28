import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { charApi } from '../actors/charApi';
import { emit } from '../core/events';
import { runtime } from '../core/runtime';
import type { Bilingual } from '../core/types';
import { bubble } from '../game/flow';
import { flow } from '../game/flowStore';
import { registerSceneSystem } from '../game/systemsRegistry';
import { closeOverlay, openOverlay } from '../ui/slots';
import { spawnFx } from '../world/fx';
import { kDockSpots, type KDockSpot } from '../world/landmarks';
import { hideChip, patchChip, showChip } from './chip';
import { startActivity, tierFor, type ActivityRun } from './kit';
import { freeOnFoot, holdKeys, type HeldKeys } from './partc';
import { sayWhenQuiet } from './zones';
import { BADGE_OVERLAY, LION_ID, LION_NAME, lionIt, LION_PROMPT_R, LION_VIEW } from './zones3';

/**
 * Wave 5 · lane A · counting the sea lions at PIER 39 (W5-A9, plan §3.2 A-sealion): at the K-Dock rail (district anchor
 * `sea-lion-viewpoint`), 数海狮 turns the camera over the floats; tap each sea lion once (desktop: click it, or E for the
 * one nearest the middle of the screen) and it barks and gets its number. 数好了 ends it any time; all of them is ★. The
 * number is the toy dock's (the world's 19 lions), never a live count: BAYBAY's facts say how many came at most, when.
 *
 * The lions are the world's own (world/life.ts on world/landmarks.ts kDockSpots): nothing new is drawn, the numbers are
 * small HTML badges over them (SeaLionBadges.tsx, overlay `play-lion-badges`), placed each frame from this chunk's scene
 * system. A tap on a lion never walks the player there (the pointer is taken at the capture phase only when it hits one).
 *
 * Facts (https://www.pier39.com/sea-lions/, checked 2026-09-28): California sea lions began hauling out on K-Dock after
 * the October 1989 earthquake and took it over by January 1990; the all-time record, over 2,100, was in May–June 2024;
 * "it is unlawful for unauthorized persons to feed, handle or harass them".
 */

export const LION_LINES = {
  start: { zh: '一只、两只……一起数数有几只海狮！', en: 'One, two… let’s count the sea lions!' },
  all: { zh: '全数到啦！一只都没漏！', en: 'Every one of them — none missed!' },
  fact: { zh: '这些海狮 1990 年起就在 K 码头安家啦！', en: 'These sea lions have lived on K-Dock since 1990!' },
  record: { zh: '最多的时候来过 2100 多只呢——2024 年 5、6 月！', en: 'The record: over 2,100 of them, in May–June 2024!' },
} satisfies Record<string, Bilingual>;

/** Counted lions for ● / ◆ / ★ (★ = all of them). */
export function lionTier(n: number, total: number): 0 | 1 | 2 | 3 {
  return n >= total ? 3 : tierFor(n, [1, Math.ceil(total * 0.6), total]);
}
/** How near a tap must land to a lion's badge point (CSS px). */
export const TAP_R = 46;

interface Count { run: ActivityRun; spots: KDockSpot[]; order: number[]; n: number; screen: { x: number; y: number; on: boolean }[] }
let count: Count | null = null;
let keys: HeldKeys | null = null;
let offLayer: (() => void) | null = null;
let offTap: (() => void) | null = null;
let rounds = 0;

export const lionState = (): Readonly<Count> | null => count;
/** The badge overlay reads the lions' screen points and numbers from here each frame. */
export function lionBadges(): { x: number; y: number; n: number }[] {
  const c = count;
  if (!c) return [];
  return c.order.flatMap((n, i) => (n > 0 && c.screen[i]?.on ? [{ x: c.screen[i].x, y: c.screen[i].y, n }] : []));
}

/** 数海狮 (the prompt at the rail). Returns whether a count started. */
export function startSeaLions(): boolean {
  if (count || !freeOnFoot()) return false;
  const run = startActivity({ id: LION_ID, name: LION_NAME, better: 'higher' }, { lock: true, cancelOnMove: true, onStop: how => { if (how === 'cancel') cleanup(); } });
  if (!run) return false;
  rounds++;
  const spots = kDockSpots();
  count = { run, spots, order: spots.map(() => 0), n: 0, screen: spots.map(() => ({ x: 0, y: 0, on: false })) };
  runtime.camera.shot = lionShot(spots, typeof window !== 'undefined' && window.innerHeight > window.innerWidth);
  showChip({
    id: LION_ID, title: LION_NAME, icon: 'play', big: `0 / ${spots.length}`,
    line: runtime.input.device === 'touch' ? { zh: '点一下每只海狮', en: 'Tap each sea lion' } : { zh: '点海狮，或按 E', en: 'Click a sea lion, or press E' },
    action: { label: { zh: '数好了', en: 'Done' }, run: finishSeaLions },
  });
  if (rounds === 1) bubble(LION_LINES.start, 2800);
  lionIt.radius = 0;
  flow.set({ quietUntil: performance.now() + 20000 });
  openOverlay(BADGE_OVERLAY);
  offLayer = registerSceneSystem('a-play-lions', LionLayer);
  keys = holdKeys(['KeyE'], () => countNearestMiddle());
  return true;
}

/** Count lion i (a tap on it): its number, a bark, a ripple. False when it was counted already. */
export function countLion(i: number): boolean {
  const c = count;
  if (!c || !c.spots[i] || c.order[i] > 0) return false;
  c.order[i] = ++c.n;
  const s = c.spots[i];
  emit({ type: 'sea-lion', intensity: 1 });
  spawnFx('rings', s.x, s.y + 0.1, s.z, { scale: 0.7 });
  patchChip(LION_ID, { big: `${c.n} / ${c.spots.length}` });
  if (c.n === c.spots.length) finishSeaLions();
  return true;
}

/** E on a keyboard: the uncounted lion nearest the middle of the screen (in view). */
function countNearestMiddle() {
  const c = count;
  if (!c || typeof window === 'undefined') return;
  const mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let best = -1, bd = Infinity;
  c.screen.forEach((p, i) => { if (!p.on || c.order[i] > 0) return; const d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = i; } });
  if (best >= 0) countLion(best);
}

/** 数好了, or all counted: the card. */
export function finishSeaLions() {
  const c = count;
  if (!c) return;
  const total = c.spots.length, n = c.n;
  if (n === 0) { c.run.cancel(); return; }
  const first = rounds === 1;
  c.run.end({
    tier: lionTier(n, total),
    score: n,
    detail: { zh: `数到 ${n} 只海狮${n === total ? '——全数到了！' : ''}`, en: `${n} sea lions counted${n === total ? ' — all of them!' : ''}` },
    bestText: b => ({ zh: `上次数到 ${b} 只！`, en: `Last time: ${b}!` }),
  });
  cleanup();
  charApi()?.emote('baybay', 'clap');
  if (n === total) bubble(LION_LINES.all, 2400);
  // (not "don't feed them": lane D's egg at this rail says that one)
  sayWhenQuiet(first ? LION_LINES.fact : LION_LINES.record, 3000);
}

function cleanup() {
  count = null;
  keys?.off(); keys = null;
  offTap?.(); offTap = null;
  hideChip(LION_ID);
  closeOverlay(BADGE_OVERLAY);
  lionIt.radius = LION_PROMPT_R;
  runtime.camera.shot = null;
  const off = offLayer;
  offLayer = null;
  setTimeout(() => off?.(), 50);
}

/** 不数了 / tests */
export function cancelSeaLions() { count?.run.cancel(); }

// --- the scene system: the lions' screen points, and taps on them -----------------------------------------------------

const v3 = new THREE.Vector3();

/** Where each lion shows on screen now (CSS px), from the camera (tests pass their own). */
export function projectLions(camera: THREE.Camera, width: number, height: number) {
  const c = count;
  if (!c) return;
  c.spots.forEach((s, i) => {
    v3.set(s.x, s.y + 0.55, s.z).project(camera);
    c.screen[i] = { x: (v3.x + 1) / 2 * width, y: (1 - v3.y) / 2 * height, on: v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05 };
  });
}

/** A tap at (x, y) CSS px: the nearest uncounted lion within TAP_R, counted (true), else nothing (false). */
export function tapAt(x: number, y: number): boolean {
  const c = count;
  if (!c) return false;
  let best = -1, bd = TAP_R;
  c.screen.forEach((p, i) => { if (!p.on || c.order[i] > 0) return; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
  return best >= 0 && countLion(best);
}

function LionLayer() {
  const camera = useThree(st => st.camera), gl = useThree(st => st.gl), size = useThree(st => st.size);
  useEffect(() => {
    const canvas = gl.domElement;
    const down = (e: PointerEvent) => {
      if (e.target !== canvas) return;
      const r = canvas.getBoundingClientRect();
      if (tapAt(e.clientX - r.left, e.clientY - r.top)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('pointerdown', down, true);
    offTap = () => window.removeEventListener('pointerdown', down, true);
    return () => { window.removeEventListener('pointerdown', down, true); };
  }, [gl]);
  useFrame(() => projectLions(camera, size.width, size.height));
  return null;
}

/** tests */
export function __resetLions() { count?.run.cancel(); count = null; rounds = 0; }

/**
 * The camera over the dock, every lion in view (tests/opus-bay-w5-play-acts: ≥ 17 of 19 on a 390 × 844 portrait screen
 * and on a desktop): behind the rail looking down on a landscape screen; on a portrait one, from the west end of the
 * floats along their long side, higher, so the lions stack up the screen instead of running off its sides.
 */
export function lionShot(spots: readonly { x: number; z: number }[], portrait: boolean): NonNullable<typeof runtime.camera.shot> {
  const cx = spots.reduce((a, s) => a + s.x, 0) / (spots.length || 1), cz = spots.reduce((a, s) => a + s.z, 0) / (spots.length || 1);
  const v = LION_VIEW;
  if (!portrait) {
    const dx = v.x - cx, dz = v.z - cz, L = Math.hypot(dx, dz) || 1;
    return { position: [v.x + (dx / L) * 6, 7.5, v.z + (dz / L) * 6], target: [cx, -0.4, cz], duration: 0.9 };
  }
  let sxx = 0, szz = 0, sxz = 0;
  for (const s of spots) { const a = s.x - cx, b = s.z - cz; sxx += a * a; szz += b * b; sxz += a * b; }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ax = Math.cos(ang), az = Math.sin(ang), px = -az, pz = ax;
  const side = Math.sign((v.x - cx) * px + (v.z - cz) * pz) || 1;
  return { position: [cx - ax * 13 + px * 3.5 * side, 10, cz - az * 13 + pz * 3.5 * side], target: [cx, -0.4, cz], duration: 0.9 };
}
