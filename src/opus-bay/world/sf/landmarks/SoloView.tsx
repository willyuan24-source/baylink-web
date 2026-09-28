import { type ElementRef, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { TimeOfDay } from '../../../core/store';
import { SF_KIT, SF_KIT_IDS, type SfKitId } from '../../../data/assets';
import { Batch } from '../../builder';
import { Environment } from '../../environment';
import { GROUND, GROUND_PATTERN, TOY, TOY_DYN, U } from '../../materials';
import { makeModelMaterial, modelInstanceGeometry, setModelInstance } from '../../modelMaterial';
import { type LoadedModel, loadModel } from '../../models';
import { buildGroundMesh, buildSwapObjects } from '../sites';
import { sitePhoto } from './context';
import { SF_LANDMARKS, SF_SITES, type SfLandmark, buildLandmark, buildLandmarkAnimated, sfLandmark, triangleBudget, usesAi } from './index';

/**
 * ?solo=<landmarkId> — standalone landmark turntable for QA (lane D). The game's TOY / GROUND materials, the
 * palette sun + hemisphere + sky + fog for ?time=, a ground disc, an orbit camera with 6 preset views plus a ¾ view
 * and a far "64 px" silhouette view, a triangle / draw-call readout and `window.__opusSolo` hooks for scripted shots.
 * ?solo=all renders a contact sheet instead (one ¾ tile per landmark with its 64 px far thumbnail).
 * Flags: &time=morning|day|golden|night, &lod=2 (far silhouette model), &view=three|front|back|left|right|top|street|far|photo
 * ('photo' = the info record's photo pose, data/sf/landmarks.ts), &sheet=0 (solo=all without the automatic sheet).
 *
 * Lane D2 (D2-13): &ai=0|1 draws a landmark that has a `swap` procedurally (0) or with its AI parts (1; default = the
 * swap's `ship`, i.e. what the city draws), with the city's model material and the landmark's `ground`: the decision
 * gate for every AI swap (same framing either way: the box of the full procedural model). ?solo=kit is the house-kit
 * sheet: the 11 SF_KIT houses in a row, one row as authored plus one per DESIGN pastel wall tint (5), in the night-glass
 * material; &time=night for the lit windows, &kit=<id> frames one house's column.
 */

type ViewName = 'three' | 'front' | 'back' | 'left' | 'right' | 'top' | 'street' | 'far' | 'photo';
const VIEWS: ViewName[] = ['three', 'front', 'back', 'left', 'right', 'top', 'street', 'far', 'photo'];
const TIMES: TimeOfDay[] = ['morning', 'day', 'golden', 'night'];
/** landmarks whose local y = 0 is (near) the water line: a bay-blue disc instead of lawn */
const WATER_SOLO = new Set(['golden-gate-bridge', 'fort-point', 'sutro-baths']);
type Stats = Record<string, number | string>;

function readParams() {
  const q = new URLSearchParams(location.search);
  const t = q.get('time') as TimeOfDay | null;
  const v = q.get('view') as ViewName | null;
  const ai = q.get('ai');
  const kit = q.get('kit') as SfKitId | null;
  return {
    time: t && TIMES.includes(t) ? t : ('golden' as TimeOfDay), lod: (q.get('lod') === '2' ? 2 : 0) as 0 | 2, view: v && VIEWS.includes(v) ? v : ('three' as ViewName),
    ai: ai === '1' ? true : ai === '0' ? false : null, kit: kit && SF_KIT_IDS.includes(kit) ? kit : null,
  };
}

interface Built {
  l: SfLandmark; group: THREE.Group; lod0: THREE.Mesh; lod2: THREE.Mesh; anim: THREE.Mesh | null; box: THREE.Box3; tris0: number; tris2: number;
  /** AI mode: 'loading' → 'on' (parts added to aiGroup) or 'failed'; 'off' = procedural */
  ai: 'off' | 'loading' | 'on' | 'failed'; aiGroup: THREE.Group; aiTris: number;
}
const triCount = (g: THREE.BufferGeometry) => (g.getIndex()?.count ?? g.getAttribute('position').count) / 3;

function buildOne(l: SfLandmark, aiParam: boolean | null): Built {
  const group = new THREE.Group();
  group.name = `solo:${l.id}`;
  const full = buildLandmark(l, 0, 0), g2 = buildLandmark(l, 2, 0);
  full.computeBoundingBox();
  const box = full.boundingBox!.clone();
  const ai = usesAi(l, aiParam);
  let g0 = full;
  if (ai) {
    const b = new Batch();
    l.swap!.build(b);
    g0 = b.build();
    full.dispose();
  }
  const lod0 = new THREE.Mesh(g0, TOY), lod2 = new THREE.Mesh(g2, TOY);
  for (const m of [lod0, lod2]) { m.castShadow = true; m.receiveShadow = true; }
  group.add(lod0, lod2);
  const ground = buildGroundMesh(l);
  if (ground) lod0.add(ground);
  const ga = buildLandmarkAnimated(l, 0);
  const anim = ga ? new THREE.Mesh(ga, TOY_DYN) : null;
  if (anim) { anim.castShadow = true; group.add(anim); l.animate?.update(anim, 0); }
  const aiGroup = new THREE.Group();
  aiGroup.name = `solo:${l.id}:ai`;
  lod0.add(aiGroup);
  const built: Built = { l, group, lod0, lod2, anim, box, tris0: triCount(g0), tris2: triCount(g2), ai: ai ? 'loading' : 'off', aiGroup, aiTris: 0 };
  if (ai) {
    const ids = [...new Set(l.swap!.parts.map(p => p.model))];
    void Promise.all(ids.map(id => loadModel(id))).then(list => {
      if (list.some(m => !m)) { built.ai = 'failed'; return; }
      const models = new Map(list.map(m => [m!.id, m!] as [string, LoadedModel]));
      // SoloView shows every model casting (the game casts only where the landmark does)
      const { objects, triangles } = buildSwapObjects(l.swap!.parts.map(p => ({ ...p, castShadow: true })), models, { value: 0 }, `solo:${l.id}`);
      aiGroup.add(...objects);
      built.aiTris = triangles;
      built.ai = 'on';
    });
  }
  return built;
}

/** Camera pose for a named view around a bounding box (local frame: front = +z). */
function viewPose(box: THREE.Box3, view: ViewName, aspect: number, id = '') {
  // a landmark's info pose or a wave-4 site's w4.photo
  const photo = view === 'photo' ? sitePhoto(id) : null;
  if (photo) {
    const { target: [tx, ty, tz], distance: d, elevation: e, bearing: b } = photo;
    const tgt = new THREE.Vector3(tx, ty, tz);
    const pos = tgt.clone().add(new THREE.Vector3(Math.sin(b) * Math.cos(e), Math.sin(e), Math.cos(b) * Math.cos(e)).multiplyScalar(d));
    return { pos, tgt, far: d * 4 + 400 };
  }
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
  // long bridges would otherwise sit tiny in the frame: weight the longest horizontal side less
  const r = 0.5 * Math.max(s.y, Math.hypot(s.x, s.z) * (Math.max(s.x, s.z) > 60 ? 0.62 : 1)) + 1;
  const fit = (r / Math.sin((20 * Math.PI) / 180)) * (aspect < 1 ? 2.2 : 1.35);
  const tgt = new THREE.Vector3(c.x, box.min.y + s.y * 0.45, c.z);
  const dir = new THREE.Vector3();
  if (view === 'front') dir.set(0, 0.18, 1);
  else if (view === 'back') dir.set(0, 0.18, -1);
  else if (view === 'left') dir.set(-1, 0.18, 0);
  else if (view === 'right') dir.set(1, 0.18, 0);
  else if (view === 'top') dir.set(0.001, 1, 0.02);
  else if (view === 'street') { dir.set(0.55, 0.06, 1); tgt.y = box.min.y + Math.min(s.y * 0.5, 6); }
  else if (view === 'far') { dir.set(0.7, 0.28, 1); tgt.y = c.y; }
  else dir.set(0.75, 0.42, 1);
  dir.normalize();
  // 'far' = the silhouette used for the 64 px thumbnail: same bearing, framed tight (the sheet downsamples it)
  const dist = view === 'far' ? fit * 0.86 : view === 'street' ? fit * 0.75 : fit;
  const pos = tgt.clone().addScaledVector(dir, dist);
  if (view === 'street') pos.y = Math.max(pos.y, box.min.y + 1.6);
  return { pos, tgt, far: dist + r * 4 };
}

/** Imperative stage (kept outside React: it owns the scene objects and mutates camera / lights). */
class SoloStage {
  readonly env = new Environment();
  readonly built: Built[];
  readonly disc: THREE.Mesh;
  readonly sea: THREE.Mesh;
  readonly all: boolean;
  lod: 0 | 2;
  view: ViewName;
  time: TimeOfDay;
  current = 0;
  controls: ElementRef<typeof OrbitControls> | null = null;
  private shadowSize = 0;
  readonly gl: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  constructor(id: string, gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.gl = gl; this.scene = scene; this.camera = camera;
    const p = readParams();
    this.lod = p.lod; this.view = p.view; this.time = p.time;
    this.all = id === 'all';
    this.built = (this.all ? SF_LANDMARKS : [sfLandmark(id)].filter((l): l is SfLandmark => !!l)).map(l => buildOne(l, p.ai));
    const r = this.all ? 60 : Math.max(20, ...this.built.map(b => b.box.getSize(new THREE.Vector3()).length() * 0.9));
    const disc = (hex: string, pattern: number, y: number) => {
      const geo = new THREE.CircleGeometry(r, 64).rotateX(-Math.PI / 2);
      const n = geo.getAttribute('position').count;
      const col = new THREE.Color(hex);
      geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => [col.r, col.g, col.b][i % 3]), 3));
      geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? pattern : 0)), 4));
      const m = new THREE.Mesh(geo, GROUND);
      m.receiveShadow = true;
      m.position.y = y;
      return m;
    };
    // lawn at local 0, or the Bay at the district water level for landmarks standing in / at the water
    this.disc = disc('#b7c98f', GROUND_PATTERN.grass, -0.02);
    this.sea = disc('#5fa8a6', GROUND_PATTERN.none, -0.6);
  }

  mount(controls: ElementRef<typeof OrbitControls> | null) {
    const { gl, scene, env } = this;
    this.controls = controls;
    (window as unknown as { __opusSolo?: unknown }).__opusSolo = this.hooks();
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.shadowMap.enabled = true;
    // no fog on the turntable: this checks the model, the world's haze is the city lane's business
    scene.fog = null;
    U.uFade.value = 0;
    env.setTime(this.time, true);
    env.setQuality('high', gl);
    scene.add(env.group, this.disc, this.sea);
    for (const b of this.built) scene.add(b.group);
    this.apply();
    return () => { scene.remove(env.group, this.disc, this.sea); for (const b of this.built) scene.remove(b.group); };
  }

  /** visibility per lod / current landmark, camera framing, shadow frustum sized to the model */
  apply() {
    this.built.forEach((b, i) => {
      b.group.visible = !this.all || i === this.current;
      b.lod0.visible = this.lod === 0;
      b.lod2.visible = this.lod === 2;
      if (b.anim) b.anim.visible = this.lod === 0;
    });
    const b = this.built[this.current];
    if (!b) return;
    const wet = WATER_SOLO.has(b.l.id);
    this.disc.visible = !wet;
    this.sea.visible = wet;
    const cam = this.camera;
    const pose = viewPose(b.box, this.view, cam.aspect, b.l.id);
    cam.position.copy(pose.pos);
    cam.far = Math.max(1600, pose.far);
    cam.near = Math.max(0.1, pose.pos.distanceTo(pose.tgt) / 600);
    cam.updateProjectionMatrix();
    cam.lookAt(pose.tgt);
    if (this.controls) { this.controls.target.copy(pose.tgt); this.controls.update(); }
    const size = b.box.getSize(new THREE.Vector3()).length() * 0.6 + 4;
    const sc = this.env.sun.shadow.camera;
    sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.far = size * 6; sc.updateProjectionMatrix();
    if (this.shadowSize !== 4096) {
      this.shadowSize = 4096;
      this.env.sun.shadow.mapSize.set(4096, 4096);
      this.env.sun.shadow.map?.dispose();
      this.env.sun.shadow.map = null;
    }
  }

  /** sun + shadow frustum centred on the model (the game's follows the player within ±24 u) */
  light(b: Built, dt = 0.016) {
    this.env.update(dt, this.camera, b.box.getCenter(new THREE.Vector3()));
    const size = b.box.getSize(new THREE.Vector3()).length() * 0.6 + 4;
    this.env.sun.position.copy(this.env.sun.target.position).addScaledVector(this.env.sunDir, size * 2.5);
    this.env.sun.updateMatrixWorld();
  }

  frame(t: number, dt: number) {
    U.uTime.value = t;
    const b = this.built[this.current];
    if (!b) return;
    this.light(b, dt);
    if (b.anim && b.l.animate) b.l.animate.update(b.anim, t);
  }

  stats(): Stats {
    const b = this.built[this.current];
    if (!b) return {};
    const s = b.box.getSize(new THREE.Vector3());
    return {
      id: b.l.id, tier: b.l.tier, lod: this.lod, view: this.view, time: this.time,
      tris0: b.tris0, tris2: b.tris2, budget: triangleBudget(b.l), lod2Ratio: +(b.tris2 / b.tris0).toFixed(3),
      ai: b.ai, aiTris: b.aiTris, aiNote: b.l.swap?.note ?? '',
      calls: this.gl.info.render.calls, frameTris: this.gl.info.render.triangles, programs: this.gl.info.programs?.length ?? 0,
      sizeX: +s.x.toFixed(2), sizeY: +s.y.toFixed(2), sizeZ: +s.z.toFixed(2), minY: +b.box.min.y.toFixed(2), maxY: +b.box.max.y.toFixed(2),
    };
  }

  /** contact sheet: one ¾ tile per landmark + its 64 px thumbnail from the far view (bottom-right of each tile) */
  sheet(): string {
    const cols = 6, tw = 360, th = 250, rows = Math.ceil(this.built.length / cols);
    const out = document.createElement('canvas');
    out.width = cols * tw; out.height = rows * th;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#f3ecdf'; ctx.fillRect(0, 0, out.width, out.height);
    const src = this.gl.domElement;
    const save = { current: this.current, view: this.view };
    this.built.forEach((b, i) => {
      const x0 = (i % cols) * tw, y0 = Math.floor(i / cols) * th;
      this.current = i;
      for (const [view, dx, dy, w, h] of [['three', 0, 0, tw, th], ['far', tw - 70, th - 70, 64, 64]] as [ViewName, number, number, number, number][]) {
        this.view = view;
        this.apply();
        this.light(b);
        this.gl.render(this.scene, this.camera);
        const sw = src.width, sh = src.height, a = w / h;
        const cw = Math.min(sw, sh * a), ch = cw / a;
        ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x0 + dx, y0 + dy, w, h);
        if (view === 'far') { ctx.strokeStyle = '#5a4a3a'; ctx.strokeRect(x0 + dx - 0.5, y0 + dy - 0.5, w + 1, h + 1); }
      }
      ctx.fillStyle = 'rgba(40,32,24,0.78)';
      ctx.fillRect(x0, y0, tw, 20);
      ctx.fillStyle = '#fff8ea'; ctx.font = '13px system-ui';
      ctx.fillText(`T${b.l.tier} ${b.l.id} · ${b.tris0} / ${b.tris2} tris`, x0 + 6, y0 + 14);
    });
    this.current = save.current; this.view = save.view;
    this.apply();
    return out.toDataURL('image/png');
  }

  /** 64 px silhouette thumbnail of the current landmark (far view, downsampled from the live canvas) */
  thumb(size = 64): string {
    const b = this.built[this.current];
    if (!b) return '';
    const view = this.view;
    this.view = 'far';
    this.apply();
    this.light(b);
    this.gl.render(this.scene, this.camera);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const src = this.gl.domElement, sw = src.width, sh = src.height, side = Math.min(sw, sh);
    c.getContext('2d')!.drawImage(src, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size);
    this.view = view;
    this.apply();
    return c.toDataURL('image/png');
  }

  /** clean silhouette mask (no sky / table / disc) of the far view: coverage and bounding box in a size² image */
  silhouette(size = 64) {
    const b = this.built[this.current];
    if (!b) return null;
    const view = this.view;
    this.view = 'far';
    this.apply();
    this.env.group.visible = false;
    const shown = [this.disc.visible, this.sea.visible];
    this.disc.visible = this.sea.visible = false;
    this.gl.setClearColor('#ffffff');
    this.gl.render(this.scene, this.camera);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const src = this.gl.domElement, sw = src.width, sh = src.height, side = Math.min(sw, sh);
    ctx.drawImage(src, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    let n = 0, x0 = size, x1 = -1, y0 = size, y1 = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (px[i] + px[i + 1] + px[i + 2] < 735) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    this.env.group.visible = true;
    [this.disc.visible, this.sea.visible] = shown;
    this.gl.setClearColor('#f3ecdf');
    this.view = view;
    this.apply();
    return { coverage: +(n / (size * size)).toFixed(3), bboxW: Math.max(0, x1 - x0 + 1), bboxH: Math.max(0, y1 - y0 + 1), mask: c.toDataURL('image/png') };
  }

  hooks() {
    return {
      thumb: (size?: number) => this.thumb(size),
      silhouette: (size?: number) => this.silhouette(size),
      ids: SF_SITES.map(l => l.id),
      view: (v: ViewName) => { this.view = v; this.apply(); return this.stats(); },
      lod: (n: 0 | 2) => { this.lod = n; this.apply(); return this.stats(); },
      time: (t: TimeOfDay) => { this.time = t; this.env.setTime(t, true); return t; },
      select: (i: number) => { this.current = Math.max(0, Math.min(this.built.length - 1, i)); this.apply(); return this.stats(); },
      cam: (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => {
        this.camera.position.set(px, py, pz);
        this.controls?.target.set(tx, ty, tz);
        this.controls?.update();
        this.camera.lookAt(tx, ty, tz);
      },
      stats: () => this.stats(),
      sheet: () => this.sheet(),
    };
  }
}

function SoloScene({ id, onStats }: { id: string; onStats: (s: Stats) => void }) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const [stage] = useState(() => new SoloStage(id, gl, scene, camera as THREE.PerspectiveCamera));

  useEffect(() => {
    const unmount = stage.mount(controls.current);
    const timer = window.setInterval(() => onStats(stage.stats()), 500);
    return () => { unmount(); window.clearInterval(timer); };
  }, [stage, onStats]);

  useFrame((s, delta) => stage.frame(s.clock.elapsedTime, Math.min(delta, 0.1)), -1);
  return <OrbitControls ref={controls} makeDefault enableDamping={false} />;
}


