import * as THREE from 'three';

/**
 * Karl the Fog, shader side (lane C2-8; split out of world/sf/fog.ts in wave 3, P7): the uniforms, the GLSL and
 * `patchFog`, which TOY / GROUND (materials.ts), the sky (environment.ts) and the city water, the light field and D2's
 * model material (through patchToyShader) compile in both world modes. Only this stays in the main graph; the time table,
 * the live state (KarlState), the coverage maths and the city haze factor are city-only (world/sf/fog.ts, the lazy city
 * chunk). District mode keeps `uKarl = 0`, so the branch never runs there.
 */

/** Karl's frame of reference (city world units; see world/sf/fog.ts for the coverage it drives). */
export const KARL_GEO = {
  /** Ocean Beach, middle of the shore (a = 0 along W) */
  origin: { x: -377, z: 1503 },
  /** true east / true north in the city frame (core/geo projectCity) */
  east: { x: 0.6947, z: -0.7193 },
  north: { x: -0.7193, z: -0.6947 },
  /** the strait mouth west of the bridge and the axis through the Golden Gate towards Alcatraz */
  gate: { x: -1167, z: 927, dx: 0.5819, dz: -0.8131 },
  /**
   * extinction length (u) inside the bank: amount = 1 − exp(−(length of the view ray inside the layer past `clear`) /
   * depth). Seen from above (Twin Peaks, a glide) only the part of the ray below the fog top counts, so the Sunset lies
   * under an opaque white sea with a lumpy top; walking inside it, ≈ 65 % is gone at 100 u (M3, wave 3; was 300 on the
   * whole ray)
   */
  depth: 80,
  /** the same seen from above the top (only the part of the ray below it counts): the toy layer is thin (≈ 30 u), a
   *  real bank is opaque from above, so its extinction length is shorter there */
  depthAbove: 30,
  /** view depth (u) that stays clear around the camera, so the player and BAYBAY read inside the bank (the walking
   *  camera is 20–40 u away) */
  clear: 15,
  /** the fog top's soft band (u below / above the lumpy top) */
  topSoft: [10, 4],
  /** the west bank's leading edge: full cover `edge[0]` u behind the front, none `edge[1]` u past it (M3: a bank's edge, not
   *  a 180 u gradient; the noise still lumps it ±110 u) */
  edge: [70, 20],
} as const;

/** `?karl=0|1`: 0 = off, 1 = forced on (≥ 0.6 at every time; by day it comes in like golden hour), null = the table. */
export type KarlFlag = 0 | 1 | null;
export const parseKarlFlag = (v: string | null | undefined): KarlFlag => (v === '0' ? 0 : v === '1' ? 1 : null);

/** Karl's uniforms (shared by every patched material; the environment writes them, district leaves uKarl at 0). */
export const KARL = {
  uKarl: { value: 0 },
  /** written by the city's KarlState (world/sf/fog.ts) before uKarl ever leaves 0 */
  uKarlColor: { value: new THREE.Color('#f1dccd') },
  /** front (u along true east), top (y), gate amount, gate length */
  uKarlA: { value: new THREE.Vector4(150, 31, 0, 0) },
  /** noise drift (u, along true east) */
  uKarlDrift: { value: 0 },
  /** the bank over the camera's own ground (0 … 1, the noise at its mean), written once a frame by KarlState: inside
   *  the bank the fog lies over everything around, not only over the far points under it */
  uKarlCam: { value: 0 },
};

/**
 * The soft world edge (lane C2-7b, wave 3): past `x` u of view depth everything fades into the fog colour, fully at `y`,
 * just short of the camera's far plane (3,000 u in city mode), so the far plane never cuts the East Bay hills or the
 * table with a hard line. District mode leaves it far beyond anything (no-op). Every patchFog material and the light
 * field read it.
 */
export const FAR_FADE = { uObFar: { value: new THREE.Vector2(1e9, 2e9) } };
/** the city's far fade (view depth, u) */
export const CITY_FAR_FADE = { from: 2350, to: 2940 } as const;

