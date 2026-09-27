import * as THREE from 'three';
import { game } from '../core/store';
import { makeHeroMaterial, patchToyShader } from './materials';
import { TypedBatch } from './typedBatch';
import { registerWarmup } from './warmup';

/**
 * Material for the AI meshes (lane D2, checkpoint D2-03): the TOY look on a textured GLB. Built on lane C2's exported
 * `patchToyShader` (so every TOY-wide feature — contact AO, the occlusion dither-fade, the hero fade, Karl the Fog when
 * C2 adds it there — reaches the models without patching twice), plus:
 *
 *   map            the GLB base colour multiplies the diffuse (three's own map path, sRGB)
 *   mask.g         wall tint: luminance × tint where G marks the walls (houses: recolour to the building's wall colour)
 *   mask.r         night glass: warm emission at night, whole windows on / off by the instance's occupancy
 *                  (world-space cells like the TOY windows); `glass` = one steady colour instead (a lit greenhouse)
 *   aInfo          synthesized in the vertex shader: no procedural windows, base = the model's origin height (contact
 *                  AO), seed from the origin (occupancy) unless given, w = the TOY glow / keep code (floodlit stone at
 *                  night: (0, 1]; always lit (1, 2]; ≤ −1 never occlusion-fade)
 *   fade           per instance, 0…1: an ordered-dither fade in / out (kit swap); 1 = solid
 *
 * The mask is sampled with the map's UVs, so load it with flipY = false (world/models.ts loadMask). A model without a
 * mask gets a black 1×1 one (no tint, no glass): one program for every model.
 *
 * Program variants (MODEL_VARIANTS, registered with the world's shader warm-up at import):
 *   'ob-model-hero'  plain Mesh, OB_HERO (the whole model thins as one when it hides the player: no dither holes
 *                    under a gate or a rotunda); the fade uniform is the landmark's, shared with its procedural part
 *   'ob-model-inst'  InstancedMesh (houses): per-instance aObTint (rgb, strength) and aObInst (occupancy, fade, seed,
 *                    glow) attributes; the TOY per-fragment occlusion dither
 * plus the hero TOY program ('ob-toy-hero', world/materials.ts makeHeroMaterial) that sites.ts uses for the procedural
 * part of a landmark with a hero fade.
 */

export const MODEL_VARIANTS = ['ob-model-hero', 'ob-model-inst'] as const;
export type ModelVariant = (typeof MODEL_VARIANTS)[number];

/** Instance attribute names (InstancedMesh geometry): tint rgb + strength; occupancy, fade, seed, glow (TOY aInfo.w). */
export const MODEL_TINT_ATTR = 'aObTint';
export const MODEL_INST_ATTR = 'aObInst';

const VERT_PARS = /* glsl */ `
#ifdef USE_INSTANCING
attribute vec4 aObTint;
attribute vec4 aObInst;
#else
uniform vec4 uObTint;
uniform vec4 uObInst;
#endif
varying vec4 vObTint;
varying vec4 vObInst;
`;

const VERT_MAIN = /* glsl */ `
{
#ifdef USE_INSTANCING
  vObTint = aObTint;
  vObInst = aObInst;
  vec3 obO = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
  vObTint = uObTint;
  vObInst = uObInst;
  vec3 obO = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
  // synthesized TOY aInfo: x 0 = no procedural windows, y = the model's ground (contact AO), z = -seed, w = TOY glow
  float obSeed = vObInst.z > 0.0 ? vObInst.z : 0.05 + 0.9 * fract(sin(dot(obO.xz, vec2(12.9898, 78.233))) * 43758.5453);
  vInfo = vec4(0.0, obO.y, -obSeed, vObInst.w);
}`;

const FRAG_PARS = /* glsl */ `
uniform sampler2D uObMask;
uniform float uObKeyLum;
uniform vec4 uObGlass;
varying vec4 vObTint;
varying vec4 vObInst;
`;

