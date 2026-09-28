import * as THREE from 'three';
import { charApi } from '../actors/charApi';
import type { AudioEngine } from '../audio/engine';
import { duck, registerLoop, setLoop, type LoopHandle } from '../audio/hooks';
import { emit, onEvent } from '../core/events';
import { runtime } from '../core/runtime';
import { game } from '../core/store';
import type { Bilingual, Vec2 } from '../core/types';
import { isPaid } from '../economy/ledger';
import { bayNow, bayParts } from '../game/bayNow';
import { faceCameraToward } from '../game/cinema';
import { enterPhotoMode, openEvent } from '../game/flow';
import { flow } from '../game/flowStore';
import { invalidateInteractables, registerInteractables, type Interactable } from '../game/interactables';
import { registerFrameSystem } from '../game/systemsRegistry';
import { BOX, CONE, CYL, ICO, M, Batch } from '../world/builder';
import { cityStreamerLazy } from '../world/cityLoader';
import { patchToyShader } from '../world/materials';
import { instancedWarmup, meshWarmup, registerWarmup } from '../world/warmup';
import { getWorld, type WorldSystem } from '../world/world';
import { venueById } from './eventVenues';
import type { OfferedLine } from './lines';
import { atMinute } from './todayRows';

/**
 * Wave 5 · lane R (W5-R6) · Fleet Week over the Bay (plan §3.3 item 6).
 *
 * San Francisco Fleet Week's air show flies October 9, 10 and 11, 2026, 12:00–16:00, "between the Golden Gate Bridge and
 * Alcatraz"; Marina Green is the festival centre, free (https://fleetweeksf.org/air-show/, checked 2026-09-28; the
 * window is the Marina Green row of realsf/eventVenues.ts, so there is one source of truth). Thursday's practice day is
 * secondary and not shown.
 *
 * In the game, during that window only and within 1,500 u of the air box:
 *   - six toy jets (four at quality mid / low, i.e. phones) in blue-and-gold toy paint, no insignia, no logos, no
 *     lettering, flying one closed spline loop in formation over the water off Crissy Field, Marina Green and Aquatic
 *     Park: a low pass along the shore, a climbing turn over the top, the far line back and a banked turn home. The
 *     path is over open water, ≥ 20 u above everything, ≥ 150 u from the bridge towers and Alcatraz (tests), so nothing
 *     can collide; the position follows the Bay clock, so every player sees the same pass at the same minute.
 *   - one smoke-ribbon mesh (a white trail behind each jet, tapering to nothing).
 *   - ≤ 2 draw calls and ≤ 2.5k triangles: the jets are ONE InstancedMesh on a toy material keyed like TOY_INST (no new
 *     program), the smoke one plain Mesh on its own transparent basic material (the one new program), both warmed
 *     through world/warmup.ts.
 *   - a synthesized roar (brown rumble + a whoosh that brightens as they come) through audio/hooks.ts, heard within
 *     600 u; the music ducks while it is loud.
 *   - BAYBAY's line once on each show day (今天中午到下午四点，湾上有飞行表演，去码头绿地看！) and the waypoint to Marina
 *     Green; near the show: 飞机编队来啦！打开拍照，把它们拍下来吧～
 *   - the photo subject 飞机编队 at Marina Green (E: 拍飞机编队 → photo mode facing the jets): the first photo with the
 *     formation in frame pays the Fleet Week 2026 stamp + 15 coins (`reward` `event:fleet-week-2026-jets`, lane E's
 *     ledger; never for sale). The Marina Green venue keeps its own 看看活动 prompt (the EventCard of
 *     `san-francisco-fleet-week-2026`).
 *   - the pelican is turned back gently from the air box (lane F's charApi glideSoftBox): 我们在旁边看就好～
 *
 * Cut rule (plan D9): in the owner's build by Wed Oct 7 20:00 PT, else it becomes 2027 calendar config.
 */

export const JETS_EVENT = 'san-francisco-fleet-week-2026';
/** the stamp's reward id (appended to SOUVENIR_IDS) */
export const JETS_SOUVENIR = 'fleet-week-2026-jets';
export const JETS_SOURCE = { sourceUrl: 'https://fleetweeksf.org/air-show/', verifiedAt: '2026-09-28' } as const;

