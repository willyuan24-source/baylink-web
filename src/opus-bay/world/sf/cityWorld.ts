import * as THREE from 'three';
import type { Quality } from '../../core/store';
import { pointInPolygon } from '../../core/terrain';
import type { Polygon } from '../../core/types';
import { DISTRICT, stationOf } from '../../data/district';
import { bayNow } from '../../game/bayNow';
import { moonPhase } from '../../realsf/moon';
import { karlMonthFactor } from '../../realsf/seasons';
import { ANGEL_ISLAND, type BridgeInfo, CITY_BACKDROP } from '../backdrop';
import { type Batch, CYL, M, resample, v3 } from '../builder';
import type { Environment } from '../environment';
import type { KarlFlag } from '../fogShader';
import { slabEdgeColumns } from '../ground';
import { PAL } from '../palette';
import type { HaloSpec } from '../props';
import { buildLightMask } from '../water';
import type { WorldSystem } from '../world';
import { CloudBank } from './cloudBank';
import type { KarlState } from './fog';
import type { HeroTile } from './farHero';
import { demSample } from './format';
import { cityDropLots, heroLandRaster, heroProxy } from './hero';
import { heroGroundJob } from './heroGround';
import { CrownDrift, LightField, siteLightSpecs } from './lights';
import { attachEastCut } from './cornersEastCut';
import { attachNorthBeach } from './cornersNorthBeach';
import { attachWharfShips } from './wharfShips';
import { attachMurals } from './murals';
import { CitySites } from './sites';
import { mountCityDebug } from './stats';
import { CityStreamer } from './stream';
import type { CityWater } from './water';

/**
 * City mode's part of the World (world/world.ts), in the city chunk (wave 4, lane V: "city code through
 * world/cityLoader.ts"; GameRoot kept under its size on origin): the west seawall, Angel Island's board, starting the
 * streamer with Karl's cloud bank, the night light field, the murals and the ?debug breakdown, and the hero lots the
 * streamed city replaces. District mode never loads it.
 */

/** The halos that light the water at night (the district water's light mask uses the same weights). */
export const haloLights = (halos: HaloSpec[]) => halos.map(h => ({ x: h.x, z: h.z, w: h.size >= 3 ? 1 : h.size >= 1.3 && h.y < 14 ? 0.3 : 0 })).filter(l => l.w > 0);

/** The west seam (lane A §9): a 16 u straight edge where city land meets hero water gets a seawall. */
export function westSeawall(b: Batch) {
  const a = { x: -218.7, z: 63.9 }, c = { x: -205.4, z: 73.6 };
  const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz);
  const n = new THREE.Vector3(dz / L, 0, -dx / L); // toward the hero water (north-east)
  const o = (p: { x: number; z: number }, k: number) => new THREE.Vector3(p.x + n.x * k, 0, p.z + n.z * k);
  const A = o(a, 0.2), B = o(c, 0.2);
  b.quad(A.clone().setY(0.35), B.clone().setY(0.35), B.clone().setY(-1.8), A.clone().setY(-1.8), n, ['#cfc5b3', '#cfc5b3', '#a99f8e', '#a99f8e']);
  b.quad(o(a, -0.6).setY(0.35), o(c, -0.6).setY(0.35), B.clone().setY(0.35), A.clone().setY(0.35), new THREE.Vector3(0, 1, 0), '#ddd3c1');
}

/**
 * The F-line catenary past the district's poles (verify-visual F9; world/ground.ts overheadWires stops its poles at station
 * 368 while the wires run on to the track ends on Jefferson St: a black bar over the Wharf at walking height). City mode
 * carries the poles on, every ~21 u like the district's and one just short of the wires' end, each arm across both
 * tracks along the median's own direction. District mode keeps its geometry (the hero regression).
 */