const f1 = (v: number) => v.toFixed(4);
/** GLSL: Karl's uniforms, coverage and amount (usable in vertex and fragment shaders). */
export const KARL_GLSL = /* glsl */ `
uniform float uKarl;
uniform vec3 uKarlColor;
uniform vec4 uKarlA;
uniform float uKarlDrift;
uniform float uKarlCam;
float obKarlH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float obKarlN(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(obKarlH(i), obKarlH(i + vec2(1.0, 0.0)), u.x), mix(obKarlH(i + vec2(0.0, 1.0)), obKarlH(i + vec2(1.0, 1.0)), u.x), u.y);
}
// Karl's lumpy edge / top noise at a ground point (−0.5 … 0.5), drifting inland with the wind
float obKarlNoise(vec2 p) {
  vec2 dr = p - vec2(${f1(KARL_GEO.east.x)}, ${f1(KARL_GEO.east.z)}) * uKarlDrift;
  return obKarlN(dr * 0.006) * 0.65 + obKarlN(dr * 0.019 + 7.3) * 0.35 - 0.5;
}
// 0 … 1: the bank over a ground point (the west bank or the gate lobe), before the height
float obKarlXZ(vec2 p, float n) {
  const vec2 E = vec2(${f1(KARL_GEO.east.x)}, ${f1(KARL_GEO.east.z)});
  const vec2 O = vec2(${f1(KARL_GEO.origin.x)}, ${f1(KARL_GEO.origin.z)});
  const vec2 G = vec2(${f1(KARL_GEO.gate.x)}, ${f1(KARL_GEO.gate.z)});
  const vec2 GD = vec2(${f1(KARL_GEO.gate.dx)}, ${f1(KARL_GEO.gate.dz)});
  float a = dot(p - O, E) + n * 220.0;
  float west = 1.0 - smoothstep(uKarlA.x - ${KARL_GEO.edge[0].toFixed(1)}, uKarlA.x + ${KARL_GEO.edge[1].toFixed(1)}, a);
  vec2 g = p - G;
  float along = dot(g, GD) + n * 120.0, across = abs(dot(g, vec2(-GD.y, GD.x))) + n * 90.0;
  float lobe = uKarlA.z * (1.0 - smoothstep(95.0, 175.0, across)) * (1.0 - smoothstep(uKarlA.w - 160.0, uKarlA.w, along)) * smoothstep(-420.0, -300.0, along);
  return max(west, lobe);
}
float obKarlCover(vec3 w) {
  float n = obKarlNoise(w.xz);
  float top = uKarlA.y + n * 12.0;
  return obKarlXZ(w.xz, n) * (1.0 - smoothstep(top - ${KARL_GEO.topSoft[0].toFixed(1)}, top + ${KARL_GEO.topSoft[1].toFixed(1)}, w.y));
}
// 0 … 1: how much of Karl's colour lies over a point at world position w seen from depth (u) away. The length of the
// view ray inside the layer: from above the top, the part below it (an opaque sea seen from Twin Peaks); from inside the
// bank, the whole ray (and the fog over the camera's own ground counts too); up to a point above the top, the part
// still in the layer
float obKarl(vec3 w, float depth) {
  if (uKarl <= 0.0) return 0.0;
  float n = obKarlNoise(w.xz);
  float top = uKarlA.y + n * 12.0;
  float c = obKarlXZ(w.xz, n) * (1.0 - smoothstep(top - ${KARL_GEO.topSoft[0].toFixed(1)}, top + ${KARL_GEO.topSoft[1].toFixed(1)}, w.y));
  float cy = cameraPosition.y, portion, len = ${KARL_GEO.depth.toFixed(1)};
  if (cy > top) { portion = clamp((top - w.y) / max(cy - w.y, 0.5), 0.0, 1.0); len = ${KARL_GEO.depthAbove.toFixed(1)}; }
  else {
    c = max(c, 0.6 * uKarlCam);
    portion = w.y <= top ? 1.0 : clamp((top - cy) / max(w.y - cy, 0.5), 0.0, 1.0);
  }
  return uKarl * c * (1.0 - exp(-max(depth - ${KARL_GEO.clear.toFixed(1)}, 0.0) * portion / len));
}
`;

/** The shader pieces patchFog edits: anything with the three strings and a uniforms map (onBeforeCompile's shader or a ShaderMaterial). */
export interface FogPatchable { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }

/**
 * Karl the Fog for one material (call it from the material's onBeforeCompile, or on a ShaderMaterial before its first
 * compile): adds the Karl uniforms and replaces `#include <fog_fragment>` with Karl's term followed by the same include,
 * so three's own fog runs unchanged after it (1 − (1 − fog)(1 − karl)), then the soft world edge (FAR_FADE). `world` names a varying that already holds the
 * fragment's world position (TOY / GROUND: 'vWPos'); without it patchFog adds its own (from `mvPosition` next to
 * `#include <fog_vertex>`). No-op without a fog include, and applied at most once. THREE.ShaderChunk is never touched.
 * For lanes E2 / F: `patchFog(shader)` on their own non-TOY materials (C2 → E2, F in the contracts).
 */
export function patchFog(shader: FogPatchable, opts: { world?: string } = {}): void {
  if (!shader.fragmentShader.includes('#include <fog_fragment>') || shader.fragmentShader.includes('obKarlCover')) return;
  Object.assign(shader.uniforms, KARL, FAR_FADE);
  let w = opts.world;
  if (!w) {
    if (!shader.vertexShader.includes('#include <fog_vertex>')) return;
    w = 'vObKarlW';
    shader.vertexShader = shader.vertexShader
      .replace('#include <fog_pars_vertex>', '#include <fog_pars_vertex>\nvarying vec3 vObKarlW;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvObKarlW = cameraPosition + mvPosition.xyz * mat3(viewMatrix);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_pars_fragment>', '#include <fog_pars_fragment>\nvarying vec3 vObKarlW;');
  }
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <fog_pars_fragment>', `#include <fog_pars_fragment>\n${KARL_GLSL}\nuniform vec2 uObFar;`)
    .replace('#include <fog_fragment>', /* glsl */ `#ifdef USE_FOG
if (uKarl > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, uKarlColor, obKarl(${w}, vFogDepth));
#endif
#include <fog_fragment>
#ifdef USE_FOG
gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(uObFar.x, uObFar.y, vFogDepth));
#endif`);
}
