import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { runtime } from '../core/runtime';
import { game, type Quality, type TimeOfDay, type WorldMode } from '../core/store';
import { DISTRICT } from '../data/district';
import { buildBackdrop } from './backdrop';
import { bayClock, handAngles, isMarketOpen } from './clock';
import { Batch, C, freezeStatic, splitGeometry } from './builder';
import { buildCity } from './city';
import { Environment } from './environment';
import { FxPool, attachFx } from './fx';
import { buildGround, buildSkirtWater } from './ground';
import { LabelAtlas, LabelBatch } from './labels';
import { type ClockSpec, buildLandmarks, kDockSpots } from './landmarks';
import { FERRY_LIGHTS, Life } from './life';
import { GROUND, HALO, POOL, TOY, TOY_DYN, U, makeHeroMaterial } from './materials';
import { BlobBatch, Floaters, type HaloSpec, type PoolSpec, buildProps } from './props';
import { type CityModule, cityModule } from './cityLoader';
import type { CityStreamer } from './sf/stream';
import type { CityWater } from './sf/water';
import type { KarlFlag } from './fogShader';
import { Streetcars } from './streetcar';
import { registerWarmup } from './warmup';
import { buildBuildingDistanceTexture, buildDistanceTexture, buildDistrictWater, buildLightMask, makeWaterMaterial } from './water';

/**
 * Assembles the whole district once (module singleton) and advances everything per frame.
 * Draw-call budget: ground 1 + city/props 1 + heroes ~12 (culled) + labels 1 + blobs 1 + water 1 +
 * sky 1 + table 2 + halos 1 + lamp pools 1 (night) + fx 1 (while alive) + market 1 + life/vehicles ~16.
 */

/**
 * Chunk size (world units) for splitting static geometry so frustum culling can drop off-screen parts. The
 * follow camera sees the horizon, so most of the district is on screen: big chunks keep the draw count low.
 */
const CHUNK = 150;
/** Water is cheap per vertex and costly per pixel: a few big chunks. */
const WATER_CHUNK = 400;
/** City mode: the backdrop (Bay Bridge, lighthouse, Angel Island, clouds) is seen whole from the city: big chunks. */
const BACKDROP_CHUNK = 512;

/** The city chunk (world/cityLoader.ts); city mode awaits it before building the world. */
function requireCity(): CityModule {
  const m = cityModule();
  if (!m) throw new Error('[opus-bay] city mode: await loadCity() (world/cityLoader.ts) before building the world');
  return m;
}
/** Moving halo slots at the end of the halo batch: ferry lights + sailboat mast tops. */
const SAIL_LIGHTS = 6;
const HERO_FADE = 0.35;

function staticMesh(geo: THREE.BufferGeometry, mat: THREE.Material, name: string, receive = true, cast = false) {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.matrixAutoUpdate = false;
  m.receiveShadow = receive;
  m.castShadow = cast;
  m.updateMatrix();
  return freezeStatic(m);
}

interface HeroFade { fade: { value: number }; x: number; z: number; r: number; y0: number; y1: number }

/**
 * Day-0 contract (wave 2): a world-side system another lane plugs in (F's transit / crowd layers, H2b's murals, D2's
 * GLB groups) without editing this file. `group` is added under the world root (matrixAutoUpdate is yours to manage);
 * `update` runs every frame at the end of World.update (after life, before fx), with the camera and the night level
 * (0 day … 1 night); `dispose` runs when it is removed. Add one with getWorld().addSystem(sys) → returns the remover.
 */
export interface WorldSystem {
  name: string;
  group?: THREE.Object3D;
  update?(dt: number, t: number, camera: THREE.Camera, night: number): void;
  dispose?(): void;
}