/** DESIGN §6 Victorian pastel set (the kit's wall tints); the sheet's first row is the house as authored. */
const KIT_TINTS = ['#f2c9b1', '#cfe0d0', '#f4e2a8', '#c9d6e8', '#e8c6cf'] as const;
const KIT_DX = 8.5, KIT_DZ = 13;

/** ?solo=kit — the house-kit sheet (11 houses × authored + 5 tints), one InstancedMesh per house ('ob-model-inst'). */
class KitStage {
  readonly env = new Environment();
  readonly group = new THREE.Group();
  readonly disc: THREE.Mesh;
  time: TimeOfDay;
  focus: SfKitId | null;
  loaded = 0;
  failed = 0;
  tris = 0;
  controls: ElementRef<typeof OrbitControls> | null = null;
  readonly gl: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  constructor(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.gl = gl; this.scene = scene; this.camera = camera;
    const p = readParams();
    this.time = p.time;
    this.focus = p.kit;
    const w = SF_KIT_IDS.length * KIT_DX + 10, d = (KIT_TINTS.length + 1) * KIT_DZ + 10;
    const geo = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    const n = geo.getAttribute('position').count, col = new THREE.Color('#e3d9c4');
    geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => [col.r, col.g, col.b][i % 3]), 3));
    geo.setAttribute('aInfo', new THREE.Float32BufferAttribute(Array.from({ length: n * 4 }, (_, i) => (i % 4 === 0 ? GROUND_PATTERN.stone : 0)), 4));
    this.disc = new THREE.Mesh(geo, GROUND);
    this.disc.receiveShadow = true;
    this.disc.position.set(0, -0.01, (KIT_TINTS.length * KIT_DZ) / 2);
    SF_KIT_IDS.forEach((id, col) => {
      void loadModel(id).then(m => {
        if (!m) { this.failed++; return; }
        const count = KIT_TINTS.length + 1;
        const ig = modelInstanceGeometry(m.geometry, count);
        const mat = makeModelMaterial({ map: m.map, mask: m.mask, variant: 'ob-model-inst', tintKey: SF_KIT[id].tintKey, name: `solo-kit:${id}` });
        const mesh = new THREE.InstancedMesh(ig, mat, count);
        const o = new THREE.Object3D();
        for (let row = 0; row < count; row++) {
          o.position.set((col - (SF_KIT_IDS.length - 1) / 2) * KIT_DX, 0, row * KIT_DZ);
          o.updateMatrix();
          mesh.setMatrixAt(row, o.matrix);
          setModelInstance(ig, row, row === 0 ? null : KIT_TINTS[row - 1], row === 0 ? 0 : 1, 0.55, 1, 0.1 + 0.07 * col + 0.011 * row);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `solo-kit:${id}`;
        this.group.add(mesh);
        this.loaded++;
        this.tris += m.triangles * count;
      });
    });
  }

  mount(controls: ElementRef<typeof OrbitControls> | null) {
    const { gl, scene, env } = this;
    this.controls = controls;
    (window as unknown as { __opusSolo?: unknown }).__opusSolo = {
      time: (t: TimeOfDay) => { this.time = t; this.env.setTime(t, true); return t; },
      kit: (id: SfKitId | null) => { this.focus = id; this.apply(); return this.stats(); },
      stats: () => this.stats(),
    };
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.shadowMap.enabled = true;
    scene.fog = null;
    U.uFade.value = 0;
    env.setTime(this.time, true);
    env.setQuality('high', gl);
    scene.add(env.group, this.disc, this.group);
    this.apply();
    return () => { scene.remove(env.group, this.disc, this.group); };
  }

  /** whole sheet from the front-top, or one house's column (&kit=<id>) */
  apply() {
    const cam = this.camera;
    const col = this.focus ? SF_KIT_IDS.indexOf(this.focus) : -1;
    const x = col >= 0 ? (col - (SF_KIT_IDS.length - 1) / 2) * KIT_DX : 0;
    const zMid = (KIT_TINTS.length * KIT_DZ) / 2;
    const tgt = new THREE.Vector3(x, 2.5, zMid);
    const pos = col >= 0 ? new THREE.Vector3(x + 26, 30, zMid + 62) : new THREE.Vector3(0, 62, zMid + 96);
    cam.position.copy(pos);
    cam.near = 0.5; cam.far = 1200;
    cam.updateProjectionMatrix();
    cam.lookAt(tgt);
    if (this.controls) { this.controls.target.copy(tgt); this.controls.update(); }
    const sc = this.env.sun.shadow.camera, size = 70;
    sc.left = -size; sc.right = size; sc.top = size; sc.bottom = -size; sc.far = size * 6; sc.updateProjectionMatrix();
    this.env.sun.shadow.mapSize.set(4096, 4096);
  }

  frame(t: number, dt: number) {
    U.uTime.value = t;
    const c = new THREE.Vector3(0, 0, (KIT_TINTS.length * KIT_DZ) / 2);
    this.env.update(dt, this.camera, c);
    this.env.sun.position.copy(this.env.sun.target.position).addScaledVector(this.env.sunDir, 160);
    this.env.sun.updateMatrixWorld();
  }

  stats(): Stats {
    return {
      id: 'kit', houses: SF_KIT_IDS.length, rows: KIT_TINTS.length + 1, loaded: this.loaded, failed: this.failed, time: this.time, focus: this.focus ?? 'all',
      tris0: this.tris, calls: this.gl.info.render.calls, frameTris: this.gl.info.render.triangles, programs: this.gl.info.programs?.length ?? 0,
    };
  }
}