export function wharfPoles(t: Batch) {
  const median = DISTRICT.roads.find(r => r.id === 'embarcadero-median');
  if (!median) return;
  const WIRE_Y = 5.1; // world/ground.ts overheadWires
  const mp = resample(median.points, 1);
  let acc = 0, wharf = false;
  for (let i = 1; i < mp.length; i++) {
    acc += Math.hypot(mp[i].x - mp[i - 1].x, mp[i].z - mp[i - 1].z);
    if (acc < 21 && !(wharf && i === mp.length - 2 && acc >= 6)) continue;
    acc = 0;
    const p = mp[i];
    if (stationOf(p).st <= 368) continue;
    wharf = true;
    const a = mp[i - 1], b = mp[Math.min(i + 1, mp.length - 1)], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    t.add(CYL(6), M(p.x, 0, p.z, 0, 0.09, WIRE_Y + 0.5, 0.09), PAL.lampPost);
    t.beam(v3(p.x + nx * 1.9, WIRE_Y + 0.3, p.z + nz * 1.9), v3(p.x - nx * 1.9, WIRE_Y + 0.3, p.z - nz * 1.9), 0.07, 0.07, PAL.lampPost);
  }
}

/** The hero's own ground chunks among the World's static chunks (not Angel Island's): their bbox meets the slab's. */
export function heroGroundOf(chunks: THREE.Mesh[]): THREE.Mesh[] {
  const sb = new THREE.Box3(), v = new THREE.Vector3();
  for (const p of DISTRICT.slab) sb.expandByPoint(v.set(p.x, 0, p.z));
  sb.min.y = -Infinity; sb.max.y = Infinity;
  return chunks.filter(m => m.name.startsWith('ground#') && (m.geometry.computeBoundingBox(), sb.intersectsBox(m.geometry.boundingBox!)));
}

/** Angel Island's board (a 24-gon on the backdrop's ellipse): the table under the city water. */
export function angelIslandBoard(): Polygon {
  const A = ANGEL_ISLAND, ai = CITY_BACKDROP['angel-island'];
  return Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return { x: ai.x + Math.cos(a) * A.rx * Math.cos(A.rot) - Math.sin(a) * A.rz * Math.sin(A.rot), z: ai.z + Math.cos(a) * A.rx * Math.sin(A.rot) + Math.sin(a) * A.rz * Math.cos(A.rot) };
  });
}

/**
 * Remove the triangles of hero lots that the streamed city replaces (manifest.heroDropLots) from the already-built
 * district chunks (centroid inside the lot footprint grown by 1 u: walls, bays and eaves included).
 */
export function dropLotTriangles(meshes: THREE.Mesh[], lots: Polygon[]) {
  const grown = lots.map(poly => {
    const cx = poly.reduce((a, p) => a + p.x, 0) / poly.length, cz = poly.reduce((a, p) => a + p.z, 0) / poly.length;
    return poly.map(p => { const dx = p.x - cx, dz = p.z - cz, L = Math.hypot(dx, dz) || 1; return { x: p.x + (dx / L) * 1.4, z: p.z + (dz / L) * 1.4 }; });
  });
  for (const m of meshes) {
    const idx = m.geometry.getIndex(), pos = m.geometry.getAttribute('position');
    if (!idx) continue;
    const bb = m.geometry.boundingBox;
    if (bb && !grown.some(poly => poly.some(p => p.x >= bb.min.x - 2 && p.x <= bb.max.x + 2 && p.z >= bb.min.z - 2 && p.z <= bb.max.z + 2))) continue;
    const keep: number[] = [];
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
      if (grown.some(poly => pointInPolygon({ x, z }, poly))) continue;
      keep.push(a, b, c);
    }
    if (keep.length === idx.count) continue;
    m.geometry.setIndex(pos.count > 65535 ? new THREE.Uint32BufferAttribute(keep, 1) : new THREE.Uint16BufferAttribute(keep, 1));
  }
}

/** How often (s) the real sky re-reads the Bay clock: the moon's phase and Karl's month change slowly. */
export const REAL_SKY_EVERY = 60;