export class World {
  readonly root = new THREE.Group();
  readonly mode: WorldMode;
  readonly env: Environment;
  /** city mode: the streamed San Francisco (enableCity) and its water */
  city: CityStreamer | null = null;
  readonly cityWater: CityWater | null = null;
  private halosSpec: HaloSpec[] = [];
  private cityChunks: THREE.Mesh[] = [];
  /** city mode: the hero's own ground chunks and its labels / contact blobs (hidden with its buildings when far) */
  private heroGroundChunks: THREE.Mesh[] = [];
  private heroFarExtras: THREE.Object3D[] = [];
  /** removes what came with the city (world/sf/cityWorld.ts): the ?debug breakdown, H2b's murals, Karl's cloud bank and
   * the night light field (lane C2-8 / C2-9) */
  private detachCity: (() => void) | null = null;
  readonly atlas = new LabelAtlas();
  readonly water: THREE.ShaderMaterial;
  readonly heroes: THREE.Mesh[] = [];
  readonly floaters: Floaters;
  readonly streetcars: Streetcars;
  readonly life: Life;
  readonly fx: FxPool;
  private halos: THREE.InstancedMesh;
  private dynHaloBase = 0;
  private dynHaloCount = 0;
  private dynHaloDirty = false;
  private pools: THREE.InstancedMesh;
  private heroFades: HeroFade[] = [];
  private market: { open: THREE.Mesh; closed: THREE.Mesh };
  private clockSpecs: ClockSpec[];
  private hands: THREE.Mesh;
  private clockAt = -99;
  private marketAt = -99;
  private tmp = new THREE.Vector3();
  readonly buildMs: number;
  readonly stats = { vertices: 0, triangles: 0, chunks: 0 };
  private systems: WorldSystem[] = [];

  /** Plug in a world-side system (see WorldSystem). Returns the function that removes and disposes it. */
  addSystem(sys: WorldSystem): () => void {
    this.systems.push(sys);
    if (sys.group) { this.root.add(sys.group); sys.group.updateMatrixWorld(true); }
    return () => {
      const i = this.systems.indexOf(sys);
      if (i < 0) return;
      this.systems.splice(i, 1);
      if (sys.group) this.root.remove(sys.group);
      sys.dispose?.();
    };
  }

