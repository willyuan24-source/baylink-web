import * as THREE from 'three';
import type { Polygon } from '../core/types';
import { KIND, blockers, pointInPolygon, terrainGrid } from '../core/terrain';
import { DISTRICT } from '../data/district';
import { PAL } from './palette';
import { BDIST_MAX, U } from './materials';

/**
 * Bay water: one ShaderMaterial shared by the district slab and the backdrop tiles.
 * Gentle vertex waves, fresnel sky tint, shallow → deep colour from a CPU distance-to-shore field,
 * animated shore / piling foam, golden-hour glints, boat wakes and night light shimmer.
 */

export const DIST_MAX = 24;
export const MAX_WAKES = 6;

let DIST_FIELD: { D: Float32Array; cols: number; rows: number; cell: number; minX: number; minZ: number } | null = null;
/**
 * Distance to shore (u) from the CPU field built with the texture; points outside the grid add their distance
 * to it (used by the bay-side water skirt past the slab edge). −1 before the texture exists.
 */
export function shoreDistance(x: number, z: number): number {
  const f = DIST_FIELD;
  if (!f) return -1;
  const W = f.cols * f.cell, H = f.rows * f.cell;
  const cx = Math.min(W - 1e-3, Math.max(0, x - f.minX)), cz = Math.min(H - 1e-3, Math.max(0, z - f.minZ));
  const out = Math.hypot(x - f.minX - cx, z - f.minZ - cz);
  const d = f.D[Math.floor(cz / f.cell) * f.cols + Math.floor(cx / f.cell)];
  return Math.min(DIST_MAX, d + out);
}

/**
 * Night light mask for the water reflections: soft splats (σ ≈ 2 u) at every light source, baked over the
 * same box as the distance texture. Lights beyond a water point (seen from the camera) reflect in it.
 */
