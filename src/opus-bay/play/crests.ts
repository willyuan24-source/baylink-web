import { useFrame, useThree } from '@react-three/fiber';
import { createElement, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { charApi } from '../actors/charApi';
import { playSound } from '../audio/hooks';
import { runtime } from '../core/runtime';
import { heightAt } from '../core/terrain';
import type { Bilingual } from '../core/types';
import { bubble } from '../game/flow';
import { registerSceneSystem } from '../game/systemsRegistry';
import { downloadUrl } from '../game/photo';
import { openOverlay } from '../ui/slots';
import { spawnFx } from '../world/fx';
import { CREST_KEY, CREST_SPOTS } from './crestSpots';
import { bestOf, saveNumber, startActivity, type ActivityRun, type Tier } from './kit';
import { ensurePlaySounds3 } from './sounds3';
import { commitToy, registerToyWarmup, toyMesh } from './toyMesh';
import { SNAP_OVERLAY } from './zones3';

/**
 * Wave 5 · lane A · crest hops (W5-A9, plan §3.2 A-crest): 12 hill crests across the city (play/crestSpots.ts), each
 * marked by two pennants at the street's edges, where the toy car or the bike leaves the ground at speed (lane F's crest
 * hop, `vehicle:hop` with `crest: true`; zones3.ts matches it to a spot). Style, never speed: every crest counts once,
 * there is no clock. A hop there spins its pennants, BAYBAY cheers, and a snapshot is taken at the top of the hop — a
 * small polaroid on the card (保存照片; nothing is saved unless you tap it) or, hopping a crest again, on its own
 * (CrestSnap.tsx, overlay `play-snap`). The first hop at each crest: its pennants turn gold and the card counts them
 * (● the first crest, ◆ 6, ★ all 12); the set is kept in `play.b`.
 *
 * The pennants: ONE InstancedMesh (play/toyMesh.ts 'pennant', +1 draw call while a crest is within PENNANT_R, 22
 * triangles each, ≤ 24), own material on the tinted instanced program, warmed as this chunk loads. The plan's 0.5 s
 * slow motion needs a frame-clock hook the game does not have (Requests: F); the snapshot stands in for it.
 */

registerToyWarmup('pennant');
ensurePlaySounds3();

export const CREST_ID = 'crests';
export const CREST_NAME: Bilingual = { zh: '坡顶飞跃', en: 'Crest hops' };
/** Crests hopped for ● / ◆ / ★. */
export const CREST_TIERS: readonly [number, number, number] = [1, 6, 12];
export const PENNANT_R = 160;
export const CREST_LINES = {
  first: { zh: '呜呼——飞起来啦！插小旗的就是坡顶！', en: 'Woohoo — we flew! The pennants mark the crests!' },
  again: { zh: '再飞一次！', en: 'Up we go again!' },
  all: { zh: '全城 12 个坡顶都飞过啦！', en: 'All 12 crests in the city — hopped!' },
} satisfies Record<string, Bilingual>;

let mask: number | null = null;
/** The crests hopped so far (bit i = spot i; this session or the save's `play.b`). */
export function crestMask(): number { return (mask ??= Math.max(0, Math.floor(bestOf(CREST_KEY) ?? 0))); }
export const crestCount = (m = crestMask()) => CREST_SPOTS.reduce((n, _s, i) => n + ((m >> i) & 1), 0);
export function crestTier(count: number): 0 | Tier {
  return count >= CREST_TIERS[2] ? 3 : count >= CREST_TIERS[1] ? 2 : count >= CREST_TIERS[0] ? 1 : 0;
}

/** The new crest's card waits this long for its snapshot. */
export const CARD_WAIT_MS = 1500;
let pending: { run: ActivityRun; tier: 0 | Tier; detail: Bilingual } | null = null;
function flushCard(url: string | null) {
  const p = pending;
  if (!p) return;
  pending = null;
  const name = `opus-bay-crest-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`;
  p.run.end({ tier: p.tier, detail: p.detail, ...(url ? { photo: { url, save: () => downloadUrl(url, name) } } : {}) });
}

const spin = new Map<number, number>();
let snapAt = 0;
let snapCaption: Bilingual | null = null;
let hops = 0;

/** A crest hop at spot `i` (zones3.ts calls it on `vehicle:hop` with `crest: true` within CREST_R of a spot). */
export function crestHop(i: number): void {
  const s = CREST_SPOTS[i];
  if (!s) return;
  hops++;
  spin.set(i, 1.2);
  playSound('play-pop', { pitch: 1.2 });
  spawnFx('sparkle', s.x, heightAt(s.x, s.z) + 1.4, s.z, { color: '#ffd27a', scale: 1, count: 12 });
  charApi()?.emote('baybay', 'cheer');
  snapAt = performance.now() + 250;
  snapCaption = s.name;
  const m = crestMask(), bit = 1 << i;
  if (m & bit) { bubble(CREST_LINES.again, 1800); return; }
  mask = m | bit;
  saveNumber(CREST_KEY, mask);
  const count = crestCount(mask);
  const run = startActivity({ id: CREST_ID, name: CREST_NAME });
  // the card waits for the snapshot (it carries the polaroid), at most CARD_WAIT_MS
  if (run) {
    pending = { run, tier: crestTier(count), detail: { zh: `坡顶飞跃 ${count} / ${CREST_SPOTS.length} · ${s.name.zh}`, en: `Crests ${count} / ${CREST_SPOTS.length} · ${s.name.en}` } };
    setTimeout(() => flushCard(null), CARD_WAIT_MS);
  }
  bubble(count === CREST_SPOTS.length ? CREST_LINES.all : count === 1 ? CREST_LINES.first : CREST_LINES.again, 2600);
}

// --- the pennants, and the snapshot ----------------------------------------------------------------------------------

let offLayer: (() => void) | null = null;
/** zones3.ts: a crest is within PENNANT_R (the layer is mounted) or none is. */
export function setCrestsNear(on: boolean) {
  if (on && !offLayer) offLayer = registerSceneSystem('a-play-crests', CrestLayer);
  else if (!on && offLayer) { offLayer(); offLayer = null; }
}

const HOPPED = new THREE.Color('#f2c14e'), RED = new THREE.Color('#e05a4a'), TEAL = new THREE.Color('#2f8f88');
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);