const FRAG_MAIN = /* glsl */ `
{
  // fade in / out (instances): ordered dither, 1 = solid
  if (vObInst.y < obBayer8(gl_FragCoord.xy)) discard;
#ifdef USE_MAP
  vec4 obMask = texture2D(uObMask, vMapUv);
#else
  vec4 obMask = vec4(0.0);
#endif
  // walls (mask.g): the graded key colour's shading carried onto the tint (luminance x tint)
  if (vObTint.a > 0.0 && obMask.g > 0.02) {
    float obL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = mix(diffuseColor.rgb, vObTint.rgb * (obL / max(uObKeyLum, 0.05)), obMask.g * vObTint.a);
  }
  // night glass (mask.r)
  if (obMask.r > 0.02) {
    // glass is on walls: roof tiles the mask caught (jade / slate stencil hits) stay dark
    float obGl = obMask.r * uNight * (1.0 - smoothstep(0.45, 0.7, abs(vWN.y)));
    diffuseColor.rgb *= 1.0 - 0.35 * obGl;
    if (uObGlass.a > 0.0) {
      totalEmissiveRadiance += uObGlass.rgb * uObGlass.a * obGl;
    } else {
      // whole windows on / off: world cells ~1.3 u wide x 1.6 u tall (a storey), per-model seed and occupancy
      vec2 obTg = normalize(vec2(-vWN.z, vWN.x) + 1e-5);
      vec2 obCell = floor(vec2(dot(vWPos.xz, obTg) / 1.3, (vWPos.y - vInfo.y) / 1.6));
      float obS = -vInfo.z;
      float obOn = step(obHash(obCell + obS * 97.0), vObInst.x);
      float obHc = obHash(obCell * 1.7 + obS * 13.0);
      vec3 obTemp = obHc < 0.7 ? vec3(1.0, 0.62, 0.3) : obHc < 0.9 ? vec3(1.0, 0.85, 0.65) : vec3(0.55, 0.7, 1.0);
      totalEmissiveRadiance += obTemp * obGl * obOn * (0.6 + 0.55 * obHash(obCell * 2.3 + obS));
    }
  }
}`;

/** Black 1×1 mask for models without one (same program: no tint, no glass). */
let blackMask: THREE.DataTexture | null = null;
function noMask() {
  if (!blackMask) {
    blackMask = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    blackMask.needsUpdate = true;
  }
  return blackMask;
}

