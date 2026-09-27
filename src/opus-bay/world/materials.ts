import * as THREE from 'three';
import { patchFog } from './fogShader';

/**
 * Shared materials + uniforms for the world. Almost everything static uses one of two
 * MeshStandardMaterials with vertex colours and a small onBeforeCompile patch:
 *
 * - GROUND: procedural surface patterns (pavers, plaza stone, planks, grass, asphalt, herringbone brick) plus a
 *   baked contact-shadow term next to buildings.
 * - TOY: buildings, landmarks, props, vehicles. Procedural windows (lit at night, per building occupancy),
 *   per-vertex glow, palm/tree wind sway, contact AO at wall bases and the occlusion dither-fade that keeps
 *   the player visible behind walls (hero landmarks fade as a whole instead of getting a hole).
 *
 * aInfo (vec4 per vertex, see builder.ts) drives both.
 *
 * Instanced (USE_INSTANCING) and batched (USE_BATCHING, BatchedMesh) draws of these materials transform the
 * world position AND the world normal (vWN) by the instance / batching matrix, so rotated instances and
 * BatchedMesh cells get correct windows, contact AO and shed doors (same programs, three's own defines).
 */

export const U = {
  uTime: { value: 0 },
  /** 0 = day … 1 = night (windows, lamps, glow) */
  uNight: { value: 0 },
  uPlayer: { value: new THREE.Vector3(0, -999, 0) },
  uCam: { value: new THREE.Vector3() },
  /** 1 = occlusion fade enabled */
  uFade: { value: 1 },
  uWind: { value: 1 },
  /** building-distance field (R8, 0..BDIST_MAX u) for ground contact shadows */
  uBDist: { value: null as THREE.Texture | null },
  uBDistBox: { value: new THREE.Vector4(0, 0, 1, 1) },
  uBDistOn: { value: 0 },
};
/** Range (world units) encoded in the building-distance texture. */
export const BDIST_MAX = 2;

/**
 * Day-0 exports (wave 2): the TOY shader pieces, for lane D2's world/modelMaterial.ts (AI GLB material) and anyone
 * who patches a MeshStandardMaterial the same way. C2 keeps these names and their behaviour stable; the strings are
 * the ones TOY / TOY_DYN / TOY_INST / hero materials compile (district programs must not change).
 */
export const COMMON_VERT_PARS = /* glsl */ `
attribute vec4 aInfo;
varying vec4 vInfo;
varying vec3 vWPos;
varying vec3 vWN;
uniform float uTime;
uniform float uWind;
`;

export const COMMON_FRAG_PARS = /* glsl */ `
varying vec4 vInfo;
varying vec3 vWPos;
varying vec3 vWN;
uniform float uTime;
uniform float uNight;
uniform vec3 uPlayer;
uniform vec3 uCam;
uniform float uFade;
uniform float uTierFade;
float obHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float obNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(obHash(i), obHash(i + vec2(1.0, 0.0)), u.x), mix(obHash(i + vec2(0.0, 1.0)), obHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
// 8x8 ordered dither (bit-interleave form): 64 levels, fine enough not to read as a screen door
float obBayer8(vec2 p) {
  ivec2 i = ivec2(mod(floor(p), 8.0));
  int x = i.x, xy = i.x ^ i.y;
  int v = ((xy & 1) << 5) | ((x & 1) << 4) | ((xy & 2) << 2) | ((x & 2) << 1) | ((xy & 4) >> 1) | ((x & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}
`;

/**
 * Tier cross-fade (lane C2-10), first thing in TOY's and GROUND's colour step: a streamed cell switching tier keeps its
 * outgoing tier for TIER_FADE s while the incoming one dithers in, the two under complementary 8×8 Bayer masks (never both
 * on one pixel, never a hole). The fade value is `uTierFade` on plain meshes (0 = solid: every material that does not
 * set it) and the batching colour's alpha on the BatchedMesh pools (1 = solid): [0, 1) = coming in, drawn where the
 * dither is under it; [-2, -1] = going out (t = value + 2), drawn where it is not. A uniform and a texel: no new program.
 */
export const TIER_FADE_FRAG = /* glsl */ `
{
  float obTier = uTierFade != 0.0 ? uTierFade : 1.0;
#ifdef USE_BATCHING_COLOR
  obTier = vColor.a;
#endif
  if (obTier < 0.999) {
    float obB = obBayer8(gl_FragCoord.xy);
    if (obTier >= 0.0 ? obB >= obTier : obB < obTier + 2.0) discard;
  }
}`;