/** The show's windows by Bay date (minutes after midnight), from the Marina Green venue row. */
export function jetWindows(): Readonly<Record<string, readonly [number, number]>> {
  return venueById('marina-green')?.hours?.[JETS_EVENT] ?? {};
}

/** The show's window on the Bay day of `date` (instants, ms), or null. */
export function jetWindowOn(date: Date = bayNow()): { open: number; close: number } | null {
  const day = bayParts(date).dateKey;
  const h = jetWindows()[day];
  if (!h) return null;
  const open = atMinute(day, h[0]), close = atMinute(day, h[1]);
  return Number.isFinite(open) && Number.isFinite(close) ? { open, close } : null;
}

/** The jets fly now (Oct 9–11, 12:00–16:00 Bay time). */
export function jetsUp(date: Date = bayNow()): boolean {
  const w = jetWindowOn(date);
  return !!w && date.getTime() >= w.open && date.getTime() < w.close;
}

// ---------------------------------------------------------------------------------------------------------------
// The air box and the loop
// ---------------------------------------------------------------------------------------------------------------

/**
 * The show frame (city units): the centre 600 m off Marina Green's seawall (37.8130, -122.4365 projected with
 * core/geo.ts projectCity), `a` along the shore toward Aquatic Park and Alcatraz, `o` out over the water.
 */
export const AIR_BOX = { c: { x: -431, z: 209 }, a: { x: 0.695, z: -0.719 }, o: { x: -0.719, z: -0.695 } } as const;
export const toWorld = (a: number, o: number): Vec2 => ({ x: AIR_BOX.c.x + a * AIR_BOX.a.x + o * AIR_BOX.o.x, z: AIR_BOX.c.z + a * AIR_BOX.a.z + o * AIR_BOX.o.z });

/**
 * The loop's control points (a, o, y): the low pass along the shore (≈ 45 u off Marina Green's seawall, 7–12 u over the
 * water, so it crosses the view of a camera that looks down at the player), a wingover at the Aquatic Park end, the far
 * line back and a banked turn home off Crissy Field.
 */
export const LOOP_POINTS: readonly (readonly [number, number, number])[] = [
  [-240, -20, 22], [-130, -34, 9.5], [-20, -36, 7.5], [80, -20, 12],
  [150, 12, 28], [200, 24, 40], [180, 40, 52],
  [115, 58, 38], [45, 92, 22],
  [-60, 120, 17], [-170, 132, 18], [-262, 106, 34], [-302, 44, 34],
];

/** Show speed (u/s), the felt gravity for the banking (u/s²) and the table's resolution (u). */
export const JET_SPEED = 30;
const G = 24;
const STEP = 2;

export interface PathTable { length: number; n: number; pos: Float32Array; fwd: Float32Array; up: Float32Array }

let tableCache: PathTable | null = null;
/**
 * The loop sampled every STEP u of arc length: position, forward, and the jets' up — the felt lift (the path's
 * acceleration at JET_SPEED plus gravity), so they bank into turns and roll over the top — smoothed along the loop.
 */