/** One frame: two pennants at the kerbs of each crest within PENNANT_R (they flutter; a hop spins them round). */
export function updatePennants(mesh: THREE.InstancedMesh, t: number, dt: number) {
  const p = runtime.player, m = crestMask();
  let n = 0;
  CREST_SPOTS.forEach((s, i) => {
    if (Math.hypot(s.x - p.x, s.z - p.z) > PENNANT_R) return;
    const left = spin.get(i) ?? 0;
    if (left > 0) spin.set(i, left - dt);
    const turn = left > 0 ? (1 - left / 1.2) * Math.PI * 2 : 0;
    const rx = Math.cos(s.heading), rz = -Math.sin(s.heading);
    for (const side of [1, -1]) {
      // a hair inside the kerb, on the street's edge (the fronts come right down to the kerb on these hills)
      const d = Math.max(0.9, (side > 0 ? s.kerbR : s.kerbL) - 0.3);
      const x = s.x + rx * d * side, z = s.z + rz * d * side;
      // the flags point in over the street (face-on to a car coming up), fluttering
      e.set(0, s.heading + (side > 0 ? Math.PI : 0) + Math.sin(t * 5 + i * 1.7 + side) * 0.35 + turn, 0);
      mesh.setMatrixAt(n, m4.compose(pos.set(x, heightAt(x, z), z), q.setFromEuler(e), one));
      mesh.setColorAt(n++, (m >> i) & 1 ? HOPPED : side > 0 ? RED : TEAL);
    }
  });
  commitToy(mesh, n);
}

let lastUrl: string | null = null;
/** A small polaroid of the frame just drawn (called in a microtask right after the render, like game/photo.ts). */
function snapshot(source: HTMLCanvasElement, caption: Bilingual) {
  // a 4:3 crop of the middle (a portrait phone frame keeps its middle band), 480 × 360
  const W = 480, H = 360, sw = source.width, sh = source.height;
  const cw = Math.min(sw, (sh * 4) / 3), ch = Math.min(sh, (sw * 3) / 4);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, W, H);
  c.toBlob(blob => {
    if (!blob) return;
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(blob);
    if (pending) flushCard(lastUrl); else openOverlay(SNAP_OVERLAY, { url: lastUrl, caption });
  }, 'image/jpeg', 0.9);
}

function CrestLayer() {
  const gl = useThree(st => st.gl);
  const mesh = useMemo(() => toyMesh('pennant', 'pennant', CREST_SPOTS.length * 2), []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.dispose(); }, [mesh]);
  useFrame((st, dt) => {
    updatePennants(mesh, st.clock.elapsedTime, Math.min(0.1, dt));
    if (snapAt && performance.now() >= snapAt && snapCaption) {
      const caption = snapCaption, canvas = gl.domElement;
      snapAt = 0;
      queueMicrotask(() => { try { snapshot(canvas, caption); } catch (error) { if (import.meta.env?.DEV) console.warn('[opus-bay play] snapshot', error); } });
    }
  });
  return createElement('primitive', { object: mesh });
}

/** tests */
export function __resetCrests() { mask = null; spin.clear(); snapAt = 0; snapCaption = null; hops = 0; pending = null; }
/** tests: the card now (as if the snapshot never came) */
export function __flushCrestCard() { flushCard(null); }
export const crestHops = () => hops;