/** Fade value of a tier coming in (t 0 → 1) and of the one going out (its complement), see TIER_FADE_FRAG. */
export const tierFadeIn = (t: number) => (t >= 1 ? 1 : Math.max(1e-3, t));
export const tierFadeOut = (t: number) => Math.min(1, Math.max(0, t)) - 2;

/** The uniform every TOY / GROUND material without its own fade reads (0 = solid). */
const TIER_SOLID = { value: 0 };

/** Vertex half of the TOY patch: aInfo / vInfo / vWPos / vWN varyings (batching + instancing aware), optional wind sway. */
export function patchCommonVertex(shader: THREE.WebGLProgramParametersWithUniforms, sway: boolean) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${COMMON_VERT_PARS}`)
    .replace('#include <beginnormal_vertex>', /* glsl */ `#include <beginnormal_vertex>
{
  // world normal for the procedural patterns: batching, then instance, then model matrix (as three's
  // defaultnormal_vertex; the column-length division keeps it right under non-uniform instance scale)
  vec3 obN = objectNormal;
#ifdef USE_BATCHING
  mat3 obBm = mat3(batchingMatrix);
  obN = obBm * (obN / vec3(dot(obBm[0], obBm[0]), dot(obBm[1], obBm[1]), dot(obBm[2], obBm[2])));
#endif
#ifdef USE_INSTANCING
  mat3 obIm = mat3(instanceMatrix);
  obN = obIm * (obN / vec3(dot(obIm[0], obIm[0]), dot(obIm[1], obIm[1]), dot(obIm[2], obIm[2])));
#endif
  vWN = normalize(mat3(modelMatrix) * obN);
}`)
    .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
vec4 obWp = vec4(transformed, 1.0);
#ifdef USE_BATCHING
obWp = batchingMatrix * obWp;
#endif
#ifdef USE_INSTANCING
obWp = instanceMatrix * obWp;
#endif
obWp = modelMatrix * obWp;
${sway ? /* glsl */ `if (aInfo.z > 0.0) {
  float sw = aInfo.z * aInfo.z * uWind;
  vec2 sway = vec2(sin(uTime * 1.3 + obWp.x * 0.37 + obWp.z * 0.21), cos(uTime * 1.07 + obWp.z * 0.29 - obWp.x * 0.13)) * 0.16 * sw;
  sway += vec2(sin(uTime * 3.1 + obWp.x * 1.7), cos(uTime * 2.7 + obWp.z * 1.9)) * 0.025 * sw;
  transformed.xz += sway;
  obWp.xz += sway;
}` : ''}
vWPos = obWp.xyz;
vInfo = aInfo;`);
}

// ---------------------------------------------------------------------------
// Ground
// ---------------------------------------------------------------------------

/**
 * Pattern ids (aInfo.x). Pattern space: pavers + brick use the promenade ribbon coordinates (aInfo.y = arc
 * length along the waterfront, aInfo.z = offset), so the joints follow the curve and never swirl; the other
 * patterns rotate world xz by ONE constant angle per polygon (aInfo.y).
 *
 * aInfo.w is the source flag: 0 = hero district ground (samples the baked building-distance field uBDist for
 * its contact shadows); GROUND_CITY (1) = streamed city ground, which skips every hero-only lookup (the cell
 * builder bakes its contact AO into the vertex colour). Same program either way: a per-vertex branch.
 */
export const GROUND_CITY = 1;
export const GROUND_PATTERN = { none: 0, pavers: 1, stone: 2, planks: 3, grass: 4, asphalt: 5, cobble: 6, earth: 7, brick: 8 } as const;

function groundCompile(tier: { value: number }) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => patchGroundShader(shader, tier);
}

function makeGround(name: string, tier: { value: number } = TIER_SOLID) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
  m.name = name;
  m.onBeforeCompile = groundCompile(tier);
  m.customProgramCacheKey = () => 'ob-ground';
  return m;
}