export function pathTable(): PathTable {
  if (tableCache) return tableCache;
  const pts = LOOP_POINTS.map(([a, o, y]) => { const w = toWorld(a, o); return new THREE.Vector3(w.x, y, w.z); });
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  curve.arcLengthDivisions = 2000;
  const length = curve.getLength();
  const n = Math.max(64, Math.round(length / STEP));
  const ds = length / n;
  const pos = new Float32Array(n * 3), fwd = new Float32Array(n * 3), up = new Float32Array(n * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) { curve.getPointAt(i / n, p); pos.set([p.x, p.y, p.z], i * 3); }
  const at = (i: number) => { const k = ((i % n) + n) % n * 3; return new THREE.Vector3(pos[k], pos[k + 1], pos[k + 2]); };
  const ups: THREE.Vector3[] = [];
  const fwds: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1);
    const f = c.clone().sub(a).normalize();
    const acc = c.clone().add(a).sub(b.clone().multiplyScalar(2)).multiplyScalar((JET_SPEED * JET_SPEED) / (ds * ds));
    const lift = acc.add(new THREE.Vector3(0, G, 0));
    const u = lift.sub(f.clone().multiplyScalar(lift.dot(f)));
    ups.push(u.lengthSq() > 1e-6 ? u.normalize() : new THREE.Vector3(0, 1, 0));
    fwds.push(f);
  }
  // smooth the up vectors along the loop (the table's curvature is noisy at 2 u)
  for (let pass = 0; pass < 6; pass++) {
    const next = ups.map((u, i) => u.clone().multiplyScalar(2).add(ups[(i + n - 1) % n]).add(ups[(i + 1) % n]));
    for (let i = 0; i < n; i++) {
      const f = fwds[i], u = next[i];
      u.sub(f.clone().multiplyScalar(u.dot(f)));
      ups[i] = u.lengthSq() > 1e-6 ? u.normalize() : ups[i];
    }
  }
  for (let i = 0; i < n; i++) { fwd.set([fwds[i].x, fwds[i].y, fwds[i].z], i * 3); up.set([ups[i].x, ups[i].y, ups[i].z], i * 3); }
  tableCache = { length, n, pos, fwd, up };
  return tableCache;
}

export interface Pose { p: THREE.Vector3; f: THREE.Vector3; u: THREE.Vector3; r: THREE.Vector3 }

/** The frame at arc length s (wraps), with the formation offset (side along the right wing, lift along up: wingmen bank with the lead). */
/** v = arr[i] + (arr[j] − arr[i]) · k over three-float rows (module level: poseAt runs ≈ 160 times a frame in the show,
 *  and a closure per call was garbage every frame — review) */
function lerpRow(arr: Float32Array, i: number, j: number, k: number, v: THREE.Vector3): THREE.Vector3 {
  const a = i * 3, b = j * 3;
  return v.set(arr[a] + (arr[b] - arr[a]) * k, arr[a + 1] + (arr[b + 1] - arr[a + 1]) * k, arr[a + 2] + (arr[b + 2] - arr[a + 2]) * k);
}

export function poseAt(t: PathTable, s: number, side = 0, lift = 0, out?: Pose): Pose {
  const o = out ?? { p: new THREE.Vector3(), f: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3() };
  const x = ((s % t.length) + t.length) % t.length / t.length * t.n;
  const i = Math.floor(x) % t.n, j = (i + 1) % t.n, k = x - Math.floor(x);
  lerpRow(t.pos, i, j, k, o.p); lerpRow(t.fwd, i, j, k, o.f).normalize(); lerpRow(t.up, i, j, k, o.u);
  o.r.crossVectors(o.u, o.f).normalize();
  o.u.crossVectors(o.f, o.r).normalize();
  if (side || lift) o.p.addScaledVector(o.r, side).addScaledVector(o.u, lift);
  return o;
}

/** The formation: (back, side, lift) in units of BACK / SIDE / u. Six in a delta; four (phones) in a diamond. */
export const FORMATION: readonly (readonly [number, number, number])[] = [[0, 0, 0], [1, -1, 0], [1, 1, 0], [2, 0, -1], [2, -2, 0], [2, 2, 0]];
export const BACK = 15, SIDE = 12;
export const jetCount = (quality: 'high' | 'mid' | 'low' = game.get().settings.quality) => (quality === 'high' ? 6 : 4);

/** The lead's arc length now: the loop runs on the Bay clock (the same pass at the same minute for everyone). */
export const leadArc = (ms: number = bayNow().getTime(), t: PathTable = pathTable()) => ((ms / 1000) * JET_SPEED) % t.length;

