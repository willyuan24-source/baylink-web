import * as THREE from 'three';
import type { Polygon } from '../core/types';
import type { Quality, TimeOfDay, WorldMode } from '../core/store';
import { MOON_DIR, TIME_PRESETS, type TimePreset } from './palette';
import { U } from './materials';
import { cityFogK } from './sf/fog';

/**
 * Sky dome, sun + hemisphere light, fog, the cream "table" under the floating diorama boards and their
 * soft shadow, time-of-day transitions and the player-following shadow frustum.
 */

export const TABLE_Y = -10.5;
/** Normalised moon direction (sky disc, water glitter). */
export const MOON = new THREE.Vector3(...MOON_DIR).normalize();
/**
 * The diorama table: its centre (radial darkening toward the boards), radius and darkening ring. District: the slab at
 * the origin. City (plan §5.8): the whole San Francisco board, radius 3400 around (240, 660), darkening 1600 … 3000.
 */
const TABLE = {
  district: { x: 0, z: 0, radius: 2600, dark0: 220, dark1: 700 },
  city: { x: 240, z: 660, radius: 3400, dark0: 1600, dark1: 3000 },
} as const;

interface Live {
  skyTop: THREE.Color; skyHorizon: THREE.Color; skyBottom: THREE.Color;
  sunColor: THREE.Color; sunIntensity: number; sunDir: THREE.Vector3;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiIntensity: number;
  fog: THREE.Color; fogDensity: number;
  waterDeep: THREE.Color; waterShallow: THREE.Color; table: THREE.Color;
  night: number; sunDisc: number; sparkle: number; exposure: number;
  golden: number; warm: number; vignette: number;
}