  constructor(mode: WorldMode = 'district') {
    const t0 = performance.now();
    this.mode = mode;
    const city = mode === 'city';
    this.env = new Environment(mode, city ? requireCity() : undefined);
    this.root.name = 'opus-world';
    const ground = new Batch();
    const toy = new Batch();
    const labels = new LabelBatch();
    const blobs = new BlobBatch();

    // city mode: the hero is built first and exactly as in district mode, minus its slab edges (the city continues)
    buildGround(ground, toy, { slab: !city, wharfPoles: city });
    buildCity(toy, labels, this.atlas);
    const props = buildProps(toy, blobs);
    const lm = buildLandmarks(labels, this.atlas);
    this.clockSpecs = lm.clocks;
    const halos: HaloSpec[] = [...props.halos];
    // city mode: the backdrop (Bay Bridge, lighthouse, Angel Island, clouds) and the west seawall get their own chunks,
    // so the hero's buildings can make way for their L1 boxes when the player is far away (plan §5.1)
    const backToy = city ? new Batch() : toy;
    const back = buildBackdrop(ground, backToy, halos, mode);
    if (city) requireCity().westSeawall(backToy);
    this.halosSpec = halos;

    // water: district + bay-side skirt + backdrop tiles, chunked like the rest of the static geometry
    // (city mode: one city water over the whole board instead, world/sf/water.ts)
    const dist = buildDistanceTexture();
    const lightMask = buildLightMask(halos.map(h => ({ x: h.x, z: h.z, w: h.size >= 3 ? 1 : h.size >= 1.3 && h.y < 14 ? 0.3 : 0 })).filter(l => l.w > 0), dist.box);
    let mergedWater: THREE.BufferGeometry | null = null;
    if (city) {
      this.cityWater = new (requireCity().CityWater)(dist.texture, dist.box);
      this.water = this.cityWater.material;
      this.water.uniforms.uLightTex.value = lightMask;
      this.env.setBoards([this.cityWater.board, requireCity().angelIslandBoard()]);
    } else {
      this.env.setBoards(back.boards);
      this.water = makeWaterMaterial(dist.texture, dist.box);
      this.water.uniforms.uLightTex.value = lightMask;
      const districtWater = buildDistrictWater(this.water);
      const skirtWater = buildSkirtWater();
      mergedWater = mergeGeometries([districtWater.geometry, skirtWater, ...back.water], false) ?? districtWater.geometry;
      if (mergedWater !== districtWater.geometry) { districtWater.geometry.dispose(); skirtWater.dispose(); back.water.forEach(g => g.dispose()); }
    }
    this.env.water.push(this.water);

    // ground contact shadows next to buildings
    const bd = buildBuildingDistanceTexture();
    U.uBDist.value = bd.texture;
    U.uBDistBox.value.copy(bd.box);
    U.uBDistOn.value = 1;

    const chunks: THREE.Mesh[] = [];
    const addChunks = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, order = 0, cell = CHUNK) => {
      splitGeometry(geo, cell).forEach((g, i) => {
        const m = staticMesh(g, mat, `${name}#${i}`, mat !== this.water);
        m.renderOrder = order;
        chunks.push(m);
      });
    };
    addChunks(ground.build(), GROUND, 'ground');
    addChunks(toy.build(), TOY, 'city');
    this.cityChunks = chunks.filter(m => m.name.startsWith('city#'));
    if (backToy !== toy) addChunks(backToy.build(), TOY, 'backdrop', 0, BACKDROP_CHUNK);
    if (mergedWater) addChunks(mergedWater, this.water, 'water', 1, WATER_CHUNK);
    const labelMesh = staticMesh(labels.build(), this.atlas.material, 'labels', true);
    // city mode hides the hero's labels until the player comes near (the Dragon Gate): their program linked on first
    // sight after the warm-up (D2 w3 c3's route drift); warm it with this World's own atlas material (W4-V8)
    registerWarmup('c2-labels', () => {
      const geo = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.Mesh(geo, this.atlas.material);
      mesh.receiveShadow = labelMesh.receiveShadow;
      mesh.castShadow = labelMesh.castShadow;
      return { objects: [mesh], dispose: () => geo.dispose() };
    });
    const blobMesh = blobs.build();
    blobMesh.updateMatrix();
    this.root.add(this.env.group, labelMesh, blobMesh, ...chunks);
    if (city) {
      // the hero's ground chunks (not Angel Island's): their bbox meets the slab's
      const sb = new THREE.Box3();
      for (const p of DISTRICT.slab) sb.expandByPoint(this.tmp.set(p.x, 0, p.z));
      sb.min.y = -Infinity; sb.max.y = Infinity;
      this.heroGroundChunks = chunks.filter(m => m.name.startsWith('ground#') && (m.geometry.computeBoundingBox(), sb.intersectsBox(m.geometry.boundingBox!)));
      this.heroFarExtras = [labelMesh, blobMesh];
    }
    if (this.cityWater) this.root.add(this.cityWater.group);
    for (const h of lm.heroes) {
      let mat: THREE.Material = TOY;
      if (h.fade) {
        const hero = makeHeroMaterial(h.id);
        mat = hero.material;
        this.heroFades.push({ fade: hero.fade, ...h.fade });
      }
      const mesh = staticMesh(h.batch.build(), mat, `hero:${h.id}`, true, true);
      this.heroes.push(mesh);
      this.root.add(mesh);
    }
    this.market = {
      open: staticMesh(props.marketOpen.build(), TOY, 'market-open', true, false),
      closed: staticMesh(props.marketClosed.build(), TOY, 'market-closed', true, false),
    };
    this.root.add(this.market.open, this.market.closed);

    // Ferry Building clock hands (live Bay Area time)
    this.hands = new THREE.Mesh(new THREE.BufferGeometry(), TOY_DYN);
    this.hands.name = 'clock-hands';
    this.hands.matrixAutoUpdate = false;
    this.hands.frustumCulled = false;
    this.root.add(this.hands);

    // night halos (static + moving slots) and the lamp light pools
    this.halos = this.buildHalos(halos);
    this.pools = this.buildPools(props.pools);
    this.root.add(this.halos, this.pools);

    this.floaters = new Floaters(DISTRICT.props);
    this.streetcars = new Streetcars();
    this.life = new Life(back.beams);
    this.life.halos = {
      count: this.dynHaloCount,
      set: (i, x, y, z, on) => {
        this.halos.setMatrixAt(this.dynHaloBase + i, this.m4.makeTranslation(x, on ? y : -500, z));
        this.dynHaloDirty = true;
      },
    };
    this.water.uniforms.uWakes.value = this.life.wakes;
    this.fx = new FxPool(kDockSpots());
    attachFx(this.fx);
    this.root.add(this.floaters.group, this.streetcars.group, this.life.group, this.fx.mesh);