/** Every jet's pose at `ms` (into `out` when given: no allocation per frame). */
export function jetPoses(ms: number, count: number, t: PathTable = pathTable(), out: Pose[] = []): Pose[] {
  const s = leadArc(ms, t);
  for (let i = 0; i < count; i++) {
    const slot = FORMATION[i];
    out[i] = poseAt(t, s - slot[0] * BACK, slot[1] * SIDE, slot[2], out[i]);
  }
  out.length = count;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The toy jet and the smoke
// ---------------------------------------------------------------------------------------------------------------

const NAVY = '#1f3f8c', GOLD = '#e3b23c', GLASS = '#26303c', DARK = '#3b3a40', CREAM = '#f3e6c8';
/** toy scale over a real jet (≈ 2.4 u long at the city's 0.14 u/m): chunky enough to read from the shore */
export const JET_SCALE = 1.9;
export const SMOKE_SAMPLES = 26;
const SMOKE_DS = 4.5, SMOKE_TAIL = 5, SMOKE_W = 2.8;

/**
 * One toy jet in its own frame (+z forward, +y up, +x a wing), ≈ 6.6 u long before JET_SCALE: a navy fuselage and nose,
 * a dark canopy, gold swept wings and tailplanes, twin canted fins, a cream belly stripe, two exhausts. No insignia.
 */
export function buildJetGeometry(): THREE.BufferGeometry {
  const b = new Batch();
  const X = Math.PI / 2;
  // fuselage along z (CYL runs along +y from 0: rotate it onto +z)
  b.add(CYL(8), M(0, 0, -2.6, 0, 0.45, 5.2, 0.45, X), NAVY);
  b.add(CONE(8), M(0, 0, 2.6, 0, 0.45, 1.5, 0.45, X), NAVY);
  b.add(CYL(6), M(0, 0, 2.2, 0, 0.47, 0.18, 0.47, X), GOLD);
  b.add(ICO(0), M(0, 0.36, 1.35, 0, 0.3, 0.26, 0.85), GLASS);
  // wings (swept), tailplanes, fins (BOX is based at y = 0: centre it)
  for (const s of [-1, 1]) {
    b.add(BOX(), M(s * 1.55, -0.07, 0.1, s * 0.42, 2.5, 0.13, 1.35), GOLD);
    b.add(BOX(), M(s * 0.95, -0.04, -2.35, s * 0.5, 1.2, 0.09, 0.7), GOLD);
    b.add(BOX(), M(s * 0.42, 0.2, -2.1, 0, 0.08, 1.15, 0.95, 0, s * -0.38), NAVY);
    b.add(CYL(6), M(s * 0.22, -0.05, -3.05, 0, 0.2, 0.45, 0.2, X), DARK);
  }
  b.add(BOX(), M(0, -0.47, -1.6, 0, 0.24, 0.06, 3.6), CREAM);
  return b.build();
}

/** The jets' material: one instance, InstancedMesh only, keyed like TOY_INST (the same program: nothing new to link). */
export function makeJetMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
  m.name = 'ob-realsf-jets';
  m.onBeforeCompile = shader => { patchToyShader(shader, { sway: false }); };
  m.customProgramCacheKey = () => 'ob-toy-inst';
  return m;
}
/** The smoke's material: one instance, the ribbon mesh only (the one new program, warmed). */
export function makeSmokeMaterial(): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  m.name = 'ob-realsf-smoke';
  return m;
}

/** The smoke ribbon's half-width at a (0 = at the jet, 1 = the end): puffs out, then thins to nothing. */
export const smokeWidth = (a: number) => SMOKE_W * (0.5 + 1.5 * a) * Math.pow(Math.max(0, 1 - a), 1.2) * 0.5;