function patchGroundShader(shader: THREE.WebGLProgramParametersWithUniforms, tier: { value: number }) {
  Object.assign(shader.uniforms, U);
  shader.uniforms.uTierFade = tier;
  patchCommonVertex(shader, false);
  patchFog(shader, { world: 'vWPos' });
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${COMMON_FRAG_PARS}
uniform sampler2D uBDist;
uniform vec4 uBDistBox;
uniform float uBDistOn;
vec2 obRot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
// grout line 0..1 for tile coordinates q (unit tiles) with grout width gw (in tile units per axis)
float obGrout(vec2 q, vec2 gw) {
  vec2 f = fract(q);
  vec2 w = fwidth(q) + 1e-4;
  vec2 e = min(f, 1.0 - f);
  float lx = 1.0 - smoothstep(gw.x * 0.5, gw.x * 0.5 + w.x, e.x);
  float ly = 1.0 - smoothstep(gw.y * 0.5, gw.y * 0.5 + w.y, e.y);
  return max(lx, ly);
}
// 0 when tiles are well resolved, 1 when they shrink below ~2 px (fades the pattern to its average: no moire)
float obTiny(vec2 q) { vec2 w = fwidth(q); return smoothstep(0.22, 0.55, max(w.x, w.y)); }
// per-tile colour: value 0.9..1.08, ±4 % warm/cool
vec3 obTileTint(vec2 id) {
  float v = mix(0.9, 1.08, obHash(id));
  float h = (obHash(id + 17.31) - 0.5) * 0.08;
  return v * vec3(1.0 + h, 1.0, 1.0 - h);
}
// 90° herringbone of 2x1 bricks (lattice (1,1),(2,-2)): returns (distance to the brick edge, brick hash)
vec2 obHerring(vec2 p) {
  float ci = floor((p.x + p.y) * 0.5), cj = floor((p.x - p.y) * 0.25);
  for (int di = -1; di <= 1; di++) for (int dj = -1; dj <= 1; dj++) {
    float i = ci + float(di), j = cj + float(dj);
    vec2 o = vec2(i + 2.0 * j, i - 2.0 * j);
    vec2 q = p - o;
    if (q.x >= 0.0 && q.x < 2.0 && q.y >= 0.0 && q.y < 1.0) return vec2(min(min(q.x, 2.0 - q.x), min(q.y, 1.0 - q.y)), obHash(vec2(i, j)));
    if (q.x >= 2.0 && q.x < 3.0 && q.y >= -1.0 && q.y < 1.0) return vec2(min(min(q.x - 2.0, 3.0 - q.x), min(q.y + 1.0, 1.0 - q.y)), obHash(vec2(i + 0.5, j)));
  }
  return vec2(0.5, 0.5);
}`)
    .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
${TIER_FADE_FRAG}
{
  float pat = floor(vInfo.x + 0.5);
  vec2 p = vWPos.xz;
  float macro = obNoise(p * 0.07) * 0.6 + obNoise(p * 0.23) * 0.4;
  float grime = 1.0 - 0.06 * smoothstep(0.35, 0.8, obNoise(p * 0.31 + 3.7));
  vec3 k = vec3(1.0);
  if (pat == 1.0) { // promenade pavers 0.6 x 0.3, running bond, in ribbon space
    vec2 q = vInfo.yz / vec2(0.6, 0.3);
    q.x += mod(floor(q.y), 2.0) * 0.5;
    float tiny = obTiny(q);
    float g = obGrout(q, vec2(0.04 / 0.6, 0.04 / 0.3));
    vec3 tile = mix(obTileTint(floor(q)), vec3(0.99), tiny);
    k = tile * (1.0 - mix(0.16, 0.05, tiny) * g) * grime;
  } else if (pat == 8.0) { // herringbone brick band (0.22 x 0.11 bricks) along the seawall
    vec2 hb = obHerring(vInfo.yz / 0.11);
    float w = fwidth(vInfo.y / 0.11) + 1e-4;
    float g = 1.0 - smoothstep(0.05, 0.05 + w, hb.x);
    float tiny = smoothstep(0.25, 0.6, w);
    float v = mix(mix(0.88, 1.1, hb.y), 1.0, tiny);
    k = vec3(v * (1.0 + (obHash(vec2(hb.y, 3.0)) - 0.5) * 0.06), v, v) * (1.0 - mix(0.22, 0.07, tiny) * g) * grime;
  } else if (pat == 2.0) { // plaza stone slabs 0.6 u (a third of the player), one angle per polygon
    vec2 q = obRot(p, vInfo.y) / 0.6;
    q.x += mod(floor(q.y), 2.0) * 0.33;
    float tiny = obTiny(q);
    float g = obGrout(q, vec2(0.05 / 0.6));
    vec3 tile = mix(obTileTint(floor(q) + 41.0), vec3(0.99), tiny);
    k = tile * (1.0 - mix(0.13, 0.04, tiny) * g) * grime;
  } else if (pat == 3.0) { // wood planks across the deck
    vec2 q = obRot(p, vInfo.y) / vec2(0.34, 2.6);
    q.y += obHash(vec2(floor(q.x), 3.0)) * 3.0;
    float g = obGrout(q, vec2(0.07));
    float grain = obNoise(vec2(q.x * 8.0, q.y * 0.8));
    k = vec3((1.0 - 0.3 * g) * (0.88 + 0.2 * obHash(floor(q))) * (0.95 + 0.08 * grain));
  } else if (pat == 4.0) { // grass
    float n = obNoise(p * 0.9) * 0.5 + obNoise(p * 3.1) * 0.3 + obHash(floor(p * 9.0)) * 0.2;
    k = vec3(0.9 + 0.2 * n);
  } else if (pat == 5.0) { // asphalt
    k = vec3(0.96 + 0.06 * obNoise(p * 2.3) + 0.03 * obHash(floor(p * 14.0)));
  } else if (pat == 6.0) { // cobbled median
    vec2 q = obRot(p, vInfo.y) / vec2(0.5, 0.5);
    q.x += mod(floor(q.y), 2.0) * 0.5;
    float g = obGrout(q, vec2(0.1));
    k = vec3((1.0 - 0.16 * g) * (0.93 + 0.12 * obHash(floor(q))));
  } else if (pat == 7.0) { // hillside earth + gardens
    float n = obNoise(p * 0.5) * 0.6 + obNoise(p * 2.0) * 0.4;
    k = vec3(0.92 + 0.16 * n);
  }
  diffuseColor.rgb *= k * (0.965 + 0.07 * macro);
  // night street glow (lane C2-9): city main streets carry their lamp level in aInfo.w (GROUND_CITY + 0.5 … 1), the
  // arc length in aInfo.y and the side (−1 … 1 across the asphalt) in aInfo.z: a warm pool every 9 u on alternate
  // curbs, their mean once the pools shrink below a few pixels (the street reads as a lit ribbon from the hills),
  // fading out within ≈ 45–110 u of the camera, where the real lamps and their light pools take over
  if (pat == 5.0 && vInfo.w > 1.05 && uNight > 0.01) {
    float sq = vInfo.y / 9.0 + (vInfo.z > 0.0 ? 0.0 : 0.5);
    float ds = (fract(sq) - 0.5) * 9.0;
    float unres = smoothstep(0.25, 0.8, fwidth(sq));
    float glow = mix(exp(-ds * ds / 5.0), 0.44, unres) * (0.3 + 0.7 * smoothstep(0.0, 1.0, abs(vInfo.z)));
    float away = smoothstep(45.0, 110.0, distance(vWPos, uCam));
    totalEmissiveRadiance += vec3(1.0, 0.62, 0.3) * glow * (vInfo.w - 1.0) * uNight * away * 0.9;
  }
  // contact shadow next to buildings, stalls and kiosks (baked distance field; hero ground only, see GROUND_CITY)
  if (uBDistOn > 0.5 && vInfo.w < 0.5) {
    vec2 buv = (p - uBDistBox.xy) / uBDistBox.zw;
    if (buv.x > 0.0 && buv.y > 0.0 && buv.x < 1.0 && buv.y < 1.0) {
      float bd = texture2D(uBDist, buv).r * ${BDIST_MAX.toFixed(1)};
      diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 1.6, bd));
    }
  }
}`);
}