/**
 * The real sky (W5-V10, city mode): the sky's moon shows tonight's phase (lane R's realsf/moon.ts, from the Bay clock:
 * `?date=` moves it in DEV / QA builds) and Karl the Fog follows the month (lane R's karlMonthFactor: July the foggiest,
 * September and October the clearest). Read at once, then every REAL_SKY_EVERY seconds; district mode never has it.
 */
export function realSky(env: Pick<Environment, 'setMoonPhase'>, karl: Pick<KarlState, 'setMonth'> | null, now: () => Date = bayNow): WorldSystem {
  let wait = 0;
  return {
    name: 'real-sky',
    update(dt: number) {
      wait -= dt;
      if (wait > 0) return;
      wait = REAL_SKY_EVERY;
      const d = now();
      env.setMoonPhase(moonPhase(d).phase);
      karl?.setMonth(karlMonthFactor(d));
    },
  };
}

/** What the World hands its city part (world.ts enableCity). */
export interface CityWorldHost {
  root: THREE.Group;
  env: Environment;
  water: CityWater;
  /** the hero's halos (their night light on the water) */
  halos: HaloSpec[];
  /** the Bay Bridge's west span (world/backdrop.ts, city mode: its suspender strands for The Bay Lights, W5-V10) */
  bayBridge?: BridgeInfo | null;
  /** the hero's building chunks (hidden when far; hero lots the city replaces are cut out of them) */
  cityChunks: THREE.Mesh[];
  /** the hero's own ground chunks, and its labels / contact blobs */
  heroGround: THREE.Mesh[];
  heroFarExtras: THREE.Object3D[];
  /** the hero's 150 u tiles: near chunk + far detail chunk (W5-V2; world/sf/farHero.ts) */
  heroTiles: HeroTile[];
  addSystem(sys: WorldSystem): () => void;
}

/**
 * City mode: start streaming the whole city (plan §5.1). The hero is already on screen; the manifest and the far city
 * load during the arrival cinematic, then chunks stream around the player. Returns the streamer and the function that
 * removes what came with it (the ?debug breakdown, the murals, Karl's bank and the light field), in that order.
 */