    for (const g of [this.root, this.env.group, this.floaters.group, this.streetcars.group, this.life.group]) g.matrixAutoUpdate = false;
    this.root.traverse(o => { if (o.matrixAutoUpdate && o !== this.env.sun && o !== this.env.sun.target && o.name !== 'lighthouse-beam') { o.updateMatrix(); } });
    this.root.updateMatrixWorld(true);
    // identity-transform statics: no per-frame matrix work (builder.ts freezeStatic; wave 3, P2)
    for (const o of [this.root, blobMesh, this.hands, this.halos, this.pools]) freezeStatic(o);
    for (const m of [...chunks, labelMesh]) {
      const idx = m.geometry.getIndex();
      this.stats.triangles += (idx ? idx.count : m.geometry.getAttribute('position').count) / 3;
      this.stats.vertices += m.geometry.getAttribute('position').count;
    }
    this.stats.chunks = chunks.length;
    this.buildMs = performance.now() - t0;
  }

  private m4 = new THREE.Matrix4();

  private buildHalos(specs: HaloSpec[]) {
    // moving slots: ferry lights (two ferries) + sailboat mast tops, parked out of sight until placed
    const dyn: HaloSpec[] = [];
    for (let k = 0; k < 2; k++) for (const l of FERRY_LIGHTS) dyn.push({ x: 0, y: -500, z: 0, size: l.size, color: new THREE.Color(...l.color) });
    for (let k = 0; k < SAIL_LIGHTS; k++) dyn.push({ x: 0, y: -500, z: 0, size: 0.8, color: new THREE.Color(1.1, 1.0, 0.9) });
    this.dynHaloBase = specs.length;
    this.dynHaloCount = dyn.length;
    const all = [...specs, ...dyn];
    const geo = new THREE.PlaneGeometry(1, 1);
    const data = new Float32Array(all.length * 3);
    all.forEach((h, i) => {
      const seed = (i * 0.618) % 1;
      data[i * 3] = h.size; data[i * 3 + 1] = h.blink ? 2 + seed : seed; data[i * 3 + 2] = h.day ?? 0;
    });
    geo.setAttribute('aHalo', new THREE.InstancedBufferAttribute(data, 3));
    const mesh = new THREE.InstancedMesh(geo, HALO, Math.max(1, all.length));
    mesh.count = all.length;
    mesh.name = 'halos';
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const m = new THREE.Matrix4();
    all.forEach((h, i) => { mesh.setMatrixAt(i, m.makeTranslation(h.x, h.y, h.z)); mesh.setColorAt(i, h.color); });
    if (!all.length) mesh.setColorAt(0, C('#000000'));
    return mesh;
  }

  /** One instanced flat quad per lamp (radius 3.4 u), additive and night-only. */
  private buildPools(specs: PoolSpec[]) {
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, POOL, Math.max(1, specs.length));
    mesh.count = specs.length;
    mesh.name = 'lamp-pools';
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    const m = new THREE.Matrix4();
    specs.forEach((p, i) => mesh.setMatrixAt(i, m.makeScale(3.4, 1, 3.4).setPosition(p.x, p.y + 0.06, p.z)));
    mesh.visible = false;
    return mesh;
  }

  private updateClock(now: number) {
    if (now - this.clockAt < 5) return;
    this.clockAt = now;
    const { hour, minute } = bayClock();
    const b = new Batch();
    const up = new THREE.Vector3(0, 1, 0);
    for (const c of this.clockSpecs) {
      const right = new THREE.Vector3().crossVectors(up, c.normal).normalize();
      const ang = handAngles(hour, minute);
      const hands: [number, number, number][] = [[ang.hour, 0.52, 0.11], [ang.minute, 0.8, 0.07]];
      for (const [a, len, w] of hands) {
        const dir = up.clone().multiplyScalar(Math.cos(a)).addScaledVector(right, Math.sin(a));
        const side = up.clone().multiplyScalar(-Math.sin(a)).addScaledVector(right, Math.cos(a)).multiplyScalar(w * c.radius * 0.5);
        const p0 = c.center.clone().addScaledVector(dir, -0.12 * c.radius), p1 = c.center.clone().addScaledVector(dir, len * c.radius);
        b.quad(p0.clone().sub(side), p0.clone().add(side), p1.clone().add(side), p1.clone().sub(side), c.normal, '#2d3530');
      }
    }
    this.hands.geometry.dispose();
    this.hands.geometry = b.build();
  }

  /** Heroes (Ferry clock tower, Coit, Transamerica) thin out as a whole while they hide the player. */
  private updateHeroFades(dt: number, camera: THREE.Camera, fade: boolean) {
    const c = camera.position, p = runtime.player;
    const px = p.x, py = p.y + 1.0, pz = p.z;
    const k = 1 - Math.exp(-dt * 8);
    for (const h of this.heroFades) {
      let target = 0;
      if (fade) {
        const dx = px - c.x, dz = pz - c.z, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(0.92, ((h.x - c.x) * dx + (h.z - c.z) * dz) / L2));
        const d = Math.hypot(c.x + dx * t - h.x, c.z + dz * t - h.z);
        const y = c.y + (py - c.y) * t;
        if (y > h.y0 && y < h.y1) target = HERO_FADE * (1 - Math.min(1, Math.max(0, (d - h.r) / 1.2)));
      }
      h.fade.value += (target - h.fade.value) * k;
      if (h.fade.value < 0.002) h.fade.value = 0;
    }
  }

  setQuality(q: Quality, gl: THREE.WebGLRenderer) {
    gl.shadowMap.enabled = q !== 'low';
    this.env.setQuality(q, gl);
    this.city?.setQuality(q);
  }

  /**
   * City mode: start streaming the whole city (plan §5.1). The hero is already on screen; the manifest and the far city
   * load during the arrival cinematic, then chunks stream around the player. Idempotent.
   */
  enableCity(renderer: THREE.WebGLRenderer, quality: Quality, opts: { pool?: 'batched' | 'tile'; karl?: KarlFlag } = {}) {
    if (this.mode !== 'city' || this.city || !this.cityWater) return;
    const r = requireCity().startCityWorld({
      root: this.root, env: this.env, water: this.cityWater, halos: this.halosSpec, cityChunks: this.cityChunks,
      heroGround: this.heroGroundChunks, heroFarExtras: this.heroFarExtras, addSystem: sys => this.addSystem(sys),
    }, renderer, quality, opts);
    this.city = r.city;
    this.detachCity = r.detach;
  }

  setTime(tod: TimeOfDay, instant: boolean) { this.env.setTime(tod, instant); }

  /** Stop streaming (page teardown / QA): workers, provider, city meshes. */
  disableCity() {
    this.detachCity?.();
    this.detachCity = null;
    if (!this.city) return;
    this.root.remove(this.city.group);
    this.city.dispose();
    this.city = null;
  }

  /** average ms spent in update() (DEV profiling) */
  updateMs = 0;

  update(dt: number, t: number, camera: THREE.Camera, fade: boolean) {
    const t0 = performance.now();
    U.uTime.value = t;
    U.uCam.value.copy(camera.position);
    U.uPlayer.value.set(runtime.player.x, runtime.player.y + 0.8, runtime.player.z);
    U.uFade.value = fade ? 1 : 0;
    this.env.update(dt, camera, this.tmp.set(runtime.player.x, runtime.player.y, runtime.player.z));
    if (this.city) {
      // the haze cull reads the density the environment just set (city haze × cityFogK)
      this.city.haze = this.env.fog.density;
      this.city.update(dt, camera);
      this.cityWater?.update(camera);
    }
    this.pools.visible = this.env.night > 0.02;
    this.updateClock(t);
    this.updateHeroFades(dt, camera, fade);
    if (t - this.marketAt > 30) {
      this.marketAt = t;
      const open = isMarketOpen();
      this.market.open.visible = open;
      this.market.closed.visible = !open;
    }
    this.floaters.update(dt, t);
    this.streetcars.update(dt, t);
    this.life.update(dt, t, this.env.night);
    for (const sys of this.systems) sys.update?.(dt, t, camera, this.env.night);
    if (this.dynHaloDirty) {
      const a = this.halos.instanceMatrix;
      a.clearUpdateRanges();
      a.addUpdateRange(this.dynHaloBase * 16, this.dynHaloCount * 16);
      a.needsUpdate = true;
      this.dynHaloDirty = false;
    }
    this.fx.update(dt);
    this.updateMs += (performance.now() - t0 - this.updateMs) * 0.05;
  }
}

let WORLD: World | null = null;
/** Build once per page (cached across remounts; three re-uploads buffers to a new renderer). */
export function getWorld(): World {
  if (!WORLD) {
    WORLD = new World(game.get().worldMode);
    if (import.meta.env.DEV) console.debug(`[opus-bay world] built in ${WORLD.buildMs.toFixed(0)} ms · ${(WORLD.stats.triangles / 1000).toFixed(1)}k static tris`);
  }
  return WORLD;
}