export const GROUND = makeGround('ob-ground');
/**
 * GROUND for BatchedMesh (the city ground pool): the same patch and program key, hence the same programs; its own
 * instance so the plain-mesh GROUND never flips programs (see TOY_BATCH below).
 */
export const GROUND_BATCH = makeGround('ob-ground-batch');

// ---------------------------------------------------------------------------
// Toy (buildings, props, landmarks, vehicles)
// ---------------------------------------------------------------------------

/**
 * aInfo for TOY: x = window style (1–6 windows, 7 lit opening, 8 pier shed), y = base height (window floors,
 * contact AO, lit-opening gradient), z = sway weight (> 0) or −building seed (< 0, window occupancy),
 * w = glow ((0,1] at night, (1,2] always); w ≤ −1 marks "never dither-fade" with glow −w − 1.
 */
export const TOY_FRAG = /* glsl */ `#include <color_fragment>
${TIER_FADE_FRAG}
float obGlowW = vInfo.w < -0.5 ? -vInfo.w - 1.0 : vInfo.w;
{
  bool obKeep = vInfo.w < -0.5;
#ifdef OB_HERO
  // hero landmarks: the whole mesh thins to a dither instead of a hole (silhouette stays readable)
  if (uHeroFade > 0.001 && uHeroFade > obBayer8(gl_FragCoord.xy)) discard;
#else
  // occlusion dither-fade: fragments between the camera and the player melt away
  if (uFade > 0.5 && !obKeep) {
    vec3 d = uPlayer - uCam;
    float L = length(d);
    if (L > 0.5) {
      vec3 dir = d / L;
      float t = dot(vWPos - uCam, dir);
      if (t > 0.5 && t < L - 1.2 && vWPos.y > uPlayer.y + 0.35) {
        float r = length(vWPos - (uCam + dir * t));
        float R = mix(0.7, 2.2, clamp(t / L, 0.0, 1.0));
        float fade = min(1.0 - smoothstep(R * 0.7, R, r), 0.85);
        if (fade > obBayer8(gl_FragCoord.xy)) discard;
      }
    }
  }
#endif
  // pier sheds: rows of cargo doors along the deck + a clerestory window band (style 8)
  if (floor(vInfo.x + 0.5) == 8.0 && abs(vWN.y) < 0.4) {
    vec2 tng8 = normalize(vec2(-vWN.z, vWN.x) + 1e-5);
    float u8 = dot(vWPos.xz, tng8);
    float v8 = vWPos.y - vInfo.y;
    float f8 = fract(u8 / 4.2);
    float aa8 = fwidth(u8 / 4.2) + 1e-4;
    float door = smoothstep(0.16 - aa8, 0.16 + aa8, f8) * (1.0 - smoothstep(0.84 - aa8, 0.84 + aa8, f8)) * step(0.05, v8) * step(v8, 4.3);
    float ribs = step(0.45, fract(v8 * 3.2));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.40, 0.35) * (0.86 + 0.14 * ribs), door);
    float w8 = fract(u8 / 1.4);
    float win8 = step(5.4, v8) * step(v8, 6.3) * step(0.14, w8) * step(w8, 0.86);
    float h8 = obHash(floor(vec2(u8 / 1.4, 3.0)) + floor(vWPos.xz * 0.02));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.27, 0.30), win8);
    totalEmissiveRadiance += vec3(1.0, 0.68, 0.38) * win8 * step(0.62, h8) * uNight * (0.6 + 0.5 * fract(h8 * 7.0));
  }
  // procedural windows on vertical faces
  if (vInfo.x > 0.5 && vInfo.x < 6.5 && abs(vWN.y) < 0.4) {
    vec2 tng = normalize(vec2(-vWN.z, vWN.x) + 1e-5);
    float u = dot(vWPos.xz, tng);
    float v = vWPos.y - vInfo.y;
    float style = floor(vInfo.x + 0.5);
    vec2 cell = vec2(1.5, 2.5); vec4 rect = vec4(0.3, 0.7, 0.3, 0.78); float minV = 0.7;
    vec3 glass = vec3(0.10, 0.14, 0.18);
    if (style == 2.0) { cell = vec2(1.25, 2.2); rect = vec4(0.05, 0.95, 0.3, 0.84); minV = 0.4; glass = vec3(0.16, 0.24, 0.30); }
    else if (style == 3.0) { cell = vec2(2.3, 2.7); rect = vec4(0.1, 0.9, 0.12, 0.72); minV = 0.2; glass = vec3(0.12, 0.15, 0.17); }
    else if (style == 4.0) { cell = vec2(2.1, 3.1); rect = vec4(0.25, 0.75, 0.22, 0.86); minV = 0.45; }
    else if (style == 5.0) { cell = vec2(1.15, 2.35); rect = vec4(0.27, 0.73, 0.28, 0.82); minV = 0.55; }
    else if (style == 6.0) { cell = vec2(1.9, 2.6); rect = vec4(0.12, 0.88, 0.25, 0.85); minV = 0.3; glass = vec3(0.30, 0.40, 0.44); }
    vec2 g = vec2(u, v) / cell;
    vec2 f = fract(g);
    vec2 id = floor(g);
    vec2 fwg = fwidth(g);
    vec2 w = fwg * 0.8 + 1e-4;
    float inX = smoothstep(rect.x - w.x, rect.x + w.x, f.x) * (1.0 - smoothstep(rect.y - w.x, rect.y + w.x, f.x));
    float inY = smoothstep(rect.z - w.y, rect.z + w.y, f.y) * (1.0 - smoothstep(rect.w - w.y, rect.w + w.y, f.y));
    // cells too small to resolve (≲ 3 px, or walls seen edge-on) fade to their mean coverage instead of
    // shimmering (idea: GTA_SZ city-facade-diversity.ts:341-346); exactly the old pattern while resolved
    float unres = smoothstep(0.35, 1.2, max(fwg.x, fwg.y));
    float keepV = step(minV, v);
    float cover = (rect.y - rect.x) * (rect.w - rect.z);
    float mask = mix(inX * inY, cover, unres) * keepV;
    // per-building seed (baked into aInfo.z as a negative number), else a coarse world-cell hash
    float seed = vInfo.z < 0.0 ? -vInfo.z : obHash(floor(vWPos.xz * 0.08));
    float h = obHash(id + seed * 97.0);
    vec3 day = glass * (0.8 + 0.5 * h) + vec3(0.05, 0.07, 0.08) * (1.0 - f.y);
    day = mix(day, glass * 1.05 + vec3(0.05, 0.07, 0.08) * (1.0 - 0.5 * (rect.z + rect.w)), unres);
    diffuseColor.rgb = mix(diffuseColor.rgb, day, mask * (1.0 - uNight * 0.6));
    // night: 25–60 % occupancy per building, whole floors dark, three colour temperatures, some half-curtained
    float occ = mix(0.4, 0.75, fract(seed * 7.13));
    float floorOn = step(0.2, obHash(vec2(id.y * 1.37, seed * 53.0)));
    float lit = step(occ, h) * floorOn * mask;
    float hc = obHash(id * 1.7 + seed * 13.0);
    vec3 temp = hc < 0.7 ? vec3(1.0, 0.62, 0.3) : hc < 0.9 ? vec3(1.0, 0.85, 0.65) : vec3(0.55, 0.7, 1.0);
    float curtain = step(obHash(id * 3.1 + seed * 7.0), 0.15) * step(0.6, (f.y - rect.z) / max(rect.w - rect.z, 1e-3));
    lit *= 1.0 - curtain;
    // unresolved: the expected glow of a cell (vacancy × lit floors 0.8 × curtains 0.94 × mean intensity 0.85,
    // mean colour temperature), so distant façades read as an even warm glow, not sparkle
    vec3 litMean = vec3(0.955, 0.674, 0.44) * (cover * keepV * (1.0 - occ) * 0.8 * 0.94 * 0.85);
    totalEmissiveRadiance += mix(temp * lit * (0.5 + 0.7 * obHash(id * 2.3 + seed)), litMean, unres) * uNight;
  }
  // warm lit openings at night (arches, doors, cabin windows): style 7, brighter toward the bottom
  if (floor(vInfo.x + 0.5) == 7.0) {
    float gy = clamp((vWPos.y - vInfo.y) / 3.0, 0.0, 1.0);
    totalEmissiveRadiance += vec3(1.0, 0.64, 0.3) * uNight * 1.25 * (1.15 - 0.6 * gy);
  }
  // contact AO: vertical faces darken toward their base (aInfo.y)
  if (abs(vWN.y) < 0.5) diffuseColor.rgb *= mix(0.74, 1.0, smoothstep(0.0, 1.4, vWPos.y - vInfo.y));
}
// self-lit bits: glow in (0,1] glows at night (lamp heads, floodlit towers), (1,2] glows always (glass, water)
if (obGlowW > 1.0) totalEmissiveRadiance += diffuseColor.rgb * (obGlowW - 1.0) * 1.6;
else if (obGlowW > 0.0) totalEmissiveRadiance += diffuseColor.rgb * uNight * 2.4 * obGlowW;`;