export function buildLightMask(lights: { x: number; z: number; w: number }[], box: THREE.Vector4, cell = 1): THREE.DataTexture {
  const cols = Math.max(4, Math.ceil(box.z / cell)), rows = Math.max(4, Math.ceil(box.w / cell));
  const acc = new Float32Array(cols * rows);
  const R = 6, sigma = 2 / cell;
  for (const l of lights) {
    const c0 = Math.round((l.x - box.x) / cell), r0 = Math.round((l.z - box.y) / cell);
    for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) {
      const c = c0 + dc, r = r0 + dr;
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      acc[r * cols + c] += l.w * Math.exp(-(dc * dc + dr * dr) / (2 * sigma * sigma));
    }
  }
  const data = new Uint8Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.min(1, acc[i]) * 255);
  const t = new THREE.DataTexture(data, cols, rows, THREE.RedFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Chamfer distance (world units) from every water cell to the nearest land / deck cell, as an R8 texture. */
export function buildDistanceTexture(): { texture: THREE.DataTexture; box: THREE.Vector4 } {
  const g = terrainGrid();
  const { cols, rows, cell, kind } = g;
  const n = cols * rows;
  const D = new Float32Array(n);
  const INF = 1e6;
  for (let i = 0; i < n; i++) D[i] = kind[i] === KIND.land || kind[i] === KIND.deck ? 0 : INF;
  chamfer(D, cols, rows, cell);
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.round(Math.min(1, D[i] / DIST_MAX) * 255);
  DIST_FIELD = { D, cols, rows, cell, minX: g.minX, minZ: g.minZ };
  return { texture: r8(data, cols, rows), box: new THREE.Vector4(g.minX, g.minZ, cols * cell, rows * cell) };
}

function r8(data: Uint8Array, cols: number, rows: number) {
  const texture = new THREE.DataTexture(data, cols, rows, THREE.RedFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Distance (0 … BDIST_MAX u) from every cell to the nearest building footprint / big blocker, for the
 * ground's contact shadow (walls, sheds, landmark bases, stalls and kiosks sit on the paving).
 */
export function buildBuildingDistanceTexture(): { texture: THREE.DataTexture; box: THREE.Vector4 } {
  const g = terrainGrid();
  const { cols, rows, cell } = g;
  const D = new Float32Array(cols * rows).fill(1e6);
  const mark = (x0: number, z0: number, x1: number, z1: number, inside: (x: number, z: number) => boolean) => {
    const c0 = Math.max(0, Math.floor((x0 - g.minX) / cell)), c1 = Math.min(cols - 1, Math.ceil((x1 - g.minX) / cell));
    const r0 = Math.max(0, Math.floor((z0 - g.minZ) / cell)), r1 = Math.min(rows - 1, Math.ceil((z1 - g.minZ) / cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = g.minX + (c + 0.5) * cell, z = g.minZ + (r + 0.5) * cell;
      if (inside(x, z)) D[r * cols + c] = 0;
    }
  };
  for (const b of blockers()) {
    if (b.kind === 'polygon') {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const q of b.polygon) { minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minZ = Math.min(minZ, q.z); maxZ = Math.max(maxZ, q.z); }
      mark(minX, minZ, maxX, maxZ, (x, z) => pointInPolygon({ x, z }, b.polygon));
    } else if (b.r >= 0.8) {
      mark(b.x - b.r, b.z - b.r, b.x + b.r, b.z + b.r, (x, z) => Math.hypot(x - b.x, z - b.z) <= b.r * 0.9);
    }
  }
  chamfer(D, cols, rows, cell);
  const data = new Uint8Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(Math.min(1, D[i] / BDIST_MAX) * 255);
  return { texture: r8(data, cols, rows), box: new THREE.Vector4(g.minX, g.minZ, cols * cell, rows * cell) };
}

/** Two-pass chamfer distance transform in place (0 = source cell). */
function chamfer(D: Float32Array, cols: number, rows: number, cell: number) {
  const d1 = cell, d2 = cell * Math.SQRT2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let v = D[i];
      if (v === 0) continue;
      if (c > 0) v = Math.min(v, D[i - 1] + d1);
      if (r > 0) {
        v = Math.min(v, D[i - cols] + d1);
        if (c > 0) v = Math.min(v, D[i - cols - 1] + d2);
        if (c < cols - 1) v = Math.min(v, D[i - cols + 1] + d2);
      }
      D[i] = v;
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      let v = D[i];
      if (v === 0) continue;
      if (c < cols - 1) v = Math.min(v, D[i + 1] + d1);
      if (r < rows - 1) {
        v = Math.min(v, D[i + cols] + d1);
        if (c < cols - 1) v = Math.min(v, D[i + cols + 1] + d2);
        if (c > 0) v = Math.min(v, D[i + cols - 1] + d2);
      }
      D[i] = v;
    }
  }
}

function closestOnPolygon(x: number, z: number, poly: Polygon): [number, number, number] {
  let best = Infinity, bx = x, bz = z;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2));
    const qx = a.x + dx * t, qz = a.z + dz * t, d = (x - qx) ** 2 + (z - qz) ** 2;
    if (d < best) { best = d; bx = qx; bz = qz; }
  }
  return [bx, bz, Math.sqrt(best)];
}
function inside(x: number, z: number, poly: Polygon) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) ins = !ins;
  }
  return ins;
}

/**
 * Grid of water vertices clipped to a (convex-ish) polygon: outside vertices snap onto the edge.
 * `dist(x,z)` gives the distance to shore for tiles (−1 = sample the district texture).
 */