/** Relative luminance of an sRGB hex in linear space (what the shader measures on the decoded texel). */
export function keyLuminance(hex: string | null | undefined): number {
  if (!hex) return 0.62;
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

export interface ModelMaterialOptions {
  map: THREE.Texture | null;
  mask?: THREE.Texture | null;
  /** 'hero' = plain Mesh with the landmark's whole-mesh fade; 'inst' = InstancedMesh with per-instance attributes */
  variant: ModelVariant;
  /** hero: the fade uniform (share the landmark's, see world/materials.ts makeHeroMaterial); default a private one */
  fade?: { value: number };
  /** graded wall key colour (SfKitAsset.tintKey): tint keeps the texel's shading relative to it */
  tintKey?: string | null;
  /** hero: wall tint rgb + strength (0 = none) */
  tint?: readonly [number, number, number, number];
  /** hero: occupancy (0…1 of the windows lit at night), fade, seed (0 = from the position), glow (TOY aInfo.w code) */
  inst?: readonly [number, number, number, number];
  /** night glass as one steady colour (sRGB hex) and strength, instead of windows (Conservatory) */
  glass?: { color: string; strength: number };
  name?: string;
}

export interface ModelMaterial extends THREE.MeshStandardMaterial {
  userData: {
    obModel: {
      variant: ModelVariant;
      fade: { value: number };
      tint: { value: THREE.Vector4 };
      inst: { value: THREE.Vector4 };
      mask: { value: THREE.Texture };
      glass: { value: THREE.Vector4 };
      keyLum: { value: number };
    };
  };
}

/**
 * A model material (one per model / texture: the program is shared by every model of the same variant). Dispose it
 * with the mesh; the textures belong to world/models.ts.
 */
export function makeModelMaterial(o: ModelMaterialOptions): ModelMaterial {
  const m = new THREE.MeshStandardMaterial({ map: o.map, roughness: 0.86, metalness: 0 }) as ModelMaterial;
  m.name = o.name ?? `ob-model:${o.variant}`;
  const hero = o.variant === 'ob-model-hero';
  const fade = o.fade ?? { value: 0 };
  const glassColor = new THREE.Color(o.glass?.color ?? '#000000');
  const u = {
    fade,
    tint: { value: new THREE.Vector4(...(o.tint ?? [1, 1, 1, 0])) },
    inst: { value: new THREE.Vector4(...(o.inst ?? [0.55, 1, 0, 0])) },
    mask: { value: o.mask ?? noMask() },
    glass: { value: new THREE.Vector4(glassColor.r, glassColor.g, glassColor.b, o.glass?.strength ?? 0) },
    keyLum: { value: keyLuminance(o.tintKey) },
  };
  m.userData.obModel = { variant: o.variant, ...u };
  if (hero) m.defines = { OB_HERO: '' };
  m.onBeforeCompile = shader => {
    patchToyShader(shader, { sway: false, hero: hero ? fade : undefined });
    shader.uniforms.uObMask = u.mask;
    shader.uniforms.uObKeyLum = u.keyLum;
    shader.uniforms.uObGlass = u.glass;
    // plain meshes read these uniforms; InstancedMesh reads the aObTint / aObInst attributes instead
    shader.uniforms.uObTint = u.tint;
    shader.uniforms.uObInst = u.inst;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${FRAG_MAIN}`);
  };
  m.customProgramCacheKey = () => o.variant;
  return m;
}

/**
 * Per-instance attributes for an InstancedMesh of model geometry `geo` (a shallow clone sharing position / normal /
 * uv): aObTint (rgb, strength) and aObInst (occupancy, fade, seed, glow), `count` instances, dynamic.
 */
export function modelInstanceGeometry(geo: THREE.BufferGeometry, count: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geo.attributes)) g.setAttribute(name, attr);
  g.setIndex(geo.getIndex());
  g.boundingBox = geo.boundingBox?.clone() ?? null;
  g.boundingSphere = geo.boundingSphere?.clone() ?? null;
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const inst = new THREE.InstancedBufferAttribute(new Float32Array(count * 4).map((_, i) => (i % 4 === 1 ? 1 : 0)), 4);
  tint.setUsage(THREE.DynamicDrawUsage);
  inst.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute(MODEL_TINT_ATTR, tint);
  g.setAttribute(MODEL_INST_ATTR, inst);
  return g;
}

/** Write instance i's tint (sRGB hex or linear rgb, strength) and occupancy / fade / seed / glow (TOY aInfo.w code). */
export function setModelInstance(geo: THREE.BufferGeometry, i: number, tint: string | readonly [number, number, number] | null, strength: number, occupancy = 0.55, fade = 1, seed = 0, glow = 0) {
  const t = geo.getAttribute(MODEL_TINT_ATTR) as THREE.InstancedBufferAttribute, a = geo.getAttribute(MODEL_INST_ATTR) as THREE.InstancedBufferAttribute;
  if (tint === null) t.setXYZW(i, 1, 1, 1, 0);
  else if (typeof tint === 'string') { const c = new THREE.Color(tint); t.setXYZW(i, c.r, c.g, c.b, strength); }
  else t.setXYZW(i, tint[0], tint[1], tint[2], strength);
  a.setXYZW(i, occupancy, fade, seed, glow);
  t.needsUpdate = true;
  a.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Shader warm-up (plan §5.5): the model programs and the per-landmark hero TOY program compile at boot, with the
// dummies built like the real meshes (plain Mesh / InstancedMesh, a map, normals + uv; hero TOY on TypedBatch geometry).
// City mode only: a district session never draws them. Registered at import (sites.ts imports this module).
// ---------------------------------------------------------------------------

/**
 * The warm-up materials stay alive for the session (never disposed): three frees a program as soon as no material uses
 * it, so a disposed dummy would throw its freshly compiled program away and the first real model would compile again
 * (seen in the city: 2 programs more with the AI gate than with `?ai=0`). One material per variant, a white 1×1 map.
 */
let warmMats: { hero: ModelMaterial; inst: ModelMaterial; heroToy: THREE.Material } | null = null;
function warmMaterials() {
  if (!warmMats) {
    const map = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    warmMats = {
      hero: makeModelMaterial({ map, variant: 'ob-model-hero', name: 'ob-model-hero:warmup' }),
      inst: makeModelMaterial({ map, variant: 'ob-model-inst', name: 'ob-model-inst:warmup' }),
      heroToy: makeHeroMaterial('warmup').material,
    };
  }
  return warmMats;
}

/** The objects the warm-up compiles (exported for the test: one per variant + the hero TOY mesh). */
export function modelWarmupSet(): { objects: THREE.Object3D[]; dispose: () => void } {
  const { hero, inst, heroToy } = warmMaterials();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const heroMesh = new THREE.Mesh(box, hero);
  heroMesh.castShadow = true;
  heroMesh.receiveShadow = true;
  const instGeo = modelInstanceGeometry(box, 1);
  const instMesh = new THREE.InstancedMesh(instGeo, inst, 1);
  instMesh.receiveShadow = true;
  const toy = new TypedBatch(8);
  toy.polygon([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 1, z: 1 }], 0, new THREE.Color('#ffffff'), [0, 0, 0, 0]);
  const toyGeo = TypedBatch.toGeometry(toy.toArrays());
  const toyMesh = new THREE.Mesh(toyGeo, heroToy);
  toyMesh.castShadow = true;
  toyMesh.receiveShadow = true;
  return {
    objects: [heroMesh, instMesh, toyMesh],
    // geometry only: the materials keep their programs (see warmMaterials)
    dispose: () => { box.dispose(); instGeo.dispose(); toyGeo.dispose(); instMesh.dispose(); },
  };
}

registerWarmup('d2-models', () => (game.get().worldMode === 'city' ? modelWarmupSet() : { objects: [] }));