export function startCityWorld(host: CityWorldHost, renderer: THREE.WebGLRenderer, quality: Quality, opts: { pool?: 'batched' | 'tile'; karl?: KarlFlag }): { city: CityStreamer; detach: () => void } {
  const { env, water, root } = host;
  const ai = CITY_BACKDROP['angel-island'];
  const sites = new CitySites();
  // Karl the Fog (?karl=0|1, else the time table) with its cloud bank, and the night light field
  const karl = env.karl!; // city mode always has Karl (Environment gets the city chunk's KarlState)
  if (opts.karl !== undefined) karl.setFlag(opts.karl);
  const clouds = new CloudBank(karl, null, () => env.fog.density);
  const lightField = new LightField(renderer, { slab: DISTRICT.slab, siteLights: () => siteLightSpecs(sites.siteLights()), bayBridge: host.bayBridge });
  // W5-V10: the real sky (tonight's moon, Karl's month) and the Salesforce crown's drift on the hero tower itself
  const crown = new CrownDrift(root.getObjectByName('hero:salesforce-tower') as THREE.Mesh | undefined);
  const detachAtmos = [host.addSystem(clouds), host.addSystem(lightField), host.addSystem(realSky(env, karl)), host.addSystem(crown)];
  const sb = new THREE.Box3();
  for (const m of host.heroGround) sb.union(m.geometry.boundingBox!);
  const heroGround = host.heroGround;
  let cityGround: ((x: number, z: number) => number | null) | null = null;
  const streamer = new CityStreamer({
    renderer, quality, slab: DISTRICT.slab, sites, pool: opts.pool,
    hero: {
      meshes: [...host.cityChunks, ...host.heroFarExtras], proxy: heroProxy, tiles: host.heroTiles,
      ground: { meshes: heroGround, job: () => heroGroundJob(heroGround, { box: { x0: sb.min.x, z0: sb.min.z, x1: sb.max.x, z1: sb.max.z } }) },
    },
    farInit: { heroLand: heroLandRaster(), islands: [{ x: ai.x, z: ai.z, rx: ANGEL_ISLAND.rx * 0.95, rz: ANGEL_ISLAND.rz * 0.95, rot: ANGEL_ISLAND.rot }] },
    onFar: (r, far) => {
      const s = r.shore;
      const tex = new THREE.DataTexture(s.data, s.cols, s.rows, THREE.RedFormat, THREE.UnsignedByteType);
      tex.minFilter = tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.NoColorSpace;
      tex.needsUpdate = true;
      const box = new THREE.Vector4(s.x0, s.z0, s.cols * s.step, s.rows * s.step);
      water.setShore(tex, box, s, buildLightMask(haloLights(host.halos), box, 2));
      water.setLakes(r.lakes);
      const land = (x: number, z: number) => {
        const i = Math.floor((x - s.x0) / s.step), j = Math.floor((z - s.z0) / s.step);
        return i >= 0 && j >= 0 && i < s.cols && j < s.rows && s.data[j * s.cols + i] === 0;
      };
      // the board's edge waits for the satellite boards (onBoards): where it crosses their land it shows their strata
      cityGround = (x, z) => (land(x, z) ? demSample(far.dem, x, z) : null);
      env.groundAt = (x, z) => demSample(far.dem, x, z);
      clouds.setGround(env.groundAt);
      lightField.setFar(far);
    },
    onBoards: r => {
      if (r) { water.setBoardLand(r.landTiles); lightField.setExtra(r.lights); }
      const city = cityGround;
      water.setEdge((x, z) => r?.groundAt(x, z) ?? city?.(x, z) ?? null, slabEdgeColumns);
    },
  });
  root.add(streamer.group);
  root.updateMatrixWorld(true);
  // lane H2b's Mission murals (world/sf/murals.ts; null until they exist)
  const murals = attachMurals(streamer);
  const detachMurals = murals ? host.addSystem(murals) : null;
  // W6-W2: the North Beach corner on the seam W6-W1 filled (Washington Square, Saints Peter and Paul, Columbus Ave)
  const detachNorthBeach = host.addSystem(attachNorthBeach());
  // W7-W1: the East Cut / Embarcadero corner (Salesforce Park's deck, Cupid's Span, Redwood Park, the Sentinel)
  const detachEastCut = host.addSystem(attachEastCut());
  // W7-W1: USS Pampanito alongside Pier 45 (world/sf/wharfShips.ts)
  const detachShips = host.addSystem(attachWharfShips());
  void streamer.start().then(() => {
    const m = streamer.manifest;
    // the far detail chunks carry the same lots: cut them out there too
    const far = host.heroTiles.map(t => t.far).filter((f): f is THREE.Mesh => !!f);
    const drop = cityDropLots(m?.heroDropLots ?? []);
    if (drop.length) dropLotTriangles([...host.cityChunks, ...far], drop.map(i => DISTRICT.blocks[i]?.footprint).filter((p): p is Polygon => !!p));
  });
  const unmountDebug = mountCityDebug(streamer, renderer);
  // W5-V7: BAYBAY's recorded wave-5 lines play with her bubbles (game/voiceW5.ts, its own small chunk)
  let offVoice: (() => void) | null = null, detached = false;
  void import('../../game/voiceW5').then(m => { if (!detached) offVoice = m.initW5Voice(); }, () => { /* text bubbles only */ });
  return {
    city: streamer,
    detach: () => {
      detached = true;
      offVoice?.();
      unmountDebug();
      detachMurals?.();
      detachNorthBeach();
      detachEastCut();
      detachShips();
      for (const d of detachAtmos) d();
    },
  };
}