function KitScene({ onStats }: { onStats: (s: Stats) => void }) {
  const gl = useThree(s => s.gl);
  const scene = useThree(s => s.scene);
  const camera = useThree(s => s.camera);
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const [stage] = useState(() => new KitStage(gl, scene, camera as THREE.PerspectiveCamera));
  useEffect(() => {
    const unmount = stage.mount(controls.current);
    const timer = window.setInterval(() => onStats(stage.stats()), 500);
    return () => { unmount(); window.clearInterval(timer); };
  }, [stage, onStats]);
  useFrame((s, delta) => stage.frame(s.clock.elapsedTime, Math.min(delta, 0.1)), -1);
  return <OrbitControls ref={controls} makeDefault enableDamping={false} />;
}

const btn: React.CSSProperties = { font: '12px system-ui', padding: '4px 8px', margin: 2, border: '1px solid #b9a88f', borderRadius: 6, background: '#fffaf0', color: '#4a3c2e', cursor: 'pointer' };
type SoloHooks = Record<string, (...a: unknown[]) => unknown>;
const callSolo = (name: string, ...args: unknown[]) => (window as unknown as { __opusSolo?: SoloHooks }).__opusSolo?.[name]?.(...args);

export default function SoloView({ id }: { id: string }) {
  const [info, setInfo] = useState<Stats>({});
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const known = id === 'all' || id === 'kit' || !!sfLandmark(id);
  useEffect(() => {
    if (id !== 'all' || new URLSearchParams(location.search).get('sheet') === '0') return;
    const t = window.setTimeout(() => { const url = callSolo('sheet') as string | undefined; if (url) setSheetUrl(url); }, 2500);
    return () => window.clearTimeout(t);
  }, [id]);
  if (!known) {
    return <div style={{ color: '#5a4a3a', font: '14px system-ui', padding: 24, background: '#f3ecdf', minHeight: '100vh' }}>unknown landmark “{id}”. Known: all, kit, {SF_LANDMARKS.map(l => l.id).join(', ')}</div>;
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f3ecdf' }}>
      <Canvas shadows="percentage" dpr={1} gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ fov: 40, near: 0.3, far: 3000, position: [30, 20, 30] }} onCreated={({ gl }) => gl.setClearColor('#f3ecdf')}>
        {id === 'kit' ? <KitScene onStats={setInfo} /> : <SoloScene id={id} onStats={setInfo} />}
      </Canvas>
      {sheetUrl && <img src={sheetUrl} alt="landmark contact sheet" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'top left', background: '#f3ecdf' }} />}
      {!sheetUrl && id === 'kit' && (
        <div style={{ position: 'absolute', left: 8, top: 8, font: '12px/1.45 ui-monospace, monospace', color: '#3d3227', background: 'rgba(255,250,240,0.86)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontWeight: 700 }}>house kit · {String(info.loaded ?? 0)}/{String(info.houses ?? '')} loaded{info.failed ? ` · ${String(info.failed)} failed` : ''}</div>
          <div>rows: authored, {KIT_TINTS.join(' ')} · {String(info.time ?? '')}</div>
          <div>frame {String(info.calls ?? '')} calls · {String(info.frameTris ?? '')} tris · {String(info.programs ?? '')} programs</div>
        </div>
      )}
      {!sheetUrl && id !== 'kit' && (
        <div style={{ position: 'absolute', left: 8, top: 8, maxWidth: 380, font: '12px/1.45 ui-monospace, monospace', color: '#3d3227', background: 'rgba(255,250,240,0.86)', borderRadius: 8, padding: '6px 8px' }}>
          <div style={{ fontWeight: 700 }}>{String(info.id ?? id)} · T{String(info.tier ?? '')}</div>
          <div>lod0 {String(info.tris0 ?? '')} tris · lod2 {String(info.tris2 ?? '')} ({String(info.lod2Ratio ?? '')}) · budget {String(info.budget ?? '')}</div>
          <div>frame {String(info.calls ?? '')} calls · {String(info.frameTris ?? '')} tris · {String(info.sizeX ?? '')}×{String(info.sizeY ?? '')}×{String(info.sizeZ ?? '')} u</div>
          {info.ai !== 'off' && <div>AI {String(info.ai ?? '')} · {String(info.aiTris ?? '')} tris{info.aiNote ? ` · ${String(info.aiNote)}` : ''}</div>}
          <div style={{ marginTop: 4 }}>{VIEWS.map(v => <button key={v} type="button" style={btn} onClick={() => callSolo('view', v)}>{v}</button>)}</div>
          <div>{TIMES.map(t => <button key={t} type="button" style={btn} onClick={() => callSolo('time', t)}>{t}</button>)}
            <button type="button" style={btn} onClick={() => callSolo('lod', 0)}>lod0</button><button type="button" style={btn} onClick={() => callSolo('lod', 2)}>lod2</button></div>
        </div>
      )}
    </div>
  );
}