interface ToyOpts { sway: boolean; name: string; hero?: { value: number }; /** program cache key (default: the name) */ key?: string; /** own tier-fade uniform (C2-10) */ tier?: { value: number } }

/**
 * The whole TOY patch for an onBeforeCompile: shared uniforms (U), vertex half, fragment pars + TOY_FRAG. With `hero`
 * the material must also define OB_HERO (whole-mesh dither fade driven by hero.value). Day-0 export for other lanes.
 */
export function patchToyShader(shader: THREE.WebGLProgramParametersWithUniforms, { sway, hero, tier }: { sway: boolean; hero?: { value: number }; tier?: { value: number } }) {
  Object.assign(shader.uniforms, U);
  if (hero) shader.uniforms.uHeroFade = hero;
  // C2-10: the tier fade (0 = solid unless the material brings its own uniform)
  shader.uniforms.uTierFade = tier ?? TIER_SOLID;
  patchCommonVertex(shader, sway);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${COMMON_FRAG_PARS}${hero ? '\nuniform float uHeroFade;' : ''}`)
    .replace('#include <color_fragment>', TOY_FRAG);
  // Karl the Fog (lane C2-8): TOY-wide, so the hero and D2's model material (which call this) get it too
  patchFog(shader, { world: 'vWPos' });
}

function makeToy({ sway, name, hero, key: k, tier }: ToyOpts) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  m.name = name;
  if (hero) m.defines = { OB_HERO: '' };
  m.onBeforeCompile = tier ? shader => { patchToyShader(shader, { sway, hero, tier }); } : shader => { patchToyShader(shader, { sway, hero }); };
  const key = hero ? 'ob-toy-hero' : k ?? name;
  m.customProgramCacheKey = () => key;
  return m;
}

/** Static toy material with wind sway support (aInfo.z). */
export const TOY = makeToy({ sway: true, name: 'ob-toy' });
/** Toy material for moving single meshes (vehicles, carousel, clock hands; no sway). */
export const TOY_DYN = makeToy({ sway: false, name: 'ob-toy-dyn' });
/**
 * Toy material for InstancedMeshes only. three.js switches shader programs whenever one material is drawn
 * by both instanced and plain meshes, so the two must never share a material.
 */
export const TOY_INST = makeToy({ sway: false, name: 'ob-toy-inst' });

/**
 * One material instance per object kind (wave 3, P2). three.js keeps one "current program" per material instance and
 * re-looks it up (getParameters + the cache key, ≈ 9 % of a dense 4× frame) every time the same instance is drawn by a
 * different kind of object: Mesh ↔ BatchedMesh, InstancedMesh with ↔ without instanceColor. These twins run the same
 * onBeforeCompile under the same program cache key as their originals, so they link the SAME programs (no new program,
 * nothing to warm up beyond the variants warmup.ts already compiles); only the per-instance lookup cache differs.
 *
 *   TOY / GROUND        plain Mesh (hero chunks, city L0 cells, landmark sites, tile pools)
 *   TOY_BATCH / GROUND_BATCH   BatchedMesh (the L1 / L2 pools)
 *   TOY_INST            InstancedMesh without instanceColor
 *   TOY_INST_TINT       InstancedMesh with instanceColor (city trees and lamps, Karl's cloud bank, tinted life)
 */
export const TOY_BATCH = makeToy({ sway: true, name: 'ob-toy-batch', key: 'ob-toy' });

/**
 * A pair of plain-mesh TOY / GROUND twins with their own tier-fade uniform, for one streamed L0 cell while it fades
 * (lane C2-10; world/sf/stream.ts keeps a few). Same programs as TOY / GROUND.
 */
export interface TierFadePair { toy: THREE.MeshStandardMaterial; ground: THREE.MeshStandardMaterial; fade: { value: number } }
export function makeTierFadePair(): TierFadePair {
  const fade = { value: 0 };
  return { toy: makeToy({ sway: true, name: 'ob-toy-fade', key: 'ob-toy', tier: fade }), ground: makeGround('ob-ground-fade', fade), fade };
}
export const TOY_INST_TINT = makeToy({ sway: false, name: 'ob-toy-inst-tint', key: 'ob-toy-inst' });

/**
 * Hero landmark material: same program for every hero (shared cache key), one uniform object per mesh, so
 * each hero fades as a whole (`fade.value` 0 … ~0.35) when it stands between the camera and the player.
 */
export function makeHeroMaterial(name: string) {
  const fade = { value: 0 };
  const material = makeToy({ sway: true, name: `ob-hero:${name}`, hero: fade });
  return { material, fade };
}

// ---------------------------------------------------------------------------
// One material instance per object kind: the sweep (wave 3, P2)
// ---------------------------------------------------------------------------

/**
 * The shared materials' twins (TOY / TOY_BATCH, GROUND / GROUND_BATCH, TOY_INST / TOY_INST_TINT) only help if every
 * object uses the one for its kind. `kindSweep` (WorldScene, once a second) puts objects that picked the wrong twin of
 * these C2 materials on the right one (a lane's tinted InstancedMesh on TOY_INST, a BatchedMesh on TOY …: same program,
 * so nothing recompiles) and gives shadow casters their kind's depth material (below). Lanes still pick the right twin
 * themselves; the sweep keeps a late setColorAt or a new layer from bringing the per-frame lookups back.
 *
 * The sun's shadow pass draws every caster with ONE internal MeshDepthMaterial, so each switch between a plain, an
 * instanced and a skinned caster re-looks-up its program (3 lookups a frame at every perf spot: hero meshes, the
 * cable cars / turntable discs, the player). Instanced and skinned casters get their own depth material instead (same
 * programs as three's: nothing new to compile), assigned by `shadowDepthByKind` to casters that have no
 * customDepthMaterial and whose material needs no per-material depth variant (alpha-tested maps, displacement, clipping:
 * three clones its depth material for those itself).
 */
const DEPTH_BY_KIND = { inst: new THREE.MeshDepthMaterial(), instColor: new THREE.MeshDepthMaterial(), skinned: new THREE.MeshDepthMaterial() };
for (const [k, m] of Object.entries(DEPTH_BY_KIND)) m.name = `ob-depth-${k}`;

function plainDepth(m: THREE.Material): boolean {
  const s = m as THREE.MeshStandardMaterial;
  return !(s.alphaMap && s.alphaTest > 0) && !(s.map && s.alphaTest > 0) && !(s.displacementMap && s.displacementScale !== 0) && s.alphaToCoverage !== true && !(s.clippingPlanes?.length);
}

/** The twin of a shared C2 material for an object's kind (null: not one of the twinned materials, or already right). */
function twinFor(o: THREE.Object3D, m: THREE.Material): THREE.Material | null {
  const batched = !!(o as THREE.BatchedMesh).isBatchedMesh, inst = o as THREE.InstancedMesh;
  if (m === TOY && batched) return TOY_BATCH;
  if (m === TOY_BATCH && !batched) return TOY;
  if (m === GROUND && batched) return GROUND_BATCH;
  if (m === GROUND_BATCH && !batched) return GROUND;
  if (inst.isInstancedMesh && m === TOY_INST && inst.instanceColor) return TOY_INST_TINT;
  if (inst.isInstancedMesh && m === TOY_INST_TINT && !inst.instanceColor) return TOY_INST;
  return null;
}

/**
 * Put every object under `root` on its kind's twin of the shared materials and give instanced / skinned shadow casters
 * their kind's depth material (a scene walk: call it now and then, not every frame). Returns how many objects changed.
 */
export function kindSweep(root: THREE.Object3D): number {
  let n = 0;
  root.traverse(o => {
    const r = o as THREE.Mesh;
    if (r.isMesh && r.material && !Array.isArray(r.material)) {
      const twin = twinFor(o, r.material);
      if (twin) { r.material = twin; n++; }
    }
    if (!o.castShadow || o.customDepthMaterial) return;
    const mesh = o as THREE.Mesh;
    const inst = o as THREE.InstancedMesh;
    const kind = inst.isInstancedMesh ? (inst.instanceColor ? 'instColor' : 'inst') : (o as THREE.SkinnedMesh).isSkinnedMesh ? 'skinned' : null;
    if (!kind || !mesh.material || mesh.geometry?.morphAttributes.position || inst.morphTexture) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.every(plainDepth)) return;
    o.customDepthMaterial = DEPTH_BY_KIND[kind];
    n++;
  });
  return n;
}

// ---------------------------------------------------------------------------
// Unlit / helpers
// ---------------------------------------------------------------------------

/** Soft radial blob used for contact shadows (multiply-ish via alpha). */
export function radialTexture(size = 64, inner = 0.15): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

let blobTex: THREE.CanvasTexture | null = null;
export function blobTexture() { return (blobTex ??= radialTexture(64, 0.1)); }

export const BLOB = new THREE.MeshBasicMaterial({ color: '#3a2c1c', transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
BLOB.name = 'ob-blob';

/**
 * Additive camera-facing halos for night lights (instanced quads). aHalo = (size, seed, day visibility);
 * seed ≥ 2 → slow blink (aircraft warning lights), fract(seed) is the phase.
 */
export const HALO = new THREE.ShaderMaterial({
  name: 'ob-halo',
  uniforms: { uNight: U.uNight, uTime: U.uTime },
  vertexShader: /* glsl */ `
    attribute vec3 aHalo;
    varying vec2 vUv;
    varying vec3 vCol;
    varying float vA;
    uniform float uNight;
    uniform float uTime;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float seed = fract(aHalo.y);
      float fl = 0.92 + 0.08 * sin(uTime * (2.0 + seed * 3.0) + seed * 40.0);
      if (aHalo.y >= 2.0) fl = 0.25 + 0.75 * smoothstep(0.35, 0.5, abs(fract(uTime * 0.45 + seed) - 0.5));
      mv.xy += position.xy * aHalo.x * fl;
      vCol = instanceColor;
      vA = max(uNight, aHalo.z) * (aHalo.y >= 2.0 ? fl : 1.0);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vCol;
    varying float vA;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float a = pow(max(0.0, 1.0 - d), 2.2) * vA;
      if (a < 0.003) discard;
      gl_FragColor = vec4(vCol * a, a);
      #include <colorspace_fragment>
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

/** Warm light pools on the ground under the street lamps (instanced flat quads, additive, night only). */
export const POOL = new THREE.ShaderMaterial({
  name: 'ob-pool',
  uniforms: { uNight: U.uNight },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform float uNight;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float a = pow(max(0.0, 1.0 - d), 1.6) * 0.55 * uNight;
      if (a < 0.003) discard;
      gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a, a);
      #include <colorspace_fragment>
    }`,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
});

export function disposeMaterials() {
  for (const m of [GROUND, GROUND_BATCH, TOY, TOY_DYN, TOY_INST, TOY_BATCH, TOY_INST_TINT, BLOB, HALO, POOL, ...Object.values(DEPTH_BY_KIND)]) m.dispose();
  blobTex?.dispose();
  blobTex = null;
}