export function buildSmokeGeometry(jets = FORMATION.length): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(jets * SMOKE_SAMPLES * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx: number[] = [];
  for (let r = 0; r < jets; r++) {
    const o = r * SMOKE_SAMPLES * 2;
    for (let j = 0; j < SMOKE_SAMPLES - 1; j++) { const a = o + j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  g.setIndex(idx);
  return g;
}
export const SMOKE_INDEX_PER_JET = (SMOKE_SAMPLES - 1) * 6;

/** Write the smoke ribbons for `count` jets at `ms` (ribbons face the camera at `eye`). */
const smokePose: Pose = { p: new THREE.Vector3(), f: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3() };
const smokeW = new THREE.Vector3(), smokeTo = new THREE.Vector3();
export function writeSmoke(g: THREE.BufferGeometry, ms: number, count: number, eye: THREE.Vector3, t: PathTable = pathTable()) {
  const arr = (g.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const s0 = leadArc(ms, t);
  const pose = smokePose, w = smokeW, to = smokeTo;
  for (let r = 0; r < count; r++) {
    const slot = FORMATION[r];
    for (let j = 0; j < SMOKE_SAMPLES; j++) {
      poseAt(t, s0 - slot[0] * BACK - SMOKE_TAIL * JET_SCALE - j * SMOKE_DS, slot[1] * SIDE, slot[2], pose);
      to.subVectors(eye, pose.p);
      w.crossVectors(pose.f, to);
      if (w.lengthSq() < 1e-6) w.copy(pose.r); else w.normalize();
      const hw = smokeWidth(j / (SMOKE_SAMPLES - 1));
      const k = (r * SMOKE_SAMPLES + j) * 6;
      arr[k] = pose.p.x + w.x * hw; arr[k + 1] = pose.p.y + w.y * hw; arr[k + 2] = pose.p.z + w.z * hw;
      arr[k + 3] = pose.p.x - w.x * hw; arr[k + 4] = pose.p.y - w.y * hw; arr[k + 5] = pose.p.z - w.z * hw;
    }
  }
  (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  g.setDrawRange(0, count * SMOKE_INDEX_PER_JET);
}

/** The loop's bounding sphere (the formation and the smoke included). */
export function airSphere(t: PathTable = pathTable()): THREE.Sphere {
  const box = new THREE.Box3();
  for (let i = 0; i < t.n; i++) box.expandByPoint(new THREE.Vector3(t.pos[i * 3], t.pos[i * 3 + 1], t.pos[i * 3 + 2]));
  const s = box.getBoundingSphere(new THREE.Sphere());
  s.radius += 2 * SIDE + 12;
  return s;
}

// ---------------------------------------------------------------------------------------------------------------
// The glide soft boxes (the pelican is turned back from the show)
// ---------------------------------------------------------------------------------------------------------------

export const SOFT_BOX_LINE: Bilingual = { zh: '我们在旁边看就好～', en: 'Let’s watch from over here!' };
const BOX_ARC = 80, BOX_MARGIN = 12;
/** Axis-aligned boxes along the loop (every 80 u of arc: small, so they hug the rotated show line), from minY up. */
export function softBoxes(t: PathTable = pathTable()): { minX: number; minZ: number; maxX: number; maxZ: number; minY: number }[] {
  const n = Math.ceil(t.length / BOX_ARC);
  const pose: Pose = { p: new THREE.Vector3(), f: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3() };
  const out: { minX: number; minZ: number; maxX: number; maxZ: number; minY: number }[] = [];
  for (let k = 0; k < n; k++) {
    const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity, minY: Infinity };
    for (let s = k * BOX_ARC; s <= Math.min(t.length, (k + 1) * BOX_ARC); s += 4) {
      for (const [bk, side, lift] of FORMATION) {
        poseAt(t, s - bk * BACK, side * SIDE, lift, pose);
        b.minX = Math.min(b.minX, pose.p.x); b.maxX = Math.max(b.maxX, pose.p.x);
        b.minZ = Math.min(b.minZ, pose.p.z); b.maxZ = Math.max(b.maxZ, pose.p.z);
        b.minY = Math.min(b.minY, pose.p.y);
      }
    }
    out.push({ minX: b.minX - BOX_MARGIN, minZ: b.minZ - BOX_MARGIN, maxX: b.maxX + BOX_MARGIN, maxZ: b.maxZ + BOX_MARGIN, minY: b.minY - BOX_MARGIN });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Lines, the photo subject, the roar
// ---------------------------------------------------------------------------------------------------------------

export const JETS_DAY_LINE: Bilingual = { zh: '今天中午到下午四点，湾上有飞行表演，去码头绿地看！', en: 'Noon to 4 pm today there’s an air show over the Bay — let’s watch from Marina Green!' };
export const JETS_NOW_LINE: Bilingual = { zh: '飞行表演正在湾上，四点结束，去码头绿地看！', en: 'The air show is on over the Bay until 4 — let’s watch from Marina Green!' };
export const JETS_NEAR_LINE: Bilingual = { zh: '飞机编队来啦！打开拍照，把它们拍下来吧～', en: 'Here come the jets! Open the camera and get them in a shot!' };
export const JETS_PHOTO_LINE: Bilingual = { zh: '飞机编队拍到啦，舰队周纪念章收好！', en: 'Got the jets! A Fleet Week stamp for your journal!' };

/** The photo camera's pitch when 拍飞机编队 opens photo mode (rad; photo mode clamps to 0.04 … 1.45). */
export const JETS_PHOTO_PITCH = 0.06;
/** The photo subject at Marina Green's seawall (and the waypoint's target). */
export const WATCH = { id: 'realsf:jets-watch', x: -377.5, z: 287.5, r: 14 } as const;
/** jets this near (u) and in frame count for the photo; the line and the roar reach this far */
export const PHOTO_NEAR = 520;
export const HEAR_FAR = 600, HEAR_FULL = 120;
/** built within this of the air box's centre (u) */
export const BUILD_NEAR = 1500;

export const roarGain = (d: number) => (d >= HEAR_FAR ? 0 : d <= HEAR_FULL ? 1 : ((HEAR_FAR - d) / (HEAR_FAR - HEAR_FULL)) ** 1.6);

const roar = { bright: 0.4 };
/** The roar: a brown rumble under a pink whoosh whose band rises as the jets come near (original synthesis). */
function roarLoop(e: AudioEngine): LoopHandle {
  const ctx = e.ctx as AudioContext;
  const out = ctx.createGain(); out.gain.value = 0;
  const rumble = e.loopNoise('brown', 0.7);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.5;
  const rg = ctx.createGain(); rg.gain.value = 0.6;
  rumble.connect(lp).connect(rg).connect(out);
  const hiss = e.loopNoise('pink', 1.15);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 0.55;
  const hg = ctx.createGain(); hg.gain.value = 0.32;
  hiss.connect(bp).connect(hg).connect(out);
  out.connect(e.buses.ambience.input);
  const id = setInterval(() => {
    const t = ctx.currentTime;
    bp.frequency.setTargetAtTime(450 + 1300 * roar.bright, t, 0.2);
    lp.frequency.setTargetAtTime(200 + 300 * roar.bright, t, 0.25);
  }, 100);
  return {
    setGain: g => { out.gain.setTargetAtTime(0.55 * g, ctx.currentTime, 0.1); },
    stop: () => {
      clearInterval(id);
      try { rumble.stop(); hiss.stop(); } catch { /* already stopped */ }
      for (const n of [rumble, lp, rg, hiss, bp, hg, out]) { try { n.disconnect(); } catch { /* gone */ } }
    },
  };
}
export const ROAR_ID = 'realsf-jets';

// ---------------------------------------------------------------------------------------------------------------
// The runtime (city mode, from realsf/index.ts)
// ---------------------------------------------------------------------------------------------------------------

export interface Jets {
  offered(): OfferedLine[];
  /** the scheduler said one of this module's lines */
  said(key: string): void;
  stats(): { up: boolean; built: boolean; count: number; tris: number; lead: { x: number; y: number; z: number } | null; dist: number | null; boxes: number };
  off(): void;
}

const dist2 = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

export function initJets(): Jets {
  const table = pathTable();
  const sphere = airSphere(table);
  const jetMat = makeJetMaterial(), smokeMat = makeSmokeMaterial();
  const jetGeo = buildJetGeometry();
  const offWarmJets = registerWarmup('r-jets', () => instancedWarmup(jetMat, { geometry: jetGeo, receiveShadow: true }));
  const offWarmSmoke = registerWarmup('r-jets-smoke', () => meshWarmup(smokeMat));
  const offRoar = registerLoop(ROAR_ID, roarLoop);

  const group = new THREE.Group();
  group.name = 'realsf-jets';
  let jets: THREE.InstancedMesh | null = null;
  let smoke: THREE.Mesh | null = null;
  let count = 0;
  let up = false;
  let boxesOn = false;
  let nearLine = false;
  let photoLine = false;
  /** the Bay day the waiting photo line belongs to (a new day drops it) */
  let lineDay = '';
  let lead: THREE.Vector3 | null = null;
  let leadDist: number | null = null;
  let lastDist = Infinity;
  const m4 = new THREE.Matrix4(), scl = new THREE.Vector3(JET_SCALE, JET_SCALE, JET_SCALE);

  const build = () => {
    const mesh = new THREE.InstancedMesh(jetGeo, jetMat, FORMATION.length);
    mesh.name = 'realsf-jets';
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.boundingSphere = sphere.clone();
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const sg = buildSmokeGeometry();
    sg.boundingSphere = sphere.clone();
    const s = new THREE.Mesh(sg, smokeMat);
    s.name = 'realsf-jets-smoke';
    s.renderOrder = 2;
    group.add(mesh, s);
    jets = mesh; smoke = s;
  };
  const drop = () => {
    if (jets) { group.remove(jets); jets.dispose(); jets = null; }
    if (smoke) { group.remove(smoke); smoke.geometry.dispose(); smoke = null; }
    lead = null;
  };

  const poses: Pose[] = [];
  const leadAt = new THREE.Vector3();
  const place = (camera: THREE.Camera) => {
    if (!jets || !smoke || !count) return;
    const ms = bayNow().getTime();
    jetPoses(ms, count, table, poses);
    for (let i = 0; i < count; i++) { const p = poses[i]; m4.makeBasis(p.r, p.u, p.f).scale(scl).setPosition(p.p); jets.setMatrixAt(i, m4); }
    jets.count = count;
    jets.instanceMatrix.needsUpdate = true;
    lead = leadAt.copy(poses[0].p);
    writeSmoke(smoke.geometry, ms, count, camera.position, table);
  };

  let eye: THREE.Camera | null = null;
  const system: WorldSystem = { name: 'realsf-jets', group, update: (_dt, _t, camera) => { eye = camera; if (jets) place(camera); } };
  let offSystem: (() => void) | null = null;
  const attach = () => { if (!offSystem && cityStreamerLazy()) offSystem = getWorld().addSystem(system); };

  const setBoxes = (on: boolean) => {
    if (on === boxesOn) return;
    const api = charApi();
    if (!api) return;
    const boxes = softBoxes(table);
    boxes.forEach((b, i) => api.glideSoftBox(`realsf-jets-${i}`, on ? b : null, on ? SOFT_BOX_LINE : undefined));
    boxesOn = on;
  };

  // the photo subject + waypoint target (all show day); before the show it opens the Fleet Week card
  let showDay = false;
  const offInteract = registerInteractables('w5-realsf-jets', () => (showDay ? [{
    id: WATCH.id, source: 'event', action: 'photo', name: up ? { zh: '飞机编队', en: 'The jet formation' } : { zh: '飞行表演 · 码头绿地', en: 'Air show · Marina Green' },
    verb: up ? { zh: '拍飞机编队', en: 'Photograph the jets' } : { zh: '看看飞行表演', en: 'See the air show' },
    x: WATCH.x, z: WATCH.z, radius: WATCH.r,
    act: () => {
      if (!up) { openEvent(JETS_EVENT); return; }
      enterPhotoMode(WATCH.id);
      // aim where the formation will be in a moment (it flies 30 u/s), the camera nearly level (lane F's `pitch`, W5-F6:
      // the loop flies 7–52 u up, 7°–15° above the seawall's horizon, so a level look puts it in the frame's upper
      // half instead of clipped at the top edge — review)
      const ahead = poseAt(table, leadArc(bayNow().getTime() + 1800, table));
      faceCameraToward(ahead.p.x, ahead.p.z, { seconds: 0.8, pitch: JETS_PHOTO_PITCH });
    },
  } satisfies Interactable] : []));

  /** a jet of the formation is in the camera's frame, near enough (the shutter's test) */
  const ndc = new THREE.Vector3();
  const inFrame = (): boolean => {
    if (!jets || !eye || !count) return false;
    const cam = eye;
    return poses.slice(0, count).some(p => cam.position.distanceTo(p.p) < PHOTO_NEAR && (ndc.copy(p.p).project(cam), ndc.z < 1 && Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1));
  };
  const offShutter = onEvent(e => {
    if (e.type !== 'shutter' || !up || !inFrame()) return;
    const source = `event:${JETS_SOUVENIR}`;
    const first = !isPaid(source);
    emit({ type: 'find', kind: 'souvenir', id: JETS_SOUVENIR, first });
    if (first) { emit({ type: 'reward', source, coins: 15, stamp: source }); photoLine = true; }
  });

  let acc = 1;
  const tick = () => {
    attach();
    const now = bayNow();
    const today = bayParts(now).dateKey;
    if (today !== lineDay) { lineDay = today; photoLine = false; }
    const win = jetWindowOn(now);
    const day = !!win && now.getTime() < win.close;
    if (day !== showDay) { showDay = day; invalidateInteractables(); }
    const wasUp = up;
    up = jetsUp(now);
    if (up !== wasUp) invalidateInteractables();
    setBoxes(up);
    const p = { x: runtime.player.x, z: runtime.player.z };
    const want = up && dist2(p, AIR_BOX.c) < BUILD_NEAR && !!offSystem;
    if (want && !jets) build();
    if (!want && jets) drop();
    const n = jetCount();
    if (n !== count) count = n;
    // the roar and the music duck
    if (jets && lead) {
      const d = Math.hypot(lead.x - runtime.player.x, lead.y - runtime.player.y, lead.z - runtime.player.z);
      leadDist = d;
      const coming = Math.max(0, Math.min(1, (lastDist - d) / 15 + 0.5));
      lastDist = d;
      roar.bright = Math.max(0, Math.min(1, 0.65 * (1 - d / HEAR_FAR) + 0.35 * coming));
      const g = roarGain(d);
      setLoop(ROAR_ID, g, 500);
      if (g > 0.25) duck('music', 0.45, 800);
      // (review) only while they really are near: a latched flag had BAYBAY say 飞机编队来啦！打开拍照… across the city
      // after the player left (the line had waited out a panel or photo mode), or at the next show day's first minute
      nearLine = d < 400;
    } else {
      leadDist = null;
      nearLine = false;
      setLoop(ROAR_ID, 0, 900);
    }
  };
  // 2 Hz, like the presence (the jets themselves move every frame in the world system's update)
  const offFrame = registerFrameSystem('w5-realsf-jets', dt => {
    if ((acc += dt) < 0.5) return;
    acc = 0;
    tick();
  }, 5);

  return {
    offered: () => {
      const out: OfferedLine[] = [];
      const now = bayNow();
      const win = jetWindowOn(now);
      if (win && now.getTime() < win.close && now.getTime() >= win.open - 6 * 3600_000 && dist2({ x: runtime.player.x, z: runtime.player.z }, WATCH) > 300) {
        out.push({ key: 'jets-day', text: now.getTime() < win.open ? JETS_DAY_LINE : JETS_NOW_LINE });
      }
      if (photoLine) out.push({ key: 'jets-photo', text: JETS_PHOTO_LINE });
      if (nearLine && up) out.push({ key: 'jets-up', text: JETS_NEAR_LINE });
      return out;
    },
    said: key => {
      if (key === 'jets-photo') photoLine = false;
      if (key !== 'jets-day') return;
      // the waypoint to Marina Green, unless the player is already on the way somewhere
      const f = flow.get(), s = game.get();
      if (!f.trip && !f.mapTarget && !s.tour.active && s.mode === 'free') flow.set({ mapTarget: WATCH.id });
    },
    stats: () => ({ up, built: !!jets, count: jets ? count : 0, tris: jets ? ((jetGeo.index?.count ?? 0) / 3) * count + count * (SMOKE_SAMPLES - 1) * 2 : 0, lead: lead ? { x: +lead.x.toFixed(1), y: +lead.y.toFixed(1), z: +lead.z.toFixed(1) } : null, dist: leadDist === null ? null : Math.round(leadDist), boxes: boxesOn ? softBoxes(table).length : 0 }),
    off: () => {
      offFrame(); offShutter(); offInteract();
      setBoxes(false);
      setLoop(ROAR_ID, 0, 0);
      drop();
      offSystem?.(); offSystem = null;
      offRoar(); offWarmJets(); offWarmSmoke();
      jetGeo.dispose(); jetMat.dispose(); smokeMat.dispose();
    },
  };
}