function toLive(p: TimePreset): Live {
  return {
    skyTop: new THREE.Color(p.skyTop), skyHorizon: new THREE.Color(p.skyHorizon), skyBottom: new THREE.Color(p.skyBottom),
    sunColor: new THREE.Color(p.sunColor), sunIntensity: p.sunIntensity, sunDir: new THREE.Vector3(...p.sunDir).normalize(),
    hemiSky: new THREE.Color(p.hemiSky), hemiGround: new THREE.Color(p.hemiGround), hemiIntensity: p.hemiIntensity,
    fog: new THREE.Color(p.fog), fogDensity: p.fogDensity,
    waterDeep: new THREE.Color(p.waterDeep), waterShallow: new THREE.Color(p.waterShallow), table: new THREE.Color(p.table),
    night: p.night, sunDisc: p.sunDisc, sparkle: p.sparkle, exposure: p.exposure,
    golden: p.golden, warm: p.warm, vignette: p.vignette,
  };
}
function lerpLive(a: Live, b: Live, t: number) {
  for (const k of Object.keys(a) as (keyof Live)[]) {
    const va = a[k], vb = b[k];
    if (va instanceof THREE.Color) va.lerp(vb as THREE.Color, t);
    else if (va instanceof THREE.Vector3) va.lerp(vb as THREE.Vector3, t).normalize();
    else (a as unknown as Record<string, number>)[k] = (va as number) + ((vb as number) - (va as number)) * t;
  }
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // at the far plane
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uSunDisc;
uniform float uNight;
uniform float uGolden;
uniform float uTime;
varying vec3 vDir;
float h1(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = y > 0.0 ? mix(uHorizon, uTop, pow(smoothstep(0.0, 0.62, y), 0.75)) : mix(uHorizon, uBottom, smoothstep(0.0, -0.18, y));
  // golden hour: pink anti-solar "Belt of Venus" just above the horizon opposite the sun
  vec2 sxz = normalize(uSunDir.xz + 1e-5);
  float anti = pow(max(dot(normalize(d.xz + 1e-5), -sxz), 0.0), 2.0);
  col = mix(col, vec3(0.95, 0.76, 0.71), 0.35 * uGolden * anti * smoothstep(0.0, 0.05, y) * (1.0 - smoothstep(0.08, 0.25, y)));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 1400.0) * 6.0 + pow(s, 60.0) * 0.28 + pow(s, 8.0) * 0.12) * uSunDisc;
  // night: warm city glow on the horizon, a big soft moon over the Bay, round twinkling stars
  col += vec3(0.45, 0.30, 0.25) * smoothstep(0.12, 0.0, y) * uNight * 0.35;
  float m = max(dot(d, uMoonDir), 0.0);
  // crisp disc (~1.5°) with a soft shoulder, plus a wide cool halo
  float disc = smoothstep(0.99955, 0.99972, m) + pow(m, 700.0) * 0.5;
  col += (vec3(1.0, 0.97, 0.9) * min(disc * 2.2, 2.4) + vec3(0.7, 0.78, 0.95) * (pow(m, 18.0) * 0.25 + pow(m, 120.0) * 0.3)) * uNight;
  // stars: a jittered point per sky cell (~1°), round, two sizes, twinkling, fading toward the horizon
  vec2 sg = vec2(atan(d.z, d.x), asin(clamp(y, -1.0, 1.0))) * 60.0;
  vec2 cid = floor(sg);
  float h = h1(vec3(cid, 3.0));
  if (h > 0.93 && y > 0.0) {
    vec2 c = vec2(h1(vec3(cid, 7.1)), h1(vec3(cid, 9.3))) * 0.6 + 0.2;
    float big = step(0.985, h);
    float r = mix(0.15, 0.24, big);
    float a = smoothstep(r, r * 0.25, length(fract(sg) - c));
    float tw = 0.7 + 0.3 * sin(uTime * (1.5 + fract(h * 91.0) * 3.0) + h * 60.0);
    col += vec3(0.9, 0.93, 1.0) * a * tw * mix(0.7, 1.3, big) * smoothstep(0.03, 0.3, y) * uNight;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Environment {
  readonly group = new THREE.Group();
  readonly sun = new THREE.DirectionalLight('#fff2dd', 2.5);
  readonly hemi = new THREE.HemisphereLight('#e3eef3', '#cbbd9f', 1.1);
  readonly fog = new THREE.FogExp2('#ece5d8', 0.0014);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private table: THREE.Mesh;
  private tableMat: THREE.MeshBasicMaterial;
  private shadow: THREE.Mesh | null = null;
  private live: Live = toLive(TIME_PRESETS.golden);
  private target: Live = toLive(TIME_PRESETS.golden);
  private tod: TimeOfDay = 'golden';
  private blend = 1;
  private shadowSize = 0;
  private lightBasis = new THREE.Matrix4();
  private lightBasisInv = new THREE.Matrix4();
  private fwd = new THREE.Vector3();
  private fogBase = new THREE.Color();
  readonly water: THREE.ShaderMaterial[] = [];
  readonly mode: WorldMode;
  /** ground height under the camera (city mode fog), set by the world */
  groundAt: ((x: number, z: number) => number) | null = null;
  private fogK = 1;

  constructor(mode: WorldMode = 'district') {
    this.mode = mode;
    const T = TABLE[mode];
    this.group.name = 'environment';
    this.skyMat = new THREE.ShaderMaterial({
      name: 'ob-sky',
      uniforms: {
        uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uSunDisc: { value: 1 }, uNight: U.uNight,
        uMoonDir: { value: MOON.clone() }, uGolden: { value: 0 }, uTime: U.uTime,
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.name = 'sky';
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.group.add(this.sky);

    this.tableMat = new THREE.MeshBasicMaterial({ color: '#f3ecdf' });
    this.tableMat.name = 'ob-table';
    // slightly darker (warmer) toward the boards, so the diorama reads as sitting on the table
    this.tableMat.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
varying vec2 vTableXZ;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vTableXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec2 vTableXZ;
const vec2 obTableC = vec2(${T.x.toFixed(1)}, ${T.z.toFixed(1)});`)
        .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= mix(0.9, 1.0, smoothstep(${T.dark0.toFixed(1)}, ${T.dark1.toFixed(1)}, length(vTableXZ - obTableC)));`);
    };
    // city: its own program key (the table shader differs); district unchanged
    if (mode === 'city') this.tableMat.customProgramCacheKey = () => 'ob-table-city';
    this.table = new THREE.Mesh(new THREE.CircleGeometry(T.radius, mode === 'city' ? 64 : 48).rotateX(-Math.PI / 2), this.tableMat);
    this.table.name = 'table';
    this.table.position.set(T.x, TABLE_Y, T.z);
    this.table.matrixAutoUpdate = false;
    this.table.updateMatrix();
    this.group.add(this.table);

    this.sun.name = 'sun';
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    this.group.add(this.sun, this.sun.target, this.hemi);
    this.apply();
  }

  /** Soft blurred shadow of the floating boards on the table (drawn once into a canvas). */
  setBoards(boards: Polygon[]) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const b of boards) for (const p of b) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    const pad = 60;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    const W = maxX - minX, H = maxZ - minZ;
    const res = 1024 / Math.max(W, H);
    const cw = Math.max(8, Math.round(W * res)), ch = Math.max(8, Math.round(H * res));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const off = { x: 4, z: 6.5 };
    // alphaMap reads the green channel: white shadow shapes on an opaque black canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    const draw = (blur: number, alpha: number, grow: number) => {
      ctx.filter = `blur(${blur}px)`;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      for (const b of boards) {
        const cx = b.reduce((s, p) => s + p.x, 0) / b.length, cz = b.reduce((s, p) => s + p.z, 0) / b.length;
        ctx.beginPath();
        b.forEach((p, i) => {
          const x = (cx + (p.x - cx) * grow + off.x - minX) * res, y = (cz + (p.z - cz) * grow + off.z - minZ) * res;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
      }
    };
    draw(20 * res, 0.45, 1.06);
    draw(7 * res, 0.55, 1.0);
    draw(2.5 * res, 0.45, 0.97);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    const mat = new THREE.MeshBasicMaterial({ color: '#5a4630', alphaMap: tex, transparent: true, opacity: 0.72, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    mat.name = 'ob-board-shadow';
    if (this.shadow) { this.group.remove(this.shadow); this.shadow.geometry.dispose(); (this.shadow.material as THREE.Material).dispose(); }
    const geo = new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(geo, mat);
    this.shadow.name = 'board-shadow';
    this.shadow.position.set(minX + W / 2, TABLE_Y + 0.4, minZ + H / 2);
    this.shadow.renderOrder = -5;
    this.shadow.matrixAutoUpdate = false;
    this.shadow.updateMatrix();
    this.group.add(this.shadow);
  }

  setTime(tod: TimeOfDay, instant: boolean) {
    if (tod === this.tod && this.blend >= 1) return;
    this.tod = tod;
    this.target = toLive(TIME_PRESETS[tod]);
    this.blend = instant ? 1 : 0;
    if (instant) { this.live = toLive(TIME_PRESETS[tod]); this.apply(); }
  }
  get timeOfDay() { return this.tod; }
  get night() { return this.live.night; }
  get sunDir() { return this.live.sunDir; }
  get exposure() { return this.live.exposure; }
  get warm() { return this.live.warm; }
  get vignette() { return this.live.vignette; }

  setQuality(q: Quality, renderer: THREE.WebGLRenderer) {
    const size = q === 'high' ? 2048 : q === 'mid' ? 1024 : 0;
    this.sun.castShadow = size > 0 && renderer.shadowMap.enabled;
    if (size && size !== this.shadowSize) {
      this.shadowSize = size;
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      const half = q === 'high' ? 24 : 19;
      const cam = this.sun.shadow.camera;
      cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
      cam.updateProjectionMatrix();
    }
  }

  update(dt: number, camera: THREE.Camera, focus: THREE.Vector3) {
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 2.2);
      lerpLive(this.live, this.target, Math.min(1, dt * 2.2 + (this.blend >= 1 ? 1 : 0)));
      this.apply();
    }
    if (this.mode === 'city') {
      // fog density is a uniform: thinning it with the camera altitude / height never recompiles anything
      const ground = this.groundAt ? this.groundAt(camera.position.x, camera.position.z) : 0;
      const k = cityFogK(camera.position.y, ground, this.tod);
      this.fogK += (k - this.fogK) * Math.min(1, dt * 3);
      this.fog.density = this.live.fogDensity * this.fogK;
    }
    this.sky.position.copy(camera.position);
    this.sky.updateMatrix();
    this.sky.matrixWorld.copy(this.sky.matrix);
    // shadow frustum follows the player, snapped to shadow texels to avoid shimmering
    const dir = this.live.sunDir;
    const tgt = this.sun.target.position;
    camera.getWorldDirection(this.fwd);
    this.fwd.y = 0;
    if (this.fwd.lengthSq() > 1e-6) this.fwd.normalize();
    tgt.copy(focus).addScaledVector(this.fwd, 7);
    if (this.shadowSize) {
      const texel = (this.sun.shadow.camera.right - this.sun.shadow.camera.left) / this.shadowSize;
      const p = tgt.clone().applyMatrix4(this.lightBasisInv);
      p.x = Math.round(p.x / texel) * texel;
      p.y = Math.round(p.y / texel) * texel;
      tgt.copy(p.applyMatrix4(this.lightBasis));
    }
    this.sun.position.copy(tgt).addScaledVector(dir, 90);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }

  private apply() {
    const L = this.live;
    const su = this.skyMat.uniforms;
    su.uTop.value.copy(L.skyTop);
    su.uHorizon.value.copy(L.skyHorizon);
    su.uBottom.value.copy(L.skyBottom);
    su.uSunDir.value.copy(L.sunDir);
    su.uSunColor.value.copy(L.sunColor);
    su.uSunDisc.value = L.sunDisc;
    su.uGolden.value = L.golden;
    this.sun.color.copy(L.sunColor);
    this.sun.intensity = L.sunIntensity;
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiIntensity;
    // fog leans 20 % toward the table, so distant boards settle onto it instead of melting into the sky
    this.fog.color.copy(this.fogBase.copy(L.fog).lerp(L.table, 0.2));
    this.sun.shadow.intensity = 1 - 0.45 * L.night;
    this.fog.density = L.fogDensity;
    this.tableMat.color.copy(L.table);
    U.uNight.value = L.night;
    for (const w of this.water) {
      w.uniforms.uDeep.value.copy(L.waterDeep);
      w.uniforms.uShallow.value.copy(L.waterShallow);
      w.uniforms.uSky.value.copy(L.skyHorizon);
      // at night the water speculars follow the moon (a glitter path under it)
      w.uniforms.uSunDir.value.copy(L.sunDir).lerp(MOON, L.night).normalize();
      w.uniforms.uSunColor.value.copy(L.sunColor);
      w.uniforms.uSparkle.value = L.sparkle;
      w.uniforms.uLight.value = 0.42 + 0.58 * (1 - L.night);
    }
    // light-space basis for texel snapping
    const z = L.sunDir.clone();
    const x = new THREE.Vector3(0, 1, 0).cross(z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    const y = z.clone().cross(x).normalize();
    this.lightBasis.makeBasis(x, y, z);
    this.lightBasisInv.copy(this.lightBasis).invert();
  }

  dispose() {
    this.sky.geometry.dispose();
    this.skyMat.dispose();
    this.table.geometry.dispose();
    this.tableMat.dispose();
    if (this.shadow) { this.shadow.geometry.dispose(); (this.shadow.material as THREE.MeshBasicMaterial).alphaMap?.dispose(); (this.shadow.material as THREE.Material).dispose(); }
    this.sun.shadow.map?.dispose();
  }
}