export function waterGrid(poly: Polygon, spacing: number, y: number, dist: ((x: number, z: number) => number) | null): THREE.BufferGeometry {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const cols = Math.ceil((maxX - minX) / spacing) + 1, rows = Math.ceil((maxZ - minZ) / spacing) + 1;
  const pos: number[] = [], edge: number[] = [], dd: number[] = [], idx: number[] = [];
  const keep = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let x = minX + ((maxX - minX) * c) / (cols - 1), z = minZ + ((maxZ - minZ) * r) / (rows - 1);
      const ins = inside(x, z, poly);
      const [qx, qz, dEdge] = closestOnPolygon(x, z, poly);
      if (!ins) { x = qx; z = qz; }
      keep[r * cols + c] = ins || dEdge < spacing * 1.5 ? 1 : 0;
      pos.push(x, y, z);
      edge.push(ins ? Math.min(1, dEdge / 6) : 0);
      dd.push(dist ? dist(x, z) : -1);
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      if (!keep[a] && !keep[b] && !keep[d] && !keep[e]) continue;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  geo.setAttribute('aDist', new THREE.Float32BufferAttribute(dd, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform sampler2D uDistTex;
uniform vec4 uDistBox;
attribute float aEdge;
attribute float aDist;
varying vec3 vW;
varying float vDist;
varying float vUseTex;
varying float vEdge;
float waveH(vec2 p, float t) {
  return sin(p.x * 0.21 + t * 1.1) * 0.5 + sin(p.y * 0.17 - t * 0.9 + p.x * 0.05) * 0.35 + sin((p.x + p.y) * 0.43 + t * 1.9) * 0.15;
}
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float d = aDist;
  vUseTex = d < 0.0 ? 1.0 : 0.0;
  if (d < 0.0) {
    vec2 uv = (wp.xz - uDistBox.xy) / uDistBox.zw;
    d = texture2D(uDistTex, uv).r * ${DIST_MAX.toFixed(1)};
  }
  float amp = 0.075 * smoothstep(0.3, 5.0, d) * aEdge;
  wp.y += waveH(wp.xz, uTime) * amp;
  vW = wp.xyz;
  vDist = d;
  vEdge = aEdge;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uNight;
uniform float uSparkle;
uniform float uLight;
uniform sampler2D uDistTex;
uniform vec4 uDistBox;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform sampler2D uLightTex;
uniform vec4 uWakes[${MAX_WAKES}];
varying vec3 vW;
varying float vDist;
varying float vUseTex;
varying float vEdge;
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nse(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), u.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 waveGrad(vec2 p, float t) {
  float gx = cos(p.x * 0.21 + t * 1.1) * 0.5 * 0.21 + cos(p.y * 0.17 - t * 0.9 + p.x * 0.05) * 0.35 * 0.05 + cos((p.x + p.y) * 0.43 + t * 1.9) * 0.15 * 0.43;
  float gz = cos(p.y * 0.17 - t * 0.9 + p.x * 0.05) * 0.35 * 0.17 + cos((p.x + p.y) * 0.43 + t * 1.9) * 0.15 * 0.43;
  return vec2(gx, gz);
}
void main() {
  float t = uTime;
  float d = vDist;
  if (vUseTex > 0.5) d = texture2D(uDistTex, (vW.xz - uDistBox.xy) / uDistBox.zw).r * ${DIST_MAX.toFixed(1)};
  // normal: broad swell + fine ripples
  vec2 gr = waveGrad(vW.xz, t) * 0.5;
  vec2 rp = vW.xz * 1.3;
  float r1 = nse(rp + vec2(t * 0.6, t * 0.35));
  float r2 = nse(rp * 1.9 - vec2(t * 0.45, -t * 0.5));
  // Nyquist fades (idea: GTA_SZ city-bay-water.ts:81): detail finer than ~2–3 px (far water, grazing view)
  // fades to its mean instead of sparkling; 1 (= unchanged) wherever it is resolved
  vec2 fwRp = fwidth(rp * 1.9);
  gr += (vec2(r1, r2) - 0.5) * 0.22 * (1.0 - smoothstep(0.35, 1.8, max(fwRp.x, fwRp.y)));
  vec3 n = normalize(vec3(-gr.x, 1.0, -gr.y));
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(uSunDir);
  float depthT = smoothstep(0.0, 13.0, d);
  vec3 col = mix(uShallow, uDeep, depthT);
  // toy ripple lines in open water
  float linePh = dot(vW.xz, vec2(0.55, 0.83)) * 1.3 + t * 0.8 + nse(vW.xz * 0.15) * 6.0;
  // mean of the line profile over a period is 0.082
  float lines = mix(0.082, smoothstep(0.93, 1.0, sin(linePh)), 1.0 - smoothstep(0.35, 1.8, fwidth(linePh)));
  col = mix(col, uShallow * 1.12, lines * 0.08 * depthT);
  float diff = 0.78 + 0.22 * max(dot(n, L), 0.0);
  col *= diff * uLight;
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  col = mix(col, uSky, fres * 0.55);
  // sun glints (golden hour sparkles)
  vec3 R = reflect(-L, n);
  float spec = pow(max(dot(R, V), 0.0), 160.0);
  vec2 gq = vW.xz * 4.0 + t * 1.5;
  vec2 fwGq = fwidth(gq);
  // P(noise > 0.8) ≈ 0.093: unresolved glitter becomes an even sheen of the same average brightness
  float glitter = mix(0.093, step(0.8, nse(gq)), 1.0 - smoothstep(0.35, 1.8, max(fwGq.x, fwGq.y))) * pow(max(dot(R, V), 0.0), 24.0);
  // uSunDir leans to the moon at night (glitter path under the low moon)
  col += uSunColor * (spec * 1.4 + glitter * 0.9 * uSparkle) * (1.0 - uNight * 0.4);
  // shore + piling foam
  float brk = nse(vW.xz * 1.7 + vec2(t * 0.25, 0.0));
  float f1 = 1.0 - smoothstep(0.05, 0.75, d + (brk - 0.5) * 0.35);
  float f2 = smoothstep(0.6, 0.95, sin(d * 3.4 - t * 1.7 + brk * 2.0)) * (1.0 - smoothstep(0.4, 2.6, d));
  float foam = clamp(f1 + f2 * 0.55 * step(0.35, brk), 0.0, 1.0);
  // boat wakes
  for (int i = 0; i < ${MAX_WAKES}; i++) {
    vec4 w = uWakes[i];
    if (w.w <= 0.0) continue;
    vec2 rel = vW.xz - w.xy;
    vec2 fwd = vec2(sin(w.z), cos(w.z));
    vec2 rgt = vec2(fwd.y, -fwd.x);
    float behind = -dot(rel, fwd);
    float side = dot(rel, rgt);
    if (behind > -1.0 && behind < 18.0) {
      float fall = (1.0 - smoothstep(0.0, 18.0, behind)) * w.w;
      float vline = 1.0 - smoothstep(0.1, 0.45 + behind * 0.04, abs(abs(side) - max(behind, 0.0) * 0.36 - 0.6));
      float churn = (1.0 - smoothstep(0.2, 1.1, abs(side))) * (1.0 - smoothstep(0.0, 7.0, behind)) * step(0.0, behind);
      foam = max(foam, (vline * 0.8 + churn) * fall * (0.55 + 0.45 * brk));
    }
  }
  // foam: bright by day, a dark-teal lip at night (no beige blotches on black water)
  vec3 foamCol = mix(uFoam * max(uLight, 0.45), uDeep * 1.7 + vec3(0.03, 0.05, 0.08), uNight * 0.8);
  col = mix(col, foamCol, foam * 0.9 * (1.0 - 0.45 * uNight));
  // night: warm reflections anchored to real lights, streaked toward the camera
  if (uNight > 0.01 && vUseTex > 0.5) {
    vec2 away = normalize(vW.xz - cameraPosition.xz + 1e-4);
    vec2 side = vec2(-away.y, away.x);
    float m = 0.0;
    for (int k = 0; k < 3; k++) {
      vec2 q = vW.xz + away * (1.0 + float(k) * 3.0);
      m = max(m, texture2D(uLightTex, (q - uDistBox.xy) / uDistBox.zw).r);
    }
    float sn = nse(vec2(dot(vW.xz, side) * 2.2, dot(vW.xz, away) * 0.25 + t * 0.6));
    // right under the camera the streaks run straight down the screen as long gold "reeds" (wave 4, verify-visual
    // F8: the Embarcadero seawall under the Bay Bridge): they fade in from 12 to 28 u away
    float nearFade = smoothstep(12.0, 28.0, length(vW.xz - cameraPosition.xz));
    col += vec3(1.0, 0.72, 0.4) * smoothstep(0.6, 0.92, sn) * m * 0.45 * uNight * nearFade;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function makeWaterMaterial(distTex: THREE.Texture, box: THREE.Vector4): THREE.ShaderMaterial {
  const wakes: THREE.Vector4[] = [];
  for (let i = 0; i < MAX_WAKES; i++) wakes.push(new THREE.Vector4(0, 0, 0, 0));
  const m = new THREE.ShaderMaterial({
    name: 'ob-water',
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uDistTex: { value: null },
      uDistBox: { value: new THREE.Vector4() },
      uDeep: { value: new THREE.Color(PAL.waterDeep) },
      uShallow: { value: new THREE.Color(PAL.waterShallow) },
      uFoam: { value: new THREE.Color(PAL.foam) },
      uSky: { value: new THREE.Color('#f2e6d4') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      uSunColor: { value: new THREE.Color('#fff2dd') },
      uLightTex: { value: null },
      uSparkle: { value: 0.5 },
      uLight: { value: 1 },
      uWakes: { value: wakes },
    }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    fog: true,
  });
  // shared, live uniforms
  m.uniforms.uTime = U.uTime;
  m.uniforms.uNight = U.uNight;
  m.uniforms.uDistTex.value = distTex;
  m.uniforms.uDistBox.value = box;
  m.uniforms.uWakes.value = wakes;
  return m;
}

export function buildDistrictWater(material: THREE.ShaderMaterial): THREE.Mesh {
  const geo = waterGrid(DISTRICT.slab, 3.5, DISTRICT.waterLevel, null);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'water';
  mesh.matrixAutoUpdate = false;
  // after the land so early-z skips the water hidden under it
  mesh.renderOrder = 1;
  return mesh;
}
